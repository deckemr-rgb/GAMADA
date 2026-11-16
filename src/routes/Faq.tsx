/** Faq route: phase 1 shell (content arrives in its phase). */
import { useI18n } from '../lib/i18n'
import PageShell from '../components/PageShell'

export default function Faq() {
  const { t } = useI18n()
  const p = t.pages.faq
  return <PageShell eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
}
