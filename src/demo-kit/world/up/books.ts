/**
 * world/up/books.ts — Pajak Beres selectors: THE omzet function, journal views, trial balance, P&L, balance sheet,
 * cash flow, tax calendar, the bank statement of November (40 rows). Amounts are SIMULATED; every entry balances.
 */
import type { Bi, LedgerEntry, LedgerLine, PurchaseOrder, TaxItem, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { hashString, makeRng } from '../prng'
import { DAY_MIN, isoDay, monthOf, rows } from '../util'
import { pendingReviews } from '../score'
import { coaOf } from './coa'
import { omzetByMonthRaw } from './omzet'
import { PPH_FINAL, pphFinalMonth } from './tax-constants'

export { pendingReviews }
export { COA, coaOf, type CoaRow, type AccountGroup } from './coa'
export { PPH_FINAL, pphFinalMonth } from './tax-constants'

/** minute of day 0 of a calendar date ('YYYY-MM-DD') relative to the demo day */
const minuteOfIso = (s: { day: string }, iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${s.day}T00:00:00Z`)) / 60_000)
const monthStart = (s: { day: string }, month: string) => minuteOfIso(s, `${month}-01`)
const monthEnd = (s: { day: string }, month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return minuteOfIso(s, new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10))
}

/** 'YYYY-MM' → omzet (Rp): THE omzet function of Toko Autopilot (month), Pajak Beres and Rapor Usaha */
export const omzetByMonth = createParamSelector((s) => [s.salesDaily, s.outlets, s.meta.facts.up, s.day], (bizId: string, salesDaily, outlets, up, day): Record<string, number> =>
  omzetByMonthRaw({ salesDaily, outlets, day } as unknown as WorldState, bizId, up?.omzetPre ?? {}),
)

/** PPh Final of a month for the business (individual: the first Rp 500 jt of the year are exempt) */
export function pphFinalOf(s: WorldState, bizId: string, period: string): { omzet: number; cumulativeBefore: number; taxable: number; amount: number } {
  const om = omzetByMonth(s, bizId)
  const year = period.slice(0, 4)
  let before = 0
  for (const [m, v] of Object.entries(om)) if (m.startsWith(year) && m < period) before += v
  const omzet = om[period] ?? 0
  const amount = pphFinalMonth(omzet, before)
  return { omzet, cumulativeBefore: before, taxable: Math.round(amount / PPH_FINAL.rate), amount }
}

/* ------------------------------------------------------------------ notas + journal */

export interface PendingNota { po: PurchaseOrder; supplierName: string; at: number; received: boolean; isNew: boolean }
/** supplier invoices to process: POs replied / received with no 'nota' journal row yet (newest first); a cold start
 *  without one falls back to the newest seeded received PO */
export const pendingNotas = createParamSelector((s) => [s.purchaseOrders, s.ledger, s.suppliers], (bizId: string, pos, ledger, suppliers): PendingNota[] => {
  const booked = new Set<string>()
  for (const id of ledger.ids) {
    const j = ledger.byId[id]
    if (j?.source === 'nota' && j.refId) booked.add(j.refId)
  }
  const list = rows(pos)
    .filter((p) => p.businessId === bizId && (p.status === 'dibalas' || p.status === 'diterima') && !booked.has(p.id) && (p.notaAt != null || p.at >= -7 * DAY_MIN))
    .map((po) => ({ po, supplierName: suppliers.byId[po.supplierId]?.name ?? po.supplierId, at: po.notaAt ?? po.reply?.at ?? po.at, received: po.status === 'diterima', isNew: po.notaAt != null }))
    .sort((a, b) => b.at - a.at || b.po.id.localeCompare(a.po.id))
  if (list.length) return list
  const last = rows(pos).filter((p) => p.businessId === bizId && p.status === 'diterima' && !booked.has(p.id)).sort((a, b) => b.at - a.at)[0]
  return last ? [{ po: last, supplierName: suppliers.byId[last.supplierId]?.name ?? last.supplierId, at: last.reply?.at ?? last.at, received: true, isNew: false }] : []
})

/** the journal row a processed nota posts (Persediaan D / Kas or Utang Usaha C, total = PO total) */
export function notaLines(po: PurchaseOrder, paidCash = false): LedgerLine[] {
  return [{ account: 'Persediaan', debit: po.total, credit: 0 }, { account: paidCash ? 'Kas' : 'Utang Usaha', debit: 0, credit: po.total }]
}

/** journal entries of a business in [from, to] (minutes), newest first; `review` = only rows needing review */
export function ledgerRows(s: WorldState, bizId: string, opts: { from?: number; to?: number; review?: boolean } = {}): LedgerEntry[] {
  return rows(s.ledger)
    .filter((j) => j.businessId === bizId && j.at >= (opts.from ?? -Infinity) && j.at <= (opts.to ?? Infinity) && (!opts.review || j.needsReview))
    .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
}

/* ------------------------------------------------------------------ statements */

export interface TbRow { account: string; code: string; debit: number; credit: number; balance: number }
/** cumulative trial balance through the end of `period` ('YYYY-MM') */
const tbSel = createParamSelector((s) => [s.ledger, s.day], (key: string, ledger, day): { rows: TbRow[]; debit: number; credit: number; balanced: boolean } => {
  const [bizId, period] = key.split('|') as [string, string]
  const end = monthEnd({ day }, period)
  const acc = new Map<string, { d: number; c: number }>()
  for (const j of rows(ledger)) {
    if (j.businessId !== bizId || j.at >= end) continue
    for (const l of j.lines) {
      const a = acc.get(l.account) ?? { d: 0, c: 0 }
      a.d += l.debit
      a.c += l.credit
      acc.set(l.account, a)
    }
  }
  const out = [...acc].map(([account, a]) => {
    const coa = coaOf(account)
    const bal = coa.normal === 'D' ? a.d - a.c : a.c - a.d
    return { account, code: coa.code, debit: a.d, credit: a.c, balance: bal }
  }).sort((a, b) => a.code.localeCompare(b.code) || a.account.localeCompare(b.account))
  const debit = out.reduce((x, r) => x + r.debit, 0)
  const credit = out.reduce((x, r) => x + r.credit, 0)
  return { rows: out, debit, credit, balanced: debit === credit }
})
export const trialBalance = (s: WorldState, bizId: string, period: string): { rows: TbRow[]; debit: number; credit: number; balanced: boolean } => tbSel(s, `${bizId}|${period}`)

export interface PnlMonth { month: string; revenue: number; cogs: number; gross: number; expenses: number; net: number; partial: boolean }
const pnlOf = (ledger: LedgerEntry[], from: number, to: number): Omit<PnlMonth, 'month' | 'partial'> => {
  let revenue = 0
  let cogs = 0
  let expenses = 0
  for (const j of ledger) {
    if (j.at < from || j.at >= to || j.memo.id === 'Saldo awal') continue
    for (const l of j.lines) {
      const g = coaOf(l.account).group
      if (g === 'pendapatan') revenue += l.credit - l.debit
      else if (l.account === 'HPP') cogs += l.debit - l.credit
      else if (g === 'beban') expenses += l.debit - l.credit
    }
  }
  return { revenue, cogs, gross: revenue - cogs, expenses, net: revenue - cogs - expenses }
}
/** P&L of the last three months (Sep, Oct, Nov so far) from the journal */
export const pnlMonthly = createParamSelector((s) => [s.ledger, s.day], (bizId: string, ledger, day): PnlMonth[] => {
  const mine = rows(ledger).filter((j) => j.businessId === bizId)
  return [-2, -1, 0].map((k) => {
    const month = monthOf(day, k)
    return { month, ...pnlOf(mine, monthStart({ day }, month), monthEnd({ day }, month)), partial: k === 0 }
  })
})

/** balance sheet at minute `at`: Aset = Kewajiban + Modal (incl. the running profit) */
export function balanceSheet(s: WorldState, bizId: string, at: number): { assets: { account: string; amount: number }[]; liabilities: { account: string; amount: number }[]; equity: { account: string; amount: number }[]; totalAssets: number; totalLiabEquity: number; balanced: boolean } {
  const acc = new Map<string, number>()
  let profit = 0
  for (const j of rows(s.ledger)) {
    if (j.businessId !== bizId || j.at > at) continue
    for (const l of j.lines) {
      const c = coaOf(l.account)
      if (c.group === 'pendapatan') profit += l.credit - l.debit
      else if (c.group === 'beban') profit -= l.debit - l.credit
      else acc.set(l.account, (acc.get(l.account) ?? 0) + (c.normal === 'D' ? l.debit - l.credit : l.credit - l.debit))
    }
  }
  const pick = (g: string) => [...acc].filter(([a]) => coaOf(a).group === g).map(([account, amount]) => ({ account, amount: coaOf(account).normal === 'D' && g === 'modal' ? -amount : amount })).sort((a, b) => coaOf(a.account).code.localeCompare(coaOf(b.account).code))
  const assets = pick('aset')
  const liabilities = pick('kewajiban')
  const equity = [...pick('modal'), { account: 'Laba berjalan', amount: profit }]
  const totalAssets = assets.reduce((a, x) => a + x.amount, 0)
  const totalLiabEquity = liabilities.reduce((a, x) => a + x.amount, 0) + equity.reduce((a, x) => a + x.amount, 0)
  return { assets, liabilities, equity, totalAssets, totalLiabEquity, balanced: totalAssets === totalLiabEquity }
}

/** cash flow of a month (Kas + Bank): opening, in, out, closing */
export function cashFlow(s: WorldState, bizId: string, month: string): { opening: number; inflow: number; outflow: number; closing: number } {
  const from = monthStart(s, month)
  const to = monthEnd(s, month)
  let opening = 0
  let inflow = 0
  let outflow = 0
  for (const j of rows(s.ledger)) {
    if (j.businessId !== bizId || j.at >= to) continue
    for (const l of j.lines) {
      if (l.account !== 'Kas' && l.account !== 'Bank') continue
      if (j.at < from) opening += l.debit - l.credit
      else {
        inflow += l.debit
        outflow += l.credit
      }
    }
  }
  return { opening, inflow, outflow, closing: opening + inflow - outflow }
}

/* ------------------------------------------------------------------ tax calendar */

export interface TaxEvent { id: string; at: number; kind: 'setor' | 'lapor' | 'spt'; taxItemId: string | null; label: Bi; tone: 'warn' | 'done' | 'neutral'; status: TaxItem['status'] | null }
/** deadlines of the shop's taxes (rules: setor the 15th of the next month, SPT Masa PPh 21 the 20th, SPT Tahunan OP 31 March) */
export function taxCalendar(s: WorldState, bizId: string, now: number): TaxEvent[] {
  const out: TaxEvent[] = []
  for (const t of rows(s.taxItems)) {
    if (t.businessId !== bizId || (t.kind !== 'pph-final-umkm' && t.kind !== 'pph21')) continue
    const next = monthOf(`${t.period}-15`, 1)
    const setor = minuteOfIso(s, `${next}-15`)
    const done = t.status === 'dibayar' || t.status === 'dilaporkan'
    const name: Bi = t.kind === 'pph21' ? { id: 'PPh 21', en: 'PPh 21' } : { id: 'PPh Final', en: 'Final tax' }
    out.push({ id: `${t.id}:setor`, at: setor, kind: 'setor', taxItemId: t.id, label: { id: `Setor ${name.id} ${t.period}`, en: `Pay ${name.en} ${t.period}` }, tone: done ? 'done' : setor - now < 3 * DAY_MIN ? 'warn' : 'neutral', status: t.status })
    if (t.kind === 'pph21') {
      const lapor = minuteOfIso(s, `${next}-20`)
      out.push({ id: `${t.id}:lapor`, at: lapor, kind: 'lapor', taxItemId: t.id, label: { id: `Lapor SPT Masa PPh 21 ${t.period}`, en: `File PPh 21 return ${t.period}` }, tone: done ? 'done' : 'neutral', status: t.status })
    }
  }
  const y = Number(s.day.slice(0, 4)) + 1
  out.push({ id: `spt-${y - 1}`, at: minuteOfIso(s, `${y}-03-31`), kind: 'spt', taxItemId: null, label: { id: `SPT Tahunan orang pribadi ${y - 1}`, en: `Individual annual return ${y - 1}` }, tone: 'neutral', status: null })
  return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

/* ------------------------------------------------------------------ bank statement (40 rows, 1–16 Nov) */

export interface MutasiRowW { id: string; date: string; at: number; desc: string; amount: number; balance: number; status: 'cocok' | 'baru' | 'tinjau'; ledgerId: string | null; lines: LedgerLine[] | null }
/**
 * The bank statement Pajak Beres imports: EXACTLY 40 rows from the 1st to the 16th: daily settlements of the bank share
 * of sales ("cocok": already in the journal), supplier payments, utilities, admin fee, interest, owner's drawings, fuel
 * ("baru": the import posts their journal) and the 3 rows that need review (= the 3 journal rows with needsReview).
 */
const mutasiSel = createParamSelector((s) => [s.ledger, s.suppliers, s.seed, s.regionId, s.day], (key: string, ledger, suppliers, seed, regionId, day): MutasiRowW[] => {
  const [bizId, period] = key.split('|') as [string, string]
  const r = makeRng(hashString(`${seed}|${regionId}|mutasi|${period}`))
  const from = monthStart({ day }, period)
  const mine = rows(ledger).filter((j) => j.businessId === bizId)
  const out: Omit<MutasiRowW, 'balance' | 'id'>[] = []
  const iso = (at: number) => isoDay(day, Math.floor(at / DAY_MIN))
  // settlements: the Bank line of each daily sales entry 1–16
  for (const j of mine.filter((x) => x.source === 'sale' && !x.refId && x.at >= from && x.at < from + 15 * DAY_MIN).sort((a, b) => a.at - b.at)) {
    const bank = j.lines.find((l) => l.account === 'Bank')?.debit ?? 0
    if (bank > 0) out.push({ date: iso(j.at + DAY_MIN), at: j.at + DAY_MIN - 13 * 60, desc: `SETTLEMENT QRIS/TRF ${iso(j.at).slice(5).replace('-', '/')}`, amount: bank, status: 'cocok', ledgerId: j.id, lines: null })
  }
  // the 3 review rows (same memo and amount as the journal)
  // (a reviewed row stays on the statement, now 'cocok', so the statement never changes after a review)
  for (const j of mine.filter((x) => (x.needsReview || x.reviewed) && x.source === 'bank' && x.at >= from && x.at < from + 16 * DAY_MIN)) {
    const bank = j.lines.find((l) => l.account === 'Bank')
    const amount = bank ? bank.debit - bank.credit : -(j.lines.find((l) => l.credit > 0)?.credit ?? 0)
    out.push({ date: iso(j.at), at: j.at, desc: j.memo.id.toUpperCase(), amount, status: j.reviewed ? 'cocok' : 'tinjau', ledgerId: j.id, lines: j.lines })
  }
  const sup = rows(suppliers)
  const fill: [string, string, number, number][] = [
    ['BIAYA ADMIN BULANAN', 'Beban Admin Bank', -15_000, 1], ['BUNGA TABUNGAN', 'Pendapatan Bunga', 0, 2], ['PLN TAGIHAN LISTRIK', 'Beban Listrik & Air', -r.int(9, 14) * 100_000, 3],
    ['PDAM TAGIHAN AIR', 'Beban Listrik & Air', -r.int(2, 5) * 100_000, 4], ['TARIK TUNAI PRIBADI', 'Prive', -2_000_000, 6], ['TRF PRIBADI KE REK. KELUARGA', 'Prive', -1_500_000, 11],
    ['SPBU SOLAR ARMADA', 'Beban Bahan Bakar', -r.int(4, 7) * 50_000, 2], ['SPBU SOLAR ARMADA ', 'Beban Bahan Bakar', -r.int(4, 7) * 50_000, 8], ['SPBU PERTALITE PIKAP', 'Beban Bahan Bakar', -r.int(3, 5) * 50_000, 12],
    ['SPBU SOLAR ARMADA  ', 'Beban Bahan Bakar', -r.int(4, 7) * 50_000, 15],
  ]
  for (const [desc, account, amt, d] of fill) {
    const amount = account === 'Pendapatan Bunga' ? r.int(28, 61) * 1000 : amt
    const lines: LedgerLine[] = amount > 0 ? [{ account: 'Bank', debit: amount, credit: 0 }, { account, debit: 0, credit: amount }] : [{ account, debit: -amount, credit: 0 }, { account: 'Bank', debit: 0, credit: -amount }]
    out.push({ date: iso(from + (d - 1) * DAY_MIN), at: from + (d - 1) * DAY_MIN + r.int(8 * 60, 16 * 60), desc: desc.trim(), amount, status: 'baru', ledgerId: null, lines })
  }
  // supplier payments fill up to 40 rows (Utang Usaha D / Bank C)
  let k = 0
  while (out.length < 40 && sup.length) {
    const sp = sup[(k * 5 + 3) % sup.length]!
    const amount = -Math.round(r.float(1.5, 9) * 1_000_000 / 1000) * 1000
    const d = 1 + ((k * 3 + 1) % 16)
    out.push({ date: iso(from + (d - 1) * DAY_MIN), at: from + (d - 1) * DAY_MIN + r.int(9 * 60, 15 * 60), desc: `TRF KE ${sp.name.toUpperCase()}`, amount, status: 'baru', ledgerId: null, lines: [{ account: 'Utang Usaha', debit: -amount, credit: 0 }, { account: 'Bank', debit: 0, credit: -amount }] })
    k++
  }
  const sorted = out.slice(0, 40).sort((a, b) => a.at - b.at || a.desc.localeCompare(b.desc))
  // opening balance = the journal's Bank balance before the month
  let bal = 0
  for (const j of mine) if (j.at < from) for (const l of j.lines) if (l.account === 'Bank') bal += l.debit - l.credit
  return sorted.map((x, i) => {
    bal += x.amount
    return { ...x, id: `MT-${period}-${String(i + 1).padStart(2, '0')}`, balance: bal }
  })
})
export const mutasiRows = (s: WorldState, bizId: string, period: string): MutasiRowW[] => mutasiSel(s, `${bizId}|${period}`)
