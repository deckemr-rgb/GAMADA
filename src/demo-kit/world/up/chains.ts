/**
 * world/up/chains.ts — the second Usaha Pintar world module: the cross-product chains (C15–C21, C23–C29), the reducers
 * and audit texts of the user-action / chain event types. world/eco.ts loads it on the visitor's first interaction on
 * a UP page, or before any event it handles is processed (a flood, a PO, a reply …), so nothing is ever missed.
 */
import type { EventType } from '../types'
import { registerExtension, type WorldExtension } from '../ext'
import { UP } from './config'
import { UP_CHAIN_ID_FIELDS, UP_REDUCERS } from './reducers-up'
import { UP_CHAIN_REACTIONS } from './reactions-up'
import { describeUp } from './audit-up'

export const UP_CHAINS_EXTENSION: WorldExtension = {
  id: `${UP.id}/chains`,
  version: UP.version,
  reducers: UP_REDUCERS as WorldExtension['reducers'],
  reactions: UP_CHAIN_REACTIONS,
  describe: describeUp,
  idFields: UP_CHAIN_ID_FIELDS as unknown as WorldExtension['idFields'],
  covers: new Set(Object.keys(UP_REDUCERS) as EventType[]),
}

export function boot(): void {
  registerExtension(UP_CHAINS_EXTENSION)
  // the Pasar Daerah toast landings (state links L9–L11, Sinyal Pasar → Meja / Indeks Ekonomi): they only follow the
  // visitor's own actions, i.e. after the chains loaded (browser only; the self-tests run without the shell)
  if (typeof window !== 'undefined') void import('../../shell/effects-pd').then((m) => m.register())
}
