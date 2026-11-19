/**
 * demos/radar-isu/model.ts — pure derived data for the first screen (sentiment index, KPIs, burst state) plus two
 * tiny stores shared by the tabs: the last Deep Analysis result (the report and the exports read it) and the
 * throttled world clock. No heavy imports: this file is part of the initial chunk.
 */
import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { WORLD, clock, negativeIssues, rows } from '../../demo-kit/world'
import type { EventMap, HoaxAlert, Mention, Table, WaterGauge, WorldState } from '../../demo-kit/world'
import { HOUR_RHYTHM } from '../../demo-kit/world/util'
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
  burstGapMs: 260,
  burstGapReducedMs: 120,
  /** real ms after the first paint before the monitor starts by itself (full motion only) */
  autoRunMs: 2500,
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

/** world minutes after the clarification at which the recovery is quoted (card, report, export, AI: one figure) */
export const RECOVERY_MIN = 30
/**
 * The index at the clarification and RECOVERY_MIN world minutes later (or now, while those 30 minutes run): every
 * surface quotes the same pair, so the card and a report printed later never disagree ("−25 → −7" in both).
 */
export function recoveryOf(mentions: Table<Mention>, now: number, clarAt: number): { before: number; after: number } {
  const series = sentimentIndex(mentions, now)
  const z = sentimentIndex(mentions, now, '3h')
  const sr = z[0] && z[0].at <= clarAt ? z : series
  const before = [...sr].reverse().find((p) => p.at <= clarAt)?.value ?? 0
  const ref = Math.min(now, clarAt + RECOVERY_MIN)
  const after = [...sr].reverse().find((p) => p.at <= ref)?.value ?? series[series.length - 1]?.value ?? 0
  return { before, after }
}

/** signed index for display: "+6", "−5", "0" (one minus sign everywhere) */
export const signedIdx = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`

/**
 * Screen-reader / report summary of an index series in POINTS (a percentage change of an index that can cross zero
 * means nothing): "Indeks sentimen turun 22 poin, dari +17 menjadi −5; terendah −26 pukul 10.25."
 */
export function sentSummary(series: SentPoint[], lang: 'id' | 'en', label: string): string {
  const first = series[0]
  const last = series[series.length - 1]
  if (!first || !last) return label
  const low = series.reduce((m, p) => (p.value < m.value ? p : m), first)
  const d = last.value - first.value
  const hhmm = (m: number) => {
    const x = ((m % 1440) + 1440) % 1440
    const s = `${String(Math.floor(x / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(x % 60).padStart(2, '0')}`
    return s
  }
  // a low from yesterday is named as such, and today's own low follows (the reader compares today with today)
  const day = (m: number) => Math.floor(m / 1440)
  const today = day(last.at)
  const lowToday = series.filter((p) => day(p.at) === today).reduce<SentPoint | null>((m, p) => (!m || p.value < m.value ? p : m), null)
  const yest = day(low.at) < today
  const lowId = `terendah ${signedIdx(low.value)} pukul ${hhmm(low.at)}${yest ? ' kemarin' : ''}${yest && lowToday ? `; terendah hari ini ${signedIdx(lowToday.value)} pukul ${hhmm(lowToday.at)}` : ''}`
  const lowEn = `low ${signedIdx(low.value)} at ${hhmm(low.at)}${yest ? ' yesterday' : ''}${yest && lowToday ? `; today’s low ${signedIdx(lowToday.value)} at ${hhmm(lowToday.at)}` : ''}`
  return lang === 'id'
    ? `${label}: ${d > 0 ? `naik ${d} poin` : d < 0 ? `turun ${-d} poin` : 'tetap'}, dari ${signedIdx(first.value)} menjadi ${signedIdx(last.value)}; ${lowId}.`
    : `${label}: ${d > 0 ? `up ${d} points` : d < 0 ? `down ${-d} points` : 'unchanged'}, from ${signedIdx(first.value)} to ${signedIdx(last.value)}; ${lowEn}.`
}

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

export type HoaxPhase = { kind: 'idle' } | { kind: 'burst'; posts: Mention[] } | { kind: 'active'; alert: HoaxAlert; posts: Mention[] } | { kind: 'clarified'; alert: HoaxAlert; posts: Mention[] }

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

/* ------------------------------------------------------------------ Sapa Warga cross-check (second evidence) */

export interface SapaFlood {
  /** flood complaints in the last 24 h in the kecamatan the rumour names */
  count: number
  kecamatan: string
  /** village of the latest one */
  desa: string
  /** world minute of the first one */
  since: number
  /** flood complaints in the last 24 h across the region (Siaga Wilayah lists them all) */
  regionCount: number
  /** what the reports in that kecamatan actually say (read from their text): an evacuation request, a seeping
   *  embankment, water inside homes */
  evac: number
  dike: number
  inHomes: number
  /** the complaint to open in Sapa Warga (the most urgent: evacuation first, else the latest) */
  focusId: string
}
/** the region's river gauge at or above its alert level (Siaga Wilayah shows it as SIAGA / AWAS) */
export interface RiverAlert {
  name: string
  level: number
  siaga: number
  awas: number
  status: 'siaga' | 'awas'
  updatedAt: number
}
/**
 * The flood river's level at a world minute: the SAME curve Siaga Wilayah draws (demos/siaga-wilayah/data.ts
 * riverLevelAt: the seeded history up to the 06.00 reading, then the morning rain pushes it past SIAGA before 07.00,
 * past AWAS ±10.15, a crest at 13.00, receding after). Copied here (a few lines of math) so the radar's first chunk
 * does not load Siaga Wilayah; both read the same seeded gauge, so both products show one river.
 */
const RIVER_CREST_AT = 13 * 60
function riverLevelAt(g: WaterGauge, minute: number): number {
  if (g.kind !== 'sungai') return g.level
  const h = g.history
  const t0 = g.updatedAt
  if (minute <= t0) {
    const i = h.length - 1 - (t0 - minute) / 60
    if (i <= 0) return h[0] ?? g.level
    const a = Math.floor(i)
    const b = Math.min(h.length - 1, a + 1)
    return (h[a] ?? g.level) + ((h[b] ?? g.level) - (h[a] ?? g.level)) * (i - a)
  }
  const crest = g.awas + 0.45
  if (minute <= RIVER_CREST_AT) {
    const f = (minute - t0) / Math.max(1, RIVER_CREST_AT - t0)
    return g.level + (crest - g.level) * Math.sin((f * Math.PI) / 2)
  }
  return g.normal + (crest - g.normal) * Math.exp(-(minute - RIVER_CREST_AT) / 600)
}
export function riverAlert(s: Pick<WorldState, 'gauges'>, now: number): RiverAlert | null {
  // 10-minute steps: the card does not re-render on every world minute at x60
  const at = Math.floor(now / 10) * 10
  for (const id of s.gauges.ids) {
    const g = s.gauges.byId[id]
    if (!g || g.kind !== 'sungai') continue
    const level = Math.round(riverLevelAt(g, at) * 100) / 100
    if (level < g.siaga) continue
    return { name: g.name, level, siaga: g.siaga, awas: g.awas, status: level >= g.awas ? 'awas' : 'siaga', updatedAt: at }
  }
  return null
}
/**
 * The rumour names the region's first flood kecamatan; Sapa Warga may hold real local flood reports there. The radar
 * shows them next to the dam gauge, so a clarification never says "nothing is happening" while water is in houses.
 */
export function sapaFlood(s: Pick<WorldState, 'complaints' | 'region'>, now: number): SapaFlood | null {
  const kid = s.region.floodKecamatanIds[0]
  if (!kid) return null
  const list = rows(s.complaints)
    .filter((c) => c.category === 'banjir' && c.kecamatanId === kid && c.at <= now && c.at > now - 1440)
    .sort((a, b) => a.at - b.at)
  if (!list.length) return null
  const k = s.region.kecamatan.find((x) => x.id === kid)
  const lastC = list[list.length - 1]!
  const txt = (c: (typeof list)[number]) => `${c.text} ${c.summary.id}`.toLowerCase()
  const evacL = list.filter((c) => /evakuasi|dievakuasi|mengungsi/.test(txt(c)))
  const dike = list.filter((c) => /tanggul/.test(txt(c)) && /rembes|bocor|jebol|bibir/.test(txt(c))).length
  const inHomes = list.filter((c) => /dalam rumah|masuk rumah|sampai teras|selutut|sepinggang|sebetis/.test(txt(c))).length
  const regionCount = rows(s.complaints).filter((c) => c.category === 'banjir' && c.at <= now && c.at > now - 1440).length
  return {
    count: list.length,
    kecamatan: k?.name ?? kid,
    desa: k?.desa.find((d) => d.id === lastC.desaId)?.name ?? '',
    since: list[0]!.at,
    regionCount,
    evac: evacL.length,
    dike,
    inHomes,
    focusId: (evacL[evacL.length - 1] ?? lastC).id,
  }
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

/* ------------------------------------------------------------------ clarification audit trail (who drafted / approved) */

export interface ClarAudit {
  draftedBy: { id: string; en: string }
  approvedBy: { id: string; en: string }
  /** number of drafts generated before publishing (tone changes / redrafts) */
  version: number
  /** world minutes: the draft was submitted for approval / the approval was given */
  draftedAt?: number
  approvedAt?: number
  /** the approver is simulated (the Comms Office path: the Head of the Communications Office answers by itself) */
  simulated?: boolean
}
const AUDIT_KEY = 'gamada:radar-isu:clar-audit'
const HUMAS = { id: 'Humas/Diskominfo', en: 'Comms Office' }
const KADIS = { id: 'Kepala Diskominfo', en: 'Head of the Communications Office' }
const KD = { id: 'Kepala Daerah', en: 'Regional Head' }
/** the approval a role's publish carries: the Comms Office releases in its own name (approved by its head, no quote of
 *  the Regional Head); the Regional Head approves herself */
export const approvalFor = (role: string): Omit<ClarAudit, 'version'> => (role === 'kepala-daerah' ? { draftedBy: HUMAS, approvedBy: KD } : { draftedBy: HUMAS, approvedBy: KADIS })
let audits: Record<string, ClarAudit> | null = null
function loadAudits(): Record<string, ClarAudit> {
  if (audits) return audits
  try {
    audits = JSON.parse(window.sessionStorage.getItem(AUDIT_KEY) ?? '{}') as Record<string, ClarAudit>
  } catch {
    audits = {}
  }
  return audits
}
export function recordClarAudit(hoaxId: string, a: ClarAudit): void {
  const all = loadAudits()
  all[hoaxId] = a
  try {
    window.sessionStorage.setItem(AUDIT_KEY, JSON.stringify(all))
  } catch {
    /* private mode: kept in memory only */
  }
}
/** the audit of a published clarification (default: the Comms Office path) */
export function clarAuditOf(hoaxId: string): ClarAudit {
  return loadAudits()[hoaxId] ?? { ...approvalFor('humas'), version: 1 }
}

/* ------------------------------------------------------------------ the crawl behind the curated stream */

/**
 * Public posts the (simulated) crawler scanned today up to `now`: about 9 per world minute at the day's rhythm. The
 * stream only carries the curated share, so the line "dipindai N · M masuk pantauan" explains why the Live numbers are
 * small next to Analisis Mendalam, and it ticks with the clock (the monitor visibly works between new mentions).
 */
export function scannedToday(now: number): number {
  const m = ((now % 1440) + 1440) % 1440
  let sum = 0
  for (let h = 0; h < 24 && m > h * 60; h++) sum += Math.min(60, m - h * 60) * (HOUR_RHYTHM[h] ?? 0.2)
  return Math.round(sum * 9)
}
/** curated mentions of today (world day of `now`) up to `now` */
export function mentionsToday(mentions: Table<Mention>, now: number): number {
  const d0 = Math.floor(now / 1440) * 1440
  let n = 0
  for (const x of rows(mentions)) if (x.at >= d0 && x.at <= now) n++
  return n
}

/* ------------------------------------------------------------------ "Picu skenario" by hand (replay note) */

/** world minute the visitor pressed the trigger (per world facts object), so the card can say the burst is a replay */
let manual: { at: number; facts: object } | null = null
export function markManualTrigger(at: number, facts: object): void {
  manual = { at, facts }
}
export function manualTriggerAt(facts: object): number | null {
  return manual && manual.facts === facts ? manual.at : null
}

/* ------------------------------------------------------------------ "Nilai dengan AI" (the card the analyst reads) */

/** the stream card last sent to the analyst: its assessment quotes the card's own label, score and topic */
let assessTarget: Mention | null = null
export function setAssessTarget(m: Mention | null): void {
  assessTarget = m
}
export function getAssessTarget(): Mention | null {
  return assessTarget
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
/** warm the burst texts (hover / focus / press of the trigger): the click then answers at once */
export function prefetchBurst(): void {
  void loadTexts().catch(() => undefined)
}
export async function burstPosts(s: WorldState, start: number): Promise<EventMap['mention.created'][]> {
  const { HOAX_OFFSETS, HOAX_SCENARIO, hoaxDam, hoaxPost } = await loadTexts()
  const rumor = s.meta.facts.hoax.rumor || HOAX_SCENARIO.rumor
  if (rows(s.mentions).some((m) => m.rumor === rumor)) return []
  // ID + EN dam name (a pack without a dam: the simulated sluice gate "Pintu air <river>" / "<river> sluice gate")
  const dam = hoaxDam(s.meta.facts.hoax)
  const kid = s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? ''
  const k = s.region.kecamatan.find((x) => x.id === kid)?.name ?? kid
  return HOAX_OFFSETS.map((_, i) => hoaxPost(i, start, dam, k, rumor))
}

/** the hoax's dam name in the UI language: same rule as world/scenario-texts hoaxDam (kept here so the page does not
 *  load that chunk): EN uses `damNameEn` ("Cikapundung sluice gate"), else the Indonesian name */
export function damNameOf(h: { damName: string; damNameEn?: string }, lang: 'id' | 'en', fallback = ''): string {
  if (lang === 'en') return h.damNameEn || h.damName || fallback || 'the dam'
  return h.damName || fallback || 'Bendungan'
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
      if (panel && !panel.contains(document.activeElement))
        (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'))?.focus({ preventScroll: true })
    }, 120)
    return () => window.clearTimeout(id)
  }, [shown, open, inside])
  return shown && open
}
