/** /karya/:slug — demo / case-study page. Phase 1: frame + back bar; unknown slugs render the 404. */
import { useParams } from 'react-router'
import { useI18n } from '../lib/i18n'
import { findWork } from '../content/work'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import NotFound from './NotFound'

export default function KaryaDetail() {
  const { t } = useI18n()
  const { slug } = useParams()
  const work = findWork(slug)
  if (!work) return <NotFound />
  const d = t.pages.detail
  const byline = work.kind === 'case' ? d.caseByline : d.byline
  return (
    <PageShell
      eyebrow={d.eyebrow}
      title={work.name}
      lead={t.pages.building}
      heroExtra={
        <p className="demo-bar">
          <AppLink to="/karya">
            <span aria-hidden="true">← </span>
            {d.back}
          </AppLink>
          <span aria-hidden="true"> · </span>
          <span>{byline}</span>
        </p>
      }
    >
      {null}
    </PageShell>
  )
}
