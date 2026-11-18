/**
 * world/up/audit-up.ts — audit-log texts {id, en} + entity refs of the Usaha Pintar event types. The FIRST ref is
 * the entity a cross-product toast opens (`?focus=`), so it names what the receiving product shows.
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from '../types'
import { fmtRp, hhmm, ref } from '../util'
import { BRAND_TOPIC, TAX_KIND } from './labels'

const biz = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id
const rpBi = (n: number): Bi => ({ id: fmtRp(n), en: `Rp ${Math.round(n).toLocaleString('en-GB')}` })
const hmId = (m: number) => hhmm(m).replace(':', '.')
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function describeUp(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null {
  switch (e.type) {
    case 'po.drafted': {
      const sup = s.suppliers.byId[e.payload.supplierId]?.name ?? e.payload.supplierId
      return { summary: { id: `Draf ${e.payload.code} ke ${sup}: ${e.payload.items.length} barang`, en: `Draft ${e.payload.code} to ${sup}: ${e.payload.items.length} items` }, refs: [ref('purchaseOrders', e.payload.id ?? ''), ref('suppliers', e.payload.supplierId)] }
    }
    case 'po.received': {
      const po = s.purchaseOrders.byId[e.payload.poId]
      return { summary: { id: `Barang ${po?.code ?? e.payload.poId} diterima, stok bertambah`, en: `Goods for ${po?.code ?? e.payload.poId} received, stock up` }, refs: [ref('purchaseOrders', e.payload.poId)] }
    }
    case 'price.changed': {
      const p = s.products.byId[e.payload.productId]
      const a = rpBi(e.payload.prev)
      const b = rpBi(e.payload.price)
      return { summary: { id: `Harga ${p?.name ?? ''}: ${a.id} → ${b.id}`, en: `Price of ${p?.name ?? ''}: ${a.en} → ${b.en}` }, refs: [ref('products', e.payload.productId)] }
    }
    case 'promo.created':
      return { summary: { id: `Promo “${e.payload.title.id}” ${e.payload.discountPct}%`, en: `Promo “${e.payload.title.en}” ${e.payload.discountPct}%` }, refs: [ref('promos', e.payload.id ?? '')] }
    case 'shift.updated': {
      const st = s.staff.byId[e.payload.staffId]
      const d = ((e.payload.day % 7) + 7) % 7
      return { summary: { id: `Shift ${st?.name ?? ''} ${DAYS[d]} ${hmId(e.payload.start)}–${hmId(e.payload.end)}`, en: `Shift ${st?.name ?? ''} ${DAYS_EN[d]} ${hhmm(e.payload.start)}–${hhmm(e.payload.end)}` }, refs: [ref('shifts', e.payload.shiftId ?? ''), ref('staff', e.payload.staffId)] }
    }
    case 'shift.closed': {
      const st = s.staff.byId[e.payload.staffId]
      const v = e.payload.variance
      const vb = rpBi(Math.abs(v))
      return { summary: { id: `Tutup shift ${st?.name ?? ''}: ${e.payload.tx} transaksi, selisih ${v < 0 ? '−' : v > 0 ? '+' : ''}${vb.id}`, en: `Shift closed by ${st?.name ?? ''}: ${e.payload.tx} sales, difference ${v < 0 ? '−' : v > 0 ? '+' : ''}${vb.en}` }, refs: [ref('cashShifts', e.payload.id ?? ''), ref('staff', e.payload.staffId)] }
    }
    case 'pos.noticeSet':
      return { summary: { id: `Pengumuman tampil di kasir: “${e.payload.text.id.slice(0, 60)}”`, en: `Notice on the POS: “${e.payload.text.en.slice(0, 60)}”` }, refs: [ref('brandAnnouncements', e.payload.announcementId), ref('posNotices', e.payload.announcementId)] }
    case 'nota.received': {
      const po = s.purchaseOrders.byId[e.payload.poId]
      const sup = s.suppliers.byId[e.payload.supplierId]?.name ?? ''
      const t = rpBi(e.payload.total)
      return { summary: { id: `Nota ${sup} · ${po?.code ?? e.payload.poId} (${t.id}) masuk ke Pajak Beres`, en: `Invoice from ${sup} · ${po?.code ?? e.payload.poId} (${t.en}) reached Pajak Beres` }, refs: [ref('purchaseOrders', e.payload.poId)] }
    }
    case 'ledger.reviewed': {
      const j = s.ledger.byId[e.payload.ledgerId]
      return { summary: { id: `Jurnal ditinjau: ${j?.memo.id ?? e.payload.ledgerId}`, en: `Journal reviewed: ${j?.memo.en ?? e.payload.ledgerId}` }, refs: [ref('ledger', e.payload.ledgerId)] }
    }
    case 'bank.imported': {
      const p = e.payload
      return { summary: { id: `Mutasi ${p.bank} ${p.period}: ${p.rows} baris · ${p.matched} cocok · ${p.posted} dijurnal · ${p.review} ditinjau`, en: `${p.bank} statement ${p.period}: ${p.rows} rows · ${p.matched} matched · ${p.posted} posted · ${p.review} to review` }, refs: [ref('bankImports', p.id ?? ''), ref('businesses', p.businessId)] }
    }
    case 'tax.computed': {
      const t = s.taxItems.byId[e.payload.taxItemId]
      const k = TAX_KIND[t?.kind ?? 'pph-final-umkm']
      const a = rpBi(e.payload.amount)
      return { summary: { id: `${k.id} ${t?.period ?? ''} dihitung: ${a.id} (simulasi)`, en: `${k.en} ${t?.period ?? ''} computed: ${a.en} (simulated)` }, refs: [ref('taxItems', e.payload.taxItemId)] }
    }
    case 'period.locked':
      return { summary: { id: `Periode ${e.payload.period} dikunci konsultan (${biz(s, e.payload.businessId)})`, en: `Period ${e.payload.period} locked by the consultant (${biz(s, e.payload.businessId)})` }, refs: [ref('businesses', e.payload.businessId)] }
    case 'roleplay.completed': {
      const a = s.agentsSales.byId[e.payload.agentId]?.name ?? ''
      const d = e.payload.score - e.payload.baseline
      return { summary: { id: `Latihan ${a}: skor ${e.payload.score} (${d >= 0 ? '+' : ''}${d} dari baseline)`, en: `Roleplay by ${a}: score ${e.payload.score} (${d >= 0 ? '+' : ''}${d} vs baseline)` }, refs: [ref('roleplays', e.payload.id ?? ''), ref('agentsSales', e.payload.agentId)] }
    }
    case 'brand.alert': {
      const p = e.payload
      const at = p.at ?? e.at
      return {
        summary: { id: `Lonjakan keluhan ${BRAND_TOPIC[p.topic].id.toLowerCase()} +${p.deltaPct}% untuk ${biz(s, p.businessId)} (terdeteksi ${hmId(at)})`, en: `Spike in ${BRAND_TOPIC[p.topic].en.toLowerCase()} complaints +${p.deltaPct}% for ${biz(s, p.businessId)} (detected ${hhmm(at)})` },
        refs: [...(p.id ? [ref('brandAlerts', p.id)] : []), ref('businesses', p.businessId), ...(p.causeRef ? [p.causeRef] : [])],
      }
    }
    case 'brand.replied':
      return { summary: { id: `${e.payload.mentionIds.length} ulasan dibalas (nada ${e.payload.tone})`, en: `${e.payload.mentionIds.length} reviews answered (${e.payload.tone} tone)` }, refs: [...e.payload.mentionIds.slice(0, 8).map((id) => ref('brandMentions', id)), ...(e.payload.alertId ? [ref('brandAlerts', e.payload.alertId)] : [])] }
    case 'brand.announced':
      return { summary: { id: `Pengumuman layanan terbit di ${e.payload.channels.length} kanal`, en: `Service notice published on ${e.payload.channels.length} channels` }, refs: [ref('brandAnnouncements', e.payload.id ?? ''), ref('brandAlerts', e.payload.alertId)] }
    case 'procurement.bidReceived': {
      const pr = s.procurements.byId[e.payload.procurementId]
      const v = rpBi(e.payload.price)
      return { summary: { id: `Penawaran ${v.id} dari ${biz(s, e.payload.businessId)} masuk ke paket ${pr?.code ?? ''}`, en: `Bid of ${v.en} from ${biz(s, e.payload.businessId)} reached package ${pr?.code ?? ''}` }, refs: [ref('procurements', e.payload.procurementId), ref('bids', e.payload.bidId)] }
    }
  }
  return null
}
