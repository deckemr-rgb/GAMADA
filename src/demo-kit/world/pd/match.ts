/**
 * world/pd/match.ts — THE catalog match model (tiny, UP-free): `matchScore` is used by C36 'need→catalog-match',
 * C27 'kyb→catalog-match' (UP chains), the Katalog Lokal shortlist and Kenal Mitra's catalog preview, so the same
 * business gets the same number everywhere. `listingOf` derives a business's catalog listing (no listing table).
 */
import type { Business, CatalogNeed, WorldState } from '../types'
import { hashString } from '../prng'
import { clamp, distanceKm, round } from '../util'
import { CATEGORY_REF, PD } from './config'

const unit = (key: string): number => (hashString(key) % 10_000) / 10_000

/** the shop's units on hand of a catalog category (Toko Autopilot stock, toko SKUs, not market ingredients) */
export function shopOnHand(s: WorldState, category: string): number {
  let n = 0
  for (const id of s.stock.ids) {
    const st = s.stock.byId[id]!
    const p = s.products.byId[st.productId]
    if (p && p.businessId === s.meta.shopId && p.category === category && !p.tags.includes('bahan')) n += st.onHand
  }
  return n
}

export interface Listing { category: string; unitPrice: number; qtyAvailable: number; leadDays: number; unit: string }
/** a business's derived listing of a category (deterministic): reference price × f(bizId) ∈ [0.86, 1.04], Rp 100 */
export function listingOf(s: WorldState, bizId: string, category: string): Listing {
  const b = s.businesses.byId[bizId]
  const ref = CATEGORY_REF[category] ?? { price: 50_000, unit: 'unit', perStaff: 10 }
  const f = 0.86 + 0.18 * unit(`${bizId}|${category}|harga`)
  const unitPrice = Math.round((ref.price * f) / 100) * 100
  const isShop = bizId === s.meta.shopId
  const qtyAvailable = isShop ? shopOnHand(s, category) : Math.max(1, Math.round((b?.employees ?? 2) * ref.perStaff * (0.6 + 0.8 * unit(`${bizId}|${category}|stok`))))
  const leadDays = 1 + ((b?.capacity ?? 10) >= 25 ? 0 : 1) + ((b?.employees ?? 2) < 3 ? 1 : 0)
  return { category, unitPrice, qtyAvailable, leadDays, unit: ref.unit }
}

export interface MatchParts { coverage: number; distance: number; skor: number; pajak: number; kapasitas: number }
export const MATCH_WEIGHTS: MatchParts = { coverage: 0.35, distance: 0.25, skor: 0.2, pajak: 0.1, kapasitas: 0.1 }

/** km from a business to the need's kecamatan centroid (0.1 km) */
export function needKm(s: WorldState, n: CatalogNeed, b: Business): number {
  const kec = s.region.kecamatan.find((k) => k.id === n.kecamatanId)
  return kec ? round(distanceKm(b.coord, kec.centroid), 1) : 10
}

/**
 * THE match score of a business for a need, 0..1 (2 decimals) with its parts: coverage (share of the need's
 * categories it supplies) .35 · distance (1 − km / delivery radius) .25 · skor (Rapor score / 1000) .20 · pajak
 * (Pajak Rapi) .10 · kapasitas (min available / qty over the categories it supplies) .10.
 */
export function matchScore(s: WorldState, needId: string, bizId: string): { score: number; parts: MatchParts } {
  const n = s.catalogNeeds.byId[needId]
  const b = s.businesses.byId[bizId]
  if (!n || !b) return { score: 0, parts: { coverage: 0, distance: 0, skor: 0, pajak: 0, kapasitas: 0 } }
  const cats = [...new Set(n.items.map((i) => i.category))]
  const ours = cats.filter((c) => b.supplies.includes(c))
  const coverage = cats.length ? ours.length / cats.length : 0
  const distance = clamp(1 - needKm(s, n, b) / Math.max(1, b.capacity), 0, 1)
  const skor = (s.bizScores.byId[bizId]?.score ?? 0) / 1000
  const pajak = b.taxTidy ? 1 : 0
  let kapasitas = ours.length ? 1 : 0
  for (const c of ours) {
    const qty = n.items.filter((i) => i.category === c).reduce((a, i) => a + i.qty, 0)
    kapasitas = Math.min(kapasitas, qty > 0 ? Math.min(1, listingOf(s, bizId, c).qtyAvailable / qty) : 1)
  }
  const parts = { coverage: round(coverage, 2), distance: round(distance, 2), skor: round(skor, 2), pajak, kapasitas: round(kapasitas, 2) }
  const score = round(coverage * 0.35 + distance * 0.25 + skor * 0.2 + pajak * 0.1 + kapasitas * 0.1, 2)
  return { score, parts }
}

/** businesses that supply at least one of the need's categories */
export function suppliersOf(s: WorldState, n: CatalogNeed): Business[] {
  const cats = new Set(n.items.map((i) => i.category))
  const out: Business[] = []
  for (const id of s.businesses.ids) {
    const b = s.businesses.byId[id]!
    if (b.supplies.some((c) => cats.has(c))) out.push(b)
  }
  return out
}

/** verified suppliers ranked by matchScore desc, id asc (THE order of the Katalog Lokal top list and Kenal Mitra's preview) */
export function rankVerified(s: WorldState, needId: string): { business: Business; score: number; parts: MatchParts }[] {
  const n = s.catalogNeeds.byId[needId]
  if (!n) return []
  return suppliersOf(s, n)
    .filter((b) => b.verified)
    .map((b) => ({ business: b, ...matchScore(s, needId, b.id) }))
    .sort((a, b) => b.score - a.score || a.business.id.localeCompare(b.business.id))
}

/** C36 / natural: the ≤ n verified businesses with score ≥ PD.matchMin not matched to the need yet */
export function newMatchesFor(s: WorldState, needId: string, n = 6): { businessId: string; score: number }[] {
  const taken = new Set<string>()
  for (const id of s.matches.ids) {
    const m = s.matches.byId[id]!
    if (m.needId === needId) taken.add(m.businessId)
  }
  return rankVerified(s, needId)
    .filter((r) => r.score >= PD.matchMin && !taken.has(r.business.id))
    .slice(0, n)
    .map((r) => ({ businessId: r.business.id, score: r.score }))
}
