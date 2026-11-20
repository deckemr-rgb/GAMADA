/**
 * base.ts — the deploy base path. The default build is served at the site root ('/'); the GitHub Pages build
 * (GAMADA_BASE=/GAMADA/, see vite.config.ts) is served under a sub-path. App routes stay root-relative
 * ('/demo/x'): react-router adds the basename itself, so only code that talks to the browser directly (raw <a href>,
 * window.location, history.replaceState, window.open, public files) goes through these helpers.
 */

/** Router basename: '' at the root, '/GAMADA' under a sub-path (no trailing slash). */
export const BASENAME: string = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/+$/, '')

/** An app path or public file ('/demo/x', '/scenes/a.avif') as a browser URL under the base. Other strings pass through. */
export function withBase(path: string): string {
  return BASENAME && path.startsWith('/') && !path.startsWith('//') ? BASENAME + path : path
}

/** A browser pathname ('/GAMADA/demo/x') as the app path ('/demo/x'). Paths outside the base pass through. */
export function appPath(pathname: string): string {
  if (!BASENAME) return pathname
  if (pathname === BASENAME) return '/'
  return pathname.startsWith(`${BASENAME}/`) ? pathname.slice(BASENAME.length) : pathname
}
