/**
 * ecoNav.ts — the EAGER-SAFE ecosystem summary for the navbar dropdown, mobile menu, footer column and home
 * (Services cards, Stats). Tahap 6 plan §1.2, §2.5–2.7. Home JS budget: this file must stay ≤ 1 KB gzip and import
 * NOTHING at runtime (type-only imports are erased). Never import products.ts / tour.ts / demos/registry.ts here.
 * Values are literal copies; src/content/ecoNav.check.ts (run by tests/e2e/tahap6/contracts.spec.ts) fails when they
 * drift from products.ts, tour.ts or DEMO_READY. Owner of the values: B3 (step 0 wrote the first version).
 */
import type { Bi, EcoOrInti, ProductSlug } from './products'

export interface EcoNavItem {
  id: EcoOrInti
  /** full name, = ECOSYSTEMS[id].name */
  name: string
  /** name without "GAMADA " for tight spots (dropdown keeps `name`) */
  short: string
  to: string
  /** = ECOSYSTEMS[id].audience */
  audience: Bi
  /** dot colour: site token (= ECOSYSTEMS[id].accent) */
  accent: string
  /** products in the eco (inti: products sharing it = all 17) */
  count: number
  /** up to 3 example products for home Services chips (slug + brand name, = products.ts) */
  examples: readonly { slug: ProductSlug; name: string }[]
}

/** Order = spec order: Satu Daerah, Usaha Pintar, Pasar Daerah, GAMADA Inti. */
export const ECO_NAV: readonly EcoNavItem[] = [
  {
    id: 'satu-daerah',
    name: 'GAMADA Satu Daerah',
    short: 'Satu Daerah',
    to: '/ekosistem/satu-daerah',
    audience: { id: 'Untuk pemerintah daerah', en: 'For local governments' },
    accent: '--c-teal',
    count: 7,
    examples: [
      { slug: 'sapa-warga', name: 'Sapa Warga' },
      { slug: 'meja-pimpinan', name: 'Meja Pimpinan' },
      { slug: 'siaga-wilayah', name: 'Siaga Wilayah' },
    ],
  },
  {
    id: 'usaha-pintar',
    name: 'GAMADA Usaha Pintar',
    short: 'Usaha Pintar',
    to: '/ekosistem/usaha-pintar',
    audience: { id: 'Untuk bisnis', en: 'For businesses' },
    accent: '--c-peach',
    count: 6,
    examples: [
      { slug: 'toko-autopilot', name: 'Toko Autopilot' },
      { slug: 'pajak-beres', name: 'Pajak Beres' },
      { slug: 'juara-jualan', name: 'Juara Jualan' },
    ],
  },
  {
    id: 'pasar-daerah',
    name: 'GAMADA Pasar Daerah',
    short: 'Pasar Daerah',
    to: '/ekosistem/pasar-daerah',
    audience: { id: 'Jembatan pemda dan UMKM', en: 'The bridge between government and SMEs' },
    accent: '--c-plum',
    count: 4,
    examples: [
      { slug: 'katalog-lokal', name: 'Katalog Lokal' },
      { slug: 'rapor-usaha', name: 'Rapor Usaha' },
      { slug: 'sinyal-pasar', name: 'Sinyal Pasar' },
    ],
  },
  {
    id: 'inti',
    name: 'GAMADA Inti',
    short: 'Inti',
    to: '/ekosistem/inti',
    audience: { id: 'Fondasi semua produk', en: 'The foundation of every product' },
    accent: '--c-lavender-soft',
    count: 17,
    examples: [],
  },
]

/** Tour entry (dropdown after the separator, mobile group, footer). regionName = TOUR.regionName. */
export const TOUR_NAV = {
  to: '/tur',
  regionName: 'Bojonegoro',
  title: { id: 'Tur: Satu Hari di Bojonegoro', en: 'Tour: A Day in Bojonegoro' } satisfies Bi,
} as const

/** "Semua produk & demo" footer link of the dropdown / footer column. */
export const LAB_NAV = {
  to: '/lab',
  title: { id: 'Semua produk & demo', en: 'All products & demos' } satisfies Bi,
} as const

/** Home stats (computed elsewhere, mirrored here so home never imports the registry). */
export const SITE_COUNTS = {
  /** products without Inti = ECOSYSTEM_STATS.products */
  products: 17,
  /** = ECOSYSTEM_STATS.ecosystems */
  ecosystems: 3,
} as const

/** Interactive demos = number of DEMO_READY entries in src/demos/registry.ts (Inti included). */
export const DEMO_COUNT = 18
