/**
 * world/up/reactions-up.ts — the Usaha Pintar cross-product chains C15–C21, C23–C29 (C14 'sale→ledger' is a core reaction,
 * C22 'tender→match' is in reactions-boot.ts because the 07:01 natural tender needs it).
 * Pure: (event, state after its reducer) → follow-ups; idempotent by state checks. Registered through world/ext.ts,
 * after the core reactions. Rule (self-test): never on a CORE_EVENT_TYPES type.
 */
import type { AnyFollowUp, Bi, BrandMention, CatalogNeed, EventType, FollowUp, WorldEvent, WorldState } from '../types'
import { DAY_MIN, distanceKm, ref, rows } from '../util'
import { rescore } from '../reactions-core'
import { BRAND_BURST, EMERGENCY_TENDER, UP } from './config'
import { PRAPESAN_CLIP, desaName, kecName, pickBy, shopOutlets, unitOf } from './base'
import { COMPETITOR_TEXT, HANDLES, fillBi } from './texts'
import { BURST_DELIVERY, BURST_HARGA, BURST_STOK, PO_REASON, RECOVERY_TEXT } from './texts-chains'
import { pctTxt, poLines, shopPo, supplierReply } from './po'
import { procurementOfTender } from './base'

export interface UpReaction { id: string; on: EventType; run(e: WorldEvent, s: WorldState): AnyFollowUp[] }
const react = <K extends EventType>(id: string, on: K, run: (e: WorldEvent<K>, s: WorldState) => AnyFollowUp[]): UpReaction => ({ id, on, run: run as UpReaction['run'] })
const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp

const activeFlood = (s: WorldState) => rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif')

export { poLines, supplierReply, procurementOfTender }
/** the open emergency need a tender/KYB chain reads */
const needItemsCovered = (n: CatalogNeed, supplies: string[]) => n.items.every((i) => supplies.includes(i.category))

/** the chains loaded on the first interaction (or before an event they react on): C15–C21, C23–C29 */
export const UP_CHAIN_REACTIONS: readonly UpReaction[] = [
  /* C15 forecast → PO drafts per supplier */
  react('forecast→po-draft', 'stock.forecastChanged', (e, s) => {
    const shopId = s.meta.shopId
    const cause = e.payload.cause ?? null
    if (cause && rows(s.purchaseOrders).some((p) => p.status === 'draf' && p.cause === cause)) return []
    const bySup = new Map<string, string[]>()
    for (const id of e.payload.productIds) {
      const p = s.products.byId[id]
      if (!p || p.businessId !== shopId || !p.supplierId) continue
      bySup.set(p.supplierId, [...(bySup.get(p.supplierId) ?? []), id])
    }
    const out: AnyFollowUp[] = []
    const causeTxt: Bi = cause?.startsWith('alerts:') ? { id: 'peringatan banjir', en: 'the flood warning' } : { id: 'lonjakan harga pasar', en: 'the market price jump' }
    for (const [supplierId, ids] of [...bySup].sort((a, b) => a[0].localeCompare(b[0]))) {
      const sup = s.suppliers.byId[supplierId]
      const lines = poLines(s, ids, sup?.leadDays ?? 2).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6)
      if (!lines.length) continue
      const first = s.products.byId[lines[0]!.productId]!
      const tpl = pickBy(PO_REASON, supplierId)
      const v = { pct: pctTxt(e.payload.factor), item: first.name, days: lines[0]!.daysLeft }
      const reason = { id: fillBi(tpl, { ...v, cause: causeTxt.id }).id, en: fillBi(tpl, { ...v, cause: causeTxt.en }).en }
      out.push(fu('po.drafted', { businessId: shopId, supplierId, items: lines.map(({ productId, qty, cost }) => ({ productId, qty, cost })), reason, cause }, 'toko-autopilot'))
    }
    return out
  }),
  /* C16 PO sent → the supplier answers (pool, ETA: flood goods next 07.00) */
  react('po→supplier-reply', 'po.sent', (e, s) => {
    const po = shopPo(s, e.payload.id ?? '')
    if (!po || po.reply) return []
    const r = supplierReply(s, po.id)
    return [fu('supplier.replied', { poId: po.id, supplierId: po.supplierId, message: r.message, eta: r.eta, tpl: r.tpl }, 'toko-autopilot')]
  }),
  /* C17 PO sent → a WA pre-order chat lands in Juara Jualan (the new cashier) */
  react('po→sales-chat', 'po.sent', (e, s) => {
    const po = shopPo(s, e.payload.id ?? '')
    const agentId = s.meta.facts.up?.newCashierAgentId
    if (!po || !agentId || rows(s.calls).some((c) => c.refId === po.id)) return []
    const alert = activeFlood(s)
    const kecId = alert?.kecamatanIds[0] ?? s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? ''
    const desa = s.region.kecamatan.find((k) => k.id === kecId)?.desa[0]?.name ?? kecName(s, kecId)
    return [fu('call.created', {
      agentId, industry: 'toko-bangunan', channel: 'wa', customer: `Pengurus musala Desa ${desa}`, transcript: PRAPESAN_CLIP, durationSec: 0, refId: po.id, topic: alert ? 'banjir' : null,
    }, 'juara-jualan')]
  }),
  /* C18 supplier replied → the nota reaches Pajak Beres (once per PO) */
  react('supplier-reply→nota', 'supplier.replied', (e, s) => {
    const po = shopPo(s, e.payload.poId)
    if (!po || po.notaAt != null) return []
    return [fu('nota.received', { businessId: po.businessId, poId: po.id, supplierId: po.supplierId, total: po.total }, 'pajak-beres')]
  }),
  /* C19 a reviewed journal row moves the business score */
  react('ledger-reviewed→score', 'ledger.reviewed', (e, s) => {
    const j = s.ledger.byId[e.payload.ledgerId]
    return j ? rescore(s, j.businessId, { id: 'Jurnal ditinjau', en: 'Journal reviewed' }) : []
  }),
  /* C20 market price anomaly → market-ingredient SKUs of the warung / kopi */
  react('price-anomaly→shop-stock', 'price.anomaly', (e, s) => {
    const tag = `cm:${e.payload.commodityId}`
    const ids = s.products.ids.filter((id) => s.products.byId[id]?.tags.includes(tag) && (s.stock.byId[id]?.factor ?? 9) < UP.priceAnomalyFactor)
    if (!ids.length) return []
    const c = s.region.commodities.find((x) => x.id === e.payload.commodityId)?.name ?? { id: e.payload.commodityId, en: e.payload.commodityId }
    const d = Math.round(e.payload.deltaPct)
    return [fu('stock.forecastChanged', {
      productIds: ids, factor: UP.priceAnomalyFactor, cause: ref('prices', `${e.payload.marketId}:${e.payload.commodityId}`),
      reason: { id: `Harga ${c.id} di pasar naik ${d}%: warung menimbun stok, permintaan bahan +60%`, en: `${c.en} at the market is up ${d}%: kitchens stock up, ingredient demand +60%` },
    }, 'toko-autopilot')]
  }),
  /* C21 an emergency need the shop can supply → the emergency tender */
  react('need→tender', 'need.created', (e, s) => {
    const n = s.catalogNeeds.byId[e.payload.id ?? '']
    const shop = s.businesses.byId[s.meta.shopId]
    if (!n || !n.emergency || !shop || !needItemsCovered(n, shop.supplies)) return []
    // one emergency tender at a time (a second alert the same day raises a second need, not a second tender)
    if (rows(s.tenders).some((t) => t.key === EMERGENCY_TENDER.key && (t.needId === n.id || t.status === 'dibuka'))) return []
    const items = n.items.filter((i) => EMERGENCY_TENDER.hps[i.category]).map((i) => ({ name: i.name, category: i.category, qty: i.qty, unit: i.unit, hpsPrice: EMERGENCY_TENDER.hps[i.category]! }))
    if (!items.length) return []
    const hps = items.reduce((a, i) => a + i.qty * i.hpsPrice, 0)
    const bpbd = s.region.opd.find((o) => /bpbd/i.test(`${o.id} ${o.short}`))?.id ?? s.region.categoryOpd.banjir
    const deadline = (Math.floor(e.at / DAY_MIN) + EMERGENCY_TENDER.deadlineDays) * DAY_MIN + EMERGENCY_TENDER.deadlineAt
    return [fu('tender.created', {
      key: EMERGENCY_TENDER.key, needId: n.id, title: EMERGENCY_TENDER.title, opdId: bpbd, kbli: EMERGENCY_TENDER.kbli, value: hps, hps, kecamatanId: n.kecamatanId, publishedAt: e.at,
      deadlineAt: deadline, emergency: true, competitors: EMERGENCY_TENDER.competitors, method: 'darurat', requirements: [...EMERGENCY_TENDER.requirements], items, procurementId: null,
      spec: EMERGENCY_TENDER.spec,
    }, 'tenderpilot')]
  }),
  /* C23 an emergency tender (not a mirror) → the package appears in Awas Belanja (clean spec, no ring) */
  react('tender→procurement', 'tender.created', (e, s) => {
    const t = s.tenders.byId[e.payload.id ?? '']
    if (!t || t.method !== 'darurat' || t.procurementId || !t.key) return []
    if (rows(s.procurements).some((p) => p.key === t.key && p.status !== 'selesai')) return []
    const need = t.needId ? s.catalogNeeds.byId[t.needId] : undefined
    const alertId = need?.cause?.startsWith('alerts:') ? need.cause.slice(7) : null
    return [fu('procurement.created', {
      key: t.key, name: t.title, opdId: t.opdId, hps: t.hps ?? t.value, method: 'darurat',
      items: (t.items ?? []).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, hpsPrice: i.hpsPrice, marketPrice: Math.round(i.hpsPrice * 0.94) })),
      bidderIds: [], deadlineAt: t.deadlineAt, emergency: true, alertId, bids: [], scheduleDays: Math.max(1, Math.round((t.deadlineAt - t.publishedAt) / DAY_MIN)), spec: t.spec, status: 'pengumuman',
    }, 'awas-belanja')]
  }),
  /* C24 the flood pump package → its TenderPilot mirror (the affiliated ring makes the chance low) */
  react('pump→tender', 'procurement.created', (e, s) => {
    const p = s.procurements.byId[e.payload.id ?? '']
    if (!p || p.key !== 'pompa-darurat' || rows(s.tenders).some((t) => t.procurementId === p.id)) return []
    return [fu('tender.created', {
      key: p.key, procurementId: p.id, title: p.name, opdId: p.opdId, kbli: EMERGENCY_TENDER.kbli, value: p.hps, hps: p.hps, kecamatanId: s.region.floodKecamatanIds[0] ?? s.businesses.byId[s.meta.shopId]!.kecamatanId,
      publishedAt: e.at, deadlineAt: p.deadlineAt, emergency: true, competitors: p.bidderIds.length, method: 'darurat', requirements: [...EMERGENCY_TENDER.requirements], needId: null,
      items: p.items.map((i) => ({ name: i.name, category: 'pompa', qty: i.qty, unit: i.unit, hpsPrice: i.hpsPrice })), ...(p.spec ? { spec: p.spec } : {}),
    }, 'tenderpilot')]
  }),
  /* C25 the shop's bid on a tender with an Awas Belanja package → the bid reaches the package */
  react('bid→procurement', 'bid.submitted', (e, s) => {
    const t = s.tenders.byId[e.payload.tenderId]
    const pid = t ? procurementOfTender(s, t) : null
    const bidderId = s.meta.facts.up?.shopBidderId
    if (!pid || !bidderId || e.payload.businessId !== s.meta.shopId) return []
    if (s.procurements.byId[pid]?.bids?.some((b) => b.bidderId === bidderId)) return []
    return [fu('procurement.bidReceived', { procurementId: pid, bidderId, businessId: e.payload.businessId, price: e.payload.price, bidId: e.payload.id ?? '' }, 'awas-belanja')]
  }),
  /* C26 a need → up to 2 unverified suppliers in range get a priority KYB request (the hero first) */
  react('need→vendor-kyb', 'need.created', (e, s) => {
    const n = s.catalogNeeds.byId[e.payload.id ?? '']
    if (!n) return []
    const kec = s.region.kecamatan.find((k) => k.id === n.kecamatanId)
    const hero = s.meta.facts.up?.kenalMitra.heroBusinessId
    const cats = new Set(n.items.map((i) => i.category))
    const cands = rows(s.businesses)
      .filter((b) => !b.verified && b.id !== s.meta.shopId && b.supplies.some((x) => cats.has(x)) && (!kec || distanceKm(b.coord, kec.centroid) <= b.capacity))
      .sort((a, b) => (a.id === hero ? -1 : b.id === hero ? 1 : 0) || (kec ? distanceKm(a.coord, kec.centroid) - distanceKm(b.coord, kec.centroid) : 0) || a.id.localeCompare(b.id))
      .slice(0, 2)
    return cands.map((b) => fu('verification.requested', { kind: 'kyb', subjectKind: 'business', subjectId: b.id, requestedBy: `Katalog Lokal · ${n.code}`, needId: n.id, priority: true }, 'kenal-mitra'))
  }),
  /* C27 a business passes KYB → it is matched to the open needs it can supply */
  react('kyb→catalog-match', 'partner.verified', (e, s) => {
    const p = e.payload
    if (p.subjectKind !== 'business' || p.result !== 'lolos') return []
    const b = s.businesses.byId[p.subjectId]
    if (!b) return []
    return rows(s.catalogNeeds)
      .filter((n) => (n.status === 'baru' || n.status === 'dicocokkan') && n.items.some((i) => b.supplies.includes(i.category)) && !rows(s.matches).some((m) => m.needId === n.id && m.businessId === b.id))
      .map((n) => {
        const kec = s.region.kecamatan.find((k) => k.id === n.kecamatanId)
        const km = kec ? distanceKm(b.coord, kec.centroid) : 10
        return fu('match.made', { needId: n.id, businessId: b.id, score: Math.round(Math.max(0.55, Math.min(0.95, 0.95 - km / 80)) * 100) / 100 }, 'katalog-lokal')
      })
  }),
  /* C28 flood → delivery complaints burst + the spike alert (once per business per day) */
  react('flood→brand-delivery', 'flood.alert', (e, s) => burstFor(e, s)),
  /* C29 replies → some authors follow up positively; an announcement → recovery posts + the receipt notice */
  react('brand-replied→recovery', 'brand.replied', (e, s) => {
    const shopId = s.meta.shopId
    const replied = e.payload.mentionIds.map((id) => s.brandMentions.byId[id]).filter((m): m is BrandMention => !!m && m.brand === shopId && (m.rating ?? 3) <= 3)
    const out: AnyFollowUp[] = []
    replied.slice(0, 2).forEach((m, i) => {
      out.push(fu('brand.mentioned', followUp(s, m, e.at + 8 + i * 13 + Math.round(unitOf(m.id) * 8), `${e.id}|${i}`, m), 'pantau-merek'))
    })
    if (replied.length) {
      const k = s.region.kecamatan[0]
      out.push(fu('brand.mentioned', {
        at: e.at + 24, brand: 'kategori', channel: 'x', author: `${pickBy(HANDLES, e.id)}${10 + (Number(e.id.slice(-2)) % 80)}`, sentiment: 'positif', topic: 'layanan', rating: null, reply: null,
        text: { id: `Toko bangunan di ${k?.name ?? s.region.shortName} sekarang cepat balas keluhan pembeli.`, en: `Building shops in ${k?.name ?? s.region.shortName} now answer complaints fast.` }, kecamatanId: k?.id,
      }, 'pantau-merek'))
    }
    return out
  }),
  react('brand-announced→recovery', 'brand.announced', (e, s) => {
    const a = s.brandAnnouncements.byId[e.payload.id ?? '']
    const al = a ? s.brandAlerts.byId[a.alertId] : undefined
    if (!a || !al) return []
    const base = al.mentionIds.map((id) => s.brandMentions.byId[id]).filter((m): m is BrandMention => !!m)
    const out: AnyFollowUp[] = [5, 14, 30].map((d, i) => {
      const m = base[i] ?? base[0]
      return fu('brand.mentioned', followUp(s, m, e.at + d, `${e.id}|a${i}`, undefined, 3 + i), 'pantau-merek')
    })
    if (a.channels.includes('struk')) {
      const { all } = shopOutlets(s)
      out.push(fu('pos.noticeSet', { announcementId: a.id, outletIds: all.map((o) => o.id), text: a.text }, 'toko-autopilot'))
    }
    return out
  }),
]

/** a positive follow-up post (C29): replies to `m` when given, else a fresh voice; text from the recovery pool */
function followUp(s: WorldState, m: BrandMention | undefined, at: number, key: string, inReplyTo?: BrandMention, offset = 0): FollowUp<'brand.mentioned'>['payload'] {
  const shopId = s.meta.shopId
  const kec = m?.kecamatanId ?? s.region.floodKecamatanIds[0] ?? ''
  const desa = m?.desaId ? desaName(s, kec, m.desaId) : kecName(s, kec)
  const market = s.markets.byId[s.businesses.byId[shopId]?.marketId ?? '']?.name ?? s.region.shortName
  const tpl = RECOVERY_TEXT[(Math.floor(unitOf(key) * RECOVERY_TEXT.length) + offset) % RECOVERY_TEXT.length]!
  return {
    at, brand: shopId, channel: m?.channel ?? 'marketplace', author: inReplyTo?.author ?? `${pickBy(HANDLES, key)}${10 + Math.floor(unitOf(`${key}|n`) * 80)}`,
    text: fillBi(tpl, { order: m?.orderCode ?? '', item: m?.item ?? 'pesanan', desa, kec: kecName(s, kec), market }), sentiment: 'positif', topic: 'pengiriman',
    rating: m?.rating != null ? 4 : null, reply: null, ...(inReplyTo ? { inReplyTo: inReplyTo.id } : {}), ...(m?.kecamatanId ? { kecamatanId: m.kecamatanId } : {}),
    ...(m?.desaId ? { desaId: m.desaId } : {}), ...(m?.orderCode ? { orderCode: m.orderCode } : {}), ...(m?.cause ? { cause: m.cause } : {}),
  }
}

/** C28: the alert first (so the toast lands on it), then the scheduled posts */
function burstFor(e: WorldEvent<'flood.alert'>, s: WorldState): AnyFollowUp[] {
  const shopId = s.meta.shopId
  const shop = s.businesses.byId[shopId]
  const facts = s.meta.facts.up
  if (!shop || !facts) return []
  const day = Math.floor(e.at / DAY_MIN)
  if (rows(s.brandAlerts).some((a) => a.businessId === shopId && Math.floor(a.at / DAY_MIN) === day)) return []
  const causeRef = ref('alerts', e.payload.id ?? '')
  const zone = e.payload.kecamatanIds.length ? e.payload.kecamatanIds : s.region.floodKecamatanIds
  const { toko } = shopOutlets(s)
  const items = s.products.ids.map((id) => s.products.byId[id]!).filter((p) => p.businessId === shopId && p.tags.includes('flood'))
  const pump = items.find((p) => p.tags.includes('pump') && /celup/i.test(p.name)) ?? items.find((p) => p.tags.includes('pump'))
  const tarp = items.find((p) => p.tags.includes('tarp') && /4x6/.test(p.name)) ?? items.find((p) => p.tags.includes('tarp'))
  const sandbag = items.filter((p) => p.tags.includes('sandbag'))
  const at0 = e.at
  const baseline = facts.brand.baselinePer2h || 0.5
  const offsets: number[] = [...BRAND_BURST.offsets]
  for (let t = at0 + 60; t <= BRAND_BURST.trickleUntil && t < (day + 1) * DAY_MIN; t += 60) offsets.push(t - at0)
  const names = zone.map((k) => kecName(s, k))
  const out: AnyFollowUp[] = [fu('brand.alert', {
    businessId: shopId, topic: 'pengiriman', volume: BRAND_BURST.spikeMin, deltaPct: Math.round(((BRAND_BURST.spikeMin - baseline) / baseline) * 100), at: at0 + (BRAND_BURST.offsets[BRAND_BURST.alertIndex] ?? 6),
    causeRef, baselinePer2h: baseline, cause: { id: `Banjir di Kec. ${names.join(', ')}: pengiriman tertunda`, en: `Flooding in ${names.join(', ')}: deliveries delayed` },
  }, 'pantau-merek')]
  const handle = (i: number) => `${HANDLES[(i * 5 + day) % HANDLES.length]}${17 + ((i * 29) % 70)}`
  offsets.forEach((d, i) => {
    const kec = zone[i % zone.length]!
    const desas = s.region.kecamatan.find((k) => k.id === kec)?.desa ?? []
    const desa = desas.length ? desas[(i * 7) % desas.length]! : { id: kec, name: kecName(s, kec) }
    const item = sandbag.length && i % 3 !== 2 ? sandbag[i % sandbag.length]! : (tarp ?? sandbag[0])
    const order = `INV-${String(4100 + ((day + 9) * 37 + i * 53) % 5800).padStart(4, '0')}`
    const tpl = BURST_DELIVERY[i % BURST_DELIVERY.length]!
    const days = 1 + (i % 3)
    const en = i === 3
    const text = fillBi(tpl, { order, item: item?.name ?? 'pesanan', desa: desa.name, days })
    out.push(fu('brand.mentioned', {
      at: at0 + d, brand: shopId, channel: i % 2 ? 'ulasan-peta' : 'marketplace', author: handle(i), text: en ? { id: text.en, en: text.en } : text, sentiment: 'negatif', topic: 'pengiriman',
      rating: 1 + (i % 2), reply: null, outletId: toko?.id, item: item?.name, orderCode: order, kecamatanId: kec, desaId: desa.id, daysLate: days, cause: causeRef, lang: en ? 'en' : 'id',
    }, 'pantau-merek'))
  })
  const extra: [number, Bi, 'stok' | 'harga', string | undefined][] = [[BRAND_BURST.stokAt, BURST_STOK, 'stok', pump?.name], [BRAND_BURST.hargaAt, BURST_HARGA, 'harga', tarp?.name]]
  for (const [d, tpl, topic, item] of extra) {
    const kec = zone[0]!
    const desa = s.region.kecamatan.find((k) => k.id === kec)?.desa[1]
    out.push(fu('brand.mentioned', {
      at: at0 + d, brand: shopId, channel: 'x', author: handle(20 + d), text: fillBi(tpl, { item: item ?? '', outlet: shop.name, desa: desa?.name ?? kecName(s, kec) }), sentiment: 'negatif',
      topic, rating: null, reply: null, outletId: toko?.id, item, kecamatanId: kec, ...(desa ? { desaId: desa.id } : {}), cause: causeRef,
    }, 'pantau-merek'))
  }
  BRAND_BURST.competitorAt.forEach((d, i) => {
    const brand = s.meta.competitors[i % Math.max(1, s.meta.competitors.length)] ?? 'kategori'
    const kec = zone[(i + 1) % zone.length]!
    const desa = s.region.kecamatan.find((k) => k.id === kec)?.desa[2]
    const tpl = COMPETITOR_TEXT[i === 0 ? 0 : 3]!
    out.push(fu('brand.mentioned', {
      at: at0 + d, brand, channel: 'marketplace', author: handle(40 + i), text: fillBi(tpl.t, { brand, item: (i ? pump : sandbag[0])?.name ?? '', desa: desa?.name ?? kecName(s, kec) }),
      sentiment: 'negatif', topic: tpl.topic, rating: 2, reply: null, kecamatanId: kec, ...(desa ? { desaId: desa.id } : {}), cause: causeRef,
    }, 'pantau-merek'))
  })
  return out
}

