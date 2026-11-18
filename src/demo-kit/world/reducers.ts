/**
 * world/reducers.ts — one pure reducer per event type: (state, event) → new state with structural sharing
 * (untouched tables keep their identity, so memoised selectors and useWorld slices do not re-render).
 * Payload ids are already assigned by engine.prepare() when a reducer runs.
 */
import type { Alert, EventType, Instruction, LngLat, MarketOperation, Program, WorldEvent, WorldState } from './types'
import { DAY_MIN, WORLD, centroid, get, monthOf, patch, patchMany, upsert } from './util'
import { CORE_REDUCERS, must } from './reducers-core'

export type Reducer<K extends EventType> = (s: WorldState, e: WorldEvent<K>) => WorldState
export type ReducerMap = { [K in EventType]?: Reducer<K> }


export const REDUCERS: ReducerMap = {
  // the boot-time types (natural events, Awas Belanja screening) live in reducers-core.ts
  ...CORE_REDUCERS,
  /* ---------------------------------------------------------------- Sapa Warga */
  'complaint.clustered': (s, e) => {
    const p = e.payload
    const id = must(p.clusterId, 'cluster id')
    const prev = s.clusters.byId[id]
    const ids = [...new Set([...(prev?.complaintIds ?? []), ...p.complaintIds])]
    const pts = ids.map((c) => s.complaints.byId[c]?.coord).filter((c): c is LngLat => !!c)
    const cluster = prev
      ? { ...prev, complaintIds: ids, center: centroid(pts), updatedAt: e.at }
      : { id, category: p.category, kecamatanId: p.kecamatanId, desaId: p.desaId, center: pts.length ? centroid(pts) : p.center, radiusKm: p.radiusKm, complaintIds: ids, at: e.at, updatedAt: e.at }
    return { ...s, clusters: upsert(s.clusters, cluster), complaints: patchMany(s.complaints, p.complaintIds, (c) => (c.clusterId === id ? c : { ...c, clusterId: id })) }
  },
  'ticket.statusChanged': (s, e) => {
    const p = e.payload
    return {
      ...s,
      tickets: patch(s.tickets, p.ticketId, (t) => {
        // re-emitting the same terminal status (e.g. a rating after 'selesai') keeps the first close time and history
        const same = t.status === p.status
        return {
          ...t, status: p.status, opdId: p.opdId ?? t.opdId, updatedAt: e.at,
          closedAt: p.status === 'selesai' ? (same && t.closedAt !== null ? t.closedAt : e.at) : null,
          rating: p.rating ?? t.rating,
          history: same && p.status === 'selesai' ? t.history : [...t.history, { at: e.at, status: p.status, ...(p.note ? { note: p.note } : {}) }],
        }
      }),
    }
  },
  'citizen.notified': (s, e) => {
    const p = e.payload
    if (!p.to.length) return s
    return { ...s, messages: upsert(s.messages, { id: must(p.id, 'message id'), at: e.at, kind: p.kind, to: p.to, text: p.text, refs: p.refs ?? [], channel: p.channel ?? 'wa' }) }
  },
  'service.booked': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'booking id')
    return { ...s, bookings: upsert(s.bookings, { id, code: p.code ?? id, serviceId: p.serviceId, citizenId: p.citizenId ?? null, slotAt: p.slotAt, channel: p.channel ?? 'mpp', at: e.at }) }
  },

  /* ---------------------------------------------------------------- Meja Pimpinan · Naskah Pintar */
  'briefing.generated': (s, e) => ({ ...s, briefings: upsert(s.briefings, { id: must(e.payload.id, 'briefing id'), at: e.at, items: e.payload.items }) }),
  'instruction.issued': (s, e) => {
    const p = e.payload
    const ins: Instruction = {
      id: must(p.id, 'instruction id'), at: e.at, text: p.text, opdIds: p.opdIds, dueAt: p.dueAt ?? e.at + DAY_MIN, refs: p.refs ?? [], letterId: null, actionItemIds: [],
      ...(p.origin ? { origin: p.origin } : {}),
    }
    let next: WorldState = { ...s, instructions: upsert(s.instructions, ins) }
    // accepting a market-operation suggestion moves it forward
    const origin = p.origin?.startsWith('marketOps:') ? p.origin.slice('marketOps:'.length) : null
    if (origin) next = { ...next, marketOps: patch(next.marketOps, origin, (m) => (m.stage === 'recommended' ? { ...m, stage: 'approved' } : m)) }
    return next
  },
  'meeting.transcribed': (s, e) => ({
    ...s,
    meetings: patch(s.meetings, e.payload.meetingId, (m) => ({
      ...m, transcribed: true, status: 'selesai', summary: e.payload.summary ?? m.summary, durationMin: e.payload.durationMin ?? m.durationMin,
    })),
  }),
  'actionItem.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'action item id')
    const opd = s.region.opd.find((o) => o.id === p.opdId)
    const source = p.source ?? { kind: 'manual' as const, id: null }
    let next: WorldState = {
      ...s,
      actionItems: upsert(s.actionItems, { id, title: p.title, opdId: p.opdId, pic: p.pic ?? `Kepala ${opd?.short ?? p.opdId}`, dueAt: p.dueAt, status: 'baru', source, createdAt: e.at }),
    }
    if (source.kind === 'meeting' && source.id) next = { ...next, meetings: patch(next.meetings, source.id, (m) => ({ ...m, actionItemIds: [...m.actionItemIds, id] })) }
    if (source.kind === 'instruction' && source.id) next = { ...next, instructions: patch(next.instructions, source.id, (m) => ({ ...m, actionItemIds: [...m.actionItemIds, id] })) }
    return next
  },
  'actionItem.statusChanged': (s, e) => ({
    ...s,
    actionItems: patch(s.actionItems, e.payload.actionItemId, (a) => (a.status === e.payload.status ? a : { ...a, status: e.payload.status })),
  }),
  'actionItem.reminded': (s, e) => ({ ...s, actionItems: patch(s.actionItems, e.payload.actionItemId, (a) => ({ ...a, remindedAt: e.at })) }),
  'letter.received': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'letter id')
    return {
      ...s,
      letters: upsert(s.letters, {
        id, number: p.number, from: p.from, subject: p.subject, kind: p.kind, sifat: p.sifat ?? 'biasa', receivedAt: p.receivedAt ?? e.at, dueAt: p.dueAt ?? null,
        status: 'masuk', scanned: p.scanned ?? false, disposition: null,
      }),
    }
  },
  'letter.dispositioned': (s, e) => {
    const p = e.payload
    const id = must(p.letterId, 'letter id')
    const disposition = { to: p.to, note: p.note, by: p.by ?? 'Kepala Daerah', at: e.at }
    const exists = !!s.letters.byId[id]
    const letters = exists
      ? patch(s.letters, id, (l) => ({
          ...l, status: 'didisposisi' as const, disposition,
          ...(p.number ? { number: p.number } : {}), ...(p.from ? { from: p.from } : {}), ...(p.subject ? { subject: p.subject } : {}),
        }))
      : upsert(s.letters, {
          id, number: `ND-${id}/${s.day.slice(0, 4)}`, from: p.by ?? 'Kepala Daerah', subject: p.subject ?? p.note, kind: 'nota-dinas', sifat: 'segera', receivedAt: e.at,
          dueAt: e.at + DAY_MIN, status: 'didisposisi', scanned: false, disposition, ...(p.instructionId ? { instructionId: p.instructionId } : {}),
        })
    let next: WorldState = { ...s, letters }
    if (p.instructionId) next = { ...next, instructions: patch(next.instructions, p.instructionId, (i) => ({ ...i, letterId: id })) }
    return next
  },

  /* ---------------------------------------------------------------- Radar Isu */
  'hoax.detected': (s, e) => {
    const p = e.payload
    return {
      ...s,
      hoaxAlerts: upsert(s.hoaxAlerts, {
        id: must(p.id, 'hoax id'), at: e.at, claim: p.claim, score: p.score, spreadPerHour: p.spreadPerHour, accounts: p.accounts, evidence: p.evidence ?? null,
        topic: p.topic, status: 'aktif', clarification: null, ...(p.rumor ? { rumor: p.rumor } : {}),
      }),
      mentions: p.rumor ? patchMany(s.mentions, s.mentions.ids.filter((id) => s.mentions.byId[id]?.rumor === p.rumor && !s.mentions.byId[id]?.hoaxId), (m) => ({ ...m, hoaxId: p.id })) : s.mentions,
    }
  },
  'clarification.published': (s, e) => ({
    ...s,
    hoaxAlerts: patch(s.hoaxAlerts, e.payload.hoaxId, (h) => ({ ...h, status: 'diklarifikasi', clarification: { at: e.at, tone: e.payload.tone, channels: e.payload.channels } })),
  }),

  /* ---------------------------------------------------------------- Siaga Wilayah */
  'rain.forecast': (s, e) => {
    // rain cells are transient: a new forecast replaces the previous field
    const cells = e.payload.cells.map((c, i) => ({ ...c, id: `HJ-${e.id}-${i + 1}`, at: e.at }))
    const byId: Record<string, (typeof cells)[number]> = {}
    for (const c of cells) byId[c.id] = c
    return { ...s, rainCells: { byId, ids: cells.map((c) => c.id).reverse() } }
  },
  'flood.alert': (s, e) => {
    const p = e.payload
    const names = p.kecamatanIds.map((k) => s.region.kecamatan.find((x) => x.id === k)?.name ?? k).join(', ')
    const alert: Alert = {
      id: must(p.id, 'alert id'), at: e.at, kind: 'banjir', level: p.level, kecamatanIds: p.kecamatanIds, desaIds: p.desaIds ?? [], riverId: p.riverId ?? s.region.floodRiverId,
      expectedAt: p.expectedAt ?? null, status: 'aktif', broadcast: null,
      title: p.title ?? { id: `Peringatan banjir level ${p.level} — Kec. ${names}`, en: `Flood warning level ${p.level} — ${names}` },
    }
    const zone = new Set(p.kecamatanIds)
    const shelters = s.facilities.ids.filter((id) => {
      const f = s.facilities.byId[id]
      return !!f && f.kind === 'pengungsian' && zone.has(f.kecamatanId ?? '') && f.occupied === 0
    })
    return {
      ...s,
      alerts: upsert(s.alerts, alert),
      facilities: patchMany(s.facilities, shelters, (f) => ({ ...f, occupied: Math.round(f.capacity * (0.15 + 0.1 * p.level)) })),
    }
  },
  'alert.broadcast': (s, e) => {
    const a = s.alerts.byId[e.payload.alertId]
    if (!a) return s
    const zone = new Set(a.kecamatanIds)
    const recipients = e.payload.recipients ?? s.citizens.ids.reduce((n, id) => (zone.has(s.citizens.byId[id]?.kecamatanId ?? '') ? n + 1 : n), 0)
    const desaIds = e.payload.desaIds ?? a.desaIds
    return { ...s, alerts: patch(s.alerts, a.id, (x) => ({ ...x, broadcast: { at: e.at, recipients, channels: e.payload.channels, ...(desaIds.length ? { desaIds } : {}) } })) }
  },
  'flood.confirmed': (s, e) => {
    const p = e.payload
    const ids = p.alertId ? [p.alertId] : s.alerts.ids.filter((id) => {
      const a = s.alerts.byId[id]
      return !!a && a.status === 'aktif' && a.kind === 'banjir' && a.kecamatanIds.includes(p.kecamatanId)
    })
    return { ...s, alerts: patchMany(s.alerts, ids, (a) => ({ ...a, confirmedBy: [...new Set([...(a.confirmedBy ?? []), ...p.complaintIds])] })) }
  },
  'harvest.updated': (s, e) => {
    const p = e.payload
    const kec = new Set(p.kecamatanIds)
    const dropOf = (k: string) => (p.scenario === 'pasca-banjir' ? (p.dropPctByKecamatan?.[k] ?? p.dropPct ?? WORLD.harvestFloodDropPct) / 100 : 0)
    const ids = s.harvests.ids.filter((id) => kec.has(s.harvests.byId[id]?.kecamatanId ?? ''))
    return {
      ...s,
      harvests: patchMany(s.harvests, ids, (h) => {
        const drop = dropOf(h.kecamatanId)
        return {
          ...h, scenario: p.scenario, updatedAt: e.at,
          estimateTon: Math.round(h.baselineTon * (1 - drop * (h.crop === 'cabai' || h.crop === 'bawang-merah' ? 1.2 : 1))),
          ndvi: p.scenario === 'pasca-banjir' ? Math.round(Math.max(0.12, h.ndviBase * (1 - drop * 1.3)) * 100) / 100 : h.ndviBase,
        }
      }),
    }
  },
  'eligibility.opened': (s, e) => {
    const p = e.payload
    const prog: Program = {
      id: must(p.id, 'program id'), kind: p.kind, kecamatanIds: p.kecamatanIds, quota: p.quota, open: true, openedAt: e.at, alertId: p.alertId,
      title: { id: 'Pendaftaran bansos korban banjir', en: 'Flood-relief social aid registration' },
    }
    return { ...s, programs: upsert(s.programs, prog) }
  },

  /* ---------------------------------------------------------------- Awas Belanja · Cek Berkas */
  'procurement.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'procurement id')
    return {
      ...s,
      procurements: upsert(s.procurements, {
        ...p, id, code: p.code ?? id, status: p.status ?? 'pengumuman', riskScore: null, flagged: false, findings: [], createdAt: e.at,
      }),
    }
  },
  'procurement.recommended': (s, e) => ({
    ...s,
    procurements: patch(s.procurements, e.payload.procurementId, (p) => ({ ...p, recommendation: { at: e.at, hpsCorrected: e.payload.hpsCorrected, note: e.payload.note, inviteLocal: e.payload.inviteLocal } })),
  }),
  'document.verified': (s, e) => {
    const d = s.documents.byId[e.payload.documentId]
    if (!d) return s
    const result = e.payload.status === 'lengkap' ? 'lolos' : e.payload.status === 'kurang' ? 'kurang' : e.payload.status === 'cek-manual' ? 'cek-manual' : 'kurang'
    return {
      ...s,
      documents: patch(s.documents, d.id, (x) => ({ ...x, status: e.payload.status })),
      verifications: upsert(s.verifications, { id: `VF-${e.id}`, subjectKind: 'document', subjectId: d.id, kind: 'document', result, score: result === 'lolos' ? 95 : 60, at: e.at, by: e.source }),
    }
  },

  /* ---------------------------------------------------------------- Toko Autopilot */
  'stock.forecastChanged': (s, e) => ({
    ...s,
    stock: patchMany(s.stock, e.payload.productIds, (st) => ({ ...st, factor: e.payload.factor, reason: e.payload.reason, updatedAt: e.at })),
  }),
  'po.sent': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'po id')
    const total = p.items.reduce((a, it) => a + it.qty * it.cost, 0)
    if (s.purchaseOrders.byId[id]) return { ...s, purchaseOrders: patch(s.purchaseOrders, id, (po) => ({ ...po, items: p.items, total, status: 'terkirim', at: e.at })) }
    return { ...s, purchaseOrders: upsert(s.purchaseOrders, { id, code: p.code ?? id, businessId: p.businessId, supplierId: p.supplierId, items: p.items, total, status: 'terkirim', at: e.at, reply: null }) }
  },
  'supplier.replied': (s, e) => ({
    ...s,
    purchaseOrders: patch(s.purchaseOrders, e.payload.poId, (po) => ({
      ...po, status: po.status === 'diterima' ? po.status : 'dibalas', reply: { at: e.at, message: e.payload.message, eta: e.payload.eta ?? null, ...(e.payload.tpl != null ? { tpl: e.payload.tpl } : {}) },
    })),
  }),

  /* ---------------------------------------------------------------- Pajak Beres */
  'tax.ready': (s, e) => {
    const p = e.payload
    const ids = p.taxItemIds ?? s.taxItems.ids.filter((id) => {
      const t = s.taxItems.byId[id]
      return t && t.businessId === p.businessId && t.period === p.period && t.status === 'perlu-hitung'
    })
    return {
      ...s,
      taxItems: patchMany(s.taxItems, ids, (t) => (t.status === 'perlu-hitung' ? { ...t, status: 'siap' } : t)),
      businesses: patch(s.businesses, p.businessId, (b) => (b.taxTidy ? b : { ...b, taxTidy: true })),
    }
  },

  /* ---------------------------------------------------------------- Juara Jualan · Kenal Mitra */
  // 'call.scored' and 'tender.matched' are reduced by the Usaha Pintar world module (world/up/reducers-up.ts)
  'coaching.assigned': (s, e) => {
    const p = e.payload
    const agent = s.agentsSales.byId[p.agentId]
    return {
      ...s,
      coachings: upsert(s.coachings, {
        id: must(p.id, 'coaching id'), agentId: p.agentId, focus: p.focus, callId: p.callId ?? null, at: e.at, status: 'baru',
        examples: p.examples ?? [], baseline: p.baseline ?? agent?.baseline ?? 0, focusKeys: p.focusKeys ?? [],
      }),
    }
  },
  'partner.verified': (s, e) => {
    const p = e.payload
    let next: WorldState = {
      ...s,
      verifications: upsert(s.verifications, { id: `VF-${e.id}`, subjectKind: p.subjectKind, subjectId: p.subjectId, kind: p.kind, result: p.result, score: p.score ?? (p.result === 'lolos' ? 90 : 55), at: e.at, by: e.source }),
    }
    if (p.subjectKind === 'business') next = { ...next, businesses: patch(next.businesses, p.subjectId, (b) => ({ ...b, verified: p.result === 'lolos' })) }
    if (p.subjectKind === 'candidate') {
      next = { ...next, candidates: patch(next.candidates, p.subjectId, (c) => ({ ...c, score: p.score ?? c.score, status: p.result === 'lolos' ? 'shortlist' : p.result === 'ditolak' ? 'ditolak' : c.status })) }
    }
    // the open Kenal Mitra request of this subject closes (a CV batch closes the opening's request)
    const vr = next.verificationRequests
    const open = vr.ids.filter((id) => {
      const r = vr.byId[id]
      return !!r && r.status !== 'selesai' && r.kind === p.kind && (r.subjectId === p.subjectId || (p.kind === 'cv' && r.subjectKind === 'candidate'))
    })
    if (open.length) next = { ...next, verificationRequests: patchMany(vr, open, (r) => ({ ...r, status: 'selesai', verificationId: `VF-${e.id}` })) }
    return next
  },

  /* ---------------------------------------------------------------- TenderPilot · Katalog Lokal */
  'bid.submitted': (s, e) => ({
    ...s,
    bids: upsert(s.bids, {
      id: must(e.payload.id, 'bid id'), tenderId: e.payload.tenderId, businessId: e.payload.businessId, price: e.payload.price, at: e.at, status: 'terkirim',
      ...(e.payload.pages ? { pages: e.payload.pages } : {}), ...(e.payload.docSections ? { docSections: e.payload.docSections } : {}),
      ...(s.tenders.byId[e.payload.tenderId]?.hps ? { hps: s.tenders.byId[e.payload.tenderId]!.hps } : {}),
    }),
  }),
  'need.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'need id')
    return {
      ...s,
      catalogNeeds: upsert(s.catalogNeeds, { id, code: p.code ?? id, at: e.at, title: p.title, items: p.items, kecamatanId: p.kecamatanId, deadlineDays: p.deadlineDays, emergency: p.emergency ?? false, status: 'baru', cause: p.cause ?? null }),
    }
  },
  'match.made': (s, e) => ({
    ...s,
    matches: upsert(s.matches, { id: must(e.payload.id, 'match id'), needId: e.payload.needId, businessId: e.payload.businessId, score: e.payload.score, at: e.at, status: 'kandidat' }),
    catalogNeeds: patch(s.catalogNeeds, e.payload.needId, (n) => (n.status === 'baru' ? { ...n, status: 'dicocokkan' } : n)),
  }),
  'order.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'order id')
    const total = p.items.reduce((a, it) => a + it.qty * it.price, 0)
    let next: WorldState = { ...s, orders: upsert(s.orders, { id, code: p.code ?? id, needId: p.needId ?? null, businessId: p.businessId, items: p.items, total, status: 'dipesan', at: e.at }) }
    if (p.needId) {
      const needId = p.needId
      next = { ...next, catalogNeeds: patch(next.catalogNeeds, needId, (n) => ({ ...n, status: 'dipesan' })) }
      const picked = next.matches.ids.filter((m) => next.matches.byId[m]?.needId === needId && next.matches.byId[m]?.businessId === p.businessId)
      next = { ...next, matches: patchMany(next.matches, picked, (m) => ({ ...m, status: 'dipilih' })) }
    }
    return next
  },

  /* ---------------------------------------------------------------- Rapor Usaha */
  'loan.applied': (s, e) => {
    const p = e.payload
    return {
      ...s,
      loanApps: upsert(s.loanApps, { id: must(p.id, 'loan id'), businessId: p.businessId, lender: p.lender, amount: p.amount, tenorMonths: p.tenorMonths, score: get(s.bizScores, p.businessId)?.score ?? 0, status: 'diajukan', at: e.at, decidedAt: null }),
    }
  },
  'loan.approved': (s, e) => ({ ...s, loanApps: patch(s.loanApps, e.payload.loanId, (l) => ({ ...l, status: 'disetujui', decidedAt: e.at })) }),

  /* ---------------------------------------------------------------- Indeks Ekonomi · Sinyal Pasar */
  'econ.updated': (s, e) => {
    const p = e.payload
    const id = `${p.kecamatanId}:${p.month || monthOf(s.day)}`
    return { ...s, econIndex: patch(s.econIndex, id, (x) => ({ ...x, index: p.index, omzet: Math.round((x.omzet * p.index) / Math.max(1, x.index)) })) }
  },
  'price.anomaly': (s, e) => ({ ...s, prices: patch(s.prices, `${e.payload.marketId}:${e.payload.commodityId}`, (x) => ({ ...x, price: e.payload.price, anomaly: true, updatedAt: e.at })) }),
  'supply.signal': (s, e) => {
    const p = e.payload
    return {
      ...s,
      supplySignals: upsert(s.supplySignals, { id: must(p.id, 'supply signal id'), at: e.at, commodityId: p.commodityId, kecamatanIds: p.kecamatanIds, direction: p.direction, pct: p.pct, horizonDays: p.horizonDays, reason: p.reason, cause: p.cause ?? null }),
    }
  },
  'market.operation': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'market op id')
    const prev = s.marketOps.byId[id]
    const clearAnomaly = (st: WorldState, marketIds: string[], commodityId: string): WorldState =>
      p.stage === 'done' ? { ...st, prices: patchMany(st.prices, marketIds.map((m) => `${m}:${commodityId}`), (x) => (x.anomaly ? { ...x, anomaly: false } : x)) } : st
    if (prev) return clearAnomaly({ ...s, marketOps: patch(s.marketOps, id, (m) => ({ ...m, stage: p.stage, effectPct: p.effectPct ?? m.effectPct })) }, prev.marketIds, prev.commodityId)
    const name = s.region.commodities.find((c) => c.id === p.commodityId)?.name ?? { id: p.commodityId, en: p.commodityId }
    const op: MarketOperation = {
      id, at: e.at, stage: p.stage, commodityId: p.commodityId, marketIds: p.marketIds, effectPct: p.effectPct ?? -8, forRole: p.forRole ?? 'kepala-daerah', cause: p.cause ?? null,
      reason: p.reason ?? { id: `Operasi pasar ${name.id}`, en: `Market operation: ${name.en}` },
    }
    return clearAnomaly({ ...s, marketOps: upsert(s.marketOps, op) }, p.marketIds, p.commodityId)
  },
}
