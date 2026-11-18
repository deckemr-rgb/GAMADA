/**
 * world/natural.ts — "natural" events while the clock runs (spec §6.2): new complaints, shop sales, news/social
 * mentions and small price moves. Rhythm follows the hour (busy 07–11 and 13–15, quiet nights). Off in
 * tour/presenter mode. The generator itself (naturalEventsAt + its texts, natural-gen.ts) is loaded the first time
 * the running clock crosses a minute, so a page whose clock never runs never downloads it; the minutes crossed while
 * it loads are replayed in order. Deterministic: naturalEventsAt(state, minute) depends only on seed + region +
 * minute + state.
 */
import { useSyncExternalStore } from 'react'
import { clock } from './clock'
import { emit, world } from './store'
import type { AnyFollowUp, WorldState } from './types'

/* ------------------------------------------------------------------ constants */
/** expected events per world minute at rhythm 1.0 */
export const NATURAL = {
  complaint: 0.045,
  mention: 0.05,
  price: 0.025,
  /** average receipts per open minute (toko ≈ 27/day, F&B ≈ 90/day) */
  saleToko: 0.045,
  saleFnb: 0.1,
  /** while a flood alert is active, flood complaints in flood kecamatan are this much likelier */
  floodBoost: 4,
}

/* ------------------------------------------------------------------ ecosystem sources + boosts */

/** extra natural generators (ecosystem world modules, e.g. Usaha Pintar's natural-up): pure (state, minute) → events,
 *  run after the core generator in registration order */
type NaturalSource = (s: WorldState, minute: number) => AnyFollowUp[]
const sources = new Map<string, NaturalSource>()
export function registerNaturalSource(id: string, fn: NaturalSource): void {
  sources.set(id, fn)
}
/** multiplier on a natural rhythm while a page wants more of it (e.g. sales ×3 on a shop demo); 1 = normal */
const boosts: Record<string, number> = {}
export function setNaturalBoost(kind: 'sale', factor: number): () => void {
  boosts[kind] = factor
  return () => {
    if (boosts[kind] === factor) delete boosts[kind]
  }
}
export const naturalBoost = (kind: 'sale'): number => boosts[kind] ?? 1

/* ------------------------------------------------------------------ runtime switch */

let enabled = true
const subs = new Set<() => void>()

export function setNaturalEvents(on: boolean): void {
  if (on === enabled) return
  enabled = on
  for (const fn of [...subs]) fn()
}
export const naturalEventsOn = (): boolean => enabled

export function useNaturalEvents(): boolean {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => enabled,
    () => enabled,
  )
}

// One queue for the whole app: every minute the running clock crosses, and the minutes a forward jump skips.
// `mark` = the last minute whose natural events were emitted: a minute is never emitted twice, so setting the clock
// back and running it again (Back, a rewind) cannot duplicate complaints under new ids. A world (re)install moves
// the mark to the clock it installs with.
let gen: typeof import('./natural-gen') | null = null
let loading = false
let mark = clock.get().minutes
const queue: number[] = []
let pumping = false
/** jumps replay at most this many minutes per idle slice */
const SLICE = 60

function run(g: typeof import('./natural-gen'), minute: number) {
  if (minute <= mark) return
  mark = minute
  const outs = g.naturalEventsAt(world.get(), minute)
  for (const fn of sources.values()) outs.push(...fn(world.get(), minute))
  for (const o of outs) emit(o.type, o.payload as never, o.source, { at: minute, ...(o.origin ? { origin: o.origin } : {}) })
}
const idle = (fn: () => void) => {
  const w = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 120 })
  else setTimeout(fn, 0)
}
const replaySubs = new Set<() => void>()
/** minutes still to replay after a jump (0 = caught up); for a "memutar kejadian…" hint */
export const naturalBacklog = (): number => queue.length
export function onNaturalBacklog(fn: () => void): () => void {
  replaySubs.add(fn)
  return () => replaySubs.delete(fn)
}
function pump() {
  if (!gen) return
  const g = gen
  const now = clock.get().minutes
  let n = 0
  while (queue.length && n < SLICE) {
    const m = queue.shift()!
    // never minutes the clock was since set back past (e.g. a reset)
    if (enabled && world.status() === 'ready' && m <= now) run(g, m)
    n++
  }
  for (const fn of [...replaySubs]) fn()
  if (queue.length) idle(pump)
  else pumping = false
}
function load() {
  if (loading) return
  loading = true
  import('./natural-gen').then(
    (m) => {
      gen = m
      if (!pumping && queue.length) {
        pumping = true
        pump()
      }
    },
    (err: unknown) => {
      loading = false
      queue.length = 0
      console.error('[world] natural events failed to load', err)
    },
  )
}
/** @internal the clock listener (exported for the self-test, which cannot drive gsap.ticker) */
export function _onNaturalMinute(minute: number): void {
  if (!enabled || world.status() !== 'ready' || minute <= mark) return
  if (gen && !queue.length) return run(gen, minute)
  queue.push(minute)
  if (!gen) return load()
  if (!pumping) {
    pumping = true
    idle(pump)
  }
}
function onJump(from: number, to: number) {
  if (!enabled || world.status() !== 'ready') return
  const start = Math.max(from, mark) + 1
  if (start > to) return
  const last = queue.length ? queue[queue.length - 1]! : -Infinity
  for (let m = Math.max(start, last + 1); m <= to; m++) queue.push(m)
  for (const fn of [...replaySubs]) fn()
  if (!gen) return load()
  if (!pumping) {
    pumping = true
    idle(pump)
  }
}
clock.onMinute(_onNaturalMinute)
clock.onJump(onJump)
clock.onReset((minutes) => {
  mark = minutes
  queue.length = 0
  for (const fn of [...replaySubs]) fn()
})
