/**
 * Feed.tsx — the tender feed (`tenderFeed` rows, sorted by win chance). A row opens the tender; arrows move between
 * rows. New rows (published < 60 world minutes ago) slide in once. KBLI mismatches are greyed; the pump mirror shows
 * "peluang rendah" and, once Awas Belanja flagged its package, a "Temuan pengawas ↗" link.
 */
import { memo, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../demo-kit/ui'
import type { FeedRow } from '../../demo-kit/world/usaha-pintar'
import { canLink, countdown, hrefTo, pctOf, rpShort, type Lang } from './model'
import type { Strings } from './strings'

export interface FeedProps {
  rows: readonly FeedRow[]
  activeId: string | null
  onOpen: (id: string) => void
  /** the first row carries the start hotspot while no banner is shown */
  hotspotFirst: boolean
  /** rows that arrived while the page was open (slide in) */
  fresh: ReadonlySet<string>
  opdShort: (id: string) => string
  kecName: (id: string) => string
  t: Strings
  lang: Lang
}

const LOW = 0.3

function onKey(e: KeyboardEvent<HTMLUListElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
  const btns = [...e.currentTarget.querySelectorAll<HTMLElement>('.dk-tp-row-btn')]
  const i = btns.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  e.preventDefault()
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
  btns[n]?.focus()
}

export default memo(function Feed({ rows, activeId, onOpen, hotspotFirst, fresh, opdShort, kecName, t, lang }: FeedProps) {
  if (!rows.length) return <p className="dk-tp-empty">{t.feedEmpty}</p>
  return (
    <ul className="dk-tp-feed" aria-label={t.feedTitle} onKeyDown={onKey}>
      {rows.map((r, i) => {
        const tn = r.tender
        const p = pctOf(r.probability)
        const low = r.probability !== null && r.probability < LOW
        const cls = ['dk-tp-row', !r.kbliOk && 'is-off', tn.id === activeId && 'is-active', fresh.has(tn.id) && 'is-fresh', r.mirror && 'is-mirror'].filter(Boolean).join(' ')
        return (
          <li key={tn.id} className={cls} data-tid={tn.id} data-prob={p ?? ''}>
            <button
              type="button"
              className="dk-tp-row-btn"
              aria-current={tn.id === activeId ? 'true' : undefined}
              onClick={() => onOpen(tn.id)}
              {...(hotspotFirst && i === 0 ? { 'data-hotspot': 'tp-open' } : {})}
            >
              <span className="dk-tp-row-top">
                <span className="dk-tp-row-code dk-num">{tn.code}</span>
                {r.isNew && <span className="dk-tp-tag is-new">{t.rowNew}</span>}
                {tn.emergency && <span className="dk-tp-tag is-warn">{t.method.darurat}</span>}
                <span className="dk-tp-row-chance">{!r.kbliOk ? t.rowKbliBad : low ? `${t.rowLow} · ${p}%` : p !== null ? t.rowChance(p) : ''}</span>
              </span>
              <span className="dk-tp-row-title">{tn.title[lang]}</span>
              <span className="dk-tp-row-meta">
                {opdShort(tn.opdId)} · {kecName(tn.kecamatanId)} · <span className="dk-num">{rpShort(tn.value, lang)}</span> · {t.method[tn.method] ?? tn.method} · KBLI {tn.kbli}
              </span>
              <span className="dk-tp-row-foot">
                <span className={`dk-tp-due${r.deadlineIn <= 3 * 1440 ? ' is-soon' : ''}`}>
                  <Icon name="clock" size={12} />
                  {t.rowDeadline(countdown(r.deadlineIn, lang))}
                </span>
                <span>{t.rowComp(tn.competitors)}</span>
                {p !== null && (
                  <span className="dk-tp-meter" aria-hidden="true">
                    <i style={{ transform: `scaleX(${Math.max(0.03, r.probability ?? 0)})` }} />
                  </span>
                )}
              </span>
            </button>
            {r.risk !== null && tn.procurementId && canLink('awas-belanja') && (
              <Link className="dk-tp-risk" to={hrefTo('awas-belanja', tn.procurementId)} title={t.rowRiskTitle(r.risk)} data-tp="risk-link">
                <Icon name="flag" size={12} />
                {t.rowRisk}
                <Icon name="arrowUpRight" size={12} />
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
})
