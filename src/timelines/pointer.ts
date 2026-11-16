/**
 * pointer.ts — 4.1 pointer / gyro parallax layered on top of scroll parallax.
 * Each .layer-pointer gets quickTo x/y proportional to its depth.
 */
import { gsap } from 'gsap'
import { CAMERA, DUR, EASE, clamp, isEnabled, isTouchDevice } from '../lib/motion'
import { motionState } from '../lib/store'
import type { SceneId } from '../lib/assets'

type QT = ReturnType<typeof gsap.quickTo>

export function initPointer(stage: HTMLElement): () => void {
  const cleanups: Array<() => void> = []

  // pointer position is always tracked (cursor, boids, magnetic UI use it)
  const onMove = (e: PointerEvent) => {
    motionState.pointer.px = e.clientX
    motionState.pointer.py = e.clientY
    motionState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    motionState.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    motionState.pointer.active = e.pointerType === 'mouse'
  }
  const onLeave = () => {
    motionState.pointer.px = -9999
    motionState.pointer.py = -9999
    motionState.pointer.x = 0
    motionState.pointer.y = 0
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  cleanups.push(() => {
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
  })

  const touch = isTouchDevice()
  const usePointer = isEnabled('pointerParallax') && !touch
  const useGyro = isEnabled('gyroParallax') && touch
  if (!usePointer && !useGyro) return () => cleanups.forEach((c) => c())

  document.documentElement.classList.add('pointer-parallax')
  cleanups.push(() => document.documentElement.classList.remove('pointer-parallax'))

  const movers: Array<{ x: QT; y: QT; depth: number; scene: SceneId }> = Array.from(
    stage.querySelectorAll<HTMLElement>('.layer-pointer'),
  ).map((el) => ({
    depth: Number(el.dataset.depth ?? 0),
    scene: (el.closest<HTMLElement>('.scene')?.dataset.scene ?? 'hero') as SceneId,
    x: gsap.quickTo(el, 'x', { duration: DUR.pointerFollow, ease: EASE.pointer }),
    y: gsap.quickTo(el, 'y', { duration: DUR.pointerFollow, ease: EASE.pointer }),
  }))
  // the quickTo tweens live in the global timeline: kill them with the home, or they leak per visit
  cleanups.push(() => {
    for (const m of movers) {
      m.x.tween.kill()
      m.y.tween.kill()
    }
  })

  let lastX = 0
  let lastY = 0
  const apply = (nx: number, ny: number) => {
    if (Math.abs(nx - lastX) < 0.002 && Math.abs(ny - lastY) < 0.002) return
    lastX = nx
    lastY = ny
    for (const m of movers) {
      if (!motionState.visible[m.scene]) continue // hidden scenes catch up when they appear
      m.x(-nx * CAMERA.pointerMaxX * m.depth)
      m.y(-ny * CAMERA.pointerMaxY * m.depth)
    }
  }

  if (usePointer) {
    const tick = () => apply(motionState.pointer.x, motionState.pointer.y)
    gsap.ticker.add(tick)
    cleanups.push(() => gsap.ticker.remove(tick))
  }

  if (useGyro) {
    let base: { b: number; g: number } | null = null
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      base ??= { b: e.beta, g: e.gamma }
      const nx = clamp((e.gamma - base.g) / CAMERA.gyroRange, -1, 1)
      const ny = clamp((e.beta - base.b) / CAMERA.gyroRange, -1, 1)
      motionState.pointer.x = nx
      motionState.pointer.y = ny
      apply(nx, ny)
    }
    const start = () => window.addEventListener('deviceorientation', onOrient)
    type PermissionFn = () => Promise<'granted' | 'denied'>
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: PermissionFn } }).DeviceOrientationEvent
    if (DOE?.requestPermission) {
      // iOS: permission must be requested from a user gesture, so ask on the first tap.
      const ask = () => {
        DOE.requestPermission?.().then(
          (r) => {
            if (r === 'granted') start()
          },
          () => undefined,
        )
      }
      window.addEventListener('touchend', ask, { once: true })
      cleanups.push(() => window.removeEventListener('touchend', ask))
    } else if (DOE) {
      start()
    }
    cleanups.push(() => window.removeEventListener('deviceorientation', onOrient))
  }

  return () => cleanups.forEach((c) => c())
}
