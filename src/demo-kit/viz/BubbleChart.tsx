/**
 * BubbleChart — topic clusters for Radar Isu: area = volume, colour = sentiment (−1 negative … +1 positive,
 * mixed between danger ink, neutral and the accent). Deterministic spiral packing; bubbles grow on first
 * view and glide to new sizes/positions when the data changes. Arrows walk topics by volume, Enter selects.
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { ChartFrame, ChartTip, TipRow, useVizLang, type FrameProps } from './ChartFrame'
import { localPoint, stagger, useIndexNav, useReveal, useSize, useTweened } from './core'
import { sentimentColor } from './palette'
import { packBubbles } from './pack'

export { packBubbles }

export interface BubbleDatum {
  id: string
  label: string
  volume: number
  /** −1 … 1 */
  sentiment: number
  note?: string
}

export interface BubbleProps extends FrameProps {
  data: BubbleDatum[]
  format?: (v: number) => string
  onSelect?: (d: BubbleDatum) => void
  selectedId?: string | null
  height?: number
}

/** Fit a label inside a circle on one or two lines (null when it does not fit). */
function labelLines(label: string, r: number, fs: number): string[] | null {
  const cw = fs * 0.56
  if (label.length * cw <= r * 1.7) return r >= 14 ? [label] : null
  const words = label.split(' ')
  if (words.length < 2) return null
  let best: string[] | null = null
  let bestLen = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const m = Math.max(a.length, b.length)
    if (m < bestLen) {
      bestLen = m
      best = [a, b]
    }
  }
  return best && bestLen * cw <= r * 1.5 ? best : null
}

export function BubbleChart(props: BubbleProps) {
  const { data, onSelect } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const H = props.height ?? (w < 520 ? 300 : 340)
  const packed = useMemo(() => packBubbles(data.map((d) => d.volume), Math.max(200, w), H), [data, w, H])
  const flat = useMemo(() => packed.flatMap((b) => [b.x, b.y, b.r, 0]).map((v, i) => (i % 4 === 3 ? (data[i >> 2]?.sentiment ?? 0) : v)), [packed, data])
  const tw = useTweened(flat, (i, to) => (i % 4 === 2 ? 0 : to))
  const order = useMemo(() => data.map((_, i) => i).sort((a, b) => (data[b]?.volume ?? 0) - (data[a]?.volume ?? 0)), [data])
  const nav = useIndexNav(data.length, { start: 0 })
  const act = nav.active !== null ? (order[nav.active] ?? null) : null
  const sentWord = (v: number) => (v <= -0.2 ? s.negative : v >= 0.2 ? s.positive : s.neutral)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    let hit: number | null = null
    data.forEach((_, i) => {
      const x = tw[i * 4] ?? 0
      const y = tw[i * 4 + 1] ?? 0
      const r = tw[i * 4 + 2] ?? 0
      if (Math.hypot(pt.x - x, pt.y - y) <= r) hit = i
    })
    nav.point(hit === null ? null : order.indexOf(hit))
  }
  const summary = useMemo(() => {
    const top = order.slice(0, 5).map((i) => data[i]!)
    const neg = data.filter((d) => d.sentiment <= -0.2).length
    return `${data.length} ${s.points}. ${top.map((d) => `${d.label}: ${s.volume.toLowerCase()} ${fmt(d.volume)}, ${s.sentiment.toLowerCase()} ${sentWord(d.sentiment)}`).join('; ')}. ${neg} ${s.negative}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, order, s, f])
  const cur = act !== null ? data[act] : undefined
  const readout = cur ? `${cur.label}: ${s.volume.toLowerCase()} ${fmt(cur.volume)}, ${s.sentiment.toLowerCase()} ${sentWord(cur.sentiment)} (${f.num(cur.sentiment, { digits: 2, signed: true })})` : ''

  return (
    <ChartFrame {...props} autoSummary={summary} announce={nav.kbd ? readout : ''} hint={s.hintList}>
      <div
        ref={plotRef}
        className="dk-viz-plot"
        tabIndex={0}
        role="group"
        aria-label={`${props.title}. ${s.hintList}.`}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && cur && onSelect) {
            e.preventDefault()
            onSelect(cur)
          } else nav.onKeyDown(e)
        }}
        onBlur={nav.onBlur}
      >
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} onClick={() => cur && onSelect?.(cur)} aria-hidden="true">
          {data.map((d, i) => {
            const x = tw[i * 4] ?? 0
            const y = tw[i * 4 + 1] ?? 0
            const k = stagger(p, order.indexOf(i), data.length, 0.5)
            const r = Math.max(0, (tw[i * 4 + 2] ?? 0) * (k < 1 ? 1 - (1 - k) ** 3 : 1))
            const sent = tw[i * 4 + 3] ?? d.sentiment
            const on = act === i || props.selectedId === d.id
            const fs = r > 46 ? 13 : 11
            const lines = labelLines(d.label, r, fs)
            const showVol = !!lines && r > 34 + (lines.length - 1) * 8
            const y0 = -((lines?.length ?? 1) - 1) * (fs * 0.6) - (showVol ? 6 : 0) + 4
            return (
              <g key={d.id} className={`dk-viz-bubble${on ? ' is-on' : ''}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <circle r={r + 3} className="is-ring" />
                <circle r={r} style={{ fill: sentimentColor(sent), fillOpacity: 0.9 }} />
                {lines && k >= 1 && (
                  <text className="t-mid" y={y0} style={{ fontSize: fs }}>
                    {lines.map((ln, li) => (
                      <tspan key={li} x={0} dy={li ? fs * 1.2 : 0}>
                        {ln}
                      </tspan>
                    ))}
                    {showVol && (
                      <tspan x={0} dy={fs * 1.3} style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                        {fmt(d.volume)}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {cur && act !== null && (
          <ChartTip x={tw[act * 4] ?? 0} y={(tw[act * 4 + 1] ?? 0) - (tw[act * 4 + 2] ?? 0)} width={w}>
            <span className="dk-viz-tip-h">{cur.label}</span>
            <TipRow label={s.volume} value={fmt(cur.volume)} />
            <TipRow color={sentimentColor(cur.sentiment)} label={s.sentiment} value={`${sentWord(cur.sentiment)} · ${f.num(cur.sentiment, { digits: 2, signed: true })}`} />
            {cur.note && <span className="dk-viz-tip-h">{cur.note}</span>}
          </ChartTip>
        )}
      </div>
      <div className="dk-viz-scale is-sent" aria-hidden="true">
        <span>{s.negative}</span>
        <i />
        <span>{s.positive}</span>
        <span style={{ marginLeft: 'auto' }}>{s.volume} = </span>
        <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true">
          <circle cx="6" cy="12" r="4" fill="none" stroke="currentColor" />
          <circle cx="23" cy="9" r="8" fill="none" stroke="currentColor" />
        </svg>
      </div>
    </ChartFrame>
  )
}
