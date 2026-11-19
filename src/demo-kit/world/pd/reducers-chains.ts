/**
 * world/pd/reducers-chains.ts — reducers of the Pasar Daerah user-action and chain types (chains module): order confirm /
 * ship, consents, loan rejection, price shock / warning / subscription / alert, distributor watch, briefing, chat.read.
 * The store gate loads the chains before any event a PD product emits (world/eco.ts), so they are always in time.
 */
import type { EventType, Order, StockLevel, WorldEvent, WorldState } from '../types'
import { DAY_MIN, patch, patchMany, rows, upsert } from '../util'

type R<K extends EventType> = (s: WorldState, e: WorldEvent<K>) => WorldState
const must = <T>(v: T | undefined | null, what: string): T => {
  if (v === undefined || v === null) throw new Error(`reducer: missing ${what}`)
  return v
}
const total = (o: Order, qty?: number[]) => o.items.reduce((a, it, i) => a + (qty?.[i] ?? it.qty) * it.price, 0)

export const PD_CHAIN_REDUCERS: { [K in EventType]?: R<K> } = {
  'order.confirmed': (s, e) => {
    const p = e.payload
    return { ...s, orders: patch(s.orders, p.orderId, (o) => ({ ...o, status: 'dikonfirmasi', confirmedQty: p.qtyConfirmed, etaDays: p.etaDays, confirmedAt: e.at, total: total(o, p.qtyConfirmed), ...(p.note ? { note: p.note } : {}) })) }
  },
  'order.shipped': (s, e) => {
    const o = s.orders.byId[e.payload.orderId]
    if (!o) return s
    let next: WorldState = { ...s, orders: patch(s.orders, o.id, (x) => ({ ...x, status: 'dikirim', shipAt: e.at })) }
    // the shop's stock leaves with the goods (Toko Autopilot onHand), when the UP data is there
    if (o.businessId === s.meta.shopId && s.meta.ext?.['usaha-pintar']) {
      const take = new Map<string, number>()
      o.items.forEach((it, i) => {
        if (!it.category) return
        let left = o.confirmedQty?.[i] ?? it.qty
        const list: StockLevel[] = []
        for (const id of s.stock.ids) {
          const st = s.stock.byId[id]!
          const pr = s.products.byId[st.productId]
          if (pr && pr.businessId === o.businessId && pr.category === it.category && !pr.tags.includes('bahan') && st.onHand > 0) list.push(st)
        }
        for (const st of list) {
          if (left <= 0) break
          const n = Math.min(left, st.onHand - (take.get(st.id) ?? 0))
          if (n <= 0) continue
          take.set(st.id, (take.get(st.id) ?? 0) + n)
          left -= n
        }
      })
      if (take.size) next = { ...next, stock: patchMany(next.stock, [...take.keys()], (st) => ({ ...st, onHand: Math.max(0, st.onHand - (take.get(st.id) ?? 0)), updatedAt: e.at })) }
    }
    return next
  },
  'consent.granted': (s, e) => {
    const p = e.payload
    return { ...s, consents: upsert(s.consents, { id: must(p.id, 'consent id'), businessId: p.businessId, lender: p.lender, scopes: p.scopes, days: p.days, at: e.at, until: e.at + p.days * DAY_MIN, revokedAt: null }) }
  },
  'consent.revoked': (s, e) => ({ ...s, consents: patch(s.consents, e.payload.consentId, (c) => (c.revokedAt === null ? { ...c, revokedAt: e.at } : c)) }),
  'loan.rejected': (s, e) => ({ ...s, loanApps: patch(s.loanApps, e.payload.loanId, (l) => ({ ...l, status: 'ditolak', reason: e.payload.reason, decidedAt: e.at })) }),
  'price.shock': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'shock id')
    if (s.priceShocks.byId[id]) return { ...s, priceShocks: patch(s.priceShocks, id, (x) => (p.damp != null && p.damp !== x.damp ? { ...x, damp: p.damp } : x)) }
    return { ...s, priceShocks: upsert(s.priceShocks, { id, commodityId: p.commodityId, marketIds: p.marketIds, startAt: p.startAt, peakDay: p.peakDay, pct: p.pct, damp: p.damp ?? 0, cause: p.cause, at: e.at }) }
  },
  'price.warning': (s, e) => {
    const p = e.payload
    return { ...s, priceWarnings: upsert(s.priceWarnings, { id: must(p.id, 'warning id'), shockId: p.shockId, commodityId: p.commodityId, marketIds: p.marketIds, peakInDays: p.peakInDays, peakPct: p.peakPct, expected: p.expected, at: e.at, cause: p.cause }) }
  },
  'price.subscribed': (s, e) => {
    const p = e.payload
    const prev = rows(s.priceSubs).find((x) => x.businessId === p.businessId)
    return { ...s, priceSubs: upsert(s.priceSubs, { id: prev?.id ?? must(p.id, 'subscription id'), businessId: p.businessId, commodityIds: p.commodityIds, channel: p.channel, thresholdPct: p.thresholdPct, at: e.at }) }
  },
  'price.alertSent': (s, e) => {
    const p = e.payload
    return { ...s, priceAlerts: upsert(s.priceAlerts, { id: must(p.id, 'alert id'), subId: p.subId, businessId: p.businessId, warningId: p.warningId, commodityId: p.commodityId, marketId: p.marketId, peakInDays: p.peakInDays, peakPct: p.peakPct, text: p.text, advice: p.advice, at: e.at }) }
  },
  'distributor.watched': (s, e) => {
    const p = e.payload
    return { ...s, distributorWatches: upsert(s.distributorWatches, { id: must(p.id, 'watch id'), commodityId: p.commodityId, distributorIds: p.distributorIds, by: p.by, at: e.at }) }
  },
  'econ.briefed': (s) => s,
  'chat.read': (s, e) => {
    const ids = (t: string) => e.payload.refs.filter((r) => r.startsWith(`${t}:`)).map((r) => r.slice(t.length + 1))
    let next = s
    const chats = ids('chats')
    if (chats.length) next = { ...next, chats: patchMany(next.chats, chats, (c) => (c.unread ? { ...c, unread: 0 } : c)) }
    const comps = ids('complaints')
    if (comps.length) next = { ...next, complaints: patchMany(next.complaints, comps, (c) => (c.readAt == null ? { ...c, readAt: e.at } : c)) }
    const calls = ids('calls')
    if (calls.length) next = { ...next, calls: patchMany(next.calls, calls, (c) => (c.readAt == null ? { ...c, readAt: e.at } : c)) }
    return next
  },
}
