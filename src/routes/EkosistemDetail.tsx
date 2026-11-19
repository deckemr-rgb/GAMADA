/**
 * /ekosistem/:eco — one ecosystem (satu-daerah, usaha-pintar, pasar-daerah, inti; unknown ⇒ 404), plan §2.2:
 * hero (crumbs, audience, name, tagline, static cluster glyph, "Mulai tur dari bab X" + "Hubungi kami"), then
 *  1. Cerita (3 paragraphs) · 2. Alur antarproduk (FlowDiagram of chaptersOfEco, each step → /tur/<n>)
 *  3. Produk (home Card tiles, "Buka demo" when READY) · 4. Untuk siapa (buyer types × benefit × products)
 *  5. Terhubung ke luar ekosistem · Ekosistem lain · CTA band.
 * Inti variant: Cerita "satu akun, satu data, satu jejak", the 4 Inti modules + "Lihat jejak data" (/demo/inti,
 * /tur/19), all 17 products (compact), "Yang didapat setiap produk" instead of "Untuk siapa"; no flow diagram.
 */
import { useRef, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, PRODUCTS, PRODUCT_BY_SLUG, productsOf, type EcoOrInti, type ProductSlug } from '../content/products'
import { TOUR, chaptersOfEco } from '../content/tour'
import { BUYER_PRODUCTS, INTI_MODULE_ICONS, useEcoPages, type EcoPagesCopy } from '../content/ecoPages'
import { SITE_DEMO_READY as DEMO_READY } from './eco/ready'
import { useReveal } from '../lib/reveal'
import Section, { type SectionTone } from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import AppLink from '../components/AppLink'
import Arrow from '../components/ui/Arrow'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import NotFound from './NotFound'
import { ContactButton, CtaBand, CtaRow, ECO_ORDER, EcoBadge, fill } from './EcoParts'
import { CheckGlyph, EcoHero, ProductChip, ProductChips, ProductTile } from './eco/parts'
import { ConstellationGlyph } from './eco/Constellation'
import FlowDiagram, { type FlowStep } from './eco/FlowDiagram'

const isEco = (s: string | undefined): s is EcoOrInti => !!s && s in ECOSYSTEMS
const INTI_CHAPTER = PRODUCT_BY_SLUG.inti.chapters[0] ?? 19

export default function EkosistemDetail() {
  const { lang, eco: copy } = useEcoI18n()
  const { eco } = useParams()
  const P = useEcoPages(lang)
  if (!isEco(eco)) return <NotFound />

  const c = copy.common
  const d = copy.detail
  const e = ECOSYSTEMS[eco]
  const flow = chaptersOfEco(eco)
  const firstChapter = flow[0]?.n
  const wa = fill(c.waPrefill, { name: e.name })

  return (
    <>
      <EcoHero
        layout="split"
        eyebrow={e.audience[lang]}
        title={e.name}
        lead={e.tagline[lang]}
        docTitle={fill(d.docTitle, { name: e.name })}
        top={
          <nav className="eco-crumbs es-crumbs" aria-label={c.breadcrumb}>
            <AppLink to="/ekosistem">
              <Arrow dir="back" />
              {c.allEcos}
            </AppLink>
          </nav>
        }
        actions={
          <CtaRow>
            {firstChapter ? (
              <ButtonLink to={`/tur/${firstChapter}`} icon={<Icon name="play" size={18} />}>
                {fill(c.startTourAt, { n: firstChapter })}
              </ButtonLink>
            ) : null}
            <ContactButton text={wa} />
          </CtaRow>
        }
        visual={<ConstellationGlyph eco={eco} />}
      />
      {P ? (
        <div className="es-page" data-eco={eco} key={eco}>
          {eco === 'inti' ? <IntiBody P={P} /> : <EcoBody eco={eco} P={P} />}
          <Section tone="ink" className="es-band-sec">
            <CtaBand id="eco-contact" title={fill(d.contactTitle, { name: e.name })} lead={copy.hub.contactLead}>
              <ContactButton text={wa} />
              <ButtonLink to="/lab" variant="ghost">
                {c.allDemos}
              </ButtonLink>
            </CtaBand>
          </Section>
        </div>
      ) : null}
    </>
  )
}

/** A home-style section with the reveal kit wired (eyebrow, split heading, lead, cards). */
function Block({ id, tone = 'ink', eyebrow, title, lead, children, className = '' }: { id: string; tone?: SectionTone; eyebrow?: string; title: string; lead?: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], [data-rv="fade"]'))
    kit.cards(root.querySelectorAll('[data-rv="card"]'))
  })
  return (
    <Section id={id} tone={tone} labelledBy={`${id}-title`} className={className}>
      <div ref={ref}>
        <SectionHeader eyebrow={eyebrow} title={title} titleId={`${id}-title`} lead={lead} />
        {children}
      </div>
    </Section>
  )
}

function Story({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <ol className="es-story">
      {paragraphs.map((p, i) => (
        <li key={i} data-rv="fade">
          <span className="es-story-n" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <p>{p}</p>
        </li>
      ))}
    </ol>
  )
}

function EcoBody({ eco, P }: { eco: Exclude<EcoOrInti, 'inti'>; P: EcoPagesCopy }) {
  const { lang, eco: copy } = useEcoI18n()
  const c = copy.common
  const d = copy.detail
  const D = P.detail
  const W = P.ecos[eco]
  const flow = chaptersOfEco(eco)
  const own = new Set<ProductSlug>(productsOf(eco).map((p) => p.slug))
  const outside = [...new Set(productsOf(eco).flatMap((p) => p.related))].filter((s) => !own.has(s))
  const steps: FlowStep[] = flow.map((ch) => ({
    key: String(ch.n),
    time: ch.time,
    kicker: fill(c.chapter, { n: ch.n }),
    title: ch.title[lang],
    products: ch.products,
    link: { to: `/tur/${ch.n}`, label: fill(D.play, { n: ch.n }) },
  }))

  return (
    <>
      <Block id="cerita" eyebrow={D.storyEyebrow} title={D.storyTitle}>
        <Story paragraphs={W.story} />
      </Block>
      {steps.length ? (
        <Block id="alur" tone="ink2" eyebrow={D.flowEyebrow} title={d.flowTitle} lead={fill(D.flowLead, { region: TOUR.regionName })}>
          <FlowDiagram steps={steps} label={d.flowTitle} />
        </Block>
      ) : null}
      <Block id="produk" eyebrow={D.productsEyebrow} title={d.productsTitle}>
        <ul className="es-tiles">
          {productsOf(eco).map((p) => (
            <ProductTile key={p.slug} p={p} />
          ))}
        </ul>
      </Block>
      <Block id="untuk-siapa" tone="ink2" eyebrow={D.buyersEyebrow} title={D.buyersTitle} lead={D.buyersLead}>
        <ul className="es-buyers">
          {W.buyers.map((b, i) => (
            <Card key={b.who} as="li" className="es-buyer">
              <div className="es-buyer-in" data-eco={eco}>
                <h3 className="es-buyer-who">{b.who}</h3>
                <p className="es-buyer-benefit">
                  <CheckGlyph />
                  {b.benefit}
                </p>
                <ProductChips slugs={BUYER_PRODUCTS[eco][i] ?? []} className="is-small" />
              </div>
            </Card>
          ))}
        </ul>
      </Block>
      {outside.length ? (
        <Block id="lintas" eyebrow={D.connectsEyebrow} title={d.connectsTitle} lead={d.connectsLead}>
          <ul className="es-chips is-roomy" data-rv="fade">
            {outside.map((s) => (
              <ProductChip key={s} slug={s} sub={ECOSYSTEMS[PRODUCT_BY_SLUG[s].eco].name} />
            ))}
          </ul>
        </Block>
      ) : null}
      <Others eco={eco} P={P} />
    </>
  )
}

function IntiBody({ P }: { P: EcoPagesCopy }) {
  const { lang, eco: copy } = useEcoI18n()
  const c = copy.common
  const d = copy.detail
  const I = P.inti
  const D = P.detail
  return (
    <>
      <Block id="cerita" eyebrow={D.storyEyebrow} title={ECOSYSTEMS.inti.tagline[lang]}>
        <Story paragraphs={I.story} />
      </Block>
      <Block id="modul" tone="ink2" eyebrow={ECOSYSTEMS.inti.name} title={I.modulesTitle} lead={I.modulesLead}>
        <ul className="es-modules">
          {I.modules.map((m, i) => (
            <Card key={m.name} as="li" className="es-module">
              <div className="es-module-in" data-eco="inti">
                <span className="es-module-art" aria-hidden="true">
                  <svg viewBox="0 0 120 64" className="es-module-svg">
                    <circle cx="60" cy="32" r="7" />
                    {[0, 1, 2, 3, 4, 5].slice(0, 3 + i).map((k) => {
                      const a = (k / (3 + i)) * Math.PI * 2 - Math.PI / 2
                      const x = 60 + Math.cos(a) * 44
                      const y = 32 + Math.sin(a) * 22
                      return (
                        <g key={k}>
                          <line x1="60" y1="32" x2={x} y2={y} />
                          <circle cx={x} cy={y} r="3.5" />
                        </g>
                      )
                    })}
                  </svg>
                  <span className="es-module-icon">
                    <Icon name={INTI_MODULE_ICONS[i] ?? 'inti'} size={22} />
                  </span>
                </span>
                <h3 className="es-module-name">{m.name}</h3>
                <p className="es-module-body">{m.body}</p>
              </div>
            </Card>
          ))}
        </ul>
        <div className="es-actions" data-rv="fade">
          {DEMO_READY.inti ? (
            <ButtonLink to="/demo/inti" icon={<Icon name="layers" size={18} />}>
              {I.trail}
            </ButtonLink>
          ) : null}
          <ButtonLink to={`/tur/${INTI_CHAPTER}`} variant="ghost" icon={<Icon name="play" size={18} />}>
            {fill(I.trailTour, { n: INTI_CHAPTER })}
          </ButtonLink>
        </div>
      </Block>
      <Block id="produk" eyebrow={D.productsEyebrow} title={d.intiProductsTitle}>
        <ul className="es-tiles is-dense">
          {PRODUCTS.filter((p) => p.slug !== 'inti').map((p) => (
            <ProductTile key={p.slug} p={p} compact />
          ))}
        </ul>
      </Block>
      <Block id="didapat" tone="ink2" eyebrow={c.foundation} title={I.getsTitle} lead={I.getsLead}>
        <ul className="es-gets">
          {I.gets.map((g) => (
            <li key={g.title} data-rv="card">
              <CheckGlyph />
              <span>
                <strong>{g.title}</strong>
                {g.body}
              </span>
            </li>
          ))}
        </ul>
      </Block>
      <Others eco="inti" P={P} />
    </>
  )
}

function Others({ eco, P }: { eco: EcoOrInti; P: EcoPagesCopy }) {
  const { lang, eco: copy } = useEcoI18n()
  return (
    <Block id="lainnya" eyebrow={P.detail.othersEyebrow} title={copy.detail.othersTitle}>
      <ul className="es-others">
        {ECO_ORDER.filter((o) => o !== eco).map((o) => (
          <Card key={o} as="li" className="es-other">
            <AppLink to={`/ekosistem/${o}`} className="es-other-link" data-eco={o}>
              <EcoBadge eco={o} />
              <span className="es-other-tag">{ECOSYSTEMS[o].tagline[lang]}</span>
              <span className="es-other-more">
                {copy.common.ecoPage}
                <Arrow />
              </span>
            </AppLink>
          </Card>
        ))}
      </ul>
    </Block>
  )
}
