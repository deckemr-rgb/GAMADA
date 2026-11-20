/**
 * router.tsx — data router. Home is bundled eagerly (it is the landing page and owns the preload
 * hints); every other page is its own lazy chunk.
 */
import type { ComponentType } from 'react'
import { createBrowserRouter, replace, type LoaderFunctionArgs } from 'react-router'
import RootLayout, { type RouteHandle } from './routes/RootLayout'
import Home from './routes/Home'
import RouteError from './routes/RouteError'
import { LOADERS } from './routeLoaders'
import { isProductSlug } from './content/productSlugs'
import { BASENAME } from './lib/base'

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

/** Redirect loader: history.replace to `to`, keeping the request's query (params already in `to` win). */
const moved =
  (to: string) =>
  ({ request }: LoaderFunctionArgs) => {
    const from = new URL(request.url)
    const dest = new URL(to, from.origin)
    from.searchParams.forEach((v, k) => {
      if (!dest.searchParams.has(k)) dest.searchParams.append(k, v)
    })
    return replace(dest.pathname + dest.search + dest.hash)
  }

/** /demo/:slug is a full-screen sandbox: no site chrome (an unknown slug renders the 404 with chrome). */
const sandbox: RouteHandle = { chrome: (params) => (isProductSlug(params.slug) ? 'none' : 'site') }
/** /tur and /tur/:bab (Tahap 5, owner P5): full screen like a sandbox (no navbar / footer / WhatsApp float / curtain) */
const tourScreen: RouteHandle = { chrome: 'none' }

function PageFallback() {
  return <div className="page-fallback" aria-hidden="true" />
}

/** A sub-path deploy (GitHub Pages: /GAMADA/) routes under that basename; the default build has none. */
const ROUTER_OPTS = BASENAME ? { basename: BASENAME } : undefined

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: PageFallback,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: Home },
      { path: 'karya', lazy: page(LOADERS.karya) },
      { path: 'karya/:slug', lazy: page(LOADERS.karyaDetail) },
      { path: 'proses', lazy: page(LOADERS.proses) },
      { path: 'faq', lazy: page(LOADERS.faq) },
      { path: 'karya/kasirku', loader: moved('/produk/toko-autopilot#kasir') },
      { path: 'karya/scrappulse', loader: moved('/produk/radar-isu#analisis') },
      { path: 'produk/inti', loader: moved('/ekosistem/inti') },
      { path: 'tools', loader: moved('/lab') },
      { path: 'tools/scrappulse', loader: moved('/demo/radar-isu?tab=analisis') },
      { path: 'ekosistem', lazy: page(LOADERS.ekosistem) },
      { path: 'ekosistem/:eco', lazy: page(LOADERS.ekosistemDetail) },
      { path: 'produk/:slug', lazy: page(LOADERS.produk) },
      { path: 'demo/:slug', handle: sandbox, lazy: page(LOADERS.demo) },
      { path: 'tur', handle: tourScreen, lazy: page(LOADERS.tur) },
      { path: 'tur/:bab', handle: tourScreen, lazy: page(LOADERS.tur) },
      { path: 'lab', lazy: page(LOADERS.lab) },
      { path: 'panel/phonefarm', lazy: page(LOADERS.phonefarm) },
      { path: 'lab/_kit', lazy: page(LOADERS.labKit) },
      { path: '*', lazy: page(LOADERS.notFound) },
    ],
  },
], ROUTER_OPTS)
