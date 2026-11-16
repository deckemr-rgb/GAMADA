/**
 * products.ts — the proxy's copy of the product registry (slugs, brand names, roles).
 *
 * The proxy is its own package and is deployed alone (Docker, Vercel, Netlify, Workers), so it
 * cannot import `src/content/products.ts` from the site. This list MUST stay in sync with it;
 * `npm test` (test/selftest.ts) fails when the two drift apart (checked when the site repo is present).
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

export const ROLE_IDS = [
  'warga',
  'petugas',
  'kepala-daerah',
  'sekretariat',
  'humas',
  'bpbd',
  'pertanian',
  'ukpbj',
  'perizinan',
  'pemilik-toko',
  'kasir',
  'konsultan-pajak',
  'supervisor-sales',
  'agen-sales',
  'analis-kyc',
  'brand-manager',
  'vendor',
  'bank-mitra',
  'bappeda',
  'disperindag',
  'supplier',
] as const
export type RoleId = (typeof ROLE_IDS)[number]

/** Brand names are never translated (spec §3). */
export const PRODUCT_NAMES: Record<ProductSlug, string> = {
  inti: 'GAMADA Inti',
  'sapa-warga': 'Sapa Warga',
  'meja-pimpinan': 'Meja Pimpinan',
  'naskah-pintar': 'Naskah Pintar',
  'radar-isu': 'Radar Isu',
  'siaga-wilayah': 'Siaga Wilayah',
  'awas-belanja': 'Awas Belanja',
  'cek-berkas': 'Cek Berkas',
  'toko-autopilot': 'Toko Autopilot',
  'pajak-beres': 'Pajak Beres',
  'juara-jualan': 'Juara Jualan',
  'kenal-mitra': 'Kenal Mitra',
  'pantau-merek': 'Pantau Merek',
  tenderpilot: 'TenderPilot',
  'katalog-lokal': 'Katalog Lokal',
  'rapor-usaha': 'Rapor Usaha',
  'indeks-ekonomi': 'Indeks Ekonomi Daerah',
  'sinyal-pasar': 'Sinyal Pasar',
}

export const isProductSlug = (v: unknown): v is ProductSlug =>
  typeof v === 'string' && (PRODUCT_SLUGS as readonly string[]).includes(v)
