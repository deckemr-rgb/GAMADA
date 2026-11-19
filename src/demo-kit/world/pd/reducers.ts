/**
 * world/pd/reducers.ts — the boot module's reducers (the natural events: need.created / match.made = the SAME functions
 * as the full pipeline, world/reducers-katalog.ts; order.paid) + the id fields of EVERY PD type (ids are assigned at
 * emit time, before the chains module may have arrived). The other PD reducers: reducers-chains.ts.
 */
import type { EventType, TableKey, WorldEvent, WorldState } from '../types'
import { patch, rows } from '../util'
import { reduceMatch, reduceNeed } from '../reducers-katalog'

type R<K extends EventType> = (s: WorldState, e: WorldEvent<K>) => WorldState

export const PD_REDUCERS: { [K in EventType]?: R<K> } = {
  'need.created': reduceNeed,
  'match.made': reduceMatch,
  'order.paid': (s, e) => {
    const o = s.orders.byId[e.payload.orderId]
    if (!o) return s
    let next: WorldState = { ...s, orders: patch(s.orders, o.id, (x) => ({ ...x, status: 'dibayar', paidAt: e.at })) }
    if (o.needId) {
      const all = rows(next.orders).filter((x) => x.needId === o.needId)
      if (all.every((x) => x.status === 'dibayar')) next = { ...next, catalogNeeds: patch(next.catalogNeeds, o.needId, (n) => ({ ...n, status: 'selesai' })) }
    }
    return next
  },
}

export const PD_ID_FIELDS: { [K in EventType]?: [string, TableKey, boolean?][] } = {
  'consent.granted': [['id', 'consents']],
  'price.shock': [['id', 'priceShocks']],
  'price.warning': [['id', 'priceWarnings']],
  'price.subscribed': [['id', 'priceSubs']],
  'price.alertSent': [['id', 'priceAlerts']],
  'distributor.watched': [['id', 'distributorWatches']],
}
