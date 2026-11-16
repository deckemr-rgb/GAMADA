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
  tools: () => import('./routes/Tools'),
  scrappulse: () => import('./routes/ScrapPulse'),
  phonefarm: () => import('./routes/PhoneFarmPanel'),
  labDesign: () => import('./routes/LabDesign'),
  notFound: () => import('./routes/NotFound'),
} satisfies Record<string, Loader>

/** Loader for a pathname (null for the eager home). */
function loaderFor(pathname: string): Loader | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/') return null
  if (p === '/karya') return LOADERS.karya
  if (p.startsWith('/karya/')) return LOADERS.karyaDetail
  if (p === '/proses') return LOADERS.proses
  if (p === '/faq') return LOADERS.faq
  if (p === '/tools') return LOADERS.tools
  if (p === '/tools/scrappulse') return LOADERS.scrappulse
  if (p === '/panel/phonefarm') return LOADERS.phonefarm
  if (p === '/lab/_design') return LOADERS.labDesign
  return LOADERS.notFound
}

/** Start downloading a page chunk; resolves when it is ready (never rejects: the router reports errors). */
export function preloadRoute(pathname: string): Promise<void> {
  const load = loaderFor(pathname)
  return load ? load().then(() => undefined, () => undefined) : Promise.resolve()
}
