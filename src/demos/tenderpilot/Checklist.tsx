/**
 * Checklist.tsx — standalone (pure props): the tender's requirements from `requirementsFor` (profile + Kenal Mitra +
 * Pajak Beres + Toko Autopilot). A row that turns ok while shown (tax.ready) gets a tick animation (CSS, transform /
 * opacity; none under reduced motion). Links go to the product that holds the data (only when it can be opened).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../demo-kit/ui'
import type { Requirement } from '../../demo-kit/world/usaha-pintar'
import type { Lang } from './model'
import { STRINGS } from './strings'

export interface ChecklistLink { to: string; label: string; tp?: string }
export interface ChecklistProps {
  items: readonly Requirement[]
  lang: Lang
  /** the deep link of a row (null = plain text) */
  linkFor?: (r: Requirement) => ChecklistLink | null
}

export default function Checklist({ items, lang, linkFor }: ChecklistProps) {
  const t = STRINGS[lang]
  const ok = items.filter((r) => r.ok).length
  const prev = useRef<Map<string, boolean> | null>(null)
  const [just, setJust] = useState<string[]>([])
  const [said, setSaid] = useState('')
  useEffect(() => {
    const before = prev.current
    const now = new Map(items.map((r) => [r.key, r.ok] as const))
    prev.current = now
    if (!before) return
    const flipped = items.filter((r) => r.ok && before.get(r.key) === false).map((r) => r.key)
    if (!flipped.length) return
    setJust(flipped)
    setSaid(items.filter((r) => flipped.includes(r.key)).map((r) => t.ticked(r.label[lang])).join('. '))
    const tm = window.setTimeout(() => setJust([]), 1400)
    return () => window.clearTimeout(tm)
  }, [items, lang, t])

  return (
    <section className="dk-tp-check" aria-label={t.checkTitle} data-tp="checklist" data-ok={ok} data-n={items.length}>
      <header className="dk-tp-card-h">
        <h3>{t.checkTitle}</h3>
        <span className={`dk-tp-count${ok === items.length ? ' is-done' : ''}`}>{ok === items.length ? t.checkDone : t.checkCount(ok, items.length)}</span>
      </header>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
      <ul>
        {items.map((r) => {
          const link = linkFor?.(r) ?? null
          return (
            <li key={r.key} className={`dk-tp-req${r.ok ? ' is-ok' : ' is-miss'}${just.includes(r.key) ? ' is-just' : ''}`} data-req={r.key}>
              <span className="dk-tp-req-ic" aria-hidden="true">
                <Icon name={r.ok ? 'check' : 'alert'} size={14} />
              </span>
              <div className="dk-tp-req-body">
                <p className="dk-tp-req-label">
                  {r.label[lang]}
                  <span className="dk-sr">{r.ok ? ` (${lang === 'id' ? 'lengkap' : 'complete'})` : ` (${lang === 'id' ? 'belum' : 'missing'})`}</span>
                  <span className="dk-tp-req-src">{t.sourceOf[r.source] ?? r.source}</span>
                </p>
                <p className="dk-tp-req-detail">{r.detail[lang]}</p>
                {r.warn && <p className="dk-tp-req-warn">{r.warn[lang]}</p>}
                {link && (
                  <Link className="dk-tp-link" to={link.to} data-tp={link.tp}>
                    {link.label}
                    <Icon name="arrowUpRight" size={14} />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
