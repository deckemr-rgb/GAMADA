/**
 * shell/missions.ts — "Coba ini" missions (spec §6.3). Each product passes 3–6 missions; a mission ticks
 * itself when `done(event, state)` returns true for a processed world event, or when the product calls
 * markMission(product, id) for UI-only steps (opening a drawer, switching a tab). Progress is saved per
 * product in localStorage (try/catch: private windows still work, progress just is not remembered).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Bi, ProductSlug } from '../../content/products'
import { onEvent, world, type WorldEvent, type WorldState } from '../world'
import { SHELL } from './constants'

export interface Mission {
  id: string
  label: Bi
  /** optional one-line hint under the label */
  hint?: Bi
  /** auto-tick rule; omit for UI-only steps that the product marks with markMission() */
  done?: (e: WorldEvent, s: WorldState) => boolean
}

const key = (product: ProductSlug) => `${SHELL.storage}missions:${product}`
const cache = new Map<ProductSlug, readonly string[]>()
const subs = new Set<() => void>()
const EMPTY: readonly string[] = Object.freeze([])

function read(product: ProductSlug): readonly string[] {
  const hit = cache.get(product)
  if (hit) return hit
  let v: readonly string[] = EMPTY
  try {
    const raw = window.localStorage.getItem(key(product))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) v = Object.freeze(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    /* storage blocked or corrupt: start empty */
  }
  cache.set(product, v)
  return v
}

function write(product: ProductSlug, ids: readonly string[]) {
  cache.set(product, Object.freeze([...ids]))
  try {
    if (ids.length) window.localStorage.setItem(key(product), JSON.stringify(ids))
    else window.localStorage.removeItem(key(product))
  } catch {
    /* ignore */
  }
  for (const fn of [...subs]) fn()
}

/** Ids of the completed missions of a product. */
export function missionProgress(product: ProductSlug): readonly string[] {
  return read(product)
}

/** Tick one mission (UI-only steps). No-op when already done. */
export function markMission(product: ProductSlug, id: string): void {
  const cur = read(product)
  if (cur.includes(id)) return
  write(product, [...cur, id])
}

/** Forget a product's progress (Reset, "Ulangi misi"). */
export function resetMissions(product: ProductSlug): void {
  if (read(product).length) write(product, [])
}

function subscribe(fn: () => void) {
  subs.add(fn)
  return () => void subs.delete(fn)
}

/** React: completed mission ids of a product. */
export function useMissionProgress(product: ProductSlug): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => read(product),
    () => EMPTY,
  )
}

/** Listen to world events and tick missions whose rule matches. Mount once (the GuidePanel does). */
export function useMissionTracker(product: ProductSlug, missions: readonly Mission[] | undefined): void {
  const ref = useRef(missions)
  ref.current = missions
  useEffect(
    () =>
      onEvent('*', (e) => {
        const list = ref.current
        if (!list?.length) return
        const done = read(product)
        const s = world.get()
        for (const m of list) {
          if (!m.done || done.includes(m.id)) continue
          let ok = false
          try {
            ok = m.done(e, s)
          } catch {
            ok = false
          }
          if (ok) markMission(product, m.id)
        }
      }),
    [product],
  )
}
