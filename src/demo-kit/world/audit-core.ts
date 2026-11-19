/**
 * world/audit-core.ts — the audit-log summaries of the core event types (see reducers-core.ts): the small core
 * pipeline needs only these. audit.ts asks describeCore first, so both pipelines write the same text.
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from './types'
import { CATEGORY_LABEL } from './labels'
import { fmtRp, ref } from './util'

export const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const commodity = (s: WorldState, id: string): Bi => s.region.commodities.find((c) => c.id === id)?.name ?? { id, en: id }
export const marketName = (s: WorldState, id: string) => s.markets.byId[id]?.name ?? id
export const bizName = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id

/** the summary + entity refs of a core event; null for every other type (audit.ts describes those) */
export function describeCore(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null {
  switch (e.type) {
    case 'complaint.created': {
      const p = e.payload
      const c = CATEGORY_LABEL[p.category]
      return {
        summary: { id: `Aduan ${p.code} (${c.id}) dari Kec. ${kecName(s, p.kecamatanId)}`, en: `Complaint ${p.code} (${c.en}) from ${kecName(s, p.kecamatanId)}` },
        refs: [ref('complaints', p.id ?? ''), ref('tickets', p.ticketId ?? '')],
      }
    }
    case 'mention.created':
      return { summary: { id: `Mention baru: ${e.payload.outlet} (${e.payload.sentiment})`, en: `New mention: ${e.payload.outlet} (${e.payload.sentiment})` }, refs: [ref('mentions', e.payload.id ?? '')] }
    case 'price.updated': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Harga ${c.id} di ${marketName(s, e.payload.marketId)}: ${fmtRp(e.payload.price)}`, en: `${c.en} price at ${marketName(s, e.payload.marketId)}: ${fmtRp(e.payload.price)}` }, refs: [ref('prices', `${e.payload.marketId}:${e.payload.commodityId}`)] }
    }
    case 'sale.created': {
      const sale = s.sales.byId[e.payload.id ?? '']
      return { summary: { id: `Transaksi ${e.payload.code} · ${fmtRp(sale?.total ?? 0)} (${e.payload.payment.toUpperCase()})`, en: `Sale ${e.payload.code} · ${fmtRp(sale?.total ?? 0)} (${e.payload.payment.toUpperCase()})` }, refs: [ref('sales', e.payload.id ?? '')] }
    }
    case 'ledger.posted': {
      // the entry's amount, not its debit sum: a sale also books HPP/Persediaan, which must not inflate the total
      const total = e.payload.lines.reduce((a, l) => a + (l.account === 'HPP' ? 0 : l.debit), 0)
      return { summary: { id: `Jurnal: ${e.payload.memo.id} (${fmtRp(total)})`, en: `Journal: ${e.payload.memo.en} (${fmtRp(total)})` }, refs: [ref('ledger', e.payload.id ?? ''), ...(e.payload.refId ? [ref(e.payload.source === 'katalog' ? 'orders' : e.payload.source === 'pinjaman' ? 'loanApps' : 'sales', e.payload.refId)] : [])] }
    }
    case 'score.updated':
      return { summary: { id: `Skor usaha ${bizName(s, e.payload.businessId)}: ${e.payload.score} (${e.payload.delta > 0 ? '+' : ''}${e.payload.delta})`, en: `Business score ${bizName(s, e.payload.businessId)}: ${e.payload.score} (${e.payload.delta > 0 ? '+' : ''}${e.payload.delta})` }, refs: [ref('bizScores', e.payload.businessId)] }
    case 'procurement.flagged': {
      const p = s.procurements.byId[e.payload.procurementId]
      return { summary: { id: `Paket ${p?.name.id ?? ''} ditandai berisiko (${e.payload.riskScore})`, en: `Package ${p?.name.en ?? ''} flagged as risky (${e.payload.riskScore})` }, refs: [ref('procurements', e.payload.procurementId)] }
    }
  }
  return null
}
