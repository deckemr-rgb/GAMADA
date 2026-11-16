/**
 * world/ — the simulated world shared by every GAMADA demo (spec §6.1–6.2). Barrel.
 * Importing this barrel also installs the natural-events listener on the world clock.
 */
export * from './types'
export { world, emit, onEvent, settled, loadWorld, resetWorld, exportWorld, importWorld, useWorld, useWorldStatus, emptyWorld, type WorldStatus } from './store'
export { REDUCERS, type Reducer, type ReducerMap } from './reducers'
export { REACTIONS, type Reaction } from './reactions'
export { createEvent, processEvents, prepare, type BatchResult } from './engine'
export { describe as describeEvent } from './audit'
export { generateWorld, mulberry32, hashString, makeRng, streamRng, groupWeights, personName, makeNamer, formatId, type Rng } from './seed'
export { clock, useClock, setTime, play, pause, setSpeed, formatTime, parseTime, CLOCK, type ClockSpeed, type ClockState } from './clock'
export { setNaturalEvents, naturalEventsOn, useNaturalEvents, naturalEventsAt, NATURAL } from './natural'
export { useSession, setSession, getSession, subscribeSession, DEFAULT_SEED, type DemoSession } from './session'
export { loadPersisted, savePersisted, clearPersisted, persistKey, type Persisted } from './persist'
export * from './selectors'
export { computeScore, scoreOf, SCORE_WEIGHTS } from './score'
export { CATEGORY_LABEL } from './catalog'
export { WORLD, DAY_MIN, HOUR_RHYTHM, rows, get, hhmm, isoDay, monthOf, worldDate, distanceKm, shallowEqual, fmtRp, ref, TABLE_KEYS } from './util'
