/**
 * world/pd/audit-chains.ts — audit-log texts of the Pasar Daerah user-action and chain types (chains module).
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from '../types'
import { fmtRp, ref } from '../util'
import { CONSENT_SCOPE } from './labels'
// (local copies of audit-core helpers: this module must not share a chunk boundary with the core pipeline)
const bizName = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id
const commodity = (s: WorldState, id: string): Bi => s.region.commodities.find((c) => c.id === id)?.name ?? { id, en: id }
const marketName = (s: WorldState, id: string) => s.markets.byId[id]?.name ?? id

type D = { summary: Bi; refs: EntityRef[] } | null
const code = (s: WorldState, orderId: string) => s.orders.byId[orderId]?.code ?? orderId

export function describePdChains(e: AnyWorldEvent, s: WorldState): D {
  switch (e.type) {
    case 'order.confirmed': {
      const o = s.orders.byId[e.payload.orderId]
      const part = o && o.items.some((it, i) => (e.payload.qtyConfirmed[i] ?? it.qty) < it.qty)
      const who = bizName(s, o?.businessId ?? '')
      return {
        summary: part
          ? { id: `Pesanan ${code(s, e.payload.orderId)} dikonfirmasi sebagian oleh ${who} (${fmtRp(o?.total ?? 0)}, kirim ${e.payload.etaDays} hari)`, en: `Order ${code(s, e.payload.orderId)} partly confirmed by ${who} (${fmtRp(o?.total ?? 0)}, ships in ${e.payload.etaDays} days)` }
          : { id: `Pesanan ${code(s, e.payload.orderId)} dikonfirmasi ${who} (kirim ${e.payload.etaDays} hari)`, en: `Order ${code(s, e.payload.orderId)} confirmed by ${who} (ships in ${e.payload.etaDays} days)` },
        refs: [ref('orders', e.payload.orderId), ...(o ? [ref('businesses', o.businessId)] : [])],
      }
    }
    case 'order.shipped': {
      const o = s.orders.byId[e.payload.orderId]
      return { summary: { id: `Pesanan ${code(s, e.payload.orderId)} dikirim ${bizName(s, o?.businessId ?? '')}`, en: `Order ${code(s, e.payload.orderId)} shipped by ${bizName(s, o?.businessId ?? '')}` }, refs: [ref('orders', e.payload.orderId), ...(o ? [ref('businesses', o.businessId)] : [])] }
    }
    case 'consent.granted': {
      const sc = e.payload.scopes.map((k) => CONSENT_SCOPE[k])
      return {
        summary: { id: `${bizName(s, e.payload.businessId)} membagikan ${sc.map((x) => x.id.toLowerCase()).join(', ')} ke ${e.payload.lender} (${e.payload.days} hari)`, en: `${bizName(s, e.payload.businessId)} shares ${sc.map((x) => x.en.toLowerCase()).join(', ')} with ${e.payload.lender} (${e.payload.days} days)` },
        refs: [ref('consents', e.payload.id ?? ''), ref('businesses', e.payload.businessId)],
      }
    }
    case 'consent.revoked': {
      const c = s.consents.byId[e.payload.consentId]
      return { summary: { id: `Akses data ${c?.lender ?? ''} dicabut oleh ${bizName(s, c?.businessId ?? '')}`, en: `${bizName(s, c?.businessId ?? '')} revoked ${c?.lender ?? ''}'s data access` }, refs: [ref('consents', e.payload.consentId), ...(c ? [ref('businesses', c.businessId)] : [])] }
    }
    case 'loan.rejected': {
      const l = s.loanApps.byId[e.payload.loanId]
      return { summary: { id: `Pengajuan modal ${e.payload.loanId} ditolak: ${e.payload.reason.id}`, en: `Loan ${e.payload.loanId} declined: ${e.payload.reason.en}` }, refs: [ref('loanApps', e.payload.loanId), ...(l ? [ref('businesses', l.businessId)] : [])] }
    }
    case 'price.subscribed': {
      const sub = Object.values(s.priceSubs.byId).find((x) => x.businessId === e.payload.businessId)
      const items = e.payload.commodityIds.map((c) => commodity(s, c))
      return {
        summary: { id: `${bizName(s, e.payload.businessId)} berlangganan peringatan harga ${items.map((x) => x.id.toLowerCase()).join(', ')} (ambang ${e.payload.thresholdPct}%)`, en: `${bizName(s, e.payload.businessId)} subscribed to price alerts for ${items.map((x) => x.en.toLowerCase()).join(', ')} (threshold ${e.payload.thresholdPct}%)` },
        refs: [ref('priceSubs', sub?.id ?? e.payload.id ?? ''), ref('businesses', e.payload.businessId)],
      }
    }
    case 'distributor.watched': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Disperindag memantau ${e.payload.distributorIds.length} distributor ${c.id.toLowerCase()}`, en: `Trade office watches ${e.payload.distributorIds.length} ${c.en.toLowerCase()} distributors` }, refs: [ref('distributorWatches', e.payload.id ?? '')] }
    }
    case 'econ.briefed':
      return { summary: { id: `Briefing ekonomi ${e.payload.month} diekspor (${e.payload.sections.length} bagian, ${e.payload.kecamatanIds.length} kecamatan)`, en: `Economic briefing ${e.payload.month} exported (${e.payload.sections.length} sections, ${e.payload.kecamatanIds.length} districts)` }, refs: [...e.payload.kecamatanIds.map((k) => ref('econIndex', `${k}:${e.payload.month}`)), ...e.payload.programIds.map((p) => ref('marketOps', p))] }
    case 'chat.read':
      return { summary: { id: `${e.payload.refs.length} percakapan ditandai dibaca di GAMADA Inti`, en: `${e.payload.refs.length} conversation(s) marked read in GAMADA Inti` }, refs: e.payload.refs }
    case 'price.shock': {
      const c = commodity(s, e.payload.commodityId)
      if (e.payload.damp != null)
        return { summary: { id: `Lonjakan ${c.id} diredam operasi pasar (−${Math.round(e.payload.damp * 100)}% dari puncak, simulasi)`, en: `${c.en} spike damped by the market operation (−${Math.round(e.payload.damp * 100)}% off the peak, simulated)` }, refs: [ref('priceShocks', e.payload.id ?? '')] }
      return {
        summary: { id: `Guncangan pasokan ${c.id} di ${e.payload.marketIds.map((m) => marketName(s, m)).join(', ')}: +${e.payload.pct}% di puncak (simulasi)`, en: `${c.en} supply shock at ${e.payload.marketIds.map((m) => marketName(s, m)).join(', ')}: +${e.payload.pct}% at the peak (simulated)` },
        refs: [ref('priceShocks', e.payload.id ?? ''), ...(e.payload.cause ? [e.payload.cause] : [])],
      }
    }
    case 'price.warning': {
      const c = commodity(s, e.payload.commodityId)
      const m = marketName(s, e.payload.marketIds[0] ?? '')
      const pct = Math.round(e.payload.peakPct)
      return { summary: { id: `Peringatan dini: ${c.id} di ${m} diperkirakan +${pct}% dalam ${e.payload.peakInDays} hari`, en: `Early warning: ${c.en} at ${m} expected +${pct}% within ${e.payload.peakInDays} days` }, refs: [ref('priceWarnings', e.payload.id ?? ''), ref('priceShocks', e.payload.shockId), e.payload.cause] }
    }
    case 'price.alertSent': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Peringatan stok ${c.id.toLowerCase()} lebih awal untuk ${bizName(s, e.payload.businessId)}`, en: `Early ${c.en.toLowerCase()} stock alert for ${bizName(s, e.payload.businessId)}` }, refs: [ref('priceAlerts', e.payload.id ?? ''), ref('businesses', e.payload.businessId), ref('priceWarnings', e.payload.warningId)] }
    }
  }
  return null
}
