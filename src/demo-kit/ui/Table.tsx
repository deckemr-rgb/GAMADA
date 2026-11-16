/**
 * Table — the data grid of direction C, on @tanstack/react-table v9 (sorting only; markup and a11y are ours).
 *
 * - role="grid", roving tabindex, J/K or ↑/↓ move, Home/End, PageUp/PageDown, Enter/Space open, N = onNew.
 * - Sortable headers (buttons inside columnheaders with aria-sort). Cards mode keeps sorting via a select.
 * - Density 40 / 32 px (controlled or not) with a Segmented toggle that is visible on every size.
 * - Container narrower than 640 px → each row becomes a card (same DOM, label + value per cell).
 * - > 200 rows (table mode) → simple windowing inside a fixed-height scroller (sticky header, no dependency);
 *   cards mode shows 50 at a time with "Show more".
 * - New rows (ids not seen before) slide in 8 px with a 12 % accent overlay fading over 1.5 s; rows that
 *   move (insert above, re-sort) glide to their new place (FLIP on offsetTop, transform only).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, tableFeatures, useTable, type ColumnDef, type RowData, type SortingState } from '@tanstack/react-table'
import { gsap } from 'gsap'
import { DEMO, EASE } from '../../lib/motion'
import { IconButton } from './Button'
import { Segmented, Select } from './Form'
import { Icon } from './icons'
import { flashNewRow, motionMode, useElementWidth } from './motion'
import { fmtNum, useUiStrings } from './strings'
import { useI18n } from '../../lib/i18n'
import './tokens.css'
import './ui.css'

/** Table constants (px / counts). */
export const TABLE = {
  rowComfy: 40,
  rowCompact: 32,
  headerH: 32,
  cardBreakpoint: 640,
  virtualMin: 200,
  overscan: 8,
  viewportH: 480,
  cardPage: 50,
  flipMax: 60,
} as const

export type Density = 'comfy' | 'compact'

export interface TableColumn<T> {
  id: string
  header: string
  /** value for sorting and the default cell */
  value: (row: T) => string | number | null | undefined
  /** custom cell renderer */
  cell?: (row: T) => ReactNode
  /** fixed width in px; otherwise minmax(min, grow fr) */
  width?: number
  min?: number
  grow?: number
  align?: 'start' | 'end'
  numeric?: boolean
  /** default true */
  sortable?: boolean
  /** card layout role: title (heading), meta (top right), field (label: value, default), hidden */
  card?: 'title' | 'meta' | 'field' | 'hidden'
}

export interface TableProps<T extends RowData> {
  rows: T[]
  columns: TableColumn<T>[]
  rowId: (row: T) => string
  /** accessible name of the grid */
  label: string
  density?: Density
  defaultDensity?: Density
  onDensityChange?: (d: Density) => void
  /** default true */
  densityToggle?: boolean
  /** the opened row (aria-selected + accent edge) */
  activeId?: string | null
  onOpen?: (row: T) => void
  /** N shortcut + hint */
  onNew?: () => void
  /** left side of the toolbar (title, counts) */
  toolbar?: ReactNode
  /** right side of the toolbar, before the density toggle */
  actions?: ReactNode
  /** rendered instead of the grid when rows is empty */
  empty?: ReactNode
  initialSort?: { id: string; desc?: boolean }
  /** scroller height when virtualised (px) */
  height?: number
  /** 'ruled' = no card surface, ruled lines (paper / printable reports) */
  variant?: 'panel' | 'ruled'
  cardBreakpoint?: number
  /** default true */
  highlightNew?: boolean
  /** live-region text for a new row (default: first column value) */
  announce?: (row: T) => string
  /** per-row tone for the left edge marker */
  rowTone?: (row: T) => 'warn' | 'danger' | undefined
  className?: string
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
})
type F = typeof features

const track = <T,>(c: TableColumn<T>) => (c.width ? `${c.width}px` : `minmax(${c.min ?? 96}px, ${c.grow ?? 1}fr)`)

export function Table<T extends RowData>(props: TableProps<T>) {
  const { rows, columns, rowId, label, onOpen, onNew, toolbar, actions, empty, initialSort, variant = 'panel', highlightNew = true, activeId, rowTone, className } = props
  const t = useUiStrings()
  const { lang } = useI18n()

  /* ---------------- density (controlled or not) */
  const [ownDensity, setOwnDensity] = useState<Density>(props.defaultDensity ?? 'compact')
  const density = props.density ?? ownDensity
  const setDensity = (d: Density) => {
    if (props.density === undefined) setOwnDensity(d)
    props.onDensityChange?.(d)
  }
  const rowH = density === 'compact' ? TABLE.rowCompact : TABLE.rowComfy

  /* ---------------- tanstack: sorting */
  const [sorting, setSorting] = useState<SortingState>(initialSort ? [{ id: initialSort.id, desc: !!initialSort.desc }] : [])
  const colDefs = useMemo<ColumnDef<F, T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: (r: T) => c.value(r) ?? null,
        enableSorting: c.sortable !== false,
        sortFn: c.numeric ? 'basic' : 'alphanumeric',
        sortUndefined: 'last' as const,
      })) as ColumnDef<F, T>[],
    [columns],
  )
  const table = useTable({
    features,
    columns: colDefs,
    data: rows,
    getRowId: (r: T) => rowId(r),
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: true,
  })
  const model = table.getRowModel().rows
  const ordered = useMemo(() => model.map((r) => r.original), [model])
  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])

  /* ---------------- layout mode */
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(rootRef)
  const cards = width > 0 && width < (props.cardBreakpoint ?? TABLE.cardBreakpoint)
  const virtual = !cards && ordered.length > TABLE.virtualMin
  const viewportH = props.height ?? TABLE.viewportH

  /* ---------------- windowing */
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [cardLimit, setCardLimit] = useState<number>(TABLE.cardPage)
  let start = 0
  let end = ordered.length
  if (virtual) {
    start = Math.max(0, Math.floor(scrollTop / rowH) - TABLE.overscan)
    end = Math.min(ordered.length, Math.ceil((scrollTop + viewportH) / rowH) + TABLE.overscan)
  } else if (cards) end = Math.min(ordered.length, cardLimit)

  /* ---------------- roving focus */
  const [activeIdx, setActiveIdx] = useState(0)
  const rowEls = useRef(new Map<string, HTMLDivElement>())
  const pendingFocus = useRef<number | null>(null)
  const safeIdx = Math.min(activeIdx, Math.max(0, ordered.length - 1))

  const ensureVisible = useCallback(
    (i: number) => {
      const sc = scrollerRef.current
      if (!virtual || !sc) return
      const top = i * rowH
      const view = sc.clientHeight - TABLE.headerH
      if (top < sc.scrollTop) sc.scrollTop = top
      else if (top + rowH > sc.scrollTop + view) sc.scrollTop = top + rowH - view
      setScrollTop(sc.scrollTop)
    },
    [virtual, rowH],
  )

  const focusIdx = (i: number) => {
    let n = Math.max(0, Math.min(ordered.length - 1, i))
    if (cards && n >= cardLimit) {
      // cards mode never renders everything at once: moving past the loaded cards loads one more page
      const limit = Math.min(ordered.length, cardLimit + TABLE.cardPage)
      setCardLimit(limit)
      n = Math.min(n, limit - 1)
    }
    pendingFocus.current = n
    setActiveIdx(n)
    ensureVisible(n)
  }

  useLayoutEffect(() => {
    const i = pendingFocus.current
    if (i === null) return
    const r = ordered[i]
    if (!r) return
    const el = rowEls.current.get(rowId(r))
    if (!el) return
    pendingFocus.current = null
    el.focus({ preventScroll: virtual })
    if (!virtual) el.scrollIntoView({ block: 'nearest' })
  })

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // only when a row itself has focus (controls inside cells keep their own keys)
    if (!(e.target as HTMLElement).matches('[role="row"]')) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (k === 'j' || k === 'ArrowDown') focusIdx(safeIdx + 1)
    else if (k === 'k' || k === 'ArrowUp') focusIdx(safeIdx - 1)
    else if (k === 'Home') focusIdx(0)
    else if (k === 'End') focusIdx(ordered.length - 1)
    else if (k === 'PageDown') focusIdx(safeIdx + 10)
    else if (k === 'PageUp') focusIdx(safeIdx - 10)
    else if ((k === 'Enter' || k === ' ') && onOpen) {
      const r = ordered[safeIdx]
      if (r) onOpen(r)
    } else if (k === 'n' && onNew) onNew()
    else return
    e.preventDefault()
  }

  /* ---------------- new rows + FLIP */
  const known = useRef<Set<string> | null>(null)
  const tops = useRef(new Map<string, number>())
  const layoutSig = `${density}|${cards ? 'c' : 't'}`
  const prevSig = useRef(layoutSig)
  const [liveMsg, setLiveMsg] = useState('')
  useLayoutEffect(() => {
    const mode = motionMode()
    const ids = ordered.map(rowId)
    const sameLayout = prevSig.current === layoutSig
    prevSig.current = layoutSig
    const fresh: string[] = []
    if (known.current === null) known.current = new Set(ids)
    else
      for (const id of ids)
        if (!known.current.has(id)) {
          known.current.add(id)
          fresh.push(id)
        }
    const kills: (() => void)[] = []
    if (sameLayout && mode === 'full') {
      let n = 0
      rowEls.current.forEach((el, id) => {
        if (fresh.includes(id) || n > TABLE.flipMax) return
        const before = tops.current.get(id)
        if (before === undefined) return
        const dy = before - el.offsetTop
        if (!dy || Math.abs(dy) > viewportH * 2) return
        n++
        const tw = gsap.fromTo(el, { y: dy }, { y: 0, duration: DEMO.panel, ease: EASE.out, clearProps: 'transform' })
        kills.push(() => tw.kill())
      })
    }
    if (highlightNew)
      for (const id of fresh) {
        const el = rowEls.current.get(id)
        if (el) kills.push(flashNewRow(el))
      }
    if (fresh.length) {
      const first = rows.find((r) => rowId(r) === fresh[0])
      const c0 = columns[0]
      if (first) setLiveMsg(t.newRow(props.announce ? props.announce(first) : String(c0?.value(first) ?? fresh[0])))
    }
    tops.current.clear()
    rowEls.current.forEach((el, id) => tops.current.set(id, el.offsetTop))
    return () => {
      for (const k of kills) k()
    }
    // rows/ordered identity drives this effect
  }, [ordered, layoutSig]) // eslint-disable-line react-hooks/exhaustive-deps

  /* keep cardLimit sane when data shrinks */
  useEffect(() => {
    if (!cards) setCardLimit(TABLE.cardPage)
  }, [cards])

  /* ---------------- render */
  const tracks = columns.map(track).join(' ')
  const minW = columns.reduce((s, c) => s + (c.width ?? c.min ?? 96), 0) + (columns.length - 1) * 12 + 32
  const gridStyle = { '--dk-cols': tracks, '--dk-row-h': `${rowH}px`, minWidth: cards ? undefined : minW } as CSSProperties
  const sortable = columns.filter((c) => c.sortable !== false)
  const curSort = sorting[0]

  const header = table.getHeaderGroups()[0]
  const sortSelect = cards && sortable.length > 0 && (
    <span className="dk-table-sort">
      <Select
        aria-label={t.sortLabel}
        value={curSort?.id ?? ''}
        onChange={(e) => setSorting(e.target.value ? [{ id: e.target.value, desc: curSort?.desc ?? false }] : [])}
        options={[{ value: '', label: t.sortNone }, ...sortable.map((c) => ({ value: c.id, label: t.sortBy(c.header) }))]}
      />
      {curSort && <IconButton icon={curSort.desc ? 'sortDesc' : 'sortAsc'} label={curSort.desc ? t.sortedDesc : t.sortedAsc} variant="quiet" onClick={() => setSorting([{ id: curSort.id, desc: !curSort.desc }])} />}
    </span>
  )

  return (
    <div ref={rootRef} className={`dk-table dk-table--${variant}${cards ? ' is-cards' : ''} is-${density}${className ? ` ${className}` : ''}`}>
      {(toolbar || actions || props.densityToggle !== false || sortSelect) && (
        <div className="dk-table-bar">
          <div className="dk-table-bar-l">{toolbar}</div>
          <div className="dk-table-bar-r">
            {actions}
            {sortSelect}
            {props.densityToggle !== false && (
              <Segmented
                size="sm"
                label={t.density}
                value={density}
                onChange={setDensity}
                options={[
                  { value: 'comfy', label: t.comfy, icon: 'rowsComfy', iconOnly: cards },
                  { value: 'compact', label: t.compact, icon: 'rowsCompact', iconOnly: cards },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {ordered.length === 0 && empty ? (
        <div className="dk-table-empty">{empty}</div>
      ) : (
        <div
          ref={scrollerRef}
          className={`dk-table-scroll${virtual ? ' is-virtual' : ''}`}
          style={virtual ? { height: viewportH } : undefined}
          onScroll={virtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
        >
          <div className="dk-grid" role="grid" aria-label={label} aria-rowcount={ordered.length + 1} aria-colcount={columns.length} style={gridStyle}>
            <div role="rowgroup" className="dk-thead-g">
              <div role="row" aria-rowindex={1} className="dk-tr dk-thead">
                {header?.headers.map((h) => {
                  const c = colById.get(h.column.id)
                  if (!c) return null
                  const dir = h.column.getIsSorted()
                  const can = h.column.getCanSort()
                  return (
                    <div key={h.id} role="columnheader" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : can ? 'none' : undefined} className={`dk-th${c.align === 'end' || c.numeric ? ' is-end' : ''}`}>
                      {can ? (
                        <button type="button" className={`dk-th-btn${dir ? ' is-sorted' : ''}`} onClick={h.column.getToggleSortingHandler()} title={t.sortBy(c.header)}>
                          <span>{c.header}</span>
                          <Icon name={dir === 'asc' ? 'sortAsc' : dir === 'desc' ? 'sortDesc' : 'sort'} size={13} />
                        </button>
                      ) : (
                        <span>{c.header}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div role="rowgroup" className="dk-tbody" onKeyDown={onKey}>
              {virtual && start > 0 && <div aria-hidden="true" style={{ height: start * rowH }} />}
              {ordered.slice(start, end).map((r, j) => {
                const i = start + j
                const id = rowId(r)
                const open = activeId === id
                const tone = rowTone?.(r)
                return (
                  <div
                    key={id}
                    role="row"
                    aria-rowindex={i + 2}
                    aria-selected={onOpen ? open : undefined}
                    tabIndex={i === safeIdx || (i === start && (safeIdx < start || safeIdx >= end)) ? 0 : -1}
                    ref={(el) => {
                      if (el) rowEls.current.set(id, el)
                      else rowEls.current.delete(id)
                    }}
                    className={`dk-tr dk-row${open ? ' is-open' : ''}${tone ? ` is-${tone}` : ''}${onOpen ? ' is-clickable' : ''}`}
                    onClick={onOpen ? () => onOpen(r) : undefined}
                    onFocus={() => setActiveIdx(i)}
                  >
                    <span className="dk-flash" aria-hidden="true" />
                    {columns.map((c) => (
                      <div key={c.id} role="gridcell" className={`dk-td dk-td--${c.card ?? 'field'}${c.align === 'end' || c.numeric ? ' is-end' : ''}${c.numeric ? ' dk-num' : ''}`}>
                        <span className="dk-td-label" aria-hidden="true">
                          {c.header}
                        </span>
                        <span className="dk-td-v">{c.cell ? c.cell(r) : (c.value(r) ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
              {virtual && end < ordered.length && <div aria-hidden="true" style={{ height: (ordered.length - end) * rowH }} />}
            </div>
          </div>
          {cards && end < ordered.length && (
            <button type="button" className="dk-btn dk-btn--quiet dk-btn--md dk-table-more" onClick={() => setCardLimit((n) => n + TABLE.cardPage)}>
              <span className="dk-btn-label">{t.showMore(Math.min(TABLE.cardPage, ordered.length - end))}</span>
            </button>
          )}
        </div>
      )}

      <div className="dk-table-foot">
        <span className="dk-faint dk-num">{t.rows(fmtNum(lang, ordered.length))}</span>
        <span className="dk-table-hints dk-kbd-hint" aria-hidden="true">
          <span>
            <kbd className="dk-kbd">J</kbd>
            <kbd className="dk-kbd">K</kbd> {t.kbdMove}
          </span>
          {onOpen && (
            <span>
              <kbd className="dk-kbd">↵</kbd> {t.kbdOpen}
            </span>
          )}
          {onNew && (
            <span>
              <kbd className="dk-kbd">N</kbd> {t.kbdNew}
            </span>
          )}
        </span>
      </div>
      <p className="dk-sr" aria-live="polite">
        {liveMsg}
      </p>
    </div>
  )
}
