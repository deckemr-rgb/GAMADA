/**
 * tour/ChapterDrawer.tsx — "Pilih bab": 20 rows (number, time, title, product chips with eco accent, ✓ seen).
 * Arrow keys move, Enter / click jumps, Esc closes; focus returns to the trigger (the caller keeps the ref).
 */
import { useEffect, useRef } from 'react'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { TOUR_CHAPTERS } from '../../content/tour'
import { Icon } from '../ui/icons'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang } from './types'

export function ChapterDrawer({ open, onClose, onPick, lang, current, seen }: { open: boolean; onClose: () => void; onPick: (n: number) => void; lang: Lang; current?: number; seen?: Partial<Record<ProductSlug, number>> }) {
  const t = TOUR_STRINGS[lang]
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (!open) return
    const btns = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button[data-n]') ?? [])
    const first = btns().find((b) => Number(b.dataset.n) === current) ?? btns()[0]
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
      const all = btns()
      const i = all.indexOf(document.activeElement as HTMLButtonElement)
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
      all[j]?.focus()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, current, onClose])
  if (!open) return null
  return (
    <div className="dk-tour-drawer-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dk-tour-drawer" role="dialog" aria-modal="true" aria-labelledby="dk-tour-drawer-h">
        <div className="dk-tour-drawer-head">
          <h2 id="dk-tour-drawer-h" className="dk-tour-h2">
            {t.chapters}
          </h2>
          <button type="button" className="dk-tour-icon" onClick={onClose} aria-label={t.close}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <ol ref={list} className="dk-tour-chlist">
          {TOUR_CHAPTERS.map((ch) => {
            const done = ch.products.length > 0 && ch.products.every((p) => seen?.[p] != null)
            return (
              <li key={ch.n}>
                <button type="button" data-n={ch.n} className={`dk-tour-chrow${ch.n === current ? ' is-current' : ''}`} aria-current={ch.n === current ? 'step' : undefined} onClick={() => onPick(ch.n)}>
                  <span className="dk-tour-chrow-n">{String(ch.n).padStart(2, '0')}</span>
                  <span className="dk-tour-chrow-time">{ch.time ?? t.summary}</span>
                  <span className="dk-tour-chrow-body">
                    <span className="dk-tour-chrow-title">{ch.title[lang]}</span>
                    {ch.products.length ? (
                      <span className="dk-tour-chips">
                        {ch.products.map((s) => (
                          <span key={s} className="dk-tour-chip" data-eco={PRODUCT_BY_SLUG[s].eco}>
                            {PRODUCT_BY_SLUG[s].name}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {done ? (
                    <span className="dk-tour-chrow-seen" title={t.seen}>
                      <Icon name="check" size={16} />
                      <span className="sr-only">{t.seen}</span>
                    </span>
                  ) : null}
                  <span className="sr-only">{fill(t.chapter, { n: ch.n })}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
