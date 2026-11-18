/**
 * world/reactions-core.ts — the reactions of the core event types (see reducers-core.ts) and the helpers every
 * reaction uses. reactions.ts places R_* at their original positions in REACTIONS, so the full pipeline runs them in
 * the same order as before; the core pipeline runs CORE_REACTIONS (every reaction on a core type except Radar Isu's
 * rumor burst, which only acts on a post that carries a `rumor` — engine-scope.ts sends those to the full pipeline).
 */
import type { AnyFollowUp, ComplaintCluster, EventType, FollowUp, WorldEvent, WorldState } from './types'
import { computeScore } from './score'
import { DAY_MIN, WORLD, distanceKm, rows } from './util'
export interface Reaction {
  /** stable name (tests, debugging) */
  id: string
  on: EventType
  run(e: WorldEvent, s: WorldState): AnyFollowUp[]
}

/** typed helper: `e.payload` is narrowed to the event's payload */
export function react<K extends EventType>(id: string, on: K, run: (e: WorldEvent<K>, s: WorldState) => AnyFollowUp[]): Reaction {
  return { id, on, run: run as (e: WorldEvent, s: WorldState) => AnyFollowUp[] }
}
export const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp

/** business score follow-up when the derived score actually moved */
export function rescore(s: WorldState, businessId: string, reason: { id: string; en: string }): AnyFollowUp[] {
  const prev = s.bizScores.byId[businessId]
  const next = computeScore(s, businessId)
  if (!prev || !next) return []
  const delta = next.score - prev.score
  if (delta === 0) return []
  return [fu('score.updated', { businessId, score: next.score, delta, reason, factors: next.factors }, 'rapor-usaha')]
}

export const R_FLOOD_CLUSTER = react('flood-complaints→cluster', 'complaint.created', (e, s) => {
    const p = e.payload
    if (p.category !== 'banjir' || !p.id) return []
    const today = Math.floor(e.at / DAY_MIN) * DAY_MIN
    // join an existing cluster close by (updated today)
    const near: ComplaintCluster | undefined = rows(s.clusters).find((c) => c.category === 'banjir' && c.updatedAt >= today && distanceKm(c.center, p.coord) <= WORLD.clusterRadiusKm)
    if (near) {
      if (near.complaintIds.includes(p.id)) return []
      return [fu('complaint.clustered', { clusterId: near.id, category: 'banjir', kecamatanId: near.kecamatanId, desaId: near.desaId, center: near.center, radiusKm: near.radiusKm, complaintIds: [p.id] }, 'sapa-warga')]
    }
    const similar = rows(s.complaints).filter((c) => c.category === 'banjir' && !c.clusterId && c.at >= today && c.at <= e.at && distanceKm(c.coord, p.coord) <= WORLD.clusterRadiusKm)
    if (similar.length < WORLD.clusterMin) return []
    const ids = similar.map((c) => c.id).sort()
    return [fu('complaint.clustered', { category: 'banjir', kecamatanId: p.kecamatanId, desaId: p.desaId, center: p.coord, radiusKm: WORLD.clusterRadiusKm, complaintIds: ids }, 'sapa-warga')]
})
export const R_SALE_LEDGER = react('sale→ledger', 'sale.created', (e, s) => {
    const sale = s.sales.byId[e.payload.id ?? '']
    if (!sale) return []
    let cost = 0
    for (const it of sale.items) cost += it.qty * (s.products.byId[it.productId]?.cost ?? 0)
    // cash goes to Kas, QRIS / transfer to Bank (split payments split the debit)
    const pays = sale.payments ?? [{ method: sale.payment, amount: sale.total }]
    const kas = pays.reduce((a, x) => a + (x.method === 'tunai' ? x.amount : 0), 0)
    const lines = [...(kas ? [{ account: 'Kas', debit: kas, credit: 0 }] : []), ...(sale.total - kas ? [{ account: 'Bank', debit: sale.total - kas, credit: 0 }] : []), { account: 'Pendapatan Penjualan', debit: 0, credit: sale.total }]
    if (cost > 0) lines.push({ account: 'HPP', debit: cost, credit: 0 }, { account: 'Persediaan', debit: 0, credit: cost })
    return [fu('ledger.posted', { businessId: sale.businessId, memo: { id: `Penjualan ${sale.code}`, en: `Sale ${sale.code}` }, lines, source: 'sale', refId: sale.id, needsReview: false, confidence: 0.99 }, 'pajak-beres')]
})
export const R_LEDGER_SCORE = react('ledger→score', 'ledger.posted', (e, s) => rescore(s, e.payload.businessId, { id: 'Pembukuan diperbarui', en: 'Bookkeeping updated' }))

export const CORE_REACTIONS: readonly Reaction[] = [R_FLOOD_CLUSTER, R_SALE_LEDGER, R_LEDGER_SCORE]
