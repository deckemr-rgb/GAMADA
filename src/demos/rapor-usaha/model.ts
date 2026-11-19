/**
 * demos/rapor-usaha/model.ts — shared helpers of the Rapor Usaha sandbox (always loaded, kept small): money text,
 * memoised world selectors (one source per number: raporOf / loanOffer / scoreActions / dataFeed), the ?focus=
 * router, a tiny UI store the lazy chunks share (open drawers, flashes) and the link helper for other demos.
 * All scores, limits, rates and instalments are SIMULATED ("simulasi").
 */
import { useSyncExternalStore } from 'react'
import { getSession, type ScoreFactor, type WorldState } from '../../demo-kit/world'
import { LENDERS, loanOffer, raporOf, scoreActions, dataFeed, type LoanOffer, type Rapor, type ScoreAction } from '../../demo-kit/world/pasar-daerah'

export const SLUG = 'rapor-usaha'
export type Lang = 'id' | 'en'
export type OwnerTab = 'rapor' | 'modal' | 'berbagi'
export type BankTab = 'antrian' | 'riwayat'
export const OWNER_TABS: readonly OwnerTab[] = ['rapor', 'modal', 'berbagi']
export const BANK_TABS: readonly BankTab[] = ['antrian', 'riwayat']
export const LENDER: string = LENDERS[0]
export const FACTORS: readonly ScoreFactor[] = ['omzet', 'margin', 'pajak', 'supplier', 'kyb', 'pertumbuhan']

const loc = (lang: Lang) => (lang === 'id' ? 'id-ID' : 'en-GB')
/** "Rp 13.775.000" */
export const rp = (n: number, lang: Lang): string => `Rp ${Math.round(n).toLocaleString(loc(lang))}`
/** "Rp 150 jt" / "Rp 150 M" */
export const jt = (n: number, lang: Lang): string => `Rp ${(n / 1e6).toLocaleString(loc(lang), { maximumFractionDigits: 1 })} ${lang === 'id' ? 'jt' : 'M'}`
export const pctText = (v: number, lang: Lang, digits = 0): string => `${(v * 100).toLocaleString(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
export const rateText = (r: number, lang: Lang): string => `${r.toLocaleString(loc(lang), { maximumFractionDigits: 2 })}%`
/** world minutes → "07.03" (ID) / "07:03" (EN); negative = days before today */
export function timeText(at: number, lang: Lang): string {
  const d = Math.floor(at / 1440)
  const m = at - d * 1440
  const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(m % 60).padStart(2, '0')}`
  if (d === 0) return hm
  if (d === -1) return lang === 'id' ? `kemarin ${hm}` : `yesterday ${hm}`
  return lang === 'id' ? `${-d} hari lalu` : `${-d} days ago`
}
const MONTHS = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
/** 'YYYY-MM' → "Okt" / "Oct" */
export const monthShort = (ym: string, lang: Lang): string => MONTHS[lang][Number(ym.slice(5, 7)) - 1] ?? ym

/* ------------------------------------------------------------------ memoised selectors (per world state) */

function memo<T>(fn: (s: WorldState, id: string) => T): (s: WorldState, id: string) => T {
  let ls: WorldState | null = null
  const cache = new Map<string, T>()
  return (s, id) => {
    if (s !== ls) {
      ls = s
      cache.clear()
    }
    if (!cache.has(id)) cache.set(id, fn(s, id))
    return cache.get(id)!
  }
}
export const raporM: (s: WorldState, id: string) => Rapor | null = memo(raporOf)
export const actionsM: (s: WorldState, id: string) => ScoreAction[] = memo(scoreActions)
export const offerM: (s: WorldState, id: string) => LoanOffer = memo((s, id) => loanOffer(s, id, 0))
export const feedM: (s: WorldState, id: string) => ReturnType<typeof dataFeed> = memo((s, id) => dataFeed(s, id, 1e9))
export const shopOf = (s: WorldState): string => s.meta.shopId
/** the shop's newest application to the partner cooperative */
export function ownLoan(s: WorldState) {
  const shop = s.meta.shopId
  let best = null as WorldState['loanApps']['byId'][string] | null
  for (const id of s.loanApps.ids) {
    const l = s.loanApps.byId[id]!
    if (l.businessId === shop && l.lender === LENDER && (!best || l.at > best.at || (l.at === best.at && l.id > best.id))) best = l
  }
  return best
}
/** the disbursal journal of a loan (C38), if posted */
export function disbursalOf(s: WorldState, loanId: string) {
  for (const id of s.ledger.ids) {
    const j = s.ledger.byId[id]!
    if (j.source === 'pinjaman' && j.refId === loanId) return j
  }
  return null
}

/* ------------------------------------------------------------------ links to other demos */

/** an in-site demo link that keeps the visitor's region / language (+ ?controls=all before DEMO_READY) */
export function withSession(href: string): string {
  const s = getSession()
  const u = new URL(href, 'http://x')
  if (!u.searchParams.has('region')) u.searchParams.set('region', s.regionId)
  u.searchParams.set('lang', s.lang)
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all') u.searchParams.set('controls', 'all')
  return u.pathname + u.search
}

/* ------------------------------------------------------------------ UI store shared by the lazy chunks */

export interface Ui {
  /** factor drawer */
  factor: ScoreFactor | null
  /** review drawer (true = open, string = open + flash that journal row) */
  review: boolean | string
  /** bank detail drawer: loan id */
  loan: string | null
  /** row to flash once it renders (consent / loan / factor id) */
  flash: string | null
  /** bank queue segment */
  seg: 'menunggu' | 'diputus'
  /** Tanya skor / Ringkas drawer */
  ask: boolean
}
let ui: Ui = { factor: null, review: false, loan: null, flash: null, seg: 'menunggu', ask: false }
const subs = new Set<() => void>()
export const uiStore = {
  get: (): Ui => ui,
  set(patch: Partial<Ui>): void {
    ui = { ...ui, ...patch }
    subs.forEach((f) => f())
  },
  sub(f: () => void): () => void {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}
export function useUi<T>(sel: (u: Ui) => T): T {
  return useSyncExternalStore(uiStore.sub, () => sel(ui), () => sel(ui))
}

/* ------------------------------------------------------------------ ?focus= router */

export type Route =
  | { role: 'pemilik-toko'; tab: OwnerTab; open?: Partial<Ui> }
  | { role: 'bank-mitra'; tab: BankTab; open?: Partial<Ui> }

const bare = (x: string) => (x.includes(':') ? x.slice(x.indexOf(':') + 1) : x)
/** where an id lands (null = unknown ⇒ default tab + toast) */
export function route(s: WorldState, raw: string, role: string): Route | null {
  const id = bare(raw)
  const shop = s.meta.shopId
  if ((FACTORS as readonly string[]).includes(id)) return { role: 'pemilik-toko', tab: 'rapor', open: { factor: id as ScoreFactor, flash: id } }
  if (id === shop) return { role: 'pemilik-toko', tab: 'rapor' }
  const loanBank = (loanId: string, decided: boolean): Route => ({ role: 'bank-mitra', tab: 'antrian', open: { loan: loanId, seg: decided ? 'diputus' : 'menunggu', flash: loanId } })
  if (s.businesses.byId[id]) {
    const loans = s.loanApps.ids.map((k) => s.loanApps.byId[k]!).filter((l) => l.businessId === id && l.lender === LENDER)
    const l = loans.find((x) => x.status === 'diajukan') ?? loans.sort((a, b) => b.at - a.at)[0]
    return l ? loanBank(l.id, l.status !== 'diajukan') : { role: 'bank-mitra', tab: 'antrian' }
  }
  const loan = s.loanApps.byId[id]
  if (loan) {
    if (loan.businessId === shop && role !== 'bank-mitra') return { role: 'pemilik-toko', tab: 'modal', open: { flash: id } }
    return loanBank(id, loan.status !== 'diajukan')
  }
  const c = s.consents.byId[id]
  if (c) {
    if (c.businessId === shop) return { role: 'pemilik-toko', tab: 'berbagi', open: { flash: id } }
    const l = s.loanApps.ids.map((k) => s.loanApps.byId[k]!).find((x) => x.consentId === id)
    return l ? loanBank(l.id, l.status !== 'diajukan') : { role: 'bank-mitra', tab: 'riwayat', open: { flash: id } }
  }
  const j = s.ledger.byId[id]
  if (j && j.businessId === shop) {
    if (j.source === 'pinjaman' && j.refId) return { role: 'pemilik-toko', tab: 'modal', open: { flash: j.refId } }
    if (j.needsReview || j.reviewed) return { role: 'pemilik-toko', tab: 'rapor', open: { review: id } }
    return { role: 'pemilik-toko', tab: 'rapor', open: { factor: 'pajak', flash: 'pajak' } }
  }
  const tx = s.taxItems.byId[id]
  if (tx && tx.businessId === shop) return { role: 'pemilik-toko', tab: 'rapor', open: { factor: 'pajak', flash: 'pajak' } }
  return null
}

/** run `fn` after the next paint: the pressed control answers in this frame, the heavy work follows (INP) */
export const afterPaint = (fn: () => void): void => {
  requestAnimationFrame(() => setTimeout(fn, 0))
}
