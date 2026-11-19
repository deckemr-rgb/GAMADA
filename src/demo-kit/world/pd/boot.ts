/**
 * world/pd/boot.ts — the Pasar Daerah world module (world/eco.ts key 'pasar-daerah', UP-free): reducers + boot audit
 * texts of the PD event types, the natural events (natural-pd.ts) and one boot reaction: a natural need brings its
 * own matches (so the 07:01 need lights its lines without the chains module or engine.ts), and the PD data patch
 * (`extendPasarDaerah`: facts.pd + the past market operation). Chains C30–C38: world/pd/chains.ts.
 */
import type { AnyFollowUp, EventType, WorldEvent, WorldState } from '../types'
import { registerExtension, type ExtReaction, type WorldExtension } from '../ext'
import { registerNaturalSource } from '../natural'
import { ID_PREFIX } from '../ids'
import { PD } from './config'
import { PD_ID_FIELDS, PD_REDUCERS } from './reducers'
import { describePdBoot } from './audit'
import { naturalPdAt } from './natural-pd'
import { newMatchesFor } from './match'
import { extendPasarDaerah } from './seed-pd'
import { _extendCurrent } from '../store'

/** the natural need's matches (C36 skips natural needs): source katalog-lokal, same batch as the need */
export const R_NATURAL_MATCHES: ExtReaction = {
  id: 'natural-need→matches',
  on: 'need.created',
  run(e: WorldEvent, s: WorldState): AnyFollowUp[] {
    const p = (e as WorldEvent<'need.created'>).payload
    if (p.by !== 'natural' || !p.id) return []
    return newMatchesFor(s, p.id).map((m) => ({ type: 'match.made', payload: { needId: p.id!, businessId: m.businessId, score: m.score }, source: 'katalog-lokal' }) as AnyFollowUp)
  },
}

// id prefixes of the PD tables: world/ids.ts ID_PREFIX gets them with this module (boot() or a self-test registration)
Object.assign(ID_PREFIX, { consents: 'IZ', priceSubs: 'LG', priceAlerts: 'PA', priceShocks: 'GJ', priceWarnings: 'PDN', distributorWatches: 'DW' })

export const PD_EXTENSION: WorldExtension = {
  id: PD.id,
  version: PD.version,
  reducers: PD_REDUCERS as WorldExtension['reducers'],
  reactions: [R_NATURAL_MATCHES],
  describe: describePdBoot,
  idFields: PD_ID_FIELDS,
  // reduced + described here; no reaction of the full pipeline listens to them (the gate loads the chains first when needed)
  covers: new Set(Object.keys(PD_REDUCERS) as EventType[]),
  extend: (s) => extendPasarDaerah(s),
}

let booted = false
export function boot(): void {
  if (booted) return
  booted = true
  registerExtension(PD_EXTENSION)
  registerNaturalSource(PD.id, naturalPdAt)
  _extendCurrent()
}
