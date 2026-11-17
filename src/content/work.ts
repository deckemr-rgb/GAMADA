/**
 * work.ts — registry of the 13 portfolio entries (/karya/:slug). Names are the product names
 * from the brief; every brand is fictional except the three real GAMADA projects (case studies).
 * Detailed content lives in content/demos/*.ts and content/cases/*.ts (later phases).
 */

import type { ProductSlug } from './products'

export type WorkKind = 'web' | 'apk' | 'case'

export interface WorkEntry {
  slug: string
  name: string
  kind: WorkKind
  /** folded into an ecosystem product (spec §2.1): /karya shows a "Kini bagian dari …" card linking to `to`.
   * `name` is the product's (untranslated) name, kept here so the footer can say so without pulling the product
   * registry into the home bundle; it must match products.ts. */
  merged?: { product: ProductSlug; name: string; to: string }
}

export const WORK: readonly WorkEntry[] = [
  { slug: 'kasirku', name: 'KasirKu', kind: 'web', merged: { product: 'toko-autopilot', name: 'Toko Autopilot', to: '/produk/toko-autopilot#kasir' } },
  { slug: 'smartcast', name: 'SmartCast', kind: 'web' },
  { slug: 'gokantin', name: 'GoKantin', kind: 'web' },
  { slug: 'kopi-senja', name: 'Kopi Senja', kind: 'web' },
  { slug: 'tiketin', name: 'Tiket.in', kind: 'web' },
  { slug: 'lensa', name: 'LENSA', kind: 'web' },
  { slug: 'jajanin', name: 'Jajan.in', kind: 'apk' },
  { slug: 'gymkuy', name: 'GymKuy', kind: 'apk' },
  { slug: 'fokusin', name: 'Fokusin', kind: 'apk' },
  { slug: 'racunin', name: 'Racunin', kind: 'apk' },
  { slug: 'phonefarm', name: 'PhoneFarm', kind: 'case' },
  { slug: 'sistem-automasi', name: 'Sistem Automasi', kind: 'case' },
  { slug: 'scrappulse', name: 'ScrapPulse', kind: 'case', merged: { product: 'radar-isu', name: 'Radar Isu', to: '/produk/radar-isu#analisis' } },
]

export const CASES = WORK.filter((w) => w.kind === 'case')

/** A Karya menu / heading title with its "{n}" filled from the registry (only the web and apk titles carry one, and
 * their menu `hash` is their kind): entries still listed on their own, merged ones now live in an ecosystem product,
 * so "5 Demo Web Live" can never disagree with the list under it. */
export function workMenuTitle(m: { hash: string; title: string }): string {
  return m.title.replace('{n}', () => String(WORK.filter((w) => w.kind === m.hash && !w.merged).length))
}

export function findWork(slug: string | undefined): WorkEntry | undefined {
  return WORK.find((w) => w.slug === slug)
}
