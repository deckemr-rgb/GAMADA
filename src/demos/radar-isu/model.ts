/**
 * demos/radar-isu/model.ts — pure derived data for the first screen (sentiment index, KPIs, burst state) plus two
 * tiny stores shared by the tabs: the last Deep Analysis result (the report and the exports read it) and the
 * throttled world clock. No heavy imports: this file is part of the initial chunk.
 */
import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { WORLD, clock, negativeIssues, rows } from '../../demo-kit/world'
import type { EventMap, HoaxAlert, Mention, Table, WorldState } from '../../demo-kit/world'
import type { DeepResult } from './deep-model'

/* ------------------------------------------------------------------ constants (module-local) */
export const RADAR = {
  /** real ms between React updates of the world clock (×60 = 60 world minutes per second) */
  clockThrottleMs: 250,
  /** sentiment index: how far back a mention still counts (world minutes) */
  sentLookbackMin: 12 * 60,
  /** weight of the slow baseline in the sentiment index (≈ one fresh mention of reach 10 000) */
  sentPrior: 4,
  /** real ms between the posts of the "Picu skenario" burst (the stream fills live) */
  burstGapMs: 420,
  burstGapReducedMs: 120,
  /** stream length */
  streamLimit: 40,
} as const

/* ------------------------------------------------------------------ throttled clock */

/** world minutes, updated at most every `RADAR.clockThrottleMs` real ms (smooth at ×60 without 60 renders/s) */
export function useNow(): number {
  const [now, setNow] = useState(() => clock.get().minutes)
  useEffect(() => {
    let last = 0
    let timer = 0
    const push = () => {
      last = performance.now()
      timer = 0
      setNow(clock.get().minutes)
    }
    const un = clock.subscribe(() => {
      const wait = RADAR.clockThrottleMs - (performance.now() - last)
      if (!clock.get().running || wait <= 0) {
        window.clearTimeout(timer)
        push()
      } else if (!timer) timer = window.setTimeout(push, wait)
    })
    setNow(clock.get().minutes)
    return () => {
      un()
      window.clearTimeout(timer)
    }
  }, [])
  return now
}

/* ------------------------------------------------------------------ sentiment index (one index, two views) */

export interface SentPoint {
  at: number
  value: number
}

const sentCache = new WeakMap<Table<Mention>, Map<string, SentPoint[]>>()

/**
 * Chart views of the ONE sentiment index: the 24 h overview (a sample every 15 min) and the 3 h zoom (every 5 min)
 * that shows a burst and its recovery. Both use the same half-life and end on the same 5-minute sample, so the last
 * point of either view is exactly the KPI value; every number quoted on screen (KPI, recovery, report, export, AI)
 * comes from this one index.
 */
export const SENT_RES = {
  '24h': { hours: 24, step: 15 },
  '3h': { hours: 3, step: 5 },
} as const
export type SentRes = keyof typeof SENT_RES
/** half-lives (world minutes): the fast term reacts to a burst / recovery, the slow baseline holds the mood */
const SENT_TAU = 45
const SENT_TAU_SLOW = 180
const SENT_ALIGN = 5

/**
 * Reach-weighted, recency-decayed sentiment index (−100…100): a fast term (half-life 45 min) blended with a slow
 * baseline (180 min) of the same mentions. Stateless per sample, so both views agree point for point; a quiet night
 * keeps the recent mood instead of dropping to "neutral", and a lone post moves the line only part of the way.
 * Memoised per mentions table + time + view.
 */
export function sentimentIndex(mentions: Table<Mention>, now: number, res: SentRes = '24h'): SentPoint[] {
  const { hours, step } = SENT_RES[res]
  const end = Math.floor(now / SENT_ALIGN) * SENT_ALIGN
  const key = `${end}|${res}`
  let byKey = sentCache.get(mentions)
  const hit = byKey?.get(key)
  if (hit) return hit
  const list = rows(mentions)
    .filter((m) => m.at <= end && m.at > end - hours * 60 - RADAR.sentLookbackMin)
    .sort((a, b) => a.at - b.at)
  const out: SentPoint[] = []
  for (let t = end - hours * 60; t <= end; t += step) {
    let w = 0
    let sum = 0
    let w0 = 0
    let sum0 = 0
    for (const m of list) {
      if (m.at > t) break
      const d = t - m.at
      if (d > RADAR.sentLookbackMin) continue
      const r = Math.log10(m.reach + 10)
      const k = Math.exp(-d / SENT_TAU) * r
      const k0 = Math.exp(-d / SENT_TAU_SLOW) * r
      w += k
      sum += k * m.score
      w0 += k0
      sum0 += k0 * m.score
    }
    const base = w0 > 1e-6 ? sum0 / w0 : 0
    const v = (sum + RADAR.sentPrior * base) / (w + RADAR.sentPrior)
    out.push({ at: t, value: Math.round(v * 100) })
  }
  if (!byKey) sentCache.set(mentions, (byKey = new Map()))
  if (byKey.size > 48) byKey.clear()
  byKey.set(key, out)
  return out
}

/** the index at the clarification and now (recovery line, report, export): both read from the same 24 h index */
export function recoveryOf(mentions: Table<Mention>, now: number, clarAt: number): { before: number; after: number } {
  const series = sentimentIndex(mentions, now)
  const z = sentimentIndex(mentions, now, '3h')
  const sr = z[0] && z[0].at <= clarAt ? z : series
  const before = [...sr].reverse().find((p) => p.at <= clarAt)?.value ?? 0
  return { before, after: series[series.length - 1]?.value ?? 0 }
}

/** signed index for display: "+6", "−5", "0" (one minus sign everywhere) */
export const signedIdx = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`

/* ------------------------------------------------------------------ negative issues (the ecosystem definition) */

export interface NegIssue {
  topic: string
  /** negative mentions of the topic in the last 24 h */
  count: number
  reach: number
}
/**
 * "Isu negatif" = a topic with negative mentions in the last 24 h, biggest by negative-mention count: the same kit
 * selector Meja Pimpinan uses for its "Isu negatif" KPI and briefing, so both products name the same issue.
 */
export function negIssues(mentions: Table<Mention>, now: number): NegIssue[] {
  return negativeIssues({ mentions } as WorldState, now)
}

/* ------------------------------------------------------------------ KPIs */

export interface RadarKpis {
  count: number
  prev: number
  reach: number
  sentiment: number
  negTopics: number
}

const kpiCache = new WeakMap<Table<Mention>, Map<number, RadarKpis>>()
export function radarKpis(mentions: Table<Mention>, now: number): RadarKpis {
  let byNow = kpiCache.get(mentions)
  const hit = byNow?.get(now)
  if (hit) return hit
  let count = 0
  let prev = 0
  let reach = 0
  for (const m of rows(mentions)) {
    if (m.at > now) continue
    if (m.at > now - 1440) {
      count++
      reach += m.reach
    } else if (m.at > now - 2880) prev++
  }
  const series = sentimentIndex(mentions, now)
  const k: RadarKpis = {
    count,
    prev,
    reach,
    sentiment: series[series.length - 1]?.value ?? 0,
    negTopics: negIssues(mentions, now).length,
  }
  if (!byNow) kpiCache.set(mentions, (byNow = new Map()))
  if (byNow.size > 32) byNow.clear()
  byNow.set(now, k)
  return k
}

/* ------------------------------------------------------------------ the hoax scenario state */

export type HoaxPhase =
  | { kind: 'idle' }
  | { kind: 'burst'; posts: Mention[] }
  | { kind: 'active'; alert: HoaxAlert; posts: Mention[] }
  | { kind: 'clarified'; alert: HoaxAlert; posts: Mention[] }

/** where the dam-hoax scenario stands at `now` (posts visible so far) */
export function hoaxPhase(s: Pick<WorldState, 'mentions' | 'hoaxAlerts' | 'meta'>, now: number): HoaxPhase {
  const rumor = s.meta.facts.hoax.rumor || WORLD.hoaxRumor
  const posts = rows(s.mentions)
    .filter((m) => m.rumor === rumor && m.at <= now)
    .sort((a, b) => a.at - b.at)
  const alert = rows(s.hoaxAlerts).find((h) => h.rumor === rumor)
  if (alert)
    return {
      kind: alert.status === 'diklarifikasi' ? 'clarified' : 'active',
      alert,
      posts,
    }
  if (posts.length) return { kind: 'burst', posts }
  return { kind: 'idle' }
}

/* ------------------------------------------------------------------ last Deep Analysis (shared by tabs) */

let deep: DeepResult | null = null
const deepSubs = new Set<() => void>()
export function setDeepResult(r: DeepResult | null): void {
  deep = r
  for (const fn of [...deepSubs]) fn()
}
export function getDeepResult(): DeepResult | null {
  return deep
}
export function useDeepResult(): DeepResult | null {
  return useSyncExternalStore(
    (fn) => {
      deepSubs.add(fn)
      return () => deepSubs.delete(fn)
    },
    () => deep,
    () => deep,
  )
}

/* ------------------------------------------------------------------ cross-tab requests */

/** a keyword handed from a topic cluster to the Deep Analysis tab (consumed once) */
let pendingKeyword: string | null = null
export function requestDeepKeyword(k: string): void {
  pendingKeyword = k
}
export function takeDeepKeyword(): string | null {
  const k = pendingKeyword
  pendingKeyword = null
  return k
}

/* ------------------------------------------------------------------ topic clusters, stream, the rumor burst (local: */
/* the same rules as world/satu-daerah, without pulling that whole module into this demo's first chunk)            */

export interface Cluster {
  topic: string
  count: number
  reach: number
  /** mean score −1..1 */
  score: number
  sentiment: Mention['sentiment']
}
const topicCache = new WeakMap<Table<Mention>, Map<string, Cluster[]>>()
/** topic bubbles over the last `hours` up to `now`, biggest first (memoised per table + time) */
export function topicsOf(mentions: Table<Mention>, now: number, hours = 24): Cluster[] {
  const key = `${now}|${hours}`
  let byKey = topicCache.get(mentions)
  const hit = byKey?.get(key)
  if (hit) return hit
  const by = new Map<string, { n: number; reach: number; sum: number }>()
  for (const m of rows(mentions)) {
    if (m.at > now || m.at < now - hours * 60) continue
    const g = by.get(m.topic) ?? { n: 0, reach: 0, sum: 0 }
    g.n++
    g.reach += m.reach
    g.sum += m.score
    by.set(m.topic, g)
  }
  const out = [...by.entries()]
    .map(([topic, g]) => {
      const score = Math.round((g.sum / g.n) * 100) / 100
      return {
        topic,
        count: g.n,
        reach: g.reach,
        score,
        sentiment: (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral') as Mention['sentiment'],
      }
    })
    .sort((a, b) => b.count - a.count || b.reach - a.reach)
  if (!byKey) topicCache.set(mentions, (byKey = new Map()))
  if (byKey.size > 32) byKey.clear()
  byKey.set(key, out)
  return out
}

const streamCache = new WeakMap<Table<Mention>, { n: number; limit: number; out: Mention[] }>()
/**
 * mentions up to `now`, newest first, at most `limit`. Returns the SAME array while nothing new became visible (the
 * world clock ticks many times a second at ×60: the stream must not re-render on every tick).
 */
export function streamOf(mentions: Table<Mention>, now: number, limit: number): Mention[] {
  const vis: Mention[] = []
  for (const m of rows(mentions)) if (m.at <= now) vis.push(m)
  const hit = streamCache.get(mentions)
  if (hit && hit.n === vis.length && hit.limit === limit) return hit.out
  const out = vis.sort((a, b) => b.at - a.at).slice(0, limit)
  streamCache.set(mentions, { n: vis.length, limit, out })
  return out
}

/**
 * The false-narrative burst (spec P4 step 2) as mention.created payloads starting at `start` (empty once the rumor
 * exists). Same posts as world/satu-daerah `hoaxBurst`, built from world/scenario-texts.
 */
const loadTexts = () => import('../../demo-kit/world/scenario-texts')
/** warm the burst texts (hover / focus of the trigger, or idle time after mount): the click then answers at once */
export function prefetchBurst(): void {
  void loadTexts().catch(() => undefined)
}
export async function burstPosts(s: WorldState, start: number): Promise<EventMap['mention.created'][]> {
  const { HOAX_OFFSETS, HOAX_SCENARIO, hoaxPost } = await loadTexts()
  const rumor = s.meta.facts.hoax.rumor || HOAX_SCENARIO.rumor
  if (rows(s.mentions).some((m) => m.rumor === rumor)) return []
  const dam = s.meta.facts.hoax.damName || 'Bendungan'
  const kid = s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? ''
  const k = s.region.kecamatan.find((x) => x.id === kid)?.name ?? kid
  return HOAX_OFFSETS.map((_, i) => hoaxPost(i, start, dam, k, rumor))
}

/* ------------------------------------------------------------------ INP helpers */

/**
 * Run `fn` after the next paint: a click first shows its immediate result (drawer closing, toast, busy state), then
 * the heavy world update (many reducers + a synchronous re-render of every subscriber) runs in its own task.
 */
export function afterPaint(fn: () => void): void {
  window.requestAnimationFrame(() => window.setTimeout(fn, 0))
}

/* ------------------------------------------------------------------ lazy drawers */

/**
 * A drawer that mounts already open (a lazy chunk) would ask the kit overlay to move focus before its portal panel
 * exists; open it one commit later instead, so focus lands inside and Esc / the focus trap work from the start.
 */
export function useDeferredOpen(open: boolean, inside?: RefObject<HTMLElement | null>): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => setShown(open), [open])
  // safety net: if the overlay could not take focus (a race with the lazy chunk), move it in once the panel is up
  useEffect(() => {
    if (!shown || !open || !inside) return
    const id = window.setTimeout(() => {
      const panel = inside.current?.closest<HTMLElement>('[role="dialog"]')
      if (panel && !panel.contains(document.activeElement)) (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'))?.focus({ preventScroll: true })
    }, 120)
    return () => window.clearTimeout(id)
  }, [shown, open, inside])
  return shown && open
}
