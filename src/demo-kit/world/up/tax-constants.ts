/**
 * world/up/tax-constants.ts — the PPh Final UMKM rule the seed and every product use (owner-approved, plan §6 P1 rows
 * 1–3). Pajak Beres's rules.ts re-exports PPH_FINAL and asserts equality; no other literal of these numbers exists.
 *   - 0,5 % of monthly gross turnover, final (PP 55/2022 jo. PP 20/2026)
 *   - an individual (orang pribadi) pays nothing on the first Rp 500 jt of cumulative turnover in a year (Ps. 60(2))
 *   - the 0,5 % facility and the PKP line end at Rp 4,8 M a year
 */
export const PPH_FINAL = {
  rate: 0.005,
  exemptOmzetOP: 500_000_000,
  ceiling: 4_800_000_000,
  ref: 'PP 55/2022 jo. PP 20/2026',
} as const

/** PPh Final of one month for an individual, given the cumulative turnover of the year BEFORE that month */
export function pphFinalMonth(omzetMonth: number, cumulativeBefore: number): number {
  const taxable = Math.max(0, cumulativeBefore + omzetMonth - Math.max(cumulativeBefore, PPH_FINAL.exemptOmzetOP))
  return Math.round(taxable * PPH_FINAL.rate)
}
