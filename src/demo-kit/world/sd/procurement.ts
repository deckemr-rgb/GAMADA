/**
 * world/sd/procurement.ts — Awas Belanja: packages, affiliation, HPS vs market, the seven detectors.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Bi, Bidder, Procurement, ProcurementFinding, WorldState } from '../types'
import { createSelector } from '../selectors'
import { DAY_MIN, ref, rows } from '../util'
import { opdShort, idNum, enNum, rpShort, devPct } from './base'

/* ================================================================== Awas Belanja */


export interface PackageRow {
  procurement: Procurement
  bidders: Bidder[]
  /** HPS vs market price deviation % over all items */
  deviationPct: number
}
/** the package list (newest first) with bidders resolved */
export const packages = /*#__PURE__*/ createSelector((s) => [s.procurements, s.bidders], (t, b): PackageRow[] =>
  rows(t).map((procurement) => ({ procurement, bidders: procurement.bidderIds.map((id) => b.byId[id]).filter((x): x is Bidder => !!x), deviationPct: Math.round(devPct(procurement) * 10) / 10 })),
)

export interface AffiliationEdge {
  a: string
  b: string
  kinds: ('alamat' | 'direktur' | 'ip' | 'giliran')[]
  evidence: Bi[]
}
/** edges between a package's bidders: same address, same director, same registration IP, rotating past wins */
export function affiliationEdges(s: WorldState, procurementId: string): AffiliationEdge[] {
  const p = s.procurements.byId[procurementId]
  if (!p) return []
  const bs = p.bidderIds.map((id) => s.bidders.byId[id]).filter((x): x is Bidder => !!x)
  const history = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.winnerId)
  const out: AffiliationEdge[] = []
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!
      const b = bs[j]!
      const kinds: AffiliationEdge['kinds'] = []
      const evidence: Bi[] = []
      if (a.address === b.address) {
        kinds.push('alamat')
        evidence.push({ id: `Alamat sama: ${a.address}`, en: `Same address: ${a.address}` })
      }
      if (a.director === b.director) {
        kinds.push('direktur')
        evidence.push({ id: `Direktur sama: ${a.director}`, en: `Same director: ${a.director}` })
      }
      if (a.ip === b.ip) {
        kinds.push('ip')
        evidence.push({ id: `IP pendaftaran sama: ${a.ip}`, en: `Same registration IP: ${a.ip}` })
      }
      const together = history.filter((h) => h.bidderIds.includes(a.id) && h.bidderIds.includes(b.id))
      const wins = together.filter((h) => h.winnerId === a.id || h.winnerId === b.id)
      if (together.length >= 2 && wins.length === together.length && new Set(wins.map((h) => h.winnerId)).size === 2) {
        kinds.push('giliran')
        evidence.push({ id: `Menang bergiliran di ${wins.length} paket: ${wins.map((h) => h.code).join(', ')}`, en: `Won in turns in ${wins.length} packages: ${wins.map((h) => h.code).join(', ')}` })
      }
      if (kinds.length) out.push({ a: a.id, b: b.id, kinds, evidence })
    }
  return out
}

export interface ItemDeviation {
  name: Bi
  qty: number
  unit: string
  hps: number
  market: number
  /** (HPS − market) / market × 100 */
  devPct: number
  /** (HPS − market) × qty */
  overpay: number
  level: 'lolos' | 'waspada' | 'tinggi'
}
/** HPS vs market table (spec P6 "HPS vs Pasar"): the memo must quote these same numbers */
export function hpsVsMarket(s: WorldState, procurementId: string): { items: ItemDeviation[]; hps: number; market: number; overpay: number; devPct: number } {
  const p = s.procurements.byId[procurementId]
  const items: ItemDeviation[] = (p?.items ?? []).map((it) => {
    const dev = it.marketPrice ? ((it.hpsPrice - it.marketPrice) / it.marketPrice) * 100 : 0
    return { name: it.name, qty: it.qty, unit: it.unit, hps: it.hpsPrice, market: it.marketPrice, devPct: Math.round(dev * 10) / 10, overpay: (it.hpsPrice - it.marketPrice) * it.qty, level: dev > 20 ? 'tinggi' : dev > 10 ? 'waspada' : 'lolos' }
  })
  const hps = items.reduce((a, i) => a + i.hps * i.qty, 0)
  const market = items.reduce((a, i) => a + i.market * i.qty, 0)
  return { items, hps, market, overpay: hps - market, devPct: market ? Math.round(((hps - market) / market) * 1000) / 10 : 0 }
}

/** the direct-procurement ceiling used by the 'pemecahan-paket' detector (Rp; simulated rule of the demo) */
export const DIRECT_PROCUREMENT_CEILING = 200_000_000

/**
 * Run the seven detectors on a package (spec P6 "Pola") — deterministic, every finding with an explanation that
 * quotes world numbers. Emit `procurement.flagged` with { riskScore, findings } after the scan animation.
 */
export function analyzeProcurement(s: WorldState, procurementId: string): { riskScore: number; findings: ProcurementFinding[] } {
  const p = s.procurements.byId[procurementId]
  if (!p) return { riskScore: 0, findings: [] }
  const f: ProcurementFinding[] = []
  const name = (id: string) => s.bidders.byId[id]?.name ?? id
  // 1 · uniform bid prices
  const bids = [...(p.bids ?? [])].sort((a, b) => a.price - b.price)
  let tight: typeof bids = []
  for (let i = 0; i < bids.length; i++) {
    const grp = bids.filter((b) => b.price >= bids[i]!.price && b.price <= bids[i]!.price * 1.005)
    if (grp.length > tight.length) tight = grp
  }
  f.push(tight.length >= 3
    ? { detector: 'harga-seragam', level: 'tinggi', note: { id: `${tight.length} penawaran berselisih kurang dari 0,5% (${tight.map((b) => name(b.bidderId)).join(', ')})`, en: `${tight.length} bids within 0.5% of each other (${tight.map((b) => name(b.bidderId)).join(', ')})` } }
    : { detector: 'harga-seragam', level: 'lolos', note: { id: 'Sebaran harga penawaran wajar', en: 'Bid prices are reasonably spread' } })
  // 2 · repeat winners (same OPD, current bidders)
  const past = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.winnerId && p.bidderIds.includes(x.winnerId))
  const winners = new Set(past.map((x) => x.winnerId))
  f.push(past.length >= 3
    ? { detector: 'pemenang-berulang', level: 'tinggi', note: { id: `${past.length} paket ${opdShort(s, p.opdId)} sebelumnya dimenangkan ${winners.size} peserta paket ini secara bergiliran`, en: `${past.length} earlier ${opdShort(s, p.opdId)} packages were won in turns by ${winners.size} bidders of this package` } }
    : past.length ? { detector: 'pemenang-berulang', level: 'waspada', note: { id: `${past.length} paket sebelumnya dimenangkan peserta yang sama`, en: `${past.length} earlier package(s) won by the same bidders` } }
    : { detector: 'pemenang-berulang', level: 'lolos', note: { id: 'Tidak ada pola pemenang berulang', en: 'No repeat-winner pattern' } })
  // 3 · split packages under the direct-procurement ceiling (same OPD, 30 days)
  const split = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.method === 'pengadaan-langsung' && x.hps < DIRECT_PROCUREMENT_CEILING && Math.abs(x.createdAt - p.createdAt) <= 30 * DAY_MIN && x.hps >= DIRECT_PROCUREMENT_CEILING * 0.9)
  f.push(split.length >= 2
    ? { detector: 'pemecahan-paket', level: 'waspada', note: { id: `${split.length} paket sejenis ${opdShort(s, p.opdId)} masing-masing ${rpShort(split[0]!.hps).id}, tepat di bawah ambang ${rpShort(DIRECT_PROCUREMENT_CEILING).id}`, en: `${split.length} similar ${opdShort(s, p.opdId)} packages of ${rpShort(split[0]!.hps).en} each, just under the ${rpShort(DIRECT_PROCUREMENT_CEILING).en} ceiling` } }
    : { detector: 'pemecahan-paket', level: 'lolos', note: { id: 'Tidak ada indikasi pemecahan paket', en: 'No sign of package splitting' } })
  // 4 · short schedule
  const days = p.scheduleDays ?? Math.round((p.deadlineAt - p.createdAt) / DAY_MIN)
  f.push(p.hps >= 1_000_000_000 && days < 7
    ? { detector: 'jadwal-singkat', level: p.emergency ? 'waspada' : 'tinggi', note: { id: `Jadwal penawaran ${days} hari untuk nilai ${rpShort(p.hps).id}${p.emergency ? ' (status darurat, tetap perlu justifikasi)' : ''}`, en: `${days}-day bidding window for ${rpShort(p.hps).en}${p.emergency ? ' (emergency status, still needs justification)' : ''}` } }
    : { detector: 'jadwal-singkat', level: 'lolos', note: { id: `Jadwal ${days} hari sesuai nilai paket`, en: `${days}-day window fits the package value` } })
  // 5 · brand-locked spec
  const spec = p.spec?.id ?? ''
  f.push(/merek/i.test(spec) && !/setara/i.test(spec)
    ? { detector: 'spesifikasi-merek', level: 'tinggi', note: { id: 'Spesifikasi menyebut satu merek tanpa "atau setara"', en: 'The spec names one brand without "or equivalent"' } }
    : { detector: 'spesifikasi-merek', level: 'lolos', note: { id: 'Spesifikasi netral merek', en: 'Brand-neutral specification' } })
  // 6 · HPS above market
  const hv = hpsVsMarket(s, p.id)
  f.push({
    detector: 'hps-kemahalan', level: hv.devPct > 20 ? 'tinggi' : hv.devPct > 10 ? 'waspada' : 'lolos',
    note: { id: `HPS ${idNum(hv.devPct, 1)}% di atas median pasar (selisih ${rpShort(hv.overpay).id})`, en: `HPS ${enNum(hv.devPct, 1)}% above the market median (difference ${rpShort(hv.overpay).en})` },
  })
  // 7 · affiliated bidders
  const edges = affiliationEdges(s, p.id)
  const ring = new Set(edges.flatMap((e) => [e.a, e.b]))
  // the note lists only the kinds of link the network really shows
  const kinds = [...new Set(edges.flatMap((e) => e.kinds))]
  f.push(edges.length
    ? { detector: 'afiliasi', level: ring.size >= 3 ? 'tinggi' : 'waspada', note: { id: `${ring.size} peserta terhubung lewat ${edges.length} kesamaan (${kinds.map((k) => AFFILIATION_KIND[k].id).join(', ')})`, en: `${ring.size} bidders linked by ${edges.length} shared traits (${kinds.map((k) => AFFILIATION_KIND[k].en).join(', ')})` } }
    : { detector: 'afiliasi', level: 'lolos', note: { id: 'Tidak ada keterkaitan antarpeserta', en: 'No links between bidders' } })
  return { riskScore: riskScoreOf(f), findings: f }
}

const AFFILIATION_KIND: Record<AffiliationEdge['kinds'][number], Bi> = {
  alamat: { id: 'alamat', en: 'address' },
  direktur: { id: 'direktur', en: 'director' },
  ip: { id: 'IP pendaftaran', en: 'registration IP' },
  giliran: { id: 'giliran menang', en: 'rotating wins' },
}
/** how much each detector's finding weighs (independent signals combined: 100 × (1 − Π(1 − w))) */
export const DETECTOR_WEIGHT: Record<ProcurementFinding['detector'], { tinggi: number; waspada: number }> = {
  'hps-kemahalan': { tinggi: 0.3, waspada: 0.12 },
  'harga-seragam': { tinggi: 0.3, waspada: 0.12 },
  afiliasi: { tinggi: 0.45, waspada: 0.2 },
  'pemenang-berulang': { tinggi: 0.25, waspada: 0.1 },
  'spesifikasi-merek': { tinggi: 0.2, waspada: 0.08 },
  'jadwal-singkat': { tinggi: 0.15, waspada: 0.06 },
  'pemecahan-paket': { tinggi: 0.15, waspada: 0.08 },
}
/** risk score 0–100 of a set of findings (a clean package scores 0; never a flat 100 from adding up) */
export function riskScoreOf(findings: ProcurementFinding[]): number {
  return Math.round(100 * (1 - findings.reduce((a, x) => a * (1 - (x.level === 'lolos' ? 0 : (DETECTOR_WEIGHT[x.detector]?.[x.level] ?? 0))), 1)))
}

/** local UMKM offers matched through Katalog Lokal for a package's need (price benchmark, spec P6 consume match.made) */
export function localBenchmarks(s: WorldState, procurementId: string): { businessId: string; name: string; score: number; needId: string }[] {
  const cause = ref('procurements', procurementId)
  const needs = rows(s.catalogNeeds).filter((n) => n.cause === cause).map((n) => n.id)
  return rows(s.matches).filter((m) => needs.includes(m.needId)).map((m) => ({ businessId: m.businessId, name: s.businesses.byId[m.businessId]?.name ?? m.businessId, score: m.score, needId: m.needId }))
}
