/**
 * demos/_placeholder — tahap-1 canvas for every /demo/:slug: an honest "Demo <name> sedang dibangun — hadir di
 * tahap N" panel with the product's real registry data (products.ts), its tour chapters and related demos as
 * links. No simulated controls: every interactive element here is a real link.
 */
import { PRODUCT_BY_SLUG, ECOSYSTEMS, ROLES, fullName } from '../../content/products'
import { TOUR, chapterByNumber } from '../../content/tour'
import { useI18n } from '../../lib/i18n'
import AppLink from '../../components/AppLink'
import { DuskArt, Icon } from '../../demo-kit/ui'
import { DEMO_STAGE, type DemoCanvasProps } from '../registry'
import './placeholder.css'

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

export default function PlaceholderCanvas({ product }: DemoCanvasProps) {
  const { lang, t } = useI18n()
  const s = t.eco.demo
  const c = t.eco.common
  const p = PRODUCT_BY_SLUG[product]
  const eco = ECOSYSTEMS[p.eco]
  const stage = DEMO_STAGE[p.eco]
  const titleId = `dk-ph-title-${p.slug}`

  return (
    <section className="dk-ph" data-eco={p.eco} aria-labelledby={titleId}>
      <div className="dk-ph-hero">
        <div className="dk-ph-art" aria-hidden="true">
          <DuskArt kind={p.map ? 'map' : 'chart'} />
        </div>
        <div className="dk-ph-copy">
          <p className="dk-ph-kicker">
            <span className="dk-ph-glyph" aria-hidden="true">
              <Icon name={p.icon} size={18} />
            </span>
            {eco.name} · {fill(c.stageShort, { n: stage })}
          </p>
          <h2 className="dk-ph-title" id={titleId}>
            {fill(s.building, { name: p.name })}
          </h2>
          <p className="dk-ph-stage">{fill(s.arrives, { n: stage })}</p>
          <p className="dk-ph-tagline">{p.tagline[lang]}</p>
          <p className="dk-ph-honest">{fill(s.honest, { region: TOUR.regionName })}</p>
          <p className="dk-ph-actions">
            <AppLink className="dk-ph-btn" to={`/produk/${p.slug}`}>
              <Icon name="arrowLeft" size={16} />
              {c.productPage}: {fullName(p, lang)}
            </AppLink>
          </p>
        </div>
      </div>

      <div className="dk-ph-grid">
        <section className="dk-ph-card" aria-labelledby={`${titleId}-roles`}>
          <h3 className="dk-ph-h" id={`${titleId}-roles`}>
            <Icon name="users" size={16} />
            {s.rolesTitle}
          </h3>
          <ul className="dk-ph-chips">
            {p.roles.map((r) => (
              <li key={r} className={r === p.defaultRole ? 'dk-ph-chip is-default' : 'dk-ph-chip'}>
                <span className="dk-ph-ini" aria-hidden="true">
                  {ROLES[r].initials}
                </span>
                {ROLES[r].name[lang]}
              </li>
            ))}
          </ul>
        </section>

        <section className="dk-ph-card" aria-labelledby={`${titleId}-feat`}>
          <h3 className="dk-ph-h" id={`${titleId}-feat`}>
            <Icon name="spark" size={16} />
            {s.featuresTitle}
          </h3>
          <ul className="dk-ph-list">
            <li>
              <Icon name="grid" size={16} />
              {c.frames[p.frame]}
            </li>
            {p.map ? (
              <li>
                <Icon name="map" size={16} />
                {c.map}
              </li>
            ) : null}
            {p.chat ? (
              <li>
                <Icon name="chat" size={16} />
                {c.chat}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="dk-ph-card" aria-labelledby={`${titleId}-tour`}>
          <h3 className="dk-ph-h" id={`${titleId}-tour`}>
            <Icon name="clock" size={16} />
            {s.chaptersTitle}
          </h3>
          <ul className="dk-ph-links">
            {p.chapters.map((n) => {
              const ch = chapterByNumber(n)
              if (!ch) return null
              return (
                <li key={n}>
                  <AppLink to={`/tur/${n}`} className="dk-ph-link">
                    <span className="dk-ph-time">{ch.time ?? '—'}</span>
                    <span>
                      <span className="dk-ph-link-k">{fill(c.chapter, { n })}</span>
                      {ch.title[lang]}
                    </span>
                  </AppLink>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="dk-ph-card" aria-labelledby={`${titleId}-rel`}>
          <h3 className="dk-ph-h" id={`${titleId}-rel`}>
            <Icon name="layers" size={16} />
            {s.relatedTitle}
          </h3>
          <ul className="dk-ph-links">
            {p.related.map((slug) => {
              const r = PRODUCT_BY_SLUG[slug]
              return (
                <li key={slug} data-eco={r.eco}>
                  <AppLink to={`/demo/${slug}`} className="dk-ph-link">
                    <span className="dk-ph-rel-ic">
                      <Icon name={r.icon} size={16} />
                    </span>
                    <span>
                      <span className="dk-ph-link-k">{r.name}</span>
                      {r.descriptor[lang]}
                    </span>
                  </AppLink>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </section>
  )
}
