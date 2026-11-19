/**
 * eco/parts.tsx — small pieces of the Tahap-6 ecosystem pages (/ekosistem, /ekosistem/:eco, /lab): the hero shell
 * (PageShell markup + an optional visual), product chips and tiles, a check glyph and a media-query hook.
 * Site look only (site tokens --c-*, home Card / Button / Section); styles in src/styles/eco-site.css.
 */
import { useEffect, useState, type ReactNode } from 'react'
import Fireflies from '../../components/Fireflies'
import { Eyebrow } from '../../components/ui/SectionHeader'
import Card from '../../components/ui/Card'
import AppLink from '../../components/AppLink'
import Arrow from '../../components/ui/Arrow'
import { Icon } from '../../demo-kit/ui/icons'
import { PRODUCT_BY_SLUG, type ProductDef, type ProductSlug } from '../../content/products'
import { SITE_DEMO_READY as DEMO_READY } from './ready'
import { preloadCopy } from '../../demos/minis'
import { useEcoI18n } from '../../content/i18n/useEco'
import '../../styles/eco-site.css'

/** /produk/<slug>, except GAMADA Inti whose page is /ekosistem/inti (plan §7 Q3). */
export const productHref = (slug: ProductSlug): string => (slug === 'inti' ? '/ekosistem/inti' : `/produk/${slug}`)

/** Intent preload for a product page: the route chunk comes with AppLink, the page words here. */
export const warmProduct = (slug: ProductSlug): void => {
  if (slug !== 'inti') preloadCopy(slug)
}

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatch(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return match
}

export function CheckGlyph() {
  return (
    <svg className="es-check" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <path d="M6 10.4 8.7 13 14 7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** PageShell's hero markup (dusk sky, fireflies, eyebrow, h1, lead, actions) with an optional visual. */
export function EcoHero({
  eyebrow,
  title,
  lead,
  docTitle,
  top,
  actions,
  visual,
  layout = 'stack',
}: {
  eyebrow: string
  title: string
  lead: string
  docTitle: string
  top?: ReactNode
  actions?: ReactNode
  visual?: ReactNode
  layout?: 'stack' | 'split'
}) {
  return (
    <>
      <title>{docTitle}</title>
      <meta name="description" content={lead} />
      <section className={`page-hero es-hero es-hero--${layout}`}>
        <div className="page-hero-sky es-hero-sky" aria-hidden="true" />
        <Fireflies seed={title.length} density={0.7} />
        <div className="page-hero-inner es-hero-inner">
          <div className="es-hero-text">
            {top}
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="page-title">{title}</h1>
            <p className="page-lead">{lead}</p>
            {actions ? <div className="page-hero-actions">{actions}</div> : null}
          </div>
          {visual ? <div className="es-hero-visual">{visual}</div> : null}
        </div>
      </section>
    </>
  )
}

/** Product chip → its page (preloads the page words on intent). */
export function ProductChip({ slug, sub }: { slug: ProductSlug; sub?: string }) {
  const p = PRODUCT_BY_SLUG[slug]
  return (
    <li data-eco={p.eco}>
      <AppLink to={productHref(slug)} className="es-chip" onPointerEnter={() => warmProduct(slug)} onFocus={() => warmProduct(slug)}>
        <Icon name={p.icon} size={16} />
        <span>{p.name}</span>
        {sub ? <span className="es-chip-sub">{sub}</span> : null}
      </AppLink>
    </li>
  )
}

export function ProductChips({ slugs, className = '' }: { slugs: readonly ProductSlug[]; className?: string }) {
  return (
    <ul className={`es-chips ${className}`}>
      {slugs.map((s) => (
        <ProductChip key={s} slug={s} />
      ))}
    </ul>
  )
}

/** Product card in the home Card style: name → product page, plus "Coba demo" when the demo is READY. */
export function ProductTile({ p, compact = false }: { p: ProductDef; compact?: boolean }) {
  const { lang, eco: copy } = useEcoI18n()
  const ready = DEMO_READY[p.slug]
  return (
    <Card as="li" className={`es-tile${compact ? ' is-compact' : ''}`}>
      <div className="es-tile-in" data-eco={p.eco}>
        <span className="es-tile-top">
          <span className="es-tile-icon">
            <Icon name={p.icon} size={22} />
          </span>
          <span className="es-tile-code" aria-hidden="true">
            {p.code}
          </span>
        </span>
        <h3 className="es-tile-name">{p.name}</h3>
        <p className="es-tile-desc">{p.descriptor[lang]}</p>
        {compact ? null : <p className="es-tile-tag">{p.tagline[lang]}</p>}
        <span className="es-tile-actions">
          <AppLink
            to={productHref(p.slug)}
            className="es-tile-more"
            aria-label={`${copy.common.productPage}: ${p.name}`}
            onPointerEnter={() => warmProduct(p.slug)}
            onFocus={() => warmProduct(p.slug)}
          >
            {copy.common.productPage}
            <Arrow />
          </AppLink>
          {ready ? (
            <AppLink to={`/demo/${p.slug}`} className="es-tile-demo" aria-label={`${copy.common.openDemo}: ${p.name}`}>
              <Icon name="play" size={16} />
              {copy.common.openDemo}
            </AppLink>
          ) : null}
        </span>
      </div>
    </Card>
  )
}
