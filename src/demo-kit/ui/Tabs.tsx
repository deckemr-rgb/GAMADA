/**
 * Tabs — WAI-ARIA tabs with automatic activation (←/→/Home/End), one panel for the active tab, and an
 * accent indicator that glides to the active tab (transform only, 200 ms; jumps in reduced / static mode).
 */
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { DEMO, EASE } from '../../lib/motion'
import { Badge, type Tone } from './Atoms'
import { Icon, type IconName } from './icons'
import { motionMode } from './motion'
import './tokens.css'
import './ui.css'

export interface TabItem<V extends string> {
  id: V
  label: string
  icon?: IconName
  badge?: number
  /** badge colour (e.g. 'danger' for an overdue count); neutral by default */
  badgeTone?: Tone
  /** what the badge counts, read by screen readers ("6 lewat tenggat"); the tab name is announced first */
  badgeLabel?: string
}

export interface TabsProps<V extends string> {
  items: TabItem<V>[]
  value: V
  onChange: (v: V) => void
  label: string
  /** content of the active tab */
  children?: ReactNode
  /** stretch tabs to full width (mobile split frames: "HP Warga | Konsol Petugas") */
  fill?: boolean
  className?: string
}

export function Tabs<V extends string>({ items, value, onChange, label, children, fill, className }: TabsProps<V>) {
  const base = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const list = listRef.current
    const ind = indRef.current
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !ind || !tab) return
    const to = { x: tab.offsetLeft, scaleX: tab.offsetWidth / 100 }
    if (first.current || motionMode() !== 'full') {
      gsap.set(ind, to)
      first.current = false
      return
    }
    const tw = gsap.to(ind, { ...to, duration: DEMO.press, ease: EASE.out })
    return () => {
      tw.kill()
    }
  }, [value, items.length])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.id === value)
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % items.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = items.length - 1
    const it = items[n]
    if (!it) return
    e.preventDefault()
    onChange(it.id)
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${base}-t-${it.id}`)}`)?.focus()
  }

  return (
    <div className={`dk-tabs${fill ? ' is-fill' : ''}${className ? ` ${className}` : ''}`}>
      <div ref={listRef} className="dk-tablist" role="tablist" aria-label={label} onKeyDown={onKey}>
        {items.map((t) => {
          const on = t.id === value
          return (
            <button key={t.id} id={`${base}-t-${t.id}`} type="button" role="tab" aria-selected={on} aria-controls={`${base}-p`} tabIndex={on ? 0 : -1} className="dk-tab" onClick={() => onChange(t.id)}>
              {t.icon && <Icon name={t.icon} size={16} />}
              <span>{t.label}</span>
              {t.badge ? (
                <Badge tone={t.badgeTone ?? 'neutral'}>
                  <span aria-hidden={t.badgeLabel ? true : undefined}>{t.badge}</span>
                  {t.badgeLabel && <span className="dk-sr">{`, ${t.badgeLabel}`}</span>}
                </Badge>
              ) : null}
            </button>
          )
        })}
        <span ref={indRef} className="dk-tab-ind" aria-hidden="true" />
      </div>
      {children !== undefined && (
        <div id={`${base}-p`} role="tabpanel" aria-labelledby={`${base}-t-${value}`} tabIndex={0} className="dk-tabpanel">
          {children}
        </div>
      )}
    </div>
  )
}
