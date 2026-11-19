/**
 * world/pd/natural-pd.ts — Pasar Daerah background events while the clock runs (source 'clock' + origin). Pure:
 * (state, minute) → events, deterministic per seed + region + minute. "Alive within 10 s" at ×10:
 *  - 07:01 a non-emergency need (Katalog Lokal; its matches come with it, boot reaction), then ≈ 1 per 45 min 08–15
 *  - 07:01 a price tick at `facts.pd.tickMarketId`, then one pair every 5 min 06–18 (every minute while Sinyal Pasar
 *    or Indeks Ekonomi is open: `setNaturalBoost('price', 5)`)
 *  - 07:03 the seeded shipped (non-shop) order is paid by the Pemda (Katalog Lokal)
 *  - 07:01 kedai kopi / 07:03 toko sale of the shop when the UP live module (which guarantees them) is not running:
 *    Indeks Ekonomi pulse, Rapor Usaha "Data masuk", Inti pulse
 *  - the shock path: a shocked pair's price steps up at shock +1, +2, +4 world minutes; leaving the seasonal band ⇒
 *    `price.anomaly` (one pair per shock, worst first, ≤ 3 a day) ⇒ existing C13 + C20
 *  - a Disperindag recommendation not approved after 4 world minutes ⇒ "Disetujui Kepala Daerah (simulasi)"
 *  - a running operation steps its markets' prices down and is done after PD.opHours world minutes
 */
import type { ProductSlug } from '../../../content/products'
import type { AnyFollowUp, EventType, FollowUp, WorldState } from '../types'
import { hashString, makeRng } from '../prng'
import { extensions } from '../ext'
import { DAY_MIN, ref, rows } from '../util'
import { naturalBoost } from '../natural'
import { PD } from './config'
import { opSimulate, priceStep, seasonalBand, shockPath } from './forecast'
import { naturalNeedPayload } from './need'

const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], origin: ProductSlug): AnyFollowUp => ({ type, payload, source: 'clock', origin }) as AnyFollowUp
const toStep = (v: number, step: number) => Math.max(step, Math.round(v / step) * step)

const NEED_AT = 7 * 60 + 1
const PAID_AT = 7 * 60 + 3
const SHOCK_STEPS = [1, 2, 4]

export function naturalPdAt(s: WorldState, minute: number): AnyFollowUp[] {
  if (!s.regionId) return []
  const out: AnyFollowUp[] = []
  const tod = ((minute % DAY_MIN) + DAY_MIN) % DAY_MIN
  const h = hashString(`${s.seed}|${s.regionId}|pd|${minute}`)

  /* Katalog Lokal: the natural need (its matches: boot reaction) */
  const openNatural = rows(s.catalogNeeds).filter((n) => n.status === 'baru' || n.status === 'dicocokkan').length
  if ((tod === NEED_AT || (tod >= 8 * 60 && tod < 16 * 60 && (tod - 8 * 60) % 45 === 0)) && openNatural < PD.maxOpenNeeds) {
    const p = naturalNeedPayload(s, minute)
    if (p) out.push(fu('need.created', p, 'katalog-lokal'))
  }
  /* Katalog Lokal: the seeded shipped order is paid */
  if (tod === PAID_AT) {
    const o = rows(s.orders).find((x) => x.status === 'dikirim' && x.at < 0 && x.businessId !== s.meta.shopId)
    if (o) out.push(fu('order.paid', { orderId: o.id, amount: o.total, method: 'transfer-kasda' }, 'katalog-lokal'))
  }

  /* the shop's first sales (same rule as up/natural-up) when no UP live module guarantees them on this page */
  if ((tod === NEED_AT || tod === PAID_AT) && !extensions().some((x) => x.id === 'usaha-pintar/live')) {
    const outlet = rows(s.outlets).find((o) => o.businessId === s.meta.shopId && (tod === NEED_AT ? o.kind === 'fnb' && /kopi/i.test(o.name) : o.kind === 'toko'))
    const list = outlet ? s.stock.ids.map((id) => s.stock.byId[id]!).filter((st) => st.outletId === outlet.id && st.onHand > 0 && !s.products.byId[st.productId]?.tags.includes('bahan')) : []
    list.sort((a, b) => b.baseDaily * (s.products.byId[b.productId]?.price ?? 0) - a.baseDaily * (s.products.byId[a.productId]?.price ?? 0) || a.id.localeCompare(b.id))
    const top = list.slice(0, 8)
    if (outlet && top.length) {
      const r = makeRng(hashString(`${s.seed}|${s.regionId}|pd-sale|${minute}`))
      const items = r.sample(top, Math.min(2, top.length)).map((st) => ({ productId: st.productId, qty: Math.min(st.onHand, r.int(1, 2)), price: s.products.byId[st.productId]!.price }))
      out.push(fu('sale.created', { outletId: outlet.id, items, payment: r.chance(0.5) ? 'qris' : 'tunai' }, 'toko-autopilot'))
    }
  }

  /* Sinyal Pasar: shock path (stepped prices, one anomaly per shock) */
  const day0 = Math.floor(minute / DAY_MIN) * DAY_MIN
  let anomaliesToday = rows(s.prices).filter((p) => p.anomaly && p.updatedAt >= day0).length
  const shocked = new Set<string>()
  for (const sh of rows(s.priceShocks)) {
    const d = minute - sh.startAt
    for (const m of sh.marketIds) shocked.add(`${m}:${sh.commodityId}`)
    if (!SHOCK_STEPS.includes(d)) continue
    const pairs = sh.marketIds.map((m) => s.prices.byId[`${m}:${sh.commodityId}`]).filter((p): p is NonNullable<typeof p> => !!p)
    // an earlier step of this shock that left the band already raised its anomaly: on a replayed jump that event may
    // still be in the pipeline (state not updated yet), so derive it from the shock path instead of reading state only
    const earlierOut = SHOCK_STEPS.some((d2) => d2 < d && pairs.some((p) => {
      const b = seasonalBand(p)
      return toStep(b.expected * (1 + shockPath(sh, d2)), priceStep(p.price)) > b.hi
    }))
    const hasAnomaly = earlierOut || pairs.some((p) => p.anomaly)
    const steps = pairs.map((p) => {
      const b = seasonalBand(p)
      const shockPrice = toStep(b.expected * (1 + shockPath(sh, d)), priceStep(p.price))
      const price = Math.max(p.price, shockPrice)
      // the anomaly is the shock's: its own step leaves the band (a pair already high before the flood waits for it)
      return { p, b, price, out: shockPrice > b.hi, deltaPct: Math.round((price / b.expected - 1) * 1000) / 10 }
    })
    const worst = [...steps].filter((x) => x.out).sort((a, b) => b.deltaPct - a.deltaPct || a.p.id.localeCompare(b.p.id))[0]
    for (const x of steps) {
      if (!hasAnomaly && worst === x && anomaliesToday < PD.anomaliesPerDay) {
        anomaliesToday++
        out.push(fu('price.anomaly', { marketId: x.p.marketId, commodityId: x.p.commodityId, price: x.price, expected: x.b.expected, deltaPct: x.deltaPct }, 'sinyal-pasar'))
      } else if (x.price !== x.p.price) out.push(fu('price.updated', { marketId: x.p.marketId, commodityId: x.p.commodityId, price: x.price }, 'sinyal-pasar'))
    }
  }

  /* Sinyal Pasar: market operations (auto-approval of a sent recommendation, running → prices ease → done) */
  for (const op of rows(s.marketOps)) {
    if (op.stage === 'recommended' && op.sentBy === 'disperindag' && op.sentAt != null && minute >= op.sentAt + PD.autoApproveMin) {
      if (rows(s.instructions).some((i) => i.origin === ref('marketOps', op.id))) continue
      const c = s.region.commodities.find((x) => x.id === op.commodityId)?.name ?? { id: op.commodityId, en: op.commodityId }
      const opd = s.region.opd.find((o) => /perindag|dagang|disperindag/i.test(`${o.id} ${o.short} ${o.name}`))?.id ?? 'disperindag'
      out.push(fu('instruction.issued', { text: { id: `Disetujui Kepala Daerah (simulasi) · operasi pasar ${c.id.toLowerCase()}`, en: `Approved by the Regional Head (simulated) · ${c.en.toLowerCase()} market operation` }, opdIds: [opd], origin: ref('marketOps', op.id) }, 'meja-pimpinan'))
    }
    if (op.stage === 'running' && op.startedAt != null) {
      const d = minute - op.startedAt
      if (d >= PD.opHours) {
        out.push(fu('market.operation', { id: op.id, stage: 'done', commodityId: op.commodityId, marketIds: op.marketIds }, 'sinyal-pasar'))
        continue
      }
      if (SHOCK_STEPS.includes(d)) {
        const sim = opSimulate(s, { commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: op.volumeTon ?? 10, days: op.days ?? 3 }, minute)
        const target = sim.forecastAfter[0]
        for (const m of op.marketIds) {
          const p = s.prices.byId[`${m}:${op.commodityId}`]
          if (!p || !target || target >= p.price) continue
          const price = toStep(p.price + (target - p.price) * (d === 4 ? 1 : d / 3), priceStep(p.price))
          if (price !== p.price) out.push(fu('price.updated', { marketId: m, commodityId: op.commodityId, price }, 'sinyal-pasar'))
        }
      }
    }
  }

  /* Sinyal Pasar: the regular tick (07:01 at the central market, then every 5 min 06–18; every minute when boosted) */
  const boosted = naturalBoost('price') > 1
  const tickMarket = s.meta.facts.pd?.tickMarketId
  let tick: string | null = null
  if (tod === NEED_AT && tickMarket) {
    const cs = s.region.commodities
    const c = cs[h % Math.max(1, cs.length)]
    if (c) tick = `${tickMarket}:${c.id}`
  } else if (tod >= 6 * 60 && tod <= 18 * 60 && (tod % 5 === 0 || boosted) && s.prices.ids.length) tick = s.prices.ids[h % s.prices.ids.length]!
  const p = tick && !shocked.has(tick) ? s.prices.byId[tick] : undefined
  if (p) {
    const step = priceStep(p.price)
    const f = (0.005 + ((h >>> 8) % 100) / 20_000) * ((h >>> 4) % 2 ? 1 : -1)
    let price = toStep(p.price * (1 + f), step)
    if (price === p.price) price = p.price + (f > 0 ? step : -step)
    out.push(fu('price.updated', { marketId: p.marketId, commodityId: p.commodityId, price }, 'sinyal-pasar'))
  }
  return out
}
