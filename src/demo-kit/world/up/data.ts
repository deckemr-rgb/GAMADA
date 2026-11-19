/**
 * world/up/data.ts — the Usaha Pintar DATA module (world/eco.ts key 'usaha-pintar/data'): only the seed extension
 * `extendUsahaPintar` (deterministic; the store patches every installed world once, `meta.ext['usaha-pintar']`). No
 * handlers: Pasar Daerah products (Katalog Lokal, Rapor Usaha, Inti, Sinyal Pasar UMKM side) read UP data without
 * the UP live module. The live module (world/up/boot.ts, key 'usaha-pintar') imports this one first.
 */
import { registerExtension, type WorldExtension } from '../ext'
import { _extendCurrent } from '../store'
import { UP } from './config'
import { extendUsahaPintar } from './seed-up'

/** the data extension (id 'usaha-pintar' = the `meta.ext` key products and tests read) */
export const UP_DATA_EXTENSION: WorldExtension = {
  id: UP.id,
  version: UP.version,
  reducers: {},
  reactions: [],
  describe: () => null,
  extend: (s, pack) => extendUsahaPintar(s, pack),
}

let booted = false
export function boot(): void {
  if (booted) return
  booted = true
  registerExtension(UP_DATA_EXTENSION)
  _extendCurrent()
}
