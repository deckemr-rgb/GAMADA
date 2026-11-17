/**
 * productSlugs.ts — the bare slug list of the 18 registry entries (GAMADA Inti + 17 products), nothing else.
 * Kept apart from products.ts so the eager bundle (router.tsx: the /demo/:slug chrome handle) can validate a
 * slug without pulling the whole registry (names, taglines, roles, relations) into the home entry.
 * products.ts re-exports both names; its PRODUCTS array must list exactly these slugs (checked there by type).
 */
export const PRODUCT_SLUGS = [
  'inti',
  'sapa-warga',
  'meja-pimpinan',
  'naskah-pintar',
  'radar-isu',
  'siaga-wilayah',
  'awas-belanja',
  'cek-berkas',
  'toko-autopilot',
  'pajak-beres',
  'juara-jualan',
  'kenal-mitra',
  'pantau-merek',
  'tenderpilot',
  'katalog-lokal',
  'rapor-usaha',
  'indeks-ekonomi',
  'sinyal-pasar',
] as const

export type ProductSlug = (typeof PRODUCT_SLUGS)[number]

const SLUG_SET: ReadonlySet<string> = new Set(PRODUCT_SLUGS)

export const isProductSlug = (s: string | undefined): s is ProductSlug => !!s && SLUG_SET.has(s)
