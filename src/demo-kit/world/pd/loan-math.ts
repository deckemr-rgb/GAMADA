/**
 * world/pd/loan-math.ts — THE installment formula (tiny; Rapor Usaha and the UP seed's queue loans use it).
 */
/** ceil to Rp 1.000 of (amount / months + amount × ratePct %), simulasi; integer-safe (150 jt, 0,85 %, 12 ⇒ 13.775.000) */
export function installment(amount: number, ratePct: number, months: number): number {
  const principal = Math.round(amount / Math.max(1, months))
  const interest = Math.round((amount * Math.round(ratePct * 100)) / 10_000)
  return Math.ceil((principal + interest) / 1000) * 1000
}
