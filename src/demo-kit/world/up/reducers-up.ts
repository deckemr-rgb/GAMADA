/**
 * world/up/reducers-up.ts — reducers of the Usaha Pintar event types of the chains / user actions (registered through world/ext.ts; the core
 * keeps the existing types' reducers). Pure, structural sharing.
 */
import type { EventType, PurchaseOrder, WorldEvent, WorldState } from '../types'
import { patch, patchMany, upsert } from '../util'

type R<K extends EventType> = (s: WorldState, e: WorldEvent<K>) => WorldState
const must = <T>(v: T | undefined | null, what: string): T => {
  if (v === undefined || v === null) throw new Error(`reducer: missing ${what}`)
  return v
}

export const UP_REDUCERS: { [K in EventType]?: R<K> } = {
  'po.drafted': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'po id')
    const total = p.items.reduce((a, it) => a + it.qty * it.cost, 0)
    const po: PurchaseOrder = { id, code: p.code ?? id, businessId: p.businessId, supplierId: p.supplierId, items: p.items, total, status: 'draf', at: e.at, reply: null, reason: p.reason, cause: p.cause ?? null }
    return { ...s, purchaseOrders: upsert(s.purchaseOrders, po) }
  },
  // goods in: stock up, PO received. NO journal here: the purchase is booked when Pajak Beres processes the nota
  'po.received': (s, e) => {
    const po = s.purchaseOrders.byId[e.payload.poId]
    if (!po || po.status === 'diterima') return s
    const qty = new Map<string, number>()
    for (const it of po.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.qty)
    return {
      ...s,
      purchaseOrders: patch(s.purchaseOrders, po.id, (x) => ({ ...x, status: 'diterima', receivedAt: e.at })),
      stock: patchMany(s.stock, [...qty.keys()], (st) => ({ ...st, onHand: st.onHand + (qty.get(st.id) ?? 0), updatedAt: e.at })),
    }
  },
  'price.changed': (s, e) => ({ ...s, products: patch(s.products, e.payload.productId, (p) => ({ ...p, price: e.payload.price })) }),
  'promo.created': (s, e) => {
    const p = e.payload
    return { ...s, promos: upsert(s.promos, { id: must(p.id, 'promo id'), businessId: s.meta.shopId, title: p.title, productIds: p.productIds, discountPct: p.discountPct, until: p.until, at: e.at }) }
  },
  'shift.updated': (s, e) => {
    const p = e.payload
    const id = must(p.shiftId, 'shift id')
    return { ...s, shifts: upsert(s.shifts, { id, staffId: p.staffId, outletId: p.outletId, day: p.day, start: p.start, end: p.end, origin: 'manual' }) }
  },
  'shift.closed': (s, e) => {
    const p = e.payload
    return { ...s, cashShifts: upsert(s.cashShifts, { id: must(p.id, 'cash shift id'), staffId: p.staffId, outletId: p.outletId, expectedCash: p.expectedCash, countedCash: p.countedCash, variance: p.variance, tx: p.tx, at: e.at }) }
  },
  'pos.noticeSet': (s, e) => ({ ...s, posNotices: upsert(s.posNotices, { id: e.payload.announcementId, outletIds: e.payload.outletIds, text: e.payload.text, at: e.at }) }),

  /* ---------------------------------------------------------------- Pajak Beres */
  'nota.received': (s, e) => ({ ...s, purchaseOrders: patch(s.purchaseOrders, e.payload.poId, (po) => (po.notaAt != null ? po : { ...po, notaAt: e.at })) }),
  'ledger.reviewed': (s, e) => ({
    ...s,
    ledger: patch(s.ledger, e.payload.ledgerId, (j) => ({ ...j, needsReview: false, confidence: 1, ...(e.payload.lines ? { lines: e.payload.lines } : {}) })),
  }),
  'bank.imported': (s, e) => {
    const p = e.payload
    return { ...s, bankImports: upsert(s.bankImports, { id: must(p.id, 'import id'), businessId: p.businessId, period: p.period, rows: p.rows, matched: p.matched, posted: p.posted, review: p.review, bank: p.bank, at: e.at }) }
  },
  'tax.computed': (s, e) => ({ ...s, taxItems: patch(s.taxItems, e.payload.taxItemId, (t) => ({ ...t, amount: e.payload.amount })) }),
  'period.locked': (s, e) => ({
    ...s,
    businesses: patch(s.businesses, e.payload.businessId, (b) => (b.lockedPeriods?.includes(e.payload.period) ? b : { ...b, lockedPeriods: [...(b.lockedPeriods ?? []), e.payload.period] })),
  }),

  /* ---------------------------------------------------------------- Juara Jualan */
  'roleplay.completed': (s, e) => {
    const p = e.payload
    return {
      ...s,
      roleplays: upsert(s.roleplays, { id: must(p.id, 'roleplay id'), agentId: p.agentId, coachingId: p.coachingId, persona: p.persona, industry: p.industry, turns: p.turns, score: p.score, baseline: p.baseline, criteria: p.criteria, at: e.at }),
      coachings: p.coachingId ? patch(s.coachings, p.coachingId, (c) => (c.status === 'selesai' ? c : { ...c, status: 'selesai' })) : s.coachings,
    }
  },

  /* ---------------------------------------------------------------- Kenal Mitra */
  // a second request for a subject that is already queued updates that request (priority, need) instead of adding one
  'brand.alert': (s, e) => {
    const p = e.payload
    return {
      ...s,
      brandAlerts: upsert(s.brandAlerts, {
        id: must(p.id, 'brand alert id'), businessId: p.businessId, topic: p.topic, volume: p.volume, deltaPct: p.deltaPct, at: p.at ?? e.at, mentionIds: p.mentionIds ?? [],
        causeRef: p.causeRef ?? null, baselinePer2h: p.baselinePer2h ?? 0, cause: p.cause ?? null, status: 'aktif',
      }),
    }
  },
  'brand.replied': (s, e) => {
    const p = e.payload
    return {
      ...s,
      brandMentions: patchMany(s.brandMentions, p.mentionIds, (m) => {
        const i = p.mentionIds.indexOf(m.id)
        return { ...m, reply: p.replies[i] ?? p.replies[0] ?? null, repliedAt: e.at, replyTone: p.tone, repliedBy: p.by }
      }),
    }
  },
  // the alert is handled; the scheduled burst posts still in the future are withdrawn (the trickle stops)
  'brand.announced': (s, e) => {
    const p = e.payload
    const id = must(p.id, 'announcement id')
    const al = s.brandAlerts.byId[p.alertId]
    const drop = al
      ? s.brandMentions.ids.filter((x) => {
          const m = s.brandMentions.byId[x]
          return !!m && m.at > e.at && m.cause === al.causeRef && m.brand === al.businessId && m.sentiment === 'negatif'
        })
      : []
    let mentions = s.brandMentions
    if (drop.length) {
      const gone = new Set(drop)
      const byId = { ...mentions.byId }
      for (const x of drop) delete byId[x]
      mentions = { byId, ids: mentions.ids.filter((x) => !gone.has(x)) }
    }
    return {
      ...s,
      brandMentions: mentions,
      brandAnnouncements: upsert(s.brandAnnouncements, { id, businessId: p.businessId, alertId: p.alertId, topic: p.topic, text: p.text, channels: p.channels, offer: p.offer, by: p.by, at: e.at }),
      brandAlerts: patch(s.brandAlerts, p.alertId, (a) => ({ ...a, status: 'ditangani', mentionIds: a.mentionIds.filter((x) => !drop.includes(x)) })),
    }
  },

  /* ---------------------------------------------------------------- TenderPilot · Awas Belanja */
  'procurement.bidReceived': (s, e) => {
    const p = e.payload
    return {
      ...s,
      procurements: patch(s.procurements, p.procurementId, (x) =>
        x.bids?.some((b) => b.bidderId === p.bidderId)
          ? x
          : { ...x, bidderIds: x.bidderIds.includes(p.bidderId) ? x.bidderIds : [...x.bidderIds, p.bidderId], bids: [...(x.bids ?? []), { bidderId: p.bidderId, price: p.price, at: e.at }] },
      ),
    }
  },
}

/** ids assigned at emit time (see events.ts ID_FIELDS) */
export const UP_CHAIN_ID_FIELDS = {
  'po.drafted': [['id', 'purchaseOrders', true]],
  'promo.created': [['id', 'promos']],
  'shift.updated': [['shiftId', 'shifts']],
  'shift.closed': [['id', 'cashShifts']],
  'bank.imported': [['id', 'bankImports']],
  'roleplay.completed': [['id', 'roleplays']],
  'brand.alert': [['id', 'brandAlerts']],
  'brand.announced': [['id', 'brandAnnouncements']],
} as const
