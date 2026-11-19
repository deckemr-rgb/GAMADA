/**
 * world/pd/seed-pd.ts — the Pasar Daerah data patch (`extendPasarDaerah`, applied once per world by the store when the
 * PD module is registered: `meta.ext['pasar-daerah']`). Deterministic, own stream, UP-free and independent of the UP
 * data patch (either order gives the same world):
 *  - `facts.pd`: shock commodities (cabai rawit, beras), the 07:01 tick market (the shop's town market), a
 *    fictional subscriber count, the past operation id;
 *  - ONE past market operation (beras, the first market of the highest-flood-risk kecamatan that has one, ≈ 35 days
 *    ago, done, −6 %, 3 days, sent by Disperindag): that market's beras closes of days −35…−21 sit 4–6 % lower and the
 *    October index of its kecamatan is +0.6 (an econ event the series shows as a marker).
 */
import type { Market, MarketOperation, PdFacts, WorldState } from '../types'
import { shockCommodities } from './shock-commodities'

export { shockCommodities }
import { streamRng } from '../prng'
import { DAY_MIN, centroid, distanceKm, monthOf, patch, round, rows, upsert } from '../util'

const roundTo = (n: number, step: number): number => Math.round(n / step) * step

export function extendPasarDaerah(s0: WorldState): WorldState {
  if (s0.meta.facts.pd) return s0
  const rpd = streamRng(s0.seed, s0.regionId, 'pd-ops')
  const seq = { ...s0.meta.seq }
  const region = s0.region
  const markets = rows(s0.markets).sort((a, b) => a.id.localeCompare(b.id))
  const kecById = new Map(region.kecamatan.map((k) => [k.id, k]))
  const [cabaiId, berasId] = shockCommodities(region)
  const beras = region.commodities.find((c) => c.id === berasId)
  const kabCentre = centroid(region.kecamatan.map((k) => k.centroid))
  // the town market of the scenario (the shop's market) when the pack names one, else the market nearest the kabupaten centre
  const tickMarket = markets.find((m) => m.id === region.shopMarketId) ?? [...markets].sort((a, b) => distanceKm(a.coord, kabCentre) - distanceKm(b.coord, kabCentre) || a.id.localeCompare(b.id))[0]
  const risk = (m: Market) => kecById.get(m.kecamatanId ?? '')?.riskFlood ?? -1
  const opMarket = [...markets].sort((a, b) => risk(b) - risk(a) || a.id.localeCompare(b.id))[0]
  let s = s0
  let pastOpId = ''
  if (opMarket && beras) {
    const opAt = -35 * DAY_MIN + 9 * 60
    const volumeTon = rpd.int(8, 14)
    seq.marketOps = (seq.marketOps ?? 0) + 1
    pastOpId = `OP-${String(seq.marketOps).padStart(4, '0')}`
    const op: MarketOperation = {
      id: pastOpId, at: opAt, stage: 'done', commodityId: beras.id, marketIds: [opMarket.id], effectPct: -6, forRole: 'kepala-daerah', cause: null, sentBy: 'disperindag', volumeTon, days: 3,
      startedAt: opAt + DAY_MIN, doneAt: opAt + 4 * DAY_MIN,
      reason: { id: `Operasi pasar ${beras.name.id} di ${opMarket.name} (${volumeTon} ton, 3 hari, simulasi)`, en: `Market operation for ${beras.name.en} at ${opMarket.name} (${volumeTon} t, 3 days, simulated)` },
    }
    s = { ...s, marketOps: upsert(s.marketOps, op) }
    const step = beras.basePrice >= 20_000 ? 500 : 100
    s = {
      ...s,
      prices: patch(s.prices, `${opMarket.id}:${beras.id}`, (row) => {
        const n = row.history.length
        const history = row.history.map((v, i) => {
          const d = i - n
          return d >= -35 && d <= -21 ? roundTo(v * (1 - (0.04 + 0.02 * Math.sin(((d + 35) / 14) * Math.PI))), step) : v
        })
        return { ...row, history }
      }),
    }
    const oct = monthOf(s.day, -1)
    s = {
      ...s,
      econIndex: patch(s.econIndex, `${opMarket.kecamatanId ?? ''}:${oct}`, (cell) => {
        const index = round(cell.index + 0.6, 1)
        return { ...cell, index, events: [...(cell.events ?? []), { at: opAt + 4 * DAY_MIN, delta: 0.6, index, reason: { id: `Operasi pasar ${beras.name.id} selesai`, en: `${beras.name.en} market operation completed` }, kind: 'program' as const, cause: `marketOps:${pastOpId}` }] }
      }),
    }
  }
  const foodBiz = rows(s0.businesses).filter((b) => b.kind === 'warung-makan' || b.kind === 'katering' || b.kind === 'olahan-pangan' || b.kind === 'kelontong' || b.kind === 'kedai-kopi').length
  const pd: PdFacts = { shockCommodityIds: [cabaiId, berasId].filter((x): x is string => !!x), tickMarketId: tickMarket?.id ?? '', subscriberCount: foodBiz * 3 + rpd.int(11, 29), pastOpId }
  return { ...s, meta: { ...s.meta, seq, facts: { ...s.meta.facts, pd } } }
}
