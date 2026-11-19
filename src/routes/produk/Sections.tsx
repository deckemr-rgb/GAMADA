/**
 * Sections of the /produk/:slug template (plan §2.3 items 2–9), on the home's section language: Section tones,
 * SectionHeader (eyebrow + split heading + lead), Card (tilt + spotlight + glow), useReveal kit, the shared
 * Accordion. Every section carries `data-sec` (tests). While the copy chunk loads, each renders skeleton lines in
 * the same frame (no layout jump in the hero, which reads only products.ts).
 */
import { useRef, type ReactNode } from 'react'
import { useEcoI18n } from '../../content/i18n/useEco'
import { ECOSYSTEMS, PRODUCT_BY_SLUG, ROLES, type Bi, type ProductDef } from '../../content/products'
import { TOUR, chapterByNumber } from '../../content/tour'
import { SITE_DEMO_READY } from '../eco/ready'
import { preloadCopy, type ProductCopy } from '../../demos/minis'
import { useReveal } from '../../lib/reveal'
import Section, { type SectionTone } from '../../components/ui/Section'
import SectionHeader from '../../components/ui/SectionHeader'
import Card from '../../components/ui/Card'
import { FaqItem } from '../eco/EcoFaq'
import { ButtonLink } from '../../components/ui/Button'
import AppLink from '../../components/AppLink'
import Arrow from '../../components/ui/Arrow'
import { Icon, isIconName } from '../../demo-kit/ui/icons'
import { roleInitials } from '../../demo-kit/i18n/roles'
import { ContactButton, CtaBand, fill } from '../EcoParts'
import { MiniStill } from './MiniStage'
import { PR } from './strings'

export interface SecProps {
  p: ProductDef
  copy: ProductCopy | null
}

/**
 * Preload the sandbox on intent. registry.ts lives in the 43 KB `demo-core` chunk, so it is reached through import()
 * only (never statically from the product page: plan §5 first-load budget).
 */
export function warmDemo(slug: ProductDef['slug']): void {
  void import('../../demos/registry').then((m) => m.preloadDemo(slug)).catch(() => undefined)
}

/** Bi → text in the page language, with {region} / {name} filled. */
export function useTx(p: ProductDef): (b: Bi) => string {
  const { lang } = useEcoI18n()
  return (b) => fill(b[lang], { region: TOUR.regionName, name: p.name })
}

function Skeleton({ lines = 3, cards = 0 }: { lines?: number; cards?: number }) {
  const { eco: e } = useEcoI18n()
  return (
    <div className="pr-skel" role="status" aria-label={e.product.copyLoading}>
      {cards > 0 ? (
        <div className="pr-skel-cards">
          {Array.from({ length: cards }, (_, i) => (
            <span key={i} className="pr-skel-card" />
          ))}
        </div>
      ) : (
        Array.from({ length: lines }, (_, i) => <span key={i} className="pr-skel-line" />)
      )}
    </div>
  )
}

/** Section frame: home Section + header + reveal of the header and `[data-rv=card]` children. */
function Sec({
  sec,
  tone,
  eyebrow,
  title,
  lead,
  children,
  className = '',
  revealKey,
}: {
  sec: string
  tone: SectionTone
  eyebrow: string
  title: string
  lead?: string
  children: ReactNode
  className?: string
  revealKey: unknown
}) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(
    ref,
    (kit, root) => {
      kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
      kit.heading(root.querySelector('[data-rv="heading"]'))
      kit.fadeUp(root.querySelector('[data-rv="lead"]'))
      kit.cards(root.querySelectorAll('[data-rv="card"]'))
      kit.stroke(root.querySelectorAll('[data-pr-stroke]'), root.querySelector('.pr-steps'), { start: 'top 85%', end: 'bottom 60%' })
    },
    [revealKey],
  )
  const id = `pr-${sec}-title`
  return (
    <div ref={ref} data-sec={sec} className={`pr-sec pr-sec--${sec} ${className}`}>
      <Section id={`pr-${sec}`} tone={tone} labelledBy={id}>
        <SectionHeader eyebrow={eyebrow} title={title} titleId={id} lead={lead} />
        {children}
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ 2 · Masalah */
export function Problems({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  return (
    <Sec sec="problems" tone="ink" eyebrow={PR.eyebrows.problems[lang]} title={e.product.sections.problems} revealKey={!!copy}>
      {copy ? (
        <ul className="pr-cards pr-cards--3" role="list">
          {copy.problems.map((c, i) => (
            <Card as="li" key={i} className="pr-card">
              <span className="pr-card-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="pr-card-title">{tx(c.title)}</h3>
              <p className="pr-card-body">{tx(c.body)}</p>
            </Card>
          ))}
        </ul>
      ) : (
        <Skeleton cards={3} />
      )}
    </Sec>
  )
}

/* ------------------------------------------------------------------ 3 · Cara kerja */
export function Steps({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  return (
    <Sec sec="steps" tone="ink2" eyebrow={PR.eyebrows.steps[lang]} title={e.product.sections.steps} revealKey={!!copy}>
      {copy ? (
        <div className="pr-steps">
          <svg className="pr-steps-line" viewBox="0 0 1000 10" preserveAspectRatio="none" aria-hidden="true">
            <path data-pr-stroke d="M0 5H1000" />
          </svg>
          <svg className="pr-steps-vline" viewBox="0 0 10 1000" preserveAspectRatio="none" aria-hidden="true">
            <path data-pr-stroke d="M5 0V1000" />
          </svg>
          <ol className="pr-steps-list">
            {copy.steps.map((c, i) => (
              <li key={i} className="pr-step" data-rv="card">
                <span className="pr-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <p className="pr-step-k">{fill(PR.step[lang], { n: i + 1 })}</p>
                  <h3 className="pr-card-title">{tx(c.title)}</h3>
                  <p className="pr-card-body">{tx(c.body)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Skeleton cards={3} />
      )}
    </Sec>
  )
}

/* ------------------------------------------------------------------ 4 · Momen unggulan */
export function Highlights({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  return (
    <Sec sec="highlights" tone="indigo" eyebrow={PR.eyebrows.highlights[lang]} title={e.product.sections.highlights} revealKey={!!copy}>
      {copy ? (
        <ul className="pr-hls" role="list">
          {copy.highlights.map((h, i) => (
            <Card as="li" key={i} className="pr-hl" tilt={false}>
              <div className="pr-hl-art">
                {h.frame ? (
                  <MiniStill slug={p.slug} frame={h.frame} />
                ) : (
                  <span className="pr-hl-icon" aria-hidden="true">
                    {isIconName(p.icon) ? <Icon name={p.icon} size={40} /> : null}
                  </span>
                )}
              </div>
              <div className="pr-hl-text">
                {h.frame ? <p className="pr-hl-k">{PR.highlightStill[lang]}</p> : null}
                <h3 className="pr-card-title">{tx(h.title)}</h3>
                <p className="pr-card-body">{tx(h.body)}</p>
              </div>
            </Card>
          ))}
        </ul>
      ) : (
        <Skeleton cards={2} />
      )}
    </Sec>
  )
}

/* ------------------------------------------------------------------ 5 · Terhubung dengan */
/** node positions around the centre (percent of the graph box), for 1–6 related products */
function ring(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: 50 + 38 * Math.cos(a), y: 50 + 38 * Math.sin(a) }
  })
}

export function Related({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  const rel = p.related.slice(0, 6).map((s) => PRODUCT_BY_SLUG[s])
  const pos = ring(rel.length)
  const line = (r: ProductDef): string => tx(copy?.relations?.[r.slug] ?? r.tagline)
  return (
    <Sec
      sec="related"
      tone="ink"
      eyebrow={PR.eyebrows.related[lang]}
      title={e.product.sections.related}
      lead={fill(PR.relatedLead[lang], { name: p.name })}
      revealKey={!!copy}
    >
      <div className="pr-rel">
        <div className="pr-graph" aria-hidden="true">
          <svg className="pr-graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            {pos.map((q, i) => (
              <line key={i} x1="50" y1="50" x2={q.x} y2={q.y} data-eco={rel[i]?.eco} />
            ))}
          </svg>
          <span className="pr-graph-core" data-eco={p.eco}>
            {isIconName(p.icon) ? <Icon name={p.icon} size={30} /> : null}
            <span className="pr-graph-name">{p.name}</span>
          </span>
          {rel.map((r, i) => (
            <AppLink
              key={r.slug}
              to={`/produk/${r.slug}`}
              tabIndex={-1}
              className="pr-graph-node"
              data-eco={r.eco}
              style={{ left: `${pos[i]?.x}%`, top: `${pos[i]?.y}%` }}
              onPointerEnter={() => preloadCopy(r.slug)}
            >
              <span className="pr-graph-dot">{isIconName(r.icon) ? <Icon name={r.icon} size={22} /> : null}</span>
              <span className="pr-graph-name">{r.name}</span>
            </AppLink>
          ))}
        </div>
        <p className="sr-only">{fill(PR.graphSummary[lang], { name: p.name, list: rel.map((r) => r.name).join(', ') })}</p>
        <ul className="pr-rel-list" role="list">
          {rel.map((r) => (
            <Card as="li" key={r.slug} className="pr-rel-item">
              <AppLink to={`/produk/${r.slug}`} className="pr-rel-link" data-eco={r.eco} onPointerEnter={() => preloadCopy(r.slug)} onFocus={() => preloadCopy(r.slug)}>
                <span className="pr-rel-icon" aria-hidden="true">
                  {isIconName(r.icon) ? <Icon name={r.icon} size={20} /> : null}
                </span>
                <span className="pr-rel-text">
                  <span className="pr-rel-name">
                    {r.name}
                    <span className="pr-rel-eco">{ECOSYSTEMS[r.eco].name}</span>
                  </span>
                  <span className="pr-rel-line">{copy ? line(r) : r.tagline[lang]}</span>
                </span>
                <Arrow />
              </AppLink>
            </Card>
          ))}
        </ul>
      </div>
    </Sec>
  )
}

/* ------------------------------------------------------------------ 6 · Untuk siapa */
export function Roles({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  return (
    <Sec sec="roles" tone="ink2" eyebrow={PR.eyebrows.roles[lang]} title={e.product.sections.roles} lead={PR.rolesLead[lang]} revealKey={!!copy}>
      <ul className={`pr-cards pr-cards--${Math.min(p.roles.length, 3)}`} role="list">
        {p.roles.map((r) => (
          <Card as="li" key={r} className="pr-card pr-role">
            <span className="pr-role-ini" aria-hidden="true" data-eco={p.eco}>
              {roleInitials(r, lang)}
            </span>
            <h3 className="pr-card-title">
              {ROLES[r].name[lang]}
              {r === p.defaultRole ? <span className="pr-role-note">{PR.defaultRole[lang]}</span> : null}
            </h3>
            {copy ? <p className="pr-card-body">{copy.roles[r] ? tx(copy.roles[r]) : null}</p> : <Skeleton lines={2} />}
          </Card>
        ))}
      </ul>
    </Sec>
  )
}

/* ------------------------------------------------------------------ 7 · Keamanan & data */
export function Security({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const s = e.product.security
  const tx = useTx(p)
  const roles = p.roles.map((r) => ROLES[r].name[lang]).join(', ')
  const blocks: { icon: 'users' | 'doc' | 'shield'; title: string; body: string; link?: ReactNode }[] = [
    { icon: 'users', title: s.rolesTitle, body: fill(s.rolesBody, { roles }) },
    {
      icon: 'doc',
      title: s.auditTitle,
      body: s.auditBody,
      link: SITE_DEMO_READY.inti ? (
        <AppLink to="/demo/inti?tab=audit" className="pr-link">
          {s.auditCta}
          <Arrow />
        </AppLink>
      ) : null,
    },
    { icon: 'shield', title: s.serverTitle, body: s.serverBody },
  ]
  return (
    <Sec sec="security" tone="ink" eyebrow={PR.eyebrows.security[lang]} title={e.product.sections.security} lead={PR.securityLead[lang]} revealKey={!!copy}>
      <ul className="pr-cards pr-cards--3" role="list">
        {blocks.map((b) => (
          <Card as="li" key={b.icon} className="pr-card pr-sec-card">
            <span className="pr-sec-icon" aria-hidden="true">
              <Icon name={b.icon} size={22} />
            </span>
            <h3 className="pr-card-title">{b.title}</h3>
            <p className="pr-card-body">{b.body}</p>
            {b.link}
          </Card>
        ))}
      </ul>
      <div className="pr-datanote" data-rv="card">
        <Icon name="info" size={20} />
        <div>
          <h3 className="pr-datanote-title">{s.dataNoteTitle}</h3>
          {copy ? <p className="pr-card-body">{tx(copy.dataNote)}</p> : <Skeleton lines={2} />}
        </div>
      </div>
    </Sec>
  )
}

/* ------------------------------------------------------------------ 8 · FAQ */
export function Faq({ p, copy }: SecProps) {
  const { lang, eco: e } = useEcoI18n()
  const tx = useTx(p)
  return (
    <Sec sec="faq" tone="dawn" eyebrow={PR.eyebrows.faq[lang]} title={e.product.sections.faq} lead={PR.faqLead[lang]} className="pr-faq" revealKey={!!copy}>
      {copy ? (
        <div className="acc">
          {copy.faq.map((f, i) => (
            <FaqItem key={i} id={`faq-${p.slug}-${i + 1}`} q={tx(f.q)} a={tx(f.a)} />
          ))}
        </div>
      ) : (
        <Skeleton lines={5} />
      )}
    </Sec>
  )
}

/* ------------------------------------------------------------------ chapters + 9 · CTA band */
export function Chapters({ p }: { p: ProductDef }) {
  const { lang, eco: e } = useEcoI18n()
  if (p.chapters.length < 2) return null
  return (
    <Sec
      sec="chapters"
      tone="ink2"
      eyebrow={PR.eyebrows.chapters[lang]}
      title={e.product.sections.chapters}
      lead={fill(PR.chaptersLead[lang], { region: TOUR.regionName, name: p.name })}
      revealKey={lang}
    >
      <ol className="pr-chapters" role="list">
        {p.chapters.map((n) => {
          const ch = chapterByNumber(n)
          if (!ch) return null
          return (
            <li key={n} className="pr-chapter" data-rv="card">
              <span className="pr-chapter-time">{ch.time}</span>
              <div>
                <p className="pr-step-k">{fill(e.common.chapter, { n })}</p>
                <p className="pr-chapter-title">{ch.title[lang]}</p>
              </div>
              <AppLink to={`/tur/${n}`} className="pr-link">
                {fill(e.detail.flowOpen, { n })}
                <Arrow />
              </AppLink>
            </li>
          )
        })}
      </ol>
    </Sec>
  )
}

export function tourLabel(p: ProductDef, label: string): { to: string; text: string } | null {
  const n = p.chapters[0]
  const ch = n ? chapterByNumber(n) : undefined
  if (!n || !ch) return null
  return { to: `/tur/${n}`, text: fill(label, { n, time: ch.time ?? '' }) }
}

export function Cta({ p, tryLabel, wa }: { p: ProductDef; tryLabel: string; wa: string }) {
  const { eco: e } = useEcoI18n()
  const tour = tourLabel(p, e.product.seeInTourAt)
  return (
    <div data-sec="cta" className="pr-cta">
      <div className="pr-cta-inner">
        <CtaBand id="pr-cta-title" title={e.product.sections.cta} lead={e.product.contactLead}>
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
        </CtaBand>
      </div>
    </div>
  )
}
