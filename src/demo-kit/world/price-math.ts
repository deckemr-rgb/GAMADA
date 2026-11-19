/**
 * world/price-math.ts — tiny price formulas shared by Satu Daerah (sd/leader re-exports them) and Pasar Daerah, so a
 * Pasar Daerah product never pulls sd/leader.
 */

/** 7-day change of a price vs the close 7 days back (0.12 = +12 %) — THE 7-day Δ of every screen */
export function weekChangeOf(price: number, history: readonly number[]): number {
  const base = history[history.length - 7] ?? history[0] ?? price
  return base > 0 ? (price - base) / base : 0
}
