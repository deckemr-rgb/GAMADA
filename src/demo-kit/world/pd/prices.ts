/**
 * world/pd/prices.ts — Sinyal Pasar selectors (SIMULATED prices on real markets × commodities; no official reference
 * price). Δ vs musiman = vs `seasonalBand().expected`; 7-day Δ = `weekChangeOf` everywhere; "Anomali aktif" = the
 * count of `PricePoint.anomaly`; the forecast is `priceOutlook`, the operation model `opSimulate` (forecast.ts).
 */
import type { Bi, MarketOperation, PriceAlert, PriceSub, PriceWarning, WorldState } from '../types'
import type { RoleId } from '../../../content/products'
import { hashString } from '../prng'
import { createParamSelector } from '../selectors'
import { DAY_MIN, round, rows } from '../util'
import { weekChangeOf } from '../price-math'
import { PD } from './config'
import { OP_STAGE } from './labels'
import { seasonalBand } from './forecast'
import { DIST_TAIL, DIST_WORDS } from './texts'

export { weekChangeOf } from '../price-math'
export { seasonalBand, shockPath, priceOutlook, opSimulate, type Outlook, type OpPlan, type Band } from './forecast'

export interface BoardRow {
  id: string; marketId: string; commodityId: string; price: number; weekPct: number; deltaPct: number; expected: number; anomaly: boolean; warning: PriceWarning | null; spark14: number[]
}
const today0 = (now: number) => Math.floor(now / DAY_MIN) * DAY_MIN
/** the price board (sorted by |Δ vs musiman| desc, id asc); filters `commodity` / `market` ('' = all) */
export const priceBoard = (s: WorldState, now: number, f: { commodity?: string; market?: string } = {}): BoardRow[] => boardSel(s, `${f.commodity ?? ''}|${f.market ?? ''}|${Math.floor(now / DAY_MIN)}`)
const boardSel = createParamSelector((s) => [s.prices, s.priceWarnings], (key: string, prices, warnings): BoardRow[] => {
  const [commodity, market, day] = key.split('|')
  const d0 = Number(day) * DAY_MIN
  const warn = rows(warnings).filter((w) => w.at >= d0)
  const out: BoardRow[] = []
  for (const id of prices.ids) {
    const p = prices.byId[id]!
    if ((commodity && p.commodityId !== commodity) || (market && p.marketId !== market)) continue
    const b = seasonalBand(p)
    out.push({
      id, marketId: p.marketId, commodityId: p.commodityId, price: p.price, weekPct: round(weekChangeOf(p.price, p.history) * 100, 1), deltaPct: round((p.price / b.expected - 1) * 100, 1), expected: b.expected,
      anomaly: p.anomaly, warning: warn.find((w) => w.commodityId === p.commodityId && w.marketIds.includes(p.marketId)) ?? null, spark14: [...p.history.slice(-13), p.price],
    })
  }
  return out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || a.id.localeCompare(b.id))
})

/** the ticker: the 12 market × commodity pairs with the largest |7-day Δ| */
export const priceTicker = createParamSelector((s) => [s.prices], (_k: number, prices) =>
  rows(prices)
    .map((p) => ({ id: p.id, marketId: p.marketId, commodityId: p.commodityId, price: p.price, weekPct: round(weekChangeOf(p.price, p.history) * 100, 1), anomaly: p.anomaly }))
    .sort((a, b) => Math.abs(b.weekPct) - Math.abs(a.weekPct) || a.id.localeCompare(b.id))
    .slice(0, 12),
)

/** regional mean of a commodity over the last `days` closes + today, index 100 = the series mean (= Indeks Ekonomi Harga) */
export const commodityIndex = (s: WorldState, commodityId: string, days = 30): { values: number[]; raw: number[] } => indexSel(s, `${commodityId}|${days}`)
const indexSel = createParamSelector((s) => [s.prices], (key: string, prices) => {
  const [commodityId, d] = key.split('|')
  const days = Number(d)
  const list = rows(prices).filter((p) => p.commodityId === commodityId)
  const raw = Array.from({ length: days + 1 }, (_, k) => {
    const vals = list.map((p) => (k === days ? p.price : p.history[p.history.length - days + k] ?? p.price))
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0
  })
  const m = raw.reduce((a, v) => a + v, 0) / Math.max(1, raw.length)
  return { values: raw.map((v) => round((v / (m || 1)) * 100, 1)), raw: raw.map((v) => Math.round(v)) }
})

export interface OpView {
  op: MarketOperation; commodity: Bi; markets: string[]; stage: Bi; auto: boolean; canStart: boolean; endsAt: number | null; measured: boolean; approveBy: number | null
}
/** an operation for the Operasi tab: C13 suggestion ("Usulan otomatis") vs sent by Disperindag, start allowed once approved */
export function opView(s: WorldState, opId: string): OpView | null {
  const op = s.marketOps.byId[opId]
  if (!op) return null
  return {
    op, commodity: s.region.commodities.find((c) => c.id === op.commodityId)?.name ?? { id: op.commodityId, en: op.commodityId }, markets: op.marketIds.map((m) => s.markets.byId[m]?.name ?? m),
    stage: OP_STAGE[op.stage], auto: !op.sentBy, canStart: op.stage === 'approved', endsAt: op.startedAt != null ? op.startedAt + PD.opHours : null, measured: op.stage === 'done',
    approveBy: op.stage === 'recommended' && op.sentAt != null ? op.sentAt + PD.autoApproveMin : null,
  }
}

/** KPI strip "Data simulasi": commodities · markets · active anomalies · early warnings today · UMKM subscribers */
export const pdKpi = createParamSelector((s) => [s.prices, s.priceWarnings, s.priceSubs, s.region, s.meta.facts.pd], (now: number, prices, warnings, subs, region, pd) => {
  let anomalies = 0
  const markets = new Set<string>()
  for (const id of prices.ids) {
    const p = prices.byId[id]!
    markets.add(p.marketId)
    if (p.anomaly) anomalies++
  }
  return { commodities: region.commodities.length, markets: markets.size, anomalies, warnings: rows(warnings).filter((w) => w.at >= today0(now) && w.at <= now).length, subscribers: (pd?.subscriberCount ?? 0) + subs.ids.length }
})

export interface UmkmAlert { id: string; kind: 'peringatan' | 'anomali'; commodityId: string; marketId: string; pct: number; peakInDays: number | null; text: Bi; advice: Bi; at: number; warningId: string | null; alert: PriceAlert | null }
/** a business's inbox: its early alerts (C32) + today's anomalies on the commodities it subscribed to, newest first */
export function alertsFor(s: WorldState, bizId: string, now: number): UmkmAlert[] {
  const out: UmkmAlert[] = rows(s.priceAlerts)
    .filter((a) => a.businessId === bizId && a.at <= now)
    .map((a) => ({ id: a.id, kind: 'peringatan' as const, commodityId: a.commodityId, marketId: a.marketId, pct: a.peakPct, peakInDays: a.peakInDays, text: a.text, advice: a.advice, at: a.at, warningId: a.warningId, alert: a }))
  const sub = priceSubsOf(s, bizId)
  if (sub) {
    for (const id of s.prices.ids) {
      const p = s.prices.byId[id]!
      if (!p.anomaly || !sub.commodityIds.includes(p.commodityId) || p.updatedAt < today0(now)) continue
      const b = seasonalBand(p)
      const pct = round((p.price / b.expected - 1) * 100, 1)
      const c = s.region.commodities.find((x) => x.id === p.commodityId)?.name ?? { id: p.commodityId, en: p.commodityId }
      const m = s.markets.byId[p.marketId]?.name ?? p.marketId
      out.push({
        id: `anomali:${id}`, kind: 'anomali', commodityId: p.commodityId, marketId: p.marketId, pct, peakInDays: null, at: p.updatedAt, warningId: null, alert: null,
        text: { id: `Harga ${c.id} di ${m} sudah ${pct}% di atas pola (simulasi).`, en: `${c.en} at ${m} is already ${pct}% above its pattern (simulated).` },
        advice: { id: `Belanja ${c.id.toLowerCase()} secukupnya untuk 5–7 hari.`, en: `Buy ${c.en.toLowerCase()} for 5–7 days only.` },
      })
    }
  }
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/** the business's subscription row (null when none) */
export const priceSubsOf = (s: WorldState, bizId: string): PriceSub | null => rows(s.priceSubs).find((x) => x.businessId === bizId) ?? null

export interface Distributor { id: string; name: string; commodityId: string; kecamatanId: string; kecamatan: string; stockDays: number; watched: boolean }
/** 6 derived (fictional) distributors of a commodity, real kecamatan, stock days; `watched` from distributorWatches */
export function distributorsFor(s: WorldState, commodityId: string): Distributor[] {
  const watched = new Set(rows(s.distributorWatches).filter((w) => w.commodityId === commodityId).flatMap((w) => w.distributorIds))
  const kecs = [...s.region.kecamatan].sort((a, b) => a.id.localeCompare(b.id))
  const used = new Set<string>()
  return Array.from({ length: 6 }, (_, i) => {
    const h = hashString(`${s.seed}|${s.regionId}|dist|${commodityId}|${i}`)
    let name = ''
    for (let k = 0; k < 6 && (!name || used.has(name)); k++) {
      const legal = ['UD', 'CV', 'PT'][(h + k) % 3]!
      name = `${legal} ${DIST_WORDS[(h >>> 3) % DIST_WORDS.length]} ${DIST_WORDS[((h >>> 7) + i + k) % DIST_WORDS.length]} ${DIST_TAIL[(h >>> 11) % DIST_TAIL.length]}`
    }
    used.add(name)
    const kec = kecs[(h >>> 5) % Math.max(1, kecs.length)]!
    const id = `DS-${commodityId}-${i + 1}`
    return { id, name, commodityId, kecamatanId: kec.id, kecamatan: kec.name, stockDays: 2 + ((h >>> 13) % 9), watched: watched.has(id) }
  })
}

/** the business's market-ingredient SKU of a commodity (`cm:` tag; null without UP data) */
export function cmSkuFor(s: WorldState, bizId: string, commodityId: string): string | null {
  for (const id of s.products.ids) {
    const p = s.products.byId[id]!
    if (p.businessId === bizId && p.tags.includes(`cm:${commodityId}`)) return id
  }
  return null
}

/** roles that may act on prices (UI hint) */
export const PRICE_ROLES: readonly RoleId[] = ['disperindag', 'pemilik-toko']
