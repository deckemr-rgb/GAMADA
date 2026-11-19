/**
 * /ekosistem — hub of the GAMADA ecosystem (spec §13, plan §2.1):
 *  1. hero = constellation (routes/eco/Constellation.tsx) with "Mulai tur" + "Jelajahi produk"
 *  2. "Tiga ekosistem" (#produk): 3 panels (ids #satu-daerah, #usaha-pintar, #pasar-daerah) + the Inti band (#inti)
 *  3. "Bagaimana semuanya terhubung" (#alur): the flood example as a scroll-driven FlowDiagram → /tur/2
 *  4. tour CTA band · 5. FAQ ekosistem (claim-free) · 6. WhatsApp band
 * Names / counts from products.ts + tour.ts, words from eco.ts (hub) and content/ecoPages.ts (EN lazy).
 */
import { useRef } from 'react'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, ECOSYSTEM_STATS, PRODUCT_BY_SLUG, productsOf, type EcoId } from '../content/products'
import { TOUR, TOUR_CHAPTERS, chapterByNumber } from '../content/tour'
import { HUB_FLOW, HUB_FLOW_CHAPTER, useEcoPages, type EcoPagesCopy } from '../content/ecoPages'
import { useReveal } from '../lib/reveal'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import { ContactButton, CtaBand, CtaRow, fill } from './EcoParts'
import { CheckGlyph, EcoHero, ProductChips, productHref } from './eco/parts'
import Constellation from './eco/Constellation'
import FlowDiagram, { type FlowStep } from './eco/FlowDiagram'
import EcoFaq from './eco/EcoFaq'

const ECOS: readonly EcoId[] = ['satu-daerah', 'usaha-pintar', 'pasar-daerah']

export default function Ekosistem() {
  const { lang, eco: copy } = useEcoI18n()
  const P = useEcoPages(lang)
  const h = copy.hub
  const c = copy.common

  return (
    <>
      <EcoHero
        eyebrow={h.eyebrow}
        title={fill(h.title, { n: ECOSYSTEM_STATS.products })}
        lead={h.lead}
        docTitle={h.docTitle}
        actions={
          <CtaRow>
            <ButtonLink to="/tur" icon={<Icon name="play" size={18} />}>
              {c.startTour}
            </ButtonLink>
            {P ? (
              <ButtonLink to="/ekosistem#produk" variant="ghost">
                {P.hub.exploreProducts}
              </ButtonLink>
            ) : null}
          </CtaRow>
        }
        visual={P ? <Constellation P={P.constellation} /> : <div className="cst-placeholder" aria-hidden="true" />}
      />
      {P ? (
        <div className="es-page">
          <Panels P={P} />
          <Flow P={P} />
          <Section tone="ink" className="es-band-sec">
            <CtaBand id="eco-tour" title={fill(copy.tour.title, { region: TOUR.regionName })} lead={fill(P.hub.tour.lead, { m: TOUR.minutes, region: TOUR.regionName, start: TOUR.start, n: ECOSYSTEM_STATS.products })}>
              <ButtonLink to="/tur" icon={<Icon name="play" size={18} />}>
                {c.startTour}
              </ButtonLink>
              <ButtonLink to="/tur" variant="ghost">
                {P.hub.tour.pick}
              </ButtonLink>
            </CtaBand>
          </Section>
          <EcoFaq F={P.hub.faq} />
          <Section tone="ink" className="es-band-sec">
            <CtaBand id="eco-contact" title={h.contactTitle} lead={h.contactLead}>
              <ContactButton text={h.waPrefill} />
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

function Panels({ P }: { P: EcoPagesCopy }) {
  const { lang, eco: copy } = useEcoI18n()
  const ref = useRef<HTMLDivElement>(null)
  const T = P.hub.panels
  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"]'))
    kit.cards(root.querySelectorAll('[data-rv="card"]'))
  })
  const inti = ECOSYSTEMS.inti
  return (
    <Section id="produk" tone="ink" labelledBy="es-panels-title" ambient>
      <div ref={ref}>
        <SectionHeader eyebrow={T.eyebrow} title={T.title} titleId="es-panels-title" lead={T.lead} />
        <ul className="es-panels">
          {ECOS.map((id) => {
            const e = ECOSYSTEMS[id]
            const W = P.ecos[id]
            const list = productsOf(id)
            return (
              <li key={id} id={id} className="es-panel-li">
                <Card as="div" className="es-panel">
                  <div className="es-panel-in" data-eco={id}>
                    <p className="es-panel-aud">
                      <span className="es-dot" aria-hidden="true" />
                      {e.audience[lang]}
                    </p>
                    <h3 className="es-panel-name">{e.name}</h3>
                    <p className="es-panel-story">{W.short}</p>
                    <p className="sr-only">{T.benefitsLabel}</p>
                    <ul className="es-benefits">
                      {W.benefits.map((b) => (
                        <li key={b}>
                          <CheckGlyph />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p className="es-panel-k">
                      {T.productsLabel} · {fill(copy.common.products, { n: list.length })}
                    </p>
                    <ProductChips slugs={list.map((p) => p.slug)} />
                    <div className="es-panel-cta">
                      <ButtonLink to={`/ekosistem/${id}`} variant="text" ariaLabel={`${copy.common.ecoPage}: ${e.name}`}>
                        {copy.common.ecoPage}
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
        <div id="inti" className="es-inti-band" data-eco="inti" data-rv="card">
          <span className="es-inti-star" aria-hidden="true">
            <Icon name={PRODUCT_BY_SLUG.inti.icon} size={26} />
          </span>
          <div className="es-inti-text">
            <p className="es-panel-aud">{T.intiTitle}</p>
            <h3 className="es-panel-name">{inti.name}</h3>
            <p className="es-panel-story">{P.inti.short}</p>
          </div>
          <ButtonLink to={productHref('inti')} variant="text" ariaLabel={`${copy.common.ecoPage}: ${inti.name}`}>
            {copy.common.ecoPage}
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}

function Flow({ P }: { P: EcoPagesCopy }) {
  const { eco: copy } = useEcoI18n()
  const ref = useRef<HTMLDivElement>(null)
  const F = P.hub.flow
  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .es-flow-cta'))
  })
  const steps: FlowStep[] = HUB_FLOW.map((s, i) => {
    const p = PRODUCT_BY_SLUG[s.slug]
    return {
      key: s.slug,
      time: chapterByNumber(s.ch)?.time ?? null,
      kicker: fill(copy.common.chapter, { n: s.ch }),
      title: p.name,
      body: F.steps[i],
      products: [],
      slug: s.slug,
      link: { to: productHref(s.slug), label: fill(copy.karya.see, { name: p.name }) },
    }
  })
  const ch = chapterByNumber(HUB_FLOW_CHAPTER) ?? TOUR_CHAPTERS[0]
  return (
    <Section id="alur" tone="ink2" labelledBy="es-flow-title" className="es-flow-sec">
      <div ref={ref}>
        <SectionHeader eyebrow={F.eyebrow} title={F.title} titleId="es-flow-title" lead={fill(F.lead, { region: TOUR.regionName })} />
        <FlowDiagram steps={steps} label={F.listLabel} scrub />
        <div className="es-flow-cta">
          <ButtonLink to={`/tur/${ch?.n ?? HUB_FLOW_CHAPTER}`} icon={<Icon name="play" size={18} />}>
            {fill(F.cta, { n: ch?.n ?? HUB_FLOW_CHAPTER })}
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}
