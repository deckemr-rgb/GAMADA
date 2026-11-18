/**
 * CatalogPreview — "Pratinjau etalase Katalog Lokal" (standalone, pure props; mini.tsx can reuse it): the open needs and
 * the top 3 suppliers in the order Katalog Lokal will use (verified first, then distance), with the badges
 * Terverifikasi / Pajak Rapi / Skor Usaha. The highlighted business (the KYB case) is shown even outside the top 3 and
 * its badge flips the moment its `partner.verified` lands (same selector as Katalog Lokal: catalogPreview).
 */
import { useEffect, useRef, useState } from 'react'
import type { CatalogNeed } from '../../demo-kit/world'
import type { CatalogCard } from '../../demo-kit/world/usaha-pintar'
import { Icon } from '../../demo-kit/ui'
import { STR, type Lang } from './strings'

export interface CatalogPreviewProps {
  lang: Lang
  needs: CatalogNeed[]
  suppliers: CatalogCard[]
  highlightId?: string | null
  /** "Masuk shortlist KL-… (karung pasir)" once the highlighted business is matched to an open need */
  match?: { code: string; item: string } | null
  kecName: (kecamatanId: string) => string
  className?: string
}

export function CatalogPreview({ lang, needs, suppliers, highlightId, match, kecName, className }: CatalogPreviewProps) {
  const t = STR[lang]
  const top = suppliers.slice(0, 3)
  const hiIdx = highlightId ? suppliers.findIndex((c) => c.business.id === highlightId) : -1
  const rows = hiIdx >= 3 ? [...top.map((c, i) => ({ c, i })), { c: suppliers[hiIdx]!, i: hiIdx }] : top.map((c, i) => ({ c, i }))
  // the highlighted badge flips (transform / opacity only) when its verified flag changes
  const hi = hiIdx >= 0 ? suppliers[hiIdx] : undefined
  const prev = useRef(hi?.badges.verified)
  const [flip, setFlip] = useState(0)
  useEffect(() => {
    if (hi && prev.current === false && hi.badges.verified) setFlip((n) => n + 1)
    prev.current = hi?.badges.verified
  }, [hi])

  return (
    <section className={`dk-km-preview${className ? ` ${className}` : ''}`} data-km="catalog-preview" aria-label={t.previewTitle}>
      <header>
        <h3>
          <Icon name="katalog" size={16} />
          {t.previewTitle}
        </h3>
        <p>{t.previewSub}</p>
      </header>
      <div className="dk-km-needs">
        <b>{t.needsOpen}</b>
        {needs.length ? (
          <ul>
            {needs.slice(0, 2).map((n) => (
              <li key={n.id}>{t.needLine(n.code, n.title[lang], kecName(n.kecamatanId))}</li>
            ))}
          </ul>
        ) : (
          <p className="dk-km-muted">{t.noNeeds}</p>
        )}
      </div>
      <ol className="dk-km-sup">
        {rows.map(({ c, i }) => {
          const isHi = c.business.id === highlightId
          return (
            <li key={c.business.id} className={isHi ? 'is-hi' : undefined} data-biz={c.business.id}>
              <span className="dk-km-rank dk-num">{t.rank(i + 1)}</span>
              <span className="dk-km-sup-body">
                <b>{c.business.name}</b>
                <span className="dk-km-sup-meta dk-num">
                  {t.km(c.distanceKm.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US'))} · Kec. {kecName(c.business.kecamatanId)}
                </span>
                <span className="dk-km-badges">
                  <span key={isHi ? `v${flip}` : 'v'} className={`dk-km-badge ${c.badges.verified ? 'is-ok' : 'is-no'}${isHi && flip ? ' is-flip' : ''}`} data-badge="verified">
                    <Icon name={c.badges.verified ? 'checkCircle' : 'dot'} size={12} />
                    {c.badges.verified ? t.badgeVerified : t.badgeUnverified}
                  </span>
                  {c.badges.taxTidy && <span className="dk-km-badge is-ok">{t.badgeTax}</span>}
                  {c.badges.score != null && <span className="dk-km-badge dk-num">{t.badgeScore(c.badges.score)}</span>}
                </span>
                {isHi && match && (
                  <span className="dk-km-match" data-km="shortlisted">
                    <Icon name="check" size={12} />
                    {t.shortlisted(match.code, match.item)}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
