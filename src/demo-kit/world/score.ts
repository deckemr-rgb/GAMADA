/**
 * world/score.ts — Rapor Usaha business health score (0–1000), recomputed deterministically from state.
 * Stored factors (omzet stability, margin, supplier punctuality, growth) come from the generator; the
 * compliance factors (pajak, kyb) are DERIVED from live state, so events in Pajak Beres / Kenal Mitra move it.
 */
import type { ScoreFactor, WorldState } from './types'
import { clamp, round } from './util'

export const SCORE_WEIGHTS: Record<ScoreFactor, number> = {
  omzet: 0.2,
  margin: 0.15,
  pajak: 0.2,
  supplier: 0.15,
  kyb: 0.15,
  pertumbuhan: 0.15,
}

export function scoreOf(f: Record<ScoreFactor, number>): number {
  let s = 0
  for (const k of Object.keys(SCORE_WEIGHTS) as ScoreFactor[]) s += SCORE_WEIGHTS[k] * clamp(f[k], 0, 1)
  return Math.round(s * 1000)
}

/** journal entries that still need review for a business */
export function pendingReviews(s: WorldState, businessId: string): number {
  let n = 0
  for (const id of s.ledger.ids) {
    const e = s.ledger.byId[id]
    if (e && e.businessId === businessId && e.needsReview) n++
  }
  return n
}

/** factors with the compliance parts derived from current state */
export function deriveFactors(s: WorldState, businessId: string): Record<ScoreFactor, number> | null {
  const b = s.businesses.byId[businessId]
  const stored = s.bizScores.byId[businessId]
  if (!b || !stored) return null
  const reviews = pendingReviews(s, businessId)
  let taxOk = b.taxTidy ? 0.92 : 0.6
  // a tax item marked ready/paid this month lifts compliance even before the badge flips
  for (const id of s.taxItems.ids) {
    const t = s.taxItems.byId[id]
    if (t && t.businessId === businessId && t.status === 'perlu-hitung') taxOk -= 0.04
  }
  const pajak = clamp(round(taxOk - reviews * 0.05, 3), 0.15, 1)
  const kyb = b.verified ? 1 : 0.35
  return { ...stored.factors, pajak, kyb }
}

export function computeScore(s: WorldState, businessId: string): { score: number; factors: Record<ScoreFactor, number> } | null {
  const f = deriveFactors(s, businessId)
  if (!f) return null
  return { score: scoreOf(f), factors: f }
}
