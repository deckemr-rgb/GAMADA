/**
 * world/up/reputation.ts — Pantau Merek reputation (SIMULATED index, 0–100): 50 + 50 × the weighted mean of the
 * brand's mentions of the trailing 24 h (rating (r − 3) / 2 when rated, else ±0,7 by sentiment); a negative that was
 * already answered weighs × 0,5. Mentions dated in the future (a scheduled burst) do not count yet.
 */
import type { BrandMention, WorldState } from '../types'

export const REPUTATION = { windowMin: 24 * 60, repliedNegativeWeight: 0.5 }

export const mentionValue = (m: BrandMention): number => (m.rating != null ? (m.rating - 3) / 2 : m.sentiment === 'positif' ? 0.7 : m.sentiment === 'negatif' ? -0.7 : 0)

/** the reputation of `brand` (business id, competitor name or 'kategori') at minute `t` */
export function reputationAt(s: WorldState, t: number, brand: string): number {
  let sum = 0
  let w = 0
  for (const id of s.brandMentions.ids) {
    const m = s.brandMentions.byId[id]
    if (!m || m.brand !== brand || m.at > t || m.at <= t - REPUTATION.windowMin) continue
    const weight = m.sentiment === 'negatif' && m.repliedAt != null && m.repliedAt <= t ? REPUTATION.repliedNegativeWeight : 1
    sum += weight * mentionValue(m)
    w += weight
  }
  return Math.round(50 + 50 * (w ? sum / w : 0))
}
