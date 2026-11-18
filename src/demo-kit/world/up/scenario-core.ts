/**
 * world/up/scenario-core.ts — the Usaha Pintar flood scenario without React (selectors + the idempotent trigger).
 */
import type { Alert, WorldState } from '../types'
import { emit } from '../store'
import { floodScenarioAlert } from '../sd/base'
import { rows } from '../util'
import { UP_SCENARIO } from './config'

/** the newest active flood alert (null when none) */
export const activeFloodAlert = (s: WorldState): Alert | null => rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif') ?? null

/**
 * Start the scenario flood once: a clock-sourced `flood.alert` level 3 (origin Siaga Wilayah, the pack's flood
 * kecamatan) at `min(now, UP_SCENARIO.floodAt)` — the autoplay stamps 07.06, a button before 07.06 fires now. No-op
 * while a flood alert is active. Returns the new alert id, or null.
 */
let queued: { seed: number; region: string; id: string; now: number } | null = null
export function ensureFloodScenario(s: WorldState, now: number): string | null {
  if (!s.regionId || activeFloodAlert(s)) return null
  // emitted but not processed yet (the store runs it in a microtask / after a chunk download): do not emit twice
  if (queued && queued.seed === s.seed && queued.region === s.regionId && !s.alerts.byId[queued.id] && Math.abs(now - queued.now) < 3) return null
  const at = Math.min(now, UP_SCENARIO.floodAt)
  const id = emit('flood.alert', floodScenarioAlert(s, at, { level: 3 }), 'clock', { at, origin: 'siaga-wilayah' }).payload.id ?? null
  if (id) queued = { seed: s.seed, region: s.regionId, id, now }
  return id
}
