/**
 * /ekosistem — hub of the GAMADA ecosystem (spec §4, §13). Tahap-1 functional version: hero, overview of the
 * 3 ecosystems + Inti (jump links), one section per ecosystem listing its products, tour CTA and WhatsApp CTA.
 * The constellation hero arrives in tahap 6.
 */
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, ECOSYSTEM_STATS, productsOf } from '../content/products'
import { TOUR, TOUR_CHAPTERS } from '../content/tour'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import { BodyHead, ContactButton, CtaBand, CtaRow, ECO_ORDER, ProductCard, fill } from './EcoParts'

export default function Ekosistem() {
  const { lang, eco: copy } = useEcoI18n()
  const h = copy.hub
  const c = copy.common
  const title = fill(h.title, { n: ECOSYSTEM_STATS.products })

  return (
    <PageShell
      eyebrow={h.eyebrow}
      title={title}
      lead={h.lead}
      docTitle={h.docTitle}
      actions={
        <CtaRow>
          <ButtonLink to="/tur" icon={<Icon name="play" size={18} />}>
            {c.startTour}
          </ButtonLink>
          <ContactButton text={h.waPrefill} />
        </CtaRow>
      }
    >
      <div className="eco-page">
        <nav className="eco-overview" aria-label={h.overviewLabel}>
          <ul>
            {ECO_ORDER.map((id) => {
              const e = ECOSYSTEMS[id]
              const n = productsOf(id).length
              return (
                <li key={id} data-eco={id}>
                  <AppLink to={`/ekosistem#${id}`} className="eco-ov-link">
                    <span className="eco-ov-aud">{e.audience[lang]}</span>
                    <span className="eco-ov-name">{e.name}</span>
                    <span className="eco-ov-count">{id === 'inti' ? c.foundation : fill(c.products, { n })}</span>
                  </AppLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {ECO_ORDER.map((id) => {
          const e = ECOSYSTEMS[id]
          const list = productsOf(id)
          return (
            <section key={id} id={id} className="eco-sec" data-eco={id} aria-labelledby={`eco-h-${id}`}>
              <BodyHead
                id={`eco-h-${id}`}
                eyebrow={e.audience[lang]}
                title={e.name}
                lead={e.tagline[lang]}
                aside={
                  <ButtonLink to={`/ekosistem/${id}`} variant="text">
                    {c.ecoPage}
                  </ButtonLink>
                }
              />
              <ul className={`eco-grid${list.length < 3 ? ' is-single' : ''}`}>
                {list.map((p) => (
                  <ProductCard key={p.slug} p={p} />
                ))}
              </ul>
            </section>
          )
        })}

        <CtaBand id="eco-tour" title={h.tourTitle} lead={fill(h.tourLead, { region: TOUR.regionName, n: ECOSYSTEM_STATS.products })}>
          <ButtonLink to="/tur" icon={<Icon name="play" size={18} />}>
            {c.startTour}
          </ButtonLink>
          <ButtonLink to={`/tur/${TOUR_CHAPTERS[0]?.n ?? 1}`} variant="ghost">
            {fill(c.chapter, { n: 1 })} · {TOUR.start}
          </ButtonLink>
        </CtaBand>

        <CtaBand id="eco-contact" title={h.contactTitle} lead={h.contactLead}>
          <ContactButton text={h.waPrefill} />
        </CtaBand>
      </div>
    </PageShell>
  )
}
