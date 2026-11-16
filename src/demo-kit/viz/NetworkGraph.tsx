/**
 * NetworkGraph — animated force layout (viz/force.ts) stepped on gsap.ticker; it cools down and stops, pauses
 * while off-screen, and re-heats on drag, resize or when a cluster unfolds. Nodes are draggable and keyboard
 * focusable (Enter selects and highlights neighbours); edges are clickable/focusable when `onEdgeSelect` is
 * given. Collapsed clusters render as one aggregate node; activating it unfolds its members from its position.
 * Positions are written straight to the DOM each frame (no React render per frame).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { gsap } from 'gsap'
import { ChartFrame, useVizLang, type FrameProps, type LegendItem } from './ChartFrame'
import { useReveal, useSize, useVisible, vizMode } from './core'
import { NET, hash01, idealLinkLength, makeLinks, settle, step, type Sim, type SimNode } from './force'
import { TONE, seriesColor } from './palette'

export interface NetNode {
  id: string
  label: string
  /** Palette slot (0–5) or a CSS colour via `color`. */
  group?: number
  color?: string
  /** Radius in px (default 7). */
  size?: number
  cluster?: string
  tone?: 'danger' | 'warn'
  /** Extra line for the accessible label / readout. */
  note?: string
}

export interface NetEdge {
  id?: string
  source: string
  target: string
  weight?: number
  label?: string
  tone?: 'danger' | 'warn'
}

export interface NetCluster {
  id: string
  label: string
  color?: string
}

export interface NetworkProps extends FrameProps {
  nodes: NetNode[]
  edges: NetEdge[]
  clusters?: NetCluster[]
  /** Controlled collapsed cluster ids. */
  collapsed?: string[]
  /** Uncontrolled initial collapsed clusters. */
  defaultCollapsed?: string[]
  onClusterToggle?: (clusterId: string, collapsed: boolean) => void
  onEdgeSelect?: (edge: NetEdge) => void
  onNodeSelect?: (node: NetNode | null) => void
  /** Highlighted edge id (controlled). */
  selectedEdge?: string | null
  legend?: LegendItem[]
  height?: number
}

interface VNode {
  id: string
  label: string
  r: number
  color: string
  tone?: 'danger' | 'warn'
  cluster?: string
  count?: number
  src?: NetNode
  note?: string
}
interface VEdge {
  key: string
  source: string
  target: string
  w: number
  tone?: 'danger' | 'warn'
  src?: NetEdge
}

const edgeKey = (e: NetEdge, i: number) => e.id ?? `${e.source}->${e.target}#${i}`
const CL = (id: string) => `cluster:${id}`

export function NetworkGraph(props: NetworkProps) {
  const { nodes, edges, clusters = [], onEdgeSelect, onNodeSelect, onClusterToggle } = props
  const { s } = useVizLang()
  const mode = vizMode()
  const wrapRef = useRef<HTMLDivElement>(null)
  const { w } = useSize(wrapRef)
  const p = useReveal(wrapRef)
  const visible = useVisible(wrapRef)
  const H = props.height ?? (w < 520 ? 320 : 380)

  const [innerCollapsed, setInnerCollapsed] = useState<string[]>(props.defaultCollapsed ?? [])
  const collapsed = props.collapsed ?? innerCollapsed
  const [selNode, setSelNode] = useState<string | null>(null)
  const [selEdgeInner, setSelEdgeInner] = useState<string | null>(null)
  const selEdge = props.selectedEdge !== undefined ? props.selectedEdge : selEdgeInner
  const [announce, setAnnounce] = useState('')

  /* ---------------- visible graph (collapsed clusters → aggregate nodes) */
  const view = useMemo(() => {
    const coll = new Set(collapsed)
    const vn: VNode[] = []
    const counts = new Map<string, number>()
    nodes.forEach((n) => {
      if (n.cluster && coll.has(n.cluster)) counts.set(n.cluster, (counts.get(n.cluster) ?? 0) + 1)
    })
    nodes.forEach((n) => {
      if (n.cluster && coll.has(n.cluster)) return
      vn.push({ id: n.id, label: n.label, r: n.size ?? 7, color: n.color ?? seriesColor(n.group ?? 0), tone: n.tone, cluster: n.cluster, src: n, note: n.note })
    })
    counts.forEach((c, id) => {
      const meta = clusters.find((x) => x.id === id)
      const idx = clusters.findIndex((x) => x.id === id)
      vn.push({ id: CL(id), label: meta?.label ?? id, r: 12 + Math.sqrt(c) * 3.2, color: meta?.color ?? seriesColor(idx >= 0 ? idx : 0), count: c, cluster: id })
    })
    const mapId = (id: string) => {
      const n = nodes.find((x) => x.id === id)
      return n?.cluster && coll.has(n.cluster) ? CL(n.cluster) : id
    }
    const merged = new Map<string, VEdge>()
    edges.forEach((e, i) => {
      const a = mapId(e.source)
      const b = mapId(e.target)
      if (a === b) return
      const real = a === e.source && b === e.target
      const key = real ? edgeKey(e, i) : `${a}~${b}`
      const prev = merged.get(key)
      if (prev) prev.w += e.weight ?? 1
      else merged.set(key, { key, source: a, target: b, w: e.weight ?? 1, tone: e.tone, src: real ? e : undefined })
    })
    return { nodes: vn, edges: [...merged.values()] }
  }, [nodes, edges, clusters, collapsed])

  /* ---------------- simulation state (persists across renders) */
  const simRef = useRef<Sim>({ nodes: [], links: [], alpha: 1, alphaTarget: 0, w: 640, h: H })
  const posRef = useRef(new Map<string, SimNode>())
  const nodeEls = useRef(new Map<string, SVGGElement>())
  const edgeEls = useRef(new Map<string, SVGLineElement[]>())
  const runningRef = useRef(false)
  const visibleRef = useRef(false)
  visibleRef.current = visible
  const unfoldFrom = useRef<Map<string, { x: number; y: number }>>(new Map())

  const paint = useCallback(() => {
    for (const n of simRef.current.nodes) {
      const el = nodeEls.current.get(n.id)
      if (!el) continue
      el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
      /* labels flip to the left of the node on the right side of the frame so they never leave it */
      const lbl = el.querySelector<SVGTextElement>('text[data-l]')
      if (lbl) {
        const left = n.x > simRef.current.w * 0.6
        lbl.setAttribute('x', String(left ? -(n.r + 5) : n.r + 5))
        lbl.setAttribute('text-anchor', left ? 'end' : 'start')
      }
    }
    for (const l of simRef.current.links) {
      const els = edgeEls.current.get(`${l.s.id}|${l.t.id}`)
      if (!els) continue
      for (const el of els) {
        el.setAttribute('x1', l.s.x.toFixed(1))
        el.setAttribute('y1', l.s.y.toFixed(1))
        el.setAttribute('x2', l.t.x.toFixed(1))
        el.setAttribute('y2', l.t.y.toFixed(1))
      }
    }
  }, [])

  const tick = useCallback(() => {
    const sim = simRef.current
    step(sim)
    paint()
    if (sim.alpha < NET.alphaMin && sim.alphaTarget === 0) stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint])

  const stop = useCallback(() => {
    if (!runningRef.current) return
    runningRef.current = false
    gsap.ticker.remove(tick)
  }, [tick])

  const start = useCallback(
    (alpha?: number) => {
      const sim = simRef.current
      if (alpha !== undefined) sim.alpha = Math.max(sim.alpha, alpha)
      if (mode !== 'full') {
        settle(sim)
        sim.alpha = 0
        paint()
        return
      }
      if (runningRef.current || !visibleRef.current) return
      runningRef.current = true
      gsap.ticker.add(tick)
    },
    [mode, paint, tick],
  )

  /* rebuild sim nodes/links when the visible graph or size changes */
  useLayoutEffect(() => {
    const sim = simRef.current
    const W = Math.max(200, w)
    const resized = sim.w !== W || sim.h !== H
    sim.w = W
    sim.h = H
    const prev = posRef.current
    const next = new Map<string, SimNode>()
    let born = 0
    for (const n of view.nodes) {
      let sn = prev.get(n.id)
      if (!sn) {
        born++
        const from = n.cluster ? unfoldFrom.current.get(n.cluster) : undefined
        const a = hash01(n.id) * Math.PI * 2
        const rad = from ? 6 + hash01(`${n.id}r`) * 10 : mode === 'full' ? 20 + hash01(`${n.id}r`) * 40 : 40 + hash01(`${n.id}r`) * Math.min(W, H) * 0.35
        const ox = from?.x ?? W / 2
        const oy = from?.y ?? H / 2
        sn = { id: n.id, x: ox + Math.cos(a) * rad, y: oy + Math.sin(a) * rad, vx: 0, vy: 0, r: n.r, fx: null, fy: null }
      }
      sn.r = n.r
      next.set(n.id, sn)
    }
    posRef.current = next
    sim.nodes = [...next.values()]
    sim.links = makeLinks(
      sim.nodes,
      view.edges.map((e) => ({ source: e.source, target: e.target, weight: e.w })),
      idealLinkLength(sim.nodes.length, W, H),
    )
    unfoldFrom.current.clear()
    if (born || resized) {
      sim.alpha = Math.max(sim.alpha, born ? 1 : NET.reheat * 0.5)
      start()
    }
    paint()
  }, [view, w, H, mode, start, paint])

  /* pause off-screen, resume when visible again */
  useEffect(() => {
    if (!visible) stop()
    else if (simRef.current.alpha >= NET.alphaMin) start()
  }, [visible, start, stop])
  useEffect(() => () => stop(), [stop])

  /* ---------------- interaction */
  const drag = useRef<{ id: string; x0: number; y0: number; moved: boolean; pid: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect()
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 }
  }

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>()
    view.edges.forEach((e) => {
      if (!m.has(e.source)) m.set(e.source, new Set())
      if (!m.has(e.target)) m.set(e.target, new Set())
      m.get(e.source)!.add(e.target)
      m.get(e.target)!.add(e.source)
    })
    return m
  }, [view.edges])

  const activate = (n: VNode) => {
    if (n.count !== undefined && n.cluster) {
      const pos = posRef.current.get(n.id)
      if (pos) unfoldFrom.current.set(n.cluster, { x: pos.x, y: pos.y })
      const nextList = collapsed.filter((c) => c !== n.cluster)
      if (props.collapsed === undefined) setInnerCollapsed(nextList)
      onClusterToggle?.(n.cluster, false)
      setAnnounce(`${n.label}: ${s.connections(n.count)}`)
      return
    }
    const nextSel = selNode === n.id ? null : n.id
    setSelNode(nextSel)
    onNodeSelect?.(nextSel ? (n.src ?? null) : null)
    const nb = neighbours.get(n.id)
    const names = nb ? [...nb].map((id) => view.nodes.find((x) => x.id === id)?.label ?? id) : []
    setAnnounce(nextSel ? `${n.label}${n.note ? `, ${n.note}` : ''}: ${s.connections(names.length)}${names.length ? ` — ${names.join(', ')}` : ''}` : '')
  }

  const onNodeDown = (e: PointerEvent<SVGGElement>, n: VNode) => {
    if (e.button !== 0) return
    const pt = local(e)
    drag.current = { id: n.id, x0: pt.x, y0: pt.y, moved: false, pid: e.pointerId }
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone (synthetic events) — dragging still works while over the svg */
    }
  }
  const onSvgMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const pt = local(e)
    if (!d.moved && Math.hypot(pt.x - d.x0, pt.y - d.y0) < 4) return
    d.moved = true
    const sn = posRef.current.get(d.id)
    if (!sn) return
    sn.fx = pt.x
    sn.fy = pt.y
    if (mode === 'full') {
      simRef.current.alphaTarget = 0.3
      start(NET.reheat * 0.5)
    } else {
      sn.x = pt.x
      sn.y = pt.y
      paint()
    }
  }
  const onSvgUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
    if (!d) return
    const sn = posRef.current.get(d.id)
    simRef.current.alphaTarget = 0
    if (d.moved) {
      if (sn && mode === 'full') {
        sn.fx = null
        sn.fy = null
      }
      return
    }
    const n = view.nodes.find((x) => x.id === d.id)
    if (n) activate(n)
  }

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, n: VNode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(n)
    } else if (e.key === 'Escape') {
      setSelNode(null)
      onNodeSelect?.(null)
      setAnnounce('')
    }
  }

  const pickEdge = (ve: VEdge) => {
    if (!ve.src) return
    if (props.selectedEdge === undefined) setSelEdgeInner(ve.key)
    onEdgeSelect?.(ve.src)
    const a = view.nodes.find((x) => x.id === ve.source)?.label ?? ve.source
    const b = view.nodes.find((x) => x.id === ve.target)?.label ?? ve.target
    setAnnounce(`${a} – ${b}${ve.src.label ? `: ${ve.src.label}` : ''}`)
  }

  /* ---------------- render */
  const near = selNode ? neighbours.get(selNode) : undefined
  const summary = useMemo(() => {
    const deg = new Map<string, number>()
    edges.forEach((e) => {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1)
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1)
    })
    const top = [...deg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const name = (id: string) => nodes.find((n) => n.id === id)?.label ?? id
    const flagged = nodes.filter((n) => n.tone === 'danger').map((n) => n.label)
    return `${nodes.length} ${s.nodes}, ${edges.length} ${s.edges}. ${s.peak}: ${top.map(([id, c]) => `${name(id)} (${s.connections(c)})`).join(', ')}.${flagged.length ? ` ⚠ ${flagged.join(', ')}.` : ''}${collapsed.map((c) => ` ${clusters.find((x) => x.id === c)?.label ?? c}: ${s.cluster(nodes.filter((n) => n.cluster === c).length)}`).join('')}`
  }, [nodes, edges, s, collapsed, clusters])
  const legend: LegendItem[] = props.legend ?? clusters.map((c, i) => ({ label: c.label, color: c.color ?? seriesColor(i), kind: 'dot' as const }))

  const pos = (id: string) => posRef.current.get(id) ?? { x: w / 2, y: H / 2 }
  /* re-index the DOM elements the ticker writes to, after every render */
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const em = new Map<string, SVGLineElement[]>()
    svg.querySelectorAll<SVGLineElement>('line[data-e]').forEach((el) => {
      const k = el.dataset.e ?? ''
      em.set(k, [...(em.get(k) ?? []), el])
    })
    edgeEls.current = em
    const nm = new Map<string, SVGGElement>()
    svg.querySelectorAll<SVGGElement>('g[data-n]').forEach((el) => nm.set(el.dataset.n ?? '', el))
    nodeEls.current = nm
  })
  const labels = view.nodes.length <= 40

  return (
    <ChartFrame {...props} legend={legend} autoSummary={summary} announce={announce} hint={s.hintNet}>
      <div ref={wrapRef} className="dk-viz-plot" style={{ height: H }}>
        <svg
          ref={svgRef}
          className={`dk-viz-svg dk-viz-net dk-viz-fade${p > 0 ? '' : ' dk-viz-pre'}${selNode ? ' has-focus' : ''}`}
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          onPointerMove={onSvgMove}
          onPointerUp={onSvgUp}
          onPointerCancel={onSvgUp}
          role="group"
          aria-label={`${props.title}. ${s.hintNet}.`}
        >
          <g>
            {view.edges.map((e) => {
              const a = pos(e.source)
              const b = pos(e.target)
              const key = `${e.source}|${e.target}`
              const on = selEdge === e.key
              const isNear = !!selNode && (e.source === selNode || e.target === selNode)
              const cls = `dk-viz-edge${e.tone ? ` is-${e.tone}` : ''}${on ? ' is-on' : ''}${isNear ? ' is-near' : ''}`
              const sw = Math.min(4, 1 + Math.log2(e.w + 1) * 0.8)
              const an = view.nodes.find((x) => x.id === e.source)?.label ?? e.source
              const bn = view.nodes.find((x) => x.id === e.target)?.label ?? e.target
              return (
                <g key={e.key}>
                  {onEdgeSelect && e.src && (
                    <line
                      data-e={key}
                      className="dk-viz-edgehit"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      tabIndex={0}
                      role="button"
                      aria-label={`${an} – ${bn}${e.src.label ? `: ${e.src.label}` : ''}`}
                      aria-pressed={on}
                      onClick={() => pickEdge(e)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          pickEdge(e)
                        }
                      }}
                    />
                  )}
                  <line data-e={key} className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ strokeWidth: on ? sw + 1 : sw }} aria-hidden="true" />
                </g>
              )
            })}
          </g>
          <g>
            {view.nodes.map((n) => {
              const at = pos(n.id)
              const isCluster = n.count !== undefined
              const on = selNode === n.id
              const isNear = !!near?.has(n.id)
              const deg = neighbours.get(n.id)?.size ?? 0
              const fill = n.tone === 'danger' ? TONE.neg : n.color
              return (
                <g
                  key={n.id}
                  data-n={n.id}
                  className={`dk-viz-node${isCluster ? ' is-cluster' : ''}${on ? ' is-on' : ''}${isNear ? ' is-near' : ''}${n.tone ? ` is-${n.tone}` : ''}`}
                  transform={`translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isCluster ? undefined : on}
                  aria-label={isCluster ? `${n.label}. ${s.cluster(n.count ?? 0)}` : `${n.label}${n.note ? `, ${n.note}` : ''}, ${s.connections(deg)}`}
                  onPointerDown={(e) => onNodeDown(e, n)}
                  onKeyDown={(e) => onNodeKey(e, n)}
                  onFocus={() => setAnnounce('')}
                >
                  <circle r={n.r + 4} className="is-ring" />
                  <circle r={n.r} className="is-body" style={{ fill, fillOpacity: isCluster ? 0.9 : 1 }} />
                  {isCluster && (
                    <text className="t-mid is-count" y={4} style={{ fontSize: 11 }}>
                      {n.count}
                    </text>
                  )}
                  {(labels || on || isNear || isCluster) && (
                    <text data-l="" x={at.x > w * 0.6 ? -(n.r + 5) : n.r + 5} y={4} textAnchor={at.x > w * 0.6 ? 'end' : 'start'}>
                      {n.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </ChartFrame>
  )
}
