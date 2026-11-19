/**
 * Katalog Lokal — small helpers shared by the Pemda side and the lazy chunks: formatting, kecamatan names, the
 * example kecamatan of the pack, and the ?focus= router (need / order / match / tender / business ids).
 */
import type { WorldState } from '../../demo-kit/world'
import { catalogShortlist } from '../../demo-kit/world/pasar-daerah'

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
