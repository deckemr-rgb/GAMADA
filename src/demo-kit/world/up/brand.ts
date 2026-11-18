/**
 * world/up/brand.ts — Pantau Merek selectors (SIMULATED index and counts). Mentions dated in the future (the
 * scheduled burst) never show: everything filters `at ≤ now`. One `brandAlerts` row feeds the card, the audit row and
 * the Toko Autopilot chip.
 */
import type { Bi, BrandAlert, BrandMention, BrandTopic, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { DAY_MIN, rows } from '../util'
import { BRAND_BURST } from './config'
import { desaName, kecName, unitOf } from './base'
import { reputationAt } from './reputation'

export { reputationAt, mentionValue, REPUTATION } from './reputation'

const visible = (s: WorldState, now: number) => rows(s.brandMentions).filter((m) => m.at <= now)
const isShop = (s: WorldState, m: BrandMention) => m.brand === s.meta.shopId

export interface StreamFilter { brand?: 'shop' | 'competitor' | 'kategori' | 'all'; topic?: BrandTopic; sentiment?: BrandMention['sentiment']; outletId?: string; unreplied?: boolean; limit?: number }
/** mentions until `now`, newest first */
export function brandStream(s: WorldState, now: number, f: StreamFilter = {}): BrandMention[] {
  const out: BrandMention[] = []
  const comps = new Set(s.meta.competitors)
  for (const m of visible(s, now).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))) {
    const b = f.brand ?? 'all'
    if (b === 'shop' && !isShop(s, m)) continue
    if (b === 'competitor' && !comps.has(m.brand)) continue
    if (b === 'kategori' && m.brand !== 'kategori') continue
    if (f.topic && m.topic !== f.topic) continue
    if (f.sentiment && m.sentiment !== f.sentiment) continue
    if (f.outletId && m.outletId !== f.outletId) continue
    if (f.unreplied && m.repliedAt != null) continue
    out.push(m)
    if (f.limit && out.length >= f.limit) break
  }
  return out
}

/** KPI: reputation (0–100), shop mentions in 24 h, unanswered complaints, median reply time (minutes) */
export const brandKpi = createParamSelector((s) => [s.brandMentions, s.meta.shopId], (now: number, mentions, shopId) => {
  const st = { brandMentions: mentions, meta: { shopId } } as unknown as WorldState
  const mine = rows(mentions).filter((m) => m.brand === shopId && m.at <= now)
  const unreplied = mine.filter((m) => m.sentiment === 'negatif' && m.repliedAt == null && m.at > now - 7 * DAY_MIN).length
  const waits = mine.filter((m) => m.repliedAt != null && m.repliedAt <= now && m.at > now - 30 * DAY_MIN).map((m) => m.repliedAt! - m.at).sort((a, b) => a - b)
  return {
    reputation: reputationAt(st, now, shopId),
    mentions24h: mine.filter((m) => m.at > now - DAY_MIN).length,
    unreplied,
    medianReplyMin: waits.length ? waits[Math.floor(waits.length / 2)]! : null,
  }
})

export const CHANNELS: BrandMention['channel'][] = ['marketplace', 'instagram', 'x', 'tiktok', 'ulasan-peta']
/** sentiment per channel over the last `hours` (shop) */
export function sentimentByChannel(s: WorldState, now: number, hours = 24): { channel: BrandMention['channel']; pos: number; neu: number; neg: number; net: number }[] {
  const list = visible(s, now).filter((m) => isShop(s, m) && m.at > now - hours * 60)
  return CHANNELS.map((channel) => {
    const l = list.filter((m) => m.channel === channel)
    const pos = l.filter((m) => m.sentiment === 'positif').length
    const neg = l.filter((m) => m.sentiment === 'negatif').length
    return { channel, pos, neu: l.length - pos - neg, neg, net: l.length ? Math.round(((pos - neg) / l.length) * 100) : 0 }
  })
}

export const TOPICS: BrandTopic[] = ['pengiriman', 'kualitas', 'harga', 'layanan', 'stok']
/** topic counts of the last `hours` vs the window before (shop) */
export function brandTopics(s: WorldState, now: number, hours = 24): { topic: BrandTopic; count: number; prev: number; delta: number }[] {
  const w = hours * 60
  const list = visible(s, now).filter((m) => isShop(s, m))
  return TOPICS.map((topic) => {
    const count = list.filter((m) => m.topic === topic && m.at > now - w).length
    const prev = list.filter((m) => m.topic === topic && m.at <= now - w && m.at > now - 2 * w).length
    return { topic, count, prev, delta: count - prev }
  })
}

/** hourly reputation (0–100) of the last `hours`, oldest → newest */
export function reputationSeries(s: WorldState, now: number, hours = 24, brand?: string): { at: number; value: number }[] {
  const b = brand ?? s.meta.shopId
  const end = Math.floor(now / 60) * 60
  return Array.from({ length: hours + 1 }, (_, i) => {
    const at = i === hours ? now : end - (hours - i) * 60
    return { at, value: reputationAt(s, at, b) }
  })
}
export const reputationScore = (s: WorldState, now: number, brand?: string): { score: number; at: number } => ({ score: reputationAt(s, now, brand ?? s.meta.shopId), at: now })

/** the spike rule: ≥ 5 negative delivery mentions of the shop within 2 h (pre-signal before that) */
export function brandSpike(s: WorldState, now: number): { count: number; rule: number; baselinePer2h: number; crossed: boolean; preSignalIds: string[] } {
  const count = visible(s, now).filter((m) => isShop(s, m) && m.topic === 'pengiriman' && m.sentiment === 'negatif' && m.at > now - BRAND_BURST.windowMin).length
  const up = s.meta.facts.up
  return { count, rule: BRAND_BURST.spikeMin, baselinePer2h: up?.brand.baselinePer2h ?? 0.5, crossed: count >= BRAND_BURST.spikeMin, preSignalIds: up?.brand.preSignalIds ?? [] }
}

/** the newest alert already detected at `now` (stored ahead with its crossing minute) that is not handled yet */
export function activeBrandAlert(s: WorldState, now: number): BrandAlert | null {
  return rows(s.brandAlerts).filter((a) => a.at <= now && a.status === 'aktif').sort((a, b) => b.at - a.at)[0] ?? null
}
/** any alert visible at `now` (handled ones too), newest first */
export const brandAlertsAt = (s: WorldState, now: number): BrandAlert[] => rows(s.brandAlerts).filter((a) => a.at <= now).sort((a, b) => b.at - a.at)

export interface Cluster { key: 'telat' | 'eta' | 'stok' | 'harga'; label: Bi; count: number; share: number; sampleIds: string[] }
/** complaint clusters of an alert (≤ 6, shares of the alert's mentions visible at `now`) */
export function complaintClusters(s: WorldState, now: number, alertId: string): Cluster[] {
  const a = s.brandAlerts.byId[alertId]
  if (!a) return []
  const list = visible(s, now).filter((m) => m.cause === a.causeRef && isShop(s, m) && m.sentiment === 'negatif')
  const eta = (m: BrandMention) => /kabar|ETA|info|status/i.test(m.text.id) || /news|ETA|update|status/i.test(m.text.en)
  const telat = list.filter((m) => m.topic === 'pengiriman' && !eta(m))
  const noEta = list.filter((m) => m.topic === 'pengiriman' && eta(m))
  const stok = list.filter((m) => m.topic === 'stok')
  const harga = list.filter((m) => m.topic === 'harga')
  const kecs = [...new Set(telat.map((m) => m.kecamatanId).filter(Boolean))].slice(0, 2).map((k) => kecName(s, k!))
  const days = telat.map((m) => m.daysLate ?? 1)
  const lo = days.length ? Math.min(...days) : 1
  const hi = days.length ? Math.max(...days) : 3
  const item = (l: BrandMention[]) => l[0]?.item ?? ''
  const total = list.length || 1
  const out: Cluster[] = [
    { key: 'telat', label: { id: `Telat ${lo}–${hi} hari ke Kec. ${kecs.join('/')}`, en: `${lo}–${hi} days late to ${kecs.join('/')}` }, count: telat.length, share: 0, sampleIds: telat.slice(0, 3).map((m) => m.id) },
    { key: 'eta', label: { id: 'Tidak ada kabar/ETA', en: 'No news / ETA' }, count: noEta.length, share: 0, sampleIds: noEta.slice(0, 3).map((m) => m.id) },
    { key: 'stok', label: { id: `${item(stok) || 'Barang'} kosong`, en: `${item(stok) || 'Item'} out of stock` }, count: stok.length, share: 0, sampleIds: stok.slice(0, 3).map((m) => m.id) },
    { key: 'harga', label: { id: `Harga ${item(harga) || 'barang'} naik`, en: `${item(harga) || 'Item'} price up` }, count: harga.length, share: 0, sampleIds: harga.slice(0, 3).map((m) => m.id) },
  ]
  return out.filter((c) => c.count > 0).map((c) => ({ ...c, share: Math.round((c.count / total) * 100) })).sort((x, y) => y.count - x.count)
}

/** unanswered shop complaints until `now` (the alert's burst first, newest first) */
export function replyCandidates(s: WorldState, now: number, alertId?: string): BrandMention[] {
  const a = alertId ? s.brandAlerts.byId[alertId] : null
  return visible(s, now)
    .filter((m) => isShop(s, m) && m.sentiment === 'negatif' && m.repliedAt == null)
    .sort((x, y) => Number(!!a && y.cause === a.causeRef) - Number(!!a && x.cause === a.causeRef) || y.at - x.at || y.id.localeCompare(x.id))
}

/** the personal fields a reply draft uses */
export function replyInputs(m: BrandMention): { handle: string; item: string | null; orderCode: string | null; desaId: string | null; kecamatanId: string | null; daysLate: number | null; outletId: string | null; lang: 'id' | 'en'; topic: BrandTopic; rating: number | null } {
  return { handle: m.author, item: m.item ?? null, orderCode: m.orderCode ?? null, desaId: m.desaId ?? null, kecamatanId: m.kecamatanId ?? null, daysLate: m.daysLate ?? null, outletId: m.outletId ?? null, lang: m.lang ?? 'id', topic: m.topic, rating: m.rating }
}
/** place names of a mention (for drafts) */
export const mentionPlace = (s: WorldState, m: BrandMention): { desa: string; kecamatan: string } => ({
  desa: m.kecamatanId && m.desaId ? desaName(s, m.kecamatanId, m.desaId) : '', kecamatan: m.kecamatanId ? kecName(s, m.kecamatanId) : '',
})

export interface CompetitorRow { brand: string; label: string; share: number; net: number; avgRating: number | null; topComplaint: BrandTopic | null; replyRate: number; medianReplyMin: number | null; series: number[] }
/** shop vs competitors over `days` days: share of voice, net sentiment, rating, top complaint, reply rate/time, daily reputation */
export function competitorCompare(s: WorldState, now: number, days = 7): CompetitorRow[] {
  const from = now - days * DAY_MIN
  const list = visible(s, now).filter((m) => m.at > from)
  const brands = [s.meta.shopId, ...s.meta.competitors]
  const total = list.filter((m) => brands.includes(m.brand)).length || 1
  return brands.map((b) => {
    const l = list.filter((m) => m.brand === b)
    const pos = l.filter((m) => m.sentiment === 'positif').length
    const neg = l.filter((m) => m.sentiment === 'negatif')
    const rated = l.filter((m) => m.rating != null)
    const topics = new Map<BrandTopic, number>()
    for (const m of neg) topics.set(m.topic, (topics.get(m.topic) ?? 0) + 1)
    const top = [...topics].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    // competitors' replies are not in the data: a stable simulated rate per brand
    const own = b === s.meta.shopId
    const replied = own ? neg.filter((m) => m.repliedAt != null) : []
    const waits = replied.map((m) => m.repliedAt! - m.at).sort((x, y) => x - y)
    return {
      brand: b, label: own ? (s.businesses.byId[b]?.name ?? b) : b, share: Math.round((l.length / total) * 100), net: l.length ? Math.round(((pos - neg.length) / l.length) * 100) : 0,
      avgRating: rated.length ? Math.round((rated.reduce((a, m) => a + m.rating!, 0) / rated.length) * 10) / 10 : null, topComplaint: top,
      replyRate: own ? (neg.length ? Math.round((replied.length / neg.length) * 100) : 0) : Math.round(20 + unitOf(b) * 40),
      medianReplyMin: own ? (waits.length ? waits[Math.floor(waits.length / 2)]! : null) : Math.round(300 + unitOf(`${b}|w`) * 600),
      series: Array.from({ length: days }, (_, i) => reputationAt(s, now - (days - 1 - i) * DAY_MIN, b)),
    }
  })
}

/** orders hit by the flood (distinct order codes of the burst until `now`) and their value (SIMULATED) */
export function affectedOrders(s: WorldState, now: number): { count: number; value: number; orderCodes: string[] } {
  const a = rows(s.brandAlerts).filter((x) => x.at <= now).sort((x, y) => y.at - x.at)[0]
  if (!a) return { count: 0, value: 0, orderCodes: [] }
  const codes = new Map<string, BrandMention>()
  for (const m of visible(s, now)) if (m.cause === a.causeRef && m.orderCode && isShop(s, m)) codes.set(m.orderCode, m)
  let value = 0
  for (const [code, m] of codes) {
    const p = rows(s.products).find((x) => x.name === m.item)
    value += (p?.price ?? 15_000) * (20 + Math.round(unitOf(code) * 60))
  }
  return { count: codes.size, value, orderCodes: [...codes.keys()] }
}

