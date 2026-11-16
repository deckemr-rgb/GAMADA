/**
 * Why — "Kenapa GAMADA" (#fondasi). Ink-2 tone with fireflies. Six principles in a bento grid
 * (4 columns × 3 rows on desktop with a large "ecosystem" tile, 2 columns on tablets, a single column
 * on phones), each a Card (tilt + spotlight + glow) revealed with kit.cards. The ecosystem diagram and
 * the insight sparkline are decorative and drawn by scroll through kit.stroke. Below the bento, a
 * second stat strip (SITE.stats: web demos, mobile demos, case studies, reply time).
 */
import { useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { SITE } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import StatCounter from '../components/ui/StatCounter'
import { EcoDiagram, GrowthSteps, Sparkline, WhyIcon } from './why/WhyArt'
import '../styles/sections/why.css'

export default function Why() {
  const { t } = useI18n()
  const c = t.home.why
  const ref = useRef<HTMLDivElement>(null)

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelector('[data-rv="lead"]'))
    kit.cards(root.querySelectorAll('.why-bento [data-rv="card"]'))
    root.querySelectorAll('.why-eco, .why-spark').forEach((svg) => {
      kit.stroke(svg.querySelectorAll('[data-why-stroke]'), svg, { start: 'top 88%', end: 'bottom 55%' })
    })
    kit.fadeUp(root.querySelector('.why-stats-title'))
    kit.cards(root.querySelectorAll('.why-stats [data-rv="card"]'))
  })

  return (
    <div ref={ref}>
      <Section id="fondasi" tone="ink2" labelledBy="fondasi-title" fireflies className="why">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="fondasi-title" lead={c.lead} />

        <ul className="why-bento" role="list">
          {c.features.map((f) => (
            <Card as="li" key={f.key} className={`why-tile why-tile--${f.key}`}>
              <span className="why-icon">
                <WhyIcon name={f.key} />
              </span>
              <h3 className="why-title">{f.title}</h3>
              <p className="why-text">{f.text}</p>
              {f.key === 'ecosystem' ? (
                <div className="why-art why-art--eco">
                  <EcoDiagram nodes={c.ecoNodes} center={c.ecoCenter} />
                </div>
              ) : null}
              {f.key === 'insight' ? (
                <div className="why-art why-art--spark">
                  <Sparkline />
                </div>
              ) : null}
              {f.key === 'scale' ? (
                <div className="why-art why-art--steps">
                  <GrowthSteps />
                </div>
              ) : null}
              {f.key === 'local' ? (
                <ul className="why-chips">
                  {c.localChips.map((chip) => (
                    <li key={chip} className="why-chip">
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </ul>

        <div className="why-stats-wrap">
          <h3 className="why-stats-title">{c.statsTitle}</h3>
          <div className="stats-grid why-stats">
            <StatCounter value={SITE.stats.webDemos} label={c.webDemos} />
            <StatCounter value={SITE.stats.mobileApps} label={c.mobileApps} />
            <StatCounter value={SITE.stats.caseStudies} label={c.caseStudies} />
            <StatCounter value={SITE.stats.responseHours} suffix={c.hoursSuffix} label={c.responseHours} />
          </div>
        </div>
      </Section>
    </div>
  )
}
