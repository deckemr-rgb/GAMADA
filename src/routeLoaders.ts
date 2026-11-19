/**
 * routeLoaders.ts — the lazy page imports, shared by the router (route.lazy) and AppLink (preload on
 * hover / focus, and in parallel with the curtain cover so the chunk arrives while the mist rises).
 * No static imports of pages here, so there is no import cycle with components that use AppLink.
 */
import type { ComponentType } from 'react'

type Loader = () => Promise<{ default: ComponentType }>

export const LOADERS = {
  karya: () => import('./routes/Karya'),
  karyaDetail: () => import('./routes/KaryaDetail'),
  proses: () => import('./routes/Proses'),
  faq: () => import('./routes/Faq'),
  ekosistem: () => import('./routes/Ekosistem'),
  ekosistemDetail: () => import('./routes/EkosistemDetail'),
  produk: () => import('./routes/Produk'),
  demo: () => import('./routes/Demo'),
  tur: () => import('./routes/Tur'),
  lab: () => import('./routes/Lab'),
  phonefarm: () => import('./routes/PhoneFarmPanel'),
  labKit: () => import('./routes/LabKit'),
  notFound: () => import('./routes/NotFound'),
} satisfies Record<string, Loader>

/** Loader for a pathname (null for the eager home). */
function loaderFor(pathname: string): Loader | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/') return null
  if (p === '/karya') return LOADERS.karya
  // redirects (router.tsx): warm the destination's chunk
  if (p === '/karya/kasirku') return LOADERS.produk
  if (p === '/karya/scrappulse') return LOADERS.produk
  if (p === '/produk/inti') return LOADERS.ekosistemDetail
  if (p === '/tools') return LOADERS.lab
  if (p === '/tools/scrappulse') return LOADERS.demo
  if (p.startsWith('/karya/')) return LOADERS.karyaDetail
  if (p === '/ekosistem') return LOADERS.ekosistem
  if (p.startsWith('/ekosistem/')) return LOADERS.ekosistemDetail
  if (p.startsWith('/produk/')) return LOADERS.produk
  if (p.startsWith('/demo/')) return LOADERS.demo
  if (p === '/tur' || p.startsWith('/tur/')) return LOADERS.tur
  if (p === '/lab') return LOADERS.lab
  if (p === '/proses') return LOADERS.proses
  if (p === '/faq') return LOADERS.faq
  if (p === '/panel/phonefarm') return LOADERS.phonefarm
  if (p === '/lab/_kit') return LOADERS.labKit
  return LOADERS.notFound
}

/** Start downloading a page chunk; resolves when it is ready (never rejects: the router reports errors). */
export function preloadRoute(pathname: string): Promise<void> {
  const load = loaderFor(pathname)
  return load ? load().then(() => undefined, () => undefined) : Promise.resolve()
}
