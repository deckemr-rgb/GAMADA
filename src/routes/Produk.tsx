/**
 * /produk/:slug — product page (17 products + inti; unknown ⇒ 404). Tahap-1 functional version: full name, eco
 * badge, tagline, roles, demo facts and honest status, related products, tour chapters and the three CTAs
 * ("Coba demo penuh" → /demo/<slug>, "Lihat di tur" → /tur/<first chapter>, "Hubungi kami" → WhatsApp).
 * Merged legacy products keep an anchor: #kasir (KasirKu → Toko Autopilot), #analisis (ScrapPulse → Radar Isu).
 */
import { useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, PRODUCT_BY_SLUG, ROLES, fullName, isProductSlug, type ProductSlug } from '../content/products'
import { chapterByNumber, firstChapterOf } from '../content/tour'
import { DEMO_READY, DEMO_STAGE, preloadDemo } from '../demos/registry'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import NotFound from './NotFound'
import { BodyHead, ContactButton, CtaBand, CtaRow, EcoBadge, ProductCard, fill } from './EcoParts'
import Arrow from '../components/ui/Arrow'
import { roleInitials } from '../demo-kit/i18n/roles'

/** Legacy products folded into an ecosystem product: anchor id + copy key (spec §2.1). */
const MERGED: Partial<Record<ProductSlug, 'kasir' | 'analisis'>> = {
  'toko-autopilot': 'kasir',
  'radar-isu': 'analisis',
}

export default function Produk() {
  const { lang, eco: copy } = useEcoI18n()
  const { slug } = useParams()
  if (!isProductSlug(slug)) return <NotFound />

  const c = copy.common
  const s = copy.product
  const p = PRODUCT_BY_SLUG[slug]
  const eco = ECOSYSTEMS[p.eco]
  const name = fullName(p, lang)
  const stage = DEMO_STAGE[p.eco]
  /** honest CTA: until the sandbox is registered, /demo/:slug is the tahap-1 plan panel */
  const tryLabel = DEMO_READY[slug] ? c.tryDemo : c.demoPlan
  const first = firstChapterOf(slug)
  const merged = MERGED[slug]
  const wa = fill(c.waPrefill, { name })

  return (
    <PageShell
      eyebrow={`${eco.name} · ${p.code}`}
      title={name}
      lead={p.tagline[lang]}
      docTitle={fill(s.docTitle, { name })}
      heroExtra={
        <nav className="eco-crumbs" aria-label={c.breadcrumb}>
          <AppLink to="/ekosistem">{c.ecosystem}</AppLink>
          <span aria-hidden="true">/</span>
          <AppLink to={`/ekosistem/${p.eco}`} className="eco-crumb-badge">
            <EcoBadge eco={p.eco} />
          </AppLink>
        </nav>
      }
      actions={
        <CtaRow>
          <span onPointerEnter={() => preloadDemo(slug)} onFocus={() => preloadDemo(slug)} className="eco-cta-wrap">
            <ButtonLink to={`/demo/${slug}`} icon={<Icon name="play" size={18} />}>
              {tryLabel}
            </ButtonLink>
          </span>
          {first ? (
            <ButtonLink to={`/tur/${first}`} variant="ghost">
              {c.seeInTour}
            </ButtonLink>
          ) : null}
          <ContactButton text={wa} />
        </CtaRow>
      }
    >
      <div className="eco-page" data-eco={p.eco}>
        <div className="eco-split">
          <section className="eco-panel" aria-labelledby="pr-roles">
            <h2 id="pr-roles" className="eco-h3">
              {s.rolesTitle}
            </h2>
            <p className="eco-muted">{s.rolesLead}</p>
            <ul className="eco-roles">
              {p.roles.map((r) => (
                <li key={r}>
                  <span className="eco-role-ini" aria-hidden="true">
                    {roleInitials(r, lang)}
                  </span>
                  <span>
                    {ROLES[r].name[lang]}
                    {r === p.defaultRole ? <span className="eco-role-note">{s.defaultRole}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="eco-panel" aria-labelledby="pr-demo">
            <h2 id="pr-demo" className="eco-h3">
              {s.demoTitle}
            </h2>
            <dl className="eco-facts">
              <div>
                <dt>{s.demoFrame}</dt>
                <dd>{c.frames[p.frame]}</dd>
              </div>
              {p.map || p.chat ? (
                <div>
                  <dt>{s.demoFeatures}</dt>
                  <dd>{[p.map ? c.map : null, p.chat ? c.chat : null].filter(Boolean).join(' · ')}</dd>
                </div>
              ) : null}
              <div>
                <dt>{s.demoStatus}</dt>
                <dd>
                  {DEMO_READY[slug] ? (
                    <>
                      <span className="eco-status is-live">{s.statusReady}</span> {fill(s.statusReadyBody, { name: p.name })}
                    </>
                  ) : (
                    <>
                      <span className="eco-status">{fill(c.stageShort, { n: stage })}</span> {fill(s.statusBody, { name: p.name, n: stage })}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {merged ? (
          <section id={merged} className="eco-merged" aria-labelledby={`pr-merged-${merged}`}>
            <Icon name="layers" size={22} />
            <div>
              <h2 id={`pr-merged-${merged}`} className="eco-h3">
                {s.merged[merged].title}
              </h2>
              <p>{s.merged[merged].body}</p>
            </div>
          </section>
        ) : null}

        <section className="eco-sec" aria-labelledby="pr-related">
          <BodyHead id="pr-related" title={s.relatedTitle} lead={fill(s.relatedLead, { name: p.name })} />
          <ul className="eco-grid is-dense">
            {p.related.map((r) => (
              <ProductCard key={r} p={PRODUCT_BY_SLUG[r]} compact />
            ))}
          </ul>
        </section>

        {p.chapters.length > 0 ? (
          <section className="eco-sec" aria-labelledby="pr-tour">
            <BodyHead id="pr-tour" title={s.tourTitle} />
            <ol className="eco-flow">
              {p.chapters.map((n) => {
                const ch = chapterByNumber(n)
                if (!ch) return null
                return (
                  <li key={n} className="eco-flow-step">
                    <span className="eco-flow-time">{ch.time}</span>
                    <div className="eco-flow-body">
                      <p className="eco-flow-k">{fill(c.chapter, { n })}</p>
                      <p className="eco-flow-title">{ch.title[lang]}</p>
                    </div>
                    <AppLink to={`/tur/${n}`} className="eco-flow-open">
                      {fill(copy.detail.flowOpen, { n })}
                      <Arrow />
                    </AppLink>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : null}

        <CtaBand id="pr-contact" title={s.contactTitle} lead={s.contactLead}>
          <ButtonLink to={`/demo/${slug}`} icon={<Icon name="play" size={18} />}>
            {tryLabel}
          </ButtonLink>
          <ContactButton text={wa} />
        </CtaBand>
      </div>
    </PageShell>
  )
}
