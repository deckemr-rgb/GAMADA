/**
 * world/up/reducers-boot.ts — reducers of the Usaha Pintar event types the natural events raise at boot (registered through world/ext.ts; the core
 * keeps the existing types' reducers). Pure, structural sharing.
 */
import type { BrandMention, EventType, Tender, WorldEvent, WorldState } from '../types'
import { patch, upsert } from '../util'
import { callScore } from './call-score'

type R<K extends EventType> = (s: WorldState, e: WorldEvent<K>) => WorldState
const must = <T>(v: T | undefined | null, what: string): T => {
  if (v === undefined || v === null) throw new Error(`reducer: missing ${what}`)
  return v
}

export const UP_BOOT_REDUCERS: { [K in EventType]?: R<K> } = {
  'call.created': (s, e) => {
    const p = e.payload
    return {
      ...s,
      calls: upsert(s.calls, {
        id: must(p.id, 'call id'), agentId: p.agentId, industry: p.industry, channel: p.channel, customer: p.customer, at: e.at, durationSec: p.durationSec, score: null,
        criteria: null, flags: [], transcript: p.transcript, topic: p.topic ?? null, ...(p.refId ? { refId: p.refId } : {}),
      }),
    }
  },
  // the score always follows the criteria (callScore): list = detail = audit = toast
  'call.scored': (s, e) => ({
    ...s,
    calls: patch(s.calls, e.payload.callId, (c) => {
      const criteria = e.payload.criteria ?? c.criteria
      return { ...c, criteria, score: criteria ? callScore(criteria) : e.payload.score, flags: e.payload.flags ?? c.flags, ...(e.payload.by ? { scoredBy: e.payload.by } : {}) }
    }),
  }),
  'verification.requested': (s, e) => {
    const p = e.payload
    const open = s.verificationRequests.ids.find((id) => {
      const r = s.verificationRequests.byId[id]
      return !!r && r.status !== 'selesai' && r.kind === p.kind && r.subjectId === p.subjectId
    })
    if (open) return { ...s, verificationRequests: patch(s.verificationRequests, open, (r) => ({ ...r, priority: r.priority || !!p.priority, needId: p.needId ?? r.needId })) }
    const id = must(p.id, 'request id')
    return {
      ...s,
      verificationRequests: upsert(s.verificationRequests, {
        id, code: p.code ?? id, kind: p.kind, subjectKind: p.subjectKind, subjectId: p.subjectId, requestedBy: p.requestedBy, needId: p.needId ?? null, priority: !!p.priority, at: e.at,
        status: 'antri', verificationId: null,
      }),
    }
  },

  /* ---------------------------------------------------------------- Pantau Merek */
  'brand.mentioned': (s, e) => {
    const p = e.payload
    const m: BrandMention = { ...p, id: must(p.id, 'mention id'), at: p.at ?? e.at }
    let next: WorldState = { ...s, brandMentions: upsert(s.brandMentions, m) }
    // a burst post joins its alert (same scenario cause, topic and brand)
    if (m.cause && m.sentiment === 'negatif') {
      const al = next.brandAlerts.ids.find((id) => {
        const a = next.brandAlerts.byId[id]
        return !!a && a.causeRef === m.cause && a.topic === m.topic && a.businessId === m.brand
      })
      if (al) next = { ...next, brandAlerts: patch(next.brandAlerts, al, (a) => (a.mentionIds.includes(m.id) ? a : { ...a, mentionIds: [...a.mentionIds, m.id] })) }
    }
    return next
  },
  'tender.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'tender id')
    const n = Number(id.replace(/\D/g, '')) || s.tenders.ids.length + 1
    const t: Tender = { ...p, id, code: p.code ?? `${s.day.slice(0, 4)}-T${String(100 + ((n * 37) % 900))}`, status: p.status ?? 'dibuka', matches: {} }
    return { ...s, tenders: upsert(s.tenders, t) }
  },
  'tender.matched': (s, e) => ({ ...s, tenders: patch(s.tenders, e.payload.tenderId, (t) => ({ ...t, matches: { ...t.matches, [e.payload.businessId]: e.payload.probability } })) }),
}

/** ids assigned at emit time (see events.ts ID_FIELDS) */
export const UP_BOOT_ID_FIELDS = {
  'call.created': [['id', 'calls']],
  'verification.requested': [['id', 'verificationRequests', true]],
  'brand.mentioned': [['id', 'brandMentions']],
  'tender.created': [['id', 'tenders']],
} as const
