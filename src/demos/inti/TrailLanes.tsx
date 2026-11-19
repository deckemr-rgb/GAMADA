/**
 * TrailLanes — the data trail canvas (pure props, reusable by /ekosistem/inti in Tahap 6): 6 lanes in spine order,
 * one node per lane (its first Audit Log row), the connectors drawn in order by stroke-dashoffset on ONE GSAP
 * timeline (the kit ticker). A lane that is already lit when the canvas mounts renders at once; lanes that light up
 * while it is open are drawn one after another. Reduced motion / static: final states at once. Desktop: lanes are
 * columns; `vertical` (phones): lanes are rows with 44 px nodes. The node buttons are the keyboard step list.
 */
import { gsap } from 'gsap'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ProductSlug } from '../../content/products'

export interface TrailLane {
  product: ProductSlug
  name: string
  eco: string
  state: 'lit' | 'off' | 'hidden'
  auditId: string | null
  time: string | null
  text: string
  more: number
}
export interface TrailLanesProps {
  lanes: TrailLane[]
  vertical: boolean
  motion: boolean
  onNode: (i: number) => void
  /** lanes drawn so far (after their animation) */
  onDrawn?: (n: number) => void
  labels: { off: string; hidden: string; more: (n: number) => string; aria: (i: number, name: string, state: string, text: string) => string; lit: (name: string, text: string) => string; steps: string }
}

/** lanes passed in order: lit or hidden ones count, the first lane that is still off stops the path */
const leading = (lanes: TrailLane[]) => {
  let n = 0
  while (n < lanes.length && lanes[n]!.state !== 'off') n++
  return n
}

export function TrailLanes({ lanes, vertical, motion, onNode, onDrawn, labels }: TrailLanesProps) {
  const target = leading(lanes)
  const [drawn, setDrawn] = useState(target)
  const init = useRef(target).current
  const queued = useRef(target)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const lines = useRef<(SVGLineElement | null)[]>([])
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  const [said, setSaid] = useState('')
  const lanesRef = useRef(lanes)
  lanesRef.current = lanes

  useEffect(() => {
    if (target <= queued.current) return
    const from = queued.current
    queued.current = target
    if (!motion) {
      setDrawn(target)
      return
    }
    const t = (tl.current ??= gsap.timeline())
    for (let i = from; i < target; i++) {
      const el = lines.current[i]
      if (el && i > 0) t.to(el, { strokeDashoffset: 0, duration: 0.34, ease: 'power1.inOut' })
      t.call(() => {
        setDrawn((n) => Math.max(n, i + 1))
        const l = lanesRef.current[i]
        if (l?.state === 'lit') setSaid(labels.lit(l.name, l.text))
      })
    }
  }, [target, motion, labels])
  useEffect(() => () => void tl.current?.kill(), [])
  useEffect(() => {
    onDrawn?.(drawn)
  }, [drawn, onDrawn])

  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const i = btns.current.findIndex((b) => b === document.activeElement)
    if (i < 0) return
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? lanes.length - 1 : -2
    if (next === -2) return
    e.preventDefault()
    btns.current[Math.max(0, Math.min(lanes.length - 1, next))]?.focus()
  }

  return (
    <div className={`dk-in-trail${vertical ? ' is-vertical' : ''}`} data-in="trail" data-drawn={drawn}>
      <ol className="dk-in-lanes" aria-label={labels.steps} onKeyDown={onKey}>
        {lanes.map((l, i) => {
          const isDrawn = i < drawn
          const lit = isDrawn && l.state === 'lit'
          const stateText = l.state === 'hidden' ? labels.hidden : lit ? (l.time ?? '') : labels.off
          return (
            <li key={l.product} className={`dk-in-lane is-${l.state}${lit ? ' is-lit' : ''}`} data-eco={l.eco} data-lane={l.product} data-state={lit ? 'lit' : l.state === 'hidden' ? 'hidden' : 'off'}>
              {i > 0 && (
                <svg className={`dk-in-conn${l.state === 'hidden' || lanes[i - 1]!.state === 'hidden' ? ' is-muted' : ''}`} viewBox={vertical ? '0 0 4 100' : '0 0 100 4'} preserveAspectRatio="none" aria-hidden="true">
                  <line className="dk-in-conn-bg" x1={vertical ? 2 : 0} y1={vertical ? 0 : 2} x2={vertical ? 2 : 100} y2={vertical ? 100 : 2} vectorEffect="non-scaling-stroke" />
                  <line
                    ref={(el) => void (lines.current[i] = el)}
                    className="dk-in-conn-fg"
                    x1={vertical ? 2 : 0}
                    y1={vertical ? 0 : 2}
                    x2={vertical ? 2 : 100}
                    y2={vertical ? 100 : 2}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={i < init ? 0 : 1}
                    style={motion ? undefined : { strokeDashoffset: isDrawn ? 0 : 1 }}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              <button
                ref={(el) => void (btns.current[i] = el)}
                type="button"
                className="dk-in-node"
                data-in="node"
                data-audit={lit ? (l.auditId ?? '') : ''}
                disabled={!lit}
                aria-label={labels.aria(i + 1, l.name, stateText, lit ? l.text : '')}
                onClick={() => onNode(i)}
              >
                <span className="dk-in-node-dot" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="dk-in-node-body" aria-hidden="true">
                  <span className="dk-in-node-name">{l.name}</span>
                  <span className="dk-in-node-time">{stateText}</span>
                  {lit && <span className="dk-in-node-text">{l.text}</span>}
                  {lit && l.more > 0 && <span className="dk-in-node-more">{labels.more(l.more)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  )
}
