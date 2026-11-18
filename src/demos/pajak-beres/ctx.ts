/**
 * demos/pajak-beres/ctx.ts — the AI context of Tanya Pajak (sim scenario AND the Live proxy, ≤ 6 KB): every number
 * from the world selectors and rules.ts, so the answer quotes exactly what the KPI strip, Laporan, Kalender and
 * Ekspor show. Loaded with the lazy chat surface only.
 */
import { DAY_MIN, isoDay, type WorldState } from '../../demo-kit/world'
import { COA, omzetByMonth, pendingReviews, pnlMonthly, pphFinalOf, taxCalendar, vendorProfile } from '../../demo-kit/world/usaha-pintar'
import { pph21Rows, pph21Total } from './pph21'
import { PPH_FINAL, exemptCrossedIn, taxableOmzet } from './rules'
import { rulesList } from './rules-text'
import { periodOf, prevPeriodOf, taxAmountOf, taxItemOf, type Lang, type RoleKey } from './model'

export interface PbContext {
  lang: Lang
  role: RoleKey
  today: string
  period: string
  prevPeriod: string
  shop: { name: string; legal: string; pkp: false; npwp: string }
  omzetYear: Record<string, number>
  omzetYtd: number
  exemptCrossedIn: string | null
  pphFinal: { omzet: number; cumulativeBefore: number; taxable: number; amount: number; computed: boolean; status: string }
  pphFinalPrev: { period: string; omzet: number; amount: number }
  pph21: { total: number; computed: boolean; rows: { name: string; ptkp: string; category: string; gross: number; rate: number; amount: number }[] }
  laba: { revenue: number; cogs: number; expenses: number; net: number }
  labaPrev: number
  reviews: number
  deadlines: { label: string; date: string; amount: number | null }[]
  rules: { key: string; value: string; ref: string; url: string }[]
  accounts: string[]
}

export function pbContext(s: WorldState, lang: Lang, role: RoleKey): PbContext {
  const shop = s.meta.shopId
  const period = periodOf(s)
  const prev = prevPeriodOf(s)
  const year = period.slice(0, 4)
  const om = omzetByMonth(s, shop)
  const omzetYear: Record<string, number> = {}
  for (const m of Object.keys(om).sort()) if (m.startsWith(year)) omzetYear[m] = om[m] ?? 0
  const f = pphFinalOf(s, shop, period)
  const fPrev = pphFinalOf(s, shop, prev)
  const fItem = taxItemOf(s, 'pph-final-umkm', period)
  const pItem = taxItemOf(s, 'pph21', period)
  const fAmt = fItem ? taxAmountOf(s, fItem) : { amount: f.amount, computed: false }
  const rows = pph21Rows(s)
  const pnl = pnlMonthly(s, shop)
  const cur = pnl[pnl.length - 1]!
  const vp = vendorProfile(s, shop)
  return {
    lang, role, today: s.day, period, prevPeriod: prev,
    shop: { name: vp?.name ?? '', legal: 'orang pribadi (perorangan)', pkp: false, npwp: vp?.npwp ?? '' },
    omzetYear,
    omzetYtd: Object.values(omzetYear).reduce((a, v) => a + v, 0),
    exemptCrossedIn: exemptCrossedIn(om, year),
    pphFinal: { omzet: f.omzet, cumulativeBefore: f.cumulativeBefore, taxable: taxableOmzet(f.omzet, f.cumulativeBefore), amount: fAmt.amount, computed: fAmt.computed, status: fItem?.status ?? 'perlu-hitung' },
    pphFinalPrev: { period: prev, omzet: fPrev.omzet, amount: fPrev.amount },
    pph21: {
      total: pItem ? taxAmountOf(s, pItem).amount : pph21Total(rows), computed: pItem?.amount != null,
      rows: rows.map((r) => ({ name: r.staff.name, ptkp: r.staff.ptkp, category: r.category, gross: r.staff.gross, rate: r.rate, amount: r.amount })),
    },
    laba: { revenue: cur.revenue, cogs: cur.cogs, expenses: cur.expenses, net: cur.net },
    labaPrev: pnl[pnl.length - 2]?.net ?? 0,
    reviews: pendingReviews(s, shop),
    deadlines: taxCalendar(s, shop, 0)
      .filter((e) => e.at >= 0 && e.tone !== 'done')
      .slice(0, 4)
      .map((e) => {
        const it = e.taxItemId ? s.taxItems.byId[e.taxItemId] : undefined
        return { label: e.label[lang], date: isoDay(s.day, Math.floor(e.at / DAY_MIN)), amount: it && e.kind === 'setor' ? taxAmountOf(s, it).amount : null }
      }),
    rules: rulesList().map((r) => ({ key: r.key, value: r.value[lang], ref: r.source.ref, url: r.source.url })),
    accounts: COA.map((c) => c.account),
  }
}

export const RATE = PPH_FINAL.rate
