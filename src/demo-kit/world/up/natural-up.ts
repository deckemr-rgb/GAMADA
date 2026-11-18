/**
 * world/up/natural-up.ts — Usaha Pintar background events while the clock runs (source 'clock' + origin). Pure:
 * (state, minute) → events, deterministic per seed + region + minute. "Alive within 10 s" at ×10: at 07:01 one event
 * lands in every UP domain (the core gives the 07:01 kedai-kopi sale → its journal row).
 *   - calls: 07:01, then every 3rd minute 07–17 (industry rotates); a live call is scored by the AI when it ends
 *   - verification requests: Joko Prasetyo's KYC at 07:01, then ≈ 1/40 per minute 08–16 (≤ 12 open)
 *   - brand mentions: 07:01, then ≈ one per 20 world minutes
 *   - one non-emergency tender at 07:01 (matched by C22, ≈ 64 %)
 */
import type { ProductSlug } from '../../../content/products'
import type { AnyFollowUp, BrandMention, EventType, FollowUp, Industry, WorldState } from '../types'
import { hashString, makeRng, type Rng } from '../prng'
import { DAY_MIN, HOUR_RHYTHM, WORLD, distanceKm, rows } from '../util'
import { UP } from './config'
import { CALL_CLIPS, PRAPESAN_CLIP, clipOf, leastRecent, shopOutlets } from './base'
import { callScore } from './call-score'
import { drawCriteriaPure, flagsOfPure } from './criteria'
import { SHOP_KBLI, EMERGENCY_TENDER } from './config'
import { BRAND_TEXT, CATEGORY_TEXT, COMPETITOR_TEXT, CUSTOMER_ROLE, HANDLES, NATURAL_TENDER, fillBi, sentimentOf } from './texts'

const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], origin: ProductSlug): AnyFollowUp => ({ type, payload, source: 'clock', origin }) as AnyFollowUp
const IND: Industry[] = ['toko-bangunan', 'multifinance', 'asuransi']
const LENDER = 'Koperasi Mitra Usaha Sejahtera'

function newCall(s: WorldState, r: Rng, minute: number, ind: Industry): AnyFollowUp | null {
  const team = rows(s.agentsSales).filter((a) => a.industry === ind)
  if (!team.length) return null
  const agent = r.pick(team)
  const pool = CALL_CLIPS.filter((c) => c.industry === ind && c.key !== PRAPESAN_CLIP)
  const recent = rows(s.calls).filter((c) => c.industry === ind).slice(0, 12)
  const clip = leastRecent(pool, (c) => recent.find((x) => x.transcript === c.key)?.at ?? -Infinity, `${s.seed}|${minute}`)
  const flood = ind === 'toko-bangunan' && rows(s.alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')
  const role = r.pick(CUSTOMER_ROLE[ind]!)
  const cust = r.pick(rows(s.citizens).filter((c) => c.name.includes(' ')).slice(0, 120))
  return fu('call.created', {
    agentId: agent.id, industry: ind, channel: clip.channel, customer: `${cust?.gender === 'P' ? 'Ibu' : 'Bpk.'} ${cust?.name ?? 'Pelanggan'} (${role.id})`, transcript: clip.key,
    durationSec: r.int(180, 420), topic: flood ? 'banjir' : null,
  }, 'juara-jualan')
}

function newMention(s: WorldState, r: Rng, minute: number): AnyFollowUp | null {
  const shopId = s.meta.shopId
  const w = r.next()
  const brand = w < 0.6 ? shopId : w < 0.85 ? r.pick(s.meta.competitors) : 'kategori'
  const pool = (brand === shopId ? BRAND_TEXT : brand === 'kategori' ? CATEGORY_TEXT : COMPETITOR_TEXT).filter((t) => t.s > -0.2 || brand !== shopId || t.topic !== 'pengiriman')
  const today = rows(s.brandMentions).filter((m) => m.at >= Math.floor(minute / DAY_MIN) * DAY_MIN && m.at <= minute)
  const used = new Set(today.map((m) => m.text.id))
  const tpl = leastRecent(pool, (t) => today.find((m) => m.text.id.startsWith(t.t.id.slice(0, 10)))?.at ?? -Infinity, `${s.seed}|bm|${minute}`)
  const items = s.products.ids.map((id) => s.products.byId[id]!).filter((p) => p.businessId === shopId && !p.tags.includes('bahan'))
  const k = r.pick(s.region.kecamatan)
  const d = k.desa.length ? r.pick(k.desa) : { id: k.id, name: k.name }
  let text = fillBi(tpl.t, { item: r.pick(items)?.name ?? '', desa: d.name, kec: k.name, brand, market: s.region.shortName })
  for (let i = 0; i < 4 && used.has(text.id); i++) text = fillBi(tpl.t, { item: r.pick(items)?.name ?? '', desa: d.name, kec: k.name, brand, market: s.region.shortName })
  const sc = tpl.s + r.normal(0, 0.08)
  const channel = r.weighted([['marketplace', 30], ['instagram', 20], ['x', 10], ['tiktok', 10], ['ulasan-peta', 30]] as const)
  const m: FollowUp<'brand.mentioned'>['payload'] = {
    brand, channel, author: `${r.pick(HANDLES)}${r.int(11, 98)}`, text, sentiment: sentimentOf(sc), topic: tpl.topic,
    rating: channel === 'marketplace' || channel === 'ulasan-peta' ? (sc > 0.2 ? r.int(4, 5) : sc < -0.2 ? r.int(2, 3) : 3) : null, reply: null, kecamatanId: k.id, desaId: d.id,
  }
  return fu('brand.mentioned', m as Omit<BrandMention, 'id' | 'at'>, 'pantau-merek')
}

/** the 07:01 tender: building materials for a village drain in a kecamatan ≈ 12 km away, 7 expected competitors */
function naturalTender(s: WorldState, minute: number): FollowUp<'tender.created'>['payload'] {
  const shop = s.businesses.byId[s.meta.shopId]!
  const far = [...s.region.kecamatan].sort((a, b) => Math.abs(distanceKm(shop.coord, a.centroid) - 12) - Math.abs(distanceKm(shop.coord, b.centroid) - 12) || a.id.localeCompare(b.id))[0]!
  const items = NATURAL_TENDER.items.map(([cat, id, en, qty, unit]) => {
    // priced from the shop's own SKU of that kind (first word of the item name), HPS = shelf price + 5 %
    const own = s.products.ids.map((x) => s.products.byId[x]!).filter((p) => p.businessId === shop.id && p.category === cat)
    const sku = own.find((p) => p.name.toLowerCase().startsWith(id.split(' ')[0]!.toLowerCase())) ?? own[0]
    return { name: { id, en }, category: cat, qty, unit, hpsPrice: Math.round(((sku?.price ?? 100_000) * 1.05) / 100) * 100 }
  })
  const hps = items.reduce((a, i) => a + i.qty * i.hpsPrice, 0)
  const pupr = s.region.opd.find((o) => /pupr|pekerjaan umum/i.test(`${o.id} ${o.name}`))?.id ?? s.region.opd[0]?.id ?? 'opd'
  return {
    key: NATURAL_TENDER.key, title: NATURAL_TENDER.t, opdId: pupr, kbli: SHOP_KBLI[0]!, value: hps, hps, kecamatanId: far.id, publishedAt: minute, deadlineAt: minute + 9 * DAY_MIN + 5 * 60,
    emergency: false, competitors: 7, method: hps < 200_000_000 ? 'pengadaan-langsung' : 'tender', requirements: [...EMERGENCY_TENDER.requirements], items, needId: null, procurementId: null,
  }
}
/** the guaranteed sales of a shop demo's first seconds: 07:01 kedai kopi, 07:03 toko (best sellers in stock) */
function sureSale(s: WorldState, r: Rng, outletId: string | undefined): AnyFollowUp | null {
  if (!outletId) return null
  const list = s.stock.ids.map((id) => s.stock.byId[id]!).filter((st) => st.outletId === outletId && st.onHand > 0 && !s.products.byId[st.productId]?.tags.includes('bahan'))
  list.sort((a, b) => b.baseDaily * (s.products.byId[b.productId]?.price ?? 0) - a.baseDaily * (s.products.byId[a.productId]?.price ?? 0) || a.id.localeCompare(b.id))
  const top = list.slice(0, 8)
  if (!top.length) return null
  const items = r.sample(top, Math.min(2, top.length)).map((st) => ({ productId: st.productId, qty: Math.min(st.onHand, r.int(1, 2)), price: s.products.byId[st.productId]!.price }))
  return fu('sale.created', { outletId, items, payment: r.chance(0.5) ? 'qris' : 'tunai' }, 'toko-autopilot')
}

/** the natural Usaha Pintar events of one world minute (pure) */
export function naturalUpAt(s: WorldState, minute: number): AnyFollowUp[] {
  const facts = s.meta.facts.up
  if (!s.regionId || !facts) return []
  const r = makeRng(hashString(`${s.seed}|${s.regionId}|up-natural|${minute}`))
  const tod = ((minute % DAY_MIN) + DAY_MIN) % DAY_MIN
  const h = Math.floor(tod / 60)
  const first = minute === WORLD.clockStart + 1
  const out: AnyFollowUp[] = []
  if (first || minute === WORLD.clockStart + 3) {
    const o = shopOutlets(s)
    const sale = sureSale(s, r, first ? o.kopi?.id : o.toko?.id)
    if (sale) out.push(sale)
  }

  // calls: 07:01, then every 3rd minute in working hours (industry rotates)
  if (tod >= 7 * 60 && tod < 17 * 60 && ((tod - 7 * 60) % 3 === 1)) {
    const c = newCall(s, r, minute, IND[Math.floor((tod - 7 * 60) / 3) % 3]!)
    if (c) out.push(c)
  }
  // live calls that end this minute are scored by the AI (seeded unscored calls stay for the supervisor)
  for (const c of rows(s.calls).slice(0, 40)) {
    if (c.score !== null || c.transcript === PRAPESAN_CLIP || c.at < WORLD.clockStart - 5) continue
    const end = c.at + Math.ceil(c.durationSec / 60)
    if (end !== minute) continue
    const agent = s.agentsSales.byId[c.agentId]
    const clip = clipOf(c.transcript)
    if (!agent || !clip) continue
    const criteria = drawCriteriaPure(agent.radar, clip.weak, `${s.seed}|${c.id}`)
    out.push(fu('call.scored', { callId: c.id, score: callScore(criteria), criteria, flags: flagsOfPure(criteria, clip.weak), by: 'ai' }, 'juara-jualan'))
  }

  // verification requests: Joko Prasetyo's KYC at 07:01, then a few KYB requests through the day
  const openReqs = rows(s.verificationRequests).filter((x) => x.status !== 'selesai')
  if (first) {
    const doc = facts.kenalMitra.kycCleanDocId
    if (doc && !rows(s.verificationRequests).some((x) => x.subjectId === doc)) out.push(fu('verification.requested', { kind: 'kyc', subjectKind: 'document', subjectId: doc, requestedBy: LENDER, priority: false }, 'kenal-mitra'))
  } else if (h >= 8 && h < 16 && openReqs.length < UP.maxOpenRequests && r.chance(1 / 40)) {
    const busy = new Set(openReqs.map((x) => x.subjectId))
    const pool = rows(s.businesses).filter((b) => !b.verified && !busy.has(b.id) && b.id !== facts.kenalMitra.heroBusinessId && b.id !== facts.kenalMitra.mismatchBusinessId)
    if (pool.length) out.push(fu('verification.requested', { kind: 'kyb', subjectKind: 'business', subjectId: r.pick(pool).id, requestedBy: r.chance(0.5) ? LENDER : (s.businesses.byId[s.meta.shopId]?.name ?? LENDER) }, 'kenal-mitra'))
  }

  // brand mentions: 07:01, then about one per 20 world minutes (follows the day's rhythm)
  if (first || (tod >= 6 * 60 && tod < 22 * 60 && r.chance(((HOUR_RHYTHM[h] ?? 0.3) / UP.brandEveryMin) * 0.9))) {
    const m = newMention(s, r, minute)
    if (m) out.push(m)
  }

  // the 07:01 tender (non-emergency; C22 matches it to the shop)
  if (first && !rows(s.tenders).some((t) => t.key === NATURAL_TENDER.key)) {
    out.push(fu('tender.created', naturalTender(s, minute), 'tenderpilot'))
  }
  return out
}
