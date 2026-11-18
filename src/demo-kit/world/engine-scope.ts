/**
 * world/engine-scope.ts — which events the small core pipeline (engine-core.ts) handles completely: the types a demo
 * raises with no visitor input (natural events of a running clock, Awas Belanja's screening). Tiny on purpose: the
 * store (always loaded) uses it to pick which pipeline chunk to download, so opening a demo whose clock runs, or
 * whose product screens at boot, never downloads the full pipeline (reducers + reactions + audit texts of every
 * other type). The world self-test checks that the core handlers of these types are the full ones.
 */
import type { EventType } from './types'

export const CORE_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  'complaint.created', 'mention.created', 'price.updated', 'sale.created', 'ledger.posted', 'score.updated', 'procurement.flagged',
])

/** true when the core pipeline can process `e` exactly as the full one would */
export function coreCovers(e: { type: EventType; payload: unknown }): boolean {
  if (!CORE_EVENT_TYPES.has(e.type)) return false
  // a post of the false-narrative burst can raise hoax.detected (Radar Isu's reaction lives in the full pipeline);
  // that reaction returns nothing for a post without `rumor`, so plain mentions stay in the core
  return !(e.type === 'mention.created' && (e.payload as { rumor?: unknown }).rumor)
}
