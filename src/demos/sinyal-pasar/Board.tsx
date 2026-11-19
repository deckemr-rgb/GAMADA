/**
 * Board — pure-props price board (`priceBoard` rows: price, 7-day Δ, Δ vs seasonal, 14-day sparkline, status). One
 * button per row (↑/↓/Home/End move, Enter opens the detail); ≥ 640 px a ruled grid, below it cards. Row elements carry
 * `data-sp-pair` (flash hook) and the first anomaly row `data-hotspot="sp-anomaly"`.
 */
import { memo, type KeyboardEvent } from 'react'
import { Sparkline } from '../../demo-kit/viz'

export interface BoardItem {
  id: string
  item: string
  market: string
  price: string
  unit: string
  week: string
  weekUp: boolean
  delta: string
  deltaHigh: boolean
  spark: number[]
  status: 'anomaly' | 'warning' | 'normal'
  statusLabel: string
  openLabel: string
  sparkLabel: string
}
export interface BoardProps {
  rows: BoardItem[]
  cols: { item: string; price: string; week: string; delta: string; trend: string; status: string }
  label: string
  activeId?: string | null
  onOpen: (id: string) => void
  empty: string
  /** the row that carries the hotspot / tour hook (the first anomaly) */
  hotId?: string | null
}

const Row = memo(function Row({ r, active, hot, onOpen }: { r: BoardItem; active: boolean; hot: boolean; onOpen: (id: string) => void }) {
  return (
    <li className={`dk-sp-row is-${r.status}${active ? ' is-active' : ''}`} data-sp-pair={r.id}>
      <button type="button" className="dk-sp-rowbtn" aria-label={r.openLabel} aria-current={active || undefined} onClick={() => onOpen(r.id)} {...(hot ? { 'data-hotspot': 'sp-anomaly' } : {})}>
        <span className="dk-sp-c-item">
          <strong>{r.item}</strong>
          <span>{r.market}</span>
        </span>
        <span className="dk-sp-c-price dk-num">
          {r.price}
          <small>{r.unit}</small>
        </span>
        <span className={`dk-sp-c-week dk-num ${r.weekUp ? 'is-up' : 'is-down'}`}>{r.week}</span>
        <span className={`dk-sp-c-delta dk-num${r.deltaHigh ? ' is-high' : ''}`}>{r.delta}</span>
        <span className="dk-sp-c-spark" aria-hidden="true">
          <Sparkline values={r.spark} label={r.sparkLabel} height={24} color={r.status === 'anomaly' ? 'var(--dk-danger)' : undefined} />
        </span>
        <span className="dk-sp-c-status">
          <span className={`dk-sp-pill is-${r.status}`}>{r.statusLabel}</span>
        </span>
      </button>
    </li>
  )
})

export function Board({ rows, cols, label, activeId, onOpen, empty, hotId }: BoardProps) {
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.dk-sp-rowbtn')]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    const j = e.key === 'ArrowDown' ? Math.min(btns.length - 1, i + 1) : e.key === 'ArrowUp' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    btns[j]?.focus()
  }
  if (!rows.length) return <p className="dk-sp-muted">{empty}</p>
  return (
    <div className="dk-sp-board">
      <div className="dk-sp-boardhead" aria-hidden="true">
        <span>{cols.item}</span>
        <span className="is-end">{cols.price}</span>
        <span className="is-end">{cols.week}</span>
        <span className="is-end">{cols.delta}</span>
        <span>{cols.trend}</span>
        <span>{cols.status}</span>
      </div>
      <ul className="dk-sp-rows" aria-label={label} onKeyDown={onKey}>
        {rows.map((r) => (
          <Row key={r.id} r={r} active={r.id === activeId} hot={r.id === hotId} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  )
}
