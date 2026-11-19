/**
 * shell/TourBar.tsx (Tahap 5, lazy: only a tour stage or a sandbox taken over from the tour fetches it):
 *  - with `name` (DemoShell mode="tour"): the product name of the stage bar, plain text (nothing in the stage leaves the tour);
 *  - without (K4, a sandbox on ?world=tour&from=tur-<n>): "← Kembali ke tur", 44 px, left of the product name, →
 *    `/tur/<n>?resume=1&region=…&lang=…` (+ seed); label hidden on phones, the aria-label stays.
 */
import AppLink from '../../components/AppLink'
import { useI18n } from '../../lib/i18n'
import { Icon } from '../ui'
import { DEFAULT_SEED, useSession } from '../world'

const BACK = { id: 'Kembali ke tur', en: 'Back to the tour' } as const

export function TourBar({ name }: { name?: string }) {
  const { lang } = useI18n()
  const s = useSession()
  if (name)
    return (
      <span className="dk-crumbs">
        <span className="dk-crumbs-product">
          <span className="dk-eco-dot" aria-hidden="true" />
          <span className="dk-crumbs-name">{name}</span>
        </span>
      </span>
    )
  const n = s.scope === 'tour' && s.from ? Number(s.from.slice(4)) : 0
  if (!n) return null
  const href = `/tur/${n}?resume=1&region=${encodeURIComponent(s.regionId)}&lang=${lang}${s.seed !== DEFAULT_SEED ? `&seed=${s.seed}` : ''}`
  return (
    <AppLink to={href} className="dk-btn dk-btn--secondary dk-btn--sm dk-topbar-tour" aria-label={BACK[lang]} data-tour="back-to-tour">
      <Icon name="arrowLeft" size={16} />
      <span className="dk-topbar-tour-l">{BACK[lang]}</span>
    </AppLink>
  )
}
