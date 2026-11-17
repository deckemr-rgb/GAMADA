/**
 * world/reactions.ts — THE one place for cross-product effects (spec §6.1). Each reaction is a pure function
 * (event, state-after-reducer) → follow-up events. The engine runs them in array order (deterministic), with a
 * chain-depth limit (WORLD.maxDepth). Reactions must be idempotent-ish: they check state before re-emitting.
 */
import type { AnyFollowUp, ComplaintCluster, EventType, FollowUp, WorldEvent, WorldState } from './types'
import { PUMP_PACKAGE } from './texts'
import { computeScore } from './score'
import { DAY_MIN, WORLD, distanceKm, ref, rows } from './util'

export interface Reaction {
  /** stable name (tests, debugging) */
  id: string
  on: EventType
  run(e: WorldEvent, s: WorldState): AnyFollowUp[]
}

/** typed helper: `e.payload` is narrowed to the event's payload */
function react<K extends EventType>(id: string, on: K, run: (e: WorldEvent<K>, s: WorldState) => AnyFollowUp[]): Reaction {
  return { id, on, run: run as (e: WorldEvent, s: WorldState) => AnyFollowUp[] }
}
const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp

const FLOOD_TAGS = ['sandbag', 'pump', 'tarp']

function opdLike(s: WorldState, hints: string[], fallback: string): string {
  for (const h of hints) {
    const o = s.region.opd.find((x) => `${x.short} ${x.name}`.toLowerCase().includes(h))
    if (o) return o.id
  }
  return fallback
}

/** business score follow-up when the derived score actually moved */
function rescore(s: WorldState, businessId: string, reason: { id: string; en: string }): AnyFollowUp[] {
  const prev = s.bizScores.byId[businessId]
  const next = computeScore(s, businessId)
  if (!prev || !next) return []
  const delta = next.score - prev.score
  if (delta === 0) return []
  return [fu('score.updated', { businessId, score: next.score, delta, reason, factors: next.factors }, 'rapor-usaha')]
}

export const REACTIONS: Reaction[] = [
  /* ---------------------------------------------------------------- flood.alert ⇒ 4 effects */
  react('flood→pump-procurement', 'flood.alert', (e, s) => {
    // (a) Awas Belanja: emergency pump package appears (NOT flagged yet — the analyst runs the detectors later)
    const exists = rows(s.procurements).some((p) => p.key === PUMP_PACKAGE.key && p.status !== 'selesai')
    if (exists) return []
    const ring = rows(s.bidders).filter((b) => b.ring === 'pompa').map((b) => b.id)
    const independents = s.bidders.ids.filter((id) => !s.bidders.byId[id]?.ring).sort().slice(0, 2)
    const items = PUMP_PACKAGE.items.map((i) => ({ ...i }))
    return [fu('procurement.created', {
      key: PUMP_PACKAGE.key, name: PUMP_PACKAGE.name, opdId: opdLike(s, ['bpbd'], s.region.categoryOpd.banjir), hps: items.reduce((a, i) => a + i.hpsPrice * i.qty, 0),
      method: 'darurat', items, bidderIds: [...ring, ...independents], deadlineAt: e.at + 3 * DAY_MIN, emergency: true, alertId: e.payload.id ?? null,
    }, 'awas-belanja')]
  }),
  react('flood→stock-forecast', 'flood.alert', (e, s) => {
    // (b) Toko Autopilot: sandbags, pumps and tarps surge (+340 %)
    const ids = s.products.ids.filter((id) => {
      const p = s.products.byId[id]
      const st = s.stock.byId[id]
      return p && st && p.tags.some((t) => FLOOD_TAGS.includes(t)) && st.factor < WORLD.floodDemandFactor
    })
    if (!ids.length) return []
    return [fu('stock.forecastChanged', {
      productIds: ids, factor: WORLD.floodDemandFactor,
      reason: { id: 'Permintaan diperkirakan naik 340% karena peringatan banjir', en: 'Demand expected to rise 340% because of the flood warning' },
      cause: ref('alerts', e.payload.id ?? ''),
    }, 'toko-autopilot')]
  }),
  react('flood→catalog-need', 'flood.alert', (e, s) => {
    // (c) Katalog Lokal: sandbags + tarps for the flooded kecamatan
    const kec = e.payload.kecamatanIds[0]
    if (!kec) return []
    const cause = ref('alerts', e.payload.id ?? '')
    if (rows(s.catalogNeeds).some((n) => n.cause === cause)) return []
    const name = s.region.kecamatan.find((k) => k.id === kec)?.name ?? kec
    const bags = e.payload.level >= 3 ? 2000 : 1000
    return [fu('need.created', {
      title: { id: `Karung pasir & terpal untuk Kec. ${name}`, en: `Sandbags & tarps for ${name} district` },
      items: [
        { name: { id: 'Karung pasir', en: 'Sandbags' }, category: 'karung-pasir', qty: bags, unit: 'lembar' },
        { name: { id: 'Terpal 4x6 m', en: 'Tarp 4x6 m' }, category: 'terpal', qty: 50, unit: 'lembar' },
      ],
      kecamatanId: kec, deadlineDays: 2, emergency: true, cause,
    }, 'katalog-lokal')]
  }),
  react('flood→aid-eligibility', 'flood.alert', (e, s) => {
    // (d) Cek Berkas: flood-relief bansos registration opens (documents are checked against the alert zone)
    const alertId = e.payload.id ?? null
    if (rows(s.programs).some((p) => p.alertId === alertId && p.open)) return []
    return [fu('eligibility.opened', { kind: 'bansos-banjir', kecamatanIds: e.payload.kecamatanIds, quota: 150 * e.payload.kecamatanIds.length, alertId }, 'cek-berkas')]
  }),

  /* ---------------------------------------------------------------- price.anomaly ⇒ market-operation suggestion */
  react('price-anomaly→market-operation', 'price.anomaly', (e, s) => {
    const open = rows(s.marketOps).some((m) => m.commodityId === e.payload.commodityId && (m.stage === 'recommended' || m.stage === 'approved' || m.stage === 'running'))
    if (open) return []
    const c = s.region.commodities.find((x) => x.id === e.payload.commodityId)?.name ?? { id: e.payload.commodityId, en: e.payload.commodityId }
    const market = s.markets.byId[e.payload.marketId]?.name ?? e.payload.marketId
    const d = Math.round(e.payload.deltaPct)
    return [fu('market.operation', {
      stage: 'recommended', commodityId: e.payload.commodityId, marketIds: [e.payload.marketId], forRole: 'kepala-daerah', effectPct: -Math.max(3, Math.round(d * 0.6)),
      reason: { id: `Harga ${c.id} di ${market} ${d}% di atas pola musiman. Sarankan operasi pasar.`, en: `${c.en} at ${market} is ${d}% above its seasonal pattern. Suggest a market operation.` },
      cause: ref('prices', `${e.payload.marketId}:${e.payload.commodityId}`),
    }, 'sinyal-pasar')]
  }),

  /* ---------------------------------------------------------------- complaint.created (banjir) ⇒ cluster */
  react('flood-complaints→cluster', 'complaint.created', (e, s) => {
    const p = e.payload
    if (p.category !== 'banjir' || !p.id) return []
    const today = Math.floor(e.at / DAY_MIN) * DAY_MIN
    // join an existing cluster close by (updated today)
    const near: ComplaintCluster | undefined = rows(s.clusters).find((c) => c.category === 'banjir' && c.updatedAt >= today && distanceKm(c.center, p.coord) <= WORLD.clusterRadiusKm)
    if (near) {
      if (near.complaintIds.includes(p.id)) return []
      return [fu('complaint.clustered', { clusterId: near.id, category: 'banjir', kecamatanId: near.kecamatanId, desaId: near.desaId, center: near.center, radiusKm: near.radiusKm, complaintIds: [p.id] }, 'sapa-warga')]
    }
    const similar = rows(s.complaints).filter((c) => c.category === 'banjir' && !c.clusterId && c.at >= today && c.at <= e.at && distanceKm(c.coord, p.coord) <= WORLD.clusterRadiusKm)
    if (similar.length < WORLD.clusterMin) return []
    const ids = similar.map((c) => c.id).sort()
    return [fu('complaint.clustered', { category: 'banjir', kecamatanId: p.kecamatanId, desaId: p.desaId, center: p.coord, radiusKm: WORLD.clusterRadiusKm, complaintIds: ids }, 'sapa-warga')]
  }),

  /* ---------------------------------------------------------------- instruction.issued ⇒ disposition + tasks */
  react('instruction→disposition', 'instruction.issued', (e) => {
    const p = e.payload
    if (!p.id || !p.opdIds.length) return []
    return [fu('letter.dispositioned', { subject: p.text, to: p.opdIds, note: p.text, by: 'Kepala Daerah', instructionId: p.id }, 'naskah-pintar')]
  }),
  react('instruction→action-items', 'instruction.issued', (e, s) => {
    const p = e.payload
    if (!p.id) return []
    return p.opdIds.map((opdId) => {
      const opd = s.region.opd.find((o) => o.id === opdId)
      return fu('actionItem.created', { title: p.text, opdId, pic: `Kepala ${opd?.short ?? opdId}`, dueAt: p.dueAt ?? e.at + DAY_MIN, source: { kind: 'instruction', id: p.id ?? null } }, 'naskah-pintar')
    })
  }),

  /* ---------------------------------------------------------------- sale.created ⇒ journal */
  react('sale→ledger', 'sale.created', (e, s) => {
    const sale = s.sales.byId[e.payload.id ?? '']
    if (!sale) return []
    let cost = 0
    for (const it of sale.items) cost += it.qty * (s.products.byId[it.productId]?.cost ?? 0)
    const cashAcc = sale.payment === 'tunai' ? 'Kas' : 'Bank'
    const lines = [{ account: cashAcc, debit: sale.total, credit: 0 }, { account: 'Pendapatan Penjualan', debit: 0, credit: sale.total }]
    if (cost > 0) lines.push({ account: 'HPP', debit: cost, credit: 0 }, { account: 'Persediaan', debit: 0, credit: cost })
    return [fu('ledger.posted', { businessId: sale.businessId, memo: { id: `Penjualan ${sale.code}`, en: `Sale ${sale.code}` }, lines, source: 'sale', refId: sale.id, needsReview: false, confidence: 0.99 }, 'pajak-beres')]
  }),

  /* ---------------------------------------------------------------- compliance ⇒ business score */
  react('ledger→score', 'ledger.posted', (e, s) => rescore(s, e.payload.businessId, { id: 'Pembukuan diperbarui', en: 'Bookkeeping updated' })),
  react('tax→score', 'tax.ready', (e, s) => rescore(s, e.payload.businessId, { id: 'Pajak siap dilaporkan', en: 'Tax ready to file' })),
  react('kyb→score', 'partner.verified', (e, s) => (e.payload.subjectKind === 'business' ? rescore(s, e.payload.subjectId, { id: 'Verifikasi KYB', en: 'KYB verification' }) : [])),

  // hoax.detected ⇒ nothing automatic. Radar Isu shows a toast; a human decides to publish a clarification.
]
