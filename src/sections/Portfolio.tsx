/**
 * Portfolio — "Portofolio unggulan": three featured cards (PhoneFarm, Sistem Automasi, the mobile
 * demos). Shared Card hover language (tilt + spotlight + glow) plus a zoom of the inner art only
 * (CSS transform). Cards batch in with kit.cards; each card's tags follow with a small stagger.
 * The whole card is clickable through its one link (stretched ::after), so there is a single tab
 * stop per card. Counts come from WORK.
 */
import { useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { EASE, SITE_REVEAL as R } from '../lib/motion'
import { WORK } from '../content/work'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import Tag, { type TagTone } from '../components/ui/Tag'
import { ButtonLink } from '../components/ui/Button'
import { FarmArt, FlowArt, PhonesArt } from './portfolio/Arts'
import '../styles/sections/portfolio.css'

/* ---- section constants (candidates for motion.ts) */
const PORTFOLIO_MOTION = {
  /** Tags rise after their card: delay after the card batch starts (s), stagger (s), offset (px). */
  tagDelay: 0.3,
  tagStagger: 0.07,
  tagY: 8,
  tagDur: 0.5,
} as const

interface Feature {
  key: string
  to: string
  title: string
  desc: string
  cta: string
  tags: Array<{ tone: TagTone; label: string }>
  art: ReactNode
}

export default function Portfolio() {
  const { t } = useI18n()
  const c = t.home.portfolio
  const ref = useRef<HTMLDivElement>(null)
  const apkCount = WORK.filter((w) => w.kind === 'apk').length

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

  const features: Feature[] = [
    {
      key: 'farm',
      to: '/karya/phonefarm',
      title: c.phonefarm.title,
      desc: c.phonefarm.desc,
      cta: c.phonefarm.cta,
      tags: [
        { tone: 'real', label: c.tags.real },
        { tone: 'default', label: c.tags.automation },
        { tone: 'live', label: c.tags.live },
      ],
      art: <FarmArt />,
    },
    {
      key: 'flow',
      to: '/karya/sistem-automasi',
      title: c.automation.title,
      desc: c.automation.desc,
      cta: c.automation.cta,
      tags: [
        { tone: 'real', label: c.tags.real },
        { tone: 'ai', label: c.tags.ai },
        { tone: 'default', label: c.tags.automation },
      ],
      art: <FlowArt />,
    },
    {
      key: 'apk',
      to: '/karya#apk',
      title: c.mobile.title.replace('{n}', String(apkCount)),
      desc: c.mobile.desc,
      cta: c.mobile.cta,
      tags: [
        { tone: 'mobile', label: c.tags.mobile },
        { tone: 'live', label: c.tags.live },
      ],
      art: <PhonesArt />,
    },
  ]

  return (
    <div ref={ref} className="portfolio">
      <Section id="portofolio" tone="ink2" labelledBy="portofolio-title">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="portofolio-title" lead={c.lead.replace('{n}', String(WORK.length))} />

        <ul className="pf-grid">
          {features.map((f) => (
            <li key={f.key} className={`pf-item pf-item--${f.key}`}>
              <Card as="article" className={`pf-card pf-card--${f.key}`}>
                <div className="pf-media" aria-hidden="true">
                  {f.art}
                </div>
                <div className="pf-body">
                  <div className="pf-tags">
                    {f.tags.map((tg) => (
                      <Tag key={tg.label} tone={tg.tone}>
                        {tg.label}
                      </Tag>
                    ))}
                  </div>
                  <h3 className="pf-title">{f.title}</h3>
                  <p className="pf-desc">{f.desc}</p>
                  <ButtonLink to={f.to} variant="text" className="pf-link" ariaLabel={`${f.cta}: ${f.title}`}>
                    {f.cta}
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
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
