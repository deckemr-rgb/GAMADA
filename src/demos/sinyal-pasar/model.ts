/**
 * demos/sinyal-pasar/model.ts — small pure helpers shared by the desk and the lazy chunks (names, units, the focus
 * router). Numbers always come from world/pasar-daerah selectors; nothing here computes a price.
 */
import type { Bi, PricePoint, WorldState } from '../../demo-kit/world'

export const cName = (s: WorldState, id: string): Bi => s.region.commodities.find((c) => c.id === id)?.name ?? { id, en: id }
export const cUnit = (s: WorldState, id: string): string => s.region.commodities.find((c) => c.id === id)?.unit ?? 'kg'
export const mName = (s: WorldState, id: string): string => s.markets.byId[id]?.name ?? id
export const lower = (b: Bi): Bi => ({ id: b.id.toLowerCase(), en: b.en.toLowerCase() })

export type Route =
  | { kind: 'price'; id: string }
  | { kind: 'op'; id: string }
  | { kind: 'warn'; id: string | null }
  | { kind: 'alert'; id: string }
  | { kind: 'watch'; priceId: string }

const PREFIX = /^(prices|marketOps|priceWarnings|priceShocks|priceAlerts|distributorWatches):/
/** route a ?focus= id (with or without its `table:` prefix); null = unknown */
export function routeFocus(s: WorldState, raw: string): Route | null {
  const id = raw.replace(PREFIX, '')
  if (s.prices.byId[id]) return { kind: 'price', id }
  if (s.marketOps.byId[id]) return { kind: 'op', id }
  if (s.priceWarnings.byId[id]) return { kind: 'warn', id }
  if (s.priceShocks.byId[id]) {
    const w = s.priceWarnings.ids.map((k) => s.priceWarnings.byId[k]!).find((x) => x.shockId === id)
    return { kind: 'warn', id: w?.id ?? null }
  }
  if (s.priceAlerts.byId[id]) return { kind: 'alert', id }
  const dw = s.distributorWatches.byId[id]
  if (dw) {
    const p = s.prices.ids.find((k) => s.prices.byId[k]!.commodityId === dw.commodityId && s.prices.byId[k]!.anomaly) ?? s.prices.ids.find((k) => s.prices.byId[k]!.commodityId === dw.commodityId)
    return p ? { kind: 'watch', priceId: p } : null
  }
  return null
}

const lastCache = new WeakMap<object, PricePoint | null>()
/** the pair the latest natural tick moved (seeded closes are stamped 06.00) */
export const latestTick = (s: WorldState): PricePoint | null => {
  const hit = lastCache.get(s.prices)
  if (hit !== undefined) return hit
  let best: PricePoint | null = null
  for (const id of s.prices.ids) {
    const p = s.prices.byId[id]!
    if (p.updatedAt > 6 * 60 && (!best || p.updatedAt > best.updatedAt)) best = p
  }
  lastCache.set(s.prices, best)
  return best
}

