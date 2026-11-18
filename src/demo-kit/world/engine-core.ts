/**
 * world/engine-core.ts — the event pipeline loop plus the CORE handlers (reducers-core, reactions-core, audit-core).
 *   prepare (assign ids, events.ts) → reducer → auditLog row → reactions (follow-ups, depth-limited, BFS) → next event.
 *
 * `processWith(handlers, …)` stops BEFORE the first event its handlers do not cover and returns the rest of the
 * BFS queue untouched (`rest`); the caller continues it with the full handlers (engine.ts) in the same order, so the
 * result is identical to one full run (same ids, same audit rows, same reactions). The store loads this chunk for
 * the events a demo raises by itself and engine.ts (which imports this one) only when another type arrives.
 * Deterministic: same state + same events ⇒ same result. The only mutable thing is the `seq` counter bag, which the
 * caller owns and which is written back into `state.meta.seq` at the end of each call.
 */
import type { AnyWorldEvent, Bi, EntityRef, EventType, WorldEvent, WorldState } from './types'
import type { Reducer, ReducerMap } from './reducers'
import { CORE_REDUCERS } from './reducers-core'
import { CORE_REACTIONS, type Reaction } from './reactions-core'
import { describeCore } from './audit-core'
import { coreCovers } from './engine-scope'
import { createEvent } from './events'
import { nextId, type Seq } from './ids'
import { WORLD, beginBatch, endBatch, upsert } from './util'

export interface Handlers {
  reducers: ReducerMap
  reactions: readonly Reaction[]
  /** audit summary + refs; null = not handled (only for an uncovered type, which never reaches it) */
  describe(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null
  /** the handlers can process this event (and its reactions) exactly as the full pipeline */
  covers(e: WorldEvent): boolean
}

export const CORE: Handlers = { reducers: CORE_REDUCERS, reactions: CORE_REACTIONS, describe: describeCore, covers: coreCovers }

export interface CoreBatchResult {
  state: WorldState
  /** every event that was applied, in processing order (direct + reactions) */
  processed: WorldEvent[]
  /** follow-ups dropped because of the depth limit */
  dropped: number
  /** the queue from the first event the handlers do not cover (empty when all were processed) */
  rest: WorldEvent[]
}

/**
 * Apply a batch of already-created events. Reactions run on the post-reducer state; their follow-ups are
 * queued (breadth first) with depth + 1 and dropped beyond WORLD.maxDepth.
 */
export function processWith(h: Handlers, state: WorldState, seq: Seq, events: WorldEvent[], onError?: (err: unknown, e: WorldEvent) => void): CoreBatchResult {
  let s = state
  const queue: WorldEvent[] = [...events]
  const processed: WorldEvent[] = []
  let rest: WorldEvent[] = []
  let dropped = 0
  beginBatch()
  try {
    while (queue.length) {
      if (!h.covers(queue[0]!)) {
        rest = queue.splice(0)
        break
      }
      const e = queue.shift()!
      const reducer = h.reducers[e.type] as Reducer<EventType> | undefined
      let next: WorldState
      try {
        next = reducer ? reducer(s, e) : s
        const d = h.describe(e as AnyWorldEvent, next)
        if (!d) throw new Error(`audit: no summary for ${e.type}`)
        const { summary, refs } = d
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
      for (const r of h.reactions) {
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
  // (a stopped call leaves the meta write to the call that continues `rest`; the end values are the same)
  if (processed.length || (events.length && !rest.length)) {
    s = { ...s, meta: { ...s.meta, seq: { ...seq }, processed: s.meta.processed + processed.length } }
  }
  return { state: s, processed, dropped, rest }
}
