/**
 * WeekGrid — standalone week × hour shift grid (pure props): cells shaded by expected customers per hour, shift
 * blocks (drag with a pointer = transform only; arrows move a focused block; tap a block then tap a slot on touch),
 * dashed "extra" blocks that open their reason. Product-local (plan §1.9 #6).
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface GridBlock { id: string; day: number; start: number; end: number; label: string; sub?: string; badge?: string; tone?: 'new' }
export interface GridExtra { key: string; day: number; start: number; end: number; label: string }
export interface WeekGridProps {
  /** column labels (7, or 1 on phones) and their real day indexes */
  days: { label: string; index: number }[]
  h0: number
  h1: number
  traffic: number[][]
  blocks: GridBlock[]
  extra: GridExtra[]
  selected: string | null
  today: number
  label: string
  hint: string
  onSelect: (id: string | null) => void
  onMove: (id: string, day: number, start: number) => void
  onExtra: (key: string) => void
  slotLabel: (day: string, hour: number) => string
}

export default function WeekGrid({ days, h0, h1, traffic, blocks, extra, selected, today, label, hint, onSelect, onMove, onExtra, slotLabel }: WeekGridProps) {
  // one-day phone view: 44 px rows (touch targets)
  const ROW = days.length === 1 ? 44 : 34
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i)
  const max = Math.max(1, ...traffic.flat())
  const layer = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean; el: HTMLElement } | null>(null)
  const [, setTick] = useState(0)
  const skip = useRef(false)
  const colW = () => (layer.current ? layer.current.getBoundingClientRect().width / days.length : 100)
  const col = (day: number) => days.findIndex((d) => d.index === day)
  const sel = blocks.find((b) => b.id === selected)

  const down = (e: PointerEvent<HTMLButtonElement>, b: GridBlock) => {
    if (e.pointerType === 'touch') return
    drag.current = { id: b.id, x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    if (d.moved) d.el.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const up = (e: PointerEvent<HTMLButtonElement>, b: GridBlock) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.moved) return
    skip.current = true
    d.el.style.transform = ''
    const dc = Math.round((e.clientX - d.x) / colW())
    const dh = Math.round((e.clientY - d.y) / ROW)
    const c = Math.min(days.length - 1, Math.max(0, col(b.day) + dc))
    if (dc || dh) onMove(b.id, days[c]!.index, b.start + dh * 60)
    setTick((n) => n + 1)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>, b: GridBlock) => {
    const dd = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    const dm = e.key === 'ArrowUp' ? -60 : e.key === 'ArrowDown' ? 60 : 0
    if (!dd && !dm) {
      if (e.key === 'Escape') onSelect(null)
      return
    }
    e.preventDefault()
    const c = col(b.day) + dd
    onMove(b.id, c >= 0 && c < days.length ? days[c]!.index : b.day, b.start + dm)
  }
  const lanes = new Map<string, [number, number]>()
  for (const d of days) {
    const list = blocks.filter((b) => b.day === d.index).sort((a, b) => a.start - b.start)
    const ends: number[] = []
    for (const b of list) {
      let lane = ends.findIndex((x) => x <= b.start)
      if (lane < 0) lane = ends.push(0) - 1
      ends[lane] = b.end
      lanes.set(b.id, [lane, 0])
    }
    for (const b of list) lanes.get(b.id)![1] = ends.length
  }
  const top = (m: number) => ((m - h0 * 60) / 60) * ROW
  // a day with an extra block keeps its right part for it (never covers a staff block); the one-day phone view keeps
  // less (20 %), so 5 parallel staff lanes (the toko on a flood day) stay ≥ 44 px wide
  const keep = days.length === 1 ? 80 : 70
  return (
    <div className="dk-ta-wg" role="group" aria-label={label} style={{ ['--cols' as string]: days.length }}>
      <div className="dk-ta-wg-head" aria-hidden="true">
        <span />
        {days.map((d) => (
          <span key={d.index} className={d.index === today ? 'is-today' : ''}>
            {d.label}
          </span>
        ))}
      </div>
      <div className="dk-ta-wg-body">
        <div className="dk-ta-wg-hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} style={{ height: ROW }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        <div className="dk-ta-wg-layer" ref={layer} style={{ height: hours.length * ROW }}>
          {days.map((d, ci) => (
            <div key={d.index} className="dk-ta-wg-col" style={{ left: `${(ci * 100) / days.length}%`, width: `${100 / days.length}%` }}>
              {hours.map((h) => {
                const v = (traffic[d.index]?.[h] ?? 0) / max
                return sel ? (
                  <button
                    key={h}
                    type="button"
                    className="dk-ta-wg-cell is-slot"
                    style={{ top: (h - h0) * ROW, height: ROW, ['--heat' as string]: v.toFixed(2) }}
                    aria-label={slotLabel(d.label, h)}
                    onClick={() => onMove(sel.id, d.index, h * 60)}
                  />
                ) : (
                  <span key={h} className="dk-ta-wg-cell" style={{ top: (h - h0) * ROW, height: ROW, ['--heat' as string]: v.toFixed(2) }} />
                )
              })}
              {extra
                .filter((x) => x.day === d.index)
                .map((x) => (
                  <button key={x.key} type="button" className="dk-ta-wg-extra" data-ta="extra-block" style={{ top: top(x.start), height: top(x.end) - top(x.start), left: `${keep}%` }} onClick={() => onExtra(x.key)}>
                    {x.label}
                  </button>
                ))}
              {blocks
                .filter((b) => b.day === d.index)
                .map((b) => {
                  const [lane, n] = lanes.get(b.id) ?? [0, 1]
                  const span = extra.some((x) => x.day === d.index) ? keep : 100
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`dk-ta-wg-block${b.id === selected ? ' is-sel' : ''}${b.tone === 'new' ? ' is-new' : ''}`}
                      data-shift={b.id}
                      aria-pressed={b.id === selected}
                      aria-label={`${b.label}, ${b.sub ?? ''}${b.badge ? `, ${b.badge}` : ''}. ${hint}`}
                      style={{ top: top(b.start), height: top(b.end) - top(b.start) - 2, left: `${(lane * span) / n}%`, width: `${span / n}%` }}
                      onClick={() => {
                        if (skip.current) skip.current = false
                        else onSelect(b.id === selected ? null : b.id)
                      }}
                      onPointerDown={(e) => down(e, b)}
                      onPointerMove={move}
                      onPointerUp={(e) => up(e, b)}
                      onPointerCancel={() => {
                        if (drag.current) drag.current.el.style.transform = ''
                        drag.current = null
                      }}
                      onKeyDown={(e) => key(e, b)}
                    >
                      <b>{b.label}</b>
                      {b.sub && <small>{b.sub}</small>}
                      {b.badge && <i>{b.badge}</i>}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
