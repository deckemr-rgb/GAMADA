/**
 * ai/live-base.ts — the zod-FREE half of the live client: config, errors, the health check (cached) and the
 * live → sim fallback bus. Everything the simulation path, the shell (AI mode switch, fallback toast) and the
 * provider need synchronously lives here, so a demo route never downloads zod.
 *
 * The zod half (SSE chunk validation, STRUCTURED_SCHEMAS, liveChat, liveExtract, validateStructured) is
 * ai/live.ts; provider.ts loads it with a dynamic import() only when a live request is actually made.
 */
import type { ProductSlug } from '../../content/products'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const LIVE = {
  healthTimeoutMs: 3000,
  /** cache a healthy answer this long, an unhealthy one shorter */
  healthTtlOkMs: 60_000,
  healthTtlFailMs: 15_000,
  /** max upload for /api/ai/extract (spec §10: ≤ 8 MB) */
  extractMaxBytes: 8 * 1024 * 1024,
  contextMaxBytes: 6000,
  /** proxy limits (server LIMITS): ≤ 40 messages of ≤ 4000 chars, body ≤ 64 KB */
  historyMaxMessages: 40,
  messageMaxChars: 4000,
  /** history budget, leaves room for the 6 KB context inside the proxy's 64 KB body limit */
  historyMaxBytes: 48 * 1024,
} as const

/* ------------------------------------------------------------------ config */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface LiveConfig {
  /** null = not configured; '' = same origin */
  baseUrl: string | null
  fetch: FetchLike
}

const normBase = (s: string): string => s.trim().replace(/\/+$/, '')

function envBaseUrl(): string | null {
  let raw: unknown
  try {
    raw = (import.meta as { env?: Record<string, unknown> }).env?.VITE_AI_PROXY_URL
  } catch {
    raw = undefined
  }
  return typeof raw === 'string' ? normBase(raw) : null
}

/** shared with live.ts (same module instance) */
export const cfg: LiveConfig = {
  baseUrl: envBaseUrl(),
  fetch: (input, init) => globalThis.fetch(input, init),
}

/** Override the proxy base URL ('' = same origin, null = off) and/or fetch (tests, integrator). Resets the health cache. */
export function configureLive(patch: { baseUrl?: string | null; fetch?: FetchLike }): void {
  if ('baseUrl' in patch) cfg.baseUrl = typeof patch.baseUrl === 'string' ? normBase(patch.baseUrl) : null
  if (patch.fetch) cfg.fetch = patch.fetch
  healthCache = null
}

export function liveBaseUrl(): string | null {
  return cfg.baseUrl
}
export function isLiveConfigured(): boolean {
  return cfg.baseUrl !== null
}

/* ------------------------------------------------------------------ errors */

export type LiveErrorKind = 'unavailable' | 'timeout' | 'http' | 'network' | 'abort' | 'protocol' | 'upstream' | 'invalid'

export class LiveError extends Error {
  readonly kind: LiveErrorKind
  readonly status?: number
  /** proxy error code (`error.code` of a JSON error or an SSE `error` event), e.g. 'budget_exhausted' */
  readonly code?: string
  constructor(kind: LiveErrorKind, message?: string, status?: number, code?: string) {
    super(message ?? kind)
    this.name = 'LiveError'
    this.kind = kind
    if (status !== undefined) this.status = status
    if (code !== undefined) this.code = code
  }
}

export function asLiveError(e: unknown, signal?: AbortSignal): LiveError {
  if (e instanceof LiveError) return e
  if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return new LiveError('abort', 'aborted')
  return new LiveError('network', e instanceof Error ? e.message : String(e))
}

/** HTTP ≥ 400 → LiveError('http') carrying the proxy's `{ error: { code, message } }` when present. */
export async function httpError(res: Response): Promise<LiveError> {
  let code: string | undefined
  let message = `HTTP ${res.status}`
  try {
    const j = (await res.json()) as { error?: { code?: unknown; message?: unknown } }
    if (typeof j.error?.code === 'string') code = j.error.code
    if (typeof j.error?.message === 'string') message = `HTTP ${res.status}: ${j.error.message}`
  } catch {
    /* not JSON (static host, gateway page) */
  }
  return new LiveError('http', message, res.status, code)
}

/* ------------------------------------------------------------------ health */

/** GET /api/ai/health — same fields as the proxy (README "Protokol SSE" → health). */
export interface Health {
  /** the proxy answered */
  ok: boolean
  /** live answers are possible now (key present, budget left — or mock) */
  live: boolean
  /** the proxy runs AI_MOCK=1 (deterministic test answers) */
  mock: boolean
  models: { fast: string; smart: string; extract: string } | null
  /** why live is false: 'no_api_key' | 'budget_exhausted' (proxy) | 'unreachable' | 'not_configured' (client) */
  reason?: string
}

/**
 * Hand-written check of the health body (no zod on this path): ok/live booleans, optional mock boolean,
 * optional models {fast, smart, extract} strings, optional reason string. Anything else ⇒ null.
 */
function readHealth(v: unknown): Health | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.ok !== 'boolean' || typeof o.live !== 'boolean') return null
  if (o.mock !== undefined && typeof o.mock !== 'boolean') return null
  if (o.reason !== undefined && typeof o.reason !== 'string') return null
  let models: Health['models'] = null
  if (o.models !== undefined) {
    const m = o.models as Record<string, unknown> | null
    if (!m || typeof m !== 'object' || typeof m.fast !== 'string' || typeof m.smart !== 'string' || typeof m.extract !== 'string') return null
    models = { fast: m.fast, smart: m.smart, extract: m.extract }
  }
  const h: Health = { ok: o.ok, live: o.ok && o.live, mock: o.mock ?? false, models }
  if (typeof o.reason === 'string' && o.reason) h.reason = o.reason
  return h
}

let healthCache: { at: number; value: Health; pending?: Promise<Health> } | null = null
const down = (reason: string): Health => ({ ok: false, live: false, mock: false, models: null, reason })

/** Last known health (null when never checked or expired). */
export function peekHealth(now: number = Date.now()): Health | null {
  if (!healthCache || healthCache.pending) return null
  const ttl = healthCache.value.live ? LIVE.healthTtlOkMs : LIVE.healthTtlFailMs
  return now - healthCache.at <= ttl ? healthCache.value : null
}

/** GET {base}/api/ai/health with a 3 s timeout; cached (60 s when healthy, 15 s when not); deduplicated. */
export function checkHealth(opts: { force?: boolean } = {}): Promise<Health> {
  if (cfg.baseUrl === null) return Promise.resolve(down('not_configured'))
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
      if (!res.ok) return down('unreachable')
      return readHealth(await res.json()) ?? down('unreachable')
    } catch {
      return down('unreachable')
    } finally {
      clearTimeout(timer)
    }
  })()
  healthCache = { at: Date.now(), value: down('unreachable'), pending }
  void pending.then((value) => {
    if (healthCache?.pending === pending) healthCache = { at: Date.now(), value }
  })
  return pending
}

/* ------------------------------------------------------------------ structured validators (registry) */

/** Anything with zod's safeParse shape (a zod schema works; typed structurally so this file needs no zod). */
export interface StructuredValidator {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false }
}
const customSchemas = new Map<string, StructuredValidator>()

/**
 * Per-kind validator for Structured.data, replacing the default STRUCTURED_SCHEMAS entry (ai/live.ts). Pass a zod
 * schema; it must still accept the proxy's shape (else every live result of that kind falls back to the sim).
 */
export function registerStructuredSchema(kind: string, schema: StructuredValidator): void {
  customSchemas.set(kind, schema)
}
/** the product-registered validator for a kind (live.ts consults it before the defaults) */
export function customStructuredSchema(kind: string): StructuredValidator | undefined {
  return customSchemas.get(kind)
}

/* ------------------------------------------------------------------ live → sim fallback bus */

/** Toast copy for a live → sim fallback (spec §8.5). */
export const LIVE_FALLBACK_NOTICE = {
  id: 'AI Live sedang sibuk, beralih ke Simulasi',
  en: 'Live AI is busy, switching to Simulation',
} as const

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
export function notifyLiveFallback(info: FallbackInfo): void {
  for (const fn of fallbackListeners) {
    try {
      fn(info)
    } catch {
      /* listener errors never break the chat */
    }
  }
}
