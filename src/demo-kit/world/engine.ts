/**
 * world/engine.ts — the pure event pipeline used by the store (and the self-tests):
 *   prepare (assign ids) → reducer → auditLog row → reactions (follow-ups, depth-limited, BFS) → next event.
 * Deterministic: same state + same events ⇒ same result. The only mutable thing is the `seq` counter bag,
 * which the caller owns and which is written back into `state.meta.seq` at the end of each batch.
 */
import type { AnyWorldEvent, EventMap, EventSource, EventType, Minutes, TableKey, WorldEvent, WorldState } from './types'
import { REDUCERS, type Reducer } from './reducers'
import { REACTIONS } from './reactions'
import { describe } from './audit'
import { nextEventId, nextId, type Seq } from './ids'
import { WORLD, beginBatch, endBatch, upsert } from './util'

/** payload fields that receive a generated id when missing: [field, table, alsoCode] */
const ID_FIELDS: { [K in EventType]?: [string, TableKey, boolean?][] } = {
  'complaint.created': [['id', 'complaints', true], ['ticketId', 'tickets']],
  'complaint.clustered': [['clusterId', 'clusters']],
  'service.booked': [['id', 'bookings', true]],
  'briefing.generated': [['id', 'briefings']],
  'instruction.issued': [['id', 'instructions']],
  'actionItem.created': [['id', 'actionItems']],
  'letter.dispositioned': [['letterId', 'letters']],
  'hoax.detected': [['id', 'hoaxAlerts']],
  'mention.created': [['id', 'mentions']],
  'flood.alert': [['id', 'alerts']],
  'eligibility.opened': [['id', 'programs']],
  'procurement.created': [['id', 'procurements', true]],
  'sale.created': [['id', 'sales', true]],
  'po.sent': [['id', 'purchaseOrders', true]],
  'ledger.posted': [['id', 'ledger']],
  'coaching.assigned': [['id', 'coachings']],
  'bid.submitted': [['id', 'bids']],
  'need.created': [['id', 'catalogNeeds', true]],
  'match.made': [['id', 'matches']],
  'order.created': [['id', 'orders', true]],
  'loan.applied': [['id', 'loanApps']],
  'market.operation': [['id', 'marketOps']],
}

/** fill generated ids into a (copied) payload */
export function prepare<K extends EventType>(s: WorldState, seq: Seq, type: K, payload: EventMap[K]): EventMap[K] {
  const fields = ID_FIELDS[type]
  if (!fields) return payload
  const p = { ...(payload as Record<string, unknown>) }
  const year = s.day.slice(0, 4)
  for (const [field, table, code] of fields) {
    if (p[field] === undefined || p[field] === null || p[field] === '') p[field] = nextId(seq, table, year)
    if (code && (p.code === undefined || p.code === null || p.code === '')) p.code = p[field]
  }
  return p as EventMap[K]
}

export function createEvent<K extends EventType>(
  s: WorldState, seq: Seq, type: K, payload: EventMap[K], source: EventSource, at: Minutes, depth = 0, causeId: string | null = null,
): WorldEvent<K> {
  return { id: nextEventId(seq), type, at: Math.round(at), source, payload: prepare(s, seq, type, payload), depth, causeId }
}

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
            depth: e.depth ?? 0, causeId: e.causeId ?? null,
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
