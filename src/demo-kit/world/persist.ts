/**
 * world/persist.ts — per-browser persistence in IndexedDB (idb-keyval), namespace `gamada:world:<regionId>:<seed>`.
 * Debounced (WORLD.persistDebounceMs, with a max wait so a busy clock still saves). Every call is wrapped:
 * private windows, blocked storage or Node (self-tests) simply run without persistence.
 */
import type { WorldState } from './types'
import { WORLD } from './util'

export interface Persisted {
  format: 'gamada-world'
  version: number
  clock: number
  state: WorldState
}

/** a busy world (×60 with natural events) still saves at least this often (ms) */
const PERSIST_MAX_WAIT_MS = 5000

export const persistKey = (regionId: string, seed: number): string => `gamada:world:${regionId}:${seed}`

type Idb = typeof import('idb-keyval')
let idbP: Promise<Idb | null> | null = null
function idb(): Promise<Idb | null> {
  if (!idbP) {
    idbP = (typeof indexedDB === 'undefined' ? Promise.resolve(null) : import('idb-keyval').then((m) => m as Idb)).catch(() => null)
  }
  return idbP
}

export async function loadPersisted(regionId: string, seed: number): Promise<Persisted | null> {
  try {
    const db = await idb()
    if (!db) return null
    const v = (await db.get(persistKey(regionId, seed))) as Persisted | undefined
    if (!v || v.format !== 'gamada-world' || v.version !== WORLD.version || v.state?.regionId !== regionId || v.state?.seed !== seed) return null
    return v
  } catch {
    return null
  }
}

export async function savePersisted(p: Persisted): Promise<boolean> {
  try {
    const db = await idb()
    if (!db) return false
    await db.set(persistKey(p.state.regionId, p.state.seed), p)
    return true
  } catch {
    return false
  }
}

export async function clearPersisted(regionId: string, seed: number): Promise<void> {
  try {
    const db = await idb()
    if (db) await db.del(persistKey(regionId, seed))
  } catch {
    /* ignore */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let firstAt = 0
let pending: (() => Persisted | null) | null = null

/** debounce a save; `snapshot` is read when the timer fires (latest state wins) */
export function schedulePersist(snapshot: () => Persisted | null): void {
  pending = snapshot
  const now = Date.now()
  if (timer) {
    if (now - firstAt >= PERSIST_MAX_WAIT_MS) return // let the pending timer fire
    clearTimeout(timer)
  } else firstAt = now
  timer = setTimeout(flushPersist, WORLD.persistDebounceMs)
}

/** save immediately (pagehide, reset) */
export function flushPersist(): void {
  if (timer) clearTimeout(timer)
  timer = null
  const snap = pending?.()
  pending = null
  if (snap) void savePersisted(snap)
}

export function cancelPersist(): void {
  if (timer) clearTimeout(timer)
  timer = null
  pending = null
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('pagehide', flushPersist)
  } catch {
    /* ignore */
  }
}
