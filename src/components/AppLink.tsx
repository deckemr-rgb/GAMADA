/**
 * AppLink — the site's internal link. Renders a real <a href> (react-router <Link>), so
 * middle-click / ctrl-click / "open in new tab" keep working. A plain click:
 *  - same page + #hash  → smooth scroll (Lenis), then the URL hash is updated;
 *  - same page, no hash → smooth scroll to the top;
 *  - another page       → mist curtain covers, the route changes, RootLayout reveals it.
 */
import { forwardRef, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, type LinkProps, type NavigateFunction } from 'react-router'
import { coverPage } from '../lib/pageTransition'
import { preloadRoute } from '../routeLoaders'
import { elementForHash, scrollToElement } from '../lib/navigation'
import { prefersReducedMotion } from '../lib/motion'
import { scrollToY } from '../lib/smoothScroll'
import { gsap } from 'gsap'
import { DUR, EASE } from '../lib/motion'

export type AppLinkProps = Omit<LinkProps, 'to'> & { to: string }

/** Programmatic navigation with the same behaviour as clicking an AppLink. */
export async function goTo(to: string, navigate: NavigateFunction, currentPath: string): Promise<void> {
  const url = new URL(to, window.location.origin)
  const samePage = url.pathname === currentPath
  if (samePage) {
    const smooth = !prefersReducedMotion()
    if (url.hash) {
      const el = elementForHash(url.hash)
      if (el) {
        scrollToElement(el, smooth, () => {
          void navigate(url.pathname + url.search + url.hash, { replace: true, preventScrollReset: true })
          if (!el.hasAttribute('tabindex')) el.tabIndex = -1
          el.focus({ preventScroll: true })
        })
        return
      }
    }
    scrollToY(0, smooth ? DUR.scrollToScene * 0.6 : 0, gsap.parseEase(EASE.scrollTo) ?? ((t: number) => t))
    if (url.hash) document.getElementById('main')?.focus({ preventScroll: true })
    if (url.search !== window.location.search) void navigate(url.pathname + url.search, { replace: true, preventScrollReset: true })
    return
  }
  // the page chunk downloads while the mist rises
  await Promise.all([coverPage(), preloadRoute(url.pathname)])
  await navigate(url.pathname + url.search + url.hash)
}

const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { to, onClick, onPointerEnter, onFocus, target, ...rest },
  ref,
) {
  const navigate = useNavigate()
  const location = useLocation()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (target && target !== '_self') return
    e.preventDefault()
    void goTo(to, navigate, location.pathname)
  }
  const warm = () => void preloadRoute(new URL(to, window.location.origin).pathname)
  return (
    <Link
      ref={ref}
      to={to}
      target={target}
      onClick={handle}
      onPointerEnter={(e) => {
        onPointerEnter?.(e)
        warm()
      }}
      onFocus={(e) => {
        onFocus?.(e)
        warm()
      }}
      {...rest}
    />
  )
})

export default AppLink
