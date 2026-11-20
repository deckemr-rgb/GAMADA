/**
 * tour/Stage.tsx — the live stage: the chapter's REAL product inside <DemoShell mode="tour" layout="contained">.
 * URL handoff (plan §1.2): before the shell mounts, ?role ?tab ?focus are written into /tur/<n> (the shell reads them
 * as its `link`, like a cross-product toast); once the product is ready they are removed again. Links inside the
 * stage that lead to a sandbox (toasts, "Buka di …") become "Ambil alih" (they keep world=tour and get from=tur-<n>).
 * A visitor's pointerdown / keydown in the stage pauses the tour.
 * Tahap 8: the product runs in a zoom box (desktop / tablet: the products' wide layouts fit the 62 % stage); its
 * body-level portals (toasts, drawers, modals) are pinned to the stage's rect through CSS variables on <html>
 * (tour.css), and a product dialog no longer makes the narration column inert.
 */
import { Suspense, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PRODUCT_BY_SLUG, type ProductSlug, type RoleId } from '../../content/products'
import { demoComponent } from '../../demos/registry'
import { DemoShell } from '../shell'
import { WORLD, clock, getSession, savePersisted, useWorldStatus, world } from '../world'
import { Icon } from '../ui/icons'
import { engine, focusNow, markStageReady, syncUrl } from './engine'
import { realDelay, setStageRoot, settleStage } from './exec'
import { saveResume, tourStore, useTour, type StageSpec } from './store'
import { TOUR_STRINGS } from './strings'
import type { Lang } from './types'
import { Spotlight } from './Spotlight'

/** /demo/<slug>?world=tour&from=tur-<n>… for the current stage (the visitor's world is never touched) */
export function takeoverHref(slug: ProductSlug, n: number, lang: Lang, role?: RoleId | null, focus?: string | null): string {
  const s = getSession()
  const p = new URLSearchParams()
  p.set('world', 'tour')
  p.set('from', `tur-${n}`)
  p.set('region', s.regionId)
  if (s.seed !== 2026) p.set('seed', String(s.seed))
  p.set('lang', lang)
  if (role) p.set('role', role)
  if (focus) p.set('focus', focus)
  return `/demo/${slug}?${p.toString()}`
}

export function useTakeover(lang: Lang): (href?: string) => void {
  const navigate = useNavigate()
  return (href?: string) => {
    const st = tourStore.get()
    const spec = st.stage
    if (!spec && !href) return
    saveResume({ chapter: st.n, rate: st.rate, seen: st.seen })
    engine.stop()
    // the sandbox loads the tour world from IndexedDB: save it with the clock as it is now (a chapter's setClock moves
    // only the clock, which schedules no save, so the sandbox opened at the chapter's start time, e.g. 13.00 vs 13.10)
    if (world.scope() === 'tour' && world.status() === 'ready') void savePersisted({ format: 'gamada-world', version: WORLD.version, clock: clock.get().minutes, state: world.get(), scope: 'tour' })
    navigate(href ?? takeoverHref(spec!.slug, st.n, lang, spec!.role ?? getSession().role, focusNow(spec!.focusKey) ?? spec!.focus))
  }
}

export function AmbilAlih({ lang, disabledReason }: { lang: Lang; disabledReason?: string | null }) {
  const t = TOUR_STRINGS[lang]
  const go = useTakeover(lang)
  const st = useTour()
  const reason = disabledReason ?? (st.stage ? null : t.posterOnly)
  return (
    <span className="dk-tour-takeover-wrap">
      <button type="button" className="dk-tour-btn dk-tour-btn--accent dk-tour-takeover" data-tour="takeover" disabled={!!reason} aria-describedby={reason ? 'dk-tour-takeover-why' : undefined} title={reason ?? t.takeoverHint} onClick={(e) => {
          // Tahap 8 (INP): the pressed state paints first; the world save (a structured clone) and the route change
          // to the sandbox run after that frame
          const b = e.currentTarget
          if (b.getAttribute('aria-busy') === 'true') return
          b.setAttribute('aria-busy', 'true')
          requestAnimationFrame(() => window.setTimeout(() => go(), 0))
        }}>
        <Icon name="arrowUpRight" size={16} />
        <span>{t.takeover}</span>
      </button>
      {reason ? (
        <span id="dk-tour-takeover-why" className="dk-tour-why">
          {reason}
        </span>
      ) : null}
    </span>
  )
}

export default function Stage({ lang, phone }: { lang: Lang; phone: boolean }) {
  const st = useTour()
  const spec = st.stage
  const [active, setActive] = useState<StageSpec | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const status = useWorldStatus()
  const go = useTakeover(lang)

  // handoff: write ?role ?tab ?focus (+ q) BEFORE the shell of this spec mounts
  useLayoutEffect(() => {
    if (!spec) {
      setActive(null)
      return
    }
    if (active?.key === spec.key) return
    const extra: Record<string, string> = { ...(spec.q ?? {}) }
    if (spec.role) extra.role = spec.role
    if (spec.tab) extra.tab = spec.tab
    if (spec.focus) extra.focus = spec.focus
    syncUrl(tourStore.get().n, extra)
    // Tahap 8 (long tasks on chapter change): the product swap (old unmount + new mount) renders as a transition,
    // which React slices into short tasks; the curtain keeps the old product dimmed meanwhile
    startTransition(() => setActive(spec))
  }, [spec, active?.key])

  // ready: world ready, the shell rendered, no busy skeleton for two polls ⇒ tell the engine, clean the URL
  useEffect(() => {
    if (!active) return
    let alive = true
    ;(async () => {
      const t0 = performance.now()
      let calm = 0
      while (alive && performance.now() - t0 < 12000) {
        await realDelay(150)
        const el = root.current
        const shell = el?.querySelector('.dk-shell')
        const busy = el?.querySelector('[aria-busy="true"], .dk-skeleton, .dk-loading')
        const canvas = el?.querySelector('.dk-shell-canvas, .dk-canvas, main')
        calm = status === 'ready' && shell && canvas && !busy ? calm + 1 : 0
        if (calm >= 2) break
      }
      if (!alive) return
      settleStage()
      syncUrl(tourStore.get().n)
      markStageReady(active.key)
      // a product's smooth focus scroll may land after the ready poll: settle once more unless a step spotlights by then
      await realDelay(700)
      if (alive && !tourStore.get().spot) settleStage()
    })()
    return () => {
      alive = false
    }
  }, [active, status])

  // a visitor's own pointer / key in the stage pauses the tour; sandbox links become "Ambil alih"
  useEffect(() => {
    const el = root.current
    if (!el) return
    setStageRoot(el)
    const touch = (e: Event) => {
      if (e.isTrusted) engine.interrupt()
    }
    const link = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href') ?? ''
      if (!a || !href.startsWith('/demo/')) return
      e.preventDefault()
      e.stopPropagation()
      const u = new URL(href, window.location.origin)
      u.searchParams.set('world', 'tour')
      u.searchParams.set('from', `tur-${tourStore.get().n}`)
      go(u.pathname + u.search)
    }
    el.addEventListener('pointerdown', touch, true)
    el.addEventListener('keydown', touch, true)
    el.addEventListener('click', link, true)
    return () => {
      setStageRoot(null)
      el.removeEventListener('pointerdown', touch, true)
      el.removeEventListener('keydown', touch, true)
      el.removeEventListener('click', link, true)
    }
  }, [go])

  // body-level portals of the product (toasts, drawers, modals) follow the stage's rect (tour.css), and an open product
  // dialog leaves the tour frame usable: the dialog is part of the stage, the narration and controls are not behind it
  const live = !!active
  useEffect(() => {
    const el = root.current
    if (!live || !el) return
    const html = document.documentElement
    let raf = 0
    const put = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const s = html.style
      s.setProperty('--dk-tour-st-x', `${Math.round(r.left)}px`)
      s.setProperty('--dk-tour-st-y', `${Math.round(r.top)}px`)
      s.setProperty('--dk-tour-st-w', `${Math.round(r.width)}px`)
      s.setProperty('--dk-tour-st-h', `${Math.round(r.height)}px`)
      s.setProperty('--dk-tour-st-r', `${Math.round(html.clientWidth - r.right)}px`)
      s.setProperty('--dk-tour-st-b', `${Math.round(html.clientHeight - r.bottom)}px`)
    }
    const later = () => {
      if (!raf) raf = requestAnimationFrame(put)
    }
    put()
    html.setAttribute('data-dk-tour-stage', '')
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(later) : null
    ro?.observe(el)
    window.addEventListener('resize', later)
    const app = Array.from(document.body.children).find((c) => c.contains(el)) as HTMLElement | undefined
    const mo = app
      ? new MutationObserver(() => {
          if (app.inert) app.inert = false
        })
      : null
    mo?.observe(app!, { attributes: true, attributeFilter: ['inert'] })
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      mo?.disconnect()
      window.removeEventListener('resize', later)
      html.removeAttribute('data-dk-tour-stage')
      for (const k of ['x', 'y', 'w', 'h', 'r', 'b']) html.style.removeProperty(`--dk-tour-st-${k}`)
    }
  }, [live])

  const Canvas = active ? demoComponent(active.slug) : null
  // INP (Tahap 7): the product subtree is memoised on the stage spec, so the tour's own store updates (curtain, step,
  // caption, fills) re-render the frame only, never the whole product
  const shell = useMemo(
    () =>
      active && Canvas ? (
        <DemoShell
          key={active.key}
          product={active.slug}
          mode="tour"
          layout="contained"
          syncUrl={false}
          toastPlacement={phone ? 'top-right' : { wide: 'bottom-right', sm: 'top-right' }}
          tourSlot={phone ? undefined : <AmbilAlih lang={lang} />}
          canvas={
            <Suspense fallback={<p className="dk-tour-loading">{PRODUCT_BY_SLUG[active.slug].name}…</p>}>
              <Canvas product={active.slug} />
            </Suspense>
          }
        />
      ) : null,
    [active, Canvas, phone, lang],
  )
  return (
    <div ref={root} className="dk-tour-stage" aria-label={TOUR_STRINGS[lang].stage} role="region" data-stage={active?.slug ?? ''}>
      {shell ? <div className="dk-tour-zoom">{shell}</div> : <Poster lang={lang} />}
      <Spotlight />
    </div>
  )
}

/** the calm card while the world prepares / for a non-READY product (poster mode) */
function Poster({ lang }: { lang: Lang }) {
  const st = useTour()
  const t = TOUR_STRINGS[lang]
  const slug = st.posterSlug
  return (
    <div className="dk-tour-poster" aria-busy={st.busy || undefined}>
      {st.poster && !st.busy ? (
        <>
          <p className="dk-tour-poster-name">{slug ? PRODUCT_BY_SLUG[slug].name : ''}</p>
          <p className="dk-tour-muted">{t.posterOnly}</p>
        </>
      ) : (
        <p className="dk-tour-muted">{t.loading}</p>
      )}
    </div>
  )
}
