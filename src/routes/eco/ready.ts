/**
 * eco/ready.ts — the site pages' copy of DEMO_READY / DEMO_STAGE (src/demos/registry.ts).
 * registry.ts is pinned to the 43 KB `demo-core` chunk (vite.config.ts manualChunks), so importing it from
 * /ekosistem, /ekosistem/:eco or /lab would put the whole sandbox core into their first load (plan §5 budgets).
 * Same pattern as content/ecoNav.ts DEMO_COUNT: literal values here, and tests/e2e/tahap6/ekosistem.spec.ts fails
 * when they drift from the registry. Flip a product in BOTH places.
 */
import type { EcoOrInti, ProductSlug } from '../../content/products'

export const SITE_DEMO_READY: Partial<Record<ProductSlug, true>> = {
  'sapa-warga': true,
  'meja-pimpinan': true,
  'naskah-pintar': true,
  'radar-isu': true,
  'siaga-wilayah': true,
  'awas-belanja': true,
  'cek-berkas': true,
  'toko-autopilot': true,
  'pajak-beres': true,
  'juara-jualan': true,
  'kenal-mitra': true,
  'pantau-merek': true,
  tenderpilot: true,
  'katalog-lokal': true,
  'rapor-usaha': true,
  'indeks-ekonomi': true,
  'sinyal-pasar': true,
  inti: true,
}

export const SITE_DEMO_STAGE: Record<EcoOrInti, 2 | 3 | 4> = {
  'satu-daerah': 2,
  'usaha-pintar': 3,
  'pasar-daerah': 4,
  inti: 4,
}
