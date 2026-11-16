/**
 * world/audit.ts — the human summary {id, en} and entity references written to `auditLog` for every processed
 * event (GAMADA Inti → Audit Log and the "jejak data" trail). Runs AFTER the reducer, so it can read names.
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from './types'
import { CATEGORY_LABEL } from './catalog'
import { fmtRp, hhmm, ref } from './util'

const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
const commodity = (s: WorldState, id: string): Bi => s.region.commodities.find((c) => c.id === id)?.name ?? { id, en: id }
const marketName = (s: WorldState, id: string) => s.markets.byId[id]?.name ?? id
const bizName = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`

const TICKET_STATUS: Record<string, Bi> = {
  baru: { id: 'Baru', en: 'New' }, diverifikasi: { id: 'Diverifikasi', en: 'Verified' }, diteruskan: { id: 'Diteruskan ke OPD', en: 'Forwarded to agency' },
  diproses: { id: 'Diproses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Resolved' },
}

export function describe(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } {
  switch (e.type) {
    case 'complaint.created': {
      const p = e.payload
      const c = CATEGORY_LABEL[p.category]
      return {
        summary: { id: `Aduan ${p.code} (${c.id}) dari Kec. ${kecName(s, p.kecamatanId)}`, en: `Complaint ${p.code} (${c.en}) from ${kecName(s, p.kecamatanId)}` },
        refs: [ref('complaints', p.id ?? ''), ref('tickets', p.ticketId ?? '')],
      }
    }
    case 'complaint.clustered': {
      const cl = s.clusters.byId[e.payload.clusterId ?? '']
      const n = cl?.complaintIds.length ?? e.payload.complaintIds.length
      const desa = s.region.kecamatan.find((k) => k.id === e.payload.kecamatanId)?.desa.find((d) => d.id === e.payload.desaId)?.name ?? e.payload.desaId
      return {
        summary: { id: `Klaster ${CATEGORY_LABEL[e.payload.category].id.toLowerCase()} ${desa}: ${n} aduan → Meja Pimpinan & Siaga Wilayah`, en: `${CATEGORY_LABEL[e.payload.category].en} cluster in ${desa}: ${n} complaints → Meja Pimpinan & Siaga Wilayah` },
        refs: [ref('clusters', e.payload.clusterId ?? ''), ...e.payload.complaintIds.map((c) => ref('complaints', c))],
      }
    }
    case 'ticket.statusChanged': {
      const t = s.tickets.byId[e.payload.ticketId]
      const st = TICKET_STATUS[e.payload.status] ?? { id: e.payload.status, en: e.payload.status }
      return { summary: { id: `Tiket ${t?.code ?? e.payload.ticketId} → ${st.id}`, en: `Ticket ${t?.code ?? e.payload.ticketId} → ${st.en}` }, refs: [ref('tickets', e.payload.ticketId), ...(t ? [ref('complaints', t.complaintId)] : [])] }
    }
    case 'service.booked': {
      const sv = s.region.services.find((x) => x.id === e.payload.serviceId)?.name ?? { id: e.payload.serviceId, en: e.payload.serviceId }
      return { summary: { id: `Antrean ${sv.id} pukul ${hhmm(e.payload.slotAt)}`, en: `Queue booked: ${sv.en} at ${hhmm(e.payload.slotAt)}` }, refs: [ref('bookings', e.payload.id ?? '')] }
    }
    case 'briefing.generated':
      return { summary: { id: `Briefing pagi tersusun (${e.payload.items.length} butir)`, en: `Morning briefing assembled (${e.payload.items.length} items)` }, refs: [ref('briefings', e.payload.id ?? ''), ...e.payload.items.flatMap((i) => i.refs)] }
    case 'instruction.issued':
      return {
        summary: { id: `Instruksi pimpinan: ${e.payload.text.id} → ${e.payload.opdIds.map((o) => opdShort(s, o)).join(', ')}`, en: `Leader's instruction: ${e.payload.text.en} → ${e.payload.opdIds.map((o) => opdShort(s, o)).join(', ')}` },
        refs: [ref('instructions', e.payload.id ?? ''), ...(e.payload.refs ?? []), ...(e.payload.origin ? [e.payload.origin] : [])],
      }
    case 'meeting.transcribed': {
      const m = s.meetings.byId[e.payload.meetingId]
      return { summary: { id: `Notulen tersusun: ${m?.title.id ?? e.payload.meetingId}`, en: `Minutes drafted: ${m?.title.en ?? e.payload.meetingId}` }, refs: [ref('meetings', e.payload.meetingId)] }
    }
    case 'actionItem.created':
      return {
        summary: { id: `Tindak lanjut untuk ${opdShort(s, e.payload.opdId)}: ${e.payload.title.id}`, en: `Action item for ${opdShort(s, e.payload.opdId)}: ${e.payload.title.en}` },
        refs: [ref('actionItems', e.payload.id ?? ''), ...(e.payload.source?.id ? [ref(e.payload.source.kind === 'meeting' ? 'meetings' : e.payload.source.kind === 'instruction' ? 'instructions' : 'letters', e.payload.source.id)] : [])],
      }
    case 'letter.dispositioned': {
      const l = s.letters.byId[e.payload.letterId ?? '']
      const to = e.payload.to.map((o) => opdShort(s, o)).join(', ')
      return { summary: { id: `Disposisi ${l?.number ?? ''} → ${to}`, en: `Disposition ${l?.number ?? ''} → ${to}` }, refs: [ref('letters', e.payload.letterId ?? ''), ...(e.payload.instructionId ? [ref('instructions', e.payload.instructionId)] : [])] }
    }
    case 'hoax.detected':
      // toast only — no automatic follow-up (Radar Isu decides to clarify)
      return { summary: { id: `Indikasi hoaks: ${e.payload.claim.id} (skor ${Math.round(e.payload.score * 100)}%)`, en: `Possible hoax: ${e.payload.claim.en} (score ${Math.round(e.payload.score * 100)}%)` }, refs: [ref('hoaxAlerts', e.payload.id ?? '')] }
    case 'clarification.published':
      return { summary: { id: `Klarifikasi terbit (${e.payload.tone}) di ${e.payload.channels.length} kanal`, en: `Clarification published (${e.payload.tone}) on ${e.payload.channels.length} channels` }, refs: [ref('hoaxAlerts', e.payload.hoaxId)] }
    case 'mention.created':
      return { summary: { id: `Mention baru: ${e.payload.outlet} (${e.payload.sentiment})`, en: `New mention: ${e.payload.outlet} (${e.payload.sentiment})` }, refs: [ref('mentions', e.payload.id ?? '')] }
    case 'rain.forecast':
      return {
        summary: { id: `Prakiraan hujan ${e.payload.peakMmH} mm/jam, ${e.payload.horizonH} jam ke depan`, en: `Rain forecast ${e.payload.peakMmH} mm/h over the next ${e.payload.horizonH} h` },
        refs: e.payload.kecamatanIds.map((k) => `kecamatan:${k}`),
      }
    case 'flood.alert': {
      const names = e.payload.kecamatanIds.map((k) => kecName(s, k)).join(', ')
      return { summary: { id: `Peringatan banjir level ${e.payload.level}: Kec. ${names}`, en: `Flood warning level ${e.payload.level}: ${names}` }, refs: [ref('alerts', e.payload.id ?? '')] }
    }
    case 'alert.broadcast': {
      const a = s.alerts.byId[e.payload.alertId]
      return { summary: { id: `Peringatan dini terkirim ke ${a?.broadcast?.recipients ?? 0} penerima`, en: `Early warning sent to ${a?.broadcast?.recipients ?? 0} recipients` }, refs: [ref('alerts', e.payload.alertId)] }
    }
    case 'eligibility.opened':
      return { summary: { id: `Kuota pendaftar bansos banjir dibuka (${e.payload.quota})`, en: `Flood-relief aid registration opened (${e.payload.quota})` }, refs: [ref('programs', e.payload.id ?? ''), ...(e.payload.alertId ? [ref('alerts', e.payload.alertId)] : [])] }
    case 'procurement.created':
      return { summary: { id: `Paket pengadaan dibuat: ${e.payload.name.id} (${fmtRp(e.payload.hps)})`, en: `Procurement package created: ${e.payload.name.en} (${fmtRp(e.payload.hps)})` }, refs: [ref('procurements', e.payload.id ?? '')] }
    case 'procurement.flagged': {
      const p = s.procurements.byId[e.payload.procurementId]
      return { summary: { id: `Paket ${p?.name.id ?? ''} ditandai berisiko (${e.payload.riskScore})`, en: `Package ${p?.name.en ?? ''} flagged as risky (${e.payload.riskScore})` }, refs: [ref('procurements', e.payload.procurementId)] }
    }
    case 'document.verified':
      return { summary: { id: `Berkas ${e.payload.documentId} diverifikasi: ${e.payload.status}`, en: `Document ${e.payload.documentId} verified: ${e.payload.status}` }, refs: [ref('documents', e.payload.documentId), ref('verifications', `VF-${e.id}`)] }
    case 'sale.created': {
      const sale = s.sales.byId[e.payload.id ?? '']
      return { summary: { id: `Transaksi ${e.payload.code} · ${fmtRp(sale?.total ?? 0)} (${e.payload.payment.toUpperCase()})`, en: `Sale ${e.payload.code} · ${fmtRp(sale?.total ?? 0)} (${e.payload.payment.toUpperCase()})` }, refs: [ref('sales', e.payload.id ?? '')] }
    }
    case 'stock.forecastChanged':
      return {
        summary: { id: `Prediksi permintaan ${e.payload.productIds.length} SKU ${pct((e.payload.factor - 1) * 100)}`, en: `Demand forecast for ${e.payload.productIds.length} SKUs ${pct((e.payload.factor - 1) * 100)}` },
        refs: [...e.payload.productIds.slice(0, 12).map((p) => ref('stock', p)), ...(e.payload.cause ? [e.payload.cause] : [])],
      }
    case 'po.sent': {
      const sup = s.suppliers.byId[e.payload.supplierId]?.name ?? e.payload.supplierId
      return { summary: { id: `PO ${e.payload.code} terkirim ke ${sup}`, en: `PO ${e.payload.code} sent to ${sup}` }, refs: [ref('purchaseOrders', e.payload.id ?? ''), ref('suppliers', e.payload.supplierId)] }
    }
    case 'supplier.replied':
      return { summary: { id: `Supplier membalas PO: “${e.payload.message.id}”`, en: `Supplier replied to PO: “${e.payload.message.en}”` }, refs: [ref('purchaseOrders', e.payload.poId)] }
    case 'ledger.posted': {
      const total = e.payload.lines.reduce((a, l) => a + l.debit, 0)
      return { summary: { id: `Jurnal: ${e.payload.memo.id} (${fmtRp(total)})`, en: `Journal: ${e.payload.memo.en} (${fmtRp(total)})` }, refs: [ref('ledger', e.payload.id ?? ''), ...(e.payload.refId ? [ref('sales', e.payload.refId)] : [])] }
    }
    case 'tax.ready':
      return { summary: { id: `Pajak ${e.payload.period} siap untuk ${bizName(s, e.payload.businessId)}`, en: `Tax for ${e.payload.period} ready for ${bizName(s, e.payload.businessId)}` }, refs: [ref('businesses', e.payload.businessId), ...(e.payload.taxItemIds ?? []).map((t) => ref('taxItems', t))] }
    case 'call.scored':
      return { summary: { id: `Percakapan ${e.payload.callId} dinilai ${e.payload.score}`, en: `Conversation ${e.payload.callId} scored ${e.payload.score}` }, refs: [ref('calls', e.payload.callId)] }
    case 'coaching.assigned': {
      const a = s.agentsSales.byId[e.payload.agentId]?.name ?? e.payload.agentId
      return { summary: { id: `Coaching ditugaskan ke ${a}`, en: `Coaching assigned to ${a}` }, refs: [ref('coachings', e.payload.id ?? ''), ref('agentsSales', e.payload.agentId)] }
    }
    case 'partner.verified': {
      const name = e.payload.subjectKind === 'business' ? bizName(s, e.payload.subjectId) : e.payload.subjectKind === 'candidate' ? s.candidates.byId[e.payload.subjectId]?.name ?? e.payload.subjectId : e.payload.subjectId
      const table = e.payload.subjectKind === 'business' ? 'businesses' : e.payload.subjectKind === 'candidate' ? 'candidates' : e.payload.subjectKind === 'citizen' ? 'citizens' : 'documents'
      return { summary: { id: `${e.payload.kind.toUpperCase()} ${name}: ${e.payload.result}`, en: `${e.payload.kind.toUpperCase()} ${name}: ${e.payload.result}` }, refs: [ref(table, e.payload.subjectId), ref('verifications', `VF-${e.id}`)] }
    }
    case 'brand.alert':
      return { summary: { id: `Lonjakan keluhan "${e.payload.topic}" ${pct(e.payload.deltaPct)} untuk ${bizName(s, e.payload.businessId)}`, en: `Spike in "${e.payload.topic}" complaints ${pct(e.payload.deltaPct)} for ${bizName(s, e.payload.businessId)}` }, refs: [ref('businesses', e.payload.businessId)] }
    case 'tender.matched': {
      const t = s.tenders.byId[e.payload.tenderId]
      return { summary: { id: `Tender cocok: ${t?.title.id ?? e.payload.tenderId} (${Math.round(e.payload.probability * 100)}%)`, en: `Matching tender: ${t?.title.en ?? e.payload.tenderId} (${Math.round(e.payload.probability * 100)}%)` }, refs: [ref('tenders', e.payload.tenderId), ref('businesses', e.payload.businessId)] }
    }
    case 'bid.submitted':
      return { summary: { id: `Penawaran ${fmtRp(e.payload.price)} dikirim oleh ${bizName(s, e.payload.businessId)}`, en: `Bid of ${fmtRp(e.payload.price)} submitted by ${bizName(s, e.payload.businessId)}` }, refs: [ref('bids', e.payload.id ?? ''), ref('tenders', e.payload.tenderId)] }
    case 'need.created':
      return { summary: { id: `Kebutuhan pemda: ${e.payload.title.id}`, en: `Government need: ${e.payload.title.en}` }, refs: [ref('catalogNeeds', e.payload.id ?? ''), ...(e.payload.cause ? [e.payload.cause] : [])] }
    case 'match.made':
      return { summary: { id: `Kebutuhan dicocokkan ke ${bizName(s, e.payload.businessId)} (${Math.round(e.payload.score * 100)}%)`, en: `Need matched to ${bizName(s, e.payload.businessId)} (${Math.round(e.payload.score * 100)}%)` }, refs: [ref('matches', e.payload.id ?? ''), ref('catalogNeeds', e.payload.needId)] }
    case 'order.created': {
      const o = s.orders.byId[e.payload.id ?? '']
      return { summary: { id: `Pesanan ${e.payload.code} ke ${bizName(s, e.payload.businessId)} (${fmtRp(o?.total ?? 0)})`, en: `Order ${e.payload.code} to ${bizName(s, e.payload.businessId)} (${fmtRp(o?.total ?? 0)})` }, refs: [ref('orders', e.payload.id ?? ''), ...(e.payload.needId ? [ref('catalogNeeds', e.payload.needId)] : [])] }
    }
    case 'score.updated':
      return { summary: { id: `Skor usaha ${bizName(s, e.payload.businessId)}: ${e.payload.score} (${e.payload.delta > 0 ? '+' : ''}${e.payload.delta})`, en: `Business score ${bizName(s, e.payload.businessId)}: ${e.payload.score} (${e.payload.delta > 0 ? '+' : ''}${e.payload.delta})` }, refs: [ref('bizScores', e.payload.businessId)] }
    case 'loan.applied':
      return { summary: { id: `Pengajuan modal ${fmtRp(e.payload.amount)} ke ${e.payload.lender}`, en: `Loan application ${fmtRp(e.payload.amount)} to ${e.payload.lender}` }, refs: [ref('loanApps', e.payload.id ?? ''), ref('businesses', e.payload.businessId)] }
    case 'loan.approved':
      return { summary: { id: `Pengajuan modal ${e.payload.loanId} disetujui`, en: `Loan ${e.payload.loanId} approved` }, refs: [ref('loanApps', e.payload.loanId)] }
    case 'econ.updated':
      return { summary: { id: `Indeks ekonomi Kec. ${kecName(s, e.payload.kecamatanId)}: ${e.payload.index} (${pct(e.payload.delta)})`, en: `Economic index ${kecName(s, e.payload.kecamatanId)}: ${e.payload.index} (${pct(e.payload.delta)})` }, refs: [ref('econIndex', `${e.payload.kecamatanId}:${e.payload.month}`)] }
    case 'price.updated': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Harga ${c.id} di ${marketName(s, e.payload.marketId)}: ${fmtRp(e.payload.price)}`, en: `${c.en} price at ${marketName(s, e.payload.marketId)}: ${fmtRp(e.payload.price)}` }, refs: [ref('prices', `${e.payload.marketId}:${e.payload.commodityId}`)] }
    }
    case 'price.anomaly': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Anomali harga ${c.id} di ${marketName(s, e.payload.marketId)} ${pct(e.payload.deltaPct)}`, en: `${c.en} price anomaly at ${marketName(s, e.payload.marketId)} ${pct(e.payload.deltaPct)}` }, refs: [ref('prices', `${e.payload.marketId}:${e.payload.commodityId}`)] }
    }
    case 'market.operation': {
      const c = commodity(s, e.payload.commodityId)
      const stage: Record<string, Bi> = {
        recommended: { id: 'direkomendasikan ke Meja Pimpinan', en: 'recommended to Meja Pimpinan' }, approved: { id: 'disetujui', en: 'approved' },
        running: { id: 'berjalan', en: 'running' }, done: { id: 'selesai', en: 'completed' }, dismissed: { id: 'ditolak', en: 'dismissed' },
      }
      const st = stage[e.payload.stage] ?? { id: e.payload.stage, en: e.payload.stage }
      return { summary: { id: `Operasi pasar ${c.id} ${st.id}`, en: `Market operation for ${c.en} ${st.en}` }, refs: [ref('marketOps', e.payload.id ?? ''), ...(e.payload.cause ? [e.payload.cause] : [])] }
    }
  }
}
