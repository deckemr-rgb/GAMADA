/**
 * Services — "Layanan & Produk" (#layanan, the navbar + footer target). Dawn tone with the ambient drift.
 * Tahap 6 (spec §4): three ecosystem Cards (tilt + spotlight + glow) with a line icon that redraws itself on
 * hover / keyboard focus (stroke-dashoffset, CSS — see services.css): audience, name, a 2-line pitch, three example
 * products, "{n} produk" and a link to /ekosistem/:eco. Then a slim GAMADA Inti line, one sentence for the studio's
 * custom work (→ /karya) and the WhatsApp consultation strip. Names, counts and examples come from
 * content/ecoNav.ts only (home never imports products.ts or the registry).
 */
import { useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { waLink } from '../content/site'
import { ECO_NAV } from '../content/ecoNav'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import Tag from '../components/ui/Tag'
import AppLink from '../components/AppLink'
import { ButtonLink, WaIcon } from '../components/ui/Button'
import ServiceIcon, { type ServiceIconKey } from './services/ServiceIcon'
import '../styles/sections/services.css'

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))

export default function Services() {
  const { t, lang } = useI18n()
  const c = t.home.services
  const ref = useRef<HTMLDivElement>(null)
  const ecos = ECO_NAV.filter((e): e is (typeof ECO_NAV)[number] & { id: ServiceIconKey } => e.id !== 'inti')
  const inti = ECO_NAV.find((e) => e.id === 'inti')

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelector('[data-rv="lead"]'))
    kit.cards(root.querySelectorAll('.svc-grid [data-rv="card"]'))
    kit.fadeUp(root.querySelectorAll('.svc-more, .svc-cta'))
  })

  return (
    <div ref={ref}>
      <Section id="layanan" tone="dawn" labelledBy="layanan-title" ambient className="svc">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="layanan-title" lead={c.lead} />

        <ul className="svc-grid" role="list">
          {ecos.map((e, i) => {
            const titleId = `layanan-${e.id}`
            return (
              <Card as="li" key={e.id} className={`svc-card svc-card--${e.id}`}>
                <div className="svc-top">
                  <span className="svc-icon">
                    <ServiceIcon name={e.id} />
                  </span>
                  <span className="svc-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="svc-body">
                  <p className="svc-aud">{e.audience[lang]}</p>
                  <h3 className="svc-title" id={titleId}>
                    {e.name}
                  </h3>
                  <p className="svc-desc">{c.pitch[e.id]}</p>
                </div>
                <p className="svc-inc-label" id={`${titleId}-ex`}>
                  {c.examples}
                </p>
                <ul className="svc-chips" aria-labelledby={`${titleId}-ex`}>
                  {e.examples.map((x) => (
                    <li key={x.slug}>{x.name}</li>
                  ))}
                </ul>
                <div className="svc-foot">
                  <Tag tone="live">{fill(c.count, { n: e.count })}</Tag>
                  <ButtonLink to={e.to} variant="text" className="svc-link" ariaLabel={`${c.cta}: ${e.name}`}>
                    {c.cta}
                  </ButtonLink>
                </div>
              </Card>
            )
          })}
        </ul>

        <div className="svc-more">
          {inti ? (
            <p>
              <span>{fill(c.inti, { name: inti.name })}</span>{' '}
              <AppLink to={inti.to} className="svc-more-link">
                {fill(c.intiCta, { name: inti.name })} <span aria-hidden="true">→</span>
              </AppLink>
            </p>
          ) : null}
          <p>
            <span>{c.custom}</span>{' '}
            <AppLink to="/karya" className="svc-more-link">
              {c.customCta} <span aria-hidden="true">→</span>
            </AppLink>
          </p>
        </div>

        <div className="svc-cta">
          <div className="svc-cta-copy">
            <h3 className="svc-cta-title">{c.ctaTitle}</h3>
            <p className="svc-cta-text">{c.ctaText}</p>
          </div>
          <ButtonLink href={waLink(c.waText)} variant="wa" icon={<WaIcon />}>
            {c.ctaButton}
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
