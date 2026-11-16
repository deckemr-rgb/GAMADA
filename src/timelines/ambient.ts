/**
 * ambient.ts — per-frame ambient motion that is not tied to the scroll timeline:
 *   wind skew on [data-wind] layers (boosted by scroll speed)
 *   rotational sway on [data-sway] layers (scarf) around a canvas-space pivot
 *   fake depth-of-field blur on [data-dof] layers while moving fast
 *   deer pose cross-fades
 * Everything runs on the GSAP ticker and only touches visible scenes.
 */
import { gsap } from 'gsap'
import type { SceneId } from '../lib/assets'
import { DEGRADE, DOF, DUR, WIND, isEnabled, isMobileViewport } from '../lib/motion'
import { computeFrame, layerBoxSize } from '../lib/frame'
import { motionState, on } from '../lib/store'
import { onDegrade } from '../lib/perf'

type Setter = (value: number) => void

interface WindEl {
  el: HTMLElement
  scene: SceneId
  phase: number
  gain: number
  set: Setter
  last: number
}
interface SwayEl {
  el: HTMLElement
  scene: SceneId
  pivot: { x: number; y: number }
  amp: number
  phase: number
  focusX: number
  focusXM: number
  set: Setter
  last: number
}

const sceneOf = (el: HTMLElement): SceneId => (el.closest<HTMLElement>('.scene')?.dataset.scene ?? 'hero') as SceneId

export function initAmbient(stage: HTMLElement): () => void {
  const cleanups: Array<() => void> = []
  const wind: WindEl[] = []
  const sway: SwayEl[] = []

  if (isEnabled('wind')) {
    stage.querySelectorAll<HTMLElement>('.layer-wind[data-wind]').forEach((el, i) => {
      el.style.transformOrigin = '50% 100%'
      wind.push({
        el,
        scene: sceneOf(el),
        phase: i * 1.7,
        gain: 0.7 + ((i * 37) % 10) / 20,
        set: gsap.quickSetter(el, 'skewX', 'deg') as Setter,
        last: 0,
      })
    })
    stage.querySelectorAll<HTMLElement>('.layer-wind[data-sway]').forEach((el, i) => {
      const s = JSON.parse(el.dataset.sway ?? '{}') as { x: number; y: number; amp: number }
      sway.push({
        el,
        scene: sceneOf(el),
        pivot: { x: s.x, y: s.y },
        amp: s.amp,
        phase: i * 2.3,
        focusX: Number(el.dataset.focusX ?? 0.5),
        focusXM: Number(el.dataset.focusXM ?? 0.5),
        set: gsap.quickSetter(el, 'rotation', 'deg') as Setter,
        last: 0,
      })
    })
  }

  const setPivots = () => {
    const box = layerBoxSize(window.innerWidth, window.innerHeight)
    const mobile = isMobileViewport()
    for (const s of sway) {
      const m = computeFrame(box.w, box.h, mobile ? s.focusXM : s.focusX)
      s.el.style.transformOrigin = `${m.ox + s.pivot.x * m.s}px ${m.oy + s.pivot.y * m.s}px`
    }
  }
  setPivots()
  cleanups.push(on('resize', setPivots))

  // Depth of field: cross-fade a pre-blurred twin (built by tools/build-layers.mjs) instead of
  // animating filter: blur() on a full-width layer. Off on mid/low tiers (no twin is rendered there)
  // and as the first step of perf degradation.
  let dofOn = isEnabled('depthOfField')
  const dofLayers = dofOn
    ? Array.from(stage.querySelectorAll<HTMLElement>('.layer[data-dof]')).flatMap((el) => {
        const img = el.querySelector<HTMLImageElement>('img[data-art-blur]')
        return img ? [{ scene: sceneOf(el), set: gsap.quickSetter(img, 'opacity') as Setter, amount: 0, last: 0 }] : []
      })
    : []
  cleanups.push(
    onDegrade((level) => {
      if (level < DEGRADE.levelDof) return
      dofOn = false
      for (const d of dofLayers) d.set(0)
    }),
  )

  const tick = (time: number) => {
    if (!motionState.pageVisible) return
    const w = Math.min(WIND.maxSkew, WIND.baseSkew + motionState.wind * WIND.velocitySkew)
    for (const item of wind) {
      if (!motionState.visible[item.scene]) continue
      const k =
        Math.sin(time * Math.PI * 2 * WIND.frequency + item.phase) * 0.7 + Math.sin(time * 1.3 + item.phase * 0.5) * 0.3
      const v = k * w * item.gain
      if (Math.abs(v - item.last) > WIND.minDelta) {
        item.set(v)
        item.last = v
      }
    }
    for (const s of sway) {
      if (!motionState.visible[s.scene]) continue
      const k = Math.sin(time * 2.4 + s.phase) * 0.6 + Math.sin(time * 4.1 + s.phase) * 0.4
      const v = k * s.amp * (1 + motionState.wind * 1.5)
      if (Math.abs(v - s.last) > WIND.minDelta) {
        s.set(v)
        s.last = v
      }
    }
    if (dofOn) {
      for (const d of dofLayers) {
        const target =
          motionState.visible[d.scene] && motionState.speed > DOF.threshold
            ? Math.min(1, (motionState.speed - DOF.threshold) / (1 - DOF.threshold))
            : 0
        d.amount += (target - d.amount) * DOF.follow
        if (d.amount < 0.01 && target === 0) d.amount = 0
        if (Math.abs(d.amount - d.last) > 0.01 || (d.amount === 0 && d.last !== 0)) {
          d.set(d.amount)
          d.last = d.amount
        }
      }
    }
  }
  gsap.ticker.add(tick)
  cleanups.push(() => gsap.ticker.remove(tick))

  // pose groups (deer): occasionally cross-fade to another pose and back to rest
  if (isEnabled('deerPoses')) {
    const groups = new Map<string, HTMLElement[]>()
    stage.querySelectorAll<HTMLElement>('.layer-wind[data-pose-group]').forEach((el) => {
      const g = el.dataset.poseGroup ?? ''
      const list = groups.get(g) ?? []
      list[Number(el.dataset.poseIndex ?? 0)] = el
      groups.set(g, list)
    })
    groups.forEach((poses) => {
      const rest = poses[0]
      if (!rest || poses.length < 2) return
      const scene = sceneOf(rest)
      let current = 0
      let timer = 0
      const schedule = () => {
        const wait = gsap.utils.random(DUR.deerPoseHoldMin, DUR.deerPoseHoldMax)
        timer = window.setTimeout(step, wait * 1000)
      }
      const step = () => {
        if (motionState.visible[scene] && motionState.pageVisible) {
          const next = current === 0 ? gsap.utils.random(1, poses.length - 1, 1) : 0
          const from = poses[current]
          const to = poses[next]
          if (from && to) {
            gsap.to(to, { opacity: 1, duration: DUR.deerPoseFade, ease: 'sine.inOut' })
            gsap.to(from, { opacity: 0, duration: DUR.deerPoseFade, ease: 'sine.inOut', delay: DUR.deerPoseFade * 0.5 })
            current = next
          }
        }
        schedule()
      }
      schedule()
      cleanups.push(() => window.clearTimeout(timer))
    })
  }

  return () => cleanups.forEach((c) => c())
}
