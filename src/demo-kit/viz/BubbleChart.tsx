/**
 * BubbleChart — topic clusters for Radar Isu: area = volume, colour = sentiment (−1 negative … +1 positive,
 * mixed between danger ink, neutral and the accent). Deterministic spiral packing; bubbles grow on first
 * view (transform scale on the DOM nodes) and glide to new sizes/positions when the data changes (attribute
 * tweens on translate / r); React renders the final layout once. Arrows walk topics by volume, Enter selects.
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { ChartFrame, ChartTip, TipRow, useVizLang, type FrameProps } from './ChartFrame'
import { localPoint, rv, useAttrTween, useIndexNav, useRevealDom, useSize } from './core'
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

/** Average glyph advance of the label face (Manrope 600) as a share of the font size, a little generous. */
const CW = 0.6
/** Inner padding between a label and the bubble edge. */
const PAD_IN = 5

/**
 * Fit a label inside a circle on one or two lines, each line checked against the chord at its own height
 * (null when it does not fit with PAD_IN to spare on both sides).
 */
function labelLines(label: string, r: number, fs: number, withVol: boolean): string[] | null {
  if (r < 16) return null
  const lh = fs * 1.2
  const chord = (dy: number) => 2 * Math.sqrt(Math.max(0, r * r - dy * dy)) - 2 * PAD_IN
  const fits = (lines: string[]) => {
    const rows = lines.length + (withVol ? 1 : 0)
    const top = -((rows - 1) * lh) / 2
    // the worst row is the one furthest from the centre: check each with half a line of extra height
    return lines.every((ln, i) => ln.length * fs * CW <= chord(Math.abs(top + i * lh) + fs * 0.5)) && (rows * lh <= 2 * r - 2 * PAD_IN)
  }
  if (fits([label])) return [label]
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
  return best && fits(best) ? best : null
}

interface BubbleLabel {
  i: number
  /** inside: lines centred on the bubble; outside: one line next to it */
  lines: string[]
  vol: boolean
  out: null | Spot
  fs: number
}

type Box = { x0: number; y0: number; x1: number; y1: number }
/** An outside label spot, relative to the bubble centre; diagonal spots carry a short leader line from the rim. */
type Spot = { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; leader?: [number, number, number, number] }
const boxHitsCircle = (b: Box, x: number, y: number, r: number) => {
  const nx = Math.max(b.x0, Math.min(x, b.x1))
  const ny = Math.max(b.y0, Math.min(y, b.y1))
  return Math.hypot(nx - x, ny - y) < r
}
const boxesHit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/**
 * Label plan for a packed layout: a label sits INSIDE its bubble only when every line fits the chord; otherwise
 * it goes OUTSIDE, right next to the bubble (right, left, above, below — first spot that touches no bubble, no
 * other label and stays in the frame), else it is left to the tooltip / keyboard readout. Never overlaps.
 */
function planLabels(data: BubbleDatum[], packed: { x: number; y: number; r: number }[], W: number, H: number): BubbleLabel[] {
  const out: BubbleLabel[] = []
  const taken: Box[] = []
  const order = data.map((_, i) => i).sort((a, b) => (packed[b]?.r ?? 0) - (packed[a]?.r ?? 0))
  const pending: number[] = []
  for (const i of order) {
    const b = packed[i]
    const d = data[i]
    if (!b || !d) continue
    const fs = b.r > 46 ? 13 : 11
    const two = labelLines(d.label, b.r, fs, false)
    const vol = !!two && labelLines(d.label, b.r, fs, true) !== null && b.r >= 38
    const lines = vol ? (labelLines(d.label, b.r, fs, true) ?? two) : two
    if (lines) out.push({ i, lines, vol, out: null, fs })
    else pending.push(i)
  }
  for (const i of pending) {
    const b = packed[i]!
    const label = data[i]!.label
    const fs = 11
    const tw = label.length * fs * CW
    const th = fs * 1.3
    const gap = 4
    const spots: (Spot & { box: Box })[] = [
      { box: { x0: b.x + b.r + gap, y0: b.y - th / 2, x1: b.x + b.r + gap + tw, y1: b.y + th / 2 }, dx: b.r + gap, dy: 0, anchor: 'start' },
      { box: { x0: b.x - b.r - gap - tw, y0: b.y - th / 2, x1: b.x - b.r - gap, y1: b.y + th / 2 }, dx: -b.r - gap, dy: 0, anchor: 'end' },
      { box: { x0: b.x - tw / 2, y0: b.y - b.r - gap - th, x1: b.x + tw / 2, y1: b.y - b.r - gap }, dx: 0, dy: -b.r - gap - th / 2, anchor: 'middle' },
      { box: { x0: b.x - tw / 2, y0: b.y + b.r + gap, x1: b.x + tw / 2, y1: b.y + b.r + gap + th }, dx: 0, dy: b.r + gap + th / 2, anchor: 'middle' },
    ]
    // diagonals (NE, NW, SE, SW) with a 10 px leader from the rim
    for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) {
      const c = Math.SQRT1_2
      const L = 10
      const ex = sx * c * (b.r + L)
      const ey = sy * c * (b.r + L)
      const x0 = sx > 0 ? b.x + ex + 3 : b.x + ex - 3 - tw
      spots.push({
        box: { x0, y0: b.y + ey - th / 2, x1: x0 + tw, y1: b.y + ey + th / 2 },
        dx: ex + sx * 3,
        dy: ey,
        anchor: sx > 0 ? 'start' : 'end',
        leader: [sx * c * (b.r + 1), sy * c * (b.r + 1), ex, ey],
      })
    }
    const ok = spots.find(
      (sp) =>
        sp.box.x0 >= 2 &&
        sp.box.y0 >= 2 &&
        sp.box.x1 <= W - 2 &&
        sp.box.y1 <= H - 2 &&
        packed.every((q) => !boxHitsCircle(sp.box, q.x, q.y, q.r + 2)) &&
        taken.every((t) => !boxesHit(sp.box, t)),
    )
    if (!ok) continue
    taken.push(ok.box)
    out.push({ i, lines: [label], vol: false, out: { dx: ok.dx, dy: ok.dy, anchor: ok.anchor, leader: ok.leader }, fs })
  }
  return out
}

export function BubbleChart(props: BubbleProps) {
  const { data, onSelect } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const vis = useRevealDom(plotRef)
  const H = props.height ?? (w < 520 ? 300 : 340)
  const packed = useMemo(() => packBubbles(data.map((d) => d.volume), Math.max(200, w), H), [data, w, H])
  useAttrTween(plotRef, data, vis)
  const labels = useMemo(() => planLabels(data, packed, Math.max(200, w), H), [data, packed, w, H])
  const tw = useMemo(() => packed.flatMap((b) => [b.x, b.y, b.r]), [packed])
  const order = useMemo(() => data.map((_, i) => i).sort((a, b) => (data[b]?.volume ?? 0) - (data[a]?.volume ?? 0)), [data])
  const nav = useIndexNav(data.length, { start: 0 })
  const act = nav.active !== null ? (order[nav.active] ?? null) : null
  const sentWord = (v: number) => (v <= -0.2 ? s.negative : v >= 0.2 ? s.positive : s.neutral)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    let hit: number | null = null
    data.forEach((_, i) => {
      const x = tw[i * 3] ?? 0
      const y = tw[i * 3 + 1] ?? 0
      const r = tw[i * 3 + 2] ?? 0
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
        <svg className={`dk-viz-svg dk-viz-fade`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} onClick={() => cur && onSelect?.(cur)} aria-hidden="true">
          {data.map((d, i) => {
            const x = tw[i * 3] ?? 0
            const y = tw[i * 3 + 1] ?? 0
            const r = Math.max(0, tw[i * 3 + 2] ?? 0)
            const on = act === i || props.selectedId === d.id
            const oi = order.indexOf(i)
            const st = data.length > 1 ? (oi / (data.length - 1)) * 0.5 : 0
            return (
              <g key={d.id} className={`dk-viz-bubble${on ? ' is-on' : ''}`} data-tw="transform" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <g {...rv('s', { delay: st, len: 0.5, origin: 'svg:0 0' })}>
                  <circle data-tw="r" r={r + 3} className="is-ring" />
                  <circle data-tw="r" r={r} style={{ fill: sentimentColor(d.sentiment), fillOpacity: 0.9 }} />
                </g>
              </g>
            )
          })}
          {/* labels: one layer that fades in once the bubbles are grown (scaling text re-lays glyphs every frame) */}
          <g className="dk-viz-bubble-labels" {...rv('fade', { delay: 0.85, len: 0.15 })}>
            {labels.map(({ i, lines, vol, out, fs }) => {
              const d = data[i]!
              const x = tw[i * 3] ?? 0
              const y = tw[i * 3 + 1] ?? 0
              if (out)
                return (
                  <g key={d.id} data-tw="transform" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                    {out.leader && <line className="dk-viz-bubble-leader" x1={out.leader[0]} y1={out.leader[1]} x2={out.leader[2]} y2={out.leader[3]} />}
                    <text className="is-out" x={out.dx} y={out.dy + 4} textAnchor={out.anchor} style={{ fontSize: fs }}>
                      {lines[0]}
                    </text>
                  </g>
                )
              const y0 = -((lines.length - 1 + (vol ? 1 : 0)) * fs * 1.2) / 2 + 4
              return (
                <text key={d.id} data-tw="transform" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="t-mid" y={y0} style={{ fontSize: fs }}>
                  {lines.map((ln, li) => (
                    <tspan key={li} x={0} dy={li ? fs * 1.2 : 0}>
                      {ln}
                    </tspan>
                  ))}
                  {vol && (
                    <tspan x={0} dy={fs * 1.2} style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                      {fmt(d.volume)}
                    </tspan>
                  )}
                </text>
              )
            })}
          </g>
        </svg>
        {cur && act !== null && (
          <ChartTip x={tw[act * 3] ?? 0} y={(tw[act * 3 + 1] ?? 0) - (tw[act * 3 + 2] ?? 0)} width={w}>
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
