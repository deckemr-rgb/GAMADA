/**
 * world/pd/econ.ts — Indeks Ekonomi Daerah selectors (SIMULATED regional economy). Anonymity: a kecamatan (or sector,
 * score bin) aggregate of fewer than ECON.anonMin businesses is HIDDEN everywhere (null value, no number), but still
 * counted in the kabupaten totals. Index 100 = the 12-month regional mean.
 */
import type { Bi, EconEvent, EconIndex, EntityRef, WorldState } from '../types'
import { hashString } from '../prng'
import { createParamSelector } from '../selectors'
import { DAY_MIN, monthOf, round, rows } from '../util'
import { PD } from './config'
import { PROGRAM_KIND, SECTOR } from './labels'
import { opSimulate } from './forecast'
import { catalogKpi } from './kpi'

export const ECON = { anonMin: PD.anonMin, months: 12 }

/** the 12 months, oldest first ('YYYY-MM') */
export const econMonths = (s: WorldState): string[] => Array.from({ length: ECON.months }, (_, i) => monthOf(s.day, i - (ECON.months - 1)))
const cell = (s: WorldState, kecId: string, month: string): EconIndex | undefined => s.econIndex.byId[`${kecId}:${month}`]
const prevMonth = (s: WorldState, month: string): string => {
  const ms = econMonths(s)
  const i = ms.indexOf(month)
  return i > 0 ? ms[i - 1]! : month
}

export interface EconFrame {
  month: string
  values: Record<string, number | null>
  hidden: string[]
  omzetTotal: number
  businessesTotal: number
  rank: { kecId: string; index: number; delta: number }[]
}
/** one month of the map: values (null = hidden), totals (hidden counted), visible ranking with Δ vs the previous month */
export const econFrame = createParamSelector((s) => [s.econIndex, s.region, s.day], (month: string, t, region, day): EconFrame => {
  const s = { econIndex: t, region, day } as WorldState
  const pm = prevMonth(s, month)
  const values: Record<string, number | null> = {}
  const hidden: string[] = []
  let omzetTotal = 0
  let businessesTotal = 0
  const rank: EconFrame['rank'] = []
  for (const k of region.kecamatan) {
    const c = cell(s, k.id, month)
    if (!c) continue
    omzetTotal += c.omzet
    businessesTotal += c.businesses
    if (c.businesses < ECON.anonMin) {
      values[k.id] = null
      hidden.push(k.id)
      continue
    }
    values[k.id] = c.index
    rank.push({ kecId: k.id, index: c.index, delta: round(c.index - (cell(s, k.id, pm)?.index ?? c.index), 1) })
  }
  rank.sort((a, b) => b.index - a.index || a.kecId.localeCompare(b.kecId))
  return { month, values, hidden, omzetTotal, businessesTotal, rank }
})

export interface EconMarker { month: string; at: number; label: Bi; kind: EconEvent['kind']; cause: EntityRef | null; delta: number; kecId: string }
/** 12-month series of a kecamatan (or the kabupaten: business-weighted index, Σ omzet) + markers from econ.updated causes;
 *  a hidden kecamatan returns null points */
export function econSeries(s: WorldState, kecId: string | null): { points: { month: string; index: number | null; omzet: number | null }[]; markers: EconMarker[]; hidden: boolean } {
  const ms = econMonths(s)
  const kecs = kecId ? [kecId] : s.region.kecamatan.map((k) => k.id)
  const hidden = !!kecId && (cell(s, kecId, ms[ms.length - 1]!)?.businesses ?? 0) < ECON.anonMin
  const markers: EconMarker[] = []
  const points = ms.map((m) => {
    let w = 0
    let acc = 0
    let omzet = 0
    for (const k of kecs) {
      const c = cell(s, k, m)
      if (!c) continue
      w += c.businesses
      acc += c.index * c.businesses
      omzet += c.omzet
      for (const ev of c.events ?? []) markers.push({ month: m, at: ev.at, label: ev.reason, kind: ev.kind, cause: ev.cause, delta: ev.delta, kecId: k })
    }
    return hidden ? { month: m, index: null, omzet: null } : { month: m, index: w ? round(acc / w, 1) : null, omzet }
  })
  markers.sort((a, b) => a.at - b.at)
  return { points, markers: hidden ? [] : markers, hidden }
}

type SectorKey = keyof typeof SECTOR
const SECTOR_BASE: Record<Exclude<SectorKey, 'lainnya'>, number> = { perdagangan: 0.32, makan: 0.26, industri: 0.19, pertanian: 0.12, jasa: 0.11 }
/** sector mix of a kecamatan / the kabupaten (simulated from the pack's main sectors); sectors < anonMin merged */
export function econSectors(s: WorldState, month: string, kecId: string | null): { key: SectorKey; label: Bi; businesses: number | null; omzet: number | null; share: number; merged: boolean }[] {
  const kecs = kecId ? [kecId] : s.region.kecamatan.map((k) => k.id)
  const acc: Record<string, { b: number; o: number }> = {}
  let total = 0
  for (const k of kecs) {
    const c = cell(s, k, month)
    if (!c) continue
    const main = c.topSector.toLowerCase()
    const w: Record<string, number> = {}
    let sum = 0
    for (const [key, base] of Object.entries(SECTOR_BASE)) {
      const boost = (key === 'pertanian' && /tani/.test(main)) || (key === 'perdagangan' && /dagang/.test(main)) || (key === 'industri' && /tambang|industri/.test(main)) ? 0.12 : 0
      w[key] = base + boost + ((hashString(`${k}|${key}`) % 100) / 100 - 0.5) * 0.04
      sum += w[key]!
    }
    for (const key of Object.keys(w)) {
      const share = w[key]! / sum
      const a = (acc[key] ??= { b: 0, o: 0 })
      a.b += Math.round(c.businesses * share)
      a.o += Math.round(c.omzet * share)
    }
    total += c.omzet
  }
  const out: ReturnType<typeof econSectors> = []
  let mergedB = 0
  let mergedO = 0
  for (const key of Object.keys(SECTOR_BASE) as SectorKey[]) {
    const a = acc[key] ?? { b: 0, o: 0 }
    if (a.b < ECON.anonMin) {
      mergedB += a.b
      mergedO += a.o
      continue
    }
    out.push({ key, label: SECTOR[key]!, businesses: a.b, omzet: a.o, share: total ? round(a.o / total, 3) : 0, merged: false })
  }
  if (mergedB || mergedO) {
    const visible = mergedB >= ECON.anonMin
    out.push({ key: 'lainnya', label: SECTOR.lainnya!, businesses: visible ? mergedB : null, omzet: visible ? mergedO : null, share: visible && total ? round(mergedO / total, 3) : 0, merged: true })
  }
  return out.sort((a, b) => (a.merged ? 1 : 0) - (b.merged ? 1 : 0) || (b.omzet ?? 0) - (a.omzet ?? 0))
}

/** today's live pulse: transactions recorded (Σ salesDaily day 0 tx = Toko Autopilot outletKpis().total.tx), revenue only
 *  when ≥ anonMin businesses are in the panel, transactions per hour */
export const econPulse = createParamSelector((s) => [s.sales, s.salesDaily], (now: number, sales, salesDaily) => {
  let tx = 0
  let revenue = 0
  for (const id of salesDaily.ids) {
    const d = salesDaily.byId[id]!
    if (d.day !== 0) continue
    tx += d.tx
    revenue += d.revenue
  }
  const byHour = Array.from({ length: 24 }, () => 0)
  const biz = new Set<string>()
  for (const id of sales.ids) {
    const x = sales.byId[id]!
    if (x.at < 0 || x.at >= DAY_MIN) continue
    biz.add(x.businessId)
    if (x.at <= now) byHour[Math.floor(x.at / 60)]!++
  }
  const panelBusinesses = biz.size
  const revenueVisible = panelBusinesses >= ECON.anonMin
  return { tx, revenue: revenueVisible ? revenue : null, panelBusinesses, revenueVisible, byHour }
})

/** today's econ.updated rows (newest first) */
export function econEvents(s: WorldState, now: number): { kecId: string; month: string; delta: number; index: number; reason: Bi; at: number; cause: EntityRef | null; kind: EconEvent['kind']; hidden: boolean }[] {
  const out: ReturnType<typeof econEvents> = []
  for (const id of s.econIndex.ids) {
    const c = s.econIndex.byId[id]!
    for (const ev of c.events ?? []) if (ev.at >= 0 && ev.at <= now) out.push({ kecId: c.kecamatanId, month: c.month, delta: ev.delta, index: ev.index, reason: ev.reason, at: ev.at, cause: ev.cause, kind: ev.kind, hidden: c.businesses < ECON.anonMin })
  }
  return out.sort((a, b) => b.at - a.at || a.kecId.localeCompare(b.kecId))
}

export interface ProgramRow { id: string; kind: 'operasi-pasar' | 'modal'; title: Bi; stage: string; measured: boolean; kecIds: string[]; commodityId?: string }
export const MODAL_PROGRAM_ID = 'modal-kerja'
/** every market operation (not dismissed) + one "Modal kerja Koperasi" cohort from approved loans */
export function programList(s: WorldState): ProgramRow[] {
  const out: ProgramRow[] = rows(s.marketOps)
    .filter((o) => o.stage !== 'dismissed')
    .sort((a, b) => b.at - a.at)
    .map((o) => ({ id: o.id, kind: 'operasi-pasar' as const, title: o.reason, stage: o.stage, measured: o.stage === 'done', commodityId: o.commodityId, kecIds: [...new Set(o.marketIds.map((m) => s.markets.byId[m]?.kecamatanId).filter((k): k is string => !!k))] }))
  const loans = rows(s.loanApps).filter((l) => l.status === 'disetujui')
  if (loans.length) out.push({ id: MODAL_PROGRAM_ID, kind: 'modal', title: PROGRAM_KIND.modal, stage: 'running', measured: true, kecIds: [...new Set(loans.map((l) => s.businesses.byId[l.businessId]?.kecamatanId).filter((k): k is string => !!k))] })
  return out
}

export interface Impact {
  method: 'selisih-ganda'
  labels: string[]
  treated: number[]
  control: number[]
  /** index in `labels` where the programme starts */
  split: number
  after: { values: number[]; lo: number[]; hi: number[] }
  effectPct: number
  /** the difference-in-differences actually read from the series (measured programmes) */
  didPct: number | null
  priceEffectPct?: number
  measured: boolean
  note: Bi
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
/** difference-in-differences impact of a programme (simulasi); projections for programmes not finished yet */
export function programImpact(s: WorldState, programId: string, now: number): Impact | null {
  if (programId === MODAL_PROGRAM_ID) {
    const p = programList(s).find((x) => x.id === MODAL_PROGRAM_ID)
    if (!p) return null
    const ms = econMonths(s)
    const set = new Set(p.kecIds)
    const series = (inT: boolean) => ms.map((m) => round(avg(s.region.kecamatan.filter((k) => set.has(k.id) === inT).map((k) => cell(s, k.id, m)?.index ?? 100)), 1))
    const treated = series(true)
    const control = series(false)
    const split = ms.length - 3
    const did = round(((avg(treated.slice(split)) / avg(treated.slice(0, split)) - avg(control.slice(split)) / avg(control.slice(0, split))) * 100), 1)
    return { method: 'selisih-ganda', labels: ms, treated, control, split, after: { values: treated.slice(split), lo: treated.slice(split).map((v) => round(v * 0.98, 1)), hi: treated.slice(split).map((v) => round(v * 1.02, 1)) }, effectPct: did, didPct: did, measured: true, note: { id: 'Kecamatan penerima modal vs kecamatan lain (simulasi)', en: 'Districts with loans vs the others (simulated)' } }
  }
  const op = s.marketOps.byId[programId]
  if (!op) return null
  const treatedIds = op.marketIds.map((m) => `${m}:${op.commodityId}`).filter((id) => s.prices.byId[id])
  const controlIds = rows(s.prices).filter((p) => p.commodityId === op.commodityId && !op.marketIds.includes(p.marketId)).map((p) => p.id)
  if (!treatedIds.length) return null
  const n = s.prices.byId[treatedIds[0]!]!.history.length
  const startDay = op.stage === 'done' || op.startedAt != null ? Math.floor((op.startedAt ?? op.at) / DAY_MIN) : 0
  const from = Math.max(0, n + startDay - 14)
  const to = Math.min(n, n + startDay + 16)
  const seriesOf = (ids: string[]) => {
    const base = avg(ids.map((id) => s.prices.byId[id]!.history[from] ?? 0)) || 1
    return Array.from({ length: Math.max(1, to - from) }, (_, k) => round((avg(ids.map((id) => s.prices.byId[id]!.history[from + k] ?? 0)) / base) * 100, 1))
  }
  const treated = seriesOf(treatedIds)
  const control = seriesOf(controlIds.length ? controlIds : treatedIds)
  const split = Math.min(treated.length - 1, Math.max(1, n + startDay - from))
  const labels = treated.map((_, k) => `H${from + k - n}`)
  if (op.stage === 'done' && to > n + startDay) {
    const did = round(((avg(treated.slice(split)) / avg(treated.slice(0, split)) - avg(control.slice(split)) / avg(control.slice(0, split))) * 100), 1)
    return { method: 'selisih-ganda', labels, treated, control, split, after: { values: treated.slice(split), lo: treated.slice(split).map((v) => round(v * 0.985, 1)), hi: treated.slice(split).map((v) => round(v * 1.015, 1)) }, effectPct: op.effectPct, didPct: did, priceEffectPct: op.effectPct, measured: true, note: { id: 'Pasar operasi vs pasar lain, sebelum dan sesudah (simulasi)', en: 'Operation markets vs other markets, before and after (simulated)' } }
  }
  const sim = opSimulate(s, { commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: op.volumeTon ?? 10, days: op.days ?? 3 }, now)
  const p0 = s.prices.byId[treatedIds[0]!]!
  const toIdx = (v: number) => round((v / (p0.price || 1)) * 100, 1)
  return {
    method: 'selisih-ganda', labels: [...labels.slice(0, split), ...sim.forecastAfter.map((_, k) => `+${k + 1}`)], treated: treated.slice(0, split), control: control.slice(0, split), split,
    after: { values: sim.forecastAfter.map(toIdx), lo: sim.lo.map(toIdx), hi: sim.hi.map(toIdx) }, effectPct: op.effectPct, didPct: null, priceEffectPct: sim.effectPct, measured: false,
    note: { id: 'Proyeksi: operasi belum selesai (simulasi)', en: 'Projection: the operation is not finished (simulated)' },
  }
}

/** Dinas Koperasi & UMKM cards (aggregates only, no business names; bins < anonMin merged) */
export function dinkopCards(s: WorldState, now: number) {
  const month = monthOf(s.day)
  const bins = [0, 550, 650, 750, 850]
  const counts = bins.map(() => 0)
  for (const id of s.bizScores.ids) {
    const sc = s.bizScores.byId[id]!.score
    let i = 0
    for (let k = 0; k < bins.length; k++) if (sc >= bins[k]!) i = k
    counts[i]!++
  }
  const scoreBins: { from: number; to: number; count: number | null; merged: boolean }[] = []
  let carry = 0
  let carryFrom = -1
  bins.forEach((from, i) => {
    const to = bins[i + 1] ?? 1000
    const c = counts[i]! + carry
    if (c < ECON.anonMin && i < bins.length - 1) {
      carry = c
      if (carryFrom < 0) carryFrom = from
      return
    }
    scoreBins.push({ from: carryFrom >= 0 ? carryFrom : from, to, count: c < ECON.anonMin ? null : c, merged: carryFrom >= 0 })
    carry = 0
    carryFrom = -1
  })
  const loans = rows(s.loanApps).filter((l) => l.status === 'disetujui')
  const k = catalogKpi(s, now)
  return {
    sectors: econSectors(s, month, null),
    scoreBins,
    modal: { count: loans.length, amount: loans.reduce((a, l) => a + (l.decidedAmount ?? l.amount), 0), kecIds: [...new Set(loans.map((l) => s.businesses.byId[l.businessId]?.kecamatanId).filter((x): x is string => !!x))] },
    katalog: { spendMonth: k.spendMonth, orders: k.paidOrdersMonth },
  }
}

export interface BriefingInput { month: string; kecIds: string[]; programIds: string[]; sections: ('peta' | 'sektor' | 'harga' | 'dampak')[] }
/** the briefing paper's numbers (= the screen's; hidden cells carry no number, listed in `hiddenIds` + a footnote) */
export function briefingModel(s: WorldState, now: number, inp: BriefingInput) {
  const frame = econFrame(s, inp.month)
  const kab = econSeries(s, null)
  const i = kab.points.findIndex((p) => p.month === inp.month)
  const cur = kab.points[i]
  const prev = kab.points[i - 1]
  const name = (k: string) => s.region.kecamatan.find((x) => x.id === k)?.name ?? k
  return {
    region: s.region.name, month: inp.month, sections: inp.sections,
    kabupaten: { index: cur?.index ?? null, delta: cur?.index != null && prev?.index != null ? round(cur.index - prev.index, 1) : null, omzet: frame.omzetTotal },
    kecamatan: inp.kecIds.map((k) => ({ kecId: k, name: name(k), index: frame.values[k] ?? null, hidden: frame.hidden.includes(k) })),
    top: frame.rank.slice(0, 3).map((r) => ({ ...r, name: name(r.kecId) })),
    bottom: frame.rank.slice(-3).reverse().map((r) => ({ ...r, name: name(r.kecId) })),
    sectors: inp.sections.includes('sektor') ? econSectors(s, inp.month, null) : [],
    programs: inp.sections.includes('dampak') ? inp.programIds.map((id) => ({ id, impact: programImpact(s, id, now) })) : [],
    hiddenIds: frame.hidden,
    footnote: { id: `Data agregat disembunyikan bila kurang dari ${ECON.anonMin} usaha (anonimitas). Semua angka simulasi.`, en: `Aggregates of fewer than ${ECON.anonMin} businesses are hidden (anonymity). All figures simulated.` } as Bi,
  }
}
