/**
 * tour/Stage.tsx — the live stage: the chapter's REAL product inside <DemoShell mode="tour" layout="contained">.
 * URL handoff (plan §1.2): before the shell mounts, ?role ?tab ?focus are written into /tur/<n> (the shell reads them
 * as its `link`, like a cross-product toast); once the product is ready they are removed again. Links inside the
 * stage that lead to a sandbox (toasts, "Buka di …") become "Ambil alih" (they keep world=tour and get from=tur-<n>).
 * A visitor's pointerdown / keydown in the stage pauses the tour.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PRODUCT_BY_SLUG, type ProductSlug, type RoleId } from '../../content/products'
import { demoComponent } from '../../demos/registry'
import { DemoShell } from '../shell'
import { getSession, useWorldStatus } from '../world'
import { Icon } from '../ui/icons'
import { engine, markStageReady, syncUrl } from './engine'
import { realDelay, setStageRoot } from './exec'
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
    navigate(href ?? takeoverHref(spec!.slug, st.n, lang, spec!.role ?? getSession().role, spec!.focus))
  }
}

export function AmbilAlih({ lang, disabledReason }: { lang: Lang; disabledReason?: string | null }) {
  const t = TOUR_STRINGS[lang]
  const go = useTakeover(lang)
  const st = useTour()
  const reason = disabledReason ?? (st.stage ? null : t.posterOnly)
  return (
    <span className="dk-tour-takeover-wrap">
      <button type="button" className="dk-tour-btn dk-tour-btn--accent dk-tour-takeover" data-tour="takeover" disabled={!!reason} aria-describedby={reason ? 'dk-tour-takeover-why' : undefined} title={reason ?? t.takeoverHint} onClick={() => go()}>
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
    setActive(spec)
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
      syncUrl(tourStore.get().n)
      markStageReady(active.key)
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
      {shell ?? <Poster lang={lang} />}
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
