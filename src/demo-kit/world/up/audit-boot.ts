/**
 * world/up/audit-boot.ts — audit-log texts {id, en} + entity refs of the UP types the natural events raise at boot. The FIRST ref is
 * the entity a cross-product toast opens (`?focus=`), so it names what the receiving product shows.
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldState } from '../types'
import { fmtRp, hhmm, ref } from '../util'
import { kecName } from './base'
import { BRAND_TOPIC } from './labels'

const biz = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id
const rpBi = (n: number): Bi => ({ id: fmtRp(n), en: `Rp ${Math.round(n).toLocaleString('en-GB')}` })
const hmId = (m: number) => hhmm(m).replace(':', '.')

export function describeUpBoot(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null {
  switch (e.type) {
    case 'call.created': {
      const a = s.agentsSales.byId[e.payload.agentId]?.name ?? ''
      const wa = e.payload.channel === 'wa'
      return { summary: { id: `${wa ? 'Chat WA' : 'Panggilan'} baru: ${a} · ${e.payload.customer}`, en: `New ${wa ? 'WA chat' : 'call'}: ${a} · ${e.payload.customer}` }, refs: [ref('calls', e.payload.id ?? ''), ref('agentsSales', e.payload.agentId), ...(e.payload.refId ? [ref('purchaseOrders', e.payload.refId)] : [])] }
    }
    case 'verification.requested': {
      const p = e.payload
      // a request for a subject already queued updates that one: the toast opens it
      const open = s.verificationRequests.ids.find((id) => {
        const r = s.verificationRequests.byId[id]
        return !!r && r.status !== 'selesai' && r.kind === p.kind && r.subjectId === p.subjectId
      })
      const rid = open ?? p.id ?? ''
      const r = s.verificationRequests.byId[rid]
      const who = p.subjectKind === 'business' ? biz(s, p.subjectId) : p.subjectKind === 'document' ? (s.documents.byId[p.subjectId]?.ownerName ?? p.subjectId) : p.subjectId
      return {
        summary: { id: `Permintaan ${p.kind.toUpperCase()} ${r?.code ?? rid}: ${who}${p.priority ? ' (prioritas)' : ''}`, en: `${p.kind.toUpperCase()} request ${r?.code ?? rid}: ${who}${p.priority ? ' (priority)' : ''}` },
        refs: [ref('verificationRequests', rid), ...(p.needId ? [ref('catalogNeeds', p.needId)] : [])],
      }
    }
    case 'brand.mentioned': {
      const p = e.payload
      const who = p.brand === s.meta.shopId ? biz(s, p.brand) : p.brand === 'kategori' ? 'kategori' : p.brand
      const when = p.at != null && p.at > e.at ? ` · ${hmId(p.at)}` : ''
      return { summary: { id: `Sebutan ${who} (${p.sentiment}, ${BRAND_TOPIC[p.topic].id})${when}`, en: `Mention of ${who} (${p.sentiment}, ${BRAND_TOPIC[p.topic].en})${when}` }, refs: [ref('brandMentions', p.id ?? '')] }
    }
    case 'tender.created': {
      const p = e.payload
      const v = rpBi(p.hps ?? p.value)
      return { summary: { id: `Tender baru: ${p.title.id} · HPS ${v.id} · Kec. ${kecName(s, p.kecamatanId)}`, en: `New tender: ${p.title.en} · HPS ${v.en} · ${kecName(s, p.kecamatanId)}` }, refs: [ref('tenders', p.id ?? ''), ...(p.needId ? [ref('catalogNeeds', p.needId)] : []), ...(p.procurementId ? [ref('procurements', p.procurementId)] : [])] }
    }
    case 'call.scored': {
      const c = s.calls.byId[e.payload.callId]
      const a = s.agentsSales.byId[c?.agentId ?? '']?.name ?? ''
      const score = c?.score ?? e.payload.score
      const by = e.payload.by === 'supervisor' ? { id: ' oleh supervisor', en: ' by the supervisor' } : { id: '', en: '' }
      return { summary: { id: `Percakapan ${a} dinilai ${score}${by.id}`, en: `${a}'s conversation scored ${score}${by.en}` }, refs: [ref('calls', e.payload.callId)] }
    }
    case 'tender.matched': {
      const t = s.tenders.byId[e.payload.tenderId]
      return { summary: { id: `Tender cocok: ${t?.title.id ?? e.payload.tenderId} (${Math.round(e.payload.probability * 100)}%)`, en: `Matching tender: ${t?.title.en ?? e.payload.tenderId} (${Math.round(e.payload.probability * 100)}%)` }, refs: [ref('tenders', e.payload.tenderId), ref('businesses', e.payload.businessId)] }
    }
  }
  return null
}
