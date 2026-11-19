/**
 * world/pd/payloads.ts — event payload builders (plain): the natural need, its matches, an order on a need, the UMKM
 * PO draft from a price warning. Products emit them with their own slug as source.
 */
import type { EventMap, WorldState } from '../types'
import { ref, rows } from '../util'
import { offerFor } from './katalog'

export { naturalNeedPayload, matchPayloads } from './need'

/** an order of the business on the need: lines = what it supplies, unit = offerFor, qty = the need's (or `qty[i]`) */
export function orderPayload(s: WorldState, needId: string, bizId: string, qty?: number[]): EventMap['order.created'] | null {
  const offer = offerFor(s, needId, bizId)
  if (!offer.lines.length) return null
  return { needId, businessId: bizId, items: offer.lines.map((l, i) => ({ name: l.name, qty: qty?.[i] ?? l.qty, unit: l.unit, price: l.unitPrice, category: l.category })) }
}

/**
 * Sinyal Pasar UMKM side "Siapkan PO di Toko Autopilot": a draft PO for the business's market-ingredient SKU of the
 * warning's commodity, enough for ~6 days (never hoarding); null when an open draft PO already holds that SKU.
 */
export function umkmPoPayload(s: WorldState, bizId: string, warningId: string): EventMap['po.drafted'] | null {
  const w = s.priceWarnings.byId[warningId]
  if (!w) return null
  const p = rows(s.products).find((x) => x.businessId === bizId && x.tags.includes(`cm:${w.commodityId}`))
  if (!p || !p.supplierId) return null
  if (rows(s.purchaseOrders).some((po) => po.businessId === bizId && po.status === 'draf' && po.items.some((i) => i.productId === p.id))) return null
  const st = s.stock.byId[p.id]
  const need = Math.max(1, Math.ceil((st?.baseDaily ?? 1) * Math.max(1, st?.factor ?? 1) * 6 - (st?.onHand ?? 0)))
  const c = s.region.commodities.find((x) => x.id === w.commodityId)?.name ?? { id: w.commodityId, en: w.commodityId }
  return {
    businessId: bizId, supplierId: p.supplierId, items: [{ productId: p.id, qty: need, cost: p.cost }], cause: ref('priceWarnings', w.id),
    reason: { id: `Sinyal Pasar: ${c.id} diperkirakan naik ${Math.round(w.peakPct)}% dalam ${w.peakInDays} hari, stok untuk 6 hari`, en: `Sinyal Pasar: ${c.en} expected +${Math.round(w.peakPct)}% within ${w.peakInDays} days, stock for 6 days` },
  }
}
