/**
 * world/up/toko.ts — Toko Autopilot selectors (KPI, receipts, POS catalog, demand forecast, stock risk, PO and price
 * suggestions, bundles, traffic, shifts, cashier shift). Every number is SIMULATED and computed from the world, so
 * the dashboard, Kasir, Prediksi and Pajak Beres agree. Time-keyed selectors are memoised per (params, tables).
 */
import type { Bi, PurchaseOrder, Sale, Shift, StockLevel, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { DAY_MIN, HOUR_RHYTHM, WORLD, isoDay, rows } from '../util'
import { FLOOD_TAGS, UP } from './config'
import { barcodeOf } from './shop'
import { omzetByMonth } from './books'
import { poLines } from './po'
import { activeFloodAlert } from './scenario-core'

/* ------------------------------------------------------------------ KPI + receipts */

export interface OutletKpi { revenue: number; tx: number; avgTicket: number; cost: number; grossMargin: number; vsYesterday: { revenue: number; tx: number; avgTicket: number; grossMargin: number } }
const kpiOf = (list: Sale[], costOf: (sale: Sale) => number, prev: Sale[]): OutletKpi => {
  const agg = (l: Sale[]) => {
    const revenue = l.reduce((a, x) => a + x.total, 0)
    const cost = l.reduce((a, x) => a + costOf(x), 0)
    return { revenue, tx: l.length, avgTicket: l.length ? Math.round(revenue / l.length) : 0, cost, grossMargin: revenue ? (revenue - cost) / revenue : 0 }
  }
  const a = agg(list)
  const b = agg(prev)
  const pct = (x: number, y: number) => (y ? (x - y) / y : 0)
  return { ...a, vsYesterday: { revenue: pct(a.revenue, b.revenue), tx: pct(a.tx, b.tx), avgTicket: pct(a.avgTicket, b.avgTicket), grossMargin: a.grossMargin - b.grossMargin } }
}
/**
 * Today until `now` vs yesterday until the same minute, total + per outlet (Dasbor KPI strip, outlet comparison;
 * Pajak Beres "Penjualan hari ini" = total.revenue). `month` = omzetByMonth of the demo month.
 */
export const outletKpis = createParamSelector((s) => [s.sales, s.products, s.outlets, s.salesDaily, s.meta] , (now: number, sales, products, outlets, salesDaily, meta) => {
  const costOf = (x: Sale) => x.items.reduce((a, it) => a + it.qty * (products.byId[it.productId]?.cost ?? 0), 0)
  const mine = rows(sales).filter((x) => x.businessId === meta.shopId)
  const today = mine.filter((x) => x.at >= 0 && x.at <= now)
  const yday = mine.filter((x) => x.at >= -DAY_MIN && x.at <= now - DAY_MIN)
  const byOutlet: Record<string, OutletKpi> = {}
  for (const id of outlets.ids) {
    const o = outlets.byId[id]
    if (!o || o.businessId !== meta.shopId) continue
    byOutlet[id] = kpiOf(today.filter((x) => x.outletId === id), costOf, yday.filter((x) => x.outletId === id))
  }
  const st = { sales, products, outlets, salesDaily, meta, day: WORLD.day } as unknown as WorldState
  const month = omzetByMonth(st, meta.shopId)[WORLD.day.slice(0, 7)] ?? 0
  return { total: kpiOf(today, costOf, yday), byOutlet, month }
})

/** the newest receipts until `now` (optionally one outlet) */
export function liveReceipts(s: WorldState, now: number, n: number, outletId?: string): Sale[] {
  const out: Sale[] = []
  for (const id of s.sales.ids) {
    const x = s.sales.byId[id]
    if (!x || x.businessId !== s.meta.shopId || x.at > now || x.at < 0) continue
    if (outletId && x.outletId !== outletId) continue
    out.push(x)
    if (out.length >= n) break
  }
  return out
}

/** best sellers over the last `days` days (units from the daily history + today's receipts) */
export function topProducts(s: WorldState, days: number, outletId?: string): { productId: string; name: string; units: number; revenue: number }[] {
  const today = new Map<string, number>()
  for (const x of rows(s.sales)) if (x.at >= 0 && x.businessId === s.meta.shopId) for (const it of x.items) today.set(it.productId, (today.get(it.productId) ?? 0) + it.qty)
  return rows(s.stock)
    .filter((st) => (!outletId || st.outletId === outletId) && !s.products.byId[st.productId]?.tags.includes('bahan'))
    .map((st) => {
      const p = s.products.byId[st.productId]!
      const units = st.history.slice(-days).reduce((a, b) => a + b, 0) + (today.get(st.id) ?? 0)
      return { productId: p.id, name: p.name, units, revenue: units * p.price }
    })
    .sort((a, b) => b.revenue - a.revenue || a.productId.localeCompare(b.productId))
    .slice(0, 10)
}

/* ------------------------------------------------------------------ POS */

export interface PosItem { productId: string; sku: string; name: string; category: string; unit: string; price: number; cost: number; onHand: number; barcode: string; promoPct: number }
/** sellable SKUs of an outlet (Kasir grid), price = current price, stock badge = stock.onHand */
export const posCatalog = createParamSelector((s) => [s.products, s.stock, s.promos], (outletId: string, products, stock, promos): PosItem[] => {
  const promo = new Map<string, number>()
  for (const p of rows(promos)) for (const id of p.productIds) promo.set(id, Math.max(promo.get(id) ?? 0, p.discountPct))
  return rows(products)
    .filter((p) => p.outletId === outletId && !p.tags.includes('bahan'))
    .map((p) => ({ productId: p.id, sku: p.sku, name: p.name, category: p.category, unit: p.unit, price: p.price, cost: p.cost, onHand: stock.byId[p.id]?.onHand ?? 0, barcode: barcodeOf(p), promoPct: promo.get(p.id) ?? 0 }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
})
export function findByBarcode(s: WorldState, code: string): string | null {
  const c = code.trim()
  for (const id of s.products.ids) {
    const p = s.products.byId[id]
    if (p && (barcodeOf(p) === c || p.sku === c)) return p.id
  }
  return null
}

/* ------------------------------------------------------------------ forecast + stock risk */

const isFlood = (tags: string[]) => tags.some((t) => FLOOD_TAGS.includes(t))
export type FactorKey = 'musim' | 'gajian' | 'banjir' | 'promo' | 'harga'
export interface DemandForecast {
  productId: string
  /** units per day, oldest → newest (last 30 days, excluding today) */
  history30: number[]
  /** 14 days from today */
  forecast14: number[]
  lo: number[]
  hi: number[]
  factors: { key: FactorKey; pct: number; label: Bi; cause?: string }[]
  daysLeft: number
}
const LABEL: Record<FactorKey, Bi> = {
  musim: { id: 'Musim hujan', en: 'Rainy season' }, gajian: { id: 'Tanggal gajian', en: 'Payday' }, banjir: { id: 'Peringatan banjir', en: 'Flood warning' },
  promo: { id: 'Promo berjalan', en: 'Running promo' }, harga: { id: 'Harga pasar naik', en: 'Market price up' },
}
/** 30-day history + 14-day forecast with band and factor chips (SIMULATED): the flood factor is the reaction's 4.4 */
const forecastSel = createParamSelector((s) => [s.stock, s.products, s.promos, s.alerts, s.day], (key: string, stock, products, promos, alerts, day): DemandForecast | null => {
  const [productId] = key.split('|')
  const st = stock.byId[productId ?? '']
  const p = products.byId[productId ?? '']
  if (!st || !p) return null
  const flood = isFlood(p.tags)
  const floodOn = flood && st.factor > 1 && rows(alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')
  const priceOn = !floodOn && st.factor > 1 && p.tags.some((t) => t.startsWith('cm:'))
  const promoPct = rows(promos).filter((x) => x.productIds.includes(p.id)).reduce((a, x) => Math.max(a, x.discountPct), 0)
  const factors: DemandForecast['factors'] = []
  if (flood) factors.push({ key: 'musim', pct: 30, label: LABEL.musim })
  if (floodOn) factors.push({ key: 'banjir', pct: Math.round((st.factor - 1) * 100), label: LABEL.banjir, cause: 'alerts' })
  if (priceOn) factors.push({ key: 'harga', pct: Math.round((st.factor - 1) * 100), label: LABEL.harga, cause: 'prices' })
  if (promoPct) factors.push({ key: 'promo', pct: Math.round(promoPct * 1.5), label: LABEL.promo })
  const forecast14: number[] = []
  const lo: number[] = []
  const hi: number[] = []
  let pay = false
  for (let d = 0; d < 14; d++) {
    const dt = new Date(`${isoDay(day, d)}T00:00:00Z`)
    const dow = dt.getUTCDay()
    const dom = dt.getUTCDate()
    const payday = dom >= 25 || dom <= 3
    pay ||= payday
    const fnb = p.category === 'minuman' || p.category === 'makanan'
    const week = fnb ? (dow === 0 || dow === 6 ? 1.22 : 1) : dow === 0 ? 0.55 : dow === 6 ? 1.15 : 1
    const v = st.baseDaily * st.factor * week * (payday ? 1.14 : 1) * (1 + (promoPct * 1.5) / 100) * (flood ? 1.3 : 1)
    const band = 0.15 + 0.03 * d
    forecast14.push(Math.round(v * 10) / 10)
    lo.push(Math.max(0, Math.round(v * (1 - band) * 10) / 10))
    hi.push(Math.round(v * (1 + band) * 10) / 10)
  }
  if (pay) factors.push({ key: 'gajian', pct: 14, label: LABEL.gajian })
  const demand = st.baseDaily * st.factor * (flood ? 1.3 : 1)
  return { productId: p.id, history30: st.history.slice(-30), forecast14, lo, hi, factors, daysLeft: demand > 0 ? Math.round((st.onHand / demand) * 10) / 10 : Infinity }
})
export const demandForecast = (s: WorldState, productId: string, now: number): DemandForecast | null => forecastSel(s, `${productId}|${Math.floor(now / DAY_MIN)}`)

export interface StockRiskRow { productId: string; name: string; onHand: number; reorderPoint: number; daysLeft: number; factor: number; flood: boolean; reason: Bi | null }
/** "habis dalam X hari": SKUs of an outlet by days left; flood goods first while a flood alert is active */
const riskSel = createParamSelector((s) => [s.stock, s.products, s.alerts], (outletId: string, stock, products, alerts): StockRiskRow[] => {
  const floodOn = rows(alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')
  return rows(stock)
    .filter((st) => (outletId === 'semua' || st.outletId === outletId) && !products.byId[st.productId]?.tags.includes('bahan'))
    .map((st) => {
      const p = products.byId[st.productId]!
      const flood = isFlood(p.tags)
      const demand = st.baseDaily * st.factor * (flood ? 1.3 : 1)
      return { productId: p.id, name: p.name, onHand: st.onHand, reorderPoint: st.reorderPoint, daysLeft: demand > 0 ? Math.round((st.onHand / demand) * 10) / 10 : 99, factor: st.factor, flood, reason: st.reason }
    })
    .filter((r) => r.daysLeft < 14 || r.onHand <= r.reorderPoint)
    .sort((a, b) => (floodOn ? Number(b.flood && b.factor > 1) - Number(a.flood && a.factor > 1) : 0) || a.daysLeft - b.daysLeft || a.productId.localeCompare(b.productId))
})
/** `outletId` = an outlet id or 'semua'; `now` keeps the call shape of the other time-keyed selectors */
export const stockRisk = (s: WorldState, outletId: string, now?: number): StockRiskRow[] => {
  void now
  return riskSel(s, outletId)
}

/** the peach banner after a flood alert: text = the reaction's reason, factor 4.4 (null without an active alert) */
export function floodBanner(s: WorldState): { text: Bi; factor: number; pct: number; alertId: string; productIds: string[] } | null {
  const alert = activeFloodAlert(s)
  if (!alert) return null
  const ids = s.stock.ids.filter((id) => {
    const st = s.stock.byId[id]
    return !!st && st.factor > 1 && isFlood(s.products.byId[id]?.tags ?? [])
  })
  const st = ids.length ? s.stock.byId[ids[0]!] : undefined
  if (!st || !st.reason) return null
  return { text: st.reason, factor: st.factor, pct: Math.round((st.factor - 1) * 100), alertId: alert.id, productIds: ids }
}

/* ------------------------------------------------------------------ purchase orders */

export interface PoSuggestion {
  /** the draft PO (null = a new suggestion for low stock without a draft) */
  poId: string | null
  code: string | null
  supplierId: string
  supplierName: string
  leadDays: number
  reason: Bi | null
  items: { productId: string; name: string; unit: string; qty: number; cost: number; shortfall: number; daily: number; onHand: number; why: Bi }[]
  total: number
}
const why = (daily: number, lead: number, onHand: number, qty: number, unit: string): Bi => ({
  id: `${Math.round(daily * 10) / 10}/hari × (${lead} + ${UP.safetyDays}) hari − stok ${onHand} = ${qty} ${unit}`,
  en: `${Math.round(daily * 10) / 10}/day × (${lead} + ${UP.safetyDays}) days − stock ${onHand} = ${qty} ${unit}`,
})
/** draft POs per supplier with the shortfall formula on every line (+ low-stock suppliers without a draft) */
const poSel = createParamSelector((s) => [s.purchaseOrders, s.stock, s.products, s.suppliers, s.meta.shopId], (_day: number, pos, stock, products, suppliers, shopId): PoSuggestion[] => {
  const st = { purchaseOrders: pos, stock, products, suppliers, meta: { shopId } } as unknown as WorldState
  const line = (productId: string, qty: number, lead: number) => {
    const p = products.byId[productId]!
    const sl = stock.byId[productId]
    const daily = (sl?.baseDaily ?? 0) * (sl?.factor ?? 1)
    const shortfall = Math.max(0, Math.ceil(daily * (lead + UP.safetyDays) - (sl?.onHand ?? 0)))
    return { productId, name: p.name, unit: p.unit, qty, cost: p.cost, shortfall, daily, onHand: sl?.onHand ?? 0, why: why(daily, lead, sl?.onHand ?? 0, qty, p.unit) }
  }
  const out: PoSuggestion[] = []
  const covered = new Set<string>()
  for (const po of rows(pos).filter((p: PurchaseOrder) => p.businessId === shopId && p.status === 'draf')) {
    const sup = suppliers.byId[po.supplierId]
    const lead = sup?.leadDays ?? 2
    const items = po.items.filter((it) => products.byId[it.productId]).map((it) => line(it.productId, it.qty, lead))
    for (const it of items) covered.add(it.productId)
    out.push({ poId: po.id, code: po.code, supplierId: po.supplierId, supplierName: sup?.name ?? po.supplierId, leadDays: lead, reason: po.reason ?? null, items, total: items.reduce((a, x) => a + x.qty * x.cost, 0) })
  }
  const open = new Set(rows(pos).filter((p) => p.status === 'terkirim' || p.status === 'dibalas').flatMap((p) => p.items.map((i) => i.productId)))
  const bySup = new Map<string, string[]>()
  for (const sl of rows(stock)) {
    const p = products.byId[sl.productId]
    if (!p || p.businessId !== shopId || !p.supplierId || covered.has(p.id) || open.has(p.id) || sl.onHand > sl.reorderPoint * sl.factor) continue
    bySup.set(p.supplierId, [...(bySup.get(p.supplierId) ?? []), p.id])
  }
  for (const [supplierId, ids] of bySup) {
    const sup = suppliers.byId[supplierId]
    const lead = sup?.leadDays ?? 2
    const items = poLines(st, ids, lead).map((l) => line(l.productId, l.qty, lead))
    if (items.length) out.push({ poId: null, code: null, supplierId, supplierName: sup?.name ?? supplierId, leadDays: lead, reason: null, items, total: items.reduce((a, x) => a + x.qty * x.cost, 0) })
  }
  return out.sort((a, b) => Number(!a.poId) - Number(!b.poId) || b.total - a.total)
})
export const poSuggestions = (s: WorldState, now: number): PoSuggestion[] => poSel(s, Math.floor(now / DAY_MIN))

/* ------------------------------------------------------------------ prices, bundles */

/** price elasticity per category (SIMULATED table): % units per % price */
export const ELASTICITY: Record<string, number> = {
  semen: -0.6, besi: -0.7, 'pasir-batu': -0.5, bata: -0.6, cat: -1.1, keramik: -1.0, pipa: -0.8, kayu: -0.7, atap: -0.8, listrik: -0.9, sanitasi: -1.0, paku: -0.4,
  kunci: -0.5, alat: -0.6, perlengkapan: -0.7, 'baja-ringan': -0.7, 'karung-pasir': -0.3, terpal: -0.4, pompa: -0.5, minuman: -1.2, makanan: -1.1,
}
export interface PriceSuggestion { id: string; productId: string; name: string; from: number; to: number; unitsDelta: number; marginDelta: number; locked?: Bi }
const LOCK: Bi = { id: 'Harga barang darurat tidak dinaikkan selama peringatan banjir', en: 'Emergency goods are not repriced upward during a flood warning' }
/** price ideas (SIMULATED elasticity): thin-margin best sellers up 3–5 %, slow movers with deep stock down 5 % */
export const priceSuggestions = createParamSelector((s) => [s.products, s.stock, s.alerts], (outletId: string, products, stock, alerts): PriceSuggestion[] => {
  const floodOn = rows(alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')
  const out: PriceSuggestion[] = []
  const list = rows(products).filter((p) => p.outletId === outletId && !p.tags.includes('bahan'))
  const scored = list.map((p) => {
    const st = stock.byId[p.id]
    const margin = p.price ? (p.price - p.cost) / p.price : 0
    return { p, st, margin, turnover: (st?.baseDaily ?? 0) * p.price }
  })
  const up = scored.filter((x) => x.margin < 0.2).sort((a, b) => b.turnover - a.turnover || a.p.id.localeCompare(b.p.id)).slice(0, 4)
  const down = scored.filter((x) => x.st && x.st.onHand > x.st.baseDaily * 30 && x.margin > 0.18).sort((a, b) => a.turnover - b.turnover || a.p.id.localeCompare(b.p.id)).slice(0, 2)
  const floods = scored.filter((x) => isFlood(x.p.tags)).sort((a, b) => b.turnover - a.turnover).slice(0, floodOn ? 2 : 0)
  const step = (price: number) => (price >= 100_000 ? 1000 : price >= 10_000 ? 500 : 100)
  for (const [x, pct] of [...up.map((x) => [x, x.margin < 0.14 ? 5 : 3] as const), ...down.map((x) => [x, -5] as const), ...floods.map((x) => [x, 4] as const)]) {
    const st = x.st
    const units = st?.baseDaily ?? 0
    const to = Math.round((x.p.price * (1 + pct / 100)) / step(x.p.price)) * step(x.p.price)
    const el = ELASTICITY[x.p.category] ?? -0.8
    const unitsDelta = Math.round(el * pct * 10) / 10
    const newUnits = units * (1 + unitsDelta / 100)
    const marginDelta = Math.round((to - x.p.cost) * newUnits - (x.p.price - x.p.cost) * units)
    const locked = floodOn && isFlood(x.p.tags) && to > x.p.price ? LOCK : undefined
    if (out.some((o) => o.productId === x.p.id)) continue
    out.push({ id: `${x.p.id}:${to}`, productId: x.p.id, name: x.p.name, from: x.p.price, to, unitsDelta, marginDelta, ...(locked ? { locked } : {}) })
  }
  return out
})

/** product pairs bought together (today + yesterday's receipts): bundle promo ideas */
export const bundleIdeas = createParamSelector((s) => [s.sales, s.products], (outletId: string, sales, products): { productIds: [string, string]; title: Bi; count: number; discountPct: number }[] => {
  const pairs = new Map<string, number>()
  for (const x of rows(sales)) {
    if (x.outletId !== outletId || x.items.length < 2) continue
    const ids = [...new Set(x.items.map((i) => i.productId))].sort()
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.set(`${ids[i]}|${ids[j]}`, (pairs.get(`${ids[i]}|${ids[j]}`) ?? 0) + 1)
  }
  return [...pairs]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([k, count]) => {
      const [a, b] = k.split('|') as [string, string]
      const na = products.byId[a]?.name ?? a
      const nb = products.byId[b]?.name ?? b
      return { productIds: [a, b], count, discountPct: 5, title: { id: `Paket ${na} + ${nb}`, en: `Bundle: ${na} + ${nb}` } }
    })
})

/* ------------------------------------------------------------------ traffic + shifts */

/** expected customers per hour, 7 days (Mon..Sun) × 24 h (SIMULATED from the outlet's receipts and the day rhythm);
 *  flood days (an active alert) raise the toko's traffic */
export const hourlyTraffic = createParamSelector((s) => [s.salesDaily, s.outlets, s.alerts], (outletId: string, salesDaily, outlets, alerts): number[][] => {
  const o = outlets.byId[outletId]
  if (!o) return []
  let tx = 0
  let n = 0
  for (const d of rows(salesDaily)) if (d.outletId === outletId && d.day < 0 && d.day >= -28) {
    tx += d.tx
    n++
  }
  const perDay = n ? tx / n : 20
  const floodOn = o.kind === 'toko' && rows(alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')
  const open = (h: number) => h * 60 >= o.opensAt - 59 && h * 60 < o.closesAt
  const w = HOUR_RHYTHM.map((r, h) => (open(h) ? r : 0))
  const tot = w.reduce((a, b) => a + b, 0) || 1
  return Array.from({ length: 7 }, (_, day) => {
    const dayF = (o.kind === 'toko' ? (day === 6 ? 0.55 : day === 5 ? 1.15 : 1) : day >= 5 ? 1.22 : 1) * (floodOn && day <= 2 ? 1.35 : 1)
    return w.map((x) => Math.round(((perDay * dayF * x) / tot) * 10) / 10)
  })
})

export interface ExtraBlock { day: number; start: number; end: number; reason: Bi; job: 'kasir'; staffId: string | null }
/** the week plan of an outlet + the extra blocks the traffic asks for ("+1 kasir 13.00–17.00") */
const shiftSel = createParamSelector((s) => [s.shifts, s.staff, s.salesDaily, s.outlets, s.alerts], (key: string, shifts, staff, salesDaily, outlets, alerts): { blocks: Shift[]; extra: ExtraBlock[] } => {
  const [outletId] = key.split('|')
  const blocks = rows(shifts).filter((x) => x.outletId === outletId).sort((a, b) => a.day - b.day || a.start - b.start || a.id.localeCompare(b.id))
  const traffic = hourlyTraffic({ salesDaily, outlets, alerts } as unknown as WorldState, outletId ?? '')
  const extra: ExtraBlock[] = []
  const cashier = rows(staff).find((x) => x.outletId === outletId && x.job === 'kasir')
  traffic.forEach((hours, day) => {
    // the 4-hour window with the most customers per person on duty
    let best = { h: -1, load: 0 }
    for (let h = 0; h + 4 <= 24; h++) {
      let load = 0
      for (let k = h; k < h + 4; k++) {
        const onDuty = blocks.filter((b) => b.day === day && b.start <= k * 60 && b.end > k * 60).length || 1
        load += (hours[k] ?? 0) / onDuty
      }
      if (load > best.load) best = { h, load }
    }
    if (best.h >= 0 && best.load / 4 > 2.2) {
      const start = best.h * 60
      extra.push({
        day, start, end: start + 240, job: 'kasir', staffId: cashier?.id ?? null,
        reason: { id: `Antrean diperkirakan ${Math.round(best.load / 4)} pembeli per petugas per jam (simulasi)`, en: `Expected queue: ${Math.round(best.load / 4)} customers per person per hour (simulated)` },
      })
    }
  })
  extra.sort((a, b) => b.end - b.start - (a.end - a.start) || a.day - b.day)
  return { blocks, extra: extra.slice(0, 3) }
})
export const shiftPlan = (s: WorldState, outletId: string, now: number): { blocks: Shift[]; extra: ExtraBlock[] } => shiftSel(s, `${outletId}|${Math.floor(now / DAY_MIN)}`)

/** the cashier's open shift: float + cash taken since the shift started (Tutup shift: variance = counted − expected) */
export function cashierShift(s: WorldState, staffId: string, now: number): { staffId: string; outletId: string; start: number; tx: number; cashSales: number; expectedCash: number } | null {
  const st = s.staff.byId[staffId]
  if (!st) return null
  const dow = (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7
  const shift = rows(s.shifts).find((x) => x.staffId === staffId && x.day === dow)
  const start = shift?.start ?? 7 * 60
  let tx = 0
  let cash = 0
  for (const x of rows(s.sales)) {
    if (x.outletId !== st.outletId || x.at < start || x.at > now || (x.staffId && x.staffId !== staffId)) continue
    tx++
    cash += (x.payments ?? [{ method: x.payment, amount: x.total }]).reduce((a, p) => a + (p.method === 'tunai' ? p.amount : 0), 0)
  }
  return { staffId, outletId: st.outletId, start, tx, cashSales: cash, expectedCash: UP.cashFloat + cash }
}

/** stock row of a SKU (plain helper) */
export const stockOf = (s: WorldState, productId: string): StockLevel | undefined => s.stock.byId[productId]
