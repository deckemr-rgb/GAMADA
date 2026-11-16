/**
 * app.ts — Hono app factory shared by every runtime adapter (node, Vercel, Netlify, Workers).
 *
 *   GET  /api/ai/health   → { ok, live, mock, models: { fast, smart, extract }, reason? }
 *   POST /api/ai/chat     → SSE: text | tool_call | done | error   (JSON error before streaming)
 *   POST /api/ai/extract  → Extracted JSON (multipart `image` ≤ 8 MB or `text`; or JSON { text })
 *
 * Error responses are always JSON `{ error: { code, message, retryable } }` with a status the site
 * treats as "fall back to simulation" (429 / 5xx) when the cause is on our side.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { streamSSE } from 'hono/streaming'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type Anthropic from '@anthropic-ai/sdk'
import { readConfig } from './config.js'
import type { ProxyEnv } from './config.js'
import { createStore } from './kv.js'
import { createRateLimiter } from './ratelimit.js'
import { createBudget } from './budget.js'
import { createLogger, hashIp } from './log.js'
import type { LogRecord } from './log.js'
import {
  ACCEPTED_FILE_TYPES,
  ChatRequestSchema,
  ExtractFieldsSchema,
  LIMITS,
} from './schemas.js'
import type { AcceptedFileType, ProxyEvent } from './schemas.js'
import { createClient, mapError, modelFor, newChatRun, runChat, runExtract } from './claude.js'
import { mockChat, mockExtract } from './mock.js'

export interface AppOptions {
  /** header that carries the real client IP on this platform (only read when TRUST_PROXY) */
  ipHeader?: string
  /** socket-level IP (node adapter) used when the header is absent or untrusted */
  getIp?: (c: Context) => string | undefined
  /** default for TRUST_PROXY when the env does not set it */
  trustProxyDefault?: boolean
}

type AppEnv = { Variables: { reqId: string } }

type ErrBody = { error: { code: string; message: string; retryable: boolean; issues?: string[] } }

const RETRYABLE = new Set([429, 500, 502, 503, 504])

export function createApp(env: ProxyEnv, opts: AppOptions = {}) {
  const cfg = readConfig({
    ...env,
    TRUST_PROXY: env.TRUST_PROXY ?? (opts.trustProxyDefault === false ? '0' : '1'),
  })
  const store = createStore(cfg.redisUrl, cfg.redisToken)
  const limit = createRateLimiter(store, cfg.rateLimitPerIp, cfg.rateLimitWindowSec)
  const budget = createBudget(store, cfg.dailyTokenBudget)
  const log = createLogger(cfg.logLevel)
  let client: Anthropic | undefined
  const getClient = () => (client ??= createClient(cfg))
  const anyOrigin = cfg.allowedOrigins.includes('*')
  const originOk = (o: string) => anyOrigin || cfg.allowedOrigins.includes(o.replace(/\/+$/, ''))

  const clientIp = (c: Context): string => {
    if (cfg.trustProxy) {
      const h = opts.ipHeader ?? 'x-forwarded-for'
      const v = c.req.header(h)?.split(',')[0]?.trim()
      if (v) return v
    }
    return opts.getIp?.(c) ?? 'unknown'
  }

  const fail = (c: Context, status: ContentfulStatusCode, code: string, message: string, issues?: string[]) => {
    const body: ErrBody = { error: { code, message, retryable: RETRYABLE.has(status), ...(issues ? { issues } : {}) } }
    return c.json(body, status)
  }

  const app = new Hono<AppEnv>()

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      crossOriginResourcePolicy: 'cross-origin',
      crossOriginEmbedderPolicy: false,
      referrerPolicy: 'no-referrer',
    }),
  )
  app.use('*', async (c, next) => {
    const reqId = c.req.header('x-request-id')?.slice(0, 64) || crypto.randomUUID()
    c.set('reqId', reqId)
    await next()
    c.header('X-Request-Id', reqId)
    if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store')
  })
  app.use(
    '/api/ai/*',
    cors({
      origin: (origin) => (origin && originOk(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Request-Id'],
      exposeHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 600,
    }),
  )
  // CORS only stops browsers from READING; refuse foreign-origin POSTs outright.
  app.use('/api/ai/*', async (c, next) => {
    const origin = c.req.header('origin')
    if (c.req.method === 'POST' && origin && !originOk(origin)) {
      return fail(c, 403, 'origin_not_allowed', 'Origin is not in ALLOWED_ORIGINS.')
    }
    await next()
  })

  const reqIdOf = (c: Context<AppEnv>) => c.get('reqId') ?? '-'

  /** Rate limit + headers; returns a Response when the caller must stop. */
  const guard = async (c: Context): Promise<Response | { ip: string }> => {
    const ip = hashIp(clientIp(c))
    const r = await limit(ip)
    c.header('RateLimit-Limit', String(r.limit))
    c.header('RateLimit-Remaining', String(r.remaining))
    c.header('RateLimit-Reset', String(r.resetSec))
    if (!r.ok) {
      c.header('Retry-After', String(r.resetSec))
      return fail(c, 429, 'rate_limited', `Too many requests: ${r.limit} per ${cfg.rateLimitWindowSec} s.`)
    }
    return { ip }
  }

  const liveState = async (): Promise<{ live: boolean; reason?: string; resetSec?: number }> => {
    if (cfg.mock) return { live: true }
    if (!cfg.apiKey) return { live: false, reason: 'no_api_key' }
    const b = await budget.status()
    return b.ok ? { live: true } : { live: false, reason: 'budget_exhausted', resetSec: b.resetSec }
  }

  /** 503 when live AI cannot serve (no key / budget spent). */
  const unavailable = async (c: Context): Promise<Response | null> => {
    const s = await liveState()
    if (s.live) return null
    if (s.reason === 'budget_exhausted') {
      c.header('Retry-After', String(s.resetSec ?? 3600))
      return fail(c, 503, 'budget_exhausted', 'Daily AI token budget is used up; use simulation mode.')
    }
    return fail(c, 503, 'not_configured', 'Live AI is not configured on this server (no ANTHROPIC_API_KEY).')
  }

  /* ---------------------------------------------------------------- health */

  app.get('/api/ai/health', async (c) => {
    const s = await liveState()
    return c.json({
      ok: true,
      live: s.live,
      mock: cfg.mock,
      models: { fast: cfg.modelFast, smart: cfg.modelSmart, extract: cfg.modelExtract },
      ...(s.reason ? { reason: s.reason } : {}),
    })
  })

  /* ---------------------------------------------------------------- chat */

  app.post(
    '/api/ai/chat',
    bodyLimit({
      maxSize: LIMITS.chatBodyBytes,
      onError: (c) => fail(c, 413, 'payload_too_large', `Chat body over ${LIMITS.chatBodyBytes} bytes.`),
    }),
    async (c) => {
      const t0 = Date.now()
      const rec: LogRecord = { route: 'chat', status: 0, ms: 0, reqId: reqIdOf(c) }
      const done = (r: Response) => {
        rec.status = r.status
        rec.ms = Date.now() - t0
        log(rec)
        return r
      }
      const g = await guard(c)
      if (g instanceof Response) return done(g)
      rec.ip = g.ip

      let raw: unknown
      try {
        raw = await c.req.json()
      } catch {
        return done(fail(c, 400, 'invalid_json', 'Body must be JSON.'))
      }
      const parsed = ChatRequestSchema.safeParse(raw)
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
        return done(fail(c, 400, 'invalid_request', 'Request failed validation.', issues))
      }
      const req = parsed.data
      rec.product = req.product
      rec.messages = req.messages.length
      rec.mock = cfg.mock

      const lastText = req.messages[req.messages.length - 1]?.content ?? ''
      if (cfg.mock && lastText.includes('[mock:429]')) {
        c.header('Retry-After', '30')
        return done(fail(c, 429, 'upstream_rate_limited', 'Simulated rate limit (mock).'))
      }
      if (cfg.mock && lastText.includes('[mock:budget]')) {
        return done(fail(c, 503, 'budget_exhausted', 'Simulated budget exhaustion (mock).'))
      }
      const na = await unavailable(c)
      if (na) return done(na)

      const ac = new AbortController()
      c.req.raw.signal?.addEventListener('abort', () => ac.abort(), { once: true })
      const run = newChatRun()
      run.model = cfg.mock ? 'mock' : modelFor(cfg, req.product).model
      rec.model = run.model
      const gen: AsyncGenerator<ProxyEvent, void> = cfg.mock
        ? mockChat(req, cfg.mockDelayMs, ac.signal)
        : runChat(getClient(), cfg, budget, req, ac.signal, run)

      // Pull the first event before committing to a 200 SSE response, so upstream failures
      // (429 / auth / overload) reach the browser as real HTTP statuses.
      let first: IteratorResult<ProxyEvent, void>
      try {
        first = await gen.next()
      } catch (err) {
        const m = mapError(err)
        rec.code = m.code
        if (m.status === 429) c.header('Retry-After', '30')
        return done(fail(c, m.status === 499 ? 400 : m.status, m.code, m.message))
      }

      c.header('X-Accel-Buffering', 'no')
      rec.status = 200
      return streamSSE(c, async (stream) => {
        stream.onAbort(() => ac.abort())
        let id = 0
        let toolCalls = 0
        let ev = first
        try {
          while (!ev.done) {
            const e = ev.value
            if (e.type === 'error') rec.code = e.code
            if (e.type === 'tool_call') toolCalls++
            await stream.writeSSE({ id: String(++id), event: e.type, data: JSON.stringify(e) })
            ev = await gen.next()
          }
        } catch (err) {
          const m = mapError(err)
          rec.code = m.code
          if (m.code !== 'aborted' && !stream.aborted) {
            const e: ProxyEvent = { type: 'error', code: m.code, message: m.message, retryable: m.retryable }
            await stream.writeSSE({ id: String(++id), event: 'error', data: JSON.stringify(e) })
          }
        } finally {
          rec.ms = Date.now() - t0
          rec.inputTokens = run.usage.input
          rec.outputTokens = run.usage.output
          rec.cacheReadTokens = run.usage.cacheRead
          rec.cacheWriteTokens = run.usage.cacheWrite
          rec.toolCalls = toolCalls
          log(rec)
        }
      })
    },
  )

  /* ---------------------------------------------------------------- extract */

  app.post(
    '/api/ai/extract',
    bodyLimit({
      maxSize: LIMITS.extractBodyBytes,
      onError: (c) => fail(c, 413, 'payload_too_large', 'Upload over 8 MB.'),
    }),
    async (c) => {
      const t0 = Date.now()
      const rec: LogRecord = { route: 'extract', status: 0, ms: 0, reqId: reqIdOf(c) }
      const done = (r: Response) => {
        rec.status = r.status
        rec.ms = Date.now() - t0
        log(rec)
        return r
      }
      const g = await guard(c)
      if (g instanceof Response) return done(g)
      rec.ip = g.ip

      const ctype = c.req.header('content-type') ?? ''
      let fields: Record<string, unknown>
      let file: File | undefined
      try {
        if (ctype.startsWith('multipart/form-data')) {
          const body = await c.req.parseBody()
          const f = body.image ?? body.file
          if (f instanceof File) file = f
          else if (f !== undefined && typeof f !== 'string') return done(fail(c, 400, 'invalid_request', 'Send one file in `image`.'))
          fields = { product: body.product, kind: body.kind, lang: body.lang ?? 'id', text: typeof body.text === 'string' && body.text ? body.text : undefined }
        } else if (ctype.startsWith('application/json')) {
          const j = (await c.req.json()) as Record<string, unknown>
          fields = { product: j.product, kind: j.kind, lang: j.lang ?? 'id', text: j.text }
        } else {
          return done(fail(c, 415, 'unsupported_media_type', 'Use multipart/form-data or application/json.'))
        }
      } catch {
        return done(fail(c, 400, 'invalid_body', 'Body could not be parsed.'))
      }
      const parsed = ExtractFieldsSchema.safeParse(fields)
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
        return done(fail(c, 400, 'invalid_request', 'Request failed validation.', issues))
      }
      const { product, kind, lang, text } = parsed.data
      rec.product = product
      rec.kind = kind
      if (!file && !text) return done(fail(c, 400, 'invalid_request', 'Send an `image` file or `text`.'))

      let upload: { mime: AcceptedFileType; base64: string } | undefined
      if (file) {
        rec.bytes = file.size
        rec.mime = file.type
        if (file.size > LIMITS.fileBytes) return done(fail(c, 413, 'payload_too_large', 'File over 8 MB.'))
        if (file.size === 0) return done(fail(c, 400, 'invalid_request', 'Empty file.'))
        const buf = new Uint8Array(await file.arrayBuffer())
        const sniffed = sniffType(buf)
        if (!sniffed || !(ACCEPTED_FILE_TYPES as readonly string[]).includes(sniffed)) {
          return done(fail(c, 415, 'unsupported_media_type', 'Accepted: JPEG, PNG, WebP, GIF, PDF.'))
        }
        upload = { mime: sniffed, base64: toBase64(buf) }
      }

      if (cfg.mock) {
        rec.mock = true
        return done(c.json({ ...mockExtract(kind), mock: true }))
      }
      const na = await unavailable(c)
      if (na) return done(na)

      try {
        const ac = new AbortController()
        c.req.raw.signal?.addEventListener('abort', () => ac.abort(), { once: true })
        const out = await runExtract(getClient(), cfg, budget, { product, kind, lang, file: upload, text }, ac.signal)
        rec.model = out.model
        rec.inputTokens = out.usage.input
        rec.outputTokens = out.usage.output
        rec.cacheReadTokens = out.usage.cacheRead
        rec.cacheWriteTokens = out.usage.cacheWrite
        return done(c.json(out.extracted))
      } catch (err) {
        const m = mapError(err)
        rec.code = m.code
        if (m.status === 429) c.header('Retry-After', '30')
        return done(fail(c, m.status === 499 ? 400 : m.status, m.code, m.message))
      }
    },
  )

  app.notFound((c) => fail(c, 404, 'not_found', 'Unknown endpoint.'))
  app.onError((err, c) => {
    console.error(JSON.stringify({ svc: 'ai-proxy', error: err.name, reqId: reqIdOf(c) }))
    return fail(c, 500, 'internal', 'Internal error.')
  })

  return app
}

/** Magic-byte sniffing — the declared Content-Type of an upload is not trusted. */
export function sniffType(b: Uint8Array): AcceptedFileType | null {
  const at = (i: number) => b[i] ?? -1
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png'
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'image/gif'
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50)
    return 'image/webp'
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return 'application/pdf'
  return null
}

/** Base64 that works on Node, Workers and edge runtimes (no Buffer dependency). */
export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return btoa(bin)
}

export type ProxyApp = ReturnType<typeof createApp>
