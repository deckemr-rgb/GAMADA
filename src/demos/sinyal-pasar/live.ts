/**
 * demos/sinyal-pasar/live.ts — the hooks that keep the sandbox alive on both sides: the clock autoplay at 07.00 and the
 * scenario flood at 07.06 (Sinyal Pasar opts in, plan §1.6). The flood helper (world/flood-scenario) is fetched on use.
 */
import { useEffect } from 'react'
import { motionMode } from '../../demo-kit/ui'
import { clock, rows, world, type WorldState } from '../../demo-kit/world'

export const FLOOD_AT = 7 * 60 + 6
const AUTOPLAY_KEY = 'gamada:sp:autoplay'

/** the clock starts by itself on a first visit at 07.00 (×10), as the other demos do (not under test / reduced motion) */
export function useAutoplay(present: boolean): void {
  useEffect(() => {
    if (present || motionMode() !== 'full' || new URLSearchParams(window.location.search).has('e2e')) return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const id = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => window.clearTimeout(id)
  }, [present])
}

export const floodOf = (s: WorldState) => rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif') ?? null

let busy = false
/** play the scenario flood (clock event, origin Siaga Wilayah); idempotent */
export function playFlood(): Promise<void> {
  if (busy) return Promise.resolve()
  busy = true
  return import('../../demo-kit/world/flood-scenario')
    .then((m) => {
      m.ensureFloodScenario(world.get(), clock.get().minutes)
    })
    .finally(() => {
      busy = false
    })
}

/** the scenario flood starts by itself once the clock passes 07.06 (≈ 36 s at ×10; catch-up on jumps) */
export function useFloodAutoplay(): void {
  useEffect(() => {
    const check = (m: number) => {
      if (m < FLOOD_AT || world.status() !== 'ready' || floodOf(world.get())) return
      void playFlood()
    }
    check(clock.get().minutes)
    const offs = [clock.onMinute(check), clock.onJump((_f: number, to: number) => check(to))]
    return () => {
      for (const off of offs) off()
    }
  }, [])
}
