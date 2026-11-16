/**
 * ProgressRail — right-edge scene indicator inside the stage.
 * Rolling counter (current scene, digits roll vertically), "/ 03", a thin vertical track
 * whose fill follows the smoothed playhead (motionState.progress / (scenes − 1)) every frame —
 * so it lands exactly on each marker — and one clickable marker per scene
 * (name shown on hover/focus) → scrollToScene(i). Hidden on phones (CSS).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { SCENES } from '../lib/assets'
import { DUR, EASE, prefersReducedMotion } from '../lib/motion'
import { motionState, on } from '../lib/store'
import { scrollToScene } from '../lib/navigation'
import { useI18n } from '../lib/i18n'
import '../styles/ui.css'

const pad = (n: number) => String(n).padStart(2, '0')

export default function ProgressRail() {
  const { t } = useI18n()
  const fillRef = useRef<HTMLSpanElement>(null)
  const tensRef = useRef<HTMLSpanElement>(null)
  const onesRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(motionState.activeScene)
  const total = SCENES.length

  // fill scrubbed every frame
  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    const span = Math.max(1, SCENES.length - 1)
    let last = -1
    const tick = () => {
      const v = Math.min(1, Math.max(0, motionState.progress / span))
      if (Math.abs(v - last) < 0.0005) return
      last = v
      fill.style.transform = `scaleY(${v})`
    }
    tick()
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  // active scene + rolling counter
  useEffect(() => {
    const roll = (index: number, instant: boolean) => {
      const n = pad(index + 1)
      const strips: Array<[HTMLSpanElement | null, number]> = [
        [tensRef.current, Number(n[0])],
        [onesRef.current, Number(n[1])],
      ]
      for (const [el, digit] of strips) {
        if (!el) continue
        // strip holds 0‥9 → each digit is 10 % of its height
        const yPercent = -digit * 10
        if (instant || prefersReducedMotion()) gsap.set(el, { yPercent })
        else gsap.to(el, { yPercent, duration: DUR.railCounter, ease: EASE.out, overwrite: true })
      }
    }
    roll(motionState.activeScene, true)
    return on('scene', () => {
      setActive(motionState.activeScene)
      roll(motionState.activeScene, false)
    })
  }, [])

  const digits = Array.from({ length: 10 }, (_, d) => d)

  return (
    <nav className="rail" aria-label={t.a11y.sceneNav} style={{ '--ui-hover': `${DUR.hover}s` } as CSSProperties}>
      <div className="rail-counter" aria-hidden="true">
        <span className="rail-current">
          <span className="rail-digit">
            <span ref={tensRef} className="rail-roll">
              {digits.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
          <span className="rail-digit">
            <span ref={onesRef} className="rail-roll">
              {digits.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        </span>
        <span className="rail-total">/ {pad(total)}</span>
      </div>

      <div className="rail-track">
        <span className="rail-line" aria-hidden="true" />
        <span ref={fillRef} className="rail-fill" aria-hidden="true" />
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="rail-marker"
            data-cursor="hover"
            style={{ top: `${total > 1 ? (i / (total - 1)) * 100 : 0}%` }}
            aria-label={`${t.a11y.goToScene} ${i + 1}: ${t.home.scenes[s.id].name}`}
            aria-current={i === active ? 'step' : undefined}
            onClick={() => scrollToScene(i)}
          >
            <span className="rail-dot" aria-hidden="true" />
            <span className="rail-name" aria-hidden="true">
              {t.home.scenes[s.id].name}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
