/**
 * perf.ts — rough device capability tier + a bounded, staged FPS degradation.
 *
 * Effects ask `getPerfTier()` once at mount and subscribe to `onDegrade(level => …)` to step
 * down later. Levels only ever go UP (never back down within a page view):
 *   0  everything on
 *   1  depth-of-field off                       (ambient.ts)
 *   2  particles at 50 % (+ DPR 1), curtain off (Particles.tsx, CurtainGL.tsx)
 *   3  bird / bat flocks off                    (Birds.tsx)
 *   4  waterfall shaders off — the static fallback layer underneath stays (WaterfallGL.tsx)
 * One level is added per sustained low-fps stretch (avg < DEGRADE.minFps over DEGRADE.badWindows
 * consecutive 1-s windows), sampled on gsap.ticker only while the tab is visible, starting after
 * the intro (≥ DEGRADE.startDelayMs after load), and stopping after DEGRADE.maxSampleMs of sampled
 * time or at level 4.
 *
 * `?degrade=N` (0..4) forces a level and disables sampling (handy for A/B perf runs).
 * `onLowFps` / `isDegraded` remain for compatibility (= level ≥ 1).
 */
import { gsap } from 'gsap'
import { DEGRADE } from './motion'
import { motionState, on } from './store'

export type PerfTier = 'high' | 'mid' | 'low'
export type DegradeLevel = 0 | 1 | 2 | 3 | 4

const MAX_LEVEL: DegradeLevel = 4

let tierCache: PerfTier | null = null
let webglCache: boolean | null = null

/** Probes WebGL once and immediately frees the probe context (browsers cap live contexts). */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
    webglCache = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglCache = false
  }
  return webglCache
}

export function getPerfTier(): PerfTier {
  if (tierCache) return tierCache
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const mobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches
  const forced = new URLSearchParams(window.location.search).get('tier')
  if (forced === 'high' || forced === 'mid' || forced === 'low') tierCache = forced
  else if (!hasWebGL() || cores <= 2 || mem <= 2) tierCache = 'low'
  else if (mobile || cores <= 4 || mem <= 4) tierCache = 'mid'
  else tierCache = 'high'
  return tierCache
}

/* ------------------------------------------------------------------ staged degradation */

function forcedLevel(): DegradeLevel | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('degrade')
  if (raw === null || raw === '') return null
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(MAX_LEVEL, n)) as DegradeLevel
}

const FORCED = forcedLevel()
let level: DegradeLevel = FORCED ?? 0
type LevelFn = (level: DegradeLevel) => void
const degradeListeners = new Set<LevelFn>()
let samplerState: 'idle' | 'waiting' | 'running' | 'done' = FORCED !== null ? 'done' : 'idle'

/** Current degrade level (0 = everything on … 4 = waterfall static). */
export function getDegradeLevel(): DegradeLevel {
  return level
}

/**
 * Subscribe to degrade level changes. Called with the new level each time it steps up, and
 * immediately (synchronously) when the level is already > 0. Returns an unsubscribe.
 */
export function onDegrade(fn: (level: DegradeLevel) => void): () => void {
  degradeListeners.add(fn)
  ensureSampling()
  if (level > 0) fn(level)
  return () => {
    degradeListeners.delete(fn)
  }
}

/** Compatibility: one-time "sustained low FPS" signal (= degrade level ≥ 1). */
export function onLowFps(fn: () => void): () => void {
  let fired = false
  return onDegrade((l) => {
    if (fired || l < 1) return
    fired = true
    fn()
  })
}

/** Compatibility: true once any degradation step happened. */
export function isDegraded(): boolean {
  return level >= 1
}

function stepUp(): void {
  if (level >= MAX_LEVEL) return
  level = (level + 1) as DegradeLevel
  const l = level
  degradeListeners.forEach((f) => f(l))
}

function ensureSampling(): void {
  if (samplerState !== 'idle' || typeof window === 'undefined') return
  samplerState = 'waiting'

  let introSeen = motionState.introDone
  let timer: number | null = null
  let offIntro: (() => void) | null = null

  const begin = () => {
    if (samplerState !== 'waiting') return
    offIntro?.()
    if (timer !== null) window.clearTimeout(timer)
    // never sample before startDelayMs after navigation start (loading / decode jank)
    const wait = DEGRADE.startDelayMs - performance.now()
    if (wait > 0) {
      timer = window.setTimeout(begin, wait)
      return
    }
    samplerState = 'running'
    startSampler()
  }

  if (introSeen) begin()
  else {
    offIntro = on('intro', () => {
      if (introSeen) return
      introSeen = true
      begin()
    })
    // the intro may never fire (e.g. a flag turned it off): start anyway after a while
    timer = window.setTimeout(begin, Math.max(DEGRADE.introTimeoutMs, DEGRADE.startDelayMs))
  }
}

/** Bounded fps sampler on gsap.ticker (no own RAF loop); removes itself when finished. */
function startSampler(): void {
  let frames = 0
  let windowStart = performance.now()
  let last = windowStart
  let sampled = 0
  let bad = 0

  const stop = () => {
    gsap.ticker.remove(tick)
    samplerState = 'done'
  }

  function tick(): void {
    const now = performance.now()
    const gap = now - last
    last = now
    if (document.visibilityState !== 'visible' || !motionState.pageVisible || gap > DEGRADE.maxGapMs) {
      // hidden tab / long stall: drop the current window, keep the bad-window streak as is
      frames = 0
      windowStart = now
      return
    }
    frames += 1
    const elapsed = now - windowStart
    if (elapsed < DEGRADE.windowMs) return
    const fps = (frames * 1000) / elapsed
    sampled += elapsed
    frames = 0
    windowStart = now
    bad = fps < DEGRADE.minFps ? bad + 1 : 0
    if (bad >= DEGRADE.badWindows) {
      bad = 0
      stepUp()
    }
    if (level >= MAX_LEVEL || sampled >= DEGRADE.maxSampleMs) stop()
  }

  gsap.ticker.add(tick)
}
