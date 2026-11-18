/**
 * world/satu-daerah.ts — shared selectors and scenario helpers for the Satu Daerah products (tahap 2: Sapa Warga,
 * Meja Pimpinan, Naskah Pintar, Radar Isu, Siaga Wilayah, Awas Belanja, Cek Berkas).
 *
 * The code lives in world/sd/*.ts, one module per domain (this file only re-exports them), so a product's chunk
 * carries only the selectors it uses.
 *
 * NOT re-exported from the world barrel: products import it directly
 *   import { kpiStrip, briefingItems } from '../../demo-kit/world/satu-daerah'
 * so demos of other ecosystems never download it. Every selector is memoised on the identity of the tables it
 * reads (structural sharing in the reducers), so calling them from `useWorld` on each notify is cheap.
 * Scenario helpers (`floodScenarioAlert`, `rainScenario`, `hoaxBurst`) return event PAYLOADS: the product emits
 * them with its own slug as source, so the shell can announce the cross-product effects.
 *
 * Numbers are SIMULATED (seeded world); label them "simulasi" in the UI where they could pass for official data.
 */
// base.ts also holds internal helpers (names, number formats); only these were public before the split
export { floodScenarioAlert, TOPIC_LABEL, topicLabel, clusterDetail } from './sd/base'
export * from './sd/citizen'
export * from './sd/leaderboard'
export * from './sd/gauge'
export * from './sd/leader'
export * from './sd/letters'
export * from './sd/radar'
export * from './sd/siaga'
export * from './sd/procurement'
export * from './sd/bansos'
