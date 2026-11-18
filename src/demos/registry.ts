/**
 * demos/registry.ts — slug → lazy sandbox module (src/demos/<slug>/index.tsx).
 *
 * Product-module contract (tahap 2):
 *   export default function Canvas(props: DemoCanvasProps)   // the sandbox, rendered inside <DemoShell>
 *   export const missions: readonly Mission[]                 // optional: "Coba ini" guide (3–6)
 *   export const hotspot: DemoShellProps['hotspot']           // optional: the one element to ring first
 *   export const splitTabs: SplitStageProps                   // optional: split products (canvas is then ignored)
 * routes/Demo.tsx loads the module once and hands the named exports to DemoShell (useDemoModule below).
 *
 * A product is shown to visitors only once DEMO_READY[slug] is set (the integrator flips it); until then /demo/:slug
 * keeps the honest tahap-1 placeholder and the interim shell. `?controls=all` (dev server, or a build with
 * VITE_DEMO_CONTROLS=1) opens the real module with the full live shell before the flip.
 */
import { lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react'
import type { EcoOrInti, ProductSlug } from '../content/products'
import type { Mission } from '../demo-kit/shell/missions'
import type { DemoShellProps } from '../demo-kit/shell/DemoShell'
import type { SplitStageProps } from '../demo-kit/shell/SplitStage'

/** Props every demo canvas receives from /demo/:slug (the shell supplies world, session, clock …). */
export interface DemoCanvasProps {
  product: ProductSlug
}

export interface DemoModule {
  default: ComponentType<DemoCanvasProps>
  missions?: readonly Mission[]
  hotspot?: DemoShellProps['hotspot']
  splitTabs?: SplitStageProps
}
type DemoLoader = () => Promise<DemoModule>

const placeholder: DemoLoader = () => import('./_placeholder')

export const DEMOS: Record<ProductSlug, DemoLoader> = {
  inti: placeholder,
  'sapa-warga': () => import('./sapa-warga'),
  'meja-pimpinan': () => import('./meja-pimpinan'),
  'naskah-pintar': () => import('./naskah-pintar'),
  'radar-isu': () => import('./radar-isu'),
  'siaga-wilayah': () => import('./siaga-wilayah'),
  'awas-belanja': () => import('./awas-belanja'),
  'cek-berkas': () => import('./cek-berkas'),
  'toko-autopilot': () => import('./toko-autopilot'),
  'pajak-beres': () => import('./pajak-beres'),
  'juara-jualan': () => import('./juara-jualan'),
  'kenal-mitra': () => import('./kenal-mitra'),
  'pantau-merek': () => import('./pantau-merek'),
  tenderpilot: () => import('./tenderpilot'),
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
export const DEMO_READY: Partial<Record<ProductSlug, true>> = {
  // tahap 2 · Satu Daerah (integrated 2026-11-17)
  'sapa-warga': true,
  'meja-pimpinan': true,
  'naskah-pintar': true,
  'radar-isu': true,
  'siaga-wilayah': true,
  'awas-belanja': true,
  'cek-berkas': true,
}

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

/** The tahap-1 placeholder canvas (shown for every product that is not DEMO_READY). */
export const PlaceholderCanvas: LazyExoticComponent<ComponentType<DemoCanvasProps>> = lazy(placeholder)

/** Start downloading a sandbox chunk (hover / focus on a "Coba demo" link); never rejects. */
export function preloadDemo(slug: ProductSlug): void {
  ;(DEMO_READY[slug] ? DEMOS[slug] : placeholder)().catch(() => undefined)
}

const loaded = new Map<ProductSlug, DemoModule>()
/**
 * The product module's named exports (missions, hotspot, splitTabs) for DemoShell. null while loading or when
 * `slug` is null (placeholder). Shares the chunk with demoComponent (same import()).
 */
export function useDemoModule(slug: ProductSlug | null): DemoModule | null {
  const [state, setState] = useState<{ slug: ProductSlug; mod: DemoModule } | null>(() => {
    const m = slug ? loaded.get(slug) : undefined
    return slug && m ? { slug, mod: m } : null
  })
  useEffect(() => {
    if (!slug || loaded.has(slug)) {
      if (slug && loaded.has(slug)) setState((s) => (s?.slug === slug ? s : { slug, mod: loaded.get(slug)! }))
      return
    }
    let alive = true
    DEMOS[slug]().then(
      (m) => {
        loaded.set(slug, m)
        if (alive) setState({ slug, mod: m })
      },
      () => undefined, // the lazy canvas surfaces the error
    )
    return () => {
      alive = false
    }
  }, [slug])
  return slug && state?.slug === slug ? state.mod : null
}
