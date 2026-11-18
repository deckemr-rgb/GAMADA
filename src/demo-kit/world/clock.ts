/**
 * world/clock.ts — the world clock (spec §6.2): minutes since 00:00 of the demo day, speeds ×1/×10/×60, pause,
 * jump. Driven by gsap.ticker (the site's single RAF loop); detaches while paused or while the tab is hidden.
 * React re-renders only when the whole minute changes (read `clock.exact()` for sub-minute smoothness).
 */
import { gsap } from 'gsap'
import { useSyncExternalStore } from 'react'
import { DAY_MIN, WORLD, hhmm } from './util'

/* ------------------------------------------------------------------ constants */
export const CLOCK = {
  speeds: [1, 10, 60] as const,
  /** "Lompat ke…" targets (spec §6.2) */
  jumps: ['06:00', '07:00', '10:00', '13:00', '16:00', '17:00'] as const,
  defaultSpeed: 10 as const,
  /** a long frame (tab switch, debugger) never advances more than this (ms) */
  maxFrameMs: 250,
  /** clock stops at the end of the demo day */
  endOfDay: DAY_MIN - 1,
}

export type ClockSpeed = 0 | 1 | 10 | 60
export interface ClockState {
  /** whole world minutes since 00:00 */
  minutes: number
  /** chosen speed; 0 = stopped */
  speed: ClockSpeed
  running: boolean
}

let state: ClockState = { minutes: WORLD.clockStart, speed: CLOCK.defaultSpeed, running: false }
let exact = state.minutes
let attached = false
const subs = new Set<() => void>()
const minuteSubs = new Set<(minute: number) => void>()
const jumpSubs = new Set<(from: number, to: number) => void>()
const resetSubs = new Set<(minutes: number) => void>()

const hasDoc = typeof document !== 'undefined'
const isHidden = () => hasDoc && document.visibilityState === 'hidden'

function set(next: ClockState) {
  if (next.minutes === state.minutes && next.speed === state.speed && next.running === state.running) return
  state = next
  for (const fn of [...subs]) fn()
}

function tick(_time: number, deltaMs: number) {
  if (!state.running || state.speed === 0) return
  const dt = Math.min(deltaMs, CLOCK.maxFrameMs) / 1000
  exact = Math.min(CLOCK.endOfDay, exact + (dt * state.speed) / 60)
  const whole = Math.floor(exact)
  if (whole !== state.minutes) {
    const from = state.minutes
    set({ ...state, minutes: whole, running: whole < CLOCK.endOfDay })
    // continuous advance only: natural events fire for every minute crossed (never for jumps)
    for (let m = from + 1; m <= whole; m++) for (const fn of [...minuteSubs]) fn(m)
  }
  if (!state.running) sync()
}

/** attach to gsap.ticker only while running and visible */
function sync() {
  const want = state.running && state.speed > 0 && !isHidden()
  if (want && !attached) {
    gsap.ticker.add(tick)
    attached = true
  } else if (!want && attached) {
    gsap.ticker.remove(tick)
    attached = false
  }
}
if (hasDoc) document.addEventListener('visibilitychange', sync)

/** "HH:MM" or minutes → minutes (clamped to the demo day) */
export function parseTime(t: string | number): number {
  if (typeof t === 'number') return Math.max(0, Math.min(CLOCK.endOfDay, Math.floor(t)))
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) throw new Error(`clock: bad time "${t}"`)
  return Math.max(0, Math.min(CLOCK.endOfDay, Number(m[1]) * 60 + Number(m[2])))
}

export const formatTime = (min: number): string => hhmm(min)

export const clock = {
  get: (): ClockState => state,
  /** fractional minutes (for smooth hands / progress bars) */
  exact: (): number => exact,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  /** called once for every whole minute the running clock crosses (jumps: see onJump) */
  onMinute(fn: (minute: number) => void): () => void {
    minuteSubs.add(fn)
    return () => minuteSubs.delete(fn)
  },
  /**
   * a forward jump (from → to, to > from): "Lompat ke …", ?t=, a product moving time on. Natural events replay the
   * minutes crossed (natural.ts), so the day reads the same whether the clock ran or jumped.
   */
  onJump(fn: (from: number, to: number) => void): () => void {
    jumpSubs.add(fn)
    return () => jumpSubs.delete(fn)
  },
  /** a reset (new / restored world): `minutes` is where the clock now stands */
  onReset(fn: (minutes: number) => void): () => void {
    resetSubs.add(fn)
    return () => resetSubs.delete(fn)
  },
  setTime(t: string | number) {
    const m = parseTime(t)
    const from = state.minutes
    exact = m
    set({ ...state, minutes: m })
    if (m > from) for (const fn of [...jumpSubs]) fn(from, m)
  },
  play() {
    if (state.minutes >= CLOCK.endOfDay) return
    set({ ...state, running: true, speed: state.speed === 0 ? CLOCK.defaultSpeed : state.speed })
    sync()
  },
  pause() {
    set({ ...state, running: false })
    sync()
  },
  toggle() {
    if (state.running) clock.pause()
    else clock.play()
  },
  setSpeed(speed: ClockSpeed) {
    if (speed === 0) {
      clock.pause()
      return
    }
    set({ ...state, speed })
    sync()
  },
  /** back to the default morning, stopped */
  reset(minutes: number = WORLD.clockStart) {
    exact = minutes
    set({ minutes, speed: CLOCK.defaultSpeed, running: false })
    sync()
    for (const fn of [...resetSubs]) fn(minutes)
  },
}

export const setTime = clock.setTime
export const play = clock.play
export const pause = clock.pause
export const setSpeed = clock.setSpeed

/** React: current clock (re-renders once per world minute or on control changes) */
export function useClock(): ClockState {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get)
}
