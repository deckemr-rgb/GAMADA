/**
 * ai/stream.ts — realistic token streaming for simulated answers (spec §8.3).
 *
 * Text is cut into tokenizer-like pieces (short words whole, long words in ~4-char pieces) and released at
 * 25–45 tok/s with small pauses after punctuation. Every schedule is deterministic per text (seeded by a hash
 * of the text), so the tour and the screenshots replay identically.
 */
import { DEMO } from '../../lib/motion'

/* ------------------------------------------------------------------ constants (module-local, see report) */
const STREAM = {
  /** "AI is thinking" delay before the first token, ms (deterministic per message) */
  thinkMinMs: 300,
  thinkMaxMs: 900,
  /** per-token rate wobble around the message's base rate (fraction) */
  jitter: 0.18,
  /** long words are split into pieces of this many chars (like a BPE tokenizer) */
  pieceChars: 4,
  /** words longer than this are split */
  splitAbove: 6,
} as const

/* ------------------------------------------------------------------ deterministic helpers */

/** FNV-1a 32-bit hash of a string (stable seed for per-message timing). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG → () => [0, 1). */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic "thinking" delay (300–900 ms) for a message. */
export function thinkingDelayMs(text: string, seed?: number): number {
  const r = prng((seed ?? hashString(text)) ^ 0x9e3779b9)()
  return Math.round(STREAM.thinkMinMs + r * (STREAM.thinkMaxMs - STREAM.thinkMinMs))
}

/** Split text into stream tokens. Joining the result gives back the input exactly. */
export function tokenize(text: string): string[] {
  const out: string[] = []
  const parts = text.match(/\s*\S+\s*/g)
  if (!parts) return text ? [text] : []
  for (const w of parts) {
    const core = w.trim()
    if (core.length > STREAM.splitAbove) {
      let i = 0
      while (w.length - i > STREAM.splitAbove) {
        out.push(w.slice(i, i + STREAM.pieceChars))
        i += STREAM.pieceChars
      }
      out.push(w.slice(i))
    } else out.push(w)
  }
  return out
}

export interface StreamSchedule {
  tokens: string[]
  /** delay before each token, ms (first entry is 0) */
  delays: number[]
  /** base tokens/s chosen for this message */
  tps: number
  /** total ms of pure token time (no punctuation pauses) */
  genMs: number
  /** total ms including pauses */
  totalMs: number
}

/** Pause after a token, from its last non-space character. */
function pauseAfter(tok: string): number {
  const core = tok.trimEnd()
  if (/\n/.test(tok) || /[.!?…]["')\]]?$/.test(core)) return DEMO.punctuationPauseMs
  if (/[,;:—–]$/.test(core)) return Math.round(DEMO.punctuationPauseMs / 2)
  return 0
}

/** Full deterministic timing for a text. `tps` fixes the base rate (clamped to the DEMO bounds). */
export function streamSchedule(text: string, opts: { tps?: number; seed?: number } = {}): StreamSchedule {
  const tokens = tokenize(text)
  const rnd = prng(opts.seed ?? hashString(text))
  const min = DEMO.tokensPerSecMin
  const max = DEMO.tokensPerSecMax
  const base = clamp(opts.tps ?? min + rnd() * (max - min), min, max)
  const delays: number[] = []
  let gen = 0
  let total = 0
  let prevPause = 0
  for (let i = 0; i < tokens.length; i++) {
    if (i === 0) {
      delays.push(0)
    } else {
      const rate = clamp(base * (1 + (rnd() * 2 - 1) * STREAM.jitter), min, max)
      const dt = 1000 / rate
      gen += dt
      delays.push(dt + prevPause)
      total += dt + prevPause
    }
    prevPause = pauseAfter(tokens[i]!)
  }
  return { tokens, delays, tps: base, genMs: gen, totalMs: total }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/* ------------------------------------------------------------------ sleeping */

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** setTimeout sleep that resolves early (without throwing) when the signal aborts. */
export const sleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted || ms <= 0) return resolve()
    const t = setTimeout(done, ms)
    function done() {
      clearTimeout(t)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })

/* ------------------------------------------------------------------ streamText */

export interface StreamTextOptions {
  /** base tokens per second (clamped to DEMO.tokensPerSecMin..Max); default: deterministic per text */
  tps?: number
  /** stop streaming (the iterator simply ends) */
  signal?: AbortSignal
  /** seed for the schedule (default: hash of the text) */
  seed?: number
  /** yield everything at once (static renders, tests) */
  instant?: boolean
  /** injectable sleep (tests) */
  sleep?: Sleep
}

/** Stream `text` token by token at a realistic rate. Concatenating every yielded piece gives `text`. */
export async function* streamText(text: string, opts: StreamTextOptions = {}): AsyncIterable<string> {
  if (opts.instant) {
    if (!opts.signal?.aborted && text) yield text
    return
  }
  const wait = opts.sleep ?? sleep
  const { tokens, delays } = streamSchedule(text, opts)
  // Drift-compensated: each token is due at an absolute time (t0 + Σ delays), so timer overhead and render
  // time between tokens do not accumulate and the observed rate stays inside the DEMO bounds.
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const t0 = now()
  let due = 0
  for (let i = 0; i < tokens.length; i++) {
    due += delays[i] ?? 0
    const d = opts.sleep ? (delays[i] ?? 0) : due - (now() - t0)
    if (d > 0) await wait(d, opts.signal)
    if (opts.signal?.aborted) return
    yield tokens[i]!
  }
}
