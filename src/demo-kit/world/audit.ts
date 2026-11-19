/**
 * world/audit.ts — the human summary {id, en} and entity references written to `auditLog` for every processed
 * event (GAMADA Inti → Audit Log and the "jejak data" trail). Runs AFTER the reducer, so it can read names.
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from './types'
import { CATEGORY_LABEL } from './texts'
import { fmtRp, hhmm, ref } from './util'
import { bizName, commodity, describeCore, kecName, marketName } from './audit-core'
import { describeKatalog } from './reducers-katalog'

const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`
/** a rupiah figure that could look official, per locale and labelled simulated */
const rpSim = (n: number): Bi => ({ id: `${fmtRp(n)} (simulasi)`, en: `Rp ${Math.round(n).toLocaleString('en-GB')} (simulated)` })
/** an index with one decimal and its signed % change, per locale: "82,3 (−9 %)" / "82.3 (−9%)" */
const indexBi = (v: number, d: number): Bi => {
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const r = Math.abs(Math.round(d))
  return {
    id: `${v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${sign}${r} %)`,
    en: `${v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${sign}${r}%)`,
  }
}

const TICKET_STATUS: Record<string, Bi> = {
  baru: { id: 'Baru', en: 'New' }, diverifikasi: { id: 'Diverifikasi', en: 'Verified' }, diteruskan: { id: 'Diteruskan ke OPD', en: 'Forwarded to agency' },
  diproses: { id: 'Diproses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Resolved' },
}

const DOC_STATUS: Record<string, Bi> = {
  lengkap: { id: 'Lengkap', en: 'Complete' }, kurang: { id: 'Kurang', en: 'Incomplete' }, 'cek-manual': { id: 'Perlu cek manual', en: 'Needs manual check' },
  baru: { id: 'Baru', en: 'New' },
}
const docStatus = (st: string): Bi => DOC_STATUS[st] ?? { id: st, en: st }

/** "Briefing pagi / siang / sore / malam" from the minute of day it was assembled */
function briefingName(at: number): Bi {
  const h = Math.floor((((at % 1440) + 1440) % 1440) / 60)
  if (h >= 4 && h < 11) return { id: 'Briefing pagi', en: 'Morning briefing' }
  if (h >= 11 && h < 15) return { id: 'Briefing siang', en: 'Midday briefing' }
  if (h >= 15 && h < 18) return { id: 'Briefing sore', en: 'Afternoon briefing' }
  return { id: 'Briefing malam', en: 'Evening briefing' }
}

export function describe(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } {
  const core = describeCore(e, s)
  if (core) return core
  switch (e.type) {
    case 'complaint.clustered': {
      const cl = s.clusters.byId[e.payload.clusterId ?? '']
      const n = cl?.complaintIds.length ?? e.payload.complaintIds.length
      const desa = s.region.kecamatan.find((k) => k.id === e.payload.kecamatanId)?.desa.find((d) => d.id === e.payload.desaId)?.name ?? e.payload.desaId
      return {
        summary: { id: `Klaster ${CATEGORY_LABEL[e.payload.category].id.toLowerCase()} ${desa}: ${n} aduan → Meja Pimpinan, Siaga Wilayah & Radar Isu`, en: `${CATEGORY_LABEL[e.payload.category].en} cluster in ${desa}: ${n} complaints → Meja Pimpinan, Siaga Wilayah & Radar Isu` },
        refs: [ref('clusters', e.payload.clusterId ?? ''), ...e.payload.complaintIds.map((c) => ref('complaints', c))],
      }
    }
    case 'ticket.statusChanged': {
      const t = s.tickets.byId[e.payload.ticketId]
      const st = TICKET_STATUS[e.payload.status] ?? { id: e.payload.status, en: e.payload.status }
      return { summary: { id: `Tiket ${t?.code ?? e.payload.ticketId} → ${st.id}`, en: `Ticket ${t?.code ?? e.payload.ticketId} → ${st.en}` }, refs: [ref('tickets', e.payload.ticketId), ...(t ? [ref('complaints', t.complaintId)] : [])] }
    }
    case 'citizen.notified': {
      const K: Record<string, Bi> = { peringatan: { id: 'Peringatan', en: 'Warning' }, tiket: { id: 'Kabar tiket', en: 'Ticket update' }, antrean: { id: 'Tiket antrean', en: 'Queue ticket' }, info: { id: 'Info', en: 'Info' } }
      const k = K[e.payload.kind] ?? K.info!
      const n = e.payload.to.length
      return {
        summary: { id: `${k.id} terkirim ke HP ${n} warga`, en: `${k.en} sent to ${n} citizen phone${n === 1 ? '' : 's'}` },
        refs: [ref('messages', e.payload.id ?? ''), ...(e.payload.refs ?? []), ...e.payload.to.slice(0, 3).map((c) => ref('citizens', c))],
      }
    }
    case 'service.booked': {
      const sv = s.region.services.find((x) => x.id === e.payload.serviceId)?.name ?? { id: e.payload.serviceId, en: e.payload.serviceId }
      return { summary: { id: `Antrean ${sv.id} pukul ${hhmm(e.payload.slotAt)}`, en: `Queue booked: ${sv.en} at ${hhmm(e.payload.slotAt)}` }, refs: [ref('bookings', e.payload.id ?? '')] }
    }
    case 'briefing.generated': {
      // named after the time of day it was assembled (a 14.00 briefing is not a "morning" one)
      const tod = briefingName(e.at)
      return { summary: { id: `${tod.id} tersusun (${e.payload.items.length} butir)`, en: `${tod.en} assembled (${e.payload.items.length} items)` }, refs: [ref('briefings', e.payload.id ?? ''), ...e.payload.items.flatMap((i) => i.refs)] }
    }
    case 'instruction.issued':
      return {
        summary: { id: `Instruksi pimpinan: ${e.payload.text.id} → ${e.payload.opdIds.map((o) => opdShort(s, o)).join(', ')}`, en: `Leader's instruction: ${e.payload.text.en} → ${e.payload.opdIds.map((o) => opdShort(s, o)).join(', ')}` },
        refs: [ref('instructions', e.payload.id ?? ''), ...(e.payload.refs ?? []), ...(e.payload.origin ? [e.payload.origin] : [])],
      }
    case 'meeting.transcribed': {
      // the row is stamped when the minutes were drafted; it also names when the meeting itself took place
      const m = s.meetings.byId[e.payload.meetingId]
      if (!m) return { summary: { id: `Notulen tersusun: ${e.payload.meetingId}`, en: `Minutes drafted: ${e.payload.meetingId}` }, refs: [] }
      return { summary: { id: `Notulen tersusun: ${m.title.id} (rapat pukul ${hhmm(m.at).replace(':', '.')})`, en: `Minutes drafted: ${m.title.en} (meeting at ${hhmm(m.at)})` }, refs: [ref('meetings', m.id)] }
    }
    case 'actionItem.created':
      return {
        summary: { id: `Tindak lanjut untuk ${opdShort(s, e.payload.opdId)}: ${e.payload.title.id}`, en: `Action item for ${opdShort(s, e.payload.opdId)}: ${e.payload.title.en}` },
        refs: [ref('actionItems', e.payload.id ?? ''), ...(e.payload.source?.id ? [ref(e.payload.source.kind === 'meeting' ? 'meetings' : e.payload.source.kind === 'instruction' ? 'instructions' : 'letters', e.payload.source.id)] : [])],
      }
    case 'actionItem.statusChanged': {
      const a = s.actionItems.byId[e.payload.actionItemId]
      return { summary: { id: `Tindak lanjut ${a?.title.id ?? e.payload.actionItemId} → ${e.payload.status}`, en: `Action item ${a?.title.en ?? e.payload.actionItemId} → ${e.payload.status}` }, refs: [ref('actionItems', e.payload.actionItemId)] }
    }
    case 'actionItem.reminded': {
      const a = s.actionItems.byId[e.payload.actionItemId]
      return { summary: { id: `Pengingat WA terkirim ke ${a?.pic ?? 'PIC'}`, en: `WhatsApp reminder sent to ${a?.pic ?? 'the person in charge'}` }, refs: [ref('actionItems', e.payload.actionItemId)] }
    }
    case 'letter.received':
      return { summary: { id: `Surat masuk ${e.payload.number} dari ${e.payload.from}: ${e.payload.subject.id}`, en: `Letter received ${e.payload.number} from ${e.payload.from}: ${e.payload.subject.en}` }, refs: [ref('letters', e.payload.id ?? '')] }
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
    case 'flood.confirmed': {
      const n = e.payload.complaintIds.length
      return {
        summary: { id: `${n} aduan warga mengonfirmasi genangan di Kec. ${kecName(s, e.payload.kecamatanId)}`, en: `${n} citizen report${n === 1 ? '' : 's'} confirm flooding in ${kecName(s, e.payload.kecamatanId)}` },
        refs: [ref('clusters', e.payload.clusterId), ...(e.payload.alertId ? [ref('alerts', e.payload.alertId)] : [])],
      }
    }
    case 'harvest.updated': {
      const names = e.payload.kecamatanIds.map((k) => kecName(s, k)).join(', ')
      return e.payload.scenario === 'pasca-banjir'
        ? { summary: { id: `Estimasi panen pascabanjir: Kec. ${names}`, en: `Post-flood harvest estimate: ${names}` }, refs: e.payload.kecamatanIds.map((k) => `kecamatan:${k}`) }
        : { summary: { id: `Estimasi panen normal: Kec. ${names}`, en: `Normal harvest estimate: ${names}` }, refs: e.payload.kecamatanIds.map((k) => `kecamatan:${k}`) }
    }
    case 'supply.signal': {
      const c = commodity(s, e.payload.commodityId)
      return { summary: { id: `Sinyal pasokan ${c.id} ${pct(e.payload.pct)} (${e.payload.horizonDays} hari)`, en: `${c.en} supply signal ${pct(e.payload.pct)} (${e.payload.horizonDays} days)` }, refs: [ref('supplySignals', e.payload.id ?? ''), ...(e.payload.cause ? [e.payload.cause] : [])] }
    }
    case 'eligibility.opened':
      return { summary: { id: `Kuota pendaftar bansos banjir dibuka (${e.payload.quota})`, en: `Flood-relief aid registration opened (${e.payload.quota})` }, refs: [ref('programs', e.payload.id ?? ''), ...(e.payload.alertId ? [ref('alerts', e.payload.alertId)] : [])] }
    case 'procurement.created':
      return {
        summary: e.payload.emergency
          ? { id: `Draf paket pengadaan darurat: ${e.payload.name.id} (menunggu persetujuan PPK) · ${rpSim(e.payload.hps).id}`, en: `Draft emergency procurement package: ${e.payload.name.en} (awaiting the commitment officer's approval) · ${rpSim(e.payload.hps).en}` }
          : { id: `Paket pengadaan dibuat: ${e.payload.name.id} · ${rpSim(e.payload.hps).id}`, en: `Procurement package created: ${e.payload.name.en} · ${rpSim(e.payload.hps).en}` },
        refs: [ref('procurements', e.payload.id ?? '')],
      }
    case 'procurement.recommended': {
      const p = s.procurements.byId[e.payload.procurementId]
      return {
        // an office memo proposing a correction, not an audit finding
        summary: p
          ? { id: `Usulan koreksi HPS ${p.name.id}: ${fmtRp(p.hps)} → ${rpSim(e.payload.hpsCorrected).id}`, en: `Proposed HPS correction for ${p.name.en}: Rp ${Math.round(p.hps).toLocaleString('en-GB')} → ${rpSim(e.payload.hpsCorrected).en}` }
          : { id: `Usulan koreksi HPS: ${rpSim(e.payload.hpsCorrected).id}`, en: `Proposed HPS correction: ${rpSim(e.payload.hpsCorrected).en}` },
        refs: [ref('procurements', e.payload.procurementId)],
      }
    }
    case 'document.verified':
      // the reducer ignores a document the world does not know: the row says so and carries no dangling refs
      if (!s.documents.byId[e.payload.documentId])
        return { summary: { id: `Berkas ${e.payload.documentId} diverifikasi: ${docStatus(e.payload.status).id} (tidak ada di data dunia, tidak dicatat)`, en: `Document ${e.payload.documentId} verified: ${docStatus(e.payload.status).en} (not in the world data, not recorded)` }, refs: [] }
      return { summary: { id: `Berkas ${e.payload.documentId} diverifikasi: ${docStatus(e.payload.status).id}`, en: `Document ${e.payload.documentId} verified: ${docStatus(e.payload.status).en}` }, refs: [ref('documents', e.payload.documentId), ref('verifications', `VF-${e.id}`)] }
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
    case 'tax.ready':
      return { summary: { id: `Pajak ${e.payload.period} siap untuk ${bizName(s, e.payload.businessId)}`, en: `Tax for ${e.payload.period} ready for ${bizName(s, e.payload.businessId)}` }, refs: [ref('businesses', e.payload.businessId), ...(e.payload.taxItemIds ?? []).map((t) => ref('taxItems', t))] }
    case 'coaching.assigned': {
      const a = s.agentsSales.byId[e.payload.agentId]?.name ?? e.payload.agentId
      return { summary: { id: `Coaching ditugaskan ke ${a}`, en: `Coaching assigned to ${a}` }, refs: [ref('coachings', e.payload.id ?? ''), ref('agentsSales', e.payload.agentId)] }
    }
    case 'partner.verified': {
      const name = e.payload.subjectKind === 'business' ? bizName(s, e.payload.subjectId) : e.payload.subjectKind === 'candidate' ? s.candidates.byId[e.payload.subjectId]?.name ?? e.payload.subjectId : e.payload.subjectId
      const table = e.payload.subjectKind === 'business' ? 'businesses' : e.payload.subjectKind === 'candidate' ? 'candidates' : e.payload.subjectKind === 'citizen' ? 'citizens' : 'documents'
      return { summary: { id: `${e.payload.kind.toUpperCase()} ${name}: ${e.payload.result}`, en: `${e.payload.kind.toUpperCase()} ${name}: ${e.payload.result}` }, refs: [ref(table, e.payload.subjectId), ref('verifications', `VF-${e.id}`)] }
    }
    case 'bid.submitted':
      return { summary: { id: `Penawaran ${fmtRp(e.payload.price)} dikirim oleh ${bizName(s, e.payload.businessId)}`, en: `Bid of ${fmtRp(e.payload.price)} submitted by ${bizName(s, e.payload.businessId)}` }, refs: [ref('bids', e.payload.id ?? ''), ref('tenders', e.payload.tenderId)] }
    case 'need.created':
    case 'match.made':
      return describeKatalog(e, s)!
    case 'order.created': {
      const o = s.orders.byId[e.payload.id ?? '']
      return { summary: { id: `Pesanan ${e.payload.code} ke ${bizName(s, e.payload.businessId)} (${fmtRp(o?.total ?? 0)})`, en: `Order ${e.payload.code} to ${bizName(s, e.payload.businessId)} (${fmtRp(o?.total ?? 0)})` }, refs: [ref('orders', e.payload.id ?? ''), ...(e.payload.needId ? [ref('catalogNeeds', e.payload.needId)] : [])] }
    }
    case 'loan.applied':
      return { summary: { id: `Pengajuan modal ${fmtRp(e.payload.amount)} ke ${e.payload.lender}`, en: `Loan application ${fmtRp(e.payload.amount)} to ${e.payload.lender}` }, refs: [ref('loanApps', e.payload.id ?? ''), ref('businesses', e.payload.businessId)] }
    case 'loan.approved':
      return { summary: { id: `Pengajuan modal ${e.payload.loanId} disetujui`, en: `Loan ${e.payload.loanId} approved` }, refs: [ref('loanApps', e.payload.loanId)] }
    case 'econ.updated':
      return { summary: { id: `Indeks ekonomi Kec. ${kecName(s, e.payload.kecamatanId)}: ${indexBi(e.payload.index, e.payload.delta).id}`, en: `Economic index ${kecName(s, e.payload.kecamatanId)}: ${indexBi(e.payload.index, e.payload.delta).en}` }, refs: [ref('econIndex', `${e.payload.kecamatanId}:${e.payload.month}`), ...(e.payload.cause ? [e.payload.cause] : [])] }
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
  // every other type is a core one (describeCore above)
  throw new Error(`audit: no summary for ${e.type}`)
}
