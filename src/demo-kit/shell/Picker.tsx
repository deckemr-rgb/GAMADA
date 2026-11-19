/**
 * shell/Picker.tsx — a listbox popover (button → list of options with aria-selected). Used by RoleSwitcher
 * and RegionSwitcher. Keyboard: ↓/↑ open + move, Home/End, Enter/Space select, Esc closes and returns focus,
 * Tab closes. Renders into the ui Portal (inherits data-eco), positioned from the trigger rect.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, Portal, enterPanel } from '../ui'

export interface PickerOption<V extends string> {
  value: V
  label: string
  sub?: string
  lead?: ReactNode
}

export interface PickerProps<V extends string> {
  /** accessible name of the trigger + list */
  label: string
  value: V
  options: PickerOption<V>[]
  onChange: (v: V) => void
  /** trigger content */
  children: ReactNode
  /** small heading at the top of the list */
  heading?: string
  align?: 'start' | 'end'
  className?: string
  /** the list opened (Tahap 7: the region picker starts fetching the other packs) */
  onOpen?: () => void
}

const GAP = 6

export function Picker<V extends string>({ label, value, options, onChange, children, heading, align = 'start', className, onOpen }: PickerProps<V>) {
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
    const r = btn.current.getBoundingClientRect()
    const p = pop.current.getBoundingClientRect()
    const vw = window.innerWidth
    let left = align === 'end' ? r.right - p.width : r.left
    left = Math.max(8, Math.min(vw - p.width - 8, left))
    pop.current.style.top = `${r.bottom + GAP}px`
    pop.current.style.left = `${left}px`
    const sel = pop.current.querySelector<HTMLElement>('[aria-selected="true"]') ?? pop.current.querySelector<HTMLElement>('[role="option"]')
    sel?.focus()
    const tw = enterPanel(pop.current, { y: -4 }, 0.16)
    return () => {
      tw?.kill()
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    onOpen?.()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    // an outer scroll would detach the fixed list from its trigger: close (scrolls inside the list are fine)
    const onScroll = (e: Event) => {
      if (!pop.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true,
    })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open])

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(pop.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
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
    }
    if (n < 0) return
    e.preventDefault()
    els[n]?.focus()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`dk-pick${className ? ` ${className}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {children}
        <Icon name="chevronDown" size={14} className="dk-pick-chev" />
      </button>
      {open && (
        <Portal anchor={btn}>
          <div ref={pop} className="dk-menu dk-pick-pop" onKeyDown={onListKey}>
            {heading && (
              <p className="dk-pick-head" aria-hidden="true">
                {heading}
              </p>
            )}
            <div id={id} role="listbox" aria-label={label}>
              {options.map((o) => {
                const on = o.value === value
                return (
                  <div
                    key={o.value}
                    role="option"
                    tabIndex={-1}
                    aria-selected={on}
                    className={`dk-menu-item dk-pick-opt${on ? ' is-on' : ''}`}
                    onClick={() => {
                      close()
                      if (!on) onChange(o.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        close()
                        if (!on) onChange(o.value)
                      }
                    }}
                  >
                    {o.lead}
                    <span className="dk-pick-text">
                      <span>{o.label}</span>
                      {o.sub && <span className="dk-pick-sub">{o.sub}</span>}
                    </span>
                    {on && <Icon name="check" size={16} className="dk-pick-check" />}
                  </div>
                )
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
