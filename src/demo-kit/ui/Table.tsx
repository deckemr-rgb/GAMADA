/**
 * Table — the data grid of direction C, on @tanstack/react-table v9 (sorting only; markup and a11y are ours).
 *
 * - role="grid", roving tabindex, J/K or ↑/↓ move, Home/End, PageUp/PageDown, Enter/Space open, N = onNew.
 * - Sortable headers (buttons inside columnheaders with aria-sort). Cards mode keeps sorting via a select.
 * - Density 40 / 32 px (controlled or not) with a Segmented toggle that is visible on every size.
 * - Container narrower than 640 px → each row becomes a card (same DOM, label + value per cell).
 * - > 200 rows (table mode) → simple windowing inside a fixed-height scroller (sticky header, no dependency);
 *   cards mode shows 50 at a time with "Show more".
 * - New rows (ids not seen before) slide in 8 px with a 12 % accent overlay fading over 1.5 s. Rows that
 *   change ORDER (re-sort, status change) glide to their new place (FLIP on offsetTop, transform only); a pure
 *   insert / append skips FLIP entirely (no layout reads), only the new row moves.
 * - Rows and their cells are memoised (keyed by the row object): a new ticket or an opened drawer re-renders
 *   the changed rows only, not every cell, icon and chip.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, tableFeatures, useTable, type ColumnDef, type RowData, type SortingState } from '@tanstack/react-table'
import { DEMO, EASE } from '../../lib/motion'
import { IconButton } from './Button'
import { Segmented, Select } from './Form'
import { Icon } from './icons'
import { animatePose, flashNewRow, motionMode, useElementWidth, type PoseTween } from './motion'
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

/* ---------------- memoised row + cells */

interface CellsProps<T> {
  row: T
  columns: TableColumn<T>[]
}
function CellsImpl<T>({ row, columns }: CellsProps<T>) {
  return (
    <>
      {columns.map((c) => (
        <div key={c.id} role="gridcell" className={`dk-td dk-td--${c.card ?? 'field'}${c.align === 'end' || c.numeric ? ' is-end' : ''}${c.numeric ? ' dk-num' : ''}`}>
          <span className="dk-td-label" aria-hidden="true">
            {c.header}
          </span>
          <span className="dk-td-v">{c.cell ? c.cell(row) : (c.value(row) ?? '—')}</span>
        </div>
      ))}
    </>
  )
}
/** Cells re-render only when the row object or the column set changes (entity version = object identity). */
const Cells = memo(CellsImpl) as typeof CellsImpl

interface RowProps<T> {
  row: T
  id: string
  index: number
  columns: TableColumn<T>[]
  open: boolean
  selectable: boolean
  tone?: 'warn' | 'danger'
  tabbable: boolean
  setRowEl: (id: string, el: HTMLDivElement | null) => void
  openRow?: (row: T) => void
  focusIdx: (i: number) => void
}
function RowImpl<T>({ row, id, index, columns, open, selectable, tone, tabbable, setRowEl, openRow, focusIdx }: RowProps<T>) {
  const ref = useCallback((el: HTMLDivElement | null) => setRowEl(id, el), [id, setRowEl])
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selectable ? open : undefined}
      tabIndex={tabbable ? 0 : -1}
      ref={ref}
      className={`dk-tr dk-row${open ? ' is-open' : ''}${tone ? ` is-${tone}` : ''}${openRow ? ' is-clickable' : ''}`}
      onClick={openRow ? () => openRow(row) : undefined}
      onFocus={() => focusIdx(index)}
    >
      <span className="dk-flash" aria-hidden="true" />
      <Cells row={row} columns={columns} />
    </div>
  )
}
const Row = memo(RowImpl) as typeof RowImpl

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
  const setRowEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowEls.current.set(id, el)
    else rowEls.current.delete(id)
  }, [])
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const openRow = useCallback((r: T) => onOpenRef.current?.(r), [])
  const focusRow = useCallback((i: number) => setActiveIdx(i), [])
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
  const committedIds = useRef<string[] | null>(null)
  const flipBefore = useRef<Map<string, number> | null>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const layoutSig = `${density}|${cards ? 'c' : 't'}`
  const prevSig = useRef(layoutSig)
  const ids = useMemo(() => ordered.map(rowId), [ordered]) // eslint-disable-line react-hooks/exhaustive-deps
  /* render phase, only when rows that already existed change ORDER: read their old offsetTop (DOM not yet
     committed). Pure inserts / appends / removals never read layout. */
  if (committedIds.current && committedIds.current !== ids && prevSig.current === layoutSig && motionMode() === 'full' && rowEls.current.size) {
    const prev = committedIds.current
    const cur = new Set(ids)
    const was = new Set(prev)
    const a1 = ids.filter((id) => was.has(id))
    const b1 = prev.filter((id) => cur.has(id))
    if (a1.some((id, i) => id !== b1[i])) {
      const m = new Map<string, number>()
      let n = 0
      rowEls.current.forEach((el, id) => {
        if (n++ <= TABLE.flipMax) m.set(id, el.offsetTop)
      })
      flipBefore.current = m
    }
  }
  useLayoutEffect(() => {
    const mode = motionMode()
    const sameLayout = prevSig.current === layoutSig
    prevSig.current = layoutSig
    committedIds.current = ids
    const before = flipBefore.current
    flipBefore.current = null
    const fresh: string[] = []
    if (known.current === null) known.current = new Set(ids)
    else
      for (const id of ids)
        if (!known.current.has(id)) {
          known.current.add(id)
          fresh.push(id)
        }
    const kills: (() => void)[] = []
    if (before && sameLayout && mode === 'full') {
      const tws: PoseTween[] = []
      rowEls.current.forEach((el, id) => {
        const was = before.get(id)
        if (was === undefined || fresh.includes(id)) return
        const dy = was - el.offsetTop
        if (!dy || Math.abs(dy) > viewportH * 2) return
        tws.push(animatePose(el, { y: dy }, { y: 0 }, { duration: DEMO.panel, ease: EASE.out }))
      })
      kills.push(() => tws.forEach((t) => t.kill()))
    }
    if (highlightNew)
      for (const id of fresh) {
        const el = rowEls.current.get(id)
        if (el) kills.push(flashNewRow(el))
      }
    if (fresh.length && liveRef.current) {
      const first = rows.find((r) => rowId(r) === fresh[0])
      const c0 = columns[0]
      // written straight into the live region: a setState here would re-render the whole grid before paint
      if (first) liveRef.current.textContent = t.newRow(props.announce ? props.announce(first) : String(c0?.value(first) ?? fresh[0]))
    }
    return () => {
      for (const k of kills) k()
    }
    // ids (= ordered) identity drives this effect
  }, [ids, layoutSig]) // eslint-disable-line react-hooks/exhaustive-deps

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
                const id = ids[i] ?? rowId(r)
                return (
                  <Row
                    key={id}
                    row={r}
                    id={id}
                    index={i}
                    columns={columns}
                    open={activeId === id}
                    selectable={!!onOpen}
                    tone={rowTone?.(r)}
                    tabbable={i === safeIdx || (i === start && (safeIdx < start || safeIdx >= end))}
                    setRowEl={setRowEl}
                    openRow={onOpen ? openRow : undefined}
                    focusIdx={focusRow}
                  />
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
      <p ref={liveRef} className="dk-sr" aria-live="polite" />
    </div>
  )
}
