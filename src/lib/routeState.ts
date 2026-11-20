/**
 * routeState.ts — knows whether the visit is still on its first page (the preloader only runs on a
 * cold home load). Pure read, so StrictMode's double-invoked initialisers get the same answer.
 */
import { appPath } from './base'

const firstPath = typeof window !== 'undefined' ? appPath(window.location.pathname) : '/'
let navigated = false

/** Called by RootLayout on every in-app navigation after the first render. */
export function markNavigated(): void {
  navigated = true
}

/** True while the visit has not left the page it started on, and that page is `path`. */
export function isFirstRoute(path: string): boolean {
  return !navigated && firstPath === path
}
