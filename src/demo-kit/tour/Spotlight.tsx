/**
 * tour/Spotlight.tsx — visual only: a soft dim (4 panels) + a ring around the spotlighted hook inside the stage.
 * Positioned with transform; re-measured on scroll / resize of the stage (no animation loop of its own). Never
 * takes focus or pointer events.
 */
import { useEffect, useState } from 'react'
import { getStageRoot } from './exec'
import { useTour } from './store'

type Box = { x: number; y: number; w: number; h: number; W: number; H: number }

export function Spotlight() {
  const { spot, playing } = useTour()
  const [box, setBox] = useState<Box | null>(null)
  useEffect(() => {
    const root = getStageRoot()
    if (!spot || !root) {
      setBox(null)
      return
    }
    const measure = () => {
      const el = Array.from(root.querySelectorAll<HTMLElement>(spot)).find((e) => e.getBoundingClientRect().width > 0)
      if (!el) return setBox(null)
      const r = el.getBoundingClientRect()
      const o = root.getBoundingClientRect()
      const pad = 6
      setBox({ x: Math.max(0, r.left - o.left - pad), y: Math.max(0, r.top - o.top - pad), w: Math.min(o.width, r.width + pad * 2), h: Math.min(o.height, r.height + pad * 2), W: o.width, H: o.height })
    }
    measure()
    const t1 = window.setTimeout(measure, 350)
    root.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t1)
      root.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [spot])
  if (!box || !playing) return null
  const { x, y, w, h, W, H } = box
  return (
    <div className="dk-tour-spot" aria-hidden="true">
      <span className="dk-tour-spot-dim" style={{ width: W, height: y, transform: 'translate(0,0)' }} />
      <span className="dk-tour-spot-dim" style={{ width: W, height: Math.max(0, H - y - h), transform: `translate(0,${y + h}px)` }} />
      <span className="dk-tour-spot-dim" style={{ width: x, height: h, transform: `translate(0,${y}px)` }} />
      <span className="dk-tour-spot-dim" style={{ width: Math.max(0, W - x - w), height: h, transform: `translate(${x + w}px,${y}px)` }} />
      <span className="dk-tour-spot-ring" style={{ width: w, height: h, transform: `translate(${x}px,${y}px)` }} />
    </div>
  )
}
