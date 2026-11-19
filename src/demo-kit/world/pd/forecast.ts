/**
 * world/pd/forecast.ts — THE price model of Pasar Daerah (Sinyal Pasar, Indeks Ekonomi, the AI, the natural shock path
 * and C31/C34 all call these; simulated):
 *  - `seasonalBand(p)`: the seasonal expectation of today's price (level of the last 7 closes on the 30-day sine) and
 *    its band ± PD.anomalyBandSd × spread (spread = deviation of the last 30 closes, clamped 2.5–4 %);
 *  - `shockPath(shock, day)`: a supply shock's extra price (fraction) on shock day `day` — smoothstep up to the peak
 *    day, half-life 4 days after, × (1 − damp). In the demo one world minute after the shock = one shock day;
 *  - `priceOutlook(s, priceId, now)`: 30 closes + a 14-day forecast with band, peak and factors;
 *  - `opSimulate(s, op)`: the market-operation model (effect %, damp of the shock, the forecast after, cost).
 */
import type { Bi, EntityRef, MarketOperation, PricePoint, PriceShock, WorldState } from '../types'
import { clamp, round, rows } from '../util'
import { PD } from './config'

const season = (i: number) => 1 + 0.02 * Math.sin((i / 30) * Math.PI)
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
export const priceStep = (price: number): number => (price >= 20_000 ? 500 : 100)
const toStep = (v: number, step: number) => Math.round(v / step) * step

export interface Band { expected: number; lo: number; hi: number; sdPct: number }
const bandCache = new WeakMap<PricePoint, Band>()
/** seasonal expectation of TODAY's price and the anomaly band (THE "Δ vs musiman" baseline) */
export function seasonalBand(p: PricePoint): Band {
  const hit = bandCache.get(p)
  if (hit) return hit
  const h = p.history
  const n = h.length
  const de = (i: number) => h[i]! / season(i)
  const last7 = mean(Array.from({ length: Math.min(7, n) }, (_, k) => de(n - Math.min(7, n) + k)))
  const idx30 = Array.from({ length: Math.min(30, n) }, (_, k) => n - Math.min(30, n) + k)
  const lvl30 = mean(idx30.map(de))
  const sd = Math.sqrt(mean(idx30.map((i) => (de(i) / lvl30 - 1) ** 2)))
  const sdPct = clamp(sd, 0.025, 0.04)
  const step = priceStep(p.price)
  const expected = toStep((last7 || p.price) * season(n), step)
  const half = PD.anomalyBandSd * sdPct * expected
  const band = { expected, lo: toStep(expected - half, step), hi: toStep(expected + half, step), sdPct: round(sdPct, 4) }
  bandCache.set(p, band)
  return band
}

/** extra price fraction of a shock on shock day `day` (0 before it starts) */
export function shockPath(shock: Pick<PriceShock, 'pct' | 'peakDay' | 'damp'>, day: number): number {
  if (day <= 0) return 0
  const t = day / Math.max(1, shock.peakDay)
  const shape = t < 1 ? t * t * (3 - 2 * t) : 0.5 ** ((day - shock.peakDay) / 4)
  return (shock.pct / 100) * (1 - (shock.damp ?? 0)) * shape
}

/** the active shocks on a market × commodity (newest first) */
export const shocksOn = (s: WorldState, marketId: string, commodityId: string): PriceShock[] =>
  rows(s.priceShocks).filter((x) => x.commodityId === commodityId && x.marketIds.includes(marketId))
/** shock day of `now` (1 world minute = 1 shock day in the demo; ≥ 0) */
export const shockDay = (shock: PriceShock, now: number): number => Math.max(0, now - shock.startAt)
/** running (or approved) market operation on a pair */
export const opOn = (s: WorldState, marketId: string, commodityId: string): MarketOperation | undefined =>
  rows(s.marketOps).find((o) => o.commodityId === commodityId && o.marketIds.includes(marketId) && o.stage === 'running')

export type OutlookFactorKey = 'musim' | 'pasokan' | 'banjir' | 'operasi'
export interface Outlook {
  history30: number[]
  forecast14: number[]
  lo: number[]
  hi: number[]
  peakDay: number
  peakPct: number
  /** today vs the seasonal expectation, % */
  deltaPct: number
  expected: number
  factors: { key: OutlookFactorKey; pct: number; label: Bi; cause?: EntityRef }[]
}

function forecastOf(s: WorldState, p: PricePoint, now: number, extraDamp = 0, opEffectPct = 0) {
  const band = seasonalBand(p)
  const n = p.history.length
  const step = priceStep(p.price)
  const shocks = shocksOn(s, p.marketId, p.commodityId)
  const op = opOn(s, p.marketId, p.commodityId)
  const opPct = opEffectPct || (op && !shocks.length ? op.effectPct : 0)
  const values: number[] = []
  const lo: number[] = []
  const hi: number[] = []
  const shockAt: number[] = []
  for (let d = 1; d <= PD.forecastDays; d++) {
    const exp = band.expected * (season(n + d) / season(n))
    let sh = 0
    for (const x of shocks) sh += shockPath({ ...x, damp: Math.max(x.damp, extraDamp) }, shockDay(x, now) + d)
    const rel = opPct ? (opPct / 100) * Math.min(1, d / 3) : 0
    const v = exp * (1 + sh + rel)
    const w = PD.anomalyBandSd * band.sdPct * (0.4 + d / PD.forecastDays)
    values.push(toStep(v, step))
    lo.push(toStep(v * (1 - w), step))
    hi.push(toStep(v * (1 + w), step))
    shockAt.push(sh)
  }
  return { band, values, lo, hi, shockAt, shocks, op, opPct }
}

/** THE forecast of one market × commodity (`priceId` = `${marketId}:${commodityId}`) */
export function priceOutlook(s: WorldState, priceId: string, now: number): Outlook | null {
  const p = s.prices.byId[priceId]
  if (!p) return null
  const f = forecastOf(s, p, now)
  const n = p.history.length
  let k = 0
  for (let i = 1; i < f.values.length; i++) if (f.values[i]! > f.values[k]!) k = i
  const peakDay = k + 1
  const exp0 = f.band.expected
  const factors: Outlook['factors'] = [{ key: 'musim', pct: round((season(n + peakDay) / season(n) - 1) * 100, 1), label: { id: 'Pola musiman', en: 'Seasonal pattern' } }]
  const sig = rows(s.supplySignals).find((x) => x.commodityId === p.commodityId && x.direction === 'turun')
  if (sig) factors.push({ key: 'pasokan', pct: round(-sig.pct * 0.25, 1), label: { id: `Pasokan turun ${Math.abs(Math.round(sig.pct))}%`, en: `Supply down ${Math.abs(Math.round(sig.pct))}%` }, cause: `supplySignals:${sig.id}` })
  const sh = f.shocks[0]
  if (sh) factors.push({ key: 'banjir', pct: round(f.shockAt[k]! * 100, 1), label: { id: 'Banjir: pasokan terganggu', en: 'Flood: supply disrupted' }, ...(sh.cause ? { cause: sh.cause } : {}) })
  if (sh && sh.damp > 0) factors.push({ key: 'operasi', pct: -round(shockPath({ ...sh, damp: 0 }, shockDay(sh, now) + peakDay) * sh.damp * 100, 1), label: { id: 'Operasi pasar berjalan', en: 'Market operation running' } })
  else if (f.op) factors.push({ key: 'operasi', pct: round(f.op.effectPct, 1), label: { id: 'Operasi pasar berjalan', en: 'Market operation running' }, cause: `marketOps:${f.op.id}` })
  return {
    history30: [...p.history.slice(-29), p.price], forecast14: f.values, lo: f.lo, hi: f.hi, peakDay,
    peakPct: round((f.values[k]! / exp0 - 1) * 100, 1), deltaPct: round((p.price / exp0 - 1) * 100, 1), expected: exp0, factors,
  }
}

export interface OpPlan { commodityId: string; marketIds: string[]; volumeTon: number; days: number }
/**
 * THE market-operation model (simulasi): effect on the price −(2 + 0,45 × ton + 0,6 × hari) % (3–15 %), damp of an
 * active shock = ton × hari / 60 (≤ 0,8) — the default 10 t × 3 days halves the shock's peak; forecastAfter = the first
 * market's outlook with that operation; cost = ton × 1000 × expected price × 12 % (subsidy, simulasi).
 */
export function opSimulate(s: WorldState, op: OpPlan, now = 0): { effectPct: number; damp: number; baseline: number[]; forecastAfter: number[]; lo: number[]; hi: number[]; costRp: number } {
  const effectPct = -round(clamp(2 + op.volumeTon * 0.45 + op.days * 0.6, 3, 15), 1)
  const damp = round(clamp((op.volumeTon * op.days) / 60, 0, 0.8), 2)
  const p = s.prices.byId[`${op.marketIds[0] ?? ''}:${op.commodityId}`] ?? rows(s.prices).find((x) => x.commodityId === op.commodityId)
  if (!p) return { effectPct, damp, baseline: [], forecastAfter: [], lo: [], hi: [], costRp: 0 }
  const base = forecastOf(s, p, now)
  const after = forecastOf(s, p, now, damp, base.shocks.length ? 0 : effectPct)
  return { effectPct, damp, baseline: base.values, forecastAfter: after.values, lo: after.lo, hi: after.hi, costRp: Math.round((op.volumeTon * 1000 * base.band.expected * 0.12) / 100_000) * 100_000 }
}
