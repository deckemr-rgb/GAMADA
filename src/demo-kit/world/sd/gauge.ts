/**
 * world/sd/gauge.ts — the one clock-driven river curve (Meja Pimpinan, Siaga Wilayah, Radar Isu).
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Bi, Minutes, WaterGauge } from '../types'

/** a gauge's display name: "Bengawan Solo · pos Bojonegoro" → EN "Bengawan Solo · Bojonegoro gauge" */
export function gaugeName(g: WaterGauge): Bi {
  return { id: g.name, en: g.name.replace(/\bpos ([^·]+)$/i, '$1 gauge') }
}

/**
 * A water gauge's level at a world minute — ONE curve for every product (Siaga Wilayah, Meja Pimpinan, Radar Isu).
 * Up to the seeded reading (06.00) it replays the seeded 24 h history; after that the morning rain pushes the river
 * up: past SIAGA before 07.00, past AWAS ±10.15, a crest at 13.00, then it recedes (SIAGA again by ±16.00). The dam
 * (and any other gauge) keeps its seeded reading. SIMULATED readings at a real gauge site.
 */
export const RIVER_CREST_AT = 13 * 60
export function gaugeLevelAt(g: WaterGauge, minute: Minutes): number {
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
export interface GaugeOutlook {
  level: number
  state: 'normal' | 'siaga' | 'awas'
  /** m per hour over the last hour (positive = rising) */
  trend: number
  /** highest level within the next 6 h and its world minute */
  peak: { level: number; at: Minutes }
  /** world minute the level first reaches AWAS within the next 6 h (null = not reached / already above) */
  awasAt: Minutes | null
}
/** the reading at a world minute plus its 6-hour outlook (same curve everywhere) */
export function gaugeOutlook(g: WaterGauge, minute: Minutes): GaugeOutlook {
  const r2 = (v: number) => Math.round(v * 100) / 100
  const level = r2(gaugeLevelAt(g, minute))
  const trend = r2(gaugeLevelAt(g, minute) - gaugeLevelAt(g, minute - 60))
  let peak = { level: gaugeLevelAt(g, minute), at: minute }
  let awasAt: Minutes | null = null
  for (let m = minute + 15; m <= minute + 360; m += 15) {
    const v = gaugeLevelAt(g, m)
    if (v >= peak.level) peak = { level: v, at: m }
    if (awasAt === null && level < g.awas && v >= g.awas) awasAt = m
  }
  const state = level >= g.awas ? 'awas' : level >= g.siaga ? 'siaga' : 'normal'
  return { level, state, trend, peak: { level: r2(peak.level), at: peak.at }, awasAt }
}
