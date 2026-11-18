/**
 * world/up/omzet.ts — THE omzet function (Toko Autopilot month KPI, Pajak Beres, Rapor Usaha): per month
 * = the simulated turnover before the daily history (facts.up.omzetPre) + Σ salesDaily of the business's outlets
 * (today's live sales included, salesDaily day 0 is updated by every sale).
 */
import type { WorldState } from '../types'
import { isoDay } from '../util'

/** 'YYYY-MM' → Rp for one business (pure; pass the facts' omzetPre) */
export function omzetByMonthRaw(s: WorldState, bizId: string, pre: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = { ...pre }
  const mine = new Set(s.outlets.ids.filter((id) => s.outlets.byId[id]?.businessId === bizId))
  const monthOf = new Map<number, string>()
  for (const id of s.salesDaily.ids) {
    const d = s.salesDaily.byId[id]
    if (!d || !mine.has(d.outletId)) continue
    let m = monthOf.get(d.day)
    if (!m) monthOf.set(d.day, (m = isoDay(s.day, d.day).slice(0, 7)))
    out[m] = (out[m] ?? 0) + d.revenue
  }
  return out
}
