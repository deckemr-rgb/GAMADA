/**
 * Tooltip (hover after 300 ms or keyboard focus, Esc hides, aria-describedby) and Menu (menu button:
 * aria-haspopup/expanded, ↑/↓/Home/End, Esc returns focus, click outside / Tab closes).
 * Both render in a body-level Portal positioned from the trigger's rect (fixed), flipping when out of room.
 */
import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { Button, IconButton } from './Button'
import { Icon, type IconName } from './icons'
import { enterPanel } from './motion'
import { Portal } from './Overlay'
import './tokens.css'
import './ui.css'

/** Tooltip show delay (s). */
const TIP_DELAY = 0.3
const GAP = 8

function place(trigger: DOMRect, pop: DOMRect, side: 'top' | 'bottom', align: 'center' | 'end' | 'start') {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let s = side
  if (s === 'top' && trigger.top - pop.height - GAP < 4) s = 'bottom'
  else if (s === 'bottom' && trigger.bottom + pop.height + GAP > vh - 4 && trigger.top - pop.height - GAP > 4) s = 'top'
  const top = s === 'top' ? trigger.top - pop.height - GAP : trigger.bottom + GAP
  let left = align === 'center' ? trigger.left + trigger.width / 2 - pop.width / 2 : align === 'end' ? trigger.right - pop.width : trigger.left
  left = Math.max(8, Math.min(vw - pop.width - 8, left))
  return { top, left, side: s }
}

/* ------------------------------------------------------------------ Tooltip */

export interface TooltipProps {
  content: ReactNode
  /** one focusable element (a button, link…) */
  children: ReactElement<Record<string, unknown>>
  side?: 'top' | 'bottom'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
  const pop = useRef<HTMLDivElement>(null)
  const timer = useRef<gsap.core.Tween | null>(null)

  const show = (delay: number) => {
    timer.current?.kill()
    timer.current = delay ? gsap.delayedCall(delay, () => setOpen(true)) : null
    if (!delay) setOpen(true)
  }
  const hide = () => {
    timer.current?.kill()
    setOpen(false)
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !pop.current) return
    const p = place(trigger.current.getBoundingClientRect(), pop.current.getBoundingClientRect(), side, 'center')
    pop.current.style.top = `${p.top}px`
    pop.current.style.left = `${p.left}px`
    const tw = enterPanel(pop.current, { y: p.side === 'top' ? 4 : -4 }, 0.12)
    return () => {
      tw?.kill()
    }
  }, [open, side])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = () => setOpen(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open])

  useEffect(
    () => () => {
      timer.current?.kill()
    },
    [],
  )

  if (!isValidElement(children)) return children
  const child = cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      trigger.current = el
    },
    'aria-describedby': open ? id : undefined,
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && show(TIP_DELAY),
    onPointerLeave: hide,
    onFocus: (e: FocusEvent) => (e.target as HTMLElement).matches(':focus-visible') && show(0),
    onBlur: hide,
  })
  return (
    <>
      {child}
      {open && (
        <Portal anchor={trigger}>
          <div ref={pop} id={id} role="tooltip" className="dk-tip">
            {content}
          </div>
        </Portal>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Menu */

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  onSelect: () => void
  /** destructive action (red text) */
  danger?: boolean
  disabled?: boolean
}

export interface MenuProps {
  items: MenuItem[]
  /** trigger label (also the accessible name) */
  label: string
  /** icon-only trigger when set without `showLabel` */
  icon?: IconName
  showLabel?: boolean
  align?: 'start' | 'end'
}

export function Menu({ items, label, icon = 'more', showLabel, align = 'end' }: MenuProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const p = place(btn.current.getBoundingClientRect(), pop.current.getBoundingClientRect(), 'bottom', align)
    pop.current.style.top = `${p.top}px`
    pop.current.style.left = `${p.left}px`
    pop.current.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()
    const tw = enterPanel(pop.current, { y: -4 }, 0.16)
    return () => {
      tw?.kill()
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(pop.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    let n = -1
    if (e.key === 'ArrowDown') n = (i + 1) % els.length
    else if (e.key === 'ArrowUp') n = (i - 1 + els.length) % els.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = els.length - 1
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    } else if (e.key === 'Tab') {
      close(false)
      return
    } else if (e.key.length === 1) {
      const k = e.key.toLowerCase()
      n = els.findIndex((el, j) => j > i && el.textContent?.trim().toLowerCase().startsWith(k))
      if (n < 0) n = els.findIndex((el) => el.textContent?.trim().toLowerCase().startsWith(k))
    }
    if (n < 0) return
    e.preventDefault()
    els[n]?.focus()
  }

  const triggerProps = {
    ref: btn,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: () => setOpen((o) => !o),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
    },
  }

  return (
    <>
      {showLabel ? (
        <Button variant="quiet" icon={icon} iconEnd="chevronDown" {...triggerProps}>
          {label}
        </Button>
      ) : (
        <IconButton icon={icon} label={label} variant="ghost" {...triggerProps} />
      )}
      {open && (
        <Portal anchor={btn}>
          <div ref={pop} id={id} role="menu" aria-label={label} className="dk-menu" onKeyDown={onMenuKey}>
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={it.disabled || undefined}
                className={`dk-menu-item${it.danger ? ' is-danger' : ''}`}
                onClick={() => {
                  if (it.disabled) return
                  close()
                  it.onSelect()
                }}
              >
                {it.icon ? <Icon name={it.icon} size={16} /> : <span className="dk-menu-sp" aria-hidden="true" />}
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  )
}
