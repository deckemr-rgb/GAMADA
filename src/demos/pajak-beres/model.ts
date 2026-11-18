/**
 * demos/pajak-beres/model.ts — product model shared by the tabs: the document inbox (supplier notas from the world's
 * purchase orders, one altered receipt, the November bank statement), the journal postings they produce, the tax
 * items of the period and THE tax amount of an item (computed amount, else the live estimate) that Kalender, Ekspor,
 * Tanya Pajak and the KPI strip all show.
 */
import type { EventMap, LedgerEntry, PurchaseOrder, TaxItem, WorldState } from '../../demo-kit/world'
import type { RoleId } from '../../content/products'
import { DAY_MIN, hhmm, isoDay, monthOf, rows } from '../../demo-kit/world'
import { notaLines, pendingNotas, pphFinalOf } from '../../demo-kit/world/usaha-pintar'
import type { NotaInput } from '../../demo-kit/docs/samples/finance'
import { pph21Rows, pph21Total } from './pph21'

export const SLUG = 'pajak-beres' as const
export type RoleKey = 'owner' | 'konsultan'
export const roleKeyOf = (role: RoleId): RoleKey => (role === 'konsultan-pajak' ? 'konsultan' : 'owner')
export type TabId = 'dokumen' | 'jurnal' | 'laporan' | 'kalender' | 'pph21' | 'ekspor'
export const TAB_IDS: readonly TabId[] = ['dokumen', 'jurnal', 'laporan', 'kalender', 'pph21', 'ekspor']
export const isTab = (v: string | null): v is TabId => !!v && (TAB_IDS as readonly string[]).includes(v)

export type Lang = 'id' | 'en'
export const periodOf = (s: WorldState): string => monthOf(s.day, 0)
export const prevPeriodOf = (s: WorldState): string => monthOf(s.day, -1)
export const isoOf = (s: WorldState, at: number): string => isoDay(s.day, Math.floor(at / DAY_MIN))

/** "Rp 1.250.000" / "Rp 1,250,000" */
export const rp = (n: number, lang: Lang): string => `${n < 0 ? '−' : ''}Rp ${Math.abs(Math.round(n)).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}`
/** "Rp 1,2 jt" / "Rp 1.2m" */
export const rpShort = (n: number, lang: Lang): string => {
  const a = Math.abs(n)
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const sign = n < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toLocaleString(loc, { maximumFractionDigits: 2 })} ${lang === 'id' ? 'M' : 'bn'}`
  if (a >= 1e6) return `${sign}Rp ${(a / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })} ${lang === 'id' ? 'jt' : 'm'}`
  return rp(n, lang)
}
const MONTHS: Record<Lang, string[]> = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
export const monthName = (period: string, lang: Lang, short = false): string => {
  const n = MONTHS[lang][Number(period.slice(5, 7)) - 1] ?? period
  return short ? n.slice(0, 3) : n
}
export const dateText = (iso: string, lang: Lang): string => `${Number(iso.slice(8, 10))} ${monthName(iso.slice(0, 7), lang, true)} ${iso.slice(0, 4)}`

/* ------------------------------------------------------------------ tax items */

export const taxItemOf = (s: WorldState, kind: TaxItem['kind'], period: string): TaxItem | undefined =>
  rows(s.taxItems).find((t) => t.businessId === s.meta.shopId && t.kind === kind && t.period === period)

/** THE amount of a tax item: the computed one (tax.computed), else the live estimate from the world */
export function taxAmountOf(s: WorldState, item: TaxItem): { amount: number; computed: boolean } {
  if (item.amount != null) return { amount: item.amount, computed: true }
  if (item.kind === 'pph21') return { amount: pph21Total(pph21Rows(s)), computed: false }
  if (item.kind === 'pph-final-umkm') return { amount: pphFinalOf(s, item.businessId, item.period).amount, computed: false }
  return { amount: 0, computed: false }
}

/* ------------------------------------------------------------------ the document inbox */

export interface InboxDoc {
  id: string
  kind: 'nota' | 'edit' | 'mutasi'
  po: PurchaseOrder | null
  supplier: string
  at: number
  isNew: boolean
  booked: boolean
}

let memoKey: unknown[] = []
let memoVal: InboxDoc[] = []
/** notas to process (pendingNotas, minus any the kit's cold-start fallback already booked), the altered receipt, the
 *  bank statement, then what is already booked (newest first) */
export function inboxDocs(s: WorldState): InboxDoc[] {
  const key = [s.purchaseOrders, s.ledger, s.suppliers, s.bankImports, s.meta.shopId]
  if (key.every((k, i) => k === memoKey[i])) return memoVal
  const shop = s.meta.shopId
  const booked = new Set<string>()
  for (const j of rows(s.ledger)) if (j.businessId === shop && j.source === 'nota' && j.refId) booked.add(j.refId)
  const out: InboxDoc[] = []
  for (const n of pendingNotas(s, shop)) out.push({ id: n.po.id, kind: 'nota', po: n.po, supplier: n.supplierName, at: n.at, isNew: n.isNew, booked: booked.has(n.po.id) })
  const ed = editedSpec(s)
  if (ed) out.push({ id: EDIT_DOC_ID, kind: 'edit', po: null, supplier: ed.merchant, at: -DAY_MIN + 15 * 60 + 40, isNew: false, booked: booked.has(EDIT_DOC_ID) })
  const imported = rows(s.bankImports).some((b) => b.businessId === shop && b.period === periodOf(s))
  out.push({ id: MUTASI_DOC_ID, kind: 'mutasi', po: null, supplier: '', at: -1, isNew: false, booked: imported })
  // booked supplier notas of the last week stay in the box as "dijurnal"
  for (const po of rows(s.purchaseOrders)) {
    if (po.businessId !== shop || !booked.has(po.id) || out.some((d) => d.id === po.id)) continue
    out.push({ id: po.id, kind: 'nota', po, supplier: s.suppliers.byId[po.supplierId]?.name ?? po.supplierId, at: po.notaAt ?? po.reply?.at ?? po.at, isNew: false, booked: true })
  }
  const rank = { nota: 0, edit: 1, mutasi: 2 } as const
  out.sort((a, b) => Number(a.booked) - Number(b.booked) || rank[a.kind] - rank[b.kind] || b.at - a.at)
  memoKey = key
  memoVal = out
  return out
}
export const EDIT_DOC_ID = 'pb-nota-edit'
export const MUTASI_DOC_ID = 'pb-mutasi'

/** the altered receipt: a small purchase from a supplier with no open PO, photographed from a chat, total overwritten */
export function editedSpec(s: WorldState): NotaInput | null {
  const sups = rows(s.suppliers)
  const sp = sups[sups.length - 1]
  if (!sp) return null
  const toko = rows(s.outlets).find((o) => o.businessId === s.meta.shopId && o.kind === 'toko')
  const prods = rows(s.products).filter((p) => p.outletId === toko?.id && p.supplierId === sp.id)
  const pick = (prods.length >= 2 ? prods : rows(s.products).filter((p) => p.outletId === toko?.id)).slice(0, 2)
  if (!pick.length) return null
  return {
    merchant: sp.name, address: sp.city, number: `NT-${sp.id.slice(3)}-${s.day.slice(2, 4)}${s.day.slice(5, 7)}`, date: isoDay(s.day, -1), time: '15:40', cashier: 'Admin',
    items: pick.map((p, i) => ({ name: p.name, qty: i ? 2 : 3, unit: p.unit, price: p.cost })),
  }
}

export function notaSpec(s: WorldState, po: PurchaseOrder, supplier: string): NotaInput {
  const sp = s.suppliers.byId[po.supplierId]
  const at = po.notaAt ?? po.reply?.at ?? po.at
  return {
    merchant: supplier, address: sp?.city ?? '', number: `INV/${po.code}`, date: isoOf(s, at), time: hhmm(at), cashier: 'Admin',
    items: po.items.map((it) => {
      const p = s.products.byId[it.productId]
      return { name: p?.name ?? it.productId, qty: it.qty, unit: p?.unit ?? 'pcs', price: it.cost }
    }),
    cash: po.total,
    journal: { debit: 'Persediaan', credit: 'Utang Usaha', amount: po.total, memo: { id: `Nota ${supplier} · ${po.code}`, en: `${supplier} invoice · ${po.code}` } },
  }
}

/** the journal row a processed document posts (nota: Persediaan D / Utang Usaha C = PO total; the altered receipt:
 *  the item sum, not the printed total, and it waits for review) */
export function notaPosting(s: WorldState, d: InboxDoc): EventMap['ledger.posted'] | null {
  if (d.kind === 'nota' && d.po) {
    return { businessId: s.meta.shopId, memo: { id: `Nota ${d.supplier} · ${d.po.code}`, en: `${d.supplier} invoice · ${d.po.code}` }, lines: notaLines(d.po, false), source: 'nota', refId: d.po.id, needsReview: false, confidence: 0.96 }
  }
  if (d.kind === 'edit') {
    const spec = editedSpec(s)
    if (!spec) return null
    const total = spec.items.reduce((a, i) => a + i.qty * i.price, 0)
    return {
      businessId: s.meta.shopId,
      memo: { id: `Nota ${spec.merchant} ${spec.number} · total di foto diubah`, en: `${spec.merchant} receipt ${spec.number} · total altered in the photo` },
      lines: [{ account: 'Persediaan', debit: total, credit: 0 }, { account: 'Kas', debit: 0, credit: total }],
      source: 'nota', refId: EDIT_DOC_ID, needsReview: true, confidence: 0.55,
    }
  }
  return null
}

/* ------------------------------------------------------------------ journal helpers */

/** the amount a journal row moves (Σ debit) */
export const entryAmount = (j: LedgerEntry): number => j.lines.reduce((a, l) => a + l.debit, 0)
export const isBalanced = (j: { lines: { debit: number; credit: number }[] }): boolean => j.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0
/** a period the consultant locked: no inline edit there */
export const lockedOf = (s: WorldState): readonly string[] => s.businesses.byId[s.meta.shopId]?.lockedPeriods ?? []

/** the latest tender matched to the shop (the TenderPilot banner) */
export function latestShopTender(s: WorldState) {
  const shop = s.meta.shopId
  return rows(s.tenders).filter((t) => t.matches[shop] != null).sort((a, b) => b.publishedAt - a.publishedAt || b.id.localeCompare(a.id))[0] ?? null
}

/** run `fn` after the next paint (a click paints its feedback first; the world update follows: INP) */
export function afterPaint(fn: () => void): void {
  requestAnimationFrame(() => window.setTimeout(fn, 0))
}

/** download a text file (CSV / XML / ICS) */
export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
