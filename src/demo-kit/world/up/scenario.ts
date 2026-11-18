/**
 * world/up/scenario.ts — `useFloodAutoplay(enabled)`: once the world clock passes UP_SCENARIO.floodAt (07.06), the
 * scenario flood starts by itself (catch-up on jumps; nothing while a flood alert is active). Pantau Merek and
 * TenderPilot opt in; Awas Belanja is moved onto it in integration.
 */
import { useEffect } from 'react'
import { clock } from '../clock'
import { world } from '../store'
import { UP_SCENARIO } from './config'
import { ensureFloodScenario } from './scenario-core'

export { UP_SCENARIO } from './config'
export { ensureFloodScenario, activeFloodAlert } from './scenario-core'

let fired = false
export function useFloodAutoplay(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const check = (m: number) => {
      if (m < UP_SCENARIO.floodAt || world.status() !== 'ready') return
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
