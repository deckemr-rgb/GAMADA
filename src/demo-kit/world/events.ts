/**
 * world/events.ts — creating an event: generated ids for missing payload fields (prepare) and the event envelope
 * (createEvent). Synchronous and tiny, so emit() can hand back ids at once while the pipeline (engine.ts) loads.
 */
import type { EventMap, EventSource, EventType, Minutes, TableKey, WorldEvent, WorldState } from './types'
import { formatId, nextEventId, nextId, type Seq } from './ids'
import { extensions } from './ext'

/** payload fields that receive a generated id when missing: [field, table, alsoCode] */
const ID_FIELDS: { [K in EventType]?: [string, TableKey, boolean?][] } = {
  'complaint.created': [['id', 'complaints', true], ['ticketId', 'tickets']],
  'complaint.clustered': [['clusterId', 'clusters']],
  'service.booked': [['id', 'bookings', true]],
  'briefing.generated': [['id', 'briefings']],
  'instruction.issued': [['id', 'instructions']],
  'actionItem.created': [['id', 'actionItems']],
  'letter.received': [['id', 'letters']],
  'letter.dispositioned': [['letterId', 'letters']],
  'hoax.detected': [['id', 'hoaxAlerts']],
  'mention.created': [['id', 'mentions']],
  'flood.alert': [['id', 'alerts']],
  'eligibility.opened': [['id', 'programs']],
  'citizen.notified': [['id', 'messages']],
  'supply.signal': [['id', 'supplySignals']],
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
  let fields = ID_FIELDS[type]
  for (const x of extensions()) fields ??= x.idFields?.[type]
  if (!fields) return payload
  const p = { ...(payload as Record<string, unknown>) }
  const year = s.day.slice(0, 4)
  for (const [field, table, code] of fields) {
    if (p[field] === undefined || p[field] === null || p[field] === '') p[field] = nextId(seq, table, year)
    if (code && (p.code === undefined || p.code === null || p.code === '')) p.code = p[field]
  }
  return p as EventMap[K]
}

/**
 * The first complaint number after a fresh world is kept for the visitor: when a background (clock) complaint would
 * take it, it skips one number, and the next complaint a product emits gets the kept number. So the sample voice note
 * is SW-…-0141 whether or not the 07.02 background report landed first. `seq.complaintKept` = the kept number
 * (0 = used / none), `seq.complaintKeep` = 1 once decided (persisted with the counters).
 */
function keepFirstComplaint<K extends EventType>(s: WorldState, seq: Seq, type: K, payload: EventMap[K], source: EventSource): EventMap[K] {
  if (type !== 'complaint.created') return payload
  const p = payload as EventMap['complaint.created']
  if (p.id) return payload
  if (!seq.complaintKeep) {
    seq.complaintKeep = 1
    if (source === 'clock') {
      seq.complaintKept = (seq.complaints ?? 0) + 1
      seq.complaints = seq.complaintKept
    }
    return payload
  }
  if (source !== 'clock' && seq.complaintKept) {
    const id = formatId('complaints', seq.complaintKept, s.day.slice(0, 4))
    seq.complaintKept = 0
    return { ...p, id } as EventMap[K]
  }
  return payload
}

export function createEvent<K extends EventType>(
  s: WorldState, seq: Seq, type: K, payload: EventMap[K], source: EventSource, at: Minutes, depth = 0, causeId: string | null = null,
): WorldEvent<K> {
  return { id: nextEventId(seq), type, at: Math.round(at), source, payload: prepare(s, seq, type, keepFirstComplaint(s, seq, type, payload, source)), depth, causeId }
}

/**
 * Type guard for a processed event: `if (isEvent(e, 'complaint.created')) e.payload.channel` (Mission.done, onEvent('*')).
 * WorldEvent's payload is the union of all payloads until the type is narrowed this way.
 */
export function isEvent<K extends EventType>(e: WorldEvent, type: K): e is WorldEvent<K> {
  return e.type === type
}
