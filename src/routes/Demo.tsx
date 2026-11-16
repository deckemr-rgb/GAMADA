/**
 * /demo/:slug — full-screen product sandbox (no site navbar / footer / WhatsApp float / curtain: the route
 * handle { chrome } in router.tsx is read by RootLayout). Unknown slug ⇒ 404 with the normal site chrome.
 * The canvas is the lazy demo from src/demos/registry.ts, framed by the shell's <DemoShell product canvas>.
 */
import { Suspense } from 'react'
import { useParams } from 'react-router'
import { useI18n } from '../lib/i18n'
import { PRODUCT_BY_SLUG, fullName, isProductSlug } from '../content/products'
import { demoComponent } from '../demos/registry'
import { DemoShell } from '../demo-kit/shell'
import { LoadingText } from '../demo-kit/ui'
import NotFound from './NotFound'
import { fill } from './EcoParts'
import '../styles/eco-demo.css'

export default function Demo() {
  const { lang, t } = useI18n()
  const { slug } = useParams()
  if (!isProductSlug(slug)) return <NotFound />
  const p = PRODUCT_BY_SLUG[slug]
  const Canvas = demoComponent(slug)
  const name = fullName(p, lang)
  const canvas = (
    <Suspense fallback={<LoadingText>{t.eco.demo.loading}</LoadingText>}>
      <Canvas product={slug} />
    </Suspense>
  )
  return (
    <>
      <title>{fill(t.eco.demo.docTitle, { name: p.name })}</title>
      <meta name="description" content={`${name}. ${p.tagline[lang]}`} />
      <DemoShell key={slug} product={slug} canvas={canvas} layout="page" />
    </>
  )
}
