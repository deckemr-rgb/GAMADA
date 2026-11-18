/**
 * ai/scripted/engine.ts — the simulation engine (spec §9.2, §8.3).
 *
 * simulate(): match the last user message against the scenario's intents and build a SimResponse (intent
 * respond() or the scenario fallback; answers may read ctx.world). simChunks(): turn that response into the
 * AiChunk stream every UI consumes — a deterministic "thinking" delay (300–900 ms), the text streamed at
 * 25–45 tok/s, then the agent steps (tool_call, with ms), the structured result, follow-up chips and done.
 */
import type { AiChunk, IntentMatch, Lang, Msg, Scenario, SimContext, SimResponse } from '../types'
import type { ProductSlug, RoleId } from '../../../content/products'
import { createMatcher, type Matcher, type SynonymMap } from '../intents'
import { eitherSignal, hashString, prng, sleep as realSleep, streamText, thinkingDelayMs, type Sleep } from '../stream'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const ENGINE = {
  /** shown pause per agent step = clamp(step.ms × stepScale, stepMinMs, stepMaxMs) */
  stepScale: 0.5,
  stepMinMs: 90,
  stepMaxMs: 260,
  /** default ms reported for a step without `ms` (deterministic in this range) */
  stepDefaultMin: 120,
  stepDefaultMax: 480,
  /** pause between text end and the first agent step / structured result */
  afterTextMs: 160,
  /** max suggestion chips added from candidates in a fallback answer */
  fallbackChips: 3,
} as const

/* ------------------------------------------------------------------ matcher cache */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScenario = Scenario<any>

const matchers = new WeakMap<AnyScenario, Matcher>()
const extraSynonyms = new WeakMap<AnyScenario, SynonymMap>()

/** Optional per-scenario synonyms (call before the first match). */
export function setScenarioSynonyms(s: AnyScenario, synonyms: SynonymMap): void {
  extraSynonyms.set(s, synonyms)
  matchers.delete(s)
}

/** The (cached) matcher for a scenario. */
export function getMatcher(s: AnyScenario): Matcher {
  let m = matchers.get(s)
  if (!m) {
    m = createMatcher(s.intents, extraSynonyms.get(s), s.threshold !== undefined ? { threshold: s.threshold } : {})
    matchers.set(s, m)
  }
  return m
}

/* ------------------------------------------------------------------ simulate */

export interface SimInput {
  product: ProductSlug
  role: RoleId
  lang: Lang
  messages: Msg[]
  world: unknown
}

export interface SimResult {
  match: IntentMatch
  response: SimResponse
  /** true when the scenario fallback answered (no intent above threshold, or no scenario) */
  fallback: boolean
}

const GENERIC: Record<Lang, SimResponse> = {
  id: {
    text: 'Maaf, skenario simulasi untuk produk ini belum tersedia. Silakan coba produk lain atau aktifkan mode Live.',
    followUps: [],
  },
  en: {
    text: 'Sorry, the simulation scenario for this product is not available yet. Please try another product or switch to Live mode.',
    followUps: [],
  },
}

/** Answer the last user message with a scenario (synchronous; no timing). */
export function simulate(scenario: AnyScenario | undefined, input: SimInput): SimResult {
  const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
  const text = lastUser?.content ?? ''
  const ctx: SimContext<unknown> = { world: input.world, lang: input.lang, role: input.role, product: input.product, text, history: input.messages }
  if (!scenario) {
    return { match: { intentId: null, confidence: 0, slots: {}, candidates: [] }, response: GENERIC[input.lang], fallback: true }
  }
  const match = getMatcher(scenario).match(text, input.lang)
  const intent = match.intentId ? scenario.intents.find((i) => i.id === match.intentId) : undefined
  if (intent) return { match, response: intent.respond(ctx, match.slots), fallback: false }

  const response = { ...scenario.fallback(ctx) }
  if (!response.followUps?.length) {
    // "maksud Anda…?" — the first example of each candidate intent
    response.followUps = match.candidates
      .slice(0, ENGINE.fallbackChips)
      .map((c) => scenario.intents.find((i) => i.id === c.intentId)?.examples[0])
      .filter((x): x is string => !!x)
  }
  return { match, response, fallback: true }
}

/* ------------------------------------------------------------------ chunks */

export interface SimChunkOptions {
  signal?: AbortSignal
  /** no delays at all (static renders, tests) */
  instant?: boolean
  /** injectable sleep (tests) */
  sleep?: Sleep
  /** seed for timings (default: hash of the answer text) */
  seed?: number
  /** when this aborts, the rest arrives without delays */
  skip?: AbortSignal
}

/** Stream a SimResult as AiChunks. Ends early (without done) when the signal aborts. */
export async function* simChunks(result: SimResult, opts: SimChunkOptions = {}): AsyncIterable<AiChunk> {
  const { response, match } = result
  const base: Sleep = opts.instant ? async () => {} : (opts.sleep ?? realSleep)
  const skip = opts.skip
  const wake = eitherSignal(opts.signal, skip)
  const wait: Sleep = (ms, s) => (skip?.aborted ? Promise.resolve() : base(ms, s && s === opts.signal ? wake : s))
  const seed = opts.seed ?? hashString(response.text)
  const signal = opts.signal

  await wait(thinkingDelayMs(response.text, seed), signal)
  if (signal?.aborted) return

  // only forward an injected sleep: the default path lets streamText compensate timer drift
  for await (const piece of streamText(response.text, { seed, instant: !!opts.instant, ...(opts.sleep ? { sleep: opts.sleep } : {}), ...(signal ? { signal } : {}), ...(skip ? { skip } : {}) })) {
    yield { type: 'text', text: piece }
  }
  if (signal?.aborted) return

  const rnd = prng(seed ^ 0x5bd1e995)
  const steps = response.toolCalls ?? []
  if (steps.length || response.structured) await wait(ENGINE.afterTextMs, signal)
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!
    const ms = s.ms ?? Math.round(ENGINE.stepDefaultMin + rnd() * (ENGINE.stepDefaultMax - ENGINE.stepDefaultMin))
    await wait(Math.min(ENGINE.stepMaxMs, Math.max(ENGINE.stepMinMs, ms * ENGINE.stepScale)), signal)
    if (signal?.aborted) return
    yield { type: 'tool_call', call: { ...s, id: `sim-${seed.toString(36)}-${i}`, ms } }
  }
  if (response.structured) yield { type: 'structured', value: response.structured }
  if (response.followUps?.length) yield { type: 'followups', chips: response.followUps }
  const done: AiChunk = { type: 'done', mode: 'sim', confidence: match.confidence }
  if (match.intentId && !result.fallback) done.intentId = match.intentId
  yield done
}
