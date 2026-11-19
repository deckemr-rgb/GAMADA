/**
 * world/pd/audit.ts — audit-log texts {id, en} + entity refs of the PD natural types (boot module: need, match, paid);
 * every other PD type is described by audit-chains.ts (chains module).
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from '../types'
import { fmtRp, ref } from '../util'
import { describeKatalog } from '../reducers-katalog'

type D = { summary: Bi; refs: EntityRef[] } | null
const code = (s: WorldState, orderId: string) => s.orders.byId[orderId]?.code ?? orderId

export function describePdBoot(e: AnyWorldEvent, s: WorldState): D {
  switch (e.type) {
    case 'need.created':
    case 'match.made':
      return describeKatalog(e, s)
    case 'order.paid': {
      const o = s.orders.byId[e.payload.orderId]
      return {
        summary: { id: `Pesanan ${code(s, e.payload.orderId)} dibayar: transfer dari Kas Daerah ${fmtRp(e.payload.amount)} (simulasi)`, en: `Order ${code(s, e.payload.orderId)} paid: regional treasury transfer ${fmtRp(e.payload.amount)} (simulated)` },
        refs: [ref('orders', e.payload.orderId), ...(o ? [ref('businesses', o.businessId)] : []), ...(o?.needId ? [ref('catalogNeeds', o.needId)] : [])],
      }
    }
  }
  return null
}

