/**
 * Katalog Lokal — small helpers shared by the Pemda side and the lazy chunks: formatting, kecamatan names, the
 * example kecamatan of the pack, and the ?focus= router (need / order / match / tender / business ids).
 */
import type { Bi, WorldState } from '../../demo-kit/world'
import { catalogShortlist, splitSuggestion } from '../../demo-kit/world/pasar-daerah'

export const SLUG = 'katalog-lokal' as const

/** run `fn` after the next paint: the pressed control answers in this frame, the heavy work follows (INP) */
export const afterPaint = (fn: () => void): void => {
  requestAnimationFrame(() => setTimeout(fn, 0))
}
export type Side = 'pemda' | 'umkm'
export type Lang = 'id' | 'en'

export const nf = (lang: Lang, n: number, d = 0) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
export const rpShort = (n: number, lang: Lang) =>
  n >= 1e9 ? `Rp ${nf(lang, n / 1e9, 2)} ${lang === 'id' ? 'M' : 'bn'}` : n >= 1e6 ? `Rp ${nf(lang, n / 1e6, 1)} ${lang === 'id' ? 'jt' : 'm'}` : rp(n)
export const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const bizName = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id

/** the three example kecamatan: the pack's highest flood risk first (the flood example), then the two with most UMKM */
export function exampleKecs(s: WorldState): [string, string, string] {
  const ks = s.region.kecamatan
  const flood = [...ks].sort((a, b) => b.riskFlood - a.riskFlood || a.name.localeCompare(b.name))[0]
  const n = new Map<string, number>()
  for (const id of s.businesses.ids) {
    const k = s.businesses.byId[id]!.kecamatanId
    n.set(k, (n.get(k) ?? 0) + 1)
  }
  const pop = ks.filter((k) => k.id !== flood?.id).sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.name.localeCompare(b.name))
  return [flood?.name ?? '', pop[0]?.name ?? '', pop[1]?.name ?? '']
}

export interface FocusHit { side: Side; needId?: string | null; bizId?: string; orderId?: string }
/** where a ?focus= id lands (plan P14 "Focus arrivals"); null = unknown id */
export function resolveFocus(s: WorldState, id: string, role: string): FocusHit | null {
  if (s.catalogNeeds.byId[id]) return { side: 'pemda', needId: id }
  const o = s.orders.byId[id]
  if (o) return role === 'pemilik-toko' || !o.needId ? { side: 'umkm', bizId: o.businessId, orderId: id } : { side: 'pemda', needId: o.needId, orderId: id }
  const m = s.matches.byId[id]
  if (m) return { side: 'pemda', needId: m.needId, bizId: m.businessId }
  const t = s.tenders.byId[id]
  if (t) return t.needId && s.catalogNeeds.byId[t.needId] ? { side: 'pemda', needId: t.needId } : null
  if (s.businesses.byId[id]) {
    const needs = s.catalogNeeds.ids.map((x) => s.catalogNeeds.byId[x]!).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
    for (const n of needs) {
      const sl = catalogShortlist(s, n.id)
      if (sl.top.some((c) => c.business.id === id) || sl.waiting.some((c) => c.business.id === id)) return { side: 'pemda', needId: n.id, bizId: id }
    }
    return { side: 'umkm', bizId: id }
  }
  return null
}

/** scroll an element into view and flash it (focus arrivals, new rows) */
export function flashEl(el: Element | null, flash: (el: HTMLElement) => void) {
  if (!(el instanceof HTMLElement)) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  flash(el)
}

export interface SplitLine { bizId: string; category: string; name: Bi; qty: number; unit: string }
export interface SplitPlan { lines: SplitLine[]; missing: { category: string; name: Bi }[] }
/**
 * "Usulan bagi pesanan" over the WHOLE need list: the world's `splitSuggestion` splits the item the best card cannot
 * cover alone between two UMKM; every other item goes to a verified supplier in the shortlist (the split's two UMKM
 * first, then shortlist order; one with enough stock before one without). An item no verified local UMKM supplies is
 * listed in `missing`, so the suggestion never silently drops it. null = no split needed.
 */
export function splitPlan(s: WorldState, needId: string): SplitPlan | null {
  const n = s.catalogNeeds.byId[needId]
  const sp = splitSuggestion(s, needId)
  if (!n || sp.length !== 2) return null
  const top = catalogShortlist(s, needId).top
  const item = (cat: string) => n.items.find((i) => i.category === cat)
  const lines: SplitLine[] = sp.map((x) => ({ bizId: x.bizId, category: x.category, name: item(x.category)?.name ?? { id: x.category, en: x.category }, qty: x.qty, unit: item(x.category)?.unit ?? '' }))
  const missing: SplitPlan['missing'] = []
  const pref = (id: string) => { const i = sp.findIndex((x) => x.bizId === id); return i < 0 ? 2 : i }
  for (const it of n.items) {
    if (it.category === sp[0]!.category) continue
    const avail = (c: (typeof top)[number]) => c.offer.lines.find((l) => l.category === it.category)?.qtyAvailable ?? 0
    const sup = top
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.business.supplies.includes(it.category))
      .sort((a, b) => Number(avail(b.c) >= it.qty) - Number(avail(a.c) >= it.qty) || pref(a.c.business.id) - pref(b.c.business.id) || a.i - b.i)[0]
    if (!sup) missing.push({ category: it.category, name: it.name })
    else lines.push({ bizId: sup.c.business.id, category: it.category, name: it.name, qty: it.qty, unit: it.unit })
  }
  return { lines, missing }
}

/** the split lines grouped per UMKM, in first-appearance order ("A: karung 80, terpal 50 + B: karung 1.920") */
export function splitByBiz<T extends { bizId: string }>(lines: readonly T[]): { bizId: string; lines: T[] }[] {
  const out: { bizId: string; lines: T[] }[] = []
  for (const l of lines) {
    const g = out.find((x) => x.bizId === l.bizId)
    if (g) g.lines.push(l)
    else out.push({ bizId: l.bizId, lines: [l] })
  }
  return out
}
