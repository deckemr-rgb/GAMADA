/**
 * DispositionStamp — the digital disposition stamp that "thumps" onto a letter after approval (Naskah Pintar).
 * Place it as a DocViewer child (page coordinates, %). Scale/rotation/opacity only; reduced motion → fade.
 */
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { DEMO } from '../../lib/motion'
import { motionMode } from '../ui/motion'
import './docs.css'

export const STAMP = {
  /** thump duration (s) */
  thump: 0.42,
  from: { scale: 1.9, rotation: -22 },
  rest: { rotation: -7 },
} as const

export interface DispositionStampProps {
  show: boolean
  /** "DISPOSISI" header */
  heading: string
  /** e.g. ["Kepada: BPBD, Dinas PUPR", "Hadiri dan bawa data…", "17-11-2026 · Bupati"] */
  lines: string[]
  /** position of the stamp centre in % of the page */
  x?: number
  y?: number
  /** width in % of the page */
  width?: number
}

export function DispositionStamp({ show, heading, lines, x = 62, y = 30, width = 38 }: DispositionStampProps) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !show) return
    const mode = motionMode()
    if (mode === 'static') {
      gsap.set(el, { opacity: 1, scale: 1, rotation: STAMP.rest.rotation })
      return
    }
    const tw =
      mode === 'reduced'
        ? gsap.fromTo(el, { opacity: 0, scale: 1, rotation: STAMP.rest.rotation }, { opacity: 1, duration: DEMO.reducedFade })
        : gsap.fromTo(
            el,
            { opacity: 0, scale: STAMP.from.scale, rotation: STAMP.from.rotation },
            { opacity: 1, scale: 1, rotation: STAMP.rest.rotation, duration: STAMP.thump, ease: 'back.out(2.2)' },
          )
    return () => {
      tw.kill()
    }
  }, [show])
  if (!show) return null
  return (
    <div className="dk-stamp" style={{ left: `${x}%`, top: `${y}%`, width: `${width}%` }} role="img" aria-label={`${heading}: ${lines.join(' · ')}`}>
      <div ref={ref} className="dk-stamp-in">
        <b>{heading}</b>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
