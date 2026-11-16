/**
 * demos/registry.ts — slug → lazy sandbox canvas (src/demos/<slug>/index.tsx, default export).
 *
 * Tahap 1: every slug maps to src/demos/_placeholder (an honest "being built" panel). When a product lands in
 * tahap 2–4, replace its line with `() => import('./<slug>')` — nothing else changes: /demo/:slug, the tour
 * ("Ambil alih") and /lab all read this map.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { EcoOrInti, ProductSlug } from '../content/products'

/** Props every demo canvas receives from /demo/:slug (the shell supplies world, session, clock …). */
export interface DemoCanvasProps {
  product: ProductSlug
}

export type DemoModule = { default: ComponentType<DemoCanvasProps> }
type DemoLoader = () => Promise<DemoModule>

const placeholder: DemoLoader = () => import('./_placeholder')

export const DEMOS: Record<ProductSlug, DemoLoader> = {
  inti: placeholder,
  'sapa-warga': placeholder,
  'meja-pimpinan': placeholder,
  'naskah-pintar': placeholder,
  'radar-isu': placeholder,
  'siaga-wilayah': placeholder,
  'awas-belanja': placeholder,
  'cek-berkas': placeholder,
  'toko-autopilot': placeholder,
  'pajak-beres': placeholder,
  'juara-jualan': placeholder,
  'kenal-mitra': placeholder,
  'pantau-merek': placeholder,
  tenderpilot: placeholder,
  'katalog-lokal': placeholder,
  'rapor-usaha': placeholder,
  'indeks-ekonomi': placeholder,
  'sinyal-pasar': placeholder,
}

/** Build stage in which each ecosystem's full demos arrive (spec §16): honest status on /produk, /lab, /demo. */
export const DEMO_STAGE: Record<EcoOrInti, 2 | 3 | 4> = {
  'satu-daerah': 2,
  'usaha-pintar': 3,
  'pasar-daerah': 4,
  inti: 4,
}

/** true once a product's real sandbox is registered (flip per product when its line above changes). */
export const DEMO_READY: Partial<Record<ProductSlug, true>> = {}

const cache = new Map<ProductSlug, LazyExoticComponent<ComponentType<DemoCanvasProps>>>()

/** Stable React.lazy component per slug (render inside <Suspense>). */
export function demoComponent(slug: ProductSlug): LazyExoticComponent<ComponentType<DemoCanvasProps>> {
  let c = cache.get(slug)
  if (!c) {
    c = lazy(DEMOS[slug])
    cache.set(slug, c)
  }
  return c
}

/** Start downloading a sandbox chunk (hover / focus on a "Coba demo" link); never rejects. */
export function preloadDemo(slug: ProductSlug): void {
  DEMOS[slug]().catch(() => undefined)
}
