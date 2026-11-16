/**
 * RadarChart — 3–10 axes, ≤ 6 series (polygon 2px + 16% fill). Grows from the centre on first view; values
 * interpolate. Arrow keys walk the axes and read every series at that axis.
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { lineRadial, curveLinearClosed } from 'd3-shape'
import { max as d3max } from 'd3-array'
import { ChartFrame, ChartTip, TipRow, useVizLang, type FrameProps, type LegendItem } from './ChartFrame'
import { flatten, localPoint, unflatten, useIndexNav, useReveal, useSize, useTweened } from './core'
import { seriesColor } from './palette'

export interface RadarSeries {
  id: string
  label: string
  values: number[]
  color?: string
}

export interface RadarProps extends FrameProps {
  axes: string[]
  series: RadarSeries[]
  /** Scale maximum (default: max value, niced to 10s). */
  max?: number
  format?: (v: number) => string
  size?: number
}

export function RadarChart(props: RadarProps) {
  const { axes, series } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v, { digits: Number.isInteger(v) ? 0 : 1 }))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const n = axes.length
  const max = props.max ?? Math.ceil((d3max(series.flatMap((d) => d.values)) ?? 1) / 10) * 10
  const shape = useMemo(() => series.map((d) => d.values), [series])
  const vals = unflatten(useTweened(useMemo(() => flatten(shape), [shape])), shape)
  const size = Math.min(props.size ?? 300, Math.max(200, w - 20))
  const labelPad = w < 420 ? 52 : 70
  const r = size / 2 - labelPad / 2
  const W = Math.max(size + labelPad, Math.min(w, size + 2 * labelPad))
  const H = size + 20
  const angle = (i: number) => (i / n) * Math.PI * 2
  const rr = (v: number) => (Math.max(0, v) / (max || 1)) * r * p
  const radial = lineRadial<number>()
    .angle((_, i) => angle(i))
    .radius((v) => rr(v))
    .curve(curveLinearClosed)
  const nav = useIndexNav(n, { start: 0 })
  const hi = nav.active
  const colorOf = (i: number) => series[i]?.color ?? seriesColor(i)
  const rings = [0.25, 0.5, 0.75, 1]
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    const dx = pt.x - W / 2
    const dy = pt.y - H / 2
    if (Math.hypot(dx, dy) > r + 30) {
      nav.point(null)
      return
    }
    let a = Math.atan2(dx, -dy)
    if (a < 0) a += Math.PI * 2
    nav.point(Math.round(a / ((Math.PI * 2) / n)) % n)
  }
  const summary = useMemo(
    () =>
      series
        .map((d) => {
          const top = d.values.indexOf(Math.max(...d.values))
          const low = d.values.indexOf(Math.min(...d.values))
          return `${d.label}: ${axes.map((a, i) => `${a} ${fmt(d.values[i] ?? 0)}`).join(', ')}. ${s.peak} ${axes[top]}, ${s.low} ${axes[low]}.`
        })
        .join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, axes, s, f],
  )
  const readout = hi !== null ? `${axes[hi]}: ${series.map((d) => `${d.label} ${fmt(d.values[hi] ?? 0)}`).join(', ')}` : ''
  const legend: LegendItem[] = series.map((d, i) => ({ label: d.label, color: colorOf(i), kind: 'area' }))
  const pt = (i: number, rad: number) => ({ x: Math.sin(angle(i)) * rad, y: -Math.cos(angle(i)) * rad })

  return (
    <ChartFrame {...props} autoSummary={summary} legend={legend} announce={nav.kbd ? readout : ''} hint={s.hintList}>
      <div ref={plotRef} className="dk-viz-plot" tabIndex={0} role="group" aria-label={`${props.title}. ${s.hintList}.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} style={{ display: 'grid', justifyItems: 'center' }}>
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={W} height={H} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} aria-hidden="true">
          {rings.map((k) => (
            <polygon key={k} points={axes.map((_, i) => `${pt(i, r * k).x},${pt(i, r * k).y}`).join(' ')} className="dk-viz-grid" fill="none" />
          ))}
          {axes.map((a, i) => {
            const o = pt(i, r)
            const l = pt(i, r + 12)
            const anchor = Math.abs(l.x) < 4 ? 't-mid' : l.x > 0 ? '' : 't-end'
            return (
              <g key={a}>
                <line x1={0} y1={0} x2={o.x} y2={o.y} className={hi === i ? 'dk-viz-base' : 'dk-viz-grid'} />
                <text x={l.x} y={l.y + (l.y > 4 ? 10 : l.y < -4 ? -2 : 4)} className={`${anchor}${hi === i ? ' t-strong' : ' t-muted'}`}>
                  {a}
                </text>
              </g>
            )
          })}
          {vals.map((v, si) => (
            <path key={series[si]?.id} d={radial(v) ?? ''} className="dk-viz-line" style={{ stroke: colorOf(si), fill: colorOf(si), fillOpacity: 0.16 }} />
          ))}
          {hi !== null &&
            vals.map((v, si) => {
              const o = pt(hi, rr(v[hi] ?? 0))
              return <circle key={si} cx={o.x} cy={o.y} r={4} className="dk-viz-dot" style={{ stroke: colorOf(si) }} />
            })}
        </svg>
        {hi !== null && (
          <ChartTip x={W / 2 + pt(hi, r * 0.6).x + (w - W) / 2} y={H / 2 + pt(hi, r * 0.6).y} width={w}>
            <span className="dk-viz-tip-h">{axes[hi]}</span>
            {series.map((d, i) => (
              <TipRow key={d.id} color={colorOf(i)} label={d.label} value={fmt(d.values[hi] ?? 0)} />
            ))}
          </ChartTip>
        )}
      </div>
    </ChartFrame>
  )
}
