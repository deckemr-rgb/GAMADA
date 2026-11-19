/**
 * BizBadges — the three trust badges of a business (Katalog Lokal cards, Rapor Usaha bank queue, Inti Data node):
 * Terverifikasi (Kenal Mitra KYB) · Pajak Rapi (Pajak Beres) · Skor nnn (Rapor Usaha). Source = `badgesOf()`
 * (world/pasar-daerah). `links` turns each badge into a link to its product when that demo is READY (else plain
 * text); a missing badge is an outlined "Belum" chip whose reason is in its title + screen-reader text.
 */
import AppLink from '../../components/AppLink'
import { useI18n } from '../../lib/i18n'
import { DEMO_READY } from '../../demos/registry'
import type { ProductSlug } from '../../content/products'
import { Icon } from './icons'
import './pd.css'

export interface BizBadgesProps {
  badges: { verified: boolean; taxTidy: boolean; score: number | null; kybAt?: number }
  /** the business (focus of the links) */
  bizId?: string
  size?: 'sm' | 'md'
  links?: boolean
  className?: string
}

const T = {
  verified: { id: 'Terverifikasi', en: 'Verified' },
  taxTidy: { id: 'Pajak Rapi', en: 'Tax in order' },
  score: { id: 'Skor', en: 'Score' },
  none: { id: 'Belum', en: 'Not yet' },
  whyVerified: { id: 'Belum lolos verifikasi KYB di Kenal Mitra', en: 'Has not passed the Kenal Mitra KYB check yet' },
  whyTax: { id: 'Pajak belum dirapikan di Pajak Beres', en: 'Taxes not put in order in Pajak Beres yet' },
  whyScore: { id: 'Belum punya skor Rapor Usaha', en: 'No Rapor Usaha score yet' },
  sim: { id: 'skor simulasi', en: 'simulated score' },
} as const

export function BizBadges({ badges, bizId, size = 'sm', links = false, className }: BizBadgesProps) {
  const { lang } = useI18n()
  const t = (k: keyof typeof T) => T[k][lang]
  const link = (slug: ProductSlug, href: string, body: React.ReactNode, cls: string) =>
    links && DEMO_READY[slug] ? (
      <AppLink to={href} className={`${cls} is-link`}>
        {body}
      </AppLink>
    ) : (
      <span className={cls}>{body}</span>
    )
  const missing = (label: string, why: string) => (
    <span className="dk-bb is-missing" title={why}>
      {label}: {t('none')}
      <span className="dk-sr-only"> · {why}</span>
    </span>
  )
  return (
    <span className={`dk-bbs is-${size}${className ? ` ${className}` : ''}`}>
      {badges.verified
        ? link('kenal-mitra', `/demo/kenal-mitra${bizId ? `?focus=${bizId}` : ''}`, <><Icon name="check" size={size === 'sm' ? 12 : 14} /> {t('verified')}</>, 'dk-bb is-ok')
        : missing(t('verified'), t('whyVerified'))}
      {badges.taxTidy ? link('pajak-beres', '/demo/pajak-beres?tab=ekspor', <><Icon name="check" size={size === 'sm' ? 12 : 14} /> {t('taxTidy')}</>, 'dk-bb is-ok') : missing(t('taxTidy'), t('whyTax'))}
      {badges.score !== null
        ? link('rapor-usaha', `/demo/rapor-usaha${bizId ? `?focus=${bizId}` : ''}`, <>{t('score')} <b className="dk-num">{badges.score}</b><span className="dk-sr-only"> ({t('sim')})</span></>, 'dk-bb is-score')
        : missing(t('score'), t('whyScore'))}
    </span>
  )
}
