/**
 * world/session.ts — the demo session (region, seed, role, AI mode, presenter mode, language).
 * URL sync is the shell's job; this is only the store.
 */
import { useSyncExternalStore } from 'react'
import type { RoleId } from '../../content/products'

export const DEFAULT_SEED = 2026

export interface DemoSession {
  regionId: string
  seed: number
  role: RoleId
  aiMode: 'sim' | 'live'
  present: boolean
  lang: 'id' | 'en'
}

let session: DemoSession = { regionId: 'bojonegoro', seed: DEFAULT_SEED, role: 'warga', aiMode: 'sim', present: false, lang: 'id' }
const subs = new Set<() => void>()

export function getSession(): DemoSession {
  return session
}

export function setSession(patch: Partial<DemoSession>): void {
  let changed = false
  for (const k of Object.keys(patch) as (keyof DemoSession)[]) if (patch[k] !== undefined && patch[k] !== session[k]) changed = true
  if (!changed) return
  session = { ...session, ...patch }
  for (const fn of [...subs]) fn()
}

export function subscribeSession(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function useSession(): DemoSession {
  return useSyncExternalStore(subscribeSession, getSession, getSession)
}
