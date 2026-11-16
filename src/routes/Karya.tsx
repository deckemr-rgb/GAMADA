/** /karya — portfolio. Phase 1: grouped index with the #web / #apk / #proyek anchors (full page in phase 3). */
import { useI18n } from '../lib/i18n'
import { WORK, type WorkKind } from '../content/work'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'

const GROUPS: Array<{ id: string; kind: WorkKind; menuIndex: number }> = [
  { id: 'web', kind: 'web', menuIndex: 1 },
  { id: 'apk', kind: 'apk', menuIndex: 0 },
  { id: 'proyek', kind: 'case', menuIndex: 2 },
]

export default function Karya() {
  const { t } = useI18n()
  const p = t.pages.karya
  return (
    <PageShell eyebrow={p.eyebrow} title={p.title} lead={p.lead}>
      <p className="page-building">{t.pages.building}</p>
      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="stub-group" aria-labelledby={`grp-${g.id}`}>
          <h2 id={`grp-${g.id}`}>{t.nav.workMenu[g.menuIndex]?.title}</h2>
          <ul className="stub-list">
            {WORK.filter((w) => w.kind === g.kind).map((w) => (
              <li key={w.slug}>
                <AppLink to={`/karya/${w.slug}`}>{w.name}</AppLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  )
}
