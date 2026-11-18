/**
 * KPI micro-visuals (from direction A): Sparkline, TargetMeter (value vs target) and PairBars (yesterday vs
 * today). They live inside KPI tiles, so they render without ChartFrame but always carry an accessible label
 * (role="img") generated from the data. Draw-in on first view and value changes run on the DOM nodes
 * (stroke-dashoffset / attribute tweens / CSS transform transitions), never a React render per frame.
 */
import { useRef } from 'react'
import { extentOf, monotoneArea, monotoneLine } from './monotone'
import { useVizLang } from './ChartFrame'
import { rv, useAttrTween, useReveal, useRevealDom, useSize, vizMode } from './core'
import './viz.css'

export interface SparklineProps {
  values: number[]
  /** Accessible label prefix, e.g. "Aduan 14 hari". */
  label: string
  height?: number
  color?: string
  /** Light 16% area under the line. */
  area?: boolean
  format?: (v: number) => string
  className?: string
}

export function Sparkline({ values, label, height = 28, color = 'var(--dk-viz-acc)', area = false, format, className }: SparklineProps) {
  const { f, s } = useVizLang()
  const fmt = format ?? ((v: number) => f.num(v))
  const ref = useRef<HTMLDivElement>(null)
  const { w } = useSize(ref, 120)
  const vis = useRevealDom(ref)
  useAttrTween(ref, values, vis)
  const vals = values
  const [lo = 0, hi = 1] = extentOf(vals)
  const n = vals.length
  const x = (i: number) => 2 + (i / Math.max(1, n - 1)) * (w - 6)
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)
  // the same paths as d3-shape's monotone-x line / area (viz/monotone.ts), without the shared d3-shape chunk
  const xs = vals.map((_, i) => x(i))
  const ys = vals.map(y)
  const d = monotoneLine(xs, ys) ?? ''
  const a = area ? (monotoneArea(xs, ys, height) ?? '') : ''
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const aria = `${label}: ${last > first ? s.increase : last < first ? s.decrease : s.flat} ${s.from} ${fmt(first)} ${s.to} ${fmt(last)}`
  return (
    <div ref={ref} className={`dk-viz dk-viz-micro is-bare${className ? ` ${className}` : ''}`} role="img" aria-label={aria} style={{ display: 'block' }}>
      <svg className={`dk-viz-spark dk-viz-fade`} width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden="true">
        {a && <path {...rv('fade', { len: 0.66 })} data-tw="d" d={a} style={{ fill: color, fillOpacity: 0.16 }} />}
        <path {...rv('draw')} data-tw="d" d={d} fill="none" pathLength={1} style={{ stroke: color, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        {n > 0 && <circle {...rv('fade', { delay: 0.95, len: 0.05 })} data-tw="cx cy" cx={x(n - 1)} cy={y(vals[n - 1] ?? 0)} r={2.5} style={{ fill: color }} />}
      </svg>
    </div>
  )
}

export interface TargetMeterProps {
  value: number
  target: number
  max?: number
  label: string
  format?: (v: number) => string
}

export function TargetMeter({ value, target, max = 100, label, format }: TargetMeterProps) {
  const { f, s } = useVizLang()
  const fmt = format ?? ((v: number) => f.num(v, { digits: Number.isInteger(v) ? 0 : 1 }))
  const ref = useRef<HTMLDivElement>(null)
  const p = useReveal(ref)
  const anim = vizMode() === 'full' ? ' is-anim' : ''
  const k = Math.max(0, Math.min(1, value / (max || 1))) * p
  const color = value >= target ? 'var(--dk-viz-acc)' : 'var(--dk-viz-warn)'
  return (
    <div ref={ref} className="dk-viz dk-viz-micro is-bare" role="img" aria-label={`${label}: ${fmt(value)}, ${s.target.toLowerCase()} ${fmt(target)}`} style={{ display: 'block', paddingTop: 3 }}>
      <div className="dk-viz-meter" aria-hidden="true">
        <span className={`dk-viz-meter-fill${anim}`} style={{ transform: `scaleX(${k})`, background: color }} />
        <span className="dk-viz-meter-target" style={{ left: `${(Math.min(max, target) / (max || 1)) * 100}%` }} />
      </div>
    </div>
  )
}

export interface PairBarsProps {
  current: number
  previous: number
  /** [previous label, current label], e.g. ['Kemarin', 'Hari ini']. */
  labels: [string, string]
  format?: (v: number) => string
  label: string
}

export function PairBars({ current, previous, labels, format, label }: PairBarsProps) {
  const { f } = useVizLang()
  const fmt = format ?? ((v: number) => f.num(v))
  const ref = useRef<HTMLDivElement>(null)
  const p = useReveal(ref)
  const anim = vizMode() === 'full' ? ' is-anim' : ''
  const c = current
  const pr = previous
  const m = Math.max(Math.abs(c), Math.abs(pr)) || 1
  return (
    <div ref={ref} className="dk-viz dk-viz-micro is-bare dk-viz-pair" role="img" aria-label={`${label}: ${labels[0]} ${fmt(previous)}, ${labels[1]} ${fmt(current)}`} style={{ display: 'grid' }}>
      {[
        { k: labels[0], v: pr, prev: true },
        { k: labels[1], v: c, prev: false },
      ].map((r) => (
        <span className="dk-viz-pair-row" key={r.k} aria-hidden="true">
          <span>{r.k}</span>
          <span className="dk-viz-pair-track">
            <span className={`dk-viz-pair-bar${r.prev ? ' is-prev' : ''}${anim}`} style={{ transform: `scaleX(${(Math.abs(r.v) / m) * p})` }} />
          </span>
          <span className="dk-viz-pair-v">{fmt(r.v)}</span>
        </span>
      ))}
    </div>
  )
}
