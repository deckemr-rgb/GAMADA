/**
 * minis.ts — slug → lazy mini-demo (src/demos/<slug>/mini.tsx) and lazy page copy (src/demos/<slug>/copy.ts).
 * Tahap 6 plan §1.2, §2.3, §5. Both are reached ONLY through these loaders (one chunk per slug, never static),
 * so one product's words or mini never ship with another page.
 *
 * Mini contract (mini.tsx):  export default function Mini(p: MiniProps)
 *   - `playing`: loop runs while true (consumer sets it from visibility / hover); false = hold the current frame.
 *   - `frame`: a named frame shown as a still (Momen unggulan); the mini then never animates.
 *   - `onCaption`: called with the caption of the frame on screen (consumer shows "Simulasi · {caption}").
 *   - Built from mini-kit (useMiniScript, MiniFrame) + the product's pure-props components / kit atoms.
 *     No world store, no clock, no AI, no MapLibre, no network, no import of the product's index.tsx. ≤ 15 KB gzip.
 * Copy contract (copy.ts):  export const copy: ProductCopy   (src/demos/copy-types.ts)
 *
 * Consumers: routes/Produk.tsx + routes/produk/** (B2), routes/Lab.tsx hover preview (B1). Use `loadMini` /
 * `loadCopy` (cached promises) or the hooks below; `preloadCopy` on intent (hover a card / star / nav item).
 */
import { useEffect, useState, type ComponentType } from 'react'
import type { Bi, ProductSlug } from '../content/products'
import type { CopyModule, ProductCopy } from './copy-types'

export type { ProductCopy, CopyCard, CopyModule } from './copy-types'

export interface MiniProps {
  /** loop runs while true; false pauses on the current frame */
  playing: boolean
  /** caption of the frame on screen (one per frame, from copy.miniCaption or the mini's own fixture) */
  onCaption?(c: Bi): void
  /** show this named frame as a still (never animates) */
  frame?: string
}

export interface MiniModule {
  default: ComponentType<MiniProps>
}
type MiniLoader = () => Promise<MiniModule>
type CopyLoader = () => Promise<CopyModule>

export const MINIS: Record<ProductSlug, MiniLoader> = {
  inti: () => import('./inti/mini'),
  'sapa-warga': () => import('./sapa-warga/mini'),
  'meja-pimpinan': () => import('./meja-pimpinan/mini'),
  'naskah-pintar': () => import('./naskah-pintar/mini'),
  'radar-isu': () => import('./radar-isu/mini'),
  'siaga-wilayah': () => import('./siaga-wilayah/mini'),
  'awas-belanja': () => import('./awas-belanja/mini'),
  'cek-berkas': () => import('./cek-berkas/mini'),
  'toko-autopilot': () => import('./toko-autopilot/mini'),
  'pajak-beres': () => import('./pajak-beres/mini'),
  'juara-jualan': () => import('./juara-jualan/mini'),
  'kenal-mitra': () => import('./kenal-mitra/mini'),
  'pantau-merek': () => import('./pantau-merek/mini'),
  tenderpilot: () => import('./tenderpilot/mini'),
  'katalog-lokal': () => import('./katalog-lokal/mini'),
  'rapor-usaha': () => import('./rapor-usaha/mini'),
  'indeks-ekonomi': () => import('./indeks-ekonomi/mini'),
  'sinyal-pasar': () => import('./sinyal-pasar/mini'),
}

export const COPIES: Record<ProductSlug, CopyLoader> = {
  inti: () => import('./inti/copy'),
  'sapa-warga': () => import('./sapa-warga/copy'),
  'meja-pimpinan': () => import('./meja-pimpinan/copy'),
  'naskah-pintar': () => import('./naskah-pintar/copy'),
  'radar-isu': () => import('./radar-isu/copy'),
  'siaga-wilayah': () => import('./siaga-wilayah/copy'),
  'awas-belanja': () => import('./awas-belanja/copy'),
  'cek-berkas': () => import('./cek-berkas/copy'),
  'toko-autopilot': () => import('./toko-autopilot/copy'),
  'pajak-beres': () => import('./pajak-beres/copy'),
  'juara-jualan': () => import('./juara-jualan/copy'),
  'kenal-mitra': () => import('./kenal-mitra/copy'),
  'pantau-merek': () => import('./pantau-merek/copy'),
  tenderpilot: () => import('./tenderpilot/copy'),
  'katalog-lokal': () => import('./katalog-lokal/copy'),
  'rapor-usaha': () => import('./rapor-usaha/copy'),
  'indeks-ekonomi': () => import('./indeks-ekonomi/copy'),
  'sinyal-pasar': () => import('./sinyal-pasar/copy'),
}

/* ------------------------------------------------------------------ cached loaders */

const miniDone = new Map<ProductSlug, ComponentType<MiniProps>>()
const miniPending = new Map<ProductSlug, Promise<ComponentType<MiniProps>>>()
const copyDone = new Map<ProductSlug, ProductCopy>()
const copyPending = new Map<ProductSlug, Promise<ProductCopy>>()

/** The mini component (cached; a failed load is forgotten so a later call retries). */
export function loadMini(slug: ProductSlug): Promise<ComponentType<MiniProps>> {
  const hit = miniDone.get(slug)
  if (hit) return Promise.resolve(hit)
  let p = miniPending.get(slug)
  if (!p) {
    p = MINIS[slug]().then(
      (m) => {
        miniDone.set(slug, m.default)
        return m.default
      },
      (e: unknown) => {
        miniPending.delete(slug)
        throw e
      },
    )
    miniPending.set(slug, p)
  }
  return p
}

/** The page copy (cached; a failed load is forgotten so a later call retries). */
export function loadCopy(slug: ProductSlug): Promise<ProductCopy> {
  const hit = copyDone.get(slug)
  if (hit) return Promise.resolve(hit)
  let p = copyPending.get(slug)
  if (!p) {
    p = COPIES[slug]().then(
      (m) => {
        copyDone.set(slug, m.copy)
        return m.copy
      },
      (e: unknown) => {
        copyPending.delete(slug)
        throw e
      },
    )
    copyPending.set(slug, p)
  }
  return p
}

/** Preload on intent (hover / focus); never rejects. */
export const preloadCopy = (slug: ProductSlug): void => void loadCopy(slug).catch(() => undefined)
export const preloadMini = (slug: ProductSlug): void => void loadMini(slug).catch(() => undefined)

/** The mini component for `slug` once `enabled` turned true (e.g. frame near the viewport / hover delay passed). */
export function useMini(slug: ProductSlug, enabled: boolean): ComponentType<MiniProps> | null {
  const [state, setState] = useState<{ slug: ProductSlug; C: ComponentType<MiniProps> } | null>(() => {
    const C = miniDone.get(slug)
    return C ? { slug, C } : null
  })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadMini(slug).then(
      (C) => alive && setState({ slug, C }),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [slug, enabled])
  return state?.slug === slug ? state.C : (miniDone.get(slug) ?? null)
}

/** The page copy for `slug` (null while loading: render skeleton lines, keep the hero from products.ts). */
export function useProductCopy(slug: ProductSlug): ProductCopy | null {
  const [state, setState] = useState<{ slug: ProductSlug; copy: ProductCopy } | null>(() => {
    const c = copyDone.get(slug)
    return c ? { slug, copy: c } : null
  })
  useEffect(() => {
    let alive = true
    loadCopy(slug).then(
      (copy) => alive && setState({ slug, copy }),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [slug])
  return state?.slug === slug ? state.copy : (copyDone.get(slug) ?? null)
}
