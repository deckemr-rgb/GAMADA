/**
 * world/ — the simulated world shared by every GAMADA demo (spec §6.1–6.2). Barrel of the RUNNING world.
 *
 * Two heavy parts are deliberately NOT re-exported, so a page that imports the barrel does not download them up front:
 *  - the GENERATOR (seed.ts + catalog + name lists + docs/nik): loadWorld()/resetWorld() fetch it only when a world
 *    must be generated (never when it is restored from IndexedDB, never on a page that loads no world);
 *  - the event PIPELINE (engine.ts + reducers + reactions + audit texts): fetched on the first emit();
 *  - the natural-event generator (natural-gen.ts + texts): fetched the first time the running clock crosses a minute.
 * Import them directly where really needed: `generateWorld` from 'world/seed', `personName`/`makeNamer`/
 * `groupWeights` from 'world/names' (also 'world/rng'), `processEvents` from 'world/engine', `REDUCERS` from
 * 'world/reducers', `REACTIONS` from 'world/reactions', `describe` from 'world/audit', `naturalEventsAt` from
 * 'world/natural-gen' (types stay exported here).
 * Random numbers alone: 'world/prng' (no data).
 * Importing this barrel also installs the natural-events listener on the world clock.
 */
export * from './types'
export { world, emit, onEvent, settled, loadWorld, resetWorld, preloadWorldGenerator, preloadWorldEngine, exportWorld, importWorld, useWorld, useWorldStatus, emptyWorld, type WorldStatus } from './store'
export { createEvent, prepare, isEvent } from './events'
export type { Reducer, ReducerMap } from './reducers'
export type { Reaction } from './reactions'
export type { BatchResult } from './engine'
export { mulberry32, hashString, makeRng, streamRng, type Rng } from './prng'
export { formatId } from './ids'
export { clock, useClock, setTime, play, pause, setSpeed, formatTime, parseTime, CLOCK, type ClockSpeed, type ClockState } from './clock'
export { setNaturalEvents, naturalEventsOn, useNaturalEvents, naturalBacklog, onNaturalBacklog, NATURAL, setNaturalBoost } from './natural'
export {
  ensureEcosystem, preloadEcosystemChains, useEcosystemReady, preloadWorldFor,
  type WorldEco, type WorldModule,
} from './eco'
export { useSession, setSession, getSession, subscribeSession, DEFAULT_SEED, type DemoSession } from './session'
export { loadPersisted, savePersisted, clearPersisted, flushPersist, persistKey, type Persisted, type WorldScope } from './persist'
export * from './selectors'
export { computeScore, scoreOf, SCORE_WEIGHTS } from './score'
export { CATEGORY_LABEL } from './labels'
export { WORLD, DAY_MIN, HOUR_RHYTHM, rows, get, hhmm, isoDay, monthOf, worldDate, distanceKm, shallowEqual, fmtRp, ref, TABLE_KEYS, currentRegion } from './util'
