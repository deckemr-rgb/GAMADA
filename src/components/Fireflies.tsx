/**
 * Fireflies — low-tier "section particles" for content sections and the footer.
 * A handful of 4 px dots drifting with CSS keyframes (transform + opacity only, compositor-run),
 * count by perf tier (SITE_MOTION.fireflies), positions from a seeded RNG so they are stable
 * between renders. Animations are paused while the host is off-screen or the tab is hidden.
 * No WebGL context: a section background must not cost a GPU context of its own.
 * Flag `sectionParticles` off / reduced motion / degrade level ≥ 2 → nothing is rendered.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SITE_MOTION, isEnabled } from '../lib/motion'
import { getDegradeLevel, getPerfTier, onDegrade } from '../lib/perf'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export default function Fireflies({ seed = 7, density = 1, className = '' }: { seed?: number; density?: number; className?: string }) {
  const [enabled, setEnabled] = useState(() => isEnabled('sectionParticles') && getDegradeLevel() < 2)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => onDegrade((lvl) => lvl >= 2 && setEnabled(false)), [])

  const dots = useMemo(() => {
    const n = Math.round(SITE_MOTION.fireflies[getPerfTier()] * density)
    const r = rng(seed)
    return Array.from({ length: n }, () => ({
      x: r() * 100,
      y: 15 + r() * 80,
      dx: (r() - 0.5) * 60,
      dy: -10 - r() * 40,
      dur: 7 + r() * 8,
      blink: 2.2 + r() * 2.6,
      delay: -r() * 12,
      size: 0.7 + r() * 0.6,
    }))
  }, [seed, density])

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let inView = false
    const apply = () => {
      el.dataset.active = String(inView && document.visibilityState === 'visible')
    }
    const io = new IntersectionObserver((entries) => {
      inView = !!entries[entries.length - 1]?.isIntersecting
      apply()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', apply)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', apply)
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={ref} className={`fireflies ${className}`} data-active="false" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              '--dx': `${d.dx}px`,
              '--dy': `${d.dy}px`,
              '--dur': `${d.dur}s`,
              '--blink': `${d.blink}s`,
              '--delay': `${d.delay}s`,
              '--s': d.size,
            } as CSSProperties
          }
        >
          <span className="firefly-glow" />
        </span>
      ))}
    </div>
  )
}
