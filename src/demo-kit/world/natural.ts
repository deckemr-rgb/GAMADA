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

// One listener for the whole app: every minute the running clock crosses.
let gen: typeof import('./natural-gen') | null = null
let loading = false
let pending: number[] = []
function run(g: typeof import('./natural-gen'), minute: number) {
  for (const o of g.naturalEventsAt(world.get(), minute)) emit(o.type, o.payload as never, o.source, { at: minute, ...(o.origin ? { origin: o.origin } : {}) })
}
/** @internal the clock listener (exported for the self-test, which cannot drive gsap.ticker) */
export function _onNaturalMinute(minute: number): void {
  if (!enabled || world.status() !== 'ready') return
  if (gen) return run(gen, minute)
  pending.push(minute)
  if (loading) return
  loading = true
  import('./natural-gen').then(
    (m) => {
      gen = m
      const due = pending
      pending = []
      // replay the minutes crossed meanwhile (not ones the clock was since set back past, e.g. a world reset)
      const now = clock.get().minutes
      for (const x of due) if (enabled && world.status() === 'ready' && x <= now) run(m, x)
    },
    (err: unknown) => {
      loading = false
      pending = []
      console.error('[world] natural events failed to load', err)
    },
  )
}
clock.onMinute(_onNaturalMinute)
