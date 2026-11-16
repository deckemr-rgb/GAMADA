/**
 * StartButton — hero CTA. Outlined / translucent at rest (1.5px white border, white label, light
 * dark glass). Hover/focus: a WHITE fill sweeps in from the left (scaleX) and the label turns ink;
 * the arrow slide-loops (CSS), and the whole button is magnetic (pointer within
 * MAGNETIC.radius × its size pulls it; the label moves a bit further; elastic return).
 * Click → scrollToScene(1).
 *
 * Perf: the button's rest geometry is cached and only re-measured after pointerenter, scroll,
 * resize, scene changes or the intro — never on every pointermove. will-change is set only while
 * the magnetic interaction is active.
 */
import { useRef, type CSSProperties } from 'react'
import { DUR } from '../lib/motion'
import { scrollToScene } from '../lib/navigation'
import { useMagnetic } from '../lib/useMagnetic'
import '../styles/ui.css'

export default function StartButton({
  label,
  onClick,
  scene = 1,
  arrow = 'right',
}: {
  label: string
  onClick?: () => void
  scene?: number
  arrow?: 'right' | 'down'
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  useMagnetic(btnRef, labelRef)

  return (
    <button
      ref={btnRef}
      type="button"
      className={`btn-start btn-start--${arrow}`}
      data-cursor="hover"
      style={{ '--ui-hover': `${DUR.hover}s` } as CSSProperties}
      onClick={() => (onClick ? onClick() : scrollToScene(scene))}
    >
      <span className="btn-start-fill" aria-hidden="true" />
      <span ref={labelRef} className="btn-start-label">
        {label}
      </span>
      <span className="btn-start-arrow" aria-hidden="true">
        <svg viewBox="0 0 12 14">
          <path d="M1 1 L11 7 L1 13 Z" />
        </svg>
      </span>
    </button>
  )
}
