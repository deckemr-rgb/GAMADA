/**
 * store.ts — tiny mutable state shared between the master timeline, the ticker-driven
 * effects (WebGL, boids, wind) and React UI. Hot values are read every frame from
 * `motionState` directly (no React re-render); discrete changes are broadcast with `emit`.
 */
import type { SceneId } from './assets'

export interface MotionState {
  /** Continuous scene position: 0 = hero, 1 = tranquility, 2 = biodiversity. */
  progress: number
  /** Overall 0..1 progress through the pinned experience. */
  progressNorm: number
  /** Scroll velocity in px/frame (signed, from Lenis or native scroll). */
  velocity: number
  /** |velocity| normalised to ~0..1 (see WIND.velocityNorm), smoothed. */
  speed: number
  /** Smoothed wind strength 0..1 (driven by speed). */
  wind: number
  /** Index of the scene closest to `progress`. */
  activeScene: number
  /** 0 when resting on a scene, 1 exactly mid-transition. */
  transition: number
  /** Seam position as a viewport fraction (0 = top, 1 = bottom); outside 0..1 when no seam is visible. */
  seamY: number
  /** Scenes that currently have at least one visible pixel. */
  visible: Record<SceneId, boolean>
  /** Pointer in -1..1 (x right, y down) + client px; `active` false on touch until gyro takes over. */
  pointer: { x: number; y: number; px: number; py: number; active: boolean }
  /** Viewport size in CSS px. */
  vw: number
  vh: number
  /** Set by the intro when the hero is fully on screen. */
  introDone: boolean
  /** Tab visibility. */
  pageVisible: boolean
  soundOn: boolean
}

export const motionState: MotionState = {
  progress: 0,
  progressNorm: 0,
  velocity: 0,
  speed: 0,
  wind: 0,
  activeScene: 0,
  transition: 0,
  seamY: 2,
  visible: { hero: true, tranquility: false, biodiversity: false },
  pointer: { x: 0, y: 0, px: -9999, py: -9999, active: false },
  vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh: typeof window !== 'undefined' ? window.innerHeight : 900,
  introDone: false,
  pageVisible: true,
  soundOn: false,
}

export type MotionEvent = 'scene' | 'intro' | 'sound' | 'resize'
type Listener = () => void
const listeners = new Map<MotionEvent, Set<Listener>>()

export function on(event: MotionEvent, fn: Listener): () => void {
  let set = listeners.get(event)
  if (!set) {
    set = new Set()
    listeners.set(event, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
  }
}

export function emit(event: MotionEvent): void {
  listeners.get(event)?.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    motionState.vw = window.innerWidth
    motionState.vh = window.innerHeight
    emit('resize')
  })
  document.addEventListener('visibilitychange', () => {
    motionState.pageVisible = document.visibilityState === 'visible'
  })
}
