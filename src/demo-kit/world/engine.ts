/**
 * world/engine.ts — the pure event pipeline used by the store (and the self-tests):
 *   prepare (assign ids, events.ts) → reducer → auditLog row → reactions (follow-ups, depth-limited, BFS) → next event.
 * The store loads this module (with reducers, reactions and audit texts) on the FIRST emitted event, so a page that
 * only shows a world never downloads it.
 * Deterministic: same state + same events ⇒ same result. The only mutable thing is the `seq` counter bag,
 * which the caller owns and which is written back into `state.meta.seq` at the end of each batch.
 */
import type { AnyWorldEvent, EventType, WorldEvent, WorldState } from './types'
import { REDUCERS, type Reducer } from './reducers'
import { REACTIONS } from './reactions'
import { describe } from './audit'
import { createEvent } from './events'
import { nextId, type Seq } from './ids'
import { WORLD, beginBatch, endBatch, upsert } from './util'

export { createEvent, prepare } from './events'

export interface BatchResult {
  state: WorldState
  /** every event that was applied, in processing order (direct + reactions) */
  processed: WorldEvent[]
  /** follow-ups dropped because of the depth limit */
  dropped: number
}

/**
 * Apply a batch of already-created events. Reactions run on the post-reducer state; their follow-ups are
 * queued (breadth first) with depth + 1 and dropped beyond WORLD.maxDepth.
 */
export function processEvents(state: WorldState, seq: Seq, events: WorldEvent[], onError?: (err: unknown, e: WorldEvent) => void): BatchResult {
  let s = state
  const queue: WorldEvent[] = [...events]
  const processed: WorldEvent[] = []
  let dropped = 0
  beginBatch()
  try {
    while (queue.length) {
      const e = queue.shift()!
      const reducer = REDUCERS[e.type] as Reducer<EventType> | undefined
      let next: WorldState
      try {
        next = reducer ? reducer(s, e) : s
        const { summary, refs } = describe(e as AnyWorldEvent, next)
        next = {
          ...next,
          auditLog: upsert(next.auditLog, {
            id: nextId(seq, 'auditLog'), eventId: e.id, at: e.at, source: e.source, type: e.type, summary, entityRefs: refs.filter((r) => !r.endsWith(':')),
            depth: e.depth ?? 0, causeId: e.causeId ?? null, ...(e.origin ? { origin: e.origin } : {}),
          }),
        }
      } catch (err) {
        onError?.(err, e)
        continue
      }
      s = next
      processed.push(e)
      const depth = e.depth ?? 0
      for (const r of REACTIONS) {
        if (r.on !== e.type) continue
        let outs
        try {
          outs = r.run(e, s)
        } catch (err) {
          onError?.(err, e)
          continue
        }
        for (const o of outs) {
          if (depth + 1 > WORLD.maxDepth) {
            dropped++
            continue
          }
          queue.push(createEvent(s, seq, o.type, o.payload, o.source, e.at, depth + 1, e.id))
        }
      }
    }
  } finally {
    endBatch()
  }
  if (processed.length || events.length) {
    s = { ...s, meta: { ...s.meta, seq: { ...seq }, processed: s.meta.processed + processed.length } }
  }
  return { state: s, processed, dropped }
}
