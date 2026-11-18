/**
 * world/reducers-core.ts — the reducers of the event types a demo raises without any visitor input: the natural
 * events of a running clock (complaints, mentions, prices, sales → journal → business score) and Awas Belanja's
 * automatic screening (procurement.flagged). The store runs those through the small core pipeline (engine-core.ts)
 * and downloads the full one (engine.ts) only when another event type arrives. reducers.ts spreads CORE_REDUCERS
 * into REDUCERS, so both pipelines apply the very same functions.
 */
import type { Sale, SalesDay, Ticket } from './types'
import type { ReducerMap } from './reducers'
import { CATEGORY_LABEL } from './labels'
import { complaintRouting } from './texts'
import { DAY_MIN, patch, patchMany, upsert } from './util'

export const must = <T>(v: T | undefined | null, what: string): T => {
  if (v === undefined || v === null) throw new Error(`reducer: missing ${what}`)
  return v
}

export const CORE_REDUCERS: ReducerMap = {
  'complaint.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'complaint id')
    const ticketId = must(p.ticketId, 'ticket id')
    // life-safety flood reports (evacuation, trapped residents) → BPBD with a 60-minute SLA
    const route = complaintRouting(s.region, p.category, p.text)
    const ticket: Ticket = {
      id: ticketId, code: p.code ?? id, complaintId: id, status: 'baru', opdId: route.opdId, createdAt: e.at, updatedAt: e.at,
      slaDueAt: e.at + route.slaMin, closedAt: null, rating: null, history: [{ at: e.at, status: 'baru' }],
    }
    return {
      ...s,
      complaints: upsert(s.complaints, {
        id, code: p.code ?? id, citizenId: p.citizenId ?? null, category: p.category, channel: p.channel, text: p.text, lang: p.lang ?? 'id',
        summary: p.summary ?? { id: p.text, en: `${CATEGORY_LABEL[p.category].en} report` }, kecamatanId: p.kecamatanId, desaId: p.desaId, coord: p.coord,
        urgency: p.urgency ?? 'sedang', at: e.at, ticketId, clusterId: null, templateId: p.templateId, photo: p.photo,
      }),
      tickets: upsert(s.tickets, ticket),
    }
  },
  'mention.created': (s, e) => ({ ...s, mentions: upsert(s.mentions, { ...e.payload, id: must(e.payload.id, 'mention id'), at: e.payload.at ?? e.at }) }),
  'price.updated': (s, e) => ({ ...s, prices: patch(s.prices, `${e.payload.marketId}:${e.payload.commodityId}`, (x) => ({ ...x, price: e.payload.price, updatedAt: e.at })) }),
  'sale.created': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'sale id')
    const outlet = s.outlets.byId[p.outletId]
    const total = p.items.reduce((a, it) => a + it.qty * it.price, 0)
    let cost = 0
    for (const it of p.items) cost += it.qty * (s.products.byId[it.productId]?.cost ?? 0)
    const sale: Sale = { id, code: p.code ?? id, outletId: p.outletId, businessId: outlet?.businessId ?? s.meta.shopId, at: e.at, items: p.items, total, payment: p.payment }
    const day = Math.floor(e.at / DAY_MIN)
    const dayId = `${p.outletId}:${day}`
    const prev = s.salesDaily.byId[dayId]
    const sd: SalesDay = prev ? { ...prev, revenue: prev.revenue + total, cost: prev.cost + cost, tx: prev.tx + 1 } : { id: dayId, outletId: p.outletId, day, revenue: total, cost, tx: 1 }
    const qty = new Map<string, number>()
    for (const it of p.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.qty)
    return {
      ...s,
      sales: upsert(s.sales, sale),
      salesDaily: upsert(s.salesDaily, sd),
      stock: patchMany(s.stock, [...qty.keys()], (st) => ({ ...st, onHand: Math.max(0, st.onHand - (qty.get(st.id) ?? 0)), updatedAt: e.at })),
    }
  },
  'ledger.posted': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'ledger id')
    // re-posting an existing id replaces it (e.g. "rapikan jurnal" clears needsReview)
    return {
      ...s,
      ledger: upsert(s.ledger, {
        id, businessId: p.businessId, at: s.ledger.byId[id]?.at ?? e.at, memo: p.memo, lines: p.lines, source: p.source, refId: p.refId ?? null,
        needsReview: p.needsReview ?? false, confidence: p.confidence ?? 0.98,
      }),
    }
  },
  'score.updated': (s, e) => ({
    ...s,
    bizScores: patch(s.bizScores, e.payload.businessId, (b) => {
      const history = [...b.history]
      history[history.length - 1] = e.payload.score
      return { ...b, score: e.payload.score, factors: e.payload.factors ?? b.factors, history, updatedAt: e.at }
    }),
  }),
  'procurement.flagged': (s, e) => ({
    ...s,
    procurements: patch(s.procurements, e.payload.procurementId, (p) => ({ ...p, riskScore: e.payload.riskScore, flagged: true, findings: e.payload.findings })),
  }),
}
