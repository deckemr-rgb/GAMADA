/**
 * Footer — five columns (brand · services · ecosystem · portfolio · contact) over a mini night scene:
 * a light SVG hill silhouette with a few low-tier fireflies (Fireflies, paused off-screen).
 * Contact values come from content/site.ts; empty TODO values hide their row.
 * #info stays the landing point of the scene CTAs until the home content sections exist.
 */
import { useId } from 'react'
import { useI18n } from '../lib/i18n'
import { SITE, waLink } from '../content/site'
import { CASES } from '../content/work'
import { ECO_NAV, LAB_NAV, TOUR_NAV } from '../content/ecoNav'
import AppLink from './AppLink'
import Fireflies from './Fireflies'
import { Logo } from './Navbar'

export default function Footer() {
  const { t, lang } = useI18n()
  const f = t.footer
  const ids = useId()
  const year = new Date().getFullYear()
  const years = year > SITE.since ? `${SITE.since}–${year}` : String(SITE.since)

  return (
    <footer className="sfoot" id="info" tabIndex={-1}>
      <div className="sfoot-scene" aria-hidden="true">
        <svg viewBox="0 0 1600 360" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="sfoot-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a1638" stopOpacity="0" />
              <stop offset="1" stopColor="#2a2260" />
            </linearGradient>
            <radialGradient id="sfoot-moon" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffd77e" stopOpacity="0.28" />
              <stop offset="1" stopColor="#ffd77e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1600" height="360" fill="url(#sfoot-sky)" />
          <circle cx="1240" cy="176" r="70" fill="url(#sfoot-moon)" />
          <circle cx="1240" cy="176" r="18" fill="#ffd77e" opacity="0.9" />
          <path d="M0,250 L180,180 L320,214 L520,128 L720,206 L930,140 L1140,214 L1360,160 L1600,206 L1600,360 L0,360 Z" fill="#221c4f" />
          <path d="M0,292 C260,250 520,286 820,262 C1110,240 1360,276 1600,254 L1600,360 L0,360 Z" fill="#191540" />
          <path d="M0,330 C320,306 640,326 960,314 C1240,304 1440,320 1600,312 L1600,360 L0,360 Z" fill="#120f2e" />
        </svg>
        <Fireflies seed={11} className="sfoot-fireflies" />
      </div>

      <div className="sfoot-inner">
        <div className="sfoot-grid">
          <div className="sfoot-brand">
            <AppLink to="/" className="sfoot-logo" aria-label={t.a11y.home}>
              <Logo />
            </AppLink>
            <p>{f.blurb}</p>
          </div>

          <nav className="sfoot-col" aria-labelledby={`${ids}-svc`}>
            <h2 id={`${ids}-svc`}>{f.servicesTitle}</h2>
            <ul>
              {f.services.map((s) => (
                <li key={s.label}>
                  <AppLink to={s.to}>{s.label}</AppLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="sfoot-col" aria-labelledby={`${ids}-eco`} data-col="eco">
            <h2 id={`${ids}-eco`}>{f.ecoTitle}</h2>
            <ul>
              {ECO_NAV.map((e) => (
                <li key={e.id}>
                  <AppLink to={e.to}>{e.name}</AppLink>
                </li>
              ))}
              <li>
                <AppLink to={TOUR_NAV.to}>{TOUR_NAV.title[lang]}</AppLink>
              </li>
              <li>
                <AppLink to={LAB_NAV.to}>{LAB_NAV.title[lang]}</AppLink>
              </li>
            </ul>
          </nav>

          <nav className="sfoot-col" aria-labelledby={`${ids}-pf`}>
            <h2 id={`${ids}-pf`}>{f.portfolioTitle}</h2>
            <ul>
              <li>
                <AppLink to="/karya">{f.allWork}</AppLink>
              </li>
              {CASES.map((c) =>
                c.merged ? (
                  // folded into an ecosystem product: link its new home and say so (not the retired /karya page)
                  <li key={c.slug}>
                    <AppLink to={c.merged.to} aria-label={`${c.name}, ${f.nowPartOf.replace('{name}', c.merged.name)}`}>
                      {`${c.name} → ${c.merged.name}`}
                    </AppLink>
                  </li>
                ) : (
                  <li key={c.slug}>
                    <AppLink to={`/karya/${c.slug}`}>{c.name}</AppLink>
                  </li>
                ),
              )}
              {SITE.github ? (
                <li>
                  <a href={SITE.github} target="_blank" rel="noopener noreferrer">
                    {f.github}
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>

          <div className="sfoot-col">
            <h2>{f.contactTitle}</h2>
            <ul>
              {SITE.email ? (
                <li>
                  <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                </li>
              ) : null}
              <li>
                <a href={waLink(t.wa.prefill)} target="_blank" rel="noopener noreferrer">
                  {f.whatsapp}
                </a>
              </li>
              <li className="sfoot-muted">{f.location}</li>
            </ul>
          </div>
        </div>

        <div className="sfoot-bottom">
          <p>
            © {years} {SITE.legalName}. {f.rights}
          </p>
          {SITE.ecosystem.name ? (
            <p>
              {f.ecosystem}{' '}
              {SITE.ecosystem.href ? (
                <a href={SITE.ecosystem.href} target="_blank" rel="noopener noreferrer">
                  {SITE.ecosystem.name}
                </a>
              ) : (
                SITE.ecosystem.name
              )}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
