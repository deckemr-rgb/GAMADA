/**
 * world/up/reactions-boot.ts — the one UP reaction the natural events need at boot: C22 'tender→match' (a new
 * tender in the shop's field is matched with its win probability). The other chains load on the first interaction.
 */
import type { AnyFollowUp, EventType, FollowUp, WorldEvent, WorldState } from '../types'
import { SHOP_KBLI } from './config'
import { winScoreOf } from './win-score'

export interface UpReaction { id: string; on: EventType; run(e: WorldEvent, s: WorldState): AnyFollowUp[] }
const fu = <K extends EventType>(type: K, payload: FollowUp<K>['payload'], source: FollowUp<K>['source']): AnyFollowUp => ({ type, payload, source }) as AnyFollowUp

export const UP_BOOT_REACTIONS: readonly UpReaction[] = [
  {
    id: 'tender→match',
    on: 'tender.created',
    run: (ev, s) => {
      const e = ev as WorldEvent<'tender.created'>
      const t = s.tenders.byId[e.payload.id ?? '']
      const shop = s.businesses.byId[s.meta.shopId]
      if (!t || !shop || t.matches[shop.id] !== undefined) return []
      const fits = SHOP_KBLI.includes(t.kbli) || (!!t.items?.length && t.items.every((i) => shop.supplies.includes(i.category)))
      if (!fits) return []
      return [fu('tender.matched', { tenderId: t.id, businessId: shop.id, probability: winScoreOf(s, t.id, shop.id).probability }, 'tenderpilot')]
    },
  },
]
