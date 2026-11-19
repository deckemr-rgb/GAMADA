/**
 * ActivityFeed — a live list of world events (GAMADA Inti, Indeks Ekonomi "Kejadian ekonomi", /ekosistem later):
 * a dot in the product's ecosystem colour, the time, the text, an optional link. A new row slides in 8 px
 * (transform / opacity; opacity only under reduced motion, nothing under static); `aria-live` announces at most one
 * new row per 6 s. Rows from `activityRows()` (world/inti) or the product's own selector.
 */
import { useEffect, useRef, useState } from 'react'
import AppLink from '../../components/AppLink'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { motionMode } from './motion'
import './pd.css'

export interface ActivityRow { id: string; at: number; product: ProductSlug | null; text: { id: string; en: string }; href?: string; tone?: 'neutral' | 'info' | 'ok' | 'warn' | 'danger' }
export interface ActivityFeedProps {
  rows: readonly ActivityRow[]
  max?: number
  /** announce new rows (aria-live, throttled) */
  live?: boolean
  label: { id: string; en: string }
  empty?: { id: string; en: string }
  className?: string
}

const hm = (m: number) => {
  const x = ((Math.floor(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(x / 60)).padStart(2, '0')}.${String(x % 60).padStart(2, '0')}`
}

export function ActivityFeed({ rows, max = 8, live = true, label, empty, className }: ActivityFeedProps) {
  const { lang } = useI18n()
  const list = rows.slice(0, max)
  const seen = useRef<Set<string> | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [say, setSay] = useState('')
  const lastSay = useRef(0)
  useEffect(() => {
    const first = seen.current === null
    const prev = seen.current ?? new Set<string>()
    const fresh = list.filter((r) => !prev.has(r.id))
    seen.current = new Set(list.map((r) => r.id))
    if (first || !fresh.length) return
    const mode = motionMode()
    if (mode !== 'static') {
      for (const r of fresh) {
        const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(r.id)}"]`)
        if (!el) continue
        el.animate(mode === 'full' ? [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' })
      }
    }
    const now = Date.now()
    if (live && now - lastSay.current > 6000) {
      lastSay.current = now
      setSay(fresh[0]!.text[lang])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((r) => r.id).join('|')])
  return (
    <section className={`dk-actfeed${className ? ` ${className}` : ''}`} aria-label={label[lang]}>
      {!list.length && empty ? <p className="dk-actfeed-empty">{empty[lang]}</p> : null}
      <ol ref={listRef}>
        {list.map((r) => {
          const eco = r.product ? PRODUCT_BY_SLUG[r.product]?.eco : null
          const body = (
            <>
              <span className="dk-actfeed-dot" data-eco={eco ?? 'inti'} aria-hidden="true" />
              <time className="dk-num">{hm(r.at)}</time>
              <span className="dk-actfeed-text">
                {r.product ? <b>{PRODUCT_BY_SLUG[r.product]?.name} · </b> : null}
                {r.text[lang]}
              </span>
            </>
          )
          return (
            <li key={r.id} data-row={r.id} data-tone={r.tone ?? 'neutral'}>
              {r.href ? (
                <AppLink to={r.href} className="dk-actfeed-row is-link">
                  {body}
                </AppLink>
              ) : (
                <span className="dk-actfeed-row">{body}</span>
              )}
            </li>
          )
        })}
      </ol>
      {live ? (
        <span className="dk-sr-only" aria-live="polite">
          {say}
        </span>
      ) : null}
    </section>
  )
}
