/**
 * /tur and /tur/:bab — tour "Satu Hari di [DAERAH_1]". Tahap-1 placeholder: the 20-chapter list (content/tour.ts)
 * with a note that the cinematic player arrives in tahap 5. /tur/:bab highlights that chapter (with prev/next);
 * an unknown chapter redirects to /tur.
 */
import { Navigate, useLocation, useParams } from 'react-router'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEM_STATS, PRODUCT_BY_SLUG } from '../content/products'
import { TOUR, TOUR_CHAPTERS, chapterByNumber, parseChapter, type TourChapter } from '../content/tour'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../demo-kit/ui/icons'
import { DEMO_READY } from '../demos/registry'
import { ContactButton, CtaRow, fill } from './EcoParts'
import Arrow from '../components/ui/Arrow'

export default function Tur() {
  const { lang, eco: copy } = useEcoI18n()
  const { bab } = useParams()
  const { search } = useLocation()
  const selected = parseChapter(bab)
  if (bab !== undefined && !selected) return <Navigate to={`/tur${search}`} replace />

  const s = copy.tour
  const c = copy.common
  const title = fill(s.title, { region: TOUR.regionName })
  const lead = fill(s.lead, { n: TOUR_CHAPTERS.length, m: TOUR.minutes, start: TOUR.start, p: ECOSYSTEM_STATS.products })
  const day = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${TOUR.day}T12:00:00`),
  )
  const docTitle = selected ? fill(s.docTitleChapter, { n: selected.n, title: selected.title[lang] }) : `${title} — GAMADA`

  return (
    <PageShell eyebrow={s.eyebrow} title={title} lead={lead} docTitle={docTitle}>
      <div className="eco-page">
        <div className="eco-stack">
          <div className="eco-note" role="note">
            <Icon name="info" size={20} />
            <p>{s.note}</p>
          </div>
          <p className="eco-day">
            <span className="eco-muted">{s.dayLabel}:</span> {day} · {TOUR.regionName}
          </p>
        </div>

        {selected ? <Selected ch={selected} /> : null}

        <section className="eco-sec" aria-labelledby="tour-list">
          <h2 id="tour-list" className="eco-h2">
            {s.listTitle}
          </h2>
          <ol className="eco-chapters">
            {TOUR_CHAPTERS.map((ch) => {
              const isSel = selected?.n === ch.n
              return (
                <li key={ch.n} id={`bab-${ch.n}`} className={`eco-chapter${isSel ? ' is-selected' : ''}`} aria-current={isSel ? 'step' : undefined}>
                  <span className="eco-chapter-n" aria-hidden="true">
                    {String(ch.n).padStart(2, '0')}
                  </span>
                  <span className="eco-chapter-time">{ch.time ?? s.summary}</span>
                  <div className="eco-chapter-body">
                    <AppLink to={`/tur/${ch.n}`} className="eco-chapter-link">
                      <span className="sr-only">{fill(c.chapter, { n: ch.n })}: </span>
                      {ch.title[lang]}
                      {isSel ? <span className="sr-only"> {s.current}</span> : null}
                    </AppLink>
                    {ch.products.length > 0 ? (
                      <ul className="eco-chips">
                        {ch.products.map((slug) => {
                          const p = PRODUCT_BY_SLUG[slug]
                          return (
                            <li key={slug} data-eco={p.eco}>
                              <AppLink to={`/produk/${slug}`} className="eco-chip">
                                <Icon name={p.icon} size={16} />
                                {p.name}
                              </AppLink>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <CtaRow>
          <ButtonLink to="/ekosistem" variant="ghost">
            {c.allEcos}
          </ButtonLink>
          <ButtonLink to="/lab" variant="ghost">
            {c.allDemos}
          </ButtonLink>
          <ContactButton text={fill(c.waPrefill, { name: title })} />
        </CtaRow>
      </div>
    </PageShell>
  )
}

function Selected({ ch }: { ch: TourChapter }) {
  const { lang, eco: copy } = useEcoI18n()
  const s = copy.tour
  const c = copy.common
  const prev = chapterByNumber(ch.n - 1)
  const next = chapterByNumber(ch.n + 1)
  return (
    <section className="eco-selected" aria-labelledby="tour-selected">
      <p className="eco-eyebrow">
        {s.selectedLabel} · {fill(c.chapter, { n: ch.n })} · {ch.time ?? s.summary}
      </p>
      <h2 id="tour-selected" className="eco-h2">
        {ch.title[lang]}
      </h2>
      {ch.products.length > 0 ? (
        <CtaRow>
          {ch.products.map((slug) => (
            <ButtonLink key={slug} to={`/demo/${slug}`} variant="ghost" icon={<Icon name={PRODUCT_BY_SLUG[slug].icon} size={18} />}>
              {DEMO_READY[slug] ? `${c.openDemo} ${PRODUCT_BY_SLUG[slug].name}` : fill(c.demoPlanOf, { name: PRODUCT_BY_SLUG[slug].name })}
            </ButtonLink>
          ))}
        </CtaRow>
      ) : (
        <CtaRow>
          <ButtonLink to="/lab" variant="ghost">
            {c.allDemos}
          </ButtonLink>
        </CtaRow>
      )}
      <nav className="eco-pager" aria-label={s.listTitle}>
        {prev ? (
          <AppLink to={`/tur/${prev.n}`} rel="prev">
            <Arrow dir="back" />
            {s.prev}
          </AppLink>
        ) : (
          <span />
        )}
        <AppLink to="/tur">{s.allChapters}</AppLink>
        {next ? (
          <AppLink to={`/tur/${next.n}`} rel="next">
            {s.next}
            <Arrow />
          </AppLink>
        ) : (
          <span />
        )}
      </nav>
    </section>
  )
}
