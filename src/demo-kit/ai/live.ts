/**
 * ai/live.ts — client for the AI proxy (spec §9.3, §10). Raw, no fallback: provider.ts wraps it.
 *
 * Base URL: import.meta.env.VITE_AI_PROXY_URL (absent ⇒ live is unavailable and nothing is fetched).
 *
 * Wire format expected from POST {base}/api/ai/chat (text/event-stream). Each event's data is JSON:
 *   event: text        data: {"text":"…"}                       (a bare JSON string is accepted too)
 *   event: tool_call   data: {"call":{id,name,input,output?,ms?}} (or the ToolCall itself)
 *   event: structured  data: {"value":{kind,data}}             (or {kind,data})
 *   event: followups   data: {"chips":["…"]}                   (or an array)
 *   event: done        data: {"intentId"?,"confidence"?}
 *   event: error       data: {"message":"…","status"?:429}      → LiveError('upstream')
 * An unnamed event whose data is an AiChunk ({"type":"text",…}) is accepted as well. ":" comment lines
 * (keep-alives) are ignored. EventSource is not used because it cannot POST.
 */
import { z } from 'zod'
import type { AiChunk, ChatRequest, Extracted, ExtractRequest, ToolCall } from './types'
import { summarize } from './context'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const LIVE = {
  healthTimeoutMs: 3000,
  /** cache a healthy answer this long, an unhealthy one shorter */
  healthTtlOkMs: 60_000,
  healthTtlFailMs: 15_000,
  /** max upload for /api/ai/extract (spec §10: ≤ 8 MB) */
  extractMaxBytes: 8 * 1024 * 1024,
  contextMaxBytes: 6000,
} as const

/* ------------------------------------------------------------------ config */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface LiveConfig {
  baseUrl: string | null
  fetch: FetchLike
}

function envBaseUrl(): string | null {
  let raw: unknown
  try {
    raw = (import.meta as { env?: Record<string, unknown> }).env?.VITE_AI_PROXY_URL
  } catch {
    raw = undefined
  }
  return typeof raw === 'string' && raw.trim() ? raw.trim().replace(/\/+$/, '') : null
}

const cfg: LiveConfig = {
  baseUrl: envBaseUrl(),
  fetch: (input, init) => globalThis.fetch(input, init),
}

/** Override the proxy base URL and/or fetch (tests, integrator). Resets the health cache. */
export function configureLive(patch: { baseUrl?: string | null; fetch?: FetchLike }): void {
  if ('baseUrl' in patch) cfg.baseUrl = patch.baseUrl ? patch.baseUrl.replace(/\/+$/, '') : null
  if (patch.fetch) cfg.fetch = patch.fetch
  healthCache = null
}

export function liveBaseUrl(): string | null {
  return cfg.baseUrl
}
export function isLiveConfigured(): boolean {
  return !!cfg.baseUrl
}

/* ------------------------------------------------------------------ errors */

export type LiveErrorKind = 'unavailable' | 'timeout' | 'http' | 'network' | 'abort' | 'protocol' | 'upstream' | 'invalid'

export class LiveError extends Error {
  readonly kind: LiveErrorKind
  readonly status?: number
  constructor(kind: LiveErrorKind, message?: string, status?: number) {
    super(message ?? kind)
    this.name = 'LiveError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

function asLiveError(e: unknown, signal?: AbortSignal): LiveError {
  if (e instanceof LiveError) return e
  if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return new LiveError('abort', 'aborted')
  return new LiveError('network', e instanceof Error ? e.message : String(e))
}

/* ------------------------------------------------------------------ health */

export interface Health {
  ok: boolean
  live: boolean
  models: string[]
}

const HealthSchema = z.object({
  ok: z.boolean(),
  live: z.boolean().optional(),
  models: z.union([z.array(z.string()), z.record(z.string(), z.string())]).optional(),
})

let healthCache: { at: number; value: Health; pending?: Promise<Health> } | null = null
const DOWN: Health = { ok: false, live: false, models: [] }

/** Last known health (null when never checked or expired). */
export function peekHealth(now: number = Date.now()): Health | null {
  if (!healthCache || healthCache.pending) return null
  const ttl = healthCache.value.live ? LIVE.healthTtlOkMs : LIVE.healthTtlFailMs
  return now - healthCache.at <= ttl ? healthCache.value : null
}

/** GET {base}/api/ai/health with a 3 s timeout; cached (60 s when healthy, 15 s when not); deduplicated. */
export function checkHealth(opts: { force?: boolean } = {}): Promise<Health> {
  if (!cfg.baseUrl) return Promise.resolve(DOWN)
  if (!opts.force) {
    if (healthCache?.pending) return healthCache.pending
    const known = peekHealth()
    if (known) return Promise.resolve(known)
  }
  const url = `${cfg.baseUrl}/api/ai/health`
  const pending = (async (): Promise<Health> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), LIVE.healthTimeoutMs)
    try {
      const res = await cfg.fetch(url, { method: 'GET', signal: ctrl.signal, headers: { accept: 'application/json' } })
      if (!res.ok) return DOWN
      const parsed = HealthSchema.safeParse(await res.json())
      if (!parsed.success) return DOWN
      const m = parsed.data.models
      const models = Array.isArray(m) ? m : m ? Object.values(m) : []
      return { ok: parsed.data.ok, live: parsed.data.ok && (parsed.data.live ?? true), models }
    } catch {
      return DOWN
    } finally {
      clearTimeout(timer)
    }
  })()
  healthCache = { at: Date.now(), value: DOWN, pending }
  void pending.then((value) => {
    if (healthCache?.pending === pending) healthCache = { at: Date.now(), value }
  })
  return pending
}

/* ------------------------------------------------------------------ SSE */

export interface SseEvent {
  event: string
  data: string
  id?: string
}

/** Parse a text/event-stream body (WHATWG rules: event/data/id fields, ':' comments, blank-line dispatch). */
export async function* parseSSE(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let event = ''
  let data: string[] = []
  let id: string | undefined
  const onAbort = () => void reader.cancel().catch(() => {})
  signal?.addEventListener('abort', onAbort, { once: true })

  function* lines(flush: boolean): Generator<SseEvent> {
    for (;;) {
      const m = /\r\n|\r|\n/.exec(buf)
      if (!m) break
      // a lone \r at the very end may be the first half of \r\n
      if (m[0] === '\r' && m.index === buf.length - 1 && !flush) break
      const line = buf.slice(0, m.index)
      buf = buf.slice(m.index + m[0].length)
      if (line === '') {
        if (data.length) {
          const ev: SseEvent = { event: event || 'message', data: data.join('\n') }
          if (id !== undefined) ev.id = id
          yield ev
        }
        event = ''
        data = []
        continue
      }
      if (line.startsWith(':')) continue
      const c = line.indexOf(':')
      const field = c === -1 ? line : line.slice(0, c)
      let value = c === -1 ? '' : line.slice(c + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
      else if (field === 'id') id = value
    }
  }

  try {
    for (;;) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      yield* lines(false)
    }
    buf += decoder.decode()
    yield* lines(true)
    if (data.length) yield { event: event || 'message', data: data.join('\n'), ...(id !== undefined ? { id } : {}) }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    try {
      reader.releaseLock()
    } catch {
      /* already released */
    }
  }
}

/* ------------------------------------------------------------------ chunk mapping */

const ToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.unknown().optional(),
  ms: z.number().optional(),
})

let toolSeq = 0

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data)
  } catch {
    throw new LiveError('protocol', 'malformed SSE data')
  }
}

/** Map one SSE event to an AiChunk (null = ignore). Throws LiveError on 'error' events / malformed data. */
export function sseToChunk(ev: SseEvent): AiChunk | null {
  const name = ev.event
  if (name === 'ping' || name === 'heartbeat') return null
  const raw = parseJson(ev.data)
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const kind = name === 'message' && typeof obj.type === 'string' ? obj.type : name
  switch (kind) {
    case 'text': {
      const text = typeof raw === 'string' ? raw : typeof obj.text === 'string' ? obj.text : null
      if (text === null) throw new LiveError('protocol', 'text event without text')
      return { type: 'text', text }
    }
    case 'tool_call': {
      const p = ToolCallSchema.safeParse(obj.call ?? obj)
      if (!p.success) throw new LiveError('protocol', 'bad tool_call')
      const call: ToolCall = { id: p.data.id ?? `live-${++toolSeq}`, name: p.data.name, input: p.data.input ?? {} }
      if (p.data.output !== undefined) call.output = p.data.output
      if (p.data.ms !== undefined) call.ms = p.data.ms
      return { type: 'tool_call', call }
    }
    case 'structured': {
      // validated later by the provider (zod per kind); here only the envelope
      const value = (obj.value ?? obj) as { kind?: unknown; data?: unknown }
      return { type: 'structured', value: value as { kind: string; data: Record<string, unknown> } }
    }
    case 'followups': {
      const chips = Array.isArray(raw) ? raw : obj.chips
      if (!Array.isArray(chips)) throw new LiveError('protocol', 'bad followups')
      return { type: 'followups', chips: chips.filter((c): c is string => typeof c === 'string') }
    }
    case 'done': {
      const out: AiChunk = { type: 'done', mode: 'live' }
      if (typeof obj.intentId === 'string') out.intentId = obj.intentId
      if (typeof obj.confidence === 'number') out.confidence = obj.confidence
      return out
    }
    case 'error': {
      const status = typeof obj.status === 'number' ? obj.status : undefined
      throw new LiveError('upstream', typeof obj.message === 'string' ? obj.message : 'upstream error', status)
    }
    default:
      return null
  }
}

/* ------------------------------------------------------------------ chat */

/**
 * Stream a live chat answer. Throws LiveError for: not configured, HTTP ≥ 400, network failure, abort,
 * malformed SSE, an `error` event. Ends after the `done` chunk (or when the stream closes).
 */
export async function* liveChat(req: ChatRequest): AsyncGenerator<AiChunk> {
  if (!cfg.baseUrl) throw new LiveError('unavailable', 'VITE_AI_PROXY_URL is not set')
  const body = JSON.stringify({
    product: req.product,
    role: req.role,
    lang: req.lang,
    messages: req.messages,
    context: summarize(req.context, LIVE.contextMaxBytes),
    ...(req.tools ? { tools: req.tools } : {}),
  })
  let res: Response
  try {
    res = await cfg.fetch(`${cfg.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body,
      ...(req.signal ? { signal: req.signal } : {}),
    })
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (!res.ok) throw new LiveError('http', `HTTP ${res.status}`, res.status)
  if (!res.body) throw new LiveError('protocol', 'empty body')
  try {
    for await (const ev of parseSSE(res.body, req.signal)) {
      const chunk = sseToChunk(ev)
      if (!chunk) continue
      yield chunk
      if (chunk.type === 'done') return
    }
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (req.signal?.aborted) throw new LiveError('abort', 'aborted')
}

/* ------------------------------------------------------------------ extract */

const Bi = z.object({ id: z.string(), en: z.string() })
const Box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
export const ExtractedSchema = z.object({
  kind: z.enum(['document', 'invoice', 'cv', 'ktp-specimen']),
  fields: z.array(
    z.object({ key: z.string(), label: Bi, value: z.string(), confidence: z.number().min(0).max(1), box: Box.optional() }),
  ),
  checks: z
    .array(z.object({ id: z.string(), label: Bi, status: z.enum(['ok', 'warn', 'fail']), note: z.string().optional() }))
    .optional(),
  tamper: z.array(Box.extend({ score: z.number() })).optional(),
})

/** POST multipart {product, kind, text?, image?} to {base}/api/ai/extract; validated with zod. */
export async function liveExtract(req: ExtractRequest): Promise<Extracted> {
  if (!cfg.baseUrl) throw new LiveError('unavailable', 'VITE_AI_PROXY_URL is not set')
  if (req.image && req.image.size > LIVE.extractMaxBytes) throw new LiveError('invalid', 'image larger than 8 MB')
  const form = new FormData()
  form.append('product', req.product)
  form.append('kind', req.kind)
  if (req.text) form.append('text', req.text)
  if (req.image) form.append('image', req.image, 'upload')
  let res: Response
  try {
    res = await cfg.fetch(`${cfg.baseUrl}/api/ai/extract`, { method: 'POST', body: form, ...(req.signal ? { signal: req.signal } : {}) })
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (!res.ok) throw new LiveError('http', `HTTP ${res.status}`, res.status)
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new LiveError('protocol', 'extract: invalid JSON')
  }
  const p = ExtractedSchema.safeParse(json)
  if (!p.success) throw new LiveError('invalid', 'extract: schema mismatch')
  const out: Extracted = { kind: p.data.kind, fields: p.data.fields.map((f) => ({ ...f, ...(f.box ? { box: f.box } : {}) })), mode: 'live' }
  if (p.data.checks) out.checks = p.data.checks.map((c) => (c.note === undefined ? { id: c.id, label: c.label, status: c.status } : { ...c, note: c.note }))
  if (p.data.tamper) out.tamper = p.data.tamper
  return out
}
