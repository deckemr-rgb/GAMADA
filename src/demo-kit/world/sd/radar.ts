/**
 * world/sd/radar.ts — Radar Isu: hourly buckets, sentiment, topics, stream, the hoax burst.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { EventMap, Mention, Minutes, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { HOAX_OFFSETS, HOAX_SCENARIO, hoaxPost } from '../scenario-texts'
import { rows } from '../util'
import { kecName } from './base'

/* ================================================================== Radar Isu */

export interface HourBucket {
  /** world minute where the hour starts */
  start: Minutes
  count: number
  neg: number
  neu: number
  pos: number
  /** mean sentiment score −1..1 (0 when empty) */
  avg: number
  /** mentions of a hoax / rumor in this hour */
  hoax: number
  reach: number
}
const byHourSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): HourBucket[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  return byHour({ mentions: t } as WorldState, now, hours)
})
/** mention volume + sentiment per hour, the last `hours` hours up to `now` (oldest first) — sentiment chart, volume. Memoised. */
export function mentionsByHour(s: WorldState, now: Minutes, hours = 24): HourBucket[] {
  return byHourSel(s, `${now}|${hours}`)
}
function byHour(s: WorldState, now: Minutes, hours: number): HourBucket[] {
  const end = Math.floor(now / 60) * 60 + 60
  const start = end - hours * 60
  const b: HourBucket[] = Array.from({ length: hours }, (_, i) => ({ start: start + i * 60, count: 0, neg: 0, neu: 0, pos: 0, avg: 0, hoax: 0, reach: 0 }))
  const sums = new Array<number>(hours).fill(0)
  for (const m of rows(s.mentions)) {
    if (m.at > now || m.at < start) continue
    const i = Math.floor((m.at - start) / 60)
    const x = b[i]
    if (!x) continue
    x.count++
    x.reach += m.reach
    sums[i]! += m.score
    if (m.sentiment === 'negatif') x.neg++
    else if (m.sentiment === 'positif') x.pos++
    else x.neu++
    if (m.rumor || m.hoaxId) x.hoax++
  }
  b.forEach((x, i) => (x.avg = x.count ? Math.round((sums[i]! / x.count) * 100) / 100 : 0))
  return b
}

const seriesSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): { start: Minutes; value: number; count: number }[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  let last = 0
  return mentionsByHour({ mentions: t } as WorldState, now, hours).map((h) => {
    if (h.count) last = Math.round(h.avg * 100)
    return { start: h.start, value: last, count: h.count }
  })
})
/** sentiment index per hour (−100..100), carrying the last value through empty hours — the 24 h line. Memoised. */
export function sentimentSeries(s: WorldState, now: Minutes, hours = 24): { start: Minutes; value: number; count: number }[] {
  return seriesSel(s, `${now}|${hours}`)
}

export interface TopicCluster {
  topic: string
  count: number
  reach: number
  /** mean score −1..1 */
  score: number
  sentiment: Mention['sentiment']
  latest: Mention
  hoax: boolean
}
const topicSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): TopicCluster[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  return topics({ mentions: t } as WorldState, now, hours)
})
/** topic bubbles (size = volume, colour = sentiment) over the last `hours` up to `now`, biggest first. Memoised. */
export function topicClusters(s: WorldState, now: Minutes, hours = 24): TopicCluster[] {
  return topicSel(s, `${now}|${hours}`)
}
function topics(s: WorldState, now: Minutes, hours: number): TopicCluster[] {
  const by = new Map<string, { n: number; reach: number; sum: number; latest: Mention; hoax: boolean }>()
  for (const m of rows(s.mentions)) {
    if (m.at > now || m.at < now - hours * 60) continue
    const g = by.get(m.topic)
    if (g) {
      g.n++
      g.reach += m.reach
      g.sum += m.score
      if (m.at > g.latest.at) g.latest = m
      g.hoax ||= !!(m.rumor || m.hoaxId)
    } else by.set(m.topic, { n: 1, reach: m.reach, sum: m.score, latest: m, hoax: !!(m.rumor || m.hoaxId) })
  }
  return [...by.entries()].map(([topic, g]) => {
    const score = Math.round((g.sum / g.n) * 100) / 100
    return { topic, count: g.n, reach: g.reach, score, sentiment: (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral') as Mention['sentiment'], latest: g.latest, hoax: g.hoax }
  }).sort((a, b) => b.count - a.count || b.reach - a.reach)
}

/** mentions up to `now`, newest first (the live stream); `limit` keeps the list short */
export function mentionStream(s: WorldState, now: Minutes, limit = 60): Mention[] {
  const out: Mention[] = []
  for (const id of s.mentions.ids) {
    const m = s.mentions.byId[id]
    if (!m || m.at > now) continue
    out.push(m)
    if (out.length >= limit) break
  }
  return out.sort((a, b) => b.at - a.at)
}

/**
 * The false-narrative burst (spec P4 step 2): `mention.created` payloads at `at` + 0…25 min. Emit them in order with
 * your product as source ("Picu skenario"); the 6th one makes the world raise `hoax.detected` (→ Meja Pimpinan toast).
 * The clock does the same by itself at 10:00 when natural events run (source 'clock'). Empty when already fired.
 */
export function hoaxBurst(s: WorldState, at: Minutes): EventMap['mention.created'][] {
  const rumor = s.meta.facts.hoax.rumor || HOAX_SCENARIO.rumor
  if (rows(s.mentions).some((m) => m.rumor === rumor)) return []
  const dam = s.meta.facts.hoax.damName || 'Bendungan'
  const k = kecName(s, s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? '')
  return HOAX_OFFSETS.map((_, i) => hoaxPost(i, at, dam, k, rumor))
}

/** the rumor's mentions (oldest first) with cumulative reach — the small exponential "kecepatan sebar" chart */
export function rumorSpread(s: WorldState, rumor: string): { at: Minutes; reach: number; cumulative: number }[] {
  let cum = 0
  return rows(s.mentions).filter((m) => m.rumor === rumor).sort((a, b) => a.at - b.at).map((m) => ({ at: m.at, reach: m.reach, cumulative: (cum += m.reach) }))
}
