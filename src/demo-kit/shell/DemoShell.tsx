/**
 * shell/DemoShell.tsx — the frame of every sandbox (spec §6.3, §6.5, §8.3, §8.5, §14).
 *
 * Boot: reads ?region ?role ?t ?ai ?lang ?present ?seed ?focus → session; loads the region pack and the world
 * (skipped when the same region + seed is already in memory, so cross-product jumps keep the clock and every
 * change, and skipped entirely for an `interim` placeholder canvas, which reads neither); shows a skeleton meanwhile; then renders TopBar + canvas (or SplitStage) + GuidePanel + EventToast
 * stack + CommandPalette (+ an optional Hotspot). Session / clock changes are written back to the URL with
 * replaceState (throttled while the clock runs) so the state can be shared.
 */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { gsap } from 'gsap'
import { PRODUCT_BY_SLUG, type Bi, type ProductDef, type ProductSlug } from '../../content/products'
import { preloadLang, useI18n } from '../../lib/i18n'
import { goTo } from '../../components/AppLink'
import { EmptyState, Icon, LoadingText, Modal, Button, Skeleton, motionMode, useToastQueue, type ToastData, type ToastPlacement } from '../ui'
import { DEFAULT_REGION_ID, loadRegion, type RegionPack } from '../region/loader'
import { WORLD, clock, emit, ensureEcosystem, getSession, loadWorld, naturalEventsOn, onEvent, preloadWorldFor, preloadEcosystemChains, preloadWorldEngine, preloadWorldGenerator, resetWorld, setNaturalBoost, setNaturalEvents, setSession, settled, subscribeSession, useSession, world } from '../world'
import { switchLang, useDemoStrings } from '../i18n'
import { SHELL } from './constants'
import { ShellContext, type ShellApi, type ToastPlacementSpec } from './context'
import { useAiHealth } from './controls'
import type { PaletteItem } from './CommandPalette'
import { EventToastStack } from './EventToasts'
import { markMission, resetMissions, useMissionProgress, type Mission } from './missions'
import type { SplitStageProps } from './SplitStage'
import { LazyCommandPalette as CommandPalette, LazyGuidePanel as GuidePanel, LazyHotspot as Hotspot, LazySplitStage as SplitStage } from './lazy'
import { MoreSheet, TopBar } from './TopBar'
import { readFlag, useFullscreen, useIdleCursor, useShellSize, writeFlag } from './hooks'
import { demoHref, readDemoQuery, replaceQuery, sessionParams } from './url'
import './shell.css'

export interface DemoShellProps {
  product: ProductSlug
  /** the sandbox (frames, screens). Ignored when `splitTabs` is given. */
  canvas?: ReactNode
  /** alias of `canvas` */
  children?: ReactNode
  /** "Coba ini" missions (3–6); omit to hide the guide */
  missions?: readonly Mission[]
  /** where the toast stack sits (default bottom-left); a canvas can change it with useShell().setToastPlacement */
  toastPlacement?: ToastPlacementSpec
  /** element to ring first ("click here"): a selector, or selector + label */
  hotspot?: string | { target: string; label?: Bi | string; id?: string; placement?: 'auto' | 'below' | 'above' }
  /** split products: two views side by side (tabs below 768 px) */
  splitTabs?: SplitStageProps
  /** 'page' fills the viewport (100dvh, /demo/:slug); 'contained' fills its parent (showcase, /produk) */
  layout?: 'page' | 'contained'
  /** write session + clock into the URL (default true) */
  syncUrl?: boolean
  /**
   * The canvas is the tahap-1 placeholder (routes/Demo.tsx: `!DEMO_READY[slug]`): nothing on it reacts to role,
   * clock, AI mode or reset, so those controls are not shown and the clock is paused (spec §8.5: no dead controls).
   */
  interim?: boolean
  /**
   * 'tour' (Tahap 5, the tour's stage): only the product name, the toasts and `tourSlot` stay. No role / clock / AI /
   * reset / palette / guide / hotspot / "⋯", no keyboard shortcuts, never writes the URL, never applies ?t (the tour owns
   * the clock), AI forced to Simulasi, the session scope is 'tour' (the tour's world). Default 'sandbox'.
   */
  mode?: 'sandbox' | 'tour'
  /** mode 'tour': rendered at the end of the top bar (the tour's "Ambil alih" button) */
  tourSlot?: ReactNode
  className?: string
}

/** phones: a one-line "Coba ini · 1/5 · next mission" bar under the top bar that opens the guide sheet */
function MissionPill({ product, missions, guideId, open, onToggle }: { product: ProductSlug; missions: readonly Mission[]; guideId: string; open: boolean; onToggle: () => void }) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const done = useMissionProgress(product)
  const list = missions.filter((m) => !m.hideSm)
  if (!list.length) return null
  const count = list.filter((m) => done.includes(m.id)).length
  const next = list.find((m) => !done.includes(m.id))
  return (
    <button type="button" className={`dk-mpill${open ? ' is-open' : ''}`} aria-controls={guideId} aria-expanded={open} onClick={onToggle}>
      <Icon name="help" size={16} />
      <span className="dk-mpill-k">
        {t.tryThis} · <span className="dk-num">{count}/{list.length}</span>
      </span>
      <span className="dk-mpill-next">{next ? next.label[lang] : t.allDone}</span>
      <Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} />
    </button>
  )
}

/** Pause, then tween the clock back to `to` (the "rewind" before a reset). Instant when motion is reduced. */
function rewindClock(to: number, seconds: number): { done: Promise<void>; kill: () => void } {
  clock.pause()
  const from = clock.exact()
  if (motionMode() !== 'full' || Math.abs(from - to) < 1) {
    clock.setTime(to)
    return { done: Promise.resolve(), kill: () => {} }
  }
  const o = { m: from }
  let tw: gsap.core.Tween | null = null
  const done = new Promise<void>((resolve) => {
    tw = gsap.to(o, {
      m: to,
      duration: seconds,
      ease: 'power2.inOut',
      onUpdate: () => clock.setTime(Math.round(o.m)),
      onComplete: resolve,
      onInterrupt: resolve,
    })
  })
  return { done, kill: () => tw?.kill() }
}

const bi = (v: Bi | string | undefined, lang: 'id' | 'en') => (v === undefined ? undefined : typeof v === 'string' ? v : v[lang])

/**
 * The shell behind its own Suspense boundary: useDemoStrings() suspends for the moment the lazy EN dictionary is
 * still on its way (demo-kit/i18n), and the frame below stays up meanwhile (same box, same background, no text),
 * so the page never shows Indonesian labels in an English session and nothing above the shell is blanked.
 */
export function DemoShell(props: DemoShellProps) {
  const layout = props.layout ?? 'page'
  // index.html's static first paint for /demo/* (#dk-boot) gives way to the shell's own frame / skeleton
  useLayoutEffect(() => document.getElementById('dk-boot')?.remove(), [])
  return (
    <Suspense fallback={<div className={`dk-root dk-shell is-${layout} is-waiting`} data-eco={PRODUCT_BY_SLUG[props.product].eco} aria-busy="true" />}>
      <DemoShellFrame {...props} />
    </Suspense>
  )
}

function DemoShellFrame({ product: slug, canvas, children, missions: missionsProp, hotspot: hotspotProp, toastPlacement, splitTabs, layout = 'page', syncUrl: syncUrlProp = true, interim = false, mode = 'sandbox', tourSlot, className }: DemoShellProps) {
  const tour = mode === 'tour'
  const missions = tour ? undefined : missionsProp
  const hotspot = tour ? undefined : hotspotProp
  const syncUrl = syncUrlProp && !tour
  const product: ProductDef = PRODUCT_BY_SLUG[slug]
  const t = useDemoStrings()
  const { lang, setLang } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const session = useSession()
  const root = useRef<HTMLDivElement>(null)
  const size = useShellSize(root)
  const health = useAiHealth()
  const canvasRef = useRef<HTMLElement>(null)
  const guideId = `dk-guide-${slug}`

  /* ---------------------------------------------------------------- read the URL once */
  const [query] = useState(() => readDemoQuery(typeof window === 'undefined' ? '' : window.location.search, slug))
  const [focus, setFocus] = useState<string | null>(query.focus ?? null)
  const sameWorld = () => {
    const s = world.get()
    const want = getSession()
    return world.status() === 'ready' && s.regionId === want.regionId && s.seed === want.seed && world.scope() === want.scope
  }

  useLayoutEffect(() => {
    const s = getSession()
    // ?lang wins over the app's current language (a client-side jump to a shared link keeps its language)
    const want = query.lang ?? lang
    if (want !== lang) switchLang(want, setLang, { persist: false })
    setSession({
      regionId: query.region ?? (s.regionId || DEFAULT_REGION_ID),
      seed: query.seed ?? s.seed,
      role: query.role ?? product.defaultRole,
      present: !tour && (query.present ?? false),
      // Live survives cross-product jumps (demoHref carries ?ai=live); ?ai=sim forces Simulasi. Live is dropped only
      // when the proxy is down (effect below).
      aiMode: tour ? 'sim' : (query.ai ?? s.aiMode),
      lang: want,
      // the tour's stage always runs on the tour's world; a sandbox on ?world=tour (Ambil alih) too, else the visitor's own
      scope: tour ? 'tour' : (query.world ?? 'default'),
      from: tour ? null : (query.from ?? null),
    })
    if (interim) clock.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    setSession({ lang })
  }, [lang])

  // Live needs a live proxy: ?ai=live / a carried-over Live is downgraded to Simulasi only when the proxy is down
  useEffect(() => {
    if (health === 'down' && getSession().aiMode === 'live') setSession({ aiMode: 'sim' })
  }, [health])

  /* ---------------------------------------------------------------- load region pack + world */
  // interim (placeholder canvas): nothing on the page reads the pack or the world (region names come from the static
  // REGIONS registry, the clock and session work without a world), so neither is downloaded (budget, spec §14)
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>(() => (interim || (sameWorld() && world.pack()) ? 'ready' : 'loading'))
  const [pack, setPack] = useState<RegionPack | null>(() => (sameWorld() ? world.pack() : null))
  const [attempt, setAttempt] = useState(0)
  const appliedT = useRef(false)

  useEffect(() => {
    let alive = true
    const { regionId, seed, scope } = session
    const applyT = () => {
      if (appliedT.current) return
      appliedT.current = true
      // the tour owns the clock
      if (query.t == null || tour) return
      // a restored or already-running world never goes back in time (Back restores an older ?t=): events after
      // that minute already exist, so moving the clock behind them would show the future
      const cur = clock.get().minutes
      clock.setTime(cur > WORLD.clockStart ? Math.max(query.t, cur) : query.t)
    }
    if (interim) {
      applyT()
      setBoot('ready')
      return
    }
    const reuse = sameWorld()
    if (!reuse) {
      setBoot('loading')
      // a first visit generates the world: start that chunk now instead of after pack.min.json arrives
      preloadWorldGenerator()
    }
    // the landing's world modules (UP data / live, Pasar Daerah: WORLD_MODULES) load in parallel with the region
    preloadWorldFor(slug, query.role ?? getSession().role, product.eco)
    ;(async () => {
      try {
        const p = await loadRegion(regionId)
        if (!reuse) await loadWorld(p, seed, { scope })
        if (!alive) return
        applyT()
        setPack(p)
        setBoot('ready')
      } catch {
        if (alive) setBoot('error')
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.regionId, session.seed, session.scope, attempt, interim])



  // the event pipeline chunk is fetched on the first emit(); start it on the visitor's first interaction instead,
  // so the first event a click raises does not wait for it (live canvases only)
  useEffect(() => {
    if (interim) return
    const go = () => {
      preloadWorldEngine()
      preloadEcosystemChains(product.eco)
      window.removeEventListener('pointerdown', go, true)
      window.removeEventListener('keydown', go, true)
    }
    // the tour plays its steps without a visitor's first interaction: the pipeline + the eco's chains are intent
    if (tour) return go()
    window.addEventListener('pointerdown', go, true)
    window.addEventListener('keydown', go, true)
    // cleanup only detaches: unmounting must not start the download
    return () => {
      window.removeEventListener('pointerdown', go, true)
      window.removeEventListener('keydown', go, true)
    }
  }, [interim])

  // the site dictionary of a non-Indonesian visitor is not part of a demo's first load (lib/i18n.tsx sandboxRoute):
  // fetch it when a link that leaves the sandbox is hovered, focused or pressed, so the next page does not wait
  useEffect(() => {
    const el = root.current
    if (!el || lang === 'id') return
    const evs = ['pointerover', 'focusin', 'touchstart'] as const
    const off = () => {
      for (const t of evs) el.removeEventListener(t, on, true)
    }
    function on(e: Event) {
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href') ?? ''
      if (!a || !href.startsWith('/') || href.startsWith('/demo/')) return
      off()
      void preloadLang(lang)
    }
    for (const t of evs) el.addEventListener(t, on, { capture: true, passive: true })
    return off
  }, [lang])

  /* ---------------------------------------------------------------- test hook */
  // ?e2e=1 exposes the running world to Playwright (cross-product chain tests drive events without product UI)
  useEffect(() => {
    if (interim || typeof window === 'undefined' || new URLSearchParams(window.location.search).get('e2e') !== '1') return
    ;(window as unknown as { __gamada?: unknown }).__gamada = { world, emit, settled, onEvent, clock, ensure: ensureEcosystem }
  }, [interim])

  // shop demos: the natural sales rhythm ×3 during opening hours (Toko Autopilot / Pajak Beres feel busy)
  // price pages: a natural price tick every world minute (Sinyal Pasar ticker, Indeks Ekonomi Harga)
  useEffect(
    () => (interim ? undefined : slug === 'toko-autopilot' || slug === 'pajak-beres' ? setNaturalBoost('sale', 3) : slug === 'sinyal-pasar' || slug === 'indeks-ekonomi' ? setNaturalBoost('price', 5) : undefined),
    [slug, interim],
  )

  /* ---------------------------------------------------------------- presenter */
  useIdleCursor(session.present)
  useEffect(() => {
    if (!session.present) return
    const prev = naturalEventsOn()
    setNaturalEvents(false)
    return () => setNaturalEvents(prev)
  }, [session.present])

  /* ---------------------------------------------------------------- URL write-back */
  useEffect(() => {
    if (!syncUrl || boot !== 'ready') return
    let last = 0
    let timer = 0
    const write = () => {
      last = Date.now()
      replaceQuery(sessionParams(getSession(), clock.get().minutes))
    }
    const onChange = () => {
      if (!clock.get().running) {
        window.clearTimeout(timer)
        timer = 0
        write()
        return
      }
      const wait = SHELL.urlThrottleMs - (Date.now() - last)
      if (wait <= 0) write()
      else if (!timer)
        timer = window.setTimeout(() => {
          timer = 0
          write()
        }, wait)
    }
    write()
    const u1 = subscribeSession(onChange)
    const u2 = clock.subscribe(onChange)
    return () => {
      u1()
      u2()
      window.clearTimeout(timer)
    }
  }, [syncUrl, boot])

  /* ---------------------------------------------------------------- overlays + toasts */
  const hasGuide = !!missions?.length
  const pill = size === 'sm' && hasGuide && !interim
  // the product module (and its missions) is still loading on a phone page: hold the pill's row from the first paint,
  // so the canvas does not jump 44 px down when it mounts (CLS)
  const pillSlot = !pill && size === 'sm' && !interim && layout === 'page' && missions === undefined
  const [guideOpen, setGuideOpenState] = useState(
    () => hasGuide && !query.present && readFlag(`guide:${slug}`, typeof window !== 'undefined' && window.innerWidth >= SHELL.guideAutoOpenMin),
  )
  const setGuideOpen = useCallback(
    (o: boolean) => {
      setGuideOpenState(o)
      writeFlag(`guide:${slug}`, o)
    },
    [slug],
  )
  // missions can arrive after mount (routes/Demo.tsx reads them from the lazily loaded product module):
  // apply the same first-open rule then
  const hadGuide = useRef(hasGuide)
  useEffect(() => {
    if (!hasGuide || hadGuide.current) return
    hadGuide.current = true
    setGuideOpenState(!query.present && readFlag(`guide:${slug}`, typeof window !== 'undefined' && window.innerWidth >= SHELL.guideAutoOpenMin))
  }, [hasGuide, query.present, slug])
  // phones: products fold the sheet while an animation plays (ShellApi.holdGuide); the stored choice stays
  const [guideHold, setGuideHold] = useState(0)
  const holdGuide = useCallback((on: boolean) => setGuideHold((n) => Math.max(0, n + (on ? 1 : -1))), [])
  const guideShown = guideOpen && !(size === 'sm' && guideHold > 0)
  const toggleGuide = () => (guideOpen && !guideShown ? setGuideHold(0) : setGuideOpen(!guideOpen))
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // the palette chunk is fetched the first time it opens, then stays mounted (keeps its query between opens)
  const [paletteMounted, setPaletteMounted] = useState(false)
  if (paletteOpen && !paletteMounted) setPaletteMounted(true)
  const [resetOpen, setResetOpen] = useState(false)
  const [rewinding, setRewinding] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const { toasts, push, dismiss } = useToastQueue()
  const explainLive = useCallback(
    () => push({ id: 'ai-live-off', title: health === 'checking' ? t.aiLiveChecking : t.aiLiveOff, tone: 'neutral', icon: 'info' }),
    [push, health, t],
  )
  const fullscreen = useFullscreen(() => root.current)

  // Ctrl/Cmd + K → palette; "?" (outside text fields) → guide (not on the tour's stage: the tour owns the keyboard)
  useEffect(() => {
    if (tour) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const el = e.target as HTMLElement | null
      const typing = !!el?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey && hasGuide) {
        e.preventDefault()
        setGuideOpenState((o) => {
          writeFlag(`guide:${slug}`, !o)
          return !o
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasGuide, slug, tour])

  /* ---------------------------------------------------------------- reset (rewind the clock, then reseed) */
  const rewind = useRef<{ kill: () => void } | null>(null)
  useEffect(() => () => rewind.current?.kill(), [])
  const doReset = useCallback(async () => {
    setResetOpen(false)
    setRewinding(true)
    const r = rewindClock(WORLD.clockStart, SHELL.rewind)
    rewind.current = r
    await r.done
    try {
      // can reject when the generator chunk cannot be fetched (offline, or a redeploy removed it)
      await resetWorld()
    } catch {
      setRewinding(false)
      push({ id: 'reset', title: t.resetFailed, tone: 'danger', icon: 'replay' })
      return
    }
    resetMissions(slug)
    setEpoch((e) => e + 1)
    setRewinding(false)
    push({ id: 'reset', title: t.resetDone, tone: 'neutral', icon: 'replay' })
  }, [slug, push, t])

  /* ---------------------------------------------------------------- navigation */
  const openProduct = useCallback(
    (p: ProductDef) => {
      if (p.slug === slug) return
      void goTo(demoHref(p.slug, getSession()), navigate, pathname)
    },
    [slug, navigate, pathname],
  )

  const paletteActions = useMemo<PaletteItem[]>(() => {
    const a: PaletteItem[] = []
    if (hasGuide)
      a.push({
        id: 'a:guide',
        group: '',
        label: t.actGuide,
        keywords: 'guide panduan coba ini ? misi mission',
        icon: 'help',
        run: () => setGuideOpen(!guideOpen),
      })
    if (!interim)
      a.push({
        id: 'a:play',
        group: '',
        label: t.actPlay,
        keywords: 'play pause jam clock jalankan jeda',
        icon: 'play',
        run: () => clock.toggle(),
      })
    a.push({
      id: 'a:lang',
      group: '',
      label: t.actLang,
      keywords: 'language bahasa english indonesia',
      icon: 'language',
      run: () => switchLang(lang === 'id' ? 'en' : 'id', setLang, { persist: true }),
    })
    if (!interim)
      a.push({
        id: 'a:reset',
        group: '',
        label: t.actReset,
        keywords: 'reset ulang seed',
        icon: 'reset',
        run: () => setResetOpen(true),
      })
    if (fullscreen.supported)
      a.push({
        id: 'a:fs',
        group: '',
        label: t.actFullscreen,
        keywords: 'fullscreen layar penuh',
        icon: 'fullscreen',
        run: fullscreen.toggle,
      })
    return a
  }, [t, hasGuide, guideOpen, setGuideOpen, lang, setLang, fullscreen.supported, fullscreen.toggle, interim])

  /* ---------------------------------------------------------------- toast placement (prop, or the canvas's override) */
  const [toastOverride, setToastOverride] = useState<ToastPlacementSpec | null>(null)
  const toastSpec = toastOverride ?? toastPlacement ?? 'bottom-left'
  const toastAt: ToastPlacement = typeof toastSpec === 'string' ? toastSpec : size === 'sm' ? toastSpec.sm : toastSpec.wide

  /* ---------------------------------------------------------------- context for the canvas */
  const api = useMemo<ShellApi>(
    () => ({
      product,
      pack,
      focus,
      clearFocus: () => {
        setFocus(null)
        replaceQuery({ focus: null })
      },
      markMission: (id: string) => markMission(slug, id),
      guideOpen,
      setGuideOpen,
      holdGuide,
      openPalette: () => setPaletteOpen(true),
      setToastPlacement: setToastOverride,
      toast: (d: Omit<ToastData, 'id'> & { id?: string }) => void push(d),
      present: session.present,
      size,
      link: query,
      interim,
    }),
    [product, pack, focus, slug, guideOpen, setGuideOpen, holdGuide, push, session.present, size, query, interim],
  )

  const bar = {
    product,
    size,
    health,
    interim,
    onLiveUnavailable: explainLive,
    rewinding,
    onReset: () => setResetOpen(true),
    fullscreen,
    guide: {
      available: hasGuide,
      open: guideShown,
      toggle: toggleGuide,
      id: guideId,
    },
    onOpenPalette: () => setPaletteOpen(true),
    tour,
    tourSlot,
    // K4: a sandbox taken over from the tour (?world=tour&from=tur-<n>) offers "Kembali ke tur"
    fromTour: !tour && !!session.from,
  }

  const hs = typeof hotspot === 'string' ? { target: hotspot } : hotspot
  const body = splitTabs ? <SplitStage {...splitTabs} /> : (canvas ?? children)

  return (
    <ShellContext.Provider value={api}>
      <div
        ref={root}
        className={`dk-root dk-shell is-${layout} is-${size}${pill || pillSlot ? ' has-pill' : ''}${session.present ? ' is-present' : ''}${guideShown && hasGuide ? ' has-guide' : ''}${motionMode() !== 'full' ? ' is-calm' : ''}${className ? ` ${className}` : ''}`}
        data-eco={product.eco}
        // the site's smooth scroll (Lenis, RootLayout) cancels wheel events outside opted-out elements: every panel,
        // list and phone thread in a sandbox scrolls natively (the sandbox page itself never scrolls)
        data-lenis-prevent=""
        data-present={session.present ? '1' : undefined}
        style={
          {
            ['--dk-present-scale' as string]: session.present ? SHELL.presentScale : 1,
            ['--dk-guide-w' as string]: `${SHELL.guideW}px`,
          } as CSSProperties
        }
      >
        {/* the page heading only when the shell IS the page; a contained shell sits under its host page's h1 */}
        {layout === 'page' && <h1 className="dk-sr">{`${product.name} — ${lang === 'id' ? 'demo interaktif' : 'interactive demo'}`}</h1>}
        <TopBar {...bar} onOpenMore={() => setMoreOpen(true)} />
        {pill && <MissionPill product={slug} missions={missions!} guideId={guideId} open={guideShown} onToggle={toggleGuide} />}
        {pillSlot && <div className="dk-mpill is-slot" aria-hidden="true" />}
        <div className="dk-shell-body">
          <section ref={canvasRef} className="dk-shell-canvas" aria-label={lang === 'id' ? `Demo ${product.name}` : `${product.name} demo`} aria-busy={boot !== 'ready' || rewinding}>
            {boot === 'ready' ? (
              <div key={epoch} className="dk-shell-stage">
                <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>{body}</Suspense>
              </div>
            ) : boot === 'error' ? (
              <EmptyState
                title={t.loadError}
                art="map"
                action={{
                  label: t.retry,
                  icon: 'refresh',
                  onClick: () => setAttempt((a) => a + 1),
                }}
              />
            ) : (
              <div className="dk-shell-skel">
                <LoadingText>{t.loading}</LoadingText>
                <div className="dk-shell-skel-row">
                  <Skeleton height={72} radius={14} />
                  <Skeleton height={72} radius={14} />
                  <Skeleton height={72} radius={14} />
                </div>
                <Skeleton height={14} width="40%" />
                <Skeleton lines={6} height={14} />
              </div>
            )}
            {rewinding && (
              <div className="dk-rewind" role="status">
                <span className="dk-rewind-ic" aria-hidden="true">
                  <Icon name="reset" size={28} />
                </span>
                <span>{t.rewinding}</span>
              </div>
            )}
          </section>
          {hasGuide && (
            <Suspense fallback={null}>
              <GuidePanel product={slug} missions={missions!} open={guideShown} onClose={() => setGuideOpen(false)} id={guideId} size={size} />
            </Suspense>
          )}
        </div>
        {boot === 'ready' && hs && !rewinding && !(size === 'sm' && guideOpen) && (
          <Suspense fallback={null}>
            <Hotspot key={`${hs.target}:${epoch}`} target={hs.target} id={hs.id ?? `${slug}:${hs.target}`} label={bi(hs.label, lang)} placement={hs.placement} root={() => canvasRef.current} />
          </Suspense>
        )}
        <EventToastStack product={slug} toasts={toasts} push={push} dismiss={dismiss} epoch={epoch} placement={toastAt} />
        {paletteMounted && (
          <Suspense fallback={null}>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} product={product} onOpenProduct={openProduct} actions={paletteActions} sessionItems={!interim} />
          </Suspense>
        )}
        {(size === 'sm' || size === 'md') && <MoreSheet {...bar} open={moreOpen} onClose={() => setMoreOpen(false)} onRolePicked={(name) => push({ id: 'role', tone: 'accent', icon: 'user', title: t.roleChanged(name) })} />}
        <Modal
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          title={t.resetTitle}
          description={t.resetBody}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setResetOpen(false)} data-autofocus>
                {t.cancel}
              </Button>
              <Button variant="danger" icon="reset" onClick={() => void doReset()}>
                {t.resetConfirm}
              </Button>
            </>
          }
        />
      </div>
    </ShellContext.Provider>
  )
}
