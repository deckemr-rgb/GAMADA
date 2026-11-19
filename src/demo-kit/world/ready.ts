/**
 * world/ready.ts — the Pasar Daerah / Inti readiness API (NOT in the world barrel, so Satu Daerah pages never carry
 * it): `import { useWorldReady, preloadWorld } from '../../demo-kit/world/ready'`.
 *  - `useWorldReady(mods)` requests the missing world modules (idempotent) and is true once all are registered on a
 *    ready world that carries their data ('usaha-pintar/data' ⇒ the UP data, 'pasar-daerah' ⇒ the PD patch). Pass a
 *    stable list (a module-level constant).
 *  - `preloadWorld(mod)` starts one module's download (e.g. Sinyal Pasar's role chip intent: 'usaha-pintar/data').
 */
import { world } from './store'
import { _eco, type WorldModule } from './eco'

export type { WorldModule } from './eco'

export function preloadWorld(mod: WorldModule): void {
  _eco.load(mod).catch(() => {})
}

/** a ready world carrying the data of these modules with all of them registered */
export function worldReadyFor(mods: readonly WorldModule[]): boolean {
  const ext = world.get().meta.ext
  return world.status() === 'ready' && mods.every((m) => _eco.loaded.has(m) && (m === 'usaha-pintar/data' || m === 'usaha-pintar' ? !!ext?.['usaha-pintar'] : m !== 'pasar-daerah' || !!ext?.['pasar-daerah']))
}

const requested = new Set<WorldModule>()
export function useWorldReady(mods: readonly WorldModule[]): boolean {
  for (const m of mods) {
    if (_eco.loaded.has(m) || requested.has(m)) continue
    requested.add(m)
    _eco.load(m).catch(() => requested.delete(m))
  }
  return _eco.use(() => worldReadyFor(mods))
}
