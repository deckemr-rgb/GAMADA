/**
 * GodRays — soft light shafts falling from a gap in the rock / canopy.
 * Rendered inside FrameSpace, so everything is in canvas px (2560 × 2304).
 * Each ray is one absolutely positioned div (gradient along it, soft mask across it)
 * rotated around its top-centre; opacity breathes on its own sine period with a little
 * smoothed noise, and the angle drifts very slightly. Driven by gsap.ticker and only
 * while the scene is visible. No blur filters.
 * `will-change` is only applied (via `.godrays.is-live`) while the owning scene is visible and the
 * tab is shown, so hidden scenes do not pin promoted compositor layers.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { GODRAYS, type SceneId } from '../lib/assets'
import { motionState } from '../lib/store'
import { GODRAY_MOTION } from '../lib/motion'
import '../styles/ambient.css'

interface Ray {
  x: number
  w: number
  len: number
  angle: number
  base: number
  period: number
  phase: number
  driftPeriod: number
  driftPhase: number
}

/** Deterministic PRNG so the ray layout is stable across renders. */
function prng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export default function GodRays({ sceneId }: { sceneId: Extract<SceneId, 'tranquility' | 'biodiversity'> }) {
  const cfg = GODRAYS[sceneId]
  const rootRef = useRef<HTMLDivElement>(null)

  const rays = useMemo<Ray[]>(() => {
    const r = prng(sceneId === 'tranquility' ? 7 : 19)
    const list: Ray[] = []
    const n = Math.max(1, cfg.count)
    for (let i = 0; i < n; i++) {
      // distribute offsets across ±spread, then jitter so no two rays are evenly spaced
      const t = n === 1 ? 0.5 : i / (n - 1)
      const off = (t * 2 - 1) * GODRAY_MOTION.spread * 0.8 + (r() - 0.5) * GODRAY_MOTION.spread * 0.4
      list.push({
        x: cfg.x + (t - 0.5) * GODRAY_MOTION.gap + (r() - 0.5) * 40,
        w: GODRAY_MOTION.widthMin + r() * (GODRAY_MOTION.widthMax - GODRAY_MOTION.widthMin),
        len: cfg.length * (GODRAY_MOTION.lengthMin + r() * (1 - GODRAY_MOTION.lengthMin)),
        angle: cfg.angle + off,
        base: 0.5 + r() * 0.4,
        period: GODRAY_MOTION.periodMin + r() * (GODRAY_MOTION.periodMax - GODRAY_MOTION.periodMin),
        phase: r() * Math.PI * 2,
        driftPeriod: GODRAY_MOTION.driftPeriod[0] + r() * (GODRAY_MOTION.driftPeriod[1] - GODRAY_MOTION.driftPeriod[0]),
        driftPhase: r() * Math.PI * 2,
      })
    }
    return list
  }, [cfg, sceneId])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('.godray'))
    const glow = root.querySelector<HTMLElement>('.godray-glow')
    const noise = rays.map(() => ({ v: 0, target: 0, t: 0 }))
    let clock = Math.random() * 20
    let live = false
    const setLive = (v: boolean) => {
      if (v === live) return
      live = v
      root.classList.toggle('is-live', v)
    }

    const tick = (_time: number, deltaMs: number) => {
      const visible = motionState.visible[sceneId] && motionState.pageVisible
      setLive(visible)
      if (!visible) return
      const dt = Math.min(0.05, Math.max(0, deltaMs / 1000))
      clock += dt
      let sum = 0
      rays.forEach((ray, i) => {
        const el = els[i]
        const nz = noise[i]
        if (!el || !nz) return
        // smoothed random walk (new target every ~0.4–1.2s)
        nz.t -= dt
        if (nz.t <= 0) {
          nz.target = Math.random() * 2 - 1
          nz.t = 0.4 + Math.random() * 0.8
        }
        nz.v += (nz.target - nz.v) * Math.min(1, dt * 2.2)
        const breathe = 0.5 + 0.5 * Math.sin((clock / ray.period) * Math.PI * 2 + ray.phase)
        const k = GODRAY_MOTION.breatheLow + (1 - GODRAY_MOTION.breatheLow) * breathe
        const o = Math.max(0, Math.min(1, ray.base * k + nz.v * GODRAY_MOTION.noise * ray.base))
        sum += o
        const drift = Math.sin((clock / ray.driftPeriod) * Math.PI * 2 + ray.driftPhase) * GODRAY_MOTION.drift
        el.style.opacity = o.toFixed(3)
        el.style.transform = `rotate(${(-(ray.angle + drift)).toFixed(3)}deg)`
      })
      if (glow) glow.style.opacity = (0.35 + (sum / Math.max(1, rays.length)) * 0.9).toFixed(3)
    }
    tick(0, 16)
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      root.classList.remove('is-live')
    }
  }, [rays, sceneId])

  const g = GODRAY_MOTION.glowSize
  return (
    <div ref={rootRef} className="godrays" aria-hidden="true" style={{ '--ray-color': cfg.color } as CSSProperties}>
      <div className="godray-glow" style={{ left: cfg.x - g / 2, top: cfg.y - g / 2, width: g, height: g }} />
      {rays.map((ray, i) => (
        <div
          key={i}
          className="godray"
          style={{
            left: ray.x - ray.w / 2,
            top: cfg.y,
            width: ray.w,
            height: ray.len,
            opacity: ray.base,
            transform: `rotate(${-ray.angle}deg)`,
          }}
        />
      ))}
    </div>
  )
}
