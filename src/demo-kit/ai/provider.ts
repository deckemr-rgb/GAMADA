/**
 * ai/provider.ts — the one entry point UI uses (spec §9.1): getAi('sim' | 'live') → AiProvider.
 *
 * 'sim' runs the registered Scenario through the scripted engine. 'live' calls the proxy and falls back to the
 * simulation automatically — no first chunk within DEMO.liveFirstTokenTimeoutMs, HTTP 429/5xx/any HTTP error,
 * network failure, an aborted stream (not aborted by the caller), malformed SSE or an `error` event ⇒ the
 * simulated answer continues the turn and `done.fellBack` is true. If the live stream already produced text,
 * only the simulation's non-text chunks (steps, structured, follow-ups) are appended. An invalid structured
 * result (zod) is replaced by the simulation's structured result. Every fallback notifies onLiveFallback()
 * listeners (the shell shows the toast "AI Live sedang sibuk, beralih ke Simulasi", spec §8.5).
 */
import { z } from 'zod'
import { DEMO } from '../../lib/motion'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import type { AiChunk, AiProvider, ChatRequest, Extracted, ExtractRequest, Scenario, SimResponse, Structured } from './types'
import { simChunks, simulate, type SimResult } from './scripted/engine'
import { checkHealth, isLiveConfigured, LiveError, liveChat, liveExtract, peekHealth, type LiveErrorKind } from './live'
import { sleep } from './stream'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const PROVIDER = {
  /** simulated extraction "reading" time (≤ DEMO.skeletonMaxMs) */
  simExtractMs: 360,
} as const

/** Toast copy for a live → sim fallback (spec §8.5). */
export const LIVE_FALLBACK_NOTICE = {
  id: 'AI Live sedang sibuk, beralih ke Simulasi',
  en: 'Live AI is busy, switching to Simulation',
} as const

/* ------------------------------------------------------------------ scenarios */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScenario = Scenario<any>
const scenarios = new Map<ProductSlug, AnyScenario>()

/** Register (or replace) the simulation scenario of a product. */
export function registerScenario<W>(s: Scenario<W>): void {
  scenarios.set(s.product, s as AnyScenario)
}
/** Remove a product's scenario (tests, showcase cleanup). */
export function unregisterScenario(slug: ProductSlug): void {
  scenarios.delete(slug)
}
export function getScenario(slug: ProductSlug): Scenario<unknown> | undefined {
  return scenarios.get(slug)
}

/* ------------------------------------------------------------------ structured validation */

const StructuredEnvelope = z.object({ kind: z.string().min(1), data: z.record(z.string(), z.unknown()) })
const kindSchemas = new Map<string, z.ZodType<Record<string, unknown>>>()

/** Per-kind zod schema for Structured.data (products register theirs, e.g. 'ticket'). */
export function registerStructuredSchema(kind: string, schema: z.ZodType<Record<string, unknown>>): void {
  kindSchemas.set(kind, schema)
}

/** Validate a structured value (envelope + registered per-kind schema). null when invalid. */
export function validateStructured(value: unknown): Structured | null {
  const env = StructuredEnvelope.safeParse(value)
  if (!env.success) return null
  const schema = kindSchemas.get(env.data.kind)
  if (!schema) return env.data
  const p = schema.safeParse(env.data.data)
  return p.success ? { kind: env.data.kind, data: p.data } : null
}

/* ------------------------------------------------------------------ per-request extras (side channel) */

/** What a simulated turn produced beyond AiChunks: world events to emit, a translation line, the match. */
export interface SimExtras {
  emits: NonNullable<SimResponse['emits']>
  translation?: string
  result: SimResult
}
const extras = new WeakMap<ChatRequest, SimExtras>()

/** Read (once) the extras of a finished simulated turn for this exact request object. */
export function takeSimExtras(req: ChatRequest): SimExtras | undefined {
  const x = extras.get(req)
  extras.delete(req)
  return x
}

function simulateReq(req: ChatRequest): SimResult {
  const result = simulate(scenarios.get(req.product), {
    product: req.product,
    role: req.role,
    lang: req.lang,
    messages: req.messages,
    world: req.context,
  })
  const x: SimExtras = { emits: result.response.emits ?? [], result }
  if (result.response.translation) x.translation = result.response.translation
  extras.set(req, x)
  return result
}

/* ------------------------------------------------------------------ fallback events */

export type FallbackReason = LiveErrorKind
export interface FallbackInfo {
  product: ProductSlug
  reason: FallbackReason
  status?: number
  op: 'chat' | 'extract'
}
const fallbackListeners = new Set<(info: FallbackInfo) => void>()

/** Subscribe to live → sim fallbacks (for the toast). Returns unsubscribe. */
export function onLiveFallback(fn: (info: FallbackInfo) => void): () => void {
  fallbackListeners.add(fn)
  return () => void fallbackListeners.delete(fn)
}
function notify(info: FallbackInfo): void {
  for (const fn of fallbackListeners) {
    try {
      fn(info)
    } catch {
      /* listener errors never break the chat */
    }
  }
}

/* ------------------------------------------------------------------ sim provider */

async function simExtract(req: ExtractRequest): Promise<Extracted> {
  const s = scenarios.get(req.product)
  if (!s?.extract) throw new Error(`No simulated extraction for ${req.product}`)
  await sleep(Math.min(PROVIDER.simExtractMs, DEMO.skeletonMaxMs), req.signal)
  if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return { ...s.extract(req), mode: 'sim' }
}

export const simProvider: AiProvider = {
  mode: 'sim',
  chat(req) {
    return (async function* () {
      const result = simulateReq(req)
      yield* simChunks(result, req.signal ? { signal: req.signal } : {})
    })()
  },
  extract: simExtract,
}

/* ------------------------------------------------------------------ live provider with fallback */

export interface LiveProviderOptions {
  /** default DEMO.liveFirstTokenTimeoutMs */
  firstTokenTimeoutMs?: number
}

/** The live provider wrapped with automatic fallback to simulation. */
export function createLiveProvider(opts: LiveProviderOptions = {}): AiProvider {
  const timeoutMs = opts.firstTokenTimeoutMs ?? DEMO.liveFirstTokenTimeoutMs

  async function* fallback(req: ChatRequest, err: LiveError, afterText: boolean): AsyncGenerator<AiChunk> {
    notify({ product: req.product, reason: err.kind, op: 'chat', ...(err.status !== undefined ? { status: err.status } : {}) })
    for await (const c of simProvider.chat(req)) {
      if (afterText && c.type === 'text') continue
      if (c.type === 'done') yield { ...c, mode: afterText ? 'live' : 'sim', fellBack: true }
      else yield c
    }
  }

  async function* chat(req: ChatRequest): AsyncGenerator<AiChunk> {
    const userSignal = req.signal
    if (userSignal?.aborted) return
    const known = peekHealth()
    if (!isLiveConfigured() || (known && !known.live)) {
      yield* fallback(req, new LiveError('unavailable'), false)
      return
    }
    const ctrl = new AbortController()
    const forward = () => ctrl.abort()
    userSignal?.addEventListener('abort', forward, { once: true })
    const it = liveChat({ ...req, signal: ctrl.signal })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      let first: IteratorResult<AiChunk>
      try {
        first = await Promise.race([
          it.next(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new LiveError('timeout', 'no first token')), timeoutMs)
          }),
        ])
        if (first.done) throw new LiveError('protocol', 'empty stream')
      } catch (e) {
        ctrl.abort()
        void it.return(undefined).catch(() => {})
        if (userSignal?.aborted) return
        yield* fallback(req, e instanceof LiveError ? e : new LiveError('network', String(e)), false)
        return
      } finally {
        if (timer) clearTimeout(timer)
      }

      let afterText = false
      let invalidStructured = false
      let done: Extract<AiChunk, { type: 'done' }> | null = null
      let cur: IteratorResult<AiChunk> = first
      try {
        while (!cur.done) {
          const c = cur.value
          if (c.type === 'structured') {
            const v = validateStructured(c.value)
            if (v) yield { type: 'structured', value: v }
            else invalidStructured = true
          } else if (c.type === 'done') {
            done = c
          } else {
            if (c.type === 'text') afterText = true
            yield c
          }
          if (done) break
          cur = await it.next()
        }
      } catch (e) {
        ctrl.abort()
        if (userSignal?.aborted) return
        yield* fallback(req, e instanceof LiveError ? e : new LiveError('network', String(e)), afterText)
        return
      }
      if (userSignal?.aborted) return

      const out: Extract<AiChunk, { type: 'done' }> = { type: 'done', mode: 'live' }
      if (done?.intentId) out.intentId = done.intentId
      if (done?.confidence !== undefined) out.confidence = done.confidence
      if (invalidStructured) {
        notify({ product: req.product, reason: 'invalid', op: 'chat' })
        const sim = simulateReq(req).response.structured
        if (sim) yield { type: 'structured', value: sim }
        out.fellBack = true
      }
      yield out
    } finally {
      userSignal?.removeEventListener('abort', forward)
    }
  }

  async function extract(req: ExtractRequest): Promise<Extracted> {
    try {
      if (!isLiveConfigured()) throw new LiveError('unavailable')
      return await liveExtract(req)
    } catch (e) {
      if (req.signal?.aborted) throw e
      const err = e instanceof LiveError ? e : new LiveError('network', String(e))
      notify({ product: req.product, reason: err.kind, op: 'extract', ...(err.status !== undefined ? { status: err.status } : {}) })
      return simExtract(req)
    }
  }

  return { mode: 'live', chat, extract }
}

let liveProvider: AiProvider | null = null

/** The provider for a mode. 'live' is always wrapped with fallback to simulation. */
export function getAi(mode: 'sim' | 'live'): AiProvider {
  if (mode === 'sim') return simProvider
  liveProvider ??= createLiveProvider()
  return liveProvider
}

/** Is live mode usable right now? (health check, cached; false without VITE_AI_PROXY_URL) */
export async function liveAvailable(): Promise<boolean> {
  if (!isLiveConfigured()) return false
  return (await checkHealth()).live
}

/** Default role of a product (used when callers do not pass one). */
export function defaultRole(product: ProductSlug) {
  return PRODUCT_BY_SLUG[product].defaultRole
}
