/**
 * world/engine.ts — the FULL event pipeline used by the store (and the self-tests): every type's reducer, reaction
 * and audit text, run by engine-core's loop:
 *   prepare (assign ids, events.ts) → reducer → auditLog row → reactions (follow-ups, depth-limited, BFS) → next event.
 * The store downloads it only when an event outside the core set (engine-scope.ts) is emitted, or on the visitor's
 * first pointerdown / keydown (preloadWorldEngine); the core types run through engine-core.ts alone, with the same
 * functions (reducers.ts / reactions.ts / audit.ts include the core ones), so the results are identical.
 * Deterministic: same state + same events ⇒ same result. The only mutable thing is the `seq` counter bag,
 * which the caller owns and which is written back into `state.meta.seq` at the end of each batch.
 */
import type { WorldEvent, WorldState } from './types'
import { REDUCERS } from './reducers'
import { REACTIONS } from './reactions'
import { describe } from './audit'
import { processWith, type Handlers } from './engine-core'
import type { Seq } from './ids'

export { createEvent, prepare } from './events'
export { processWith, type Handlers } from './engine-core'

export interface BatchResult {
  state: WorldState
  /** every event that was applied, in processing order (direct + reactions) */
  processed: WorldEvent[]
  /** follow-ups dropped because of the depth limit */
  dropped: number
}

/** every type's handlers */
export const FULL: Handlers = { reducers: REDUCERS, reactions: REACTIONS, describe, covers: () => true }

/**
 * Apply a batch of already-created events. Reactions run on the post-reducer state; their follow-ups are
 * queued (breadth first) with depth + 1 and dropped beyond WORLD.maxDepth.
 */
export function processEvents(state: WorldState, seq: Seq, events: WorldEvent[], onError?: (err: unknown, e: WorldEvent) => void): BatchResult {
  const { state: s, processed, dropped } = processWith(FULL, state, seq, events, onError)
  return { state: s, processed, dropped }
}
