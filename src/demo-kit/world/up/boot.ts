/**
 * world/up/boot.ts — the Usaha Pintar world module, loaded on intent by world/eco.ts (`ensureEcosystem`). It registers
 * the handlers the natural events need at boot (calls, verification requests, brand mentions, tenders + C22), the
 * natural-event source, and patches the installed world with `extendUsahaPintar` (the store does it for every world
 * installed afterwards too). The chains (world/up/chains.ts) follow on the first interaction.
 */
import type { EventType, WorldState } from '../types'
import { registerExtension, type WorldExtension } from '../ext'
import { registerNaturalSource } from '../natural'
import { _extendCurrent } from '../store'
import { UP } from './config'
import { UP_BOOT_ID_FIELDS, UP_BOOT_REDUCERS } from './reducers-boot'
import { UP_BOOT_REACTIONS } from './reactions-boot'
import { describeUpBoot } from './audit-boot'
import { naturalUpAt } from './natural-up'
import { extendUsahaPintar } from './seed-up'

/** the extension object (the world self-test registers it without the store) */
export const UP_EXTENSION: WorldExtension = {
  id: UP.id,
  version: UP.version,
  reducers: UP_BOOT_REDUCERS as WorldExtension['reducers'],
  reactions: UP_BOOT_REACTIONS,
  describe: describeUpBoot,
  idFields: UP_BOOT_ID_FIELDS as unknown as WorldExtension['idFields'],
  // these types are reduced, described and reacted on by UP modules alone: the core pipeline may run them
  covers: new Set(Object.keys(UP_BOOT_REDUCERS) as EventType[]),
  extend: (s: WorldState, pack) => extendUsahaPintar(s, pack),
}

let booted = false
export function boot(): void {
  if (booted) return
  booted = true
  registerExtension(UP_EXTENSION)
  registerNaturalSource(UP.id, naturalUpAt)
  _extendCurrent()
}
