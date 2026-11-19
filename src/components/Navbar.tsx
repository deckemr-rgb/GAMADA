/**
 * Navbar — sticky site bar: logo, "Layanan & Produk", Karya dropdown, Proses, FAQ, ID/EN toggle and
 * the "Konsultasi Gratis" CTA (WhatsApp).
 *
 * - After SITE_MOTION.nav.solidAfterPx of scroll the bar gets an opaque background and a
 *   shadow (no backdrop-filter: it would re-blur moving content every frame).
 * - Dropdown (disclosure pattern): opens on mouse hover or click; closes on Escape (focus back to the
 *   button), a pointer down outside, focus leaving it, or a route change. aria-expanded / aria-controls.
 * - ≤ 960 px: hamburger → full-screen curtain menu (transform slide, links stagger in). Everything
 *   outside the header is `inert`, Tab cycles inside, Escape / link click / resize / click on the
 *   empty backdrop close it; scroll is locked (Lenis stopped). Reduced motion: plain fade.
 *
 * navIntro() is still called by timelines/intro.ts on the home page.
 */
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { gsap } from 'gsap'
import { DUR, EASE, SITE_MOTION, UI, prefersReducedMotion } from '../lib/motion'
import { getLenis } from '../lib/smoothScroll'
import { useI18n, type Lang } from '../lib/i18n'
import { waLink } from '../content/site'
import { workMenuTitle } from '../content/work'
import { ECO_NAV, LAB_NAV, TOUR_NAV } from '../content/ecoNav'
import AppLink from './AppLink'
import '../styles/site.css'

const NAV = SITE_MOTION.nav
const FOCUSABLE = 'a[href], button:not([disabled])'
const COLLAPSE_MQ = `(max-width: ${NAV.collapseBelowPx}px)`

/** Make every element outside `keep` inert (siblings at each ancestor level). Returns a restore fn. */
function inertOutside(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = []
  let node: HTMLElement = keep
  while (node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue
      if (sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE' || sib.tagName === 'LINK') continue
      sib.inert = true
      changed.push(sib)
    }
    node = parent
  }
  return () => changed.forEach((el) => (el.inert = false))
}

export function Logo() {
  return (
    <>
      <svg className="gnav-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="21" cy="11" r="4.2" fill="var(--c-peach-soft)" />
        <path d="M2 27 L12 12 L17 19 L21 14 L30 27 Z" fill="currentColor" />
      </svg>
      <span>GAMADA</span>
    </>
  )
}

/** ID/EN toggle. A click is an explicit choice (persisted). If the EN chunk cannot load, the page stays in the current
 * language and a short status note says so (no silent dead click); the next click clears it. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  const [failed, setFailed] = useState(false)
  const req = useRef(0)
  const opts: Array<{ code: Lang; name: string }> = [
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'en', name: 'English' },
  ]
  const choose = (l: Lang) => {
    const mine = ++req.current
    setFailed(false)
    // a newer click winning is not a failure: only the latest click of this toggle reports
    void setLang(l, { persist: true }).then((ok) => setFailed(!ok && mine === req.current))
  }
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t.a11y.language}>
      {opts.map((o) => (
        <button
          key={o.code}
          type="button"
          className="lang-toggle-btn"
          aria-pressed={lang === o.code}
          aria-label={`${o.code.toUpperCase()}, ${o.name}`}
          lang={o.code}
          onClick={() => choose(o.code)}
        >
          {o.code.toUpperCase()}
        </button>
      ))}
      <span className="lang-toggle-status" role="status">
        {failed ? t.a11y.langFailed : ''}
      </span>
    </div>
  )
}

function Chevron() {
  return (
    <svg className="gnav-chevron" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * NavDrop — one desktop dropdown (disclosure pattern). Without `to` the trigger is a button (Karya); with `to` it is
 * a link plus a chevron button (Ekosistem: the link goes to the hub; the chevron, a click or ArrowDown opens).
 * Opens on mouse hover or click; Enter / Space on the button or ArrowDown open from the keyboard; Escape closes and
 * returns focus to the trigger; a pointer down outside, focus leaving it, or a route change close it.
 */
function NavDrop({
  label,
  to,
  menuLabel,
  current,
  drop,
  render,
}: {
  label: string
  to?: string
  menuLabel?: string
  current?: 'page' | 'true'
  drop: string
  render: (close: () => void) => ReactNode
}) {
  const location = useLocation()
  const ref = useRef<HTMLLIElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  const [open, setOpen] = useState(false)
  const id = useId()

  const close = useCallback((focusTrigger = false) => {
    window.clearTimeout(timer.current)
    setOpen(false)
    if (focusTrigger) (linkRef.current ?? btnRef.current)?.focus()
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(ref.current?.contains(document.activeElement) ?? false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])

  /** keyboard open: the panel is visibility:hidden until the state lands, so focus its first link next frame */
  const openAndFocus = () => {
    setOpen(true)
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus())
  }
  const onKeyDown = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      openAndFocus()
    }
  }
  const onEnter = (e: RPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(timer.current)
    setOpen(true)
  }
  const onLeave = (e: RPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), NAV.dropdownCloseDelayMs)
  }
  const onBlur = (e: FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget as Node | null)) close()
  }

  return (
    <li
      ref={ref}
      className={to ? 'gnav-drop gnav-drop--split' : 'gnav-drop'}
      data-nav-item
      data-drop={drop}
      data-open={open}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onBlur={onBlur}
    >
      {to ? (
        <>
          <AppLink ref={linkRef} className="gnav-link" to={to} aria-current={current} data-current={current ? true : undefined} onKeyDown={onKeyDown}>
            {label}
          </AppLink>
          <button
            ref={btnRef}
            type="button"
            className="gnav-link gnav-drop-chev"
            aria-expanded={open}
            aria-controls={id}
            aria-label={menuLabel ?? label}
            onClick={(e) => (open ? close() : e.detail === 0 ? openAndFocus() : setOpen(true))}
            onKeyDown={onKeyDown}
          >
            <Chevron />
          </button>
        </>
      ) : (
        <button
          ref={btnRef}
          type="button"
          className="gnav-link gnav-drop-btn"
          aria-expanded={open}
          aria-controls={id}
          data-current={current ? true : undefined}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onKeyDown}
        >
          {label}
          <Chevron />
        </button>
      )}
      <div ref={panelRef} id={id} className="gnav-panel" data-open={open}>
        {render(() => close())}
      </div>
    </li>
  )
}

export default function Navbar() {
  const { t, lang } = useI18n()
  const location = useLocation()
  const isEco = location.pathname.startsWith('/ekosistem') || location.pathname.startsWith('/produk/')
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const restoreInertRef = useRef<(() => void) | null>(null)
  const [open, setOpen] = useState(false)
  const [reduced] = useState(() => prefersReducedMotion())
  const menuId = useId()

  /* ---------------------------------------------------------------- solid bar after a few px */
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    let solid: boolean | null = null
    const check = () => {
      const next = window.scrollY > NAV.solidAfterPx
      if (next !== solid) {
        solid = next
        header.dataset.solid = String(next)
      }
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  /* ---------------------------------------------------------------- mobile menu */
  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) toggleRef.current?.focus({ preventScroll: true })
  }, [])

  // route change closes the menu (each dropdown closes itself)
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const header = headerRef.current
    const html = document.documentElement
    getLenis()?.stop()
    html.classList.add('nav-locked')
    restoreInertRef.current = header ? inertOutside(header) : null
    const first = menu?.querySelector<HTMLElement>(FOCUSABLE)
    const timer = window.setTimeout(() => first?.focus({ preventScroll: true }), UI.menu.focusDelayMs)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab' || !menu) return
      const items = [toggleRef.current, ...Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE))].filter(
        (x): x is HTMLElement => !!x,
      )
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (!firstEl || !lastEl) return
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    const mq = window.matchMedia(COLLAPSE_MQ)
    const onMq = () => {
      if (!mq.matches) close(false)
    }
    const onResize = () => close(false)
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    // any width change (rotation, window resize) closes the menu; height-only changes (mobile toolbars) don't
    let lastW = window.innerWidth
    const onWin = () => {
      if (Math.abs(window.innerWidth - lastW) > 1) onResize()
      lastW = window.innerWidth
    }
    window.addEventListener('resize', onWin)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', onWin)
      restoreInertRef.current?.()
      restoreInertRef.current = null
      html.classList.remove('nav-locked')
      getLenis()?.start()
    }
  }, [open, close])

  /** Menu link: unlock first so the page can scroll / the curtain can run, then let AppLink navigate. */
  const onMenuLink = () => {
    restoreInertRef.current?.()
    restoreInertRef.current = null
    document.documentElement.classList.remove('nav-locked')
    getLenis()?.start()
    setOpen(false)
  }

  const cta = waLink(t.wa.prefill)
  const menuLinks = [
    { label: t.nav.services, to: '/#layanan' },
    { label: t.nav.eco, to: '/ekosistem' },
    { label: t.nav.work, to: '/karya' },
    { label: t.nav.process, to: '/proses' },
    { label: t.nav.faq, to: '/faq' },
  ]

  return (
    <header
      ref={headerRef}
      className="gnav"
      data-nav
      data-solid="false"
      data-open={open}
      style={{ '--ui-hover': `${DUR.hover}s`, '--nav-drop': `${NAV.dropdown}s`, '--nav-curtain': `${NAV.menuCurtain}s`, '--nav-stagger': `${NAV.menuStagger}s` } as CSSProperties}
    >
      <span className="gnav-scrim" aria-hidden="true" />
      <span className="gnav-solid" aria-hidden="true" />

      <AppLink to="/" className="gnav-logo" data-nav-item aria-label={t.a11y.home}>
        <Logo />
      </AppLink>

      <nav aria-label={t.a11y.mainNav} className="gnav-nav">
        <ul className="gnav-links">
          <li data-nav-item>
            <AppLink className="gnav-link" to="/#layanan">
              {t.nav.services}
            </AppLink>
          </li>
          <NavDrop
            label={t.nav.eco}
            to="/ekosistem"
            menuLabel={t.nav.ecoMenu}
            current={isEco ? (location.pathname === '/ekosistem' ? 'page' : 'true') : undefined}
            drop="eco"
            render={(close) => (
              <>
                <ul className="gnav-panel-list">
                  {ECO_NAV.map((e) => (
                    <li key={e.id}>
                      <AppLink className="gnav-panel-link" to={e.to} onClick={close}>
                        <span className="gnav-panel-title">
                          <i className="gnav-eco-dot" style={{ background: `var(${e.accent})` }} aria-hidden="true" />
                          {e.name}
                        </span>
                        <span className="gnav-panel-desc">{e.audience[lang]}</span>
                      </AppLink>
                    </li>
                  ))}
                  <li className="gnav-panel-sep" role="separator" />
                  <li>
                    <AppLink className="gnav-panel-link" to={TOUR_NAV.to} onClick={close}>
                      <span className="gnav-panel-title">{TOUR_NAV.title[lang]}</span>
                    </AppLink>
                  </li>
                </ul>
                <AppLink className="gnav-panel-all" to={LAB_NAV.to} onClick={close}>
                  {LAB_NAV.title[lang]} <span aria-hidden="true">→</span>
                </AppLink>
              </>
            )}
          />
          <NavDrop
            label={t.nav.work}
            current={location.pathname.startsWith('/karya') ? 'true' : undefined}
            drop="work"
            render={(close) => (
              <>
                <ul className="gnav-panel-list">
                  {t.nav.workMenu.map((m) => (
                    <li key={m.hash}>
                      <AppLink className="gnav-panel-link" to={`/karya#${m.hash}`} onClick={close}>
                        <span className="gnav-panel-title">{workMenuTitle(m)}</span>
                        <span className="gnav-panel-desc">{m.desc}</span>
                      </AppLink>
                    </li>
                  ))}
                </ul>
                <AppLink className="gnav-panel-all" to="/karya" onClick={close}>
                  {t.nav.workAll} <span aria-hidden="true">→</span>
                </AppLink>
              </>
            )}
          />
          <li data-nav-item>
            <AppLink className="gnav-link" to="/proses" aria-current={location.pathname === '/proses' ? 'page' : undefined}>
              {t.nav.process}
            </AppLink>
          </li>
          <li data-nav-item>
            <AppLink className="gnav-link" to="/faq" aria-current={location.pathname === '/faq' ? 'page' : undefined}>
              {t.nav.faq}
            </AppLink>
          </li>
        </ul>
      </nav>

      <div className="gnav-actions">
        <LangToggle className="gnav-lang" />
        <a className="gnav-cta" href={cta} target="_blank" rel="noopener noreferrer" data-nav-item>
          {t.nav.cta}
        </a>
        <button
          ref={toggleRef}
          type="button"
          className="gnav-toggle"
          data-nav-item
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? t.a11y.closeMenu : t.a11y.openMenu}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="gnav-toggle-bar" aria-hidden="true" />
          <span className="gnav-toggle-bar" aria-hidden="true" />
        </button>
      </div>

      {/* Not aria-modal: its toggle lives outside the panel; the rest of the page is inert instead. */}
      <div
        ref={menuRef}
        id={menuId}
        className="gnav-menu"
        data-open={open}
        data-reduced={reduced}
        role="dialog"
        aria-label={t.a11y.menu}
        aria-hidden={!open}
        inert={!open}
        onPointerDown={(e) => {
          // a press on the empty backdrop (not on a link / button) closes the menu
          if (e.target === e.currentTarget) close(false)
        }}
      >
        <nav aria-label={t.a11y.mainNav}>
        <ul className="gnav-menu-list">
          {menuLinks.map((l, i) => (
            <li key={l.to} className="gnav-menu-item" style={{ '--i': i } as CSSProperties}>
              <AppLink
                className="gnav-menu-link"
                to={l.to}
                onClick={onMenuLink}
                aria-current={location.pathname === l.to ? 'page' : undefined}
              >
                <span className="gnav-menu-num" aria-hidden="true">
                  0{i + 1}
                </span>
                {l.label}
              </AppLink>
              {l.to === '/ekosistem' ? (
                <ul className="gnav-menu-sub">
                  {ECO_NAV.map((e) => (
                    <li key={e.id}>
                      <AppLink to={e.to} onClick={onMenuLink}>
                        <i className="gnav-eco-dot" style={{ background: `var(${e.accent})` }} aria-hidden="true" />
                        {e.name}
                      </AppLink>
                    </li>
                  ))}
                  <li>
                    <AppLink to={TOUR_NAV.to} onClick={onMenuLink}>
                      {TOUR_NAV.title[lang]}
                    </AppLink>
                  </li>
                </ul>
              ) : null}
              {l.to === '/karya' ? (
                <ul className="gnav-menu-sub">
                  {t.nav.workMenu.map((m) => (
                    <li key={m.hash}>
                      <AppLink to={`/karya#${m.hash}`} onClick={onMenuLink}>
                        {workMenuTitle(m)}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        </nav>
        <div className="gnav-menu-foot gnav-menu-item" style={{ '--i': menuLinks.length } as CSSProperties}>
          <LangToggle />
          <a className="gnav-cta gnav-cta--menu" href={cta} target="_blank" rel="noopener noreferrer" onClick={onMenuLink}>
            {t.nav.cta}
          </a>
          <p className="gnav-menu-note">{t.nav.menuNote}</p>
        </div>
      </div>
    </header>
  )
}

/** Staggers the nav items in. Returned timeline is NOT paused (the intro nests it). */
export function navIntro(): gsap.core.Timeline {
  const tl = gsap.timeline()
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-nav] [data-nav-item]'))
  if (!items.length) return tl
  if (prefersReducedMotion()) {
    tl.fromTo(items, { opacity: 0 }, { opacity: 1, duration: DUR.reducedCrossfade, ease: 'none', clearProps: 'opacity' })
    return tl
  }
  tl.fromTo(
    items,
    { y: -20, opacity: 0 },
    { y: 0, opacity: 1, duration: DUR.navIntro, ease: EASE.out, stagger: DUR.navStagger, clearProps: 'transform,opacity' },
  )
  return tl
}
