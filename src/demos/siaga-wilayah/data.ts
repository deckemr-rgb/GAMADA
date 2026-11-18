/**
 * siaga-wilayah/data.ts — memoised world reads of this product (pure; safe inside useWorld) and the small scenario
 * helpers the eager screen needs. Everything numeric here is SIMULATED (seeded world) and labelled so in the UI.
 */
import { emit, ref, rows, world, type Alert, type Complaint, type DemoSession, type Facility, type WorldState, type WaterGauge } from '../../demo-kit/world'
import type { FloodImpact } from '../../demo-kit/map'
import { rainScenario } from '../../demo-kit/world/satu-daerah'
import { demoHref } from '../../demo-kit/shell'
import type { ProductSlug, RoleId } from '../../content/products'

/** this product's roles: BPBD (default) sends warnings, Kepala Daerah approves + sends, Dinas Pertanian reads */
export const ROLES_OF = ['bpbd', 'pertanian', 'kepala-daerah'] as const satisfies readonly RoleId[]
export type SwRole = (typeof ROLES_OF)[number]
export const swRole = (r: RoleId | string): SwRole => ((ROLES_OF as readonly string[]).includes(r) ? (r as SwRole) : 'bpbd')
export const canSend = (r: SwRole): boolean => r !== 'pertanian'

/** today's window for "reports this morning": since 18:00 yesterday */
const SINCE = -6 * 60

function memo1<A, R>(fn: (a: A) => R): (a: A) => R {
  let la: A | undefined
  let lr: R | undefined
  let has = false
  return (a: A) => {
    if (has && a === la) return lr as R
    la = a
    lr = fn(a)
    has = true
    return lr
  }
}

const reportsOf = memo1((t: WorldState['complaints']): Complaint[] => rows(t).filter((c) => c.category === 'banjir' && c.at >= SINCE))
/** flood complaints since last evening, newest first */
export const floodReports = (s: WorldState): Complaint[] => reportsOf(s.complaints)

const activeOf = memo1((t: WorldState['alerts']): Alert[] => rows(t).filter((a) => a.status === 'aktif' && a.kind === 'banjir'))
/** active flood alerts, newest first */
export const floodAlerts = (s: WorldState): Alert[] => activeOf(s.alerts)

const confirmedOf = memo1((t: WorldState['alerts']): ReadonlySet<string> => {
  const out = new Set<string>()
  for (const a of rows(t)) for (const id of a.confirmedBy ?? []) out.add(id)
  return out
})
/** complaint ids that confirmed any alert ("Terkonfirmasi warga") */
export const confirmedIds = (s: WorldState): ReadonlySet<string> => confirmedOf(s.alerts)

const sheltersOf = memo1((t: WorldState['facilities']): Facility[] => rows(t).filter((f) => f.kind === 'pengungsian'))
export const shelters = (s: WorldState): Facility[] => sheltersOf(s.facilities)

const keyFacOf = memo1((t: WorldState['facilities']): Facility[] => rows(t).filter((f) => f.kind === 'rs' || f.kind === 'puskesmas' || f.kind === 'sekolah' || f.kind === 'pengungsian'))
export const keyFacilities = (s: WorldState): Facility[] => keyFacOf(s.facilities)

const riverOf = memo1((t: WorldState['gauges']): WaterGauge | null => rows(t).find((g) => g.kind === 'sungai') ?? null)
/** the flood river gauge (simulated readings at a real place) */
export const riverGauge = (s: WorldState): WaterGauge | null => riverOf(s.gauges)

const gaugesOf = memo1((t: WorldState['gauges']): WaterGauge[] => rows(t).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'sungai' ? -1 : 1)))
/** every water gauge (river first, then the dam): simulated readings at real places */
export const allGauges = (s: WorldState): WaterGauge[] => gaugesOf(s.gauges)

/** status of a level against a gauge's own thresholds */
export const levelState = (g: WaterGauge, v: number): 'normal' | 'siaga' | 'awas' => (v >= g.awas ? 'awas' : v >= g.siaga ? 'siaga' : 'normal')
/** status of a gauge's seeded reading (use gaugeNow() for the reading at the world clock) */
export const gaugeState = (g: WaterGauge): 'normal' | 'siaga' | 'awas' => levelState(g, g.level)

/**
 * The flood river's water level at a world minute — ONE curve shared by the Situation card, the map marker, the
 * Prediksi hydrograph, the warning dialog and Geo-AI, so the gauge, the model and the warning level tell one story.
 * Up to the seeded reading (06.00) it replays the seeded 24 h history; after that the morning rain pushes it up:
 * past SIAGA before 07.00, past AWAS ±10.15, a crest at 13.00 (= the end of the 6-hour flood model run at 07.00),
 * then it recedes through the afternoon (SIAGA again by ±16.00). The dam (and any other gauge) keeps its seeded
 * reading: the dam stays normal (Radar Isu's hoax evidence). SIMULATED readings at a real gauge site.
 */
export const RIVER_CREST_AT = 13 * 60
export function riverLevelAt(g: WaterGauge, minute: number): number {
  if (g.kind !== 'sungai') return g.level
  const h = g.history
  const t0 = g.updatedAt
  if (minute <= t0) {
    const i = (h.length - 1) - (t0 - minute) / 60
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
export interface GaugeNow {
  level: number
  state: 'normal' | 'siaga' | 'awas'
  /** m per hour over the last hour (positive = rising) */
  trend: number
  /** highest level within the next 6 h and its world minute */
  peak: { level: number; at: number }
  /** world minute the level first reaches AWAS within the next 6 h (null = not reached / already above) */
  awasAt: number | null
}
/**
 * World minute the river first reaches AWAS on the rising limb, solved from the curve itself (not sampled from "now",
 * so it never drifts while the clock runs), rounded to 5 minutes; null when the scenario never reaches it.
 */
function awasCrossing(g: WaterGauge): number | null {
  const crest = g.awas + 0.45
  if (g.kind !== 'sungai' || g.level >= g.awas || crest < g.awas) return null
  const f = (2 / Math.PI) * Math.asin((g.awas - g.level) / (crest - g.level))
  return Math.round((g.updatedAt + f * (RIVER_CREST_AT - g.updatedAt)) / 5) * 5
}
/** the reading at a world minute plus its 6-hour outlook (same curve everywhere; crest + AWAS times are fixed) */
export function gaugeNow(g: WaterGauge, minute: number): GaugeNow {
  const level = Math.round(riverLevelAt(g, minute) * 100) / 100
  const trend = Math.round((riverLevelAt(g, minute) - riverLevelAt(g, minute - 60)) * 100) / 100
  let peak = { level: riverLevelAt(g, minute), at: minute }
  if (g.kind === 'sungai' && minute < RIVER_CREST_AT && RIVER_CREST_AT <= minute + 360) peak = { level: riverLevelAt(g, RIVER_CREST_AT), at: RIVER_CREST_AT }
  else
    for (let m = minute + 15; m <= minute + 360; m += 15) {
      const v = riverLevelAt(g, m)
      if (v > peak.level + 0.005) peak = { level: v, at: m }
    }
  const cross = awasCrossing(g)
  const awasAt = cross !== null && level < g.awas && cross > minute && cross <= minute + 360 ? cross : null
  return { level, state: levelState(g, level), trend, peak: { level: Math.round(peak.level * 100) / 100, at: peak.at }, awasAt }
}

/**
 * The 6-hour flood model is ONE run anchored at the scenario morning: +0 h = 07.00, +6 h = 13.00 (= the river crest).
 * Every arrival clock time (KecCard, warning card, AI draft, Geo-AI, template) derives from this anchor, so they agree
 * and do not drift while the clock runs. Simulated.
 */
export const FC_T0 = 7 * 60
/** arrival clock time of a model onset (hours after the run): 5-minute steps, at least 15 minutes after the run */
export const arrivalAt = (onsetH: number): number => FC_T0 + Math.max(15, Math.round(onsetH * 12) * 5)
/**
 * The model hour that matches the river at a world minute (the world clock drives the flood on the map): 0 before
 * 07.00, the run hour up to the crest at 13.00, then it recedes with the river level (back to 0 when it has fallen
 * to its 07.00 reading). Quarter-hour steps.
 */
export function floodHourAt(g: WaterGauge | null, minute: number): number {
  if (minute <= FC_T0) return 0
  if (minute <= RIVER_CREST_AT || !g) return Math.min(6, Math.floor((minute - FC_T0) / 15) / 4)
  const v0 = riverLevelAt(g, FC_T0)
  const top = riverLevelAt(g, RIVER_CREST_AT)
  const f = Math.max(0, Math.min(1, (riverLevelAt(g, minute) - v0) / Math.max(0.01, top - v0)))
  return Math.round(f * 24) / 4
}

/**
 * The warning zone the model recommends (one definition for the dialog, the Prediksi list, Geo-AI and the insight):
 * the 6 kecamatan with the most people in the +6 h flood zone. The active warnings' kecamatan win once sent.
 */
export function recommendedKec(impact6: FloodImpact | null): string[] {
  const per = new Map<string, number>()
  for (const d of impact6?.desa ?? []) per.set(d.kecamatanId, (per.get(d.kecamatanId) ?? 0) + d.people)
  return [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k)
}
export function warnZone(s: WorldState, impact6: FloodImpact | null): string[] {
  const active = [...new Set(floodAlerts(s).flatMap((a) => a.kecamatanIds))]
  return active.length ? active : recommendedKec(impact6)
}
/** model rows inside / outside a zone, earliest arrival first */
export function arrivals(impact: FloodImpact | null, zone: readonly string[]): { inZone: FloodImpact['desa']; outside: FloodImpact['desa'] } {
  const z = new Set(zone)
  const rowsS = [...(impact?.desa ?? [])].sort((a, b) => a.onset - b.onset || b.people - a.people)
  return { inZone: rowsS.filter((d) => z.has(d.kecamatanId)), outside: rowsS.filter((d) => !z.has(d.kecamatanId)) }
}

/**
 * Shelter occupancy at a world minute (SIMULATED): the world fills a shelter in the warning zone when the warning is
 * issued; from then on evacuees keep arriving (≈ 6 % of its capacity per 15 minutes) until it is full, and after the
 * crest people start going home (from 15.00). Same numbers for the Posko card, the leader summary and Geo-AI.
 */
export function shelterOcc(s: WorldState, f: Facility, minute: number): number {
  if (!f.occupied) return 0
  const a = floodAlerts(s).filter((x) => x.kecamatanIds.includes(f.kecamatanId ?? '')).reduce((m, x) => Math.min(m, x.at), Infinity)
  const since = Number.isFinite(a) ? Math.max(0, minute - a) : 0
  let occ = Math.min(f.capacity, f.occupied + Math.floor(since / 15) * Math.round(f.capacity * 0.06))
  if (minute > 15 * 60) occ = Math.max(f.occupied, Math.round(occ * Math.exp(-(minute - 15 * 60) / 240)))
  return occ
}
/** evacuation need of a warning zone (SIMULATED assumption): ±5 % of its people (the vulnerable) need a shelter place */
export const SHELTER_SHARE = 0.05

/** the warning level the gauge + its outlook support: AWAS (3) when AWAS is reached within 6 h, SIAGA (2) above siaga */
export function suggestedLevel(n: GaugeNow | null, g: WaterGauge | null): 1 | 2 | 3 {
  if (!n || !g) return 3
  if (n.state === 'awas' || n.peak.level >= g.awas) return 3
  return n.state === 'siaga' || n.peak.level >= g.siaga ? 2 : 1
}

/** part of the day for the Situation card title */
export const dayPart = (minute: number): 'pagi' | 'siang' | 'sore' | 'malam' => {
  const m = ((minute % 1440) + 1440) % 1440
  return m < 4 * 60 ? 'malam' : m < 11 * 60 ? 'pagi' : m < 15 * 60 ? 'siang' : m < 18 * 60 + 30 ? 'sore' : 'malam'
}

/** a gauge's display name: the kit seed names the river gauge "<river> · pos <region>" (Indonesian); EN says "gauge" */
export const gaugeName = (name: string, lang: 'id' | 'en'): string => (lang === 'en' ? name.replace(/ · pos (.+)$/, ' · $1 gauge') : name)

/**
 * A cross-product follow-up summary as shown here: numbers in the Indonesian style in ID (the kit writes "82.3"),
 * and every rupiah figure marked as simulated, so a screenshot of one row can never pass for a real decision.
 */
export function chainText(text: string, lang: 'id' | 'en'): string {
  let t = lang === 'id' ? text.replace(/(\d)\.(\d)(?!\d)/g, '$1,$2') : text.replace(/\(negatif\)/g, '(negative)').replace(/\(positif\)/g, '(positive)').replace(/\(netral\)/g, '(neutral)')
  if (/Rp\s?\d/.test(t) && !/simulasi|simulated/i.test(t)) t = `${t} (${lang === 'id' ? 'simulasi' : 'simulated'})`
  return t
}

const phonesOf = memo1((t: WorldState['messages']): number => rows(t).reduce((n, m) => (m.kind === 'peringatan' ? n + m.to.length : n), 0))
/** citizen phones reached by warnings today */
export const phonesReached = (s: WorldState): number => phonesOf(s.messages)

const pascaOf = memo1((t: WorldState['harvests']): boolean => rows(t).some((h) => h.scenario === 'pasca-banjir'))
export const harvestPasca = (s: WorldState): boolean => pascaOf(s.harvests)

const clusterOf = memo1((t: WorldState['clusters']): number => rows(t).filter((c) => c.category === 'banjir').reduce((n, c) => Math.max(n, c.complaintIds.length), 0))
/** size of the largest flood cluster (0 = none) */
export const floodClusterSize = (s: WorldState): number => clusterOf(s.clusters)

/**
 * The morning rain forecast of this demo: the kit scenario's cells (intensity, size, heading), re-timed so the story
 * reads on the map: at +0 h the cells wait just inside the region's western edge (the Situation card says "rain
 * clouds to the west"), at +3 h they sit over the flood kecamatan (the kit model's peak hour) and by +6 h they have
 * crossed towards the east. Deterministic per region; the map moves them only with the scrubber (no ambient drift).
 */
export function forecastRain(s: WorldState): ReturnType<typeof rainScenario> {
  const base = rainScenario(s)
  const ks = s.region.kecamatan
  if (!ks.length) return base
  const lat0 = ks.reduce((a, k) => a + k.centroid[1], 0) / ks.length
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180)
  const west = Math.min(...ks.map((k) => k.centroid[0]))
  const flood = s.region.floodKecamatanIds.map((id) => ks.find((k) => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k)
  const anchors = flood.length ? flood : ks.slice(0, 2)
  const cells = base.cells.map((c, i) => {
    const a = anchors[i % anchors.length]!.centroid
    const sin = Math.max(0.5, Math.sin((c.heading * Math.PI) / 180))
    // +3 h: over the flood kecamatan (a little west of its centre, staggered north / south)
    const center: [number, number] = [a[0] - (2 + 3 * i) / kx, a[1] + ((i % 2 ? 1 : -1) * 2.5) / 110.57]
    // +0 h: just inside the western edge (staggered so the cells do not start on top of each other)
    const startX = west + (2 + 4 * i) / kx
    const speedKmh = Math.round(Math.max(8, Math.min(28, ((center[0] - startX) * kx) / (3 * sin))) * 10) / 10
    return { ...c, center, speedKmh }
  })
  return { ...base, cells }
}

/** hh.mm (ID) / hh:mm (EN) of a world minute */
export function clockText(min: number, lang: 'id' | 'en'): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return lang === 'id' ? `${hh}.${mm}` : `${hh}:${mm}`
}

/**
 * Simulated post-flood harvest drop per kecamatan (%), scaled by how much of it floods: the share of its desa
 * inundated in the +6 h model (an active warning zone counts as at least half flooded). drop = 8 % + 52 % × share,
 * capped at 45 %; kecamatan with < 8 % of their desa flooded (and no warning) are left out. Without a model run the
 * scenario's first flood kecamatan counts as 60 % flooded, the others as 30 %. Cabai / bawang merah drop ×1.2 in the
 * world reducer. Sorted hardest-hit first.
 */
export function floodDrops(s: WorldState, impact6: FloodImpact | null): { id: string; share: number; drop: number }[] {
  const alertKec = new Set(floodAlerts(s).flatMap((a) => a.kecamatanIds))
  const hit = new Map<string, number>()
  for (const d of impact6?.desa ?? []) hit.set(d.kecamatanId, (hit.get(d.kecamatanId) ?? 0) + 1)
  const out: { id: string; share: number; drop: number }[] = []
  const add = (id: string, share: number) => out.push({ id, share, drop: Math.round(Math.min(45, 8 + 52 * share) * 10) / 10 })
  if (!hit.size && !alertKec.size) {
    s.region.floodKecamatanIds.forEach((id, i) => add(id, i ? 0.3 : 0.6))
    return out
  }
  for (const k of s.region.kecamatan) {
    const raw = (hit.get(k.id) ?? 0) / Math.max(1, k.desa.length)
    const share = alertKec.has(k.id) ? Math.max(0.5, raw) : raw
    if (share >= 0.08) add(k.id, Math.min(1, share))
  }
  return out.sort((x, y) => y.drop - x.drop)
}

/** switch the harvest scenario: "pasca" emits ONE harvest.updated with a per-kecamatan drop (source siaga-wilayah); "normal" resets */
export function setHarvestScenario(to: 'normal' | 'pasca', impact6: FloodImpact | null): void {
  if ((to === 'pasca') === harvestPasca(world.get()) || harvestPending) return
  harvestPending = true
  // the world runs the reactions (econ, supply) synchronously: let the click paint first (INP)
  requestAnimationFrame(() =>
    setTimeout(() => {
      harvestPending = false
      applyHarvestScenario(to, impact6)
    }, 0),
  )
}
let harvestPending = false
function applyHarvestScenario(to: 'normal' | 'pasca', impact6: FloodImpact | null): void {
  const s = world.get()
  if ((to === 'pasca') === harvestPasca(s)) return
  if (to === 'pasca') {
    const alert = floodAlerts(s)[0]
    const cause = alert ? ref('alerts', alert.id) : null
    const drops = floodDrops(s, impact6)
    if (drops.length)
      emit(
        'harvest.updated',
        { scenario: 'pasca-banjir', kecamatanIds: drops.map((d) => d.id), dropPct: drops[0]!.drop, dropPctByKecamatan: Object.fromEntries(drops.map((d) => [d.id, d.drop])), cause },
        'siaga-wilayah',
      )
  } else {
    const ids = [...new Set(rows(s.harvests).filter((h) => h.scenario === 'pasca-banjir').map((h) => h.kecamatanId))]
    emit('harvest.updated', { scenario: 'normal', kecamatanIds: ids }, 'siaga-wilayah')
  }
}

/** warning level of an AI draft: "LEVEL n" in the text wins (the structured enum stops at "awas" = 3) */
export function draftLevel(a: { level?: string; message?: string }): 1 | 2 | 3 | 4 {
  const m = /LEVEL\s*([1-4])/i.exec(a.message ?? '')
  if (m) return Number(m[1]) as 1 | 2 | 3 | 4
  if (/darurat|emergency/i.test(`${a.level ?? ''} ${a.message ?? ''}`)) return 4
  return a.level === 'waspada' ? 1 : a.level === 'siaga' ? 2 : 3
}

/** every warning text that leaves this demo is marked as a simulation (it must never pass for a real BPBD message) */
export const SIM_MARK = { id: '[SIMULASI DEMO]', en: '[DEMO SIMULATION]' } as const
export function withSimMark(text: string, lang: 'id' | 'en'): string {
  const t = text.trim()
  return /simulasi|simulation/i.test(t.slice(0, 40)) ? t : `${SIM_MARK[lang]} ${t}`
}

/** link to another product's demo with this session (keeps ?controls=all while products are not DEMO_READY yet) */

export function productHref(slug: ProductSlug, s: DemoSession, focus?: string | null): string {
  const h = demoHref(slug, s, focus)
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? `${h}&controls=all` : h
}
