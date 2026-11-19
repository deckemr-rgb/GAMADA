/**
 * world/pd/katalog.ts — Katalog Lokal selectors (simulated catalog; no real national e-catalogue). THE badge source
 * (`badgesOf`), the shortlist (`catalogShortlist`, ranked by `matchScore`), offers (`offerFor`: the shop's bid /
 * TenderPilot advice / derived listing), KPIs, need and order views, the UMKM side.
 */
import type { Bi, Business, CatalogNeed, Match, Order, WorldState } from '../types'
import { createParamSelector, createSelector } from '../selectors'
import { rows } from '../util'
import { priceAdvice } from '../up/win-score'
import { CATEGORY_REF } from './config'
import { listingOf, matchScore, needKm, rankVerified, shopOnHand, suppliersOf, type MatchParts } from './match'

export { matchScore, listingOf, MATCH_WEIGHTS, type MatchParts, type Listing } from './match'

export interface Badges { verified: boolean; taxTidy: boolean; score: number | null; kybAt?: number }
/** THE badge source (Katalog Lokal cards, Rapor bank queue, Inti): Terverifikasi = KYB, Pajak Rapi, Skor = bizScores */
export function badgesOf(s: WorldState, bizId: string): Badges {
  const b = s.businesses.byId[bizId]
  const out: Badges = { verified: !!b?.verified, taxTidy: !!b?.taxTidy, score: s.bizScores.byId[bizId]?.score ?? null }
  if (b?.verified) {
    for (const id of s.verifications.ids) {
      const v = s.verifications.byId[id]!
      if (v.subjectId === bizId && v.kind === 'kyb' && v.result === 'lolos') {
        out.kybAt = v.at
        break
      }
    }
  }
  return out
}

export interface OfferLine { category: string; name: Bi; qty: number; unit: string; unitPrice: number; qtyAvailable: number }
export interface Offer { lines: OfferLine[]; total: number; source: 'bid' | 'saran' | 'katalog'; tenderId: string | null }

const tenderOfNeed = (s: WorldState, needId: string) => rows(s.tenders).find((t) => t.needId === needId)
/**
 * The business's offer on a need (simulasi): the shop with a bid on the need's tender ⇒ its bid price (chip
 * "Penawaran resmi via TenderPilot"); the shop without a bid ⇒ TenderPilot's suggested price (`priceAdvice`); others ⇒
 * their derived listing. Lines = the need items the business supplies; the shop's available = Toko Autopilot onHand.
 */
export function offerFor(s: WorldState, needId: string, bizId: string): Offer {
  const n = s.catalogNeeds.byId[needId]
  const b = s.businesses.byId[bizId]
  if (!n || !b) return { lines: [], total: 0, source: 'katalog', tenderId: null }
  const items = n.items.filter((i) => b.supplies.includes(i.category))
  const isShop = bizId === s.meta.shopId
  const t = isShop ? tenderOfNeed(s, needId) : undefined
  let ratio: number | null = null
  let source: Offer['source'] = 'katalog'
  if (t && t.items?.length) {
    const hps = t.hps ?? t.value
    const bid = rows(s.bids).filter((x) => x.tenderId === t.id && x.businessId === bizId && x.status !== 'draf').sort((x, y) => y.at - x.at)[0]
    if (bid && hps) {
      ratio = bid.price / hps
      source = 'bid'
    } else {
      const adv = priceAdvice(s, t.id, bizId)
      if (adv && hps) {
        ratio = adv.suggested / hps
        source = 'saran'
      }
    }
  }
  const lines = items.map((i): OfferLine => {
    const l = listingOf(s, bizId, i.category)
    const hpsUnit = t?.items?.find((x) => x.category === i.category)?.hpsPrice
    const unitPrice = ratio !== null && hpsUnit ? Math.round(hpsUnit * ratio) : l.unitPrice
    return { category: i.category, name: i.name, qty: i.qty, unit: i.unit, unitPrice, qtyAvailable: isShop ? shopOnHand(s, i.category) : l.qtyAvailable }
  })
  return { lines, total: lines.reduce((a, l) => a + l.unitPrice * l.qty, 0), source: ratio === null ? 'katalog' : source, tenderId: t?.id ?? null }
}

export interface Card { business: Business; km: number; score: number; parts: MatchParts; badges: Badges; offer: Offer; requestId?: string }
const openKybRequest = (s: WorldState, bizId: string): string | undefined =>
  rows(s.verificationRequests).find((r) => r.kind === 'kyb' && r.subjectId === bizId && r.status !== 'selesai')?.id

/** the shortlist of a need: `top` = verified only (≤ 6, matchScore desc, id asc); `waiting` = unverified suppliers in range */
export const catalogShortlist = createParamSelector(
  (s) => [s],
  (needId: string, s: WorldState): { top: Card[]; waiting: Card[] } => {
    const n = s.catalogNeeds.byId[needId]
    if (!n) return { top: [], waiting: [] }
    const card = (b: Business, score: number, parts: MatchParts): Card => {
      const req = b.verified ? undefined : openKybRequest(s, b.id)
      return { business: b, km: needKm(s, n, b), score, parts, badges: badgesOf(s, b.id), offer: offerFor(s, needId, b.id), ...(req ? { requestId: req } : {}) }
    }
    const top = rankVerified(s, needId).slice(0, 6).map((r) => card(r.business, r.score, r.parts))
    const hero = s.meta.facts.up?.kenalMitra.heroBusinessId
    const waiting = suppliersOf(s, n)
      .filter((b) => !b.verified && b.id !== s.meta.shopId && needKm(s, n, b) <= b.capacity)
      .map((b) => ({ b, ...matchScore(s, needId, b.id) }))
      .sort((a, b) => (a.b.id === hero ? -1 : b.b.id === hero ? 1 : 0) || b.score - a.score || a.b.id.localeCompare(b.b.id))
      .slice(0, 6)
      .map((x) => card(x.b, x.score, x.parts))
    return { top, waiting }
  },
)

/** ≤ 2 lines that split the first item the best card cannot cover alone (Compare "Pakai usulan bagi pesanan") */
export function splitSuggestion(s: WorldState, needId: string): { bizId: string; category: string; qty: number }[] {
  const n = s.catalogNeeds.byId[needId]
  if (!n) return []
  const top = catalogShortlist(s, needId).top
  for (const it of n.items) {
    const sup = top.filter((c) => c.business.supplies.includes(it.category))
    const first = sup[0]
    const avail = first?.offer.lines.find((l) => l.category === it.category)?.qtyAvailable ?? 0
    if (!first || avail >= it.qty || !sup[1]) continue
    return [{ bizId: first.business.id, category: it.category, qty: avail }, { bizId: sup[1].business.id, category: it.category, qty: it.qty - avail }]
  }
  return []
}

export { catalogKpi } from './kpi'

export type NeedTab = 'terbuka' | 'dipesan' | 'selesai'
/** needs of a list tab, newest first (terbuka = baru + dicocokkan) */
export const needList = (s: WorldState, now: number, status: NeedTab): CatalogNeed[] =>
  rows(s.catalogNeeds).filter((n) => n.at <= now && (status === 'terbuka' ? n.status === 'baru' || n.status === 'dicocokkan' : n.status === status)).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))

export interface NeedView {
  need: CatalogNeed
  source: 'siaga-wilayah' | 'awas-belanja' | 'ukpbj' | 'natural'
  sourceRef: string | null
  tenderId: string | null
  hps: number | null
  flags: { procurementId: string; pct: number; riskScore: number | null }[]
  matches: Match[]
  orders: Order[]
}
/** a need with its source chip, tender HPS, Awas Belanja flags, matches and orders */
export function needView(s: WorldState, needId: string): NeedView | null {
  const n = s.catalogNeeds.byId[needId]
  if (!n) return null
  const cause = n.cause ?? ''
  const source: NeedView['source'] = cause.startsWith('alerts:') ? 'siaga-wilayah' : cause.startsWith('procurements:') ? 'awas-belanja' : n.by === 'natural' ? 'natural' : 'ukpbj'
  const t = tenderOfNeed(s, needId)
  const procIds = [cause.startsWith('procurements:') ? cause.slice(13) : null, t?.procurementId ?? null].filter((x): x is string => !!x)
  const flags: NeedView['flags'] = []
  for (const pid of new Set(procIds)) {
    const p = s.procurements.byId[pid]
    if (!p?.flagged) continue
    const hps = p.items.reduce((a, i) => a + i.qty * i.hpsPrice, 0)
    const mkt = p.items.reduce((a, i) => a + i.qty * i.marketPrice, 0)
    flags.push({ procurementId: pid, pct: mkt ? Math.round((hps / mkt - 1) * 100) : 0, riskScore: p.riskScore })
  }
  return {
    need: n, source, sourceRef: cause || null, tenderId: t?.id ?? null, hps: t ? (t.hps ?? t.value) : null, flags,
    matches: rows(s.matches).filter((m) => m.needId === needId).sort((a, b) => b.score - a.score || a.businessId.localeCompare(b.businessId)),
    orders: ordersOf(s, { needId }),
  }
}

/** orders of a need and/or a business, newest first */
export const ordersOf = (s: WorldState, f: { needId?: string; bizId?: string }): Order[] =>
  rows(s.orders).filter((o) => (!f.needId || o.needId === f.needId) && (!f.bizId || o.businessId === f.bizId)).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))

/** the UMKM phone: its orders (newest first), `isNew` = still to confirm */
export const umkmInbox = (s: WorldState, bizId: string): (Order & { isNew: boolean; need: CatalogNeed | null })[] =>
  ordersOf(s, { bizId }).map((o) => ({ ...o, isNew: o.status === 'dipesan', need: o.needId ? s.catalogNeeds.byId[o.needId] ?? null : null }))

export interface StoreRow { category: string; name: Bi; unit: string; unitPrice: number; onHand: number; productId: string | null }
/** the UMKM's storefront: the shop = its toko SKUs of catalog categories (price, onHand); others = derived listings */
export const vendorStorefront = createParamSelector((s) => [s.businesses, s.products, s.stock, s], (bizId: string, businesses, products, stock, st): StoreRow[] => {
  const s = st as WorldState
  const b = businesses.byId[bizId]
  if (!b) return []
  if (bizId === s.meta.shopId) {
    const out: StoreRow[] = []
    for (const id of products.ids) {
      const p = products.byId[id]!
      if (p.businessId !== bizId || p.tags.includes('bahan') || !CATEGORY_REF[p.category] || !b.supplies.includes(p.category)) continue
      out.push({ category: p.category, name: { id: p.name, en: p.name }, unit: p.unit, unitPrice: p.price, onHand: stock.byId[id]?.onHand ?? 0, productId: id })
    }
    return out
  }
  return b.supplies.map((c) => {
    const l = listingOf(s, bizId, c)
    return { category: c, name: CATEGORY_REF[c]?.name ?? { id: c, en: c }, unit: l.unit, unitPrice: l.unitPrice, onHand: l.qtyAvailable, productId: null }
  })
})

/** the verified count Kenal Mitra shows (re-used, not recomputed) */
export const verifiedCount = createSelector((s) => [s.businesses], (t) => rows(t).filter((b) => b.verified).length)
