/**
 * world/up/boot.ts — the Usaha Pintar LIVE module (world/eco.ts key 'usaha-pintar'): the handlers the natural events
 * need at boot (calls, verification requests, brand mentions, tenders + C22) and the natural-event source. It loads
 * the data module (world/up/data.ts) first, so "UP live handlers registered ⇒ UP data present". The chains
 * (world/up/chains.ts) follow on the first interaction.
 */
import type { EventType } from '../types'
import { registerExtension, type WorldExtension } from '../ext'
import { registerNaturalSource } from '../natural'
import { UP } from './config'
import { UP_BOOT_ID_FIELDS, UP_BOOT_REDUCERS } from './reducers-boot'
import { UP_BOOT_REACTIONS } from './reactions-boot'
import { describeUpBoot } from './audit-boot'
import { naturalUpAt } from './natural-up'
import { boot as bootData } from './data'

export { UP_DATA_EXTENSION } from './data'

/** the live handlers (the world self-test registers it without the store); the data patch is UP_DATA_EXTENSION */
export const UP_EXTENSION: WorldExtension = {
  id: `${UP.id}/live`,
  version: UP.version,
  reducers: UP_BOOT_REDUCERS as WorldExtension['reducers'],
  reactions: UP_BOOT_REACTIONS,
  describe: describeUpBoot,
  idFields: UP_BOOT_ID_FIELDS as unknown as WorldExtension['idFields'],
  // these types are reduced, described and reacted on by UP modules alone: the core pipeline may run them
  covers: new Set(Object.keys(UP_BOOT_REDUCERS) as EventType[]),
}

let booted = false
export function boot(): void {
  if (booted) return
  booted = true
  bootData()
  registerExtension(UP_EXTENSION)
  registerNaturalSource(UP.id, naturalUpAt)
}
