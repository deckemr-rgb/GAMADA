/**
 * world/up/call-score.ts — the ONE call score rule (Juara Jualan): list score = detail total = audit row = toast.
 * Tiny on purpose: the full pipeline's `call.scored` reducer imports it.
 */
import type { Criteria, CriterionKey } from '../types'

/** weights per criterion (Σ = 100) */
export const CALL_WEIGHTS: Record<CriterionKey, number> = { salam: 10, gali: 20, keberatan: 20, penawaran: 20, closing: 20, kepatuhan: 10 }
export const CRITERIA_KEYS = Object.keys(CALL_WEIGHTS) as CriterionKey[]

/** 0..100 = Σ weight × criterion (each 0..100) / 100, rounded */
export function callScore(c: Criteria): number {
  let s = 0
  for (const k of CRITERIA_KEYS) s += CALL_WEIGHTS[k] * Math.max(0, Math.min(100, c[k]))
  return Math.round(s / 100)
}

/** the n lowest criteria (ties: weight desc, then key order) */
export function weakest(c: Criteria, n = 3): CriterionKey[] {
  return [...CRITERIA_KEYS].sort((a, b) => c[a] - c[b] || CALL_WEIGHTS[b] - CALL_WEIGHTS[a] || CRITERIA_KEYS.indexOf(a) - CRITERIA_KEYS.indexOf(b)).slice(0, n)
}
