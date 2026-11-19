/**
 * demos/pd-loaders.ts — the Pasar Daerah + Inti sandbox loaders behind ONE import() of the registry (its own tiny
 * chunk), so the always-loaded registry does not carry five more chunk dependency lists.
 */
import type { DemoModule } from './registry'

export const PD_LOADERS: Record<'inti' | 'katalog-lokal' | 'rapor-usaha' | 'indeks-ekonomi' | 'sinyal-pasar', () => Promise<DemoModule>> = {
  inti: () => import('./inti'),
  'katalog-lokal': () => import('./katalog-lokal'),
  'rapor-usaha': () => import('./rapor-usaha'),
  'indeks-ekonomi': () => import('./indeks-ekonomi'),
  'sinyal-pasar': () => import('./sinyal-pasar'),
}
