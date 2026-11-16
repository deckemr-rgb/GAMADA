/**
 * Inbox (message list with selection, roving ↑/↓, new-item flash) and Timeline (variant 'log' = timestamped
 * flow log, 'story' = numbered "Urutan kejadian" narrative). Both flash items they have not seen before.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Avatar } from './Atoms'
import { Icon, type IconName } from './icons'
import { flashNewRow } from './motion'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

/** Flashes children (by data-id) whose id was not present in the previous render. */
function useNewItemFlash(ids: string[], root: RefObject<HTMLElement | null>, on = true) {
  const known = useRef<Set<string> | null>(null)
  useLayoutEffect(() => {
    if (known.current === null) {
      known.current = new Set(ids)
      return
    }
    const kills: (() => void)[] = []
    for (const id of ids) {
      if (known.current.has(id)) continue
      known.current.add(id)
      const el = root.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
      if (el && on) kills.push(flashNewRow(el))
    }
    return () => {
      for (const k of kills) k()
    }
  }, [ids.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* ------------------------------------------------------------------ Inbox */

export interface InboxItem {
  id: string
  title: string
  preview?: string
  /** display time ("08.42", "5 mnt") */
  time: string
  unread?: boolean
  /** sender name → Avatar initials */
  from?: string
  icon?: IconName
  /** trailing chips / SLA */
  meta?: ReactNode
  tone?: 'warn' | 'danger'
}

export interface InboxProps {
  items: InboxItem[]
  label: string
  selectedId?: string | null
  onSelect?: (id: string) => void
  empty?: ReactNode
  className?: string
}

export function Inbox({ items, label, selectedId, onSelect, empty, className }: InboxProps) {
  const t = useUiStrings()
  const root = useRef<HTMLUListElement>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  useNewItemFlash(
    items.map((i) => i.id),
    root,
  )
  if (!items.length && empty) return <div className="dk-inbox-empty">{empty}</div>
  const tab = focusId && items.some((i) => i.id === focusId) ? focusId : (selectedId ?? items[0]?.id)
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = items.findIndex((x) => x.id === tab)
    let n = -1
    if (e.key === 'ArrowDown' || e.key === 'j') n = Math.min(items.length - 1, i + 1)
    else if (e.key === 'ArrowUp' || e.key === 'k') n = Math.max(0, i - 1)
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = items.length - 1
    if (n < 0) return
    e.preventDefault()
    const it = items[n]
    if (!it) return
    setFocusId(it.id)
    root.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(it.id)}"] button`)?.focus()
  }
  return (
    <ul ref={root} className={`dk-inbox${className ? ` ${className}` : ''}`} aria-label={label} onKeyDown={onKey}>
      {items.map((it) => {
        const sel = it.id === selectedId
        return (
          <li key={it.id} data-id={it.id} className={`dk-inbox-li${sel ? ' is-selected' : ''}${it.unread ? ' is-unread' : ''}${it.tone ? ` is-${it.tone}` : ''}`}>
            <span className="dk-flash" aria-hidden="true" />
            <button type="button" className="dk-inbox-btn" aria-current={sel || undefined} tabIndex={it.id === tab ? 0 : -1} onClick={() => onSelect?.(it.id)} onFocus={() => setFocusId(it.id)}>
              {it.from ? (
                <Avatar name={it.from} size={32} />
              ) : (
                <span className="dk-inbox-ic" aria-hidden="true">
                  <Icon name={it.icon ?? 'chat'} size={16} />
                </span>
              )}
              <span className="dk-inbox-main">
                <span className="dk-inbox-top">
                  <span className="dk-inbox-title">{it.title}</span>
                  <span className="dk-inbox-time dk-num">{it.time}</span>
                </span>
                {it.preview && <span className="dk-inbox-prev">{it.preview}</span>}
                {it.meta && <span className="dk-inbox-meta">{it.meta}</span>}
              </span>
              {it.unread && (
                <span className="dk-inbox-dot">
                  <span className="dk-sr">{t.unread}</span>
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ Timeline */

export interface TimelineItem {
  id: string
  /** "08.42" or "+0,95 s" */
  time: string
  title: ReactNode
  detail?: ReactNode
  tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'done'
  icon?: IconName
  /** product / actor label */
  source?: string
}

export interface TimelineProps {
  items: TimelineItem[]
  label: string
  /** 'log' = compact timestamped log; 'story' = numbered narrative */
  variant?: 'log' | 'story'
  /** announce new items politely */
  live?: boolean
  className?: string
}

export function Timeline({ items, label, variant = 'log', live, className }: TimelineProps) {
  const root = useRef<HTMLOListElement>(null)
  useNewItemFlash(
    items.map((i) => i.id),
    root,
  )
  return (
    <ol ref={root} className={`dk-tl dk-tl--${variant}${className ? ` ${className}` : ''}`} aria-label={label} aria-live={live ? 'polite' : undefined} aria-relevant={live ? 'additions' : undefined}>
      {items.map((it, i) => (
        <li key={it.id} data-id={it.id} className={`dk-tl-li is-${it.tone ?? 'neutral'}`}>
          <span className="dk-flash" aria-hidden="true" />
          <span className="dk-tl-mark" aria-hidden="true">
            {variant === 'story' ? i + 1 : it.icon ? <Icon name={it.icon} size={12} strokeWidth={1.8} /> : null}
          </span>
          <span className="dk-tl-time dk-num">{it.time}</span>
          <span className="dk-tl-body">
            <span className="dk-tl-title">
              {it.title}
              {it.source && <span className="dk-tl-src">{it.source}</span>}
            </span>
            {it.detail && <span className="dk-tl-detail">{it.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
