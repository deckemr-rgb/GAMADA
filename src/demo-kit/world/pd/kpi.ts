/**
 * world/pd/kpi.ts — the Katalog Lokal KPI strip (UP-free; Indeks Ekonomi's Dinkop card reads the same numbers).
 */
import { createParamSelector } from '../selectors'
import { monthOf, rows } from '../util'

const minuteOfMonthStart = (day: string) => Math.round((Date.parse(`${monthOf(day)}-01T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 60_000)
/** KPI strip: open needs · verified local UMKM (= Kenal Mitra) · orders today (+ distinct businesses) · spend this month (simulasi) */
export const catalogKpi = createParamSelector((s) => [s.catalogNeeds, s.businesses, s.orders, s.day], (now: number, needs, businesses, orders, day) => {
  const open = rows(needs).filter((n) => n.status === 'baru' || n.status === 'dicocokkan').length
  let verifiedLocal = 0
  for (const id of businesses.ids) if (businesses.byId[id]!.verified) verifiedLocal++
  const today = rows(orders).filter((o) => o.at >= 0 && o.at <= now)
  const m0 = minuteOfMonthStart(day)
  const paid = rows(orders).filter((o) => o.status === 'dibayar' && (o.paidAt ?? o.at) >= m0 && (o.paidAt ?? o.at) <= now)
  return { openNeeds: open, verifiedLocal, ordersToday: today.length, ordersTodayBusinesses: new Set(today.map((o) => o.businessId)).size, spendMonth: paid.reduce((a, o) => a + o.total, 0), paidOrdersMonth: paid.length }
})

