/**
 * world/eco-load.ts — the loaders of the ecosystem world modules (see world/eco.ts). Its own small chunk: a Satu Daerah
 * page fetches it only when an event needs another ecosystem (after an action); UP / PD / Inti pages with their
 * landing's modules. Products never import it: world/eco.ts (in the barrel) forwards to it.
 */
import type { WorldModule } from './eco'
import { _eco } from './eco'

type Mod = { boot(): void }
const LOADERS: Record<WorldModule, () => Promise<Mod>> = {
  'usaha-pintar/data': () => import('./up/data'),
  'usaha-pintar': () => import('./up/boot'),
  'usaha-pintar/chains': () => import('./up/chains'),
  'pasar-daerah': () => import('./pd/boot'),
  'pasar-daerah/chains': () => import('./pd/chains'),
}
/** the module a module needs registered first */
const DEP: Partial<Record<WorldModule, WorldModule>> = { 'usaha-pintar': 'usaha-pintar/data', 'usaha-pintar/chains': 'usaha-pintar', 'pasar-daerah/chains': 'pasar-daerah' }

const pending = new Map<WorldModule, Promise<void>>()
export function load(key: WorldModule): Promise<void> {
  if (_eco.loaded.has(key)) return Promise.resolve()
  let p = pending.get(key)
  if (!p) {
    const dep = DEP[key]
    p = Promise.all([LOADERS[key](), dep && load(dep)]).then(
      ([m]) => {
        m.boot()
        _eco.loaded.add(key)
      },
      (err: unknown) => {
        pending.delete(key)
        throw err
      },
    )
    pending.set(key, p)
  }
  return p
}

const UP_SLUGS = 'toko-autopilot pajak-beres juara-jualan kenal-mitra pantau-merek tenderpilot'.split(' ')
/**
 * what a landing preloads (first-load budget, plan §1.1): UP products data + live; Katalog Lokal, Rapor Usaha, Inti
 * and Sinyal Pasar `pemilik-toko` UP data + PD; Indeks Ekonomi and Sinyal Pasar `disperindag` PD only; else nothing.
 */
export function worldModulesFor(slug: string, role?: string | null): WorldModule[] {
  if (UP_SLUGS.includes(slug)) return ['usaha-pintar/data', 'usaha-pintar']
  if (slug === 'indeks-ekonomi' || (slug === 'sinyal-pasar' && role !== 'pemilik-toko')) return ['pasar-daerah']
  return slug === 'katalog-lokal' || slug === 'rapor-usaha' || slug === 'inti' || slug === 'sinyal-pasar' ? ['usaha-pintar/data', 'pasar-daerah'] : []
}
