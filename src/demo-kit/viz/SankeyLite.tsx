/**
 * SankeyLite — small flow diagram (≤ ~5 columns, ≤ ~20 nodes) with its own layout: columns by longest path
 * from the sources, nodes stacked by value, links as cubic bands. Links draw left → right on first view
 * (stroke-dashoffset), flows interpolate when values change, arrows walk the links.
 */
import { useMemo, useRef, type PointerEvent } from 'react'
import { ChartFrame, ChartTip, useVizLang, type FrameProps } from './ChartFrame'
import { localPoint, useIndexNav, useReveal, useSize, useTweened } from './core'
import { TONE, seriesColor, type Tone } from './palette'

export interface SankeyNode {
  id: string
  label: string
  /** Force a column (0-based); default: longest path from a source. */
  col?: number
  color?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
  tone?: Tone
}

export interface SankeyProps extends FrameProps {
  nodes: SankeyNode[]
  links: SankeyLink[]
  format?: (v: number) => string
  height?: number
}

interface LNode {
  id: string
  label: string
  col: number
  value: number
  x: number
  y: number
  h: number
  color: string
}
interface LLink {
  i: number
  s: LNode
  t: LNode
  value: number
  w: number
  y0: number
  y1: number
  color: string
}

const NODE_W = 10

function layout(nodes: SankeyNode[], links: SankeyLink[], values: number[], W: number, H: number): { nodes: LNode[]; links: LLink[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, number[]>()
  const outgoing = new Map<string, number[]>()
  links.forEach((l, i) => {
    if (!byId.has(l.source) || !byId.has(l.target)) return
    outgoing.set(l.source, [...(outgoing.get(l.source) ?? []), i])
    incoming.set(l.target, [...(incoming.get(l.target) ?? []), i])
  })
  /* columns: longest path from sources (cycle-safe: depth capped at node count) */
  const col = new Map<string, number>()
  const depth = (id: string, seen: Set<string>): number => {
    const fixed = byId.get(id)?.col
    if (fixed !== undefined) return fixed
    if (col.has(id)) return col.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const ins = incoming.get(id) ?? []
    const d = ins.length ? Math.max(...ins.map((i) => depth(links[i]!.source, seen) + 1)) : 0
    col.set(id, d)
    return d
  }
  nodes.forEach((n) => depth(n.id, new Set()))
  const ncol = Math.max(1, ...nodes.map((n) => (n.col ?? col.get(n.id) ?? 0) + 1))
  const val = (id: string) => {
    const a = (incoming.get(id) ?? []).reduce((s, i) => s + (values[i] ?? 0), 0)
    const b = (outgoing.get(id) ?? []).reduce((s, i) => s + (values[i] ?? 0), 0)
    return Math.max(a, b)
  }
  const gap = 10
  const cols: SankeyNode[][] = Array.from({ length: ncol }, () => [])
  nodes.forEach((n) => cols[n.col ?? col.get(n.id) ?? 0]?.push(n))
  const ky = Math.min(...cols.filter((c) => c.length).map((c) => (H - gap * (c.length - 1)) / Math.max(1e-9, c.reduce((s, n) => s + val(n.id), 0))))
  const out = new Map<string, LNode>()
  let ci0 = 0
  cols.forEach((c, ci) => {
    const total = c.reduce((s, n) => s + val(n.id), 0) * ky + gap * (c.length - 1)
    let y = (H - total) / 2
    c.forEach((n) => {
      const h = Math.max(1, val(n.id) * ky)
      const x = ncol > 1 ? (ci / (ncol - 1)) * (W - NODE_W) : 0
      out.set(n.id, { id: n.id, label: n.label, col: ci, value: val(n.id), x, y, h, color: n.color ?? (ci === 0 ? seriesColor(ci0++) : 'var(--dk-viz-muted)') })
      y += h + gap
    })
  })
  /* link offsets: outgoing sorted by target y, incoming by source y */
  const sOff = new Map<string, number>()
  const tOff = new Map<string, number>()
  const ll: LLink[] = []
  const order = links.map((_, i) => i).filter((i) => out.has(links[i]!.source) && out.has(links[i]!.target))
  const sorted = [...order].sort((a, b) => out.get(links[a]!.target)!.y - out.get(links[b]!.target)!.y)
  const y0s = new Map<number, number>()
  sorted.forEach((i) => {
    const s = out.get(links[i]!.source)!
    const o = sOff.get(s.id) ?? 0
    const w = (values[i] ?? 0) * ky
    y0s.set(i, s.y + o + w / 2)
    sOff.set(s.id, o + w)
  })
  const sortedT = [...order].sort((a, b) => out.get(links[a]!.source)!.y - out.get(links[b]!.source)!.y)
  sortedT.forEach((i) => {
    const l = links[i]!
    const s = out.get(l.source)!
    const t = out.get(l.target)!
    const o = tOff.get(t.id) ?? 0
    const w = (values[i] ?? 0) * ky
    tOff.set(t.id, o + w)
    ll.push({ i, s, t, value: values[i] ?? 0, w, y0: y0s.get(i) ?? s.y, y1: t.y + o + w / 2, color: l.tone ? TONE[l.tone] : s.color })
  })
  ll.sort((a, b) => a.i - b.i)
  return { nodes: [...out.values()], links: ll }
}

export function SankeyLite(props: SankeyProps) {
  const { nodes, links } = props
  const { f, s } = useVizLang()
  const fmt = props.format ?? ((v: number) => f.num(v))
  const plotRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(plotRef)
  const p = useReveal(plotRef)
  const vals = useTweened(useMemo(() => links.map((l) => Math.max(0, l.value)), [links]))
  const H = props.height ?? (w < 520 ? 240 : 260)
  const L = useMemo(() => layout(nodes, links, vals, w, H), [nodes, links, vals, w, H])
  const nav = useIndexNav(L.links.length, { start: 0 })
  const act = nav.active
  const ncol = Math.max(...L.nodes.map((n) => n.col)) + 1
  const path = (l: LLink) => {
    const x0 = l.s.x + NODE_W
    const x1 = l.t.x
    const xm = (x0 + x1) / 2
    return `M${x0},${l.y0}C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}`
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = localPoint(e, e.currentTarget)
    /* nearest link band at this x: sample its bezier at the x fraction (cheap approximation) */
    let best: number | null = null
    let bestD = Infinity
    L.links.forEach((l, k) => {
      const x0 = l.s.x + NODE_W
      const x1 = l.t.x
      if (pt.x < x0 || pt.x > x1) return
      const t = (pt.x - x0) / (x1 - x0 || 1)
      const e3 = t * t * (3 - 2 * t)
      const y = l.y0 + (l.y1 - l.y0) * e3
      const d = Math.abs(pt.y - y) - l.w / 2
      if (d < bestD) {
        bestD = d
        best = k
      }
    })
    nav.point(bestD <= 4 ? best : null)
  }
  const summary = useMemo(() => {
    const top = [...links].sort((a, b) => b.value - a.value).slice(0, 3)
    const name = (id: string) => nodes.find((n) => n.id === id)?.label ?? id
    return `${nodes.length} ${s.nodes}, ${links.length} ${s.edges}. ${s.peak}: ${top.map((l) => `${name(l.source)} → ${name(l.target)} ${fmt(l.value)}`).join('; ')}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, s, f])
  const cur = act !== null ? L.links[act] : undefined
  const readout = cur ? `${cur.s.label} → ${cur.t.label}: ${fmt(links[cur.i]?.value ?? 0)}` : ''

  return (
    <ChartFrame {...props} autoSummary={summary} announce={nav.kbd ? readout : ''} hint={s.hintList}>
      <div ref={plotRef} className="dk-viz-plot" tabIndex={0} role="group" aria-label={`${props.title}. ${s.hintList}.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur}>
        <svg className={`dk-viz-svg dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={onMove} onPointerLeave={() => !nav.kbd && nav.point(null)} aria-hidden="true">
          <g className={`dk-viz-links${act !== null ? ' has-on' : ''}`}>
            {L.links.map((l, k) => (
              <path
                key={`${l.s.id}-${l.t.id}`}
                d={path(l)}
                className={`dk-viz-link${act === k ? ' is-on' : ''}`}
                pathLength={p < 1 ? 1 : undefined}
                style={{ stroke: l.color, strokeWidth: Math.max(1, l.w), ...(p < 1 ? { strokeDasharray: 1, strokeDashoffset: 1 - p } : {}) }}
              />
            ))}
          </g>
          {L.nodes.map((n) => {
            const last = n.col === ncol - 1
            const inside = !last
            return (
              <g key={n.id}>
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={2} style={{ fill: n.color }} />
                {n.h >= 12 && (
                  <text x={inside ? n.x + NODE_W + 6 : n.x - 6} y={n.y + n.h / 2 + 4} className={`${inside ? '' : 't-end '}t-strong`} style={{ opacity: Math.min(1, p * 1.5), paintOrder: 'stroke', stroke: 'var(--dk-viz-surface)', strokeWidth: 3, strokeLinejoin: 'round' }}>
                    {n.label}
                    <tspan className="t-muted" dx={5} style={{ fontWeight: 500 }}>
                      {fmt(n.value)}
                    </tspan>
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {cur && (
          <ChartTip x={(cur.s.x + NODE_W + cur.t.x) / 2} y={(cur.y0 + cur.y1) / 2 - cur.w / 2} width={w}>
            <span className="dk-viz-tip-h">
              {cur.s.label} → {cur.t.label}
            </span>
            <span className="dk-viz-tip-v">{fmt(links[cur.i]?.value ?? 0)}</span>
          </ChartTip>
        )}
      </div>
    </ChartFrame>
  )
}
