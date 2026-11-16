/**
 * Donut and Gauge. Donut: share of a whole with a list legend (hover / arrows highlight one slice), sweeps in
 * on first view. Gauge: a 240° meter with optional bands and target; `variant="score"` is the 0–1000 dial of
 * Rapor Usaha with grade bands and a Fraunces hero number.
 */
import { useMemo, useRef, type CSSProperties } from 'react'
import { arc as d3arc, pie as d3pie } from 'd3-shape'
import { sum as d3sum } from 'd3-array'
import { ChartFrame, useVizLang, type FrameProps } from './ChartFrame'
import { useIndexNav, useReveal, useSize, useTweened } from './core'
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
  const p = useReveal(plotRef)
  const vals = useTweened(useMemo(() => data.map((d) => Math.max(0, d.value)), [data]))
  const nav = useIndexNav(data.length, { start: 0 })
  const hi = nav.active
  const total = d3sum(data, (d) => Math.max(0, d.value))
  const size = props.size ?? (w < 420 ? 140 : 168)
  const r = size / 2
  const pie = d3pie<number>().sort(null).value((v) => v).startAngle(0).endAngle(Math.PI * 2 * p).padAngle(data.length > 1 ? 0.012 : 0)
  const arcs = pie(vals)
  const arc = d3arc<{ startAngle: number; endAngle: number; padAngle: number }>().innerRadius(r * 0.68).outerRadius(r).cornerRadius(2)
  const arcOn = d3arc<{ startAngle: number; endAngle: number; padAngle: number }>().innerRadius(r * 0.66).outerRadius(r + 3).cornerRadius(2)
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
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={size + 8} height={size + 8} viewBox={`${-r - 4} ${-r - 4} ${size + 8} ${size + 8}`} aria-hidden="true" onPointerLeave={() => !nav.kbd && nav.point(null)}>
          <circle r={(r + r * 0.68) / 2} fill="none" strokeWidth={r * 0.32} className="dk-viz-track" style={{ stroke: 'rgba(185,178,255,.08)', fill: 'none' }} />
          <g className={`dk-viz-arcs${hi !== null ? ' has-on' : ''}`}>
            {arcs.map((a, i) => (
              <path key={data[i]?.id ?? data[i]?.label ?? i} d={(hi === i ? arcOn : arc)(a) ?? ''} className={`dk-viz-arc${hi === i ? ' is-on' : ''}`} style={{ fill: colorOf(i) }} onPointerEnter={() => nav.point(i)} />
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
  const p = useReveal(plotRef)
  const [v] = useTweened(useMemo(() => [Math.max(min, Math.min(max, props.value))], [props.value, min, max]))
  const shown = min + ((v ?? min) - min) * p
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
  const summary = `${props.title}: ${fmt(props.value)} ${s.of} ${fmt(max)}${band?.label ? `, ${s.grade.toLowerCase()} ${band.label}` : ''}${props.target !== undefined ? `; ${s.target.toLowerCase()} ${fmt(props.target)}` : ''}.`

  return (
    <ChartFrame {...props} className={`is-centered${props.className ? ` ${props.className}` : ''}`} autoSummary={summary} hint={false}>
      <div ref={plotRef} className="dk-viz-plot" role="img" aria-label={summary} style={{ display: 'grid', justifyItems: 'center' }}>
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={size + 20} height={vh + 14} viewBox={`${-r - 10} ${-r - 10} ${size + 20} ${vh + 14}`} aria-hidden="true">
          <path d={arcG({ startAngle: A0, endAngle: A0 + SWEEP }) ?? ''} className="dk-viz-track" />
          {bands.map((b) => (
            <path key={`${b.from}-${b.to}`} d={thin({ startAngle: ang(b.from) + 0.01, endAngle: ang(b.to) - 0.01 }) ?? ''} style={{ fill: TONE[b.tone], opacity: band === b ? 0.95 : 0.4 }} />
          ))}
          <path d={arcG({ startAngle: A0, endAngle: Math.max(A0 + 0.001, tipA) }) ?? ''} style={{ fill: tone }} />
          <circle cx={Math.sin(tipA) * (r - th / 2)} cy={-Math.cos(tipA) * (r - th / 2)} r={th / 2 + 3} className="dk-viz-needle" style={{ stroke: 'var(--dk-viz-surface)', strokeWidth: 2 }} />
          {props.target !== undefined && (
            <line
              x1={Math.sin(ang(props.target)) * (r - th - 4)}
              y1={-Math.cos(ang(props.target)) * (r - th - 4)}
              x2={Math.sin(ang(props.target)) * (r + 8)}
              y2={-Math.cos(ang(props.target)) * (r + 8)}
              style={{ stroke: 'var(--dk-viz-text)', strokeWidth: 2, strokeLinecap: 'round' }}
            />
          )}
          <text y={score ? 6 : 4} className={`t-mid ${score ? 'dk-viz-hero' : 'dk-viz-center-v'}`}>
            {fmt(shown)}
          </text>
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
      </div>
    </ChartFrame>
  )
}
