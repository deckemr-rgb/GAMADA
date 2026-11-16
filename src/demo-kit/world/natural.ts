/**
 * world/natural.ts — "natural" events while the clock runs (spec §6.2): new complaints, shop sales, news/social
 * mentions and small price moves. Rhythm follows the hour (busy 07–11 and 13–15, quiet nights). Deterministic:
 * `naturalEventsAt(state, minute)` depends only on seed + region + minute + state. Off in tour/presenter mode.
 */
import { useSyncExternalStore } from 'react'
import type { AnyFollowUp, ComplaintCategory, EventType, FollowUp, Product, WorldState } from './types'
import { COMPLAINT_TEXT, COMPLAINT_WEIGHTS, MEDIA_OUTLETS, MENTION_TEXT, SOCIAL_HANDLES } from './catalog'
import { hashString, makeRng, type Rng } from './rng'
import { clock } from './clock'
import { emit, world } from './store'
import { DAY_MIN, HOUR_RHYTHM, clamp, offsetKm, round, rows } from './util'

/* ------------------------------------------------------------------ constants */
/** expected events per world minute at rhythm 1.0 */
export const NATURAL = {
  complaint: 0.045,
  mention: 0.05,
  price: 0.025,
  /** average receipts per open minute (toko ≈ 27/day, F&B ≈ 90/day) */
  saleToko: 0.045,
  saleFnb: 0.1,
  /** while a flood alert is active, flood complaints in flood kecamatan are this much likelier */
  floodBoost: 4,
}

const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp

function shopSale(r: Rng, s: WorldState, outletId: string, toko: boolean): AnyFollowUp | null {
  const pairs: [Product, number][] = []
  for (const id of s.stock.ids) {
    const st = s.stock.byId[id]
    if (!st || st.outletId !== outletId || st.onHand <= 0) continue
    const p = s.products.byId[st.productId]
    if (!p || p.tags.includes('bahan')) continue
    pairs.push([p, Math.max(1, st.baseDaily * st.factor * p.price)])
  }
  if (!pairs.length) return null
  const avgTicket = toko ? 320_000 : 21_000
  const items: { productId: string; qty: number; price: number }[] = []
  for (let l = 0, n = r.int(1, 3); l < n; l++) {
    const p = r.weighted(pairs)
    if (items.some((x) => x.productId === p.id)) continue
    const onHand = s.stock.byId[p.id]?.onHand ?? 0
    const qty = Math.min(onHand, Math.max(1, Math.round((avgTicket / 2 / p.price) * r.float(0.5, 1.5))))
    if (qty > 0) items.push({ productId: p.id, qty, price: p.price })
  }
  if (!items.length) return null
  return fu('sale.created', { outletId, items, payment: r.weighted([['tunai', 50], ['qris', 40], ['transfer', 10]] as const) }, 'toko-autopilot')
}

/** the natural events for one world minute (pure) */
export function naturalEventsAt(s: WorldState, minute: number): AnyFollowUp[] {
  if (!s.regionId) return []
  const r = makeRng(hashString(`${s.seed}|${s.regionId}|natural|${minute}`))
  const h = Math.floor((((minute % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60)
  const rhythm = HOUR_RHYTHM[h] ?? 0.2
  const out: AnyFollowUp[] = []
  const activeFlood = rows(s.alerts).filter((a) => a.status === 'aktif' && a.kind === 'banjir')
  const floodZone = new Set(activeFlood.flatMap((a) => a.kecamatanIds))

  // complaints
  if (r.chance(NATURAL.complaint * rhythm) && s.citizens.ids.length) {
    const c = s.citizens.byId[r.pick(s.citizens.ids)]!
    let category: ComplaintCategory = r.weighted(COMPLAINT_WEIGHTS)
    if (floodZone.has(c.kecamatanId) && r.chance(1 - 1 / NATURAL.floodBoost)) category = 'banjir'
    const desa = s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.name ?? ''
    const t = r.pick(COMPLAINT_TEXT[category])
    const text = t.id.replace('{d}', desa)
    out.push(fu('complaint.created', {
      citizenId: c.id, category, channel: r.weighted([['wa', 55], ['web', 20], ['telepon', 10], ['voice', 15]] as const), text, lang: 'id',
      summary: { id: text, en: t.en.replace('{d}', desa) }, kecamatanId: c.kecamatanId, desaId: c.desaId, coord: offsetKm(c.coord, r.float(-0.3, 0.3), r.float(-0.3, 0.3)),
      urgency: category === 'banjir' ? 'tinggi' : r.weighted([['rendah', 35], ['sedang', 50], ['tinggi', 15]] as const), photo: r.chance(0.4),
    }, 'sapa-warga'))
  }

  // shop sales (the scenario business's outlets, only while open)
  for (const id of s.outlets.ids) {
    const o = s.outlets.byId[id]
    if (!o || o.businessId !== s.meta.shopId) continue
    const tod = ((minute % DAY_MIN) + DAY_MIN) % DAY_MIN
    if (tod < o.opensAt || tod >= o.closesAt) continue
    if (!r.chance((o.kind === 'toko' ? NATURAL.saleToko : NATURAL.saleFnb) * rhythm)) continue
    const sale = shopSale(r, s, o.id, o.kind === 'toko')
    if (sale) out.push(sale)
  }

  // mentions
  if (r.chance(NATURAL.mention * rhythm) && s.region.kecamatan.length) {
    const pool = floodZone.size && r.chance(0.5) ? MENTION_TEXT.filter((m) => m.topic === 'banjir') : MENTION_TEXT
    const tpl = r.pick(pool)
    const k = floodZone.size && tpl.topic === 'banjir' ? s.region.kecamatan.find((x) => floodZone.has(x.id)) ?? r.pick(s.region.kecamatan) : r.pick(s.region.kecamatan)
    const kind = r.weighted([['berita', 35], ['sosmed', 55], ['forum', 10]] as const)
    const score = clamp(round(tpl.s + r.normal(0, 0.15), 2), -1, 1)
    const fill = (x: string) => x.replace('{k}', k.name).replace('{r}', s.region.shortName)
    out.push(fu('mention.created', {
      outlet: kind === 'berita' ? r.pick(MEDIA_OUTLETS) : kind === 'sosmed' ? r.pick(SOCIAL_HANDLES) : 'Forum Warga', kind, author: kind === 'berita' ? 'Redaksi' : r.pick(SOCIAL_HANDLES),
      text: { id: fill(tpl.t.id), en: fill(tpl.t.en) }, sentiment: score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral', score, topic: tpl.topic,
      reach: Math.round(Math.exp(r.normal(kind === 'berita' ? 8 : 6.5, 1))),
    }, 'radar-isu'))
  }

  // price moves (small; chilli drifts up while a flood alert is active)
  if (r.chance(NATURAL.price * rhythm) && s.prices.ids.length) {
    const p = s.prices.byId[r.pick(s.prices.ids)]!
    const up = floodZone.size && /cabai|beras/i.test(p.commodityId) ? 0.006 : 0
    const step = p.price >= 20_000 ? 500 : 100
    const vol = /cabai|bawang/i.test(p.commodityId) ? 0.015 : 0.006
    let next = Math.max(step, Math.round((p.price * (1 + up + r.normal(0, vol))) / step) * step)
    if (next === p.price) next = p.price + (up > 0 || r.chance(0.5) ? step : -step)
    if (next > 0) out.push(fu('price.updated', { marketId: p.marketId, commodityId: p.commodityId, price: next }, 'sinyal-pasar'))
  }
  return out
}

/* ------------------------------------------------------------------ runtime switch */

let enabled = true
const subs = new Set<() => void>()

export function setNaturalEvents(on: boolean): void {
  if (on === enabled) return
  enabled = on
  for (const fn of [...subs]) fn()
}
export const naturalEventsOn = (): boolean => enabled

export function useNaturalEvents(): boolean {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => enabled,
    () => enabled,
  )
}

// One listener for the whole app: every minute the running clock crosses.
clock.onMinute((minute) => {
  if (!enabled || world.status() !== 'ready') return
  for (const o of naturalEventsAt(world.get(), minute)) emit(o.type, o.payload as never, o.source, { at: minute })
})
