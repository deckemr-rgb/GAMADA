/**
 * world/pd/shock-commodities.ts — which commodities a flood shocks (tiny; the UP seed orders the shop's price alerts by it).
 */
import type { RegionRef } from '../types'

/** cabai rawit first, then beras (the commodities a flood shocks) */
export function shockCommodities(region: RegionRef): string[] {
  const comm = (re: RegExp) => region.commodities.find((c) => re.test(`${c.id} ${c.name.id}`))
  const cabai = comm(/cabai.?rawit/i) ?? comm(/cabai/i) ?? region.commodities[0]
  const beras = comm(/beras/i) ?? region.commodities[1] ?? region.commodities[0]
  return [cabai?.id, beras?.id].filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
}

