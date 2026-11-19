/**
 * world/session.ts — the demo session (region, seed, role, AI mode, presenter mode, language).
 * URL sync is the shell's job; this is only the store.
 */
import { useDeferredValue, useMemo, useSyncExternalStore } from 'react'
import type { RoleId } from '../../content/products'
import type { WorldScope } from './persist'

export const DEFAULT_SEED = 2026

export interface DemoSession {
  regionId: string
  seed: number
  role: RoleId
  aiMode: 'sim' | 'live'
  present: boolean
  lang: 'id' | 'en'
  /** which world the shells load: the visitor's own ('default') or the tour's ('tour', `?world=tour`) */
  scope: WorldScope
  /** the tour chapter a taken-over sandbox came from (`?from=tur-<n>` ⇒ 'tur-<n>'), for "Kembali ke tur"; else null */
  from: string | null
}

let session: DemoSession = { regionId: 'bojonegoro', seed: DEFAULT_SEED, role: 'warga', aiMode: 'sim', present: false, lang: 'id', scope: 'default', from: null }
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

/**
 * The session for React. A role switch re-renders every role-specific view (and may fetch its chunk): `role` is
 * deferred, so that render runs in the background and the current screen stays up, with no loading fallback, until
 * the new role's view is ready (the picker itself closes at once). Every other field updates immediately;
 * getSession() always has the new value.
 */
export function useSession(): DemoSession {
  const s = useSyncExternalStore(subscribeSession, getSession, getSession)
  const role = useDeferredValue(s.role)
  return useMemo(() => (role === s.role ? s : { ...s, role }), [s, role])
}
