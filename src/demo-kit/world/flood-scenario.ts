/**
 * world/flood-scenario.ts — the scenario flood without any Usaha Pintar code (Pasar Daerah products import it on
 * click; up/scenario.ts re-exports it so the Usaha Pintar products are unchanged).
 *  - `ensureFloodScenario(s, now)`: a clock-sourced `flood.alert` level 3 (origin Siaga Wilayah, the pack's flood
 *    kecamatan) at `min(now, FLOOD_AT)`; idempotent (no-op while a flood alert is active or one is still queued).
 *  - `useFloodAutoplay(enabled)`: once the clock passes FLOOD_AT (07.06) the flood starts by itself (catch-up on jumps).
 *  - `activeFloodAlert(s)`: the newest active flood alert.
 */
import { useEffect } from 'react'
import type { Alert, WorldState } from './types'
import { clock } from './clock'
import { emit, world } from './store'
import { floodScenarioAlert } from './sd/base'
import { rows } from './util'

/** 07.06: the scenario flood of the autoplay (= Usaha Pintar UP_SCENARIO.floodAt = Awas Belanja FLOOD_AT) */
export const FLOOD_AT = 7 * 60 + 6

/** the newest active flood alert (null when none) */
export const activeFloodAlert = (s: WorldState): Alert | null => rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif') ?? null

let queued: { seed: number; region: string; id: string; now: number } | null = null
// a new / restored / reset world (same seed ⇒ the same next alert id) forgets the queued marker: the tour's "Mulai tur"
// resets its world and plays the flood again at the same minute
clock.onReset(() => {
  queued = null
})
/** start the scenario flood once; returns the new alert id, or null */
export function ensureFloodScenario(s: WorldState, now: number): string | null {
  if (!s.regionId || activeFloodAlert(s)) return null
  // emitted but not processed yet (the store runs it in a microtask / after a chunk download): do not emit twice
  if (queued && queued.seed === s.seed && queued.region === s.regionId && !s.alerts.byId[queued.id] && Math.abs(now - queued.now) < 3) return null
  const at = Math.min(now, FLOOD_AT)
  const id = emit('flood.alert', floodScenarioAlert(s, at, { level: 3 }), 'clock', { at, origin: 'siaga-wilayah' }).payload.id ?? null
  if (id) queued = { seed: s.seed, region: s.regionId, id, now }
  return id
}

let fired = false
export function useFloodAutoplay(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const check = (m: number) => {
      if (m < FLOOD_AT || world.status() !== 'ready') return
      const id = ensureFloodScenario(world.get(), m)
      if (id) fired = true
    }
    check(clock.get().minutes)
    const offs = [clock.onMinute(check), clock.onJump((_from: number, to: number) => check(to))]
    return () => {
      for (const off of offs) off()
    }
  }, [enabled])
}
/** @internal tests: whether this page's autoplay fired */
export const floodAutoplayFired = (): boolean => fired
