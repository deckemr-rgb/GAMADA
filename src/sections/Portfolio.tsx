/**
 * Portfolio — "Demo unggulan" (Tahap 6, spec §4): three featured ecosystem demos (Sapa Warga, Siaga Wilayah,
 * Toko Autopilot). Shared Card hover language (tilt + spotlight + glow) plus a zoom of the inner art only (CSS
 * transform). Each card: static SVG art (not the mini-demo, the home stays light), tags, a short line, and two
 * links: "Coba demo" → /demo/:slug and "Detail" → /produk/:slug. Names come from content/ecoNav.ts; the studio's
 * older work moves to /karya ("Portofolio studio lainnya").
 */
import { useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { EASE, SITE_REVEAL as R } from '../lib/motion'
import { ECO_NAV } from '../content/ecoNav'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import Tag, { type TagTone } from '../components/ui/Tag'
import { ButtonLink } from '../components/ui/Button'
import { SapaArt, SiagaArt, TokoArt } from './portfolio/Arts'
import '../styles/sections/portfolio.css'

/* ---- section constants (candidates for motion.ts) */
const PORTFOLIO_MOTION = {
  /** Tags rise after their card: delay after the card batch starts (s), stagger (s), offset (px). */
  tagDelay: 0.3,
  tagStagger: 0.07,
  tagY: 8,
  tagDur: 0.5,
} as const

type FeatureSlug = 'sapa-warga' | 'siaga-wilayah' | 'toko-autopilot'
const FEATURES: ReadonlyArray<{ slug: FeatureSlug; aud: 'gov' | 'biz'; tone: TagTone; art: () => ReactNode }> = [
  { slug: 'sapa-warga', aud: 'gov', tone: 'ai', art: SapaArt },
  { slug: 'siaga-wilayah', aud: 'gov', tone: 'ai', art: SiagaArt },
  { slug: 'toko-autopilot', aud: 'biz', tone: 'real', art: TokoArt },
]
const nameOf = (slug: FeatureSlug) => ECO_NAV.flatMap((e) => e.examples).find((x) => x.slug === slug)?.name ?? slug

export default function Portfolio() {
  const { t } = useI18n()
  const c = t.home.portfolio
  const ref = useRef<HTMLDivElement>(null)

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"]'))
    // Reveal the <li> wrappers, not the Card itself: kit.cards ends with clearProps:'transform', which
    // would also wipe the transformPerspective that useTilt set on the Card (tilt would turn flat).
    const items = root.querySelectorAll<HTMLElement>('.pf-item')
    kit.cards(items)
    kit.fadeUp(root.querySelectorAll('[data-rv="more"]'))
    if (kit.reduced) return
    const M = PORTFOLIO_MOTION
    items.forEach((card) => {
      const tags = card.querySelectorAll('[data-rv="tag"]')
      if (!tags.length) return
      gsap.from(tags, {
        opacity: 0,
        y: M.tagY,
        duration: M.tagDur,
        ease: EASE.out,
        delay: M.tagDelay,
        stagger: M.tagStagger,
        clearProps: 'transform',
        scrollTrigger: { trigger: card, start: R.start, once: true },
      })
    })
  })

  return (
    <div ref={ref} className="portfolio">
      <Section id="portofolio" tone="ink2" labelledBy="portofolio-title">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="portofolio-title" lead={c.lead} />

        <ul className="pf-grid">
          {FEATURES.map((f) => {
            const name = nameOf(f.slug)
            const Art = f.art
            return (
              <li key={f.slug} className={`pf-item pf-item--${f.slug}`}>
                <Card as="article" className={`pf-card pf-card--${f.slug}`}>
                  <div className="pf-media" aria-hidden="true">
                    <Art />
                  </div>
                  <div className="pf-body">
                    <div className="pf-tags">
                      <Tag tone={f.tone}>{c.tags[f.aud]}</Tag>
                      <Tag tone="live">{c.tags.live}</Tag>
                    </div>
                    <h3 className="pf-title">{name}</h3>
                    <p className="pf-desc">{c.items[f.slug]}</p>
                    <div className="pf-links">
                      <ButtonLink to={`/demo/${f.slug}`} variant="primary" className="pf-try" ariaLabel={`${c.try}: ${name}`}>
                        {c.try}
                      </ButtonLink>
                      <ButtonLink to={`/produk/${f.slug}`} variant="text" className="pf-link" ariaLabel={`${c.detail}: ${name}`}>
                        {c.detail}
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>

        <div className="pf-more" data-rv="more">
          <ButtonLink to="/karya" variant="ghost">
            {c.all}
            <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
