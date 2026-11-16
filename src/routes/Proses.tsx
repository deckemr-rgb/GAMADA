/** Proses route: phase 1 shell (content arrives in its phase). */
import { useI18n } from '../lib/i18n'
import PageShell from '../components/PageShell'

export default function Proses() {
  const { t } = useI18n()
  const p = t.pages.proses
  return <PageShell eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
}
