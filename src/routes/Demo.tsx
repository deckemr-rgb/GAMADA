/**
 * /demo/:slug — full-screen product sandbox (no site navbar / footer / WhatsApp float / curtain: the route
 * handle { chrome } in router.tsx is read by RootLayout). Unknown slug ⇒ 404 with the normal site chrome.
 * The canvas is the lazy demo from src/demos/registry.ts, framed by the shell's <DemoShell product canvas>; the
 * module's named exports (missions, hotspot, splitTabs) go to the shell too (registry contract).
 * While a product is not DEMO_READY its canvas is the tahap-1 placeholder, so the shell runs `interim` (no role /
 * clock / AI / reset controls: nothing on the placeholder reacts to them). ?controls=all (dev server, or a build
 * with VITE_DEMO_CONTROLS=1) opens the product module with the full live shell before DEMO_READY is flipped (product
 * builders, the shell self-test, the integrator's e2e build).
 */
import { Suspense } from 'react'
import { useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { PRODUCT_BY_SLUG, fullName, isProductSlug } from '../content/products'
import { DEMO_READY, PlaceholderCanvas, demoComponent, useDemoModule } from '../demos/registry'
import { DemoShell } from '../demo-kit/shell'
import { LoadingText } from '../demo-kit/ui'
import NotFound from './NotFound'

/** local copy (EcoParts' fill would pull the whole EcoParts chunk into every demo) */
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

export default function Demo() {
  const { lang, eco: copy } = useEcoI18n()
  const { slug } = useParams()
  const known = isProductSlug(slug)
  const forceControls =
    (import.meta.env.DEV || import.meta.env.VITE_DEMO_CONTROLS === '1') && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all'
  const interim = !known || (!DEMO_READY[slug] && !forceControls)
  const mod = useDemoModule(known && !interim ? slug : null)
  if (!known) return <NotFound />
  const p = PRODUCT_BY_SLUG[slug]
  const Canvas = interim ? PlaceholderCanvas : demoComponent(slug)
  const name = fullName(p, lang)
  const canvas = (
    <Suspense fallback={<LoadingText>{copy.demo.loading}</LoadingText>}>
      <Canvas product={slug} />
    </Suspense>
  )
  return (
    <>
      <title>{fill(copy.demo.docTitle, { name: p.name })}</title>
      <meta name="description" content={`${name}. ${p.tagline[lang]}`} />
      <DemoShell key={slug} product={slug} canvas={canvas} layout="page" interim={interim} missions={mod?.missions} hotspot={mod?.hotspot} splitTabs={mod?.splitTabs} />
    </>
  )
}
