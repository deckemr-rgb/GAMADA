/**
 * Kanban — status columns; a card that changes column glides there (FLIP: transform only, write-only ticker
 * tween; the GSAP Flip plugin is not needed for translate-only moves, which keeps 7 KB out of the ui chunk),
 * whether the move came from this board or from the world store, then gets the 12 % accent flash.
 * Layout is read ONLY when a card changes column (in render, before commit, and once after); adding a card
 * or any other re-render reads nothing. Cards are memoised by item object (+ renderCard identity).
 * Keyboard: one tab stop for the board; ↑/↓ between cards, ←/→ between columns, Shift+←/→ moves the
 * card, Enter opens. Every move is announced in a polite live region. Pointer: a "move to next" button.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { DEMO, EASE } from '../../lib/motion'
import { Icon } from './icons'
import { animatePose, flashNewRow, motionMode, type PoseTween } from './motion'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

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
  /** pass a stable function (useCallback) so unchanged cards skip re-rendering */
  renderCard: (item: T) => ReactNode
  onMove?: (id: string, toColumn: string) => void
  onOpen?: (item: T) => void
  label: string
  /** "move to next column" button on cards (default: true when onMove is set) */
  moveButton?: boolean
  className?: string
}

interface CardProps<T> {
  item: T
  id: string
  label: string
  tabbable: boolean
  clickable: boolean
  helpId: string
  nextId: string | undefined
  showMove: boolean
  moveLabel: string
  moveTitle: string
  renderCard: (item: T) => ReactNode
  onKey: (e: KeyboardEvent<HTMLElement>, id: string) => void
  onFocusCard: (id: string) => void
  onOpenCard: (id: string) => void
  onMoveCard: (id: string, to: string) => void
}

function CardImpl<T>({ item, id, label, tabbable, clickable, helpId, nextId, showMove, moveLabel, moveTitle, renderCard, onKey, onFocusCard, onOpenCard, onMoveCard }: CardProps<T>) {
  return (
    <li className="dk-kb-li">
      <div
        className={`dk-kb-card${clickable ? ' is-clickable' : ''}`}
        data-flip-id={id}
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-describedby={helpId}
        onKeyDown={(e) => onKey(e, id)}
        onFocus={() => onFocusCard(id)}
        onClick={clickable ? (e) => !(e.target as HTMLElement).closest('button') && onOpenCard(id) : undefined}
      >
        <span className="dk-flash" aria-hidden="true" />
        <div className="dk-kb-card-b">{renderCard(item)}</div>
        {showMove && nextId && (
          <button type="button" className="dk-kb-move" onClick={() => onMoveCard(id, nextId)} aria-label={moveLabel} title={moveTitle} tabIndex={-1}>
            <Icon name="arrowRight" size={14} />
          </button>
        )}
      </div>
    </li>
  )
}
const Card = memo(CardImpl) as typeof CardImpl

export function Kanban<T>({ columns, items, itemId, itemColumn, itemLabel, renderCard, onMove, onOpen, label, moveButton, className }: KanbanProps<T>) {
  const t = useUiStrings()
  const root = useRef<HTMLDivElement>(null)
  const helpId = useRef(`dk-kb-help-${Math.random().toString(36).slice(2, 8)}`).current
  const colOf = useRef<Map<string, string> | null>(null)
  const rectsBefore = useRef<Map<string, DOMRect> | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)

  const byCol = useMemo(() => {
    const m = new Map<string, T[]>(columns.map((c) => [c.id, []]))
    for (const it of items) m.get(itemColumn(it))?.push(it)
    return m
  }, [columns, items, itemColumn])

  const tabId = focusId && items.some((i) => itemId(i) === focusId) ? focusId : items[0] ? itemId(items[0]) : null

  /* render phase: a card changed column → remember where every card is NOW (DOM not yet committed) */
  const committed = colOf.current
  if (committed && root.current && motionMode() === 'full' && !rectsBefore.current) {
    let moved = false
    for (const it of items) {
      const was = committed.get(itemId(it))
      if (was !== undefined && was !== itemColumn(it)) {
        moved = true
        break
      }
    }
    if (moved) {
      const m = new Map<string, DOMRect>()
      root.current.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => m.set(el.dataset.flipId ?? '', el.getBoundingClientRect()))
      rectsBefore.current = m
    }
  }

  // latest props for the stable card callbacks
  const latest = useRef({ items, itemId, itemColumn, onMove, onOpen, columns })
  latest.current = { items, itemId, itemColumn, onMove, onOpen, columns }
  const find = useCallback((id: string) => latest.current.items.find((i) => latest.current.itemId(i) === id), [])

  const move = useCallback(
    (id: string, to: string) => {
      const { onMove: mv, columns: cols, itemColumn: colFn } = latest.current
      if (!mv) return
      const it = find(id)
      const col = cols.find((c) => c.id === to)
      if (!it || !col || colFn(it) === to) return
      mv(id, to)
    },
    [find],
  )

  /* after every render: animate column changes (only when one happened), then record the columns */
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const moved: string[] = []
    const prev = colOf.current
    if (prev)
      for (const it of items) {
        const id = itemId(it)
        const before = prev.get(id)
        if (before !== undefined && before !== itemColumn(it)) moved.push(id)
      }
    colOf.current = new Map(items.map((i) => [itemId(i), itemColumn(i)]))
    const rects = rectsBefore.current
    rectsBefore.current = null
    const kills: (() => void)[] = []
    if (moved.length) {
      if (rects && motionMode() === 'full') {
        const tws: PoseTween[] = []
        el.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((card) => {
          const r0 = rects.get(card.dataset.flipId ?? '')
          if (!r0) return
          const r1 = card.getBoundingClientRect()
          const dx = r0.left - r1.left
          const dy = r0.top - r1.top
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
          tws.push(animatePose(card, { x: dx, y: dy }, { x: 0, y: 0 }, { duration: DEMO.screen, ease: EASE.out }))
        })
        kills.push(() => tws.forEach((tw) => tw.kill()))
      }
      for (const id of moved) {
        const card = el.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(id)}"]`)
        if (card) kills.push(flashNewRow(card, { slide: false }))
        const it = items.find((i) => itemId(i) === id)
        const col = columns.find((c) => it && c.id === itemColumn(it))
        // straight into the live region: no extra render
        if (it && col && liveRef.current) liveRef.current.textContent = t.moved(itemLabel(it), col.title)
      }
    }
    if (pendingFocus.current) {
      const card = el.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(pendingFocus.current)}"]`)
      card?.focus({ preventScroll: true })
      pendingFocus.current = null
      // once the FLIP has settled, bring the moved card into view (it may now sit in an off-screen column)
      if (card) window.setTimeout(() => card.isConnected && card.scrollIntoView({ block: 'nearest', inline: 'nearest' }), DEMO.screen * 1000 + 40)
    }
    return () => {
      for (const k of kills) k()
    }
  })

  const focusCard = (id: string) => {
    setFocusId(id)
    root.current?.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(id)}"]`)?.focus()
  }

  const keyRef = useRef<(e: KeyboardEvent<HTMLElement>, id: string) => void>(() => {})
  keyRef.current = (e, id) => {
    if (e.target !== e.currentTarget) return
    const it = items.find((i) => itemId(i) === id)
    if (!it) return
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
  const onKey = useCallback((e: KeyboardEvent<HTMLElement>, id: string) => keyRef.current(e, id), [])
  const onFocusCard = useCallback((id: string) => setFocusId(id), [])
  const onOpenCard = useCallback(
    (id: string) => {
      const it = find(id)
      if (it) latest.current.onOpen?.(it)
    },
    [find],
  )

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
                const name = itemLabel(it)
                return (
                  <Card
                    key={id}
                    item={it}
                    id={id}
                    label={name}
                    tabbable={id === tabId}
                    clickable={!!onOpen}
                    helpId={helpId}
                    nextId={next?.id}
                    showMove={showMove}
                    moveLabel={next ? `${name}: ${t.moveTo(next.title)}` : ''}
                    moveTitle={next ? t.moveTo(next.title) : ''}
                    renderCard={renderCard}
                    onKey={onKey}
                    onFocusCard={onFocusCard}
                    onOpenCard={onOpenCard}
                    onMoveCard={move}
                  />
                )
              })}
            </ul>
          </section>
        )
      })}
      <p ref={liveRef} className="dk-sr" aria-live="polite" />
    </div>
  )
}
