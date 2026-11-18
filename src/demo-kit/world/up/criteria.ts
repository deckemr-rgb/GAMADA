/**
 * world/up/criteria.ts — how a call's six criteria are drawn (seed + natural events): the agent's radar + noise, the
 * clip's weak criterion forced lowest; flags follow the weak criterion.
 */
import type { Criteria, CriterionKey } from '../types'
import { hashString, makeRng, type Rng } from '../prng'
import { clamp } from '../util'
import { CRITERIA_KEYS } from './call-score'
import { FLAG_OF } from './base'

export function drawCriteria(radar: Criteria, weak: CriterionKey, r: Rng, dip = 0): Criteria {
  const c = {} as Criteria
  for (const k of CRITERIA_KEYS) c[k] = clamp(Math.round(radar[k] + r.normal(0, 7) - dip), 25, 100)
  let low = Infinity
  for (const k of CRITERIA_KEYS) if (k !== weak) low = Math.min(low, c[k])
  c[weak] = clamp(Math.min(c[weak], low - r.int(6, 16)), 10, 100)
  return c
}
/** deterministic from a key (natural events) */
export const drawCriteriaPure = (radar: Criteria, weak: CriterionKey, key: string): Criteria => drawCriteria(radar, weak, makeRng(hashString(key)))
/** the weak criterion's flag when it is below 60 */
export const flagsOf = (c: Criteria, weak: CriterionKey): string[] => (c[weak] < 60 ? [FLAG_OF[weak]] : [])
export const flagsOfPure = flagsOf
