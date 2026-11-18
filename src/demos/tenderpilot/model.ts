/**
 * demos/tenderpilot/model.ts — small helpers shared by the TenderPilot views: the shop id, deadline / countdown text,
 * the bid lines (unit prices × quantities = the ONE bid total used by the Surat, the price list, terbilang, the
 * bid.submitted payload and the audit row), links to other products (only when that demo can be opened).
 */
import { DEMO_READY } from '../registry'
import type { ProductSlug } from '../../content/products'
import { DAY_MIN, worldDate, type Tender, type WorldState } from '../../demo-kit/world'
import { EMERGENCY_TENDER, priceAdvice, procurementOfTender } from '../../demo-kit/world/usaha-pintar'

export const SLUG = 'tenderpilot' as const
export type Lang = 'id' | 'en'

export const isEmergency = (t: Tender | undefined) => !!t && t.key === EMERGENCY_TENDER.key
export const pctOf = (p: number | null | undefined) => (p == null ? null : Math.round(p * 100))

/** the open emergency tender matched to the shop (the banner), or null */
export function emergencyOf(s: WorldState): Tender | null {
  for (let i = s.tenders.ids.length - 1; i >= 0; i--) {
    const t = s.tenders.byId[s.tenders.ids[i]!]
    if (t && isEmergency(t) && t.status === 'dibuka' && t.matches[s.meta.shopId] !== undefined) return t
  }
  return null
}

/** the tender a ?focus id points at: a tender id, or a procurement id (→ its mirrored / created tender) */
export function tenderForFocus(s: WorldState, id: string): string | null {
  const bare = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id
  if (s.tenders.byId[bare]) return bare
  if (s.procurements.byId[bare]) for (const tid of s.tenders.ids) if (procurementOfTender(s, s.tenders.byId[tid]!) === bare) return tid
  return null
}

/* ------------------------------------------------------------------ time */

const DAYS: Record<Lang, string[]> = { id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }
const MON: Record<Lang, string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const pad = (n: number) => String(n).padStart(2, '0')
/** "Kamis 19 Nov 12.00" / "Thursday 19 Nov 12:00" (world time, WIB) */
export function deadlineText(day: string, at: number, lang: Lang): string {
  const d = new Date(Date.parse(`${day}T00:00:00Z`) + Math.floor(at / DAY_MIN) * 86_400_000)
  const m = ((at % DAY_MIN) + DAY_MIN) % DAY_MIN
  const hm = `${pad(Math.floor(m / 60))}${lang === 'id' ? '.' : ':'}${pad(m % 60)}`
  return `${DAYS[lang][d.getUTCDay()]} ${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]} ${hm}`
}
/** short date "19 Nov 2026" of a world minute */
export function dateText(day: string, at: number, lang: Lang): string {
  const d = new Date(Date.parse(`${day}T00:00:00Z`) + Math.floor(at / DAY_MIN) * 86_400_000)
  return `${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
/** ISO day (YYYY-MM-DD) of a world minute */
export function isoOf(day: string, at: number): string {
  return worldDate(day, at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
/** countdown "2 hari 4 jam" / "3 jam 12 mnt" */
export function countdown(min: number, lang: Lang): string {
  if (min <= 0) return lang === 'id' ? 'ditutup' : 'closed'
  const d = Math.floor(min / DAY_MIN)
  const h = Math.floor((min % DAY_MIN) / 60)
  const m = min % 60
  if (d > 0) return lang === 'id' ? `${d} hari ${h} jam` : `${d}d ${h}h`
  return lang === 'id' ? `${h} jam ${m} mnt` : `${h}h ${m}m`
}

/* ------------------------------------------------------------------ money */

export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
/** "Rp 37,8 jt" / "Rp 37.8M" */
export function rpShort(n: number, lang: Lang): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 2 })} ${lang === 'id' ? 'M' : 'bn'}`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })} ${lang === 'id' ? 'jt' : 'M'}`
  return rp(n)
}

/* ------------------------------------------------------------------ bid lines (ONE total) */

export interface BidLine { name: Tender['title']; qty: number; unit: string; hpsPrice: number; price: number; total: number }
/** unit prices scaled from the HPS to the target total (rounded to Rp 100), or the visitor's own unit prices */
export function bidLines(t: Tender, target: number, units: Readonly<Record<number, number>> = {}): BidLine[] {
  const hps = t.hps ?? t.value
  const items = t.items?.length ? t.items : [{ name: t.title, category: 'paket', qty: 1, unit: 'paket', hpsPrice: hps }]
  const ratio = hps > 0 ? target / hps : 1
  return items.map((it, i) => {
    const price = units[i] ?? Math.round((it.hpsPrice * ratio) / 100) * 100
    return { name: it.name, qty: it.qty, unit: it.unit, hpsPrice: it.hpsPrice, price, total: price * it.qty }
  })
}
export const bidTotal = (lines: readonly BidLine[]) => lines.reduce((a, l) => a + l.total, 0)

/** the bid of the visitor's draft: target = advised price × (1 + what-if), lines, the ONE total */
export function bidOf(s: WorldState, tenderId: string, d: { delta: number; units: Readonly<Record<number, number>> }) {
  const t = s.tenders.byId[tenderId]
  if (!t) return null
  const advice = priceAdvice(s, tenderId, s.meta.shopId)
  const target = advice ? Math.round(advice.suggested * (1 + d.delta)) : t.value
  const lines = bidLines(t, target, d.units)
  return { advice, target, lines, total: bidTotal(lines) }
}

/* ------------------------------------------------------------------ links */

/** a demo can be linked when it is READY (or on the dev / controls build with ?controls=all) */
const controlsAll = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all'
export function canLink(slug: ProductSlug): boolean {
  return !!DEMO_READY[slug] || controlsAll()
}
/** /demo/<slug>?focus=<id>[&extra] keeping ?controls=all on the dev build */
export function hrefTo(slug: ProductSlug, focus: string | null | undefined, extra = ''): string {
  const q = new URLSearchParams()
  if (focus) q.set('focus', focus)
  if (controlsAll()) q.set('controls', 'all')
  const tail = [q.toString(), extra].filter(Boolean).join('&')
  return `/demo/${slug}${tail ? `?${tail}` : ''}`
}
