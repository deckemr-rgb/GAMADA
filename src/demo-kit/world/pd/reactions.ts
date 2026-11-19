/**
 * world/pd/reactions.ts — the Pasar Daerah chains C30–C38 (C33 is the natural shock path in natural-pd.ts + the
 * existing C13 / C20). Pure: (event, state after its reducer) → follow-ups, idempotent by state checks. Follow-ups
 * carry the CONSUMING product as source (cross-product toasts). Registered by world/pd/chains.ts.
 */
import type { AnyFollowUp, Bi, EventType, FollowUp, WorldEvent, WorldState } from '../types'
import { distanceKm, monthOf, ref, round, rows } from '../util'
import { hashString } from '../prng'
import { PD } from './config'
import { newMatchesFor } from './match'
import { opSimulate, priceOutlook } from './forecast'
import { fill } from './texts'
import { ALERT_ADVICE, ALERT_TEXT } from './texts-chains'

export interface PdReaction { id: string; on: EventType; run(e: WorldEvent, s: WorldState): AnyFollowUp[] }
const react = <K extends EventType>(id: string, on: K, run: (e: WorldEvent<K>, s: WorldState) => AnyFollowUp[]): PdReaction => ({ id, on, run: run as PdReaction['run'] })
const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp
const name = (s: WorldState, id: string): Bi => s.region.commodities.find((c) => c.id === id)?.name ?? { id, en: id }
const kecOfMarket = (s: WorldState, m: string) => s.markets.byId[m]?.kecamatanId ?? null

/** the markets a flood shocks: those in the alert kecamatan (highest flood risk first, ≤ 3), else the 3 nearest */
export function shockMarkets(s: WorldState, kecIds: string[]): string[] {
  const risk = (k: string | null) => s.region.kecamatan.find((x) => x.id === k)?.riskFlood ?? 0
  const inside = rows(s.markets).filter((m) => m.kecamatanId && kecIds.includes(m.kecamatanId)).sort((a, b) => risk(b.kecamatanId) - risk(a.kecamatanId) || a.id.localeCompare(b.id))
  if (inside.length) return inside.slice(0, 3).map((m) => m.id)
  const c = s.region.kecamatan.find((k) => k.id === kecIds[0])?.centroid
  if (!c) return []
  return rows(s.markets).sort((a, b) => distanceKm(a.coord, c) - distanceKm(b.coord, c) || a.id.localeCompare(b.id)).slice(0, 3).map((m) => m.id)
}

export const PD_CHAIN_REACTIONS: readonly PdReaction[] = [
  /* C30 flood → supply shocks on the pack's shock commodities (once per alert × commodity) */
  react('flood→price-shock', 'flood.alert', (e, s) => {
    const alertId = e.payload.id
    if (!alertId) return []
    const ids = s.meta.facts.pd?.shockCommodityIds ?? []
    const markets = shockMarkets(s, e.payload.kecamatanIds)
    if (!markets.length) return []
    const cause = ref('alerts', alertId)
    return ids.flatMap((c, i) =>
      rows(s.priceShocks).some((x) => x.cause === cause && x.commodityId === c)
        ? []
        : [fu('price.shock', { commodityId: c, marketIds: markets, startAt: e.at, peakDay: PD.earlyWarnDays, pct: PD.shockPct[i] ?? PD.shockPct[PD.shockPct.length - 1]!, cause }, 'sinyal-pasar')],
    )
  }),
  /* C31 a new shock → the early warning (peak from priceOutlook, "in 5 days") */
  react('shock→warning', 'price.shock', (e, s) => {
    const id = e.payload.id
    if (!id || e.payload.damp != null || rows(s.priceWarnings).some((w) => w.shockId === id)) return []
    const sh = s.priceShocks.byId[id]
    const m0 = sh?.marketIds[0]
    if (!sh || !m0) return []
    const o = priceOutlook(s, `${m0}:${sh.commodityId}`, e.at)
    if (!o) return []
    return [fu('price.warning', { shockId: id, commodityId: sh.commodityId, marketIds: sh.marketIds, peakInDays: sh.peakDay, peakPct: round(o.peakPct, 1), expected: o.expected, cause: sh.cause ?? ref('priceShocks', id) }, 'sinyal-pasar')]
  }),
  /* C32 a warning → an early alert to every subscribed business (commodity + threshold) */
  react('warning→umkm-alert', 'price.warning', (e, s) => {
    const w = e.payload
    if (!w.id) return []
    const c = name(s, w.commodityId)
    const market = s.markets.byId[w.marketIds[0] ?? '']?.name ?? ''
    return rows(s.priceSubs)
      .filter((sub) => sub.commodityIds.includes(w.commodityId) && sub.thresholdPct <= w.peakPct && !rows(s.priceAlerts).some((a) => a.subId === sub.id && a.warningId === w.id))
      .map((sub) => {
        const shop = s.businesses.byId[sub.businessId]?.name ?? ''
        const k = hashString(`${w.id}|${sub.id}`)
        const today = rows(s.priceAlerts).filter((a) => a.businessId === sub.businessId)
        const tIdx = (k + today.length) % ALERT_TEXT.length
        const v = { item: c.id.toLowerCase(), pct: Math.round(w.peakPct), days: w.peakInDays, market, shop }
        const text = fill(ALERT_TEXT[tIdx]!, v)
        text.en = fill(ALERT_TEXT[tIdx]!, { ...v, item: c.en.toLowerCase() }).en
        const advice = fill(ALERT_ADVICE[(k + today.length + 1) % ALERT_ADVICE.length]!, { item: c.id.toLowerCase() })
        advice.en = fill(ALERT_ADVICE[(k + today.length + 1) % ALERT_ADVICE.length]!, { item: c.en.toLowerCase() }).en
        return fu('price.alertSent', { subId: sub.id, businessId: sub.businessId, warningId: w.id!, commodityId: w.commodityId, marketId: w.marketIds[0] ?? '', peakInDays: w.peakInDays, peakPct: w.peakPct, text, advice }, 'sinyal-pasar')
      })
  }),
  /* C34 an operation starts running → it damps the shock (opSimulate) and the economy index notes it (once per op) */
  react('op→price-relief', 'market.operation', (e, s) => {
    if (e.payload.stage !== 'running') return []
    const op = s.marketOps.byId[e.payload.id ?? '']
    if (!op) return []
    const sim = opSimulate(s, { commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: op.volumeTon ?? 10, days: op.days ?? 3 }, e.at)
    return rows(s.priceShocks)
      .filter((x) => x.commodityId === op.commodityId && x.marketIds.some((m) => op.marketIds.includes(m)) && x.damp < sim.damp)
      .map((x) => fu('price.shock', { id: x.id, commodityId: x.commodityId, marketIds: x.marketIds, startAt: x.startAt, peakDay: x.peakDay, pct: x.pct, damp: sim.damp, cause: x.cause }, 'sinyal-pasar'))
  }),
  react('op→econ', 'market.operation', (e, s) => {
    if (e.payload.stage !== 'running') return []
    const op = s.marketOps.byId[e.payload.id ?? '']
    if (!op) return []
    const cause = ref('marketOps', op.id)
    const month = monthOf(s.day)
    const kecs = [...new Set(op.marketIds.map((m) => kecOfMarket(s, m)).filter((k): k is string => !!k))]
    const c = name(s, op.commodityId)
    const up = round(Math.abs(op.effectPct) * 0.25, 1)
    return kecs.flatMap((k) => {
      const cell = s.econIndex.byId[`${k}:${month}`]
      if (!cell || (cell.events ?? []).some((x) => x.cause === cause)) return []
      const kn = s.region.kecamatan.find((x) => x.id === k)?.name ?? k
      return [fu('econ.updated', { kecamatanId: k, month, index: round(cell.index + up, 1), delta: up, kind: 'program', cause, reason: { id: `Operasi pasar ${c.id.toLowerCase()} menahan harga di Kec. ${kn}`, en: `The ${c.en.toLowerCase()} market operation holds prices in ${kn}` } }, 'indeks-ekonomi')]
    })
  }),
  /* C35 a flood alert (level ≥ 2) → this month's index of each alert kecamatan drops by its flood risk (once per alert × kecamatan) */
  react('flood→econ-nowcast', 'flood.alert', (e, s) => {
    if (!e.payload.id || e.payload.level < 2) return []
    const cause = ref('alerts', e.payload.id)
    const month = monthOf(s.day)
    return e.payload.kecamatanIds.flatMap((k) => {
      const cell = s.econIndex.byId[`${k}:${month}`]
      const kec = s.region.kecamatan.find((x) => x.id === k)
      if (!cell || !kec || (cell.events ?? []).some((x) => x.cause === cause)) return []
      const index = round(cell.index * (1 - (0.04 + 0.05 * kec.riskFlood)), 1)
      return [fu('econ.updated', { kecamatanId: k, month, index, delta: round(index - cell.index, 1), kind: 'banjir', cause, reason: { id: `Peringatan banjir: aktivitas usaha Kec. ${kec.name} diperkirakan turun`, en: `Flood warning: business activity in ${kec.name} expected to drop` } }, 'indeks-ekonomi')]
    })
  }),
  /* C36 a need (not a natural one: those carry their matches) → up to 6 verified businesses with matchScore ≥ 0.45 */
  react('need→catalog-match', 'need.created', (e, s) => {
    const id = e.payload.id
    if (!id || e.payload.by === 'natural' || rows(s.matches).some((m) => m.needId === id)) return []
    return newMatchesFor(s, id).map((m) => fu('match.made', { needId: id, businessId: m.businessId, score: m.score }, 'katalog-lokal'))
  }),
  /* C37 the shop's order is paid → its journal in Pajak Beres (Kas D / Pendapatan C = order total) */
  react('order→ledger', 'order.paid', (e, s) => {
    const o = s.orders.byId[e.payload.orderId]
    if (!o || o.businessId !== s.meta.shopId || rows(s.ledger).some((j) => j.source === 'katalog' && j.refId === o.id)) return []
    return [fu('ledger.posted', {
      businessId: o.businessId, memo: { id: `Pembayaran pesanan ${o.code} (Katalog Lokal, Kas Daerah)`, en: `Payment of order ${o.code} (Katalog Lokal, regional treasury)` },
      lines: [{ account: 'Kas', debit: o.total, credit: 0 }, { account: 'Pendapatan Penjualan', debit: 0, credit: o.total }], source: 'katalog', refId: o.id, needsReview: false, confidence: 0.99,
    }, 'pajak-beres')]
  }),
  /* C38 the shop's loan is approved → the disbursal journal (Bank D / 2301 Utang Pinjaman C = approved amount) */
  react('loan→ledger', 'loan.approved', (e, s) => {
    const l = s.loanApps.byId[e.payload.loanId]
    if (!l || l.businessId !== s.meta.shopId || rows(s.ledger).some((j) => j.source === 'pinjaman' && j.refId === l.id)) return []
    const amount = l.decidedAmount ?? l.amount
    return [fu('ledger.posted', {
      businessId: l.businessId, memo: { id: `Pencairan modal kerja ${l.lender} (simulasi)`, en: `Working-capital disbursal from ${l.lender} (simulated)` },
      lines: [{ account: 'Bank', debit: amount, credit: 0 }, { account: 'Utang Pinjaman', debit: 0, credit: amount }], source: 'pinjaman', refId: l.id, needsReview: false, confidence: 0.99,
    }, 'pajak-beres')]
  }),
]
