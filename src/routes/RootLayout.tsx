/**
 * RootLayout — global shell for every route: skip link, Lenis (one instance for the whole site),
 * custom cursor, navbar, reading-progress bar (not on the home, which has the scene rail),
 * <main>, footer, floating WhatsApp, the mist page curtain and react-router's ScrollRestoration.
 *
 * After each in-app navigation: Lenis is re-synced to the restored scroll position, a #hash that
 * was not in the DOM yet is retried for a few frames, focus moves to <main> (screen readers start
 * at the new content), ScrollTrigger refreshes and the curtain lifts.
 */
import { useLayoutEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { initSmoothScroll, getLenis } from '../lib/smoothScroll'
import { revealPage } from '../lib/pageTransition'
import { markNavigated } from '../lib/routeState'
import { elementForHash, scrollToElement } from '../lib/navigation'
import { useI18n } from '../lib/i18n'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Cursor from '../components/Cursor'
import WhatsAppFloat from '../components/WhatsAppFloat'
import PageCurtain from '../components/PageCurtain'
import ReadingProgress from '../components/ReadingProgress'
import FpsHud, { isFpsDebug } from '../components/FpsHud'

/** Frames to wait for a #hash target that lives in a lazy chunk (e.g. /#layanan) before giving up. */
const HASH_RETRY_FRAMES = 120

export default function RootLayout() {
  const { t } = useI18n()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const mainRef = useRef<HTMLElement>(null)
  const prevKey = useRef<string | null>(null)

  // one Lenis for the whole site (driven by gsap.ticker)
  useLayoutEffect(() => initSmoothScroll(), [])

  useLayoutEffect(() => {
    if (prevKey.current === null || prevKey.current === location.key) {
      // first render (or StrictMode's re-run of it): nothing to transition
      prevKey.current = location.key
      return
    }
    prevKey.current = location.key
    markNavigated()
    // ScrollRestoration (a child, so its layout effect already ran) moved the window natively:
    // re-measure Lenis (its scroll limit still belongs to the previous page) and align its target
    // with the real position so the next wheel tick does not jump back.
    const lenis = getLenis()
    lenis?.resize()
    lenis?.scrollTo(window.scrollY, { immediate: true, force: true })

    let raf = 0
    let tries = 0
    const finish = () => {
      ScrollTrigger.refresh()
      raf = requestAnimationFrame(() => revealPage())
    }
    const settleHash = () => {
      const el = elementForHash(location.hash)
      if (el) {
        getLenis()?.resize()
        scrollToElement(el, false)
        getLenis()?.scrollTo(window.scrollY, { immediate: true, force: true })
        if (!el.hasAttribute('tabindex')) el.tabIndex = -1
        el.focus({ preventScroll: true })
        finish()
      } else if (++tries < HASH_RETRY_FRAMES) {
        raf = requestAnimationFrame(settleHash)
      } else {
        mainRef.current?.focus({ preventScroll: true })
        finish()
      }
    }
    if (location.hash) settleHash()
    else {
      mainRef.current?.focus({ preventScroll: true })
      finish()
    }
    return () => cancelAnimationFrame(raf)
  }, [location.key, location.hash])

  return (
    <>
      <a className="skip-link" href="#main">
        {t.a11y.skip}
      </a>
      {isFpsDebug() ? <FpsHud /> : null}
      <Cursor />
      <Navbar />
      {isHome ? null : <ReadingProgress />}
      <main id="main" ref={mainRef} tabIndex={-1} data-page={isHome ? 'home' : 'page'}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
      <PageCurtain />
      <ScrollRestoration />
    </>
  )
}
