/**
 * BarChart — vertical or horizontal bars, optional ghost "previous" bars (yesterday vs today), target line and
 * diverging/deviation mode around zero (positive = accent, negative = danger ink). Bars grow on first view
 * (staggered), value changes interpolate, pointer + keyboard readout.
 */
import { useMemo, useRef, type PointerEvent, type ReactNode } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { max as d3max, min as d3min, sum as d3sum } from 'd3-array'
import { ChartFrame, ChartTip, TipRow, useVizLang, type FrameProps, type LegendItem } from './ChartFrame'
import { localPoint, stagger, useIndexNav, useReveal, useSize, useTweened } from './core'
import { TONE, type Tone } from './palette'

export interface BarDatum {
  id?: string
  label: string
  value: number
  /** Previous value drawn as a ghost bar behind (e.g. yesterday). */
  prev?: number
  color?: string
  tone?: Tone
  /** Extra tooltip line. */
  note?: string
}

export interface BarProps extends FrameProps {
  data: BarDatum[]
  orientation?: 'vertical' | 'horizontal'
  /** Deviation bars around zero; on automatically when a value is negative. */
  diverging?: boolean
  format?: (v: number) => string
  axisFormat?: (v: number) => string
  target?: { value: number; label: string }
  /** Legend labels for current / previous bars. */
  valueLabel?: string
  prevLabel?: string
  /** Print the value at the end of each bar (default: horizontal only). */
  valueLabels?: boolean
  height?: number
  onSelect?: (d: BarDatum, i: number) => void
}

const ROW = 30

export function BarChart(props: BarProps) {
  const { data, target, onSelect } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v, { digits: Number.isInteger(v) ? 0 : 1 }))
  const axisFmt = props.axisFormat ?? ((v: number) => f.compact(v))
  const horizontal = props.orientation === 'horizontal'
  const diverging = props.diverging ?? data.some((d) => d.value < 0)
  const hasPrev = data.some((d) => d.prev !== undefined)
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const n = data.length

  const domain = useMemo<[number, number]>(() => {
    const all = [...data.map((d) => d.value), ...data.map((d) => d.prev ?? 0), target?.value ?? 0, 0]
    let lo = d3min(all) ?? 0
    let hi = d3max(all) ?? 1
    if (diverging) {
      const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1
      lo = -m
      hi = m
    }
    if (lo === hi) hi = lo + 1
    return scaleLinear().domain([lo, hi]).nice(4).domain() as [number, number]
  }, [data, target, diverging])

  const flat = useMemo(() => [...data.map((d) => d.value), ...data.map((d) => d.prev ?? 0), domain[0], domain[1]], [data, domain])
  const tw = useTweened(flat)
  const vals = tw.slice(0, n)
  const prevs = tw.slice(n, 2 * n)
  const d0 = tw[2 * n] ?? domain[0]
  const d1 = tw[2 * n + 1] ?? domain[1]
  const ticks = useMemo(() => scaleLinear().domain(domain).ticks(horizontal ? Math.max(2, Math.floor(w / 120)) : 4), [domain, horizontal, w])

  const nav = useIndexNav(n, { start: 0 })
  const hi = nav.active

  const colorOf = (d: BarDatum, v: number) => d.color ?? (d.tone ? TONE[d.tone] : diverging ? (v < 0 ? TONE.neg : TONE.pos) : TONE.accent)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const summary = useMemo(() => {
    if (!n || !top || !bottom) return ''
    const base = `${n} ${s.points}. ${s.peak}: ${top.label} ${fmt(top.value)}; ${s.low}: ${bottom.label} ${fmt(bottom.value)}.`
    if (diverging) {
      const pos = data.filter((d) => d.value > 0).length
      return `${base} ${pos} ${s.positive}, ${data.filter((d) => d.value < 0).length} ${s.negative}.`
    }
    return `${base} ${s.total} ${fmt(d3sum(data, (d) => d.value))}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, s, f, diverging])

  const readout = hi !== null && data[hi] ? `${data[hi]!.label}: ${fmt(data[hi]!.value)}${data[hi]!.prev !== undefined ? ` (${props.prevLabel ?? ''} ${fmt(data[hi]!.prev!)})` : ''}` : ''
  const legend: LegendItem[] = []
  if (hasPrev) {
    legend.push({ label: props.valueLabel ?? s.today, color: TONE.accent, kind: 'bar' })
    legend.push({ label: props.prevLabel ?? '', color: 'var(--dk-viz-muted)', kind: 'bar' })
  } else if (diverging) {
    legend.push({ label: s.positive, color: TONE.pos, kind: 'bar' }, { label: s.negative, color: TONE.neg, kind: 'bar' })
  }
  if (target) legend.push({ label: target.label, color: 'var(--dk-viz-warn)', kind: 'dash' })

  let svg: ReactNode
  let tip: ReactNode = null
  let h: number

  if (horizontal) {
    const maxLabel = Math.max(...data.map((d) => d.label.length), 4)
    const labelW = Math.min(Math.round(w * 0.38), Math.ceil(maxLabel * 6.6) + 12)
    const valueW = props.valueLabels === false ? 8 : 64
    h = props.height ?? n * ROW + 26
    const sx = scaleLinear().domain([d0, d1]).range([labelW, Math.max(labelW + 20, w - valueW)])
    const zx = sx(Math.max(d0, Math.min(d1, 0)))
    const band = scaleBand<number>().domain(data.map((_, i) => i)).range([0, n * ROW]).paddingInner(0.3).paddingOuter(0.15)
    const bh = band.bandwidth()
    const onMove = (e: PointerEvent<SVGSVGElement>) => {
      const y = localPoint(e, e.currentTarget).y
      const i = Math.floor(y / ROW)
      nav.point(i >= 0 && i < n ? i : null)
    }
    svg = (
      <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} onClick={() => hi !== null && data[hi] && onSelect?.(data[hi]!, hi)} aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={0} y2={n * ROW} className={t === 0 ? 'dk-viz-base' : 'dk-viz-grid'} />
            <text x={sx(t)} y={n * ROW + 16} className="t-mid">
              {axisFmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const y = band(i) ?? 0
          const k = stagger(p, i, n, 0.4)
          const v = (vals[i] ?? 0) * k
          const pv = (prevs[i] ?? 0) * k
          const x1 = sx(v)
          return (
            <g key={d.id ?? d.label}>
              <rect className={`dk-viz-barhit${hi === i ? ' is-on' : ''}`} x={0} y={i * ROW} width={w} height={ROW} rx={6} />
              <text x={labelW - 10} y={y + bh / 2 + 4} className={`t-end${hi === i ? ' t-strong' : ' t-muted'}`}>
                {d.label.length > maxLabel ? `${d.label.slice(0, maxLabel - 1)}…` : d.label}
              </text>
              {d.prev !== undefined && <rect className="dk-viz-bar is-ghost" x={Math.min(zx, sx(pv))} y={y - 2} width={Math.abs(sx(pv) - zx)} height={bh + 4} rx={3} style={{ fill: 'var(--dk-viz-muted)' }} />}
              <rect className="dk-viz-bar" x={Math.min(zx, x1)} y={y} width={Math.max(0, Math.abs(x1 - zx))} height={bh} rx={3} style={{ fill: colorOf(d, d.value) }} />
              {props.valueLabels !== false && (
                <text x={d.value < 0 ? Math.min(zx, x1) - 6 : Math.max(zx, x1) + 6} y={y + bh / 2 + 4} className={`${d.value < 0 ? 't-end ' : ''}t-strong`} style={{ opacity: k }}>
                  {fmt(d.value)}
                </text>
              )}
            </g>
          )
        })}
        {target && <line x1={sx(target.value)} x2={sx(target.value)} y1={-4} y2={n * ROW + 4} className="dk-viz-target" />}
      </svg>
    )
    if (hi !== null && data[hi]) {
      const d = data[hi]!
      tip = (
        <ChartTip x={Math.min(w - 20, Math.max(zx, sx(vals[hi] ?? 0)))} y={(band(hi) ?? 0) + bh / 2} width={w} below={hi === 0}>
          <span className="dk-viz-tip-h">{d.label}</span>
          <span className="dk-viz-tip-v">{fmt(d.value)}</span>
          {d.prev !== undefined && <TipRow label={props.prevLabel ?? ''} value={fmt(d.prev)} />}
          {d.note && <span className="dk-viz-tip-h">{d.note}</span>}
        </ChartTip>
      )
    }
  } else {
    h = props.height ?? (w < 520 ? 200 : 240)
    const PADB = 24
    const PADT = 12
    const tickW = Math.max(...ticks.map((t) => axisFmt(t).length), 2) * 6.2 + 10
    const PADL = Math.ceil(tickW)
    const band = scaleBand<number>().domain(data.map((_, i) => i)).range([PADL, w - 8]).paddingInner(n > 16 ? 0.2 : 0.32).paddingOuter(0.2)
    const bw = band.bandwidth()
    const sy = scaleLinear().domain([d0, d1]).range([h - PADB, PADT])
    const zy = sy(Math.max(d0, Math.min(d1, 0)))
    const every = Math.max(1, Math.ceil((n * 56) / Math.max(1, w - PADL)))
    const onMove = (e: PointerEvent<SVGSVGElement>) => {
      const x = localPoint(e, e.currentTarget).x
      const step = band.step()
      const i = Math.floor((x - PADL - band.paddingOuter() * step) / step)
      nav.point(i >= 0 && i < n ? i : null)
    }
    svg = (
      <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} onClick={() => hi !== null && data[hi] && onSelect?.(data[hi]!, hi)} aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PADL} x2={w - 8} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'dk-viz-base' : 'dk-viz-grid'} />
            <text x={PADL - 8} y={sy(t) + 4} className="t-end">
              {axisFmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = band(i) ?? 0
          const k = stagger(p, i, n, 0.4)
          const v = (vals[i] ?? 0) * k
          const pv = (prevs[i] ?? 0) * k
          const y1 = sy(v)
          return (
            <g key={d.id ?? d.label}>
              <rect className={`dk-viz-barhit${hi === i ? ' is-on' : ''}`} x={x - (band.step() - bw) / 2} y={PADT} width={band.step()} height={h - PADB - PADT} rx={4} />
              {d.prev !== undefined && <rect className="dk-viz-bar is-ghost" x={x - 2} y={Math.min(zy, sy(pv))} width={bw + 4} height={Math.abs(sy(pv) - zy)} rx={3} style={{ fill: 'var(--dk-viz-muted)' }} />}
              <rect className="dk-viz-bar" x={x} y={Math.min(zy, y1)} width={bw} height={Math.max(0, Math.abs(y1 - zy))} rx={Math.min(3, bw / 3)} style={{ fill: colorOf(d, d.value) }} />
              {i % every === 0 && (
                <text x={x + bw / 2} y={h - 7} className={`t-mid${hi === i ? ' t-strong' : ''}`}>
                  {d.label}
                </text>
              )}
              {props.valueLabels && bw > 26 && (
                <text x={x + bw / 2} y={d.value < 0 ? Math.max(zy, y1) + 14 : Math.min(zy, y1) - 6} className="t-mid t-strong" style={{ opacity: k }}>
                  {fmt(d.value)}
                </text>
              )}
            </g>
          )
        })}
        {target && (
          <g>
            <line x1={PADL} x2={w - 8} y1={sy(target.value)} y2={sy(target.value)} className="dk-viz-target" />
            <text x={w - 8} y={sy(target.value) - 5} className="t-end" style={{ fill: 'var(--dk-viz-warn)' }}>
              {target.label}
            </text>
          </g>
        )}
      </svg>
    )
    if (hi !== null && data[hi]) {
      const d = data[hi]!
      tip = (
        <ChartTip x={(band(hi) ?? 0) + bw / 2} y={sy(Math.max(0, vals[hi] ?? 0))} width={w}>
          <span className="dk-viz-tip-h">{d.label}</span>
          <span className="dk-viz-tip-v">{fmt(d.value)}</span>
          {d.prev !== undefined && <TipRow label={props.prevLabel ?? ''} value={fmt(d.prev)} />}
          {d.note && <span className="dk-viz-tip-h">{d.note}</span>}
        </ChartTip>
      )
    }
  }

  return (
    <ChartFrame {...props} autoSummary={summary} legend={legend} announce={nav.kbd ? readout : ''} hint={s.hintList}>
      <div
        ref={plotRef}
        className="dk-viz-plot"
        tabIndex={0}
        role="group"
        aria-label={`${props.title}. ${s.hintList}.`}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && hi !== null && data[hi] && onSelect) {
            e.preventDefault()
            onSelect(data[hi]!, hi)
          } else nav.onKeyDown(e)
        }}
        onBlur={nav.onBlur}
        style={{ minHeight: h }}
      >
        {svg}
        {tip}
      </div>
    </ChartFrame>
  )
}
