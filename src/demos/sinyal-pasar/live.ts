/**
 * demos/sinyal-pasar/live.ts — the hooks that keep the sandbox alive on both sides: the clock autoplay at 07.00 and the
 * scenario flood at 07.06 (Sinyal Pasar opts in, plan §1.6). The flood helper (world/flood-scenario) is fetched on use.
 */
import { useEffect } from 'react'
import { motionMode } from '../../demo-kit/ui'
import { clock, onEvent, rows, world, type ClockSpeed, type WorldState } from '../../demo-kit/world'

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

/** resolves after the next paint: the control answers in this frame, the heavy work follows (INP) */
export const nextPaint = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

let busy = false
/** play the scenario flood (clock event, origin Siaga Wilayah); idempotent */
export function playFlood(): Promise<void> {
  if (busy) return Promise.resolve()
  busy = true
  // the pressed button paints first; the flood (one heavy emit) runs after that frame (INP)
  return Promise.all([import('../../demo-kit/world/flood-scenario'), nextPaint()])
    .then(([m]) => {
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

/** the flood's shock leaves the seasonal band at shock +2 (world/pd/natural-pd SHOCK_STEPS); give up after +5 */
const FF_MAX_MIN = 5
/**
 * After the flood, while the clock runs, the world clock runs at ×60 until the shock's first anomaly lands (flood +2
 * world minutes ⇒ ≈ 2 s instead of ≈ 12–18 s at ×10), then the visitor's speed comes back. Only the pace changes:
 * every world minute still runs (same natural path, same numbers as the tour / Indeks Ekonomi read for that minute).
 * A paused clock is left alone; a speed or pause chosen meanwhile wins (no restore over it).
 */
export function useAnomalyFastForward(): void {
  useEffect(() => {
    let prev: ClockSpeed | null = null
    let until = -1
    const stop = () => {
      const c = clock.get()
      if (prev !== null && c.running && c.speed === 60) clock.setSpeed(prev)
      prev = null
      until = -1
    }
    const offs = [
      onEvent('flood.alert', (e) => {
        const c = clock.get()
        if (prev !== null || !c.running || c.speed >= 60 || rows(world.get().prices).some((p) => p.anomaly && p.updatedAt >= e.at)) return
        prev = c.speed
        until = e.at + FF_MAX_MIN
        clock.setSpeed(60)
      }),
      onEvent('price.anomaly', () => stop()),
      clock.onMinute((m) => {
        if (prev !== null && m >= until) stop()
      }),
    ]
    return () => {
      for (const off of offs) off()
      stop()
    }
  }, [])
}
