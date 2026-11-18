/**
 * ai/provider.ts — the one entry point UI uses (spec §9.1): getAi('sim' | 'live') → AiProvider.
 *
 * 'sim' runs the registered Scenario through the scripted engine. 'live' calls the proxy and falls back to the
 * simulation automatically — no first chunk within DEMO.liveFirstTokenTimeoutMs, HTTP 429/5xx/any HTTP error,
 * network failure, an aborted stream (not aborted by the caller), malformed SSE or an `error` event ⇒ the
 * simulated answer continues the turn. If the live stream already produced text, only the simulation's
 * non-text chunks (steps, structured, follow-ups) are appended. An invalid structured result (zod; default
 * schemas = STRUCTURED_SCHEMAS, mirrored from the proxy) is replaced by the simulation's structured result.
 * zod lives only in ai/live.ts, which is loaded with import() the first time a live request is made — the sim
 * path (and every demo route) never downloads it.
 * Owner decision: ANY fallback, also one part-way through a live answer, ends with done = { mode: 'sim',
 * fellBack: true }, so the badge never says "Live" for an answer the simulation completed. Every fallback
 * notifies onLiveFallback() listeners (the shell shows the toast "AI Live sedang sibuk, beralih ke Simulasi",
 * spec §8.5). Wire protocol: server/ai-proxy/README.md → "Protokol SSE".
 */
import { DEMO } from '../../lib/motion'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import type { AiChunk, AiProvider, ChatRequest, Extracted, ExtractRequest, SimResponse } from './types'
import { scenarios } from './scenarios'
import { simChunks, simulate, type SimResult } from './scripted/engine'
import { checkHealth, isLiveConfigured, LiveError, notifyLiveFallback, peekHealth, type FallbackInfo } from './live-base'
import { sleep } from './stream'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const PROVIDER = {
  /** simulated extraction "reading" time (≤ DEMO.skeletonMaxMs) */
  simExtractMs: 360,
} as const

export { LIVE_FALLBACK_NOTICE, onLiveFallback, registerStructuredSchema, type FallbackInfo, type FallbackReason } from './live-base'

/** the zod half of the live client, loaded once on first live use */
let liveModule: Promise<typeof import('./live')> | null = null
function loadLive(): Promise<typeof import('./live')> {
  liveModule ??= import('./live').catch((e: unknown) => {
    liveModule = null
    throw e
  })
  return liveModule
}

/* ------------------------------------------------------------------ scenarios (registry: scenarios.ts) */

export { registerScenario, unregisterScenario, getScenario } from './scenarios'

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

/* ------------------------------------------------------------------ fallback events (bus: live-base.ts) */

const notify = (info: FallbackInfo): void => notifyLiveFallback(info)

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
      yield* simChunks(result, { ...(req.signal ? { signal: req.signal } : {}), ...(req.skip ? { skip: req.skip } : {}) })
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
      if (c.type === 'done') yield { ...c, mode: 'sim', fellBack: true }
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
    let live: typeof import('./live')
    try {
      live = await loadLive()
    } catch (e) {
      userSignal?.removeEventListener('abort', forward)
      if (userSignal?.aborted) return
      yield* fallback(req, new LiveError('network', `live client failed to load: ${String(e)}`), false)
      return
    }
    const it = live.liveChat({ ...req, signal: ctrl.signal })
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
            const v = live.validateStructured(c.value)
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
        out.mode = 'sim'
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
      return await (await loadLive()).liveExtract(req)
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
