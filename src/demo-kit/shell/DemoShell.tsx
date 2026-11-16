/**
 * shell/DemoShell.tsx — the frame of every sandbox (spec §6.3, §6.5, §8.3, §8.5, §14).
 *
 * Boot: reads ?region ?role ?t ?ai ?lang ?present ?seed ?focus → session; loads the region pack and the world
 * (skipped when the same region + seed is already in memory, so cross-product jumps keep the clock and every
 * change); shows a skeleton meanwhile; then renders TopBar + canvas (or SplitStage) + GuidePanel + EventToast
 * stack + CommandPalette (+ an optional Hotspot). Session / clock changes are written back to the URL with
 * replaceState (throttled while the clock runs) so the state can be shared.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { gsap } from 'gsap'
import { PRODUCT_BY_SLUG, type Bi, type ProductDef, type ProductSlug } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import { goTo } from '../../components/AppLink'
import { EmptyState, Icon, LoadingText, Modal, Button, Skeleton, motionMode, useToastQueue, type ToastData } from '../ui'
import { DEFAULT_REGION_ID, loadRegion, type RegionPack } from '../region/loader'
import { WORLD, clock, getSession, loadWorld, naturalEventsOn, resetWorld, setNaturalEvents, setSession, subscribeSession, useSession, world } from '../world'
import { useDemoStrings } from '../i18n'
import { SHELL } from './constants'
import { ShellContext, type ShellApi } from './context'
import { useAiHealth } from './controls'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { EventToastStack } from './EventToasts'
import { GuidePanel } from './GuidePanel'
import { Hotspot } from './Hotspot'
import { markMission, resetMissions, type Mission } from './missions'
import { SplitStage, type SplitStageProps } from './SplitStage'
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
  /** element to ring first ("click here"): a selector, or selector + label */
  hotspot?: string | { target: string; label?: Bi | string; id?: string }
  /** split products: two views side by side (tabs below 768 px) */
  splitTabs?: SplitStageProps
  /** 'page' fills the viewport (100dvh, /demo/:slug); 'contained' fills its parent (showcase, /produk) */
  layout?: 'page' | 'contained'
  /** write session + clock into the URL (default true) */
  syncUrl?: boolean
  className?: string
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

export function DemoShell({ product: slug, canvas, children, missions, hotspot, splitTabs, layout = 'page', syncUrl = true, className }: DemoShellProps) {
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
    return world.status() === 'ready' && s.regionId === want.regionId && s.seed === want.seed
  }

  useLayoutEffect(() => {
    const s = getSession()
    setSession({
      regionId: query.region ?? (s.regionId || DEFAULT_REGION_ID),
      seed: query.seed ?? s.seed,
      role: query.role ?? product.defaultRole,
      present: query.present ?? false,
      aiMode: 'sim',
      lang,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    setSession({ lang })
  }, [lang])

  // ?ai=live is honoured only once the proxy says it is live
  useEffect(() => {
    if (health === 'live' && query.ai === 'live') setSession({ aiMode: 'live' })
    if (health === 'down' && getSession().aiMode === 'live') setSession({ aiMode: 'sim' })
  }, [health, query.ai])

  /* ---------------------------------------------------------------- load region pack + world */
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>(() => (sameWorld() && world.pack() ? 'ready' : 'loading'))
  const [pack, setPack] = useState<RegionPack | null>(() => (sameWorld() ? world.pack() : null))
  const [attempt, setAttempt] = useState(0)
  const appliedT = useRef(false)

  useEffect(() => {
    let alive = true
    const { regionId, seed } = session
    const reuse = sameWorld()
    if (!reuse) setBoot('loading')
    ;(async () => {
      try {
        const p = await loadRegion(regionId)
        if (!reuse) await loadWorld(p, seed)
        if (!alive) return
        if (!appliedT.current) {
          appliedT.current = true
          if (query.t != null) clock.setTime(query.t)
        }
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
  }, [session.regionId, session.seed, attempt])

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
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [rewinding, setRewinding] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const { toasts, push, dismiss } = useToastQueue()
  const fullscreen = useFullscreen(() => root.current)

  // Ctrl/Cmd + K → palette; "?" (outside text fields) → guide
  useEffect(() => {
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
  }, [hasGuide, slug])

  /* ---------------------------------------------------------------- reset (rewind the clock, then reseed) */
  const rewind = useRef<{ kill: () => void } | null>(null)
  useEffect(() => () => rewind.current?.kill(), [])
  const doReset = useCallback(async () => {
    setResetOpen(false)
    setRewinding(true)
    const r = rewindClock(WORLD.clockStart, SHELL.rewind)
    rewind.current = r
    await r.done
    await resetWorld()
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
      run: () => setLang(lang === 'id' ? 'en' : 'id'),
    })
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
  }, [t, hasGuide, guideOpen, setGuideOpen, lang, setLang, fullscreen.supported, fullscreen.toggle])

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
      openPalette: () => setPaletteOpen(true),
      toast: (d: Omit<ToastData, 'id'> & { id?: string }) => void push(d),
      present: session.present,
      size,
    }),
    [product, pack, focus, slug, guideOpen, setGuideOpen, push, session.present, size],
  )

  const bar = {
    product,
    size,
    health,
    rewinding,
    onReset: () => setResetOpen(true),
    fullscreen,
    guide: {
      available: hasGuide,
      open: guideOpen,
      toggle: () => setGuideOpen(!guideOpen),
      id: guideId,
    },
    onOpenPalette: () => setPaletteOpen(true),
  }

  const hs = typeof hotspot === 'string' ? { target: hotspot } : hotspot
  const body = splitTabs ? <SplitStage {...splitTabs} /> : (canvas ?? children)

  return (
    <ShellContext.Provider value={api}>
      <div
        ref={root}
        className={`dk-root dk-shell is-${layout} is-${size}${session.present ? ' is-present' : ''}${guideOpen && hasGuide ? ' has-guide' : ''}${motionMode() !== 'full' ? ' is-calm' : ''}${className ? ` ${className}` : ''}`}
        data-eco={product.eco}
        data-present={session.present ? '1' : undefined}
        style={
          {
            ['--dk-present-scale' as string]: session.present ? SHELL.presentScale : 1,
            ['--dk-guide-w' as string]: `${SHELL.guideW}px`,
          } as CSSProperties
        }
      >
        <TopBar {...bar} onOpenMore={() => setMoreOpen(true)} />
        <div className="dk-shell-body">
          <section ref={canvasRef} className="dk-shell-canvas" aria-label={product.name} aria-busy={boot !== 'ready' || rewinding}>
            {boot === 'ready' ? (
              <div key={epoch} className="dk-shell-stage">
                {body}
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
          {hasGuide && <GuidePanel product={slug} missions={missions!} open={guideOpen} onClose={() => setGuideOpen(false)} id={guideId} />}
        </div>
        {boot === 'ready' && hs && !rewinding && !(size === 'sm' && guideOpen) && (
          <Hotspot key={`${hs.target}:${epoch}`} target={hs.target} id={hs.id ?? `${slug}:${hs.target}`} label={bi(hs.label, lang)} root={() => canvasRef.current} />
        )}
        <EventToastStack product={slug} toasts={toasts} push={push} dismiss={dismiss} epoch={epoch} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} product={product} onOpenProduct={openProduct} actions={paletteActions} />
        {(size === 'sm' || size === 'md') && <MoreSheet {...bar} open={moreOpen} onClose={() => setMoreOpen(false)} />}
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
