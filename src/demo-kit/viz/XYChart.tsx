/**
 * LineChart / AreaChart — time or category series on a shared x index. Lines 2px, areas 16%, forecast as a
 * 10% band + dashed line (spec §8.4). Pointer tooltip with a vertical crosshair, ←/→ keyboard readout,
 * stroke-dashoffset draw-in on first view, GSAP-interpolated updates (values and y-domain).
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { scaleLinear } from 'd3-scale'
import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape'
import { extent, max as d3max, min as d3min } from 'd3-array'
import { ChartFrame, ChartTip, TipRow, useVizLang, type FrameProps, type LegendItem } from './ChartFrame'
import { flatten, localPoint, unflatten, useIndexNav, useReveal, useSize, useTweened } from './core'
import { seriesColor } from './palette'
import type { Formatters } from './format'
import type { VizStrings } from './i18n'

export type XValue = string | number | Date

export interface XYSeries {
  id: string
  label: string
  /** One value per x index (may be shorter than `x`, e.g. actuals before a forecast). */
  values: number[]
  /** CSS colour; default: categorical palette by position (accent first). */
  color?: string
  dashed?: boolean
}

export interface Forecast {
  /** Values for the x indices after the first series ends. */
  values: number[]
  /** Lower / upper bound per forecast value (band). */
  lo?: number[]
  hi?: number[]
  label?: string
}

export interface XYProps extends FrameProps {
  x: XValue[]
  series: XYSeries[]
  /** Tick + tooltip label for an x value. Default: Date → "17 Nov", number → num, string as is. */
  xFormat?: (x: XValue, i: number) => string
  /** Value formatter (tooltip + summary). Default: num. */
  format?: (v: number) => string
  /** Y-axis tick formatter. Default: compact. */
  axisFormat?: (v: number) => string
  yDomain?: [number, number]
  /** Start the y axis at 0 (default true for areas, false for lines). */
  zero?: boolean
  /** Vertical marker, e.g. { index: 29, label: 'Hari ini' }. */
  marker?: { index: number; label: string }
  /** Horizontal target line. */
  target?: { value: number; label: string }
  height?: number
}

export interface AreaProps extends XYProps {
  forecast?: Forecast
}

interface Inner extends AreaProps {
  kind: 'line' | 'area'
}

const PAD = { r: 12, t: 12, b: 24 }

function defaultX(f: Formatters) {
  return (x: XValue) => (x instanceof Date ? f.dateWib(x, 'dayMonth') : typeof x === 'number' ? f.num(x) : x)
}

function seriesSummary(s: VizStrings, f: Formatters, fmt: (v: number) => string, xf: (x: XValue, i: number) => string, x: XValue[], ser: XYSeries): string {
  const v = ser.values
  if (!v.length) return ''
  const first = v[0] ?? 0
  const last = v[v.length - 1] ?? 0
  const hi = d3max(v) ?? 0
  const lo = d3min(v) ?? 0
  const hiI = v.indexOf(hi)
  const loI = v.indexOf(lo)
  const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0
  const dir = last > first ? s.increase : last < first ? s.decrease : s.flat
  const xs = (i: number) => (x[i] !== undefined ? xf(x[i] as XValue, i) : String(i + 1))
  return `${ser.label}: ${dir} ${s.from} ${fmt(first)} ${s.to} ${fmt(last)}${first !== 0 ? ` (${f.percent(pct, { signed: true })})` : ''}; ${s.peak} ${fmt(hi)} ${s.at} ${xs(hiI)}, ${s.low} ${fmt(lo)} ${s.at} ${xs(loI)}.`
}

function XYChart(props: Inner) {
  const { kind, x, series, forecast, marker, target, height } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v, { digits: Math.abs(v) < 10 && !Number.isInteger(v) ? 1 : 0 }))
  const axisFmt = props.axisFormat ?? ((v: number) => f.compact(v))
  const xf = props.xFormat ?? defaultX(f)
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const h = height ?? (w < 520 ? 200 : 240)
  const N = Math.max(1, x.length)
  const actualN = series[0]?.values.length ?? 0
  const fc = kind === 'area' && forecast && forecast.values.length ? forecast : null

  /* target domain (niced) */
  const domain = useMemo<[number, number]>(() => {
    if (props.yDomain) return props.yDomain
    const all = [...series.flatMap((d) => d.values), ...(fc ? [...fc.values, ...(fc.lo ?? []), ...(fc.hi ?? [])] : []), ...(target ? [target.value] : [])]
    const [a = 0, b = 1] = extent(all) as [number | undefined, number | undefined]
    const zero = props.zero ?? kind === 'area'
    let lo = zero ? Math.min(0, a) : a
    let hi = b
    if (lo === hi) hi = lo + 1
    if (!zero) {
      const pad = (hi - lo) * 0.12
      lo -= pad
      hi += pad
    }
    const sc = scaleLinear().domain([lo, hi]).nice(4)
    return sc.domain() as [number, number]
  }, [props.yDomain, props.zero, series, fc, target, kind])

  /* tween everything numeric in one array */
  const shape = useMemo(() => [...series.map((d) => d.values), fc?.values ?? [], fc?.lo ?? [], fc?.hi ?? [], domain], [series, fc, domain])
  const flat = useMemo(() => flatten(shape), [shape])
  const tw = useTweened(flat)
  const rows = unflatten(tw, shape)
  const vals = rows.slice(0, series.length)
  const fcV = rows[series.length] ?? []
  const fcLo = rows[series.length + 1] ?? []
  const fcHi = rows[series.length + 2] ?? []
  const dom = rows[series.length + 3] ?? domain
  const y0 = dom[0] ?? 0
  const y1 = dom[1] ?? 1

  const ticksTarget = useMemo(() => scaleLinear().domain(domain).ticks(4), [domain])
  const tickW = Math.max(...ticksTarget.map((t) => axisFmt(t).length), 2) * 6.2 + 10
  const PADL = Math.ceil(tickW)
  const sx = scaleLinear().domain([0, N - 1 || 1]).range([PADL, Math.max(PADL + 10, w - PAD.r)])
  const sy = scaleLinear().domain([y0, y1]).range([h - PAD.b, PAD.t])
  const baseY = sy(Math.max(y0, Math.min(y1, 0)))

  const lineGen = d3line<number>().x((_, i) => sx(i)).y((v) => sy(v)).curve(curveMonotoneX)
  const areaGen = d3area<number>().x((_, i) => sx(i)).y0(baseY).y1((v) => sy(v)).curve(curveMonotoneX)

  const lastI = actualN - 1
  const lastV = vals[0]?.[lastI]
  let fcLine = ''
  let fcBand = ''
  if (fc && lastV !== undefined) {
    const pts: [number, number][] = [[lastI, lastV], ...fcV.map((v, i) => [lastI + 1 + i, v] as [number, number])]
    fcLine = d3line<[number, number]>().x((d) => sx(d[0])).y((d) => sy(d[1])).curve(curveMonotoneX)(pts) ?? ''
    if (fcLo.length && fcHi.length) {
      const band: [number, number, number][] = [[lastI, lastV, lastV], ...fcV.map((_, i) => [lastI + 1 + i, fcLo[i] ?? 0, fcHi[i] ?? 0] as [number, number, number])]
      fcBand =
        d3area<[number, number, number]>()
          .x((d) => sx(d[0]))
          .y0((d) => sy(d[1]))
          .y1((d) => sy(d[2]))
          .curve(curveMonotoneX)(band) ?? ''
    }
  }

  const nav = useIndexNav(N, { start: Math.max(0, lastI) })
  const hi = nav.active
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    nav.point(Math.max(0, Math.min(N - 1, Math.round(sx.invert(pt.x)))))
  }

  /* x ticks: evenly spaced, first and last always */
  const xticks = useMemo(() => {
    const want = Math.max(2, Math.min(N, Math.floor(w / 92)))
    const out = new Set<number>()
    for (let k = 0; k < want; k++) out.add(Math.round((k / (want - 1)) * (N - 1)))
    return [...out]
  }, [N, w])

  const colorOf = (i: number) => series[i]?.color ?? seriesColor(i)
  const legend: LegendItem[] = [
    ...series.map((d, i) => ({ label: d.label, color: colorOf(i), kind: (d.dashed ? 'dash' : kind === 'area' ? 'area' : 'line') as LegendItem['kind'] })),
    ...(fc ? [{ label: fc.label ?? s.forecast, color: colorOf(0), kind: 'dash' as const }] : []),
    ...(target ? [{ label: target.label, color: 'var(--dk-viz-warn)', kind: 'dash' as const }] : []),
  ]

  /* readout */
  const isFc = hi !== null && fc !== null && hi > lastI
  const valueAt = (si: number, i: number) => vals[si]?.[i]
  const readout = (() => {
    if (hi === null) return ''
    const xl = x[hi] !== undefined ? xf(x[hi] as XValue, hi) : ''
    if (isFc) {
      const k = hi - lastI - 1
      const lo = fc?.lo?.[k]
      const up = fc?.hi?.[k]
      return `${xl}: ${fc?.label ?? s.forecast} ${fmt(fc?.values[k] ?? 0)}${lo !== undefined && up !== undefined ? `, ${s.range} ${fmt(lo)}–${fmt(up)}` : ''}`
    }
    return `${xl}: ${series
      .map((d) => (d.values[hi] !== undefined ? `${d.label} ${fmt(d.values[hi] ?? 0)}` : ''))
      .filter(Boolean)
      .join(', ')}`
  })()

  const summary = useMemo(() => {
    const parts = series.slice(0, 4).map((d) => seriesSummary(s, f, fmt, xf, x, d))
    if (fc) parts.push(`${fc.label ?? s.forecast}: ${fmt(d3min(fc.values) ?? 0)}–${fmt(d3max(fc.values) ?? 0)} (${fc.values.length} ${s.points}).`)
    return parts.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, fc, s, f])

  const tipY = hi !== null ? sy(isFc ? (fcV[hi - lastI - 1] ?? 0) : (valueAt(0, hi) ?? y0)) : 0
  const drawn = p > 0
  const fade = p >= 1 ? 1 : Math.max(0, (p - 0.4) / 0.6)

  return (
    <ChartFrame {...props} autoSummary={summary} legend={legend} announce={nav.kbd ? readout : ''} hint={s.hintX}>
      <div
        ref={plotRef}
        className="dk-viz-plot"
        tabIndex={0}
        role="group"
        aria-label={`${props.title}${props.unit ? `, ${props.unit}` : ''}. ${s.hintX}.`}
        onKeyDown={nav.onKeyDown}
        onBlur={nav.onBlur}
      >
        <svg className={`dk-viz-svg${drawn ? '' : ' dk-viz-pre'} dk-viz-fade`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} aria-hidden="true">
          {ticksTarget.map((t) => {
            const yy = sy(t)
            if (yy < PAD.t - 1 || yy > h - PAD.b + 1) return null
            return (
              <g key={t}>
                <line x1={PADL} x2={w - PAD.r} y1={yy} y2={yy} className={t === 0 ? 'dk-viz-base' : 'dk-viz-grid'} />
                <text x={PADL - 8} y={yy + 4} className="t-end">
                  {axisFmt(t)}
                </text>
              </g>
            )
          })}
          {xticks.map((i) => (
            <text key={i} x={sx(i)} y={h - 7} className={i === 0 ? '' : i === N - 1 ? 't-end' : 't-mid'}>
              {x[i] !== undefined ? xf(x[i] as XValue, i) : ''}
            </text>
          ))}
          {marker && marker.index >= 0 && marker.index < N && (
            <g>
              <line x1={sx(marker.index)} x2={sx(marker.index)} y1={PAD.t} y2={h - PAD.b} className="dk-viz-marker" />
              <text x={sx(marker.index) + (sx(N - 1) - sx(marker.index) > 70 ? 6 : -6)} y={PAD.t + 10} className={`t-muted${sx(N - 1) - sx(marker.index) > 70 ? '' : ' t-end'}`} style={{ fontWeight: 600 }}>
                {marker.label}
              </text>
            </g>
          )}
          {kind === 'area' &&
            vals.map((v, i) => (
              <path key={`a-${series[i]?.id}`} d={areaGen(v) ?? ''} style={{ fill: colorOf(i), fillOpacity: 0.16, opacity: fade }} />
            ))}
          {fc && (
            <g style={{ opacity: p >= 1 ? 1 : Math.max(0, (p - 0.8) / 0.2) }}>
              {fcBand && <path d={fcBand} style={{ fill: colorOf(0), fillOpacity: 0.1 }} />}
              <path d={fcLine} className="dk-viz-line is-dash" style={{ stroke: colorOf(0), opacity: 0.9 }} />
            </g>
          )}
          {target && (
            <g>
              <line x1={PADL} x2={w - PAD.r} y1={sy(target.value)} y2={sy(target.value)} className="dk-viz-target" />
              <text x={w - PAD.r} y={sy(target.value) - 5} className="t-end" style={{ fill: 'var(--dk-viz-warn)' }}>
                {target.label}
              </text>
            </g>
          )}
          {vals.map((v, i) => {
            const ser = series[i]
            const d = lineGen(v) ?? ''
            const dashed = !!ser?.dashed
            const drawing = p < 1 && !dashed
            return (
              <path
                key={`l-${ser?.id}`}
                d={d}
                pathLength={drawing ? 1 : undefined}
                className={`dk-viz-line${dashed ? ' is-dash' : ''}`}
                style={{
                  stroke: colorOf(i),
                  ...(drawing ? { strokeDasharray: 1, strokeDashoffset: 1 - p } : {}),
                  ...(dashed ? { opacity: fade } : {}),
                }}
              />
            )
          })}
          {lastI >= 0 && lastV !== undefined && p >= 1 && <circle cx={sx(lastI)} cy={sy(lastV)} r={3.5} className="dk-viz-last" style={{ fill: colorOf(0) }} />}
          {hi !== null && (
            <g className="dk-viz-cross">
              <line x1={sx(hi)} x2={sx(hi)} y1={PAD.t} y2={h - PAD.b} />
              {isFc ? (
                <circle cx={sx(hi)} cy={sy(fcV[hi - lastI - 1] ?? 0)} r={4} className="dk-viz-dot" style={{ stroke: colorOf(0) }} />
              ) : (
                vals.map((v, i) => (v[hi] !== undefined ? <circle key={i} cx={sx(hi)} cy={sy(v[hi] ?? 0)} r={4} className="dk-viz-dot" style={{ stroke: colorOf(i) }} /> : null))
              )}
            </g>
          )}
        </svg>
        {hi !== null && (
          <ChartTip x={sx(hi)} y={tipY} width={w}>
            <span className="dk-viz-tip-h">{x[hi] !== undefined ? xf(x[hi] as XValue, hi) : ''}</span>
            {isFc ? (
              <>
                <TipRow color={colorOf(0)} dashed label={fc?.label ?? s.forecast} value={fmt(fc?.values[hi - lastI - 1] ?? 0)} />
                {fc?.lo && fc.hi && (
                  <span className="dk-viz-tip-h dk-viz-num">
                    {s.range} {fmt(fc.lo[hi - lastI - 1] ?? 0)}–{fmt(fc.hi[hi - lastI - 1] ?? 0)}
                  </span>
                )}
              </>
            ) : (
              series.map((d, i) => (d.values[hi] !== undefined ? <TipRow key={d.id} color={colorOf(i)} dashed={d.dashed} label={d.label} value={fmt(d.values[hi] ?? 0)} /> : null))
            )}
          </ChartTip>
        )}
      </div>
    </ChartFrame>
  )
}

/** Multi-series line chart (≤ 6 series). */
export function LineChart(props: XYProps) {
  return <XYChart {...props} kind="line" />
}

/** Area chart (16% fill) with an optional forecast band (10% area + dashed line) after the first series. */
export function AreaChart(props: AreaProps) {
  return <XYChart {...props} kind="area" />
}
