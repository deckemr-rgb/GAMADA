/**
 * world/up/scenario.ts — the Usaha Pintar flood scenario: re-exports world/flood-scenario.ts (UP-free since tahap 4),
 * so Pantau Merek, TenderPilot … keep their import path.
 */
export { UP_SCENARIO } from './config'
export { ensureFloodScenario, activeFloodAlert, useFloodAutoplay, floodAutoplayFired } from '../flood-scenario'
