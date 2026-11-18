/**
 * demos/pajak-beres/pph21.ts — monthly PPh 21 of the 5 toko employees with the TER method (rules.ts): category by
 * PTKP status, the TER row the gross falls in, amount = gross × rate (rounded down to the rupiah). The ONE function
 * for the PPh 21 tab, the Kalender / Ekspor amounts and the AI context.
 */
import type { Staff, WorldState } from '../../demo-kit/world'
import { staffOf } from '../../demo-kit/world/usaha-pintar'
import { TER_CATEGORY, terRowOf, type TerCategory, type TerRow } from './rules'

export interface Pph21Row { staff: Staff; category: TerCategory; row: TerRow | null; rate: number; amount: number }

export function pph21Rows(s: WorldState): Pph21Row[] {
  const ids = s.meta.facts.up?.payrollStaffIds ?? []
  const all = staffOf(s, s.meta.shopId)
  return ids
    .map((id) => all.find((x) => x.id === id))
    .filter((x): x is Staff => !!x)
    .map((staff) => {
      const category = TER_CATEGORY[staff.ptkp]
      const row = terRowOf(category, staff.gross)
      const rate = row?.rate ?? 0
      return { staff, category, row, rate, amount: Math.floor(staff.gross * rate) }
    })
}

export const pph21Total = (rows: readonly Pph21Row[]): number => rows.reduce((a, r) => a + r.amount, 0)
export const grossTotal = (rows: readonly Pph21Row[]): number => rows.reduce((a, r) => a + r.staff.gross, 0)
