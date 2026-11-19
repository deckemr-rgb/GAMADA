/**
 * /produk/:slug — the product page template (Tahap 6 plan §2.3), one tree for every product (unknown slug ⇒ 404;
 * /produk/inti is redirected to /ekosistem/inti by the router, the template still renders it if reached).
 * Data: products.ts (identity, roles, related, chapters) · copy.ts through useProductCopy (dynamic import, one chunk
 * per slug) · eco/ready.ts (SITE_DEMO_READY, the site copy of the registry flag) · tour.ts (chapters). Sections (data-sec): hero, problems, steps, highlights,
 * related, roles, security, faq, (chapters when > 1), cta.
 * Merged legacy products keep their anchors right under the hero: #kasir (KasirKu → Toko Autopilot),
 * #analisis (ScrapPulse → Radar Isu); they do not wait for the copy chunk, and a direct load with the hash scrolls
 * there once the page has mounted.
 */
import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { PRODUCT_BY_SLUG, isProductSlug, type ProductDef, type ProductSlug } from '../content/products'
import { SITE_DEMO_READY } from './eco/ready'
import { useProductCopy } from '../demos/minis'
import { elementForHash, scrollToElement } from '../lib/navigation'
import AppLink from '../components/AppLink'
import Arrow from '../components/ui/Arrow'
import { Icon } from '../demo-kit/ui/icons'
import NotFound from './NotFound'
import { fill } from './EcoParts'
import { Hero } from './produk/Hero'
import { Chapters, Cta, Faq, Highlights, Problems, Related, Roles, Security, Steps } from './produk/Sections'
import { PR } from './produk/strings'
import { SITE } from '../content/site'
import '../styles/produk.css'

/** Legacy products folded into an ecosystem product: anchor id + where its module opens (spec §2.1). */
const MERGED: Partial<Record<ProductSlug, { key: 'kasir' | 'analisis'; to: string }>> = {
  'toko-autopilot': { key: 'kasir', to: '/demo/toko-autopilot?tab=kasir' },
  'radar-isu': { key: 'analisis', to: '/demo/radar-isu?tab=analisis' },
}

function Merged({ p }: { p: ProductDef }) {
  const { lang, eco: e } = useEcoI18n()
  const m = MERGED[p.slug]
  const { hash } = useLocation()
  useEffect(() => {
    if (!m || hash !== `#${m.key}`) return
    // direct load: the browser tried the hash before this lazy route existed; scroll once it has laid out
    const raf = requestAnimationFrame(() => {
      const el = elementForHash(hash)
      if (el && Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 0.6) scrollToElement(el, false)
    })
    return () => cancelAnimationFrame(raf)
  }, [m, hash])
  if (!m) return null
  const t = e.product.merged[m.key]
  return (
    <div className="pr-merged-wrap">
      <section id={m.key} className="eco-merged pr-merged" data-eco={p.eco} aria-labelledby={`pr-merged-${m.key}`}>
        <Icon name="layers" size={22} />
        <div>
          <h2 id={`pr-merged-${m.key}`} className="eco-h3">
            {t.title}
          </h2>
          <p>{t.body}</p>
          <AppLink to={m.to} className="pr-link">
            {PR.mergedCta[m.key][lang]}
            <Arrow />
          </AppLink>
        </div>
      </section>
    </div>
  )
}

function Page({ slug }: { slug: ProductSlug }) {
  const { lang, eco: e } = useEcoI18n()
  const p = PRODUCT_BY_SLUG[slug]
  const copy = useProductCopy(slug)
  const name = p.name
  const tryLabel = SITE_DEMO_READY[slug] ? e.common.tryDemo : e.common.demoPlan
  const wa = fill(e.common.waPrefill, { name })
  return (
    <>
      <title>{fill(e.product.docTitle, { name: `${p.name}: ${p.descriptor[lang]}` })}</title>
      <meta name="description" content={p.tagline[lang]} />
      {/* Tahap 7 (plan item 12): structured data without price or rating */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: `${p.name}`,
            description: p.tagline[lang],
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            inLanguage: lang,
            url: `${SITE.url}/produk/${p.slug}`,
            publisher: { '@type': 'Organization', name: SITE.name, url: `${SITE.url}/` },
          }).replace(/</g, '\\u003c'),
        }}
      />
      <div className="pr-page" data-eco={p.eco} data-copy={copy ? 'ready' : 'loading'}>
        <Hero p={p} copy={copy} tryLabel={tryLabel} wa={wa} />
        <Merged p={p} />
        <Problems p={p} copy={copy} />
        <Steps p={p} copy={copy} />
        <Highlights p={p} copy={copy} />
        <Related p={p} copy={copy} />
        <Roles p={p} copy={copy} />
        <Security p={p} copy={copy} />
        <Faq p={p} copy={copy} />
        <Chapters p={p} />
        <Cta p={p} tryLabel={tryLabel} wa={wa} />
      </div>
    </>
  )
}

export default function Produk() {
  const { slug } = useParams()
  if (!isProductSlug(slug)) return <NotFound />
  return <Page key={slug} slug={slug} />
}
