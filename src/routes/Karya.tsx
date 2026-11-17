/** /karya — portfolio. Phase 1: grouped index with the #web / #apk / #proyek anchors (full page in phase 3).
 * Entries folded into an ecosystem product (KasirKu, ScrapPulse) render a "Kini bagian dari …" card instead. */
import { useEcoI18n } from '../content/i18n/useEco'
import { WORK, workMenuTitle, type WorkKind } from '../content/work'
import { PRODUCT_BY_SLUG } from '../content/products'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import { Icon } from '../demo-kit/ui/icons'
import { EcoBadge, fill } from './EcoParts'
import Arrow from '../components/ui/Arrow'

const GROUPS: Array<{ id: string; kind: WorkKind; menuIndex: number }> = [
  { id: 'web', kind: 'web', menuIndex: 1 },
  { id: 'apk', kind: 'apk', menuIndex: 0 },
  { id: 'proyek', kind: 'case', menuIndex: 2 },
]

export default function Karya() {
  const { lang, t, eco: copy } = useEcoI18n()
  const p = t.pages.karya
  const k = copy.karya
  return (
    <PageShell eyebrow={p.eyebrow} title={p.title} lead={p.lead}>
      <p className="page-building">{t.pages.building}</p>
      {GROUPS.map((g) => {
        const list = WORK.filter((w) => w.kind === g.kind)
        const menu = t.nav.workMenu[g.menuIndex]
        const merged = list.flatMap((w) => (w.merged ? [{ w, m: w.merged }] : []))
        return (
          <section key={g.id} id={g.id} className="stub-group" aria-labelledby={`grp-${g.id}`}>
            <h2 id={`grp-${g.id}`}>{menu ? workMenuTitle(menu) : null}</h2>
            <ul className="stub-list">
              {list
                .filter((w) => !w.merged)
                .map((w) => (
                  <li key={w.slug}>
                    <AppLink to={`/karya/${w.slug}`}>{w.name}</AppLink>
                  </li>
                ))}
            </ul>
            {merged.length > 0 ? (
              <ul className="karya-merged-list">
                {merged.map(({ w, m }) => {
                  const prod = PRODUCT_BY_SLUG[m.product]
                  const note = w.slug === 'kasirku' ? k.kasirku : w.slug === 'scrappulse' ? k.scrappulse : prod.tagline[lang]
                  return (
                    <li key={w.slug}>
                      <AppLink to={m.to} className="karya-merged" data-eco={prod.eco}>
                        <span className="eco-pcard-icon">
                          <Icon name={prod.icon} size={22} />
                        </span>
                        <span className="karya-merged-body">
                          <span className="karya-merged-k">{fill(k.mergedInto, { name: prod.name })}</span>
                          <span className="karya-merged-name">
                            <s className="karya-merged-old">{w.name}</s>
                            <Arrow dir="mid" />
                            {prod.name}
                          </span>
                          <span className="karya-merged-note">{note}</span>
                          <EcoBadge eco={prod.eco} />
                        </span>
                        <span className="karya-merged-go">
                          {fill(k.see, { name: prod.name })}
                          <Arrow />
                        </span>
                      </AppLink>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )
      })}
    </PageShell>
  )
}
