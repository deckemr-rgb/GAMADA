/**
 * world/pd/chains.ts — the second Pasar Daerah world module (world/eco.ts key 'pasar-daerah/chains'): chains C30–C38
 * and the audit texts of the chain follow-ups (shock, warning, alert). Loaded on the first interaction on a PD / Inti
 * page, or before any event it handles is processed (a flood, a user need, a payment, an approval …).
 */
import type { EventType } from '../types'
import { registerExtension, type WorldExtension } from '../ext'
import { PD_CHAIN_REDUCERS } from './reducers-chains'
import { PD } from './config'
import { PD_CHAIN_REACTIONS } from './reactions'
import { describePdChains } from './audit-chains'

export const PD_CHAINS_EXTENSION: WorldExtension = {
  id: `${PD.id}/chains`,
  version: PD.version,
  reducers: PD_CHAIN_REDUCERS as WorldExtension['reducers'],
  reactions: PD_CHAIN_REACTIONS,
  describe: describePdChains,
  covers: new Set(Object.keys(PD_CHAIN_REDUCERS) as EventType[]),
}

export function boot(): void {
  registerExtension(PD_CHAINS_EXTENSION)
  // the Pasar Daerah toast landings (state links L9–L11, Sinyal Pasar → Meja / Indeks Ekonomi): they only follow the
  // visitor's own actions, i.e. after the chains loaded (browser only; the self-tests run without the shell)
  if (typeof window !== 'undefined') void import('../../shell/effects-pd').then((m) => m.register())
}
