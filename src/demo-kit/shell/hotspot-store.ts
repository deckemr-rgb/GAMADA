/**
 * shell/hotspot-store.ts — the tiny, always-loaded part of the Hotspot: the per-tab-session "dismissed" flag and
 * `dismissHotspot(id)`, so a product can retire the ring when the user starts somewhere else (e.g. Cek Berkas: a
 * gallery pick) without importing the lazy Hotspot chunk. The id is the hotspot's `id` (DemoShell default:
 * `${slug}:${target}`).
 */
import { SHELL } from './constants'

const dismissedKey = (id: string) => `${SHELL.storage}hotspot:${id}`

export function isHotspotDismissed(id: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissedKey(id)) === '1'
  } catch {
    return false
  }
}

const listeners = new Map<string, Set<() => void>>()

/** mounted Hotspots listen for their own id (returns the unsubscribe) */
export function onHotspotDismiss(id: string, fn: () => void): () => void {
  let set = listeners.get(id)
  if (!set) listeners.set(id, (set = new Set()))
  set.add(fn)
  return () => {
    set.delete(fn)
    if (!set.size) listeners.delete(id)
  }
}

/** Retire the "start here" ring `id` for this tab session (also hides it right away when it is on screen). */
export function dismissHotspot(id: string): void {
  try {
    window.sessionStorage.setItem(dismissedKey(id), '1')
  } catch {
    /* ignore: the ring still hides for this page view */
  }
  listeners.get(id)?.forEach((fn) => fn())
}
