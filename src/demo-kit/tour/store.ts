/**
 * tour/store.ts — the tour's UI state (useSyncExternalStore): phase, chapter, step, playing, rate, caption, stage,
 * spotlight, seen products + dwell ms, poster flag. Resume data for "Ambil alih" lives in sessionStorage (try/catch).
 */
import { useSyncExternalStore } from 'react'
import type { ProductSlug, RoleId } from '../../content/products'
import type { Fills } from './types'

export type Phase = 'opener' | 'poster' | 'player' | 'summary'
export type Rate = number

export interface StageSpec {
  slug: ProductSlug
  role?: RoleId
  tab?: string
  focus?: string | null
  q?: Record<string, string>
  /** remount key */
  key: number
}

export interface TourState {
  phase: Phase
  /** current chapter 1–20 */
  n: number
  step: number
  playing: boolean
  rate: Rate
  /** preparing the world / loading the product (the chapter timer is not running) */
  busy: boolean
  /** index into the narration caps, or null */
  cap: number | null
  stage: StageSpec | null
  /** spotlighted selector inside the stage */
  spot: string | null
  /** product slug → ms on screen */
  seen: Partial<Record<ProductSlug, number>>
  /** the chapter's product is not READY (or ?tourDegrade=) */
  poster: boolean
  /** visitor touched the stage while playing */
  interrupted: boolean
  fills: Fills
  presenter: boolean
  black: boolean
  drawer: boolean
  /** curtain between chapters */
  curtain: boolean
}

let state: TourState = {
  phase: 'opener', n: 1, step: 0, playing: false, rate: 1, busy: false, cap: null, stage: null, spot: null, seen: {}, poster: false,
  interrupted: false, fills: {}, presenter: false, black: false, drawer: false, curtain: false,
}
const subs = new Set<() => void>()

export const tourStore = {
  get: (): TourState => state,
  set(patch: Partial<TourState> | ((s: TourState) => Partial<TourState>)): void {
    const p = typeof patch === 'function' ? patch(state) : patch
    let changed = false
    for (const k of Object.keys(p) as (keyof TourState)[]) if (p[k] !== state[k]) changed = true
    if (!changed) return
    state = { ...state, ...p }
    for (const fn of [...subs]) fn()
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
}

export function useTour(): TourState {
  return useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get)
}

/* ------------------------------------------------------------------ resume (Ambil alih ⇄ Kembali ke tur) */

const KEY = 'gamada:tour:resume'
export interface Resume {
  chapter: number
  rate: number
  seen: Partial<Record<ProductSlug, number>>
}
export function saveResume(r: Resume): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    /* private mode: resume falls back to the chapter in the URL */
  }
}
export function readResume(): Resume | null {
  try {
    const v = window.sessionStorage.getItem(KEY)
    return v ? (JSON.parse(v) as Resume) : null
  } catch {
    return null
  }
}

/** the tour's own query params (kept on /tur/<n>; everything else a product writes is removed) */
export const TOUR_PARAMS = ['lang', 'region', 'seed', 'e2e', 'rate', 'present', 'off', 'static', 'tourDegrade'] as const
