/** 404 — night scene with a way home (themed fully in phase 6). */
import { useI18n } from '../lib/i18n'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'

export default function NotFound() {
  const { t } = useI18n()
  const p = t.pages.notFound
  return (
    <>
      <meta name="robots" content="noindex" />
      <PageShell eyebrow={p.eyebrow} title={p.title} lead={p.lead} docTitle="404 — GAMADA">
        <p>
          <AppLink className="btn-primary" to="/">
            {p.cta}
          </AppLink>
        </p>
      </PageShell>
    </>
  )
}
