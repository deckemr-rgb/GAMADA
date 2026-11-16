/**
 * Services — "Layanan & Produk" (#layanan, the navbar + footer target). Dawn tone with the ambient
 * drift. Four Cards (tilt + spotlight + lavender glow) with a line icon that redraws itself on
 * hover / keyboard focus (stroke-dashoffset, CSS — see services.css), a short description, what is
 * included, the demo count (computed from content/work.ts) and a link into /karya.
 * Closes with a WhatsApp consultation strip.
 */
import { useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { waLink } from '../content/site'
import { WORK, findWork } from '../content/work'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import Tag, { type TagTone } from '../components/ui/Tag'
import { ButtonLink, WaIcon } from '../components/ui/Button'
import ServiceIcon, { type ServiceIconKey } from './services/ServiceIcon'
import '../styles/sections/services.css'

/** Where each card links, which tag tone its count uses, and how many entries it counts. */
const SERVICE_META: Record<ServiceIconKey, { to: string; tone: TagTone; count: number }> = {
  web: { to: '/karya#web', tone: 'live', count: WORK.filter((w) => w.kind === 'web').length },
  apk: { to: '/karya#apk', tone: 'mobile', count: WORK.filter((w) => w.kind === 'apk').length },
  ml: { to: '/karya#proyek', tone: 'real', count: WORK.filter((w) => w.kind === 'case').length },
  pos: { to: '/karya/kasirku', tone: 'live', count: findWork('kasirku') ? 1 : 0 },
}

export default function Services() {
  const { t } = useI18n()
  const c = t.home.services
  const ref = useRef<HTMLDivElement>(null)

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelector('[data-rv="lead"]'))
    kit.cards(root.querySelectorAll('.svc-grid [data-rv="card"]'))
    kit.fadeUp(root.querySelector('.svc-cta'))
  })

  return (
    <div ref={ref}>
      <Section id="layanan" tone="dawn" labelledBy="layanan-title" ambient className="svc">
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="layanan-title" lead={c.lead} />

        <ul className="svc-grid" role="list">
          {c.items.map((item, i) => {
            const meta = SERVICE_META[item.key]
            const titleId = `layanan-${item.key}`
            return (
              <Card as="li" key={item.key} className="svc-card">
                <div className="svc-top">
                  <span className="svc-icon">
                    <ServiceIcon name={item.key} />
                  </span>
                  <span className="svc-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="svc-body">
                  <h3 className="svc-title" id={titleId}>
                    {item.title}
                  </h3>
                  <p className="svc-desc">{item.desc}</p>
                </div>
                <p className="svc-inc-label" id={`${titleId}-inc`}>
                  {c.includedLabel}
                </p>
                <ul className="svc-list" aria-labelledby={`${titleId}-inc`}>
                  {item.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="svc-foot">
                  <Tag tone={meta.tone}>{item.count(meta.count)}</Tag>
                  <ButtonLink to={meta.to} variant="text" className="svc-link">
                    {item.cta}
                  </ButtonLink>
                </div>
              </Card>
            )
          })}
        </ul>

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
