/**
 * Donut and Gauge. Donut: share of a whole with a list legend (hover / arrows highlight one slice), sweeps in
 * on first view (each slice's stroke-dasharray grows from 0 in turn, written on the DOM node; no SVG mask,
 * which costs a full-layer raster per frame). Slices and the gauge arc are stroked circles /
 * arcs with pathLength 1, so data updates glide by tweening stroke-dasharray / -dashoffset attributes; no
 * React render per frame. Gauge: a 240° meter with optional bands and target; `variant="score"` is the 0–1000 dial of
 * Rapor Usaha with grade bands and a Fraunces hero number.
 */
import { useMemo, useRef, type CSSProperties } from 'react'
import { arc as d3arc } from 'd3-shape'
import { sum as d3sum } from 'd3-array'
import { ChartFrame, useVizLang, type FrameProps } from './ChartFrame'
import { rv, useAttrTween, useCountText, useIndexNav, useRevealDom, useSize } from './core'
import { TONE, seriesColor, type Tone } from './palette'

/* ------------------------------------------------------------------ Donut */

export interface DonutDatum {
  id?: string
  label: string
  value: number
  color?: string
}

export interface DonutProps extends FrameProps {
  data: DonutDatum[]
  format?: (v: number) => string
  /** Centre text; default: total + "Total". */
  center?: { value?: string; label?: string }
  /** Diameter in px (default 168, 140 on narrow frames). */
  size?: number
}

export function Donut(props: DonutProps) {
  const { data } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const vis = useRevealDom(plotRef)
  useAttrTween(plotRef, data, vis)
  const nav = useIndexNav(data.length, { start: 0 })
  const hi = nav.active
  const total = d3sum(data, (d) => Math.max(0, d.value))
  const size = props.size ?? (w < 420 ? 140 : 168)
  const r = size / 2
  /* slices = stroked circles (pathLength 1, rotated to start at 12 o'clock): dasharray = share, offset = start */
  const rm = (r + r * 0.68) / 2
  const thick = r * 0.32
  const gap = data.length > 1 ? 0.012 / (Math.PI * 2) : 0
  let acc = 0
  const slices = data.map((d) => {
    const share = total ? Math.max(0, d.value) / total : 0
    const sl = { start: acc, len: Math.max(0, share - gap) }
    acc += share
    return sl
  })
  const colorOf = (i: number) => data[i]?.color ?? seriesColor(i)
  const pct = (v: number) => (total ? (v / total) * 100 : 0)
  const summary = useMemo(() => {
    const parts = data.map((d) => `${d.label} ${fmt(d.value)} (${f.percent(pct(d.value), { digits: 0 })})`)
    return `${s.total} ${fmt(total)}. ${parts.join('; ')}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, s, f, total])
  const cur = hi !== null ? data[hi] : null
  const readout = cur ? `${cur.label}: ${fmt(cur.value)}, ${f.percent(pct(cur.value), { digits: 0 })}` : ''

  return (
    <ChartFrame {...props} autoSummary={summary} announce={nav.kbd ? readout : ''} hint={s.hintList}>
      <div ref={plotRef} className="dk-viz-plot dk-viz-split" tabIndex={0} role="group" aria-label={`${props.title}. ${s.hintList}.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur}>
        <svg className={`dk-viz-svg dk-viz-fade`} width={size + 8} height={size + 8} viewBox={`${-r - 4} ${-r - 4} ${size + 8} ${size + 8}`} aria-hidden="true" onPointerLeave={() => !nav.kbd && nav.point(null)}>
          <circle r={(r + r * 0.68) / 2} fill="none" strokeWidth={r * 0.32} className="dk-viz-track" style={{ stroke: 'rgba(185,178,255,.08)', fill: 'none' }} />
          <g className={`dk-viz-arcs${hi !== null ? ' has-on' : ''}`}>
            {slices.map((sl, i) => (
              <circle
                key={data[i]?.id ?? data[i]?.label ?? i}
                r={hi === i ? rm - 0.5 : rm}
                pathLength={1}
                transform="rotate(-90)"
                className={`dk-viz-arc${hi === i ? ' is-on' : ''}`}
                data-tw="stroke-dasharray stroke-dashoffset"
                {...rv('attr', { delay: Math.min(0.95, sl.start), len: Math.max(0.05, sl.len + gap), from: { 'stroke-dasharray': `0 1` } })}
                strokeDasharray={`${sl.len.toFixed(4)} ${(1 - sl.len).toFixed(4)}`}
                strokeDashoffset={(-sl.start).toFixed(4)}
                strokeWidth={hi === i ? thick + 5 : thick}
                style={{ fill: 'none', stroke: colorOf(i) }}
                onPointerEnter={() => nav.point(i)}
              />
            ))}
          </g>
          <text y={cur ? -2 : 4} className="t-mid dk-viz-center-v">
            {cur ? f.percent(pct(cur.value), { digits: 0 }) : (props.center?.value ?? fmt(total))}
          </text>
          <text y={cur ? 16 : 22} className="t-mid dk-viz-center-l">
            {cur ? (cur.label.length > 14 ? `${cur.label.slice(0, 13)}…` : cur.label) : (props.center?.label ?? s.total)}
          </text>
        </svg>
        <ul className="dk-viz-list" aria-hidden="true">
          {data.map((d, i) => (
            <li key={d.id ?? d.label} className={hi === i ? 'is-on' : ''} onPointerEnter={() => nav.point(i)} onPointerLeave={() => !nav.kbd && nav.point(null)}>
              <i className="dk-viz-key is-dot" style={{ '--k': colorOf(i) } as CSSProperties} />
              <span>{d.label}</span>
              <b>{fmt(d.value)}</b>
              <span>{f.percent(pct(d.value), { digits: 0 })}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ Gauge */

export interface GaugeBand {
  from: number
  to: number
  tone: Tone
  label?: string
}

export interface GaugeProps extends FrameProps {
  value: number
  min?: number
  max?: number
  target?: number
  bands?: GaugeBand[]
  format?: (v: number) => string
  /** Caption under the number (default: band label, else unit). */
  caption?: string
  /** 'score' = Rapor Usaha dial 0–1000 with grade bands. */
  variant?: 'meter' | 'score'
  size?: number
}

const SWEEP = (Math.PI * 4) / 3 // 240°
const A0 = -SWEEP / 2

const SCORE_BANDS: Record<'id' | 'en', GaugeBand[]> = {
  id: [
    { from: 0, to: 400, tone: 'neg', label: 'Berisiko' },
    { from: 400, to: 600, tone: 'warn', label: 'Perlu perhatian' },
    { from: 600, to: 800, tone: 'accent', label: 'Sehat' },
    { from: 800, to: 1000, tone: 'pos', label: 'Prima' },
  ],
  en: [
    { from: 0, to: 400, tone: 'neg', label: 'At risk' },
    { from: 400, to: 600, tone: 'warn', label: 'Needs attention' },
    { from: 600, to: 800, tone: 'accent', label: 'Healthy' },
    { from: 800, to: 1000, tone: 'pos', label: 'Excellent' },
  ],
}

export function Gauge(props: GaugeProps) {
  const { lang, f, s } = useVizLang()
  const score = props.variant === 'score'
  const min = props.min ?? 0
  const max = props.max ?? (score ? 1000 : 100)
  const bands = props.bands ?? (score ? SCORE_BANDS[lang] : [])
  const fmt = props.format ?? ((v: number) => f.num(v, { digits: score || Number.isInteger(v) ? 0 : 1 }))
  const plotRef = useRef<HTMLDivElement>(null)
  const shown = Math.max(min, Math.min(max, props.value))
  const numRef = useRef<HTMLSpanElement>(null)
  const playRef = useRef<() => () => void>(() => () => {})
  const vis = useRevealDom(plotRef, () => playRef.current())
  useAttrTween(plotRef, props.value, vis)
  playRef.current = useCountText(numRef, shown, fmt, vis, min)
  const size = props.size ?? (score ? 220 : 180)
  const r = size / 2
  const th = score ? 14 : 12
  const ang = (x: number) => A0 + ((Math.max(min, Math.min(max, x)) - min) / (max - min || 1)) * SWEEP
  const band = bands.find((b) => props.value >= b.from && props.value < b.to) ?? bands.find((b) => props.value >= b.to && b.to === max)
  const tone = band ? TONE[band.tone] : TONE.accent
  const arcG = d3arc<{ startAngle: number; endAngle: number }>().innerRadius(r - th).outerRadius(r).cornerRadius(th / 2)
  const thin = d3arc<{ startAngle: number; endAngle: number }>().innerRadius(r + 4).outerRadius(r + 7)
  const vh = r + r * Math.cos(SWEEP / 2) * -1 + 10 // visible height of the 240° arc
  const caption = props.caption ?? band?.label ?? props.unit ?? ''
  const tipA = ang(shown)
  const frac = Math.max(0.0005, (shown - min) / (max - min || 1))
  const rc = r - th / 2
  /* the 240° centre line from A0 clockwise (stroked with round caps = the old rounded arc) */
  const arcLine = `M${(Math.sin(A0) * rc).toFixed(2)},${(-Math.cos(A0) * rc).toFixed(2)}A${rc},${rc} 0 1 1 ${(Math.sin(A0 + SWEEP) * rc).toFixed(2)},${(-Math.cos(A0 + SWEEP) * rc).toFixed(2)}`
  const deg = (a: number) => (a * 180) / Math.PI
  const summary = `${props.title}: ${fmt(props.value)} ${s.of} ${fmt(max)}${band?.label ? `, ${s.grade.toLowerCase()} ${band.label}` : ''}${props.target !== undefined ? `; ${s.target.toLowerCase()} ${fmt(props.target)}` : ''}.`

  return (
    <ChartFrame {...props} className={`is-centered${props.className ? ` ${props.className}` : ''}`} autoSummary={summary} hint={false}>
      <div ref={plotRef} className="dk-viz-plot" role="img" aria-label={summary} style={{ display: 'grid', justifyItems: 'center', position: 'relative' }}>
        <svg className={`dk-viz-svg dk-viz-fade`} width={size + 20} height={vh + 14} viewBox={`${-r - 10} ${-r - 10} ${size + 20} ${vh + 14}`} aria-hidden="true">
          <path d={arcG({ startAngle: A0, endAngle: A0 + SWEEP }) ?? ''} className="dk-viz-track" />
          {bands.map((b) => (
            <path key={`${b.from}-${b.to}`} d={thin({ startAngle: ang(b.from) + 0.01, endAngle: ang(b.to) - 0.01 }) ?? ''} style={{ fill: TONE[b.tone], opacity: band === b ? 0.95 : 0.4 }} />
          ))}
          <path d={arcLine} pathLength={1} data-tw="stroke-dasharray" strokeDasharray={`${frac.toFixed(4)} 2`} {...rv('attr', { from: { 'stroke-dasharray': '0.0005 2' } })} style={{ fill: 'none', stroke: tone, strokeWidth: th, strokeLinecap: 'round' }} />
          <g data-tw="transform" transform={`rotate(${deg(tipA).toFixed(2)})`} {...rv('attr', { from: { transform: `rotate(${deg(A0).toFixed(2)})` } })}>
            <circle cx={0} cy={-rc} r={th / 2 + 3} className="dk-viz-needle" style={{ stroke: 'var(--dk-viz-surface)', strokeWidth: 2 }} />
          </g>
          {props.target !== undefined && (
            <line
              x1={Math.sin(ang(props.target)) * (r - th - 4)}
              y1={-Math.cos(ang(props.target)) * (r - th - 4)}
              x2={Math.sin(ang(props.target)) * (r + 8)}
              y2={-Math.cos(ang(props.target)) * (r + 8)}
              style={{ stroke: 'var(--dk-viz-text)', strokeWidth: 2, strokeLinecap: 'round' }}
            />
          )}
          <text y={score ? 30 : 24} className="t-mid t-muted" style={{ fontSize: 12, fontWeight: 600, fill: band ? tone : undefined }}>
            {caption}
          </text>
          <text x={Math.sin(A0) * (r - th / 2)} y={-Math.cos(A0) * (r - th / 2) + 20} className="t-mid">
            {fmt(min)}
          </text>
          <text x={Math.sin(A0 + SWEEP) * (r - th / 2)} y={-Math.cos(A0 + SWEEP) * (r - th / 2) + 20} className="t-mid">
            {fmt(max)}
          </text>
        </svg>
        {/* the rolling number is HTML in a contained box: a changing SVG <text> re-lays out the whole svg each frame */}
        <span ref={numRef} className={`dk-viz-gnum${score ? ' is-hero' : ''} dk-viz-fade`} style={{ top: score ? r - 19 : r - 5 }} aria-hidden="true">
          {fmt(shown)}
        </span>
      </div>
    </ChartFrame>
  )
}
