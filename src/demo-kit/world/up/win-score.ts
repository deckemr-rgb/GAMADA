/**
 * world/up/win-score.ts — TenderPilot's win probability (SIMULATED model): five weighted factors (0..1) →
 * logistic. `tender.matches[biz]` is ALWAYS this number (reaction C22 and the seed write it), so the banner, gauge,
 * feed row, audit row and tour caption agree. Calibrated so the flood's emergency tender scores 0.78 for the scenario
 * shop on the default Bojonegoro world (other worlds land in 0.70–0.85).
 */
import type { Bi, Tender, WorldState } from '../types'
import { distanceKm, rows } from '../util'
import { SHOP_KBLI } from './config'

export type WinFactorKey = 'kbli' | 'pengalaman' | 'jarak' | 'harga' | 'pesaing'
export interface WinFactor { key: WinFactorKey; value: number; weight: number; impact: 'naik' | 'turun' | 'netral'; note: Bi }
export interface WinScore { probability: number; factors: WinFactor[] }

export const WIN_MODEL = {
  weights: { kbli: 0.25, pengalaman: 0.25, jarak: 0.15, harga: 0.2, pesaing: 0.15 } as Record<WinFactorKey, number>,
  /** logistic slope and midpoint of the weighted sum */
  k: 7,
  mid: 0.7,
  /** a package with an affiliated bidder ring and a brand-locked spec (the pump mirror) */
  ringPenalty: 0.45,
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** the KBLI codes of a business (the shop: SHOP_KBLI; a building-supplies business: 46634) */
export const kbliOf = (s: WorldState, bizId: string): string[] =>
  bizId === s.meta.shopId ? SHOP_KBLI : s.businesses.byId[bizId]?.kind === 'toko-bangunan' ? [SHOP_KBLI[0]!] : []

/** cost of the tender's items at the business's own cost prices (the shop's SKUs by category), null when unknown */
export function itemCost(s: WorldState, t: Tender, bizId: string): number | null {
  if (!t.items?.length) return null
  let total = 0
  for (const it of t.items) {
    const costs: number[] = []
    for (const id of s.products.ids) {
      const p = s.products.byId[id]
      if (p && p.businessId === bizId && p.category === it.category && !p.tags.includes('bahan')) costs.push(p.cost)
    }
    if (!costs.length) return null
    // the closest SKU to the unit HPS (a sandbag tender prices the ready-filled bag, not the empty sack)
    const c = costs.reduce((a, b) => (Math.abs(b - it.hpsPrice) < Math.abs(a - it.hpsPrice) ? b : a))
    total += c * it.qty
  }
  return total
}

export function winScoreOf(s: WorldState, tenderId: string, bizId: string): WinScore {
  const t = s.tenders.byId[tenderId]
  const b = s.businesses.byId[bizId]
  if (!t || !b) return { probability: 0, factors: [] }
  const W = WIN_MODEL.weights
  const kbliOk = kbliOf(s, bizId).includes(t.kbli)
  const wins = rows(s.bids).filter((x) => x.businessId === bizId && x.status === 'menang').length
  const kec = s.region.kecamatan.find((k) => k.id === t.kecamatanId)
  const km = kec ? distanceKm(b.coord, kec.centroid) : 20
  const hps = t.hps ?? t.value
  const cost = itemCost(s, t, bizId)
  const margin = cost !== null && hps > 0 ? 1 - cost / hps : null
  const v = {
    kbli: kbliOk ? 1 : 0,
    pengalaman: Math.min(1, wins / 5),
    jarak: Math.max(0, Math.min(1, 1 - km / 40)),
    harga: margin === null ? 0.5 : Math.max(0, Math.min(1, margin / 0.3)),
    pesaing: Math.max(0, Math.min(1, 1 - (t.competitors - 2) / 12)),
  }
  const proc = t.procurementId ? s.procurements.byId[t.procurementId] : undefined
  const ring = !!proc && proc.bidderIds.some((id) => !!s.bidders.byId[id]?.ring)
  let x = 0
  for (const k of Object.keys(W) as WinFactorKey[]) x += W[k] * v[k]
  if (ring) x -= WIN_MODEL.ringPenalty
  const probability = Math.round((1 / (1 + Math.exp(-WIN_MODEL.k * (x - WIN_MODEL.mid)))) * 100) / 100
  const impact = (val: number): WinFactor['impact'] => (val >= 0.66 ? 'naik' : val <= 0.34 ? 'turun' : 'netral')
  const factors: WinFactor[] = [
    { key: 'kbli', value: v.kbli, weight: W.kbli, impact: kbliOk ? 'naik' : 'turun', note: kbliOk ? { id: `KBLI ${t.kbli} sesuai profil usaha`, en: `KBLI ${t.kbli} matches the business profile` } : { id: `KBLI ${t.kbli} tidak ada di profil usaha`, en: `KBLI ${t.kbli} is not in the business profile` } },
    { key: 'pengalaman', value: v.pengalaman, weight: W.pengalaman, impact: impact(v.pengalaman), note: { id: `${wins} pekerjaan sejenis dimenangkan dalam 10 bulan`, en: `${wins} similar contracts won in 10 months` } },
    { key: 'jarak', value: v.jarak, weight: W.jarak, impact: impact(v.jarak), note: { id: `Jarak ke lokasi ±${Math.round(km)} km`, en: `About ${Math.round(km)} km to the site` } },
    {
      key: 'harga', value: v.harga, weight: W.harga, impact: impact(v.harga),
      note: margin === null ? { id: 'Harga pokok belum bisa dihitung dari stok', en: 'Cost price cannot be computed from stock' } : { id: `Harga pokok ${pct(1 - margin)} dari HPS (simulasi)`, en: `Cost price is ${pct(1 - margin)} of the HPS (simulated)` },
    },
    {
      key: 'pesaing', value: ring ? 0 : v.pesaing, weight: W.pesaing, impact: ring ? 'turun' : impact(v.pesaing),
      note: ring ? { id: 'Peserta terafiliasi & spesifikasi mengunci merek', en: 'Affiliated bidders & a brand-locked spec' } : { id: `${t.competitors} pesaing diperkirakan`, en: `${t.competitors} expected competitors` },
    },
  ]
  return { probability, factors }
}
