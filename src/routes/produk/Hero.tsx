/**
 * Hero of /produk/:slug (plan §2.3 item 1): crumbs, eyebrow "{eco} · {code}", h1 full name, tagline (products.ts,
 * never waits for the copy chunk), pitch (copy; a skeleton line while it loads), CTAs, and the live mini-demo on
 * the right (below on phones). Same dusk sky + fireflies as PageShell. LCP = the h1.
 */
import { useEcoI18n } from '../../content/i18n/useEco'
import { ECOSYSTEMS, fullName, type ProductDef } from '../../content/products'
import type { ProductCopy } from '../../demos/minis'
import Fireflies from '../../components/Fireflies'
import { Eyebrow } from '../../components/ui/SectionHeader'
import { ButtonLink } from '../../components/ui/Button'
import AppLink from '../../components/AppLink'
import { Icon } from '../../demo-kit/ui/icons'
import { ContactButton, EcoBadge } from '../EcoParts'
import { MiniStage } from './MiniStage'
import { tourLabel, useTx, warmDemo } from './Sections'

export function Hero({ p, copy, tryLabel, wa }: { p: ProductDef; copy: ProductCopy | null; tryLabel: string; wa: string }) {
  const { lang, eco: e } = useEcoI18n()
  const c = e.common
  const tx = useTx(p)
  const tour = tourLabel(p, e.product.seeInTourAt)
  return (
    <section className="page-hero pr-hero" data-sec="hero" data-eco={p.eco} aria-labelledby="pr-h1">
      <div className="page-hero-sky" aria-hidden="true" />
      <Fireflies seed={p.name.length} density={0.7} />
      <div className="page-hero-inner pr-hero-grid">
        <div className="pr-hero-text">
          <nav className="eco-crumbs" aria-label={c.breadcrumb}>
            <AppLink to="/ekosistem">{c.ecosystem}</AppLink>
            <span aria-hidden="true">/</span>
            <AppLink to={`/ekosistem/${p.eco}`} className="eco-crumb-badge">
              <EcoBadge eco={p.eco} />
            </AppLink>
          </nav>
          <Eyebrow>{`${ECOSYSTEMS[p.eco].name} · ${p.code}`}</Eyebrow>
          <h1 id="pr-h1" className="page-title pr-title">
            {fullName(p, lang)}
          </h1>
          <p className="page-lead pr-lead">{p.tagline[lang]}</p>
          {copy ? <p className="pr-pitch">{tx(copy.pitch)}</p> : <span className="pr-pitch pr-skel-line" role="status" aria-label={e.product.copyLoading} />}
          <div className="page-hero-actions eco-ctas">
            <span onPointerEnter={() => warmDemo(p.slug)} onFocus={() => warmDemo(p.slug)} className="eco-cta-wrap">
              <ButtonLink to={`/demo/${p.slug}`} icon={<Icon name="play" size={18} />}>
                {tryLabel}
              </ButtonLink>
            </span>
            {tour ? (
              <ButtonLink to={tour.to} variant="ghost">
                {tour.text}
              </ButtonLink>
            ) : null}
            <ContactButton text={wa} />
          </div>
        </div>
        <div className="pr-hero-mini">
          <MiniStage slug={p.slug} />
        </div>
      </div>
    </section>
  )
}
