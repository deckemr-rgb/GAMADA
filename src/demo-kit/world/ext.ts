/**
 * world/ext.ts — ecosystem extensions of the world (dependency-free, always loaded, tiny).
 *
 * An extension (e.g. Usaha Pintar, world/up/boot.ts) is downloaded on intent (world/eco.ts) and registers here:
 *  - `reducers` for event types the core does not reduce (a duplicate key throws),
 *  - `reactions`, run AFTER the core ones in registration order (deterministic),
 *  - `describe` (audit text) for its own types,
 *  - `idFields` (payload fields that receive generated ids at emit time),
 *  - `covers`: the types its handlers process completely (reducer + audit + every reaction is its own), so the small
 *    core pipeline (engine-core) can run them without downloading engine.ts (natural UP events at boot),
 *  - `extend(state)`: the data patch (pure, deterministic) the store applies to every installed world once
 *    (`meta.ext[id] === version` marks it). Invariant: handlers registered ⇔ data present.
 * The engines read `extensions()` / `extVersion()` on every batch, so nothing here imports the pipeline.
 */
import type { AnyFollowUp, AnyWorldEvent, Bi, EntityRef, EventType, TableKey, WorldEvent, WorldState } from './types'
import type { RegionPack } from '../region/types'

export interface ExtReaction {
  id: string
  on: EventType
  run(e: WorldEvent, s: WorldState): AnyFollowUp[]
}
export interface WorldExtension {
  id: string
  version: number
  reducers: { [K in EventType]?: (s: WorldState, e: WorldEvent<K>) => WorldState }
  reactions: readonly ExtReaction[]
  describe(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null
  idFields?: { [K in EventType]?: [string, TableKey, boolean?][] }
  /** types processed completely by this extension's handlers (no core-full reaction listens to them) */
  covers?: ReadonlySet<EventType>
  /** the data patch for a world that does not carry this extension yet (handlers-only extensions have none) */
  extend?(s: WorldState, pack: RegionPack | null): WorldState
}

const list: WorldExtension[] = []
let version = 0
const subs = new Set<() => void>()

/** register once per id (a second call with the same id is ignored) */
export function registerExtension(x: WorldExtension): void {
  if (list.some((e) => e.id === x.id)) return
  list.push(x)
  version++
  for (const fn of [...subs]) fn()
}
export const extensions = (): readonly WorldExtension[] => list
/** bumps on every registration (engines cache their merged handlers by it) */
export const extVersion = (): number => version
export function onExtensions(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

/** true when a registered extension processes this type completely (core pipeline may run it) */
export const extCovers = (type: EventType): boolean => list.some((x) => x.covers?.has(type))

/** apply every registered extension the world does not carry yet (pure; same input ⇒ same output) */
export function applyExtensions(s: WorldState, pack: RegionPack | null): WorldState {
  let next = s
  for (const x of list) {
    if (!x.extend || !next.regionId || next.meta.ext?.[x.id] === x.version) continue
    next = x.extend(next, pack)
    next = { ...next, meta: { ...next.meta, ext: { ...next.meta.ext, [x.id]: x.version } } }
  }
  return next
}
