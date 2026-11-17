/**
 * /ekosistem/:eco — one ecosystem (satu-daerah, usaha-pintar, pasar-daerah, inti; unknown ⇒ 404).
 * Tahap-1 functional version: story line (products.ts), product cards, the inter-product flow as an ordered
 * list of tour chapters, cross-ecosystem links, "Mulai tur dari bab X" and WhatsApp.
 */
import { useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, PRODUCTS, PRODUCT_BY_SLUG, productsOf, type EcoOrInti, type ProductSlug } from '../content/products'
import { TOUR, chaptersOfEco } from '../content/tour'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import NotFound from './NotFound'
import { BodyHead, ContactButton, CtaBand, CtaRow, ECO_ORDER, EcoBadge, ProductCard, fill } from './EcoParts'
import Arrow from '../components/ui/Arrow'

const isEco = (s: string | undefined): s is EcoOrInti => !!s && s in ECOSYSTEMS

export default function EkosistemDetail() {
  const { lang, eco: copy } = useEcoI18n()
  const { eco } = useParams()
  if (!isEco(eco)) return <NotFound />

  const c = copy.common
  const d = copy.detail
  const e = ECOSYSTEMS[eco]
  // Inti has one product (itself): its page lists the products that share it instead
  const list = eco === 'inti' ? PRODUCTS.filter((p) => p.slug !== 'inti') : productsOf(eco)
  const flow = chaptersOfEco(eco)
  const firstChapter = flow[0]?.n
  const own = new Set<ProductSlug>(productsOf(eco).map((p) => p.slug))
  const outside = eco === 'inti' ? [] : [...new Set(productsOf(eco).flatMap((p) => p.related))].filter((s) => !own.has(s)).map((s) => PRODUCT_BY_SLUG[s])
  const wa = fill(c.waPrefill, { name: e.name })

  return (
    <PageShell
      eyebrow={e.audience[lang]}
      title={e.name}
      lead={e.tagline[lang]}
      docTitle={fill(d.docTitle, { name: e.name })}
      heroExtra={
        <nav className="eco-crumbs" aria-label={c.breadcrumb}>
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
    >
      <div className="eco-page" data-eco={eco}>
        <section className="eco-sec" aria-labelledby="eco-products">
          <BodyHead id="eco-products" title={eco === 'inti' ? d.intiProductsTitle : d.productsTitle} />
          <ul className={`eco-grid${eco === 'inti' ? ' is-dense' : ''}`}>
            {list.map((p) => (
              <ProductCard key={p.slug} p={p} compact={eco === 'inti'} />
            ))}
          </ul>
        </section>

        {flow.length > 0 ? (
          <section className="eco-sec" aria-labelledby="eco-flow">
            <BodyHead id="eco-flow" title={d.flowTitle} lead={fill(d.flowLead, { region: TOUR.regionName })} />
            <ol className="eco-flow">
              {flow.map((ch) => (
                <li key={ch.n} className="eco-flow-step">
                  <span className="eco-flow-time">{ch.time}</span>
                  <div className="eco-flow-body">
                    <p className="eco-flow-k">{fill(c.chapter, { n: ch.n })}</p>
                    <p className="eco-flow-title">{ch.title[lang]}</p>
                    <ul className="eco-chips">
                      {ch.products.map((s) => {
                        const p = PRODUCT_BY_SLUG[s]
                        return (
                          <li key={s} data-eco={p.eco}>
                            <AppLink to={`/produk/${s}`} className="eco-chip">
                              <Icon name={p.icon} size={16} />
                              {p.name}
                            </AppLink>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <AppLink to={`/tur/${ch.n}`} className="eco-flow-open">
                    {fill(d.flowOpen, { n: ch.n })}
                    <Arrow />
                  </AppLink>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {outside.length > 0 ? (
          <section className="eco-sec" aria-labelledby="eco-outside">
            <BodyHead id="eco-outside" title={d.connectsTitle} lead={d.connectsLead} />
            <ul className="eco-chips is-roomy">
              {outside.map((p) => (
                <li key={p.slug} data-eco={p.eco}>
                  <AppLink to={`/produk/${p.slug}`} className="eco-chip">
                    <Icon name={p.icon} size={16} />
                    {p.name}
                    <span className="eco-chip-sub">{ECOSYSTEMS[p.eco].name}</span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="eco-sec" aria-labelledby="eco-others">
          <BodyHead id="eco-others" title={d.othersTitle} />
          <ul className="eco-others">
            {ECO_ORDER.filter((o) => o !== eco).map((o) => (
              <li key={o}>
                <AppLink to={`/ekosistem/${o}`} className="eco-other">
                  <EcoBadge eco={o} />
                  <span className="eco-other-tag">{ECOSYSTEMS[o].tagline[lang]}</span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand id="eco-contact" title={fill(d.contactTitle, { name: e.name })} lead={copy.hub.contactLead}>
          <ContactButton text={wa} />
          <ButtonLink to="/lab" variant="ghost">
            {c.allDemos}
          </ButtonLink>
        </CtaBand>
      </div>
    </PageShell>
  )
}
