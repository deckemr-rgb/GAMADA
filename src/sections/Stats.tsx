/**
 * Stats — the camera "lands" after the last scene: a soft band blends the biodiversity grade into
 * the content background, then four counters (Halaman & Demo, Aplikasi Mobile, Proyek Enterprise,
 * Respons 24 Jam) count up once when 60 % visible. Values: content/site.ts (SITE.stats).
 */
import { useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { SITE } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import StatCounter from '../components/ui/StatCounter'
import '../styles/sections/stats.css'

export default function Stats() {
  const { t } = useI18n()
  const c = t.home.stats
  const ref = useRef<HTMLDivElement>(null)

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.cards(root.querySelectorAll('[data-rv="card"]'))
  })

  return (
    <div ref={ref} className="landing">
      <div className="landing-band" aria-hidden="true" />
      <Section id="angka" tone="ink2" labelledBy="angka-title" fireflies={0.5}>
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="angka-title" />
        <div className="stats-grid">
          <StatCounter value={SITE.stats.pagesAndDemos} label={c.pagesAndDemos} />
          <StatCounter value={SITE.stats.mobileApps} label={c.mobileApps} />
          <StatCounter value={SITE.stats.enterpriseProjects} label={c.enterpriseProjects} />
          <StatCounter value={SITE.stats.responseHours} suffix={c.hoursSuffix} label={c.responseHours} />
        </div>
      </Section>
    </div>
  )
}
