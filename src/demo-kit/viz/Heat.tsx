/**
 * Heat — grid heatmap (rows × columns, e.g. day × hour). Fill = accent at an opacity scaled to the value, so
 * it follows the ecosystem theme. Cells fade in row by row; values interpolate; arrow keys move in 2D.
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { max as d3max, min as d3min } from 'd3-array'
import { ChartFrame, ChartTip, useVizLang, type FrameProps } from './ChartFrame'
import { flatten, localPoint, stagger, useIndexNav, useReveal, useSize, useTweened } from './core'

export interface HeatProps extends FrameProps {
  rows: string[]
  cols: string[]
  /** values[row][col] */
  values: number[][]
  format?: (v: number) => string
  /** Show every n-th column label (default: auto by width). */
  colEvery?: number
  /** Fixed scale bounds (default: data min/max). */
  domain?: [number, number]
  /** Legend caption, e.g. "Sedikit → Banyak". */
  scaleLabels?: [string, string]
  cellHeight?: number
}

export function Heat(props: HeatProps) {
  const { rows, cols, values } = props
  const { f, s, lang } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const nr = rows.length
  const nc = cols.length
  const flatT = useMemo(() => flatten(values), [values])
  const flat = useTweened(flatT)
  const lo = props.domain?.[0] ?? d3min(flatT) ?? 0
  const hiV = props.domain?.[1] ?? d3max(flatT) ?? 1
  const labelW = Math.min(110, Math.ceil(Math.max(...rows.map((r) => r.length), 2) * 6.6) + 12)
  const cw = Math.max(6, (w - labelW) / Math.max(1, nc))
  const ch = props.cellHeight ?? Math.max(18, Math.min(30, cw))
  const H = nr * ch + 20
  const every = props.colEvery ?? Math.max(1, Math.ceil(28 / cw))
  const nav = useIndexNav(nr * nc, { start: 0, cols: nc })
  const act = nav.active
  const op = (v: number) => 0.08 + 0.92 * ((v - lo) / (hiV - lo || 1))
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    const c = Math.floor((pt.x - labelW) / cw)
    const r = Math.floor(pt.y / ch)
    nav.point(c >= 0 && c < nc && r >= 0 && r < nr ? r * nc + c : null)
  }
  const summary = useMemo(() => {
    let best = { v: -Infinity, r: 0, c: 0 }
    let worst = { v: Infinity, r: 0, c: 0 }
    values.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v > best.v) best = { v, r, c }
        if (v < worst.v) worst = { v, r, c }
      }),
    )
    const rowSums = values.map((row) => row.reduce((a, b) => a + b, 0))
    const topRow = rowSums.indexOf(Math.max(...rowSums))
    return `${nr} × ${nc}. ${s.peak}: ${rows[best.r]} ${cols[best.c]} (${fmt(best.v)}); ${s.low}: ${rows[worst.r]} ${cols[worst.c]} (${fmt(worst.v)}). ${lang === 'id' ? 'Baris terpadat' : 'Busiest row'}: ${rows[topRow]}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, rows, cols, s])
  const ar = act !== null ? Math.floor(act / nc) : -1
  const ac = act !== null ? act % nc : -1
  const readout = act !== null ? `${rows[ar]}, ${cols[ac]}: ${fmt(values[ar]?.[ac] ?? 0)}` : ''

  return (
    <ChartFrame {...props} autoSummary={summary} announce={nav.kbd ? readout : ''} hint={s.hintGrid}>
      <div ref={plotRef} className="dk-viz-plot" tabIndex={0} role="group" aria-label={`${props.title}. ${s.hintGrid}.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur}>
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} aria-hidden="true">
          {rows.map((r, ri) => (
            <text key={r} x={labelW - 8} y={ri * ch + ch / 2 + 4} className={`t-end${ri === ar ? ' t-strong' : ' t-muted'}`}>
              {r}
            </text>
          ))}
          {cols.map((c, ci) =>
            ci % every === 0 ? (
              <text key={c} x={labelW + ci * cw + cw / 2} y={nr * ch + 14} className={`t-mid${ci === ac ? ' t-strong' : ''}`}>
                {c}
              </text>
            ) : null,
          )}
          {rows.map((r, ri) =>
            cols.map((c, ci) => {
              const v = flat[ri * nc + ci] ?? 0
              const k = stagger(p, ri, nr, 0.5)
              const on = ri === ar && ci === ac
              return <rect key={`${r}-${c}`} className={`dk-viz-cell${on ? ' is-on' : ''}`} x={labelW + ci * cw} y={ri * ch} width={cw} height={ch} rx={Math.min(4, cw / 4)} style={{ fill: 'var(--dk-viz-acc)', fillOpacity: op(v) * k }} />
            }),
          )}
        </svg>
        {act !== null && (
          <ChartTip x={labelW + ac * cw + cw / 2} y={ar * ch} width={w}>
            <span className="dk-viz-tip-h">
              {rows[ar]} · {cols[ac]}
            </span>
            <span className="dk-viz-tip-v">
              {fmt(values[ar]?.[ac] ?? 0)}
              {props.unit && <small>{props.unit}</small>}
            </span>
          </ChartTip>
        )}
      </div>
      <div className="dk-viz-scale" aria-hidden="true">
        <span>{props.scaleLabels?.[0] ?? fmt(lo)}</span>
        <i />
        <span>{props.scaleLabels?.[1] ?? fmt(hiV)}</span>
      </div>
    </ChartFrame>
  )
}
