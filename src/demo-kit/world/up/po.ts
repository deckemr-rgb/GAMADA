/**
 * world/up/po.ts — purchase-order helpers shared by the Toko Autopilot selectors and the chain reactions (no chain code
 * here, so a product's selectors do not pull the chains chunk): PO lines by the shortfall formula, the supplier reply.
 */
import type { Bi, POItem, WorldState } from '../types'
import { DAY_MIN, rows } from '../util'
import { FLOOD_TAGS, UP } from './config'
import { SUPPLIER_REPLY, fillBi } from './texts'

const isFloodGood = (s: WorldState, productId: string) => !!s.products.byId[productId]?.tags.some((t) => FLOOD_TAGS.includes(t))
/** the shop's PO an event refers to (null for another business) */
export const shopPo = (s: WorldState, poId: string) => {
  const po = s.purchaseOrders.byId[poId]
  return po && po.businessId === s.meta.shopId ? po : null
}
/** next 07:00 after minute `at` */
export const next0700 = (at: number) => (Math.floor((at - 7 * 60) / DAY_MIN) + 1) * DAY_MIN + 7 * 60
export const pctTxt = (factor: number) => `+${Math.round((factor - 1) * 100)}%`

/** pack size a PO quantity rounds up to */
export const packOf = (unit: string) => (/lembar|karung|sak|batang|pcs/.test(unit) ? 10 : 1)

/** the reply a supplier sends (least recently used of the pool across the last POs; entity fields filled) */
export function supplierReply(s: WorldState, poId: string): { message: Bi; eta: number; tpl: number } {
  const po = s.purchaseOrders.byId[poId]!
  const sup = s.suppliers.byId[po.supplierId]
  // the pool rotates: the reply after the latest one that used it (no text repeats within 20 POs)
  let last: { at: number; tpl: number } | null = null
  for (const p of rows(s.purchaseOrders)) if (p.reply?.tpl != null && p.id !== poId && (!last || p.reply.at > last.at)) last = { at: p.reply.at, tpl: p.reply.tpl }
  const idx = last ? (last.tpl + 1) % SUPPLIER_REPLY.length : 0
  const tpl = SUPPLIER_REPLY[idx]!
  const flood = po.items.some((it) => isFloodGood(s, it.productId))
  const eta = flood ? next0700(po.at) : po.at + (sup?.leadDays ?? 2) * DAY_MIN
  const etaTxt: Bi = flood ? { id: 'besok pukul 07.00', en: 'tomorrow at 07:00' } : { id: `dalam ${sup?.leadDays ?? 2} hari`, en: `in ${sup?.leadDays ?? 2} days` }
  const item = s.products.byId[po.items[0]?.productId ?? '']?.name ?? ''
  const m = { id: fillBi(tpl, { code: po.code, item, eta: etaTxt.id }).id, en: fillBi(tpl, { code: po.code, item, eta: etaTxt.en }).en }
  return { message: m, eta, tpl: idx }
}

/** PO lines for the given SKUs of one supplier: shortfall = demand × (lead + safety) − onHand, rounded up to the pack */
export function poLines(s: WorldState, productIds: string[], leadDays: number): (POItem & { shortfall: number; daysLeft: number })[] {
  const out: (POItem & { shortfall: number; daysLeft: number })[] = []
  for (const id of productIds) {
    const p = s.products.byId[id]
    const st = s.stock.byId[id]
    if (!p || !st) continue
    const demand = st.baseDaily * st.factor
    const shortfall = Math.ceil(demand * (leadDays + UP.safetyDays) - st.onHand)
    if (shortfall <= 0) continue
    const pk = packOf(p.unit)
    out.push({ productId: id, qty: Math.ceil(shortfall / pk) * pk, cost: p.cost, shortfall, daysLeft: demand > 0 ? Math.floor(st.onHand / demand) : 99 })
  }
  return out
}

