/**
 * router.tsx — data router. Home is bundled eagerly (it is the landing page and owns the preload
 * hints); every other page is its own lazy chunk.
 */
import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import RootLayout from './routes/RootLayout'
import Home from './routes/Home'
import RouteError from './routes/RouteError'
import { LOADERS } from './routeLoaders'

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

function PageFallback() {
  return <div className="page-fallback" aria-hidden="true" />
}

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
      { path: 'tools', lazy: page(LOADERS.tools) },
      { path: 'tools/scrappulse', lazy: page(LOADERS.scrappulse) },
      { path: 'panel/phonefarm', lazy: page(LOADERS.phonefarm) },
      { path: 'lab/_design', lazy: page(LOADERS.labDesign) },
      { path: 'lab/_kit', lazy: page(LOADERS.labKit) },
      { path: '*', lazy: page(LOADERS.notFound) },
    ],
  },
])
