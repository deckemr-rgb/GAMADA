/**
 * Kanban — status columns; a card that changes column glides there with GSAP Flip (whether the move came
 * from this board or from the world store), then gets the 12 % accent flash.
 * Keyboard: one tab stop for the board; ↑/↓ between cards, ←/→ between columns, Shift+←/→ moves the
 * card, Enter opens. Every move is announced in a polite live region. Pointer: a "move to next" button.
 */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { DEMO, EASE } from '../../lib/motion'
import { Icon } from './icons'
import { flashNewRow, motionMode } from './motion'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

gsap.registerPlugin(Flip)

export interface KanbanColumn {
  id: string
  title: string
  /** header dot: neutral by default; warn / danger / done follow the status colour rules */
  tone?: 'neutral' | 'warn' | 'danger' | 'done'
}

export interface KanbanProps<T> {
  columns: KanbanColumn[]
  items: T[]
  itemId: (item: T) => string
  itemColumn: (item: T) => string
  /** short text for announcements ("SW-2026-0142") */
  itemLabel: (item: T) => string
  renderCard: (item: T) => ReactNode
  onMove?: (id: string, toColumn: string) => void
  onOpen?: (item: T) => void
  label: string
  /** "move to next column" button on cards (default: true when onMove is set) */
  moveButton?: boolean
  className?: string
}

export function Kanban<T>({ columns, items, itemId, itemColumn, itemLabel, renderCard, onMove, onOpen, label, moveButton, className }: KanbanProps<T>) {
  const t = useUiStrings()
  const root = useRef<HTMLDivElement>(null)
  const helpId = useRef(`dk-kb-help-${Math.random().toString(36).slice(2, 8)}`).current
  const flipState = useRef<Flip.FlipState | null>(null)
  const flipScroll = useRef({ x: 0, y: 0 })
  const colOf = useRef(new Map<string, string>())
  const pendingFocus = useRef<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [live, setLive] = useState('')

  const byCol = useMemo(() => {
    const m = new Map<string, T[]>(columns.map((c) => [c.id, []]))
    for (const it of items) m.get(itemColumn(it))?.push(it)
    return m
  }, [columns, items, itemColumn])

  const tabId = focusId && items.some((i) => itemId(i) === focusId) ? focusId : items[0] ? itemId(items[0]) : null

  const capture = () => {
    const el = root.current
    if (!el) return
    flipState.current = Flip.getState(el.querySelectorAll('[data-flip-id]'))
    flipScroll.current = { x: window.scrollX, y: window.scrollY }
  }

  const move = (id: string, to: string) => {
    if (!onMove) return
    const it = items.find((i) => itemId(i) === id)
    const col = columns.find((c) => c.id === to)
    if (!it || !col || itemColumn(it) === to) return
    capture()
    onMove(id, to)
  }

  /* after every render: animate column changes, then record the new layout */
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const moved: string[] = []
    for (const it of items) {
      const id = itemId(it)
      const before = colOf.current.get(id)
      if (before !== undefined && before !== itemColumn(it)) moved.push(id)
    }
    colOf.current = new Map(items.map((i) => [itemId(i), itemColumn(i)]))
    const kills: (() => void)[] = []
    if (moved.length) {
      const mode = motionMode()
      const st = flipState.current
      const sameScroll = flipScroll.current.x === window.scrollX && flipScroll.current.y === window.scrollY
      if (mode === 'full' && st && sameScroll) {
        const tl = Flip.from(st, { targets: el.querySelectorAll('[data-flip-id]'), duration: DEMO.screen, ease: EASE.out, nested: true, prune: true })
        kills.push(() => tl.kill())
      }
      for (const id of moved) {
        const card = el.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(id)}"]`)
        if (card) kills.push(flashNewRow(card, { slide: false }))
        const it = items.find((i) => itemId(i) === id)
        const col = columns.find((c) => it && c.id === itemColumn(it))
        if (it && col) setLive(t.moved(itemLabel(it), col.title))
      }
    }
    if (pendingFocus.current) {
      el.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(pendingFocus.current)}"]`)?.focus({ preventScroll: true })
      pendingFocus.current = null
    }
    capture()
    return () => {
      for (const k of kills) k()
    }
  })

  const focusCard = (id: string) => {
    setFocusId(id)
    root.current?.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(id)}"]`)?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLElement>, it: T) => {
    if (e.target !== e.currentTarget) return
    const id = itemId(it)
    const ci = columns.findIndex((c) => c.id === itemColumn(it))
    const list = byCol.get(itemColumn(it)) ?? []
    const ri = list.findIndex((x) => itemId(x) === id)
    const k = e.key
    if (e.shiftKey && (k === 'ArrowRight' || k === 'ArrowLeft') && onMove) {
      const to = columns[ci + (k === 'ArrowRight' ? 1 : -1)]
      if (to) {
        pendingFocus.current = id
        move(id, to.id)
      }
    } else if (k === 'ArrowDown' || k === 'ArrowUp') {
      const n = list[ri + (k === 'ArrowDown' ? 1 : -1)]
      if (n) focusCard(itemId(n))
    } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const step = k === 'ArrowRight' ? 1 : -1
      for (let c = ci + step; c >= 0 && c < columns.length; c += step) {
        const col = columns[c]
        const l = col ? byCol.get(col.id) : undefined
        if (l && l.length) {
          const n = l[Math.min(ri, l.length - 1)]
          if (n) focusCard(itemId(n))
          break
        }
      }
    } else if ((k === 'Enter' || k === ' ') && onOpen) onOpen(it)
    else return
    e.preventDefault()
  }

  const showMove = moveButton ?? !!onMove

  return (
    <div ref={root} className={`dk-kanban${className ? ` ${className}` : ''}`} role="group" aria-label={label} aria-describedby={helpId}>
      <p id={helpId} className="dk-sr">
        {t.kanbanHelp}
      </p>
      {columns.map((col, ci) => {
        const list = byCol.get(col.id) ?? []
        const next = columns[ci + 1]
        return (
          <section key={col.id} className="dk-kb-col" aria-labelledby={`${helpId}-${col.id}`}>
            <header className="dk-kb-head">
              <span className={`dk-kb-dot is-${col.tone ?? 'neutral'}`} aria-hidden="true">
                {col.tone === 'done' && <Icon name="check" size={11} strokeWidth={2.2} />}
              </span>
              <h3 id={`${helpId}-${col.id}`} className="dk-kb-title">
                {col.title}
              </h3>
              <span className="dk-kb-count dk-num" aria-label={t.cardsIn(list.length)}>
                {list.length}
              </span>
            </header>
            <ul className="dk-kb-list">
              {list.map((it) => {
                const id = itemId(it)
                return (
                  <li key={id} className="dk-kb-li">
                    <div
                      className={`dk-kb-card${onOpen ? ' is-clickable' : ''}`}
                      data-flip-id={id}
                      tabIndex={id === tabId ? 0 : -1}
                      aria-label={itemLabel(it)}
                      aria-describedby={helpId}
                      onKeyDown={(e) => onKey(e, it)}
                      onFocus={() => setFocusId(id)}
                      onClick={onOpen ? (e) => !(e.target as HTMLElement).closest('button') && onOpen(it) : undefined}
                    >
                      <span className="dk-flash" aria-hidden="true" />
                      <div className="dk-kb-card-b">{renderCard(it)}</div>
                      {showMove && next && (
                        <button type="button" className="dk-kb-move" onClick={() => move(id, next.id)} aria-label={`${itemLabel(it)}: ${t.moveTo(next.title)}`} title={t.moveTo(next.title)} tabIndex={-1}>
                          <Icon name="arrowRight" size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <p className="dk-sr" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
