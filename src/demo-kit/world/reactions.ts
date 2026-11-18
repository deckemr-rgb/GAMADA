/**
 * world/reactions.ts — THE one place for cross-product effects (spec §6.1). Each reaction is a pure function
 * (event, state-after-reducer) → follow-up events. The engine runs them in array order (deterministic), with a
 * chain-depth limit (WORLD.maxDepth). Reactions must be idempotent-ish: they check state before re-emitting.
 */
import type { AnyFollowUp, Bi, ComplaintCluster, EventType, FollowUp, WorldEvent, WorldState } from './types'
import { MEDIA_OUTLETS, PUMP_PACKAGE, SOCIAL_HANDLES } from './texts'
import { EVENT_MENTION_TEXT, HOAX_SCENARIO, NOTIFY_TEXT } from './scenario-texts'
import { computeScore } from './score'
import { DAY_MIN, WORLD, distanceKm, hhmm, monthOf, picOf, ref, rows } from './util'

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

/** fill {key} placeholders in both languages */
const fillBi = (t: Bi, v: Record<string, string | number>): Bi => {
  const f = (x: string) => x.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
  return { id: f(t.id), en: f(t.en) }
}
const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
const desaName = (s: WorldState, kec: string, desa: string) => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
/** small deterministic pick from an event id (reactions stay pure and reproducible) */
const pickBy = <T>(arr: readonly T[], key: string): T => {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return arr[h % arr.length]!
}
const sentimentOf = (score: number) => (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral') as 'negatif' | 'netral' | 'positif'
/** the real dam name of the hoax scenario + the Siaga Wilayah gauge readings (simulated) */
function damFacts(s: WorldState): { dam: string; level: number; siaga: number } {
  const g = s.gauges.byId[s.meta.facts.hoax.gaugeId]
  return { dam: s.meta.facts.hoax.damName || g?.name || 'Bendungan', level: g?.level ?? 0, siaga: g?.siaga ?? 0 }
}

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

const TICKET_STATUS_TEXT: Record<string, Bi> = {
  baru: { id: 'Baru', en: 'New' }, diverifikasi: { id: 'Diverifikasi', en: 'Verified' }, diteruskan: { id: 'Diteruskan ke OPD', en: 'Forwarded to the agency' },
  diproses: { id: 'Diproses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Resolved' },
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
    const hps = items.reduce((a, i) => a + i.hpsPrice * i.qty, 0)
    const bidAt = e.at + 20
    const bids = [
      ...ring.map((bidderId, i) => ({ bidderId, price: Math.round((hps * (PUMP_PACKAGE.ringBid[i % PUMP_PACKAGE.ringBid.length] ?? 0.965)) / 1000) * 1000, at: bidAt + 7 * i })),
      ...independents.map((bidderId, i) => ({ bidderId, price: Math.round((hps * (PUMP_PACKAGE.independentBid[i] ?? 0.95)) / 1000) * 1000, at: bidAt + 90 + 41 * i })),
    ]
    return [fu('procurement.created', {
      key: PUMP_PACKAGE.key, name: PUMP_PACKAGE.name, opdId: opdLike(s, ['bpbd'], s.region.categoryOpd.banjir), hps,
      method: 'darurat', items, bidderIds: [...ring, ...independents], deadlineAt: e.at + PUMP_PACKAGE.scheduleDays * DAY_MIN, emergency: true, alertId: e.payload.id ?? null,
      bids, scheduleDays: PUMP_PACKAGE.scheduleDays, spec: PUMP_PACKAGE.spec, status: 'evaluasi',
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
      return fu('actionItem.created', { title: p.text, opdId, pic: picOf(opd, opdId), dueAt: p.dueAt ?? e.at + DAY_MIN, source: { kind: 'instruction', id: p.id ?? null } }, 'naskah-pintar')
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


  /* ---------------------------------------------------------------- tahap 2 · Satu Daerah chains */

  // complaint cluster ⇒ Siaga Wilayah: the complaints confirm the prediction on the ground
  react('cluster→flood-confirmed', 'complaint.clustered', (e, s) => {
    const p = e.payload
    if (p.category !== 'banjir' || !p.clusterId) return []
    const alert = rows(s.alerts).find((a) => a.status === 'aktif' && a.kind === 'banjir' && a.kecamatanIds.includes(p.kecamatanId))
    return [fu('flood.confirmed', { alertId: alert?.id ?? null, clusterId: p.clusterId, kecamatanId: p.kecamatanId, complaintIds: p.complaintIds }, 'siaga-wilayah')]
  }),
  // a NEW complaint cluster ⇒ Radar Isu: the surge becomes a topic
  react('cluster→radar-topic', 'complaint.clustered', (e, s) => {
    const p = e.payload
    const cl = s.clusters.byId[p.clusterId ?? '']
    if (!cl || cl.at !== e.at || cl.complaintIds.length !== p.complaintIds.length) return []
    const t = EVENT_MENTION_TEXT.cluster
    return [fu('mention.created', {
      outlet: pickBy(SOCIAL_HANDLES, e.id), kind: 'sosmed', author: pickBy(SOCIAL_HANDLES, `${e.id}a`), text: fillBi(t.t, { d: desaName(s, p.kecamatanId, p.desaId), k: kecName(s, p.kecamatanId), r: s.region.shortName }),
      sentiment: sentimentOf(t.s), score: t.s, topic: p.category === 'banjir' ? 'banjir' : 'layanan', reach: 2400 + p.complaintIds.length * 350,
    }, 'radar-isu')]
  }),
  // ticket status ⇒ the citizen's phone (Sapa Warga "HP Warga")
  react('ticket-status→citizen-phone', 'ticket.statusChanged', (e, s) => {
    const t = s.tickets.byId[e.payload.ticketId]
    const c = t ? s.complaints.byId[t.complaintId] : undefined
    if (!t || !c?.citizenId) return []
    const st = TICKET_STATUS_TEXT[e.payload.status] ?? { id: e.payload.status, en: e.payload.status }
    const opd = s.region.opd.find((o) => o.id === t.opdId)?.short ?? t.opdId
    const tail: Bi =
      e.payload.status === 'diteruskan' || e.payload.status === 'diproses' ? { id: `Ditangani ${opd}.`, en: `Handled by ${opd}.` }
      : e.payload.status === 'selesai' ? { id: 'Mohon beri penilaian 1–5.', en: 'Please rate us 1–5.' }
      : { id: '', en: '' }
    const text: Bi = {
      id: NOTIFY_TEXT.ticket.id.replace('{code}', c.code).replace('{status}', st.id).replace('{opd}', tail.id).trim(),
      en: NOTIFY_TEXT.ticket.en.replace('{code}', c.code).replace('{status}', st.en).replace('{opd}', tail.en).trim(),
    }
    return [fu('citizen.notified', { to: [c.citizenId], kind: 'tiket', refs: [ref('tickets', t.id), ref('complaints', c.id)], text }, 'sapa-warga')]
  }),
  // early-warning broadcast ⇒ phones of the citizens in the zone (Sapa Warga)
  react('broadcast→citizen-phones', 'alert.broadcast', (e, s) => {
    const a = s.alerts.byId[e.payload.alertId]
    if (!a) return []
    const zone = new Set(a.kecamatanIds)
    const desa = e.payload.desaIds?.length ? new Set(e.payload.desaIds) : null
    const to = s.citizens.ids.filter((id) => {
      const c = s.citizens.byId[id]
      return !!c && zone.has(c.kecamatanId) && (!desa || desa.has(c.desaId))
    })
    if (!to.length) return []
    const kec = a.kecamatanIds.map((k) => kecName(s, k)).join(', ')
    return [fu('citizen.notified', { to, kind: 'peringatan', refs: [ref('alerts', a.id)], text: e.payload.message ?? fillBi(NOTIFY_TEXT.alert, { level: a.level, kec }) }, 'sapa-warga')]
  }),
  // flood alert ⇒ Radar Isu: a news item opens the topic
  react('flood→radar-topic', 'flood.alert', (e, s) => {
    if (!e.payload.kecamatanIds.length) return []
    const t = EVENT_MENTION_TEXT.flood
    return [fu('mention.created', {
      outlet: pickBy(MEDIA_OUTLETS, e.id), kind: 'berita', author: 'Redaksi', text: fillBi(t.t, { k: e.payload.kecamatanIds.map((x) => kecName(s, x)).join(', '), r: s.region.shortName }),
      sentiment: sentimentOf(t.s), score: t.s, topic: 'banjir', reach: 9000 + 2500 * e.payload.level,
    }, 'radar-isu')]
  }),
  // rumor burst ⇒ hoax detected, with evidence from Siaga Wilayah (dam gauge normal)
  react('rumor-burst→hoax', 'mention.created', (e, s) => {
    const rumor = e.payload.rumor
    if (!rumor) return []
    if (rows(s.hoaxAlerts).some((h) => h.rumor === rumor)) return []
    const at = e.payload.at ?? e.at
    const burst = rows(s.mentions).filter((m) => m.rumor === rumor && m.at <= at && m.at >= at - WORLD.hoaxWindowMin)
    // fire on the crossing only: later posts of the SAME batch run their reactions before hoax.detected is reduced
    if (burst.length !== WORLD.hoaxBurstMin) return []
    const f = damFacts(s)
    const first = [...burst].sort((a, b) => a.at - b.at)
    const spanH = Math.max(0.25, (at - (first[0]?.at ?? at)) / 60)
    return [fu('hoax.detected', {
      claim: fillBi(HOAX_SCENARIO.claim, { dam: f.dam }), score: 0.93, spreadPerHour: Math.round(burst.reduce((n, m) => n + m.reach, 0) / spanH),
      accounts: [...new Set(first.map((m) => m.author))].slice(0, 4), topic: HOAX_SCENARIO.topic, rumor,
      // decimals per locale: "8,6 m" in Indonesian, "8.6 m" in English
      evidence: {
        id: fillBi(HOAX_SCENARIO.evidence, { dam: f.dam, level: f.level.toFixed(1).replace('.', ','), siaga: f.siaga.toFixed(1).replace('.', ',') }).id,
        en: fillBi(HOAX_SCENARIO.evidence, { dam: f.dam, level: f.level.toFixed(1), siaga: f.siaga.toFixed(1) }).en,
      },
    }, 'radar-isu')]
  }),
  // clarification ⇒ sentiment recovers over the next 30 world minutes (future-dated positive mentions)
  react('clarification→sentiment-recovery', 'clarification.published', (e, s) => {
    const h = s.hoaxAlerts.byId[e.payload.hoaxId]
    if (!h) return []
    const f = damFacts(s)
    const k = kecName(s, s.region.floodKecamatanIds[0] ?? '')
    return HOAX_SCENARIO.recovery.map((r, i) => fu('mention.created', {
      at: e.at + 6 * (i + 1), outlet: i % 2 ? pickBy(SOCIAL_HANDLES, `${e.id}${i}`) : pickBy(MEDIA_OUTLETS, `${e.id}${i}`), kind: i % 2 ? 'sosmed' : 'berita',
      author: i % 2 ? pickBy(SOCIAL_HANDLES, `${e.id}a${i}`) : 'Redaksi', text: fillBi(r.t, { dam: f.dam, r: s.region.shortName, k }), sentiment: sentimentOf(r.s), score: r.s,
      topic: h.topic, reach: 3000 + 1800 * (5 - i), hoaxId: h.id,
    }, 'radar-isu'))
  }),
  // post-flood harvest drop ⇒ Indeks Ekonomi (econ.updated) + Sinyal Pasar (supply signal)
  react('harvest→econ', 'harvest.updated', (e, s) => {
    if (e.payload.scenario !== 'pasca-banjir') return []
    const month = monthOf(s.day)
    return e.payload.kecamatanIds.flatMap((k) => {
      const x = s.econIndex.byId[`${k}:${month}`]
      if (!x) return []
      const drop = (e.payload.dropPctByKecamatan?.[k] ?? e.payload.dropPct ?? WORLD.harvestFloodDropPct) / 100
      const index = Math.round(x.index * (1 - drop * 0.22) * 10) / 10
      if (index === x.index) return []
      return [fu('econ.updated', { kecamatanId: k, month, index, delta: Math.round((index - x.index) * 10) / 10, reason: { id: `Estimasi panen Kec. ${kecName(s, k)} turun pascabanjir`, en: `Harvest estimate in ${kecName(s, k)} down after the flood` } }, 'indeks-ekonomi')]
    })
  }),
  react('harvest→supply-signal', 'harvest.updated', (e, s) => {
    if (e.payload.scenario !== 'pasca-banjir' || !e.payload.kecamatanIds.length) return []
    const kec = new Set(e.payload.kecamatanIds)
    const hit = new Map<string, { base: number; now: number }>()
    const total = new Map<string, number>()
    for (const h of rows(s.harvests)) {
      if (!h.commodityId) continue
      total.set(h.commodityId, (total.get(h.commodityId) ?? 0) + h.baselineTon)
      if (!kec.has(h.kecamatanId)) continue
      const v = hit.get(h.commodityId) ?? { base: 0, now: 0 }
      v.base += h.baselineTon
      v.now += h.estimateTon
      hit.set(h.commodityId, v)
    }
    const names = e.payload.kecamatanIds.map((k) => kecName(s, k)).join(', ')
    const out: AnyFollowUp[] = []
    for (const [commodityId, v] of hit) {
      const pct = -Math.round(((v.base - v.now) / Math.max(1, total.get(commodityId) ?? v.base)) * 1000) / 10
      if (pct > -0.5) continue
      const c = s.region.commodities.find((x) => x.id === commodityId)?.name ?? { id: commodityId, en: commodityId }
      const n = String(Math.abs(pct)).replace('.', ',')
      out.push(fu('supply.signal', {
        commodityId, kecamatanIds: e.payload.kecamatanIds, direction: 'turun', pct, horizonDays: 14, cause: e.payload.cause ?? null,
        reason: { id: `Pasokan ${c.id.toLowerCase()} dari Kec. ${names} diperkirakan turun ${n}% (estimasi panen pascabanjir)`, en: `${c.en} supply from ${names} expected ${Math.abs(pct)}% lower (post-flood harvest estimate)` },
      }, 'sinyal-pasar'))
    }
    return out
  }),
  // Awas Belanja recommendation ⇒ Katalog Lokal need (invite local UMKM as price benchmark / suppliers)
  react('procurement-recommendation→catalog-need', 'procurement.recommended', (e, s) => {
    const pr = s.procurements.byId[e.payload.procurementId]
    if (!pr || !e.payload.inviteLocal) return []
    const cause = ref('procurements', pr.id)
    if (rows(s.catalogNeeds).some((n) => n.cause === cause)) return []
    const kec = s.alerts.byId[pr.alertId ?? '']?.kecamatanIds[0] ?? s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? ''
    const cat = (n: string) => (/pompa|pump/i.test(n) ? 'pompa' : /genset|generator/i.test(n) ? 'genset' : /selang|hose/i.test(n) ? 'selang' : /solar|bbm|diesel fuel/i.test(n) ? 'bbm' : 'alat-kerja')
    return [fu('need.created', {
      title: { id: `${pr.name.id}: penawaran UMKM lokal`, en: `${pr.name.en}: local SME offers` },
      items: pr.items.map((it) => ({ name: it.name, category: cat(it.name.id), qty: it.qty, unit: it.unit })),
      kecamatanId: kec, deadlineDays: 3, emergency: pr.emergency, cause,
    }, 'katalog-lokal')]
  }),
  // MPP queue booking ⇒ queue ticket on the citizen's phone
  react('booking→citizen-phone', 'service.booked', (e, s) => {
    const cid = e.payload.citizenId
    if (!cid || !e.payload.id) return []
    const sv = s.region.services.find((x) => x.id === e.payload.serviceId)?.name ?? { id: e.payload.serviceId, en: e.payload.serviceId }
    const place: Bi = e.payload.channel === 'kecamatan' ? { id: 'kantor kecamatan', en: 'the district office' } : e.payload.channel === 'online' ? { id: 'layanan daring', en: 'the online service' } : { id: 'Mal Pelayanan Publik', en: 'the public service mall' }
    const code = e.payload.code ?? e.payload.id
    const time = hhmm(e.payload.slotAt)
    const t = NOTIFY_TEXT.booking
    return [fu('citizen.notified', {
      to: [cid], kind: 'antrean', refs: [ref('bookings', e.payload.id)],
      text: fillBi({ id: t.id.replace('{service}', sv.id).replace('{place}', place.id).replace('{time}', time.replace(':', '.')), en: t.en.replace('{service}', sv.en).replace('{place}', place.en) }, { code, time }),
    }, 'sapa-warga')]
  }),

  // hoax.detected ⇒ no automatic follow-up: the shell toasts Meja Pimpinan (EFFECT_TARGET); a human decides to clarify.
]
