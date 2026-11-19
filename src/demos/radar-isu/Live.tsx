/**
 * demos/radar-isu/Live.tsx — "Pantauan Live" (spec P4): KPI strip, the mention stream on the world clock, topic
 * bubbles + the 24 h sentiment index, and the Hoax Alert card. Emits the false-narrative burst ("Picu skenario",
 * source radar-isu: the world raises ONE hoax.detected on the 6th post → toast to Meja Pimpinan) and, for the
 * Regional Head, an instruction to the Comms Office. Clarify and the AI analyst are lazy drawers.
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { Button, Drawer, Kpi, KpiStrip, InsightCallout, Icon, LiveBadge, Segmented, motionMode } from '../../demo-kit/ui'
import { BubbleChart, LineChart, type BubbleDatum } from '../../demo-kit/viz'
import { clockWib, compact } from '../../demo-kit/viz/format'
import { useLocation, useNavigate } from 'react-router'
import { goTo } from '../../components/AppLink'
import { demoHref, useShell } from '../../demo-kit/shell'
import { WORLD, clock, emit, getSession, isEvent, onEvent, rows, useSession, useWorld, world, type Mention, type WorldState } from '../../demo-kit/world'
import { HoaxCard } from './HoaxCard'
import { Stream } from './Stream'
import {
  RADAR,
  afterPaint,
  burstPosts,
  hoaxPhase,
  manualTriggerAt,
  setAssessTarget,
  markManualTrigger,
  damNameOf,
  mentionsToday,
  negIssues,
  prefetchBurst,
  radarKpis,
  recoveryOf,
  riverAlert,
  sapaFlood,
  scannedToday,
  sentSummary,
  sentimentIndex,
  signedIdx,
  streamOf,
  topicsOf,
  useNow,
  type SentRes,
} from './model'
import { STR, fill, topicName, useStr } from './strings'
import { isEnabled } from '../../lib/motion'

const loadClarify = () => import('./Clarify')
const loadAssistant = () => import('./Assistant')
const Clarify = lazy(loadClarify)
const Assistant = lazy(loadAssistant)
const warmAssistant = () => void loadAssistant().catch(() => undefined)

const selMentions = (s: WorldState) => s.mentions
const selHoax = (s: WorldState) => s.hoaxAlerts
const selGauges = (s: WorldState) => s.gauges
const selMeta = (s: WorldState) => s.meta
const selRegion = (s: WorldState) => s.region
const selSeed = (s: WorldState) => s.seed
const selComplaints = (s: WorldState) => s.complaints
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
/** the three-column layout (container ≥ 1080 px): the idle hoax card has room for its full text there */
function useWide(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWide((e?.contentRect.width ?? 0) >= 1040))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return wide
}
/** the monitor starts by itself once per page load (first visit of the live tab) */
let autoRan = false
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
/** keep the previous value while its signature is unchanged (the bubbles must not re-layout on every clock tick) */
function useStable<T>(v: T, sig: (v: T) => string): T {
  const ref = useRef<{ s: string; v: T } | null>(null)
  const s = sig(v)
  if (!ref.current || ref.current.s !== s) ref.current = { s, v }
  return ref.current.v
}
/** clock speed while running, 0 when paused: a primitive, so Live does not re-render on every world minute */
const runSpeed = () => {
  const c = clock.get()
  return c.running ? c.speed : 0
}
const useRunSpeed = () => useSyncExternalStore(clock.subscribe, runSpeed, runSpeed)
const NARROW = '(max-width: 479px)'
/** < 480 px viewport: short KPI captions */
function useNarrow(): boolean {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const on = () => setN(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return n
}

export interface LiveProps {
  onDeep: (keyword: string) => void
  /** entity the shell was opened with (?focus=…) — a hoax alert or a mention */
  focus: string | null
  onFocusDone: () => void
}

export default function Live({ onDeep, focus, onFocusDone }: LiveProps) {
  const { t, lang } = useStr()
  const shell = useShell()
  const session = useSession()
  const role = session.role
  const head = role === 'kepala-daerah'
  const now = useNow()
  const speed = useRunSpeed()
  const mentions = useWorld(selMentions)
  const hoaxAlerts = useWorld(selHoax)
  const gauges = useWorld(selGauges)
  const meta = useWorld(selMeta)
  const region = useWorld(selRegion)
  const seed = useWorld(selSeed)
  const complaints = useWorld(selComplaints)
  const gauge = gauges.byId[meta.facts.hoax.gaugeId]
  const damName = damNameOf(meta.facts.hoax, lang, gauge?.name)

  /* ---------------------------------------------------------------- derived */
  const kpis = radarKpis(mentions, now)
  const [res, setRes] = useState<SentRes>('24h')
  const series = sentimentIndex(mentions, now, res)
  // stable while nothing in the scenario changed (the hoax card is memoised: no re-render on every world minute)
  const phase = useStable(
    useMemo(() => hoaxPhase({ mentions, hoaxAlerts, meta }, now), [mentions, hoaxAlerts, meta, now]),
    (ph) =>
      ph.kind === 'idle' ? 'idle' : `${ph.kind}|${ph.posts.length}|${ph.kind === 'burst' ? '' : `${ph.alert.id}|${ph.alert.status}|${ph.alert.clarification?.at ?? ''}|${ph.alert.spreadPerHour}`}`,
  )
  const stream = useMemo(() => streamOf(mentions, now, RADAR.streamLimit), [mentions, now])
  // bubbles move in 10-minute steps (a smooth glide, not a re-layout on every world minute at ×60)
  const nowQ = Math.floor(now / 10) * 10
  const clusters = useStable(
    useMemo(() => topicsOf(mentions, nowQ, 24), [mentions, nowQ]),
    (c) => c.map((x) => `${x.topic}:${x.count}:${x.score}:${Math.round(x.reach / 500)}`).join('|'),
  )
  const bubbles = useMemo<BubbleDatum[]>(
    () =>
      clusters.slice(0, 10).map((c) => ({
        id: c.topic,
        label: topicName(c.topic, lang),
        volume: c.count,
        sentiment: c.score,
        note: `${compact(c.reach, lang)} ${lang === 'id' ? 'jangkauan' : 'reach'}`,
      })),
    [clusters, lang],
  )
  const clarAtR = phase.kind === 'clarified' ? (phase.alert.clarification?.at ?? null) : null
  const recovery = useStable(
    useMemo(() => (clarAtR === null ? null : recoveryOf(mentions, now, clarAtR)), [clarAtR, mentions, now]),
    (r) => (r ? `${r.before}|${r.after}` : ''),
  )
  const negTop = negIssues(mentions, now)[0]
  // Sapa Warga flood reports where the rumour points (second evidence row; hour granularity is enough)
  const sapa = useStable(
    useMemo(() => sapaFlood({ complaints, region }, now), [complaints, region, now]),
    (f) => (f ? `${f.count}|${f.desa}|${f.since}|${f.regionCount}|${f.evac}|${f.dike}|${f.inHomes}` : ''),
  )
  // the river gauge at SIAGA / AWAS: shown next to the dam evidence (a calm dam is not a calm river)
  const river = useStable(
    useMemo(() => riverAlert({ gauges }, now), [gauges, now]),
    (r) => (r ? `${r.status}|${r.level}|${r.updatedAt}` : ''),
  )
  const replayAt = manualTriggerAt(meta.facts)
  // "Isu negatif" = topics with any negative mention (ecosystem definition); how many are mostly negative
  const negDominant = clusters.filter((c) => c.sentiment === 'negatif').length
  // the moment a hoax is detected, zoom the sentiment chart to 3 h so the dip (and later the recovery) is visible
  const wasActive = useRef(phase.kind === 'active' || phase.kind === 'clarified')
  useEffect(() => {
    const on = phase.kind === 'active' || phase.kind === 'clarified'
    if (on && !wasActive.current) setRes('3h')
    wasActive.current = on
  }, [phase.kind])

  /* ---------------------------------------------------------------- state */
  const [topic, setTopic] = useState<string | null>(null)
  const [clarify, setClarify] = useState<null | 'draft' | 'approve'>(null)
  const [ask, setAsk] = useState<{
    open: boolean
    prompt: string | null
    n: number
  }>({ open: false, prompt: null, n: 0 })
  const [bursting, setBursting] = useState(false)
  const [instructed, setInstructed] = useState(false)

  /* ---------------------------------------------------------------- "Picu skenario": the false narrative, live */
  const burst = useRef<{
    rest: Awaited<ReturnType<typeof burstPosts>>
    facts: object
  } | null>(null)
  const trigger = useCallback(async (at?: number) => {
    if (burst.current) return
    const s = world.get()
    const start = at ?? Math.max(0, clock.get().minutes - 25)
    // pressed by hand: the posts are dated up to 25 minutes back and replayed at speed; the card says so
    if (at === undefined) markManualTrigger(clock.get().minutes, s.meta.facts)
    burst.current = { rest: [], facts: s.meta.facts }
    // answer the click at once (busy state), even while the burst texts are still loading
    setBursting(true)
    const posts = await burstPosts(s, start)
    if (!posts.length || world.get().meta.facts !== s.meta.facts) {
      burst.current = null
      setBursting(false)
      return
    }
    const run = { rest: [...posts], facts: s.meta.facts }
    burst.current = run
    const gap = motionMode() === 'full' ? RADAR.burstGapMs : RADAR.burstGapReducedMs
    while (run.rest.length && (burst.current === run || burst.current === null) && world.get().meta.facts === run.facts) {
      emit('mention.created', run.rest.shift()!, 'radar-isu')
      if (run.rest.length) await sleep(gap)
    }
    if (burst.current === run) {
      burst.current = null
      setBursting(false)
    }
  }, [])
  /* the live feed (lazy): curated mentions while the clock runs, backfill after a jump, the 10.00 scenario after a
     jump over it. On a first visit with full motion the monitor starts by itself at ×60 (the world moves within
     seconds; reduced motion, ?off=, ?static, a presenter / test run or a clock already moved keep it as it is). */
  const triggerRef = useRef(trigger)
  triggerRef.current = trigger
  useEffect(() => {
    let un: (() => void) | null = null
    let alive = true
    void import('./live-feed').then(
      (m) => {
        if (alive) un = m.startFeed({ startHoax: (at) => void triggerRef.current(at) })
      },
      () => undefined,
    )
    let auto = 0
    const q = new URLSearchParams(window.location.search)
    // reduced motion / ?off=demoAnimations / ?static=1 keep the world still (a perf degrade alone does not)
    const calm = motionMode() === 'static' || !isEnabled('demoAnimations') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!autoRan && !calm && !q.has('e2e') && !q.has('present') && !q.has('tour')) {
      const c0 = clock.get()
      // only from the untouched start of the demo day (an explicit ?t= or a world already in progress stays as it is)
      if (!c0.running && c0.minutes === WORLD.clockStart)
        auto = window.setTimeout(() => {
          // marked when it fires (not when scheduled): a dev StrictMode remount clears the first timer
          autoRan = true
          const c = clock.get()
          // the visitor already set the clock (or the tab is hidden): leave it alone
          if (c.running || c.minutes !== c0.minutes || document.visibilityState === 'hidden') return
          clock.setSpeed(60)
          clock.play()
        }, RADAR.autoRunMs)
    }
    return () => {
      alive = false
      un?.()
      window.clearTimeout(auto)
    }
  }, [])
  // toasts away from the hoax card: bottom-right beside the charts on wide screens; on phones at the bottom (the
  // guide is a pill at the top now, and the hoax card with its next step sits in the first screen above them)
  const setToastAt = shell.setToastPlacement
  useEffect(() => {
    setToastAt({ wide: 'bottom-right', sm: 'bottom-left' })
    return () => setToastAt(null)
  }, [setToastAt])
  // leaving mid-burst: post the rest at once (into the SAME world), so the hoax is still detected
  useEffect(
    () => () => {
      const run = burst.current
      burst.current = null
      if (run && world.get().meta.facts === run.facts) while (run.rest.length) emit('mention.created', run.rest.shift()!, 'radar-isu')
    },
    [],
  )

  /* ---------------------------------------------------------------- Regional Head: instruct the Comms Office */
  const instruct = useCallback(() => {
    if (phase.kind !== 'active') return
    const opd = region.opd.find((o) => /kominfo/i.test(`${o.id} ${o.short}`))
    emit(
      'instruction.issued',
      {
        text: {
          id: fill(STR.id.instructText, { claim: phase.alert.claim.id }),
          en: fill(STR.en.instructText, { claim: phase.alert.claim.en }),
        },
        opdIds: opd ? [opd.id] : [],
        refs: [`hoaxAlerts:${phase.alert.id}`],
      },
      'radar-isu',
    )
    setInstructed(true)
  }, [phase, region])

  /* ---------------------------------------------------------------- arrivals (?focus=) */
  const hoaxRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus) return
    const m = mentions.byId[focus]
    if (hoaxAlerts.byId[focus]) hoaxRef.current?.scrollIntoView({ block: 'nearest' })
    else if (m) setTopic(m.topic)
    onFocusDone()
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------------------------------------------- missions */
  const openTopic = useCallback(
    (id: string) => {
      setTopic(id)
      if (clusters[0]?.topic === id) shell.markMission('topik')
    },
    [clusters, shell],
  )
  // the clarification mission auto-ticks on clarification.published (index.tsx); close the drawer on publish
  useEffect(() => onEvent('clarification.published', (e) => isEvent(e, 'clarification.published') && setClarify(null)), [])

  const assess = useCallback(
    (m: Mention) => {
      // the analyst reads this card's own label, score and topic (its verdict never contradicts the card)
      setAssessTarget(m)
      setAsk((a) => ({
        open: true,
        prompt: `${lang === 'id' ? 'Nilai unggahan ini' : 'Assess this post'}: «${m.text[lang]}»`,
        n: a.n + 1,
      }))
    },
    [lang],
  )

  const tc = topic ? clusters.find((c) => c.topic === topic) : undefined
  // the drawer lists exactly the mentions its count is made of (same 24 h window, newest first)
  const topicItems = useMemo(
    () =>
      topic
        ? rows(mentions)
            .filter((m) => m.topic === topic && m.at <= nowQ && m.at >= nowQ - 1440)
            .sort((a, b) => b.at - a.at)
        : [],
    [mentions, nowQ, topic],
  )

  /* ---------------------------------------------------------------- chart helpers */
  const markIdx = useMemo(() => {
    const at = phase.kind === 'clarified' ? phase.alert.clarification?.at : phase.kind === 'active' ? phase.alert.at : undefined
    if (at === undefined) return undefined
    const i = series.findIndex((p) => p.at >= at)
    return i < 0
      ? undefined
      : {
          index: i,
          label: phase.kind === 'clarified' ? t.markClar : t.markHoax,
        }
  }, [phase, series, t])
  const sentWord = kpis.sentiment <= -20 ? t.wBuruk : kpis.sentiment >= 20 ? t.wBaik : t.wNetral
  // the hero KPI says in words what the number means ("Netral · skala −100…+100")
  const sentCap = sentWord.charAt(0).toUpperCase() + sentWord.slice(1)
  const sm = shell.size === 'sm'
  const narrow = useNarrow()
  const wide = useWide(gridRef)
  const hoaxActive = phase.kind !== 'idle'

  /* keyboard focus follows the hoax card: the pressed button unmounts when the phase changes (Picu → burst →
     detected; Terbitkan closes the drawer whose opener is gone; "Lihat 30 menit" disappears after use) */
  const wantFocus = useRef(false)
  const pendingRecovery = clarAtR !== null && now < clarAtR + 30
  useEffect(() => {
    if (!wantFocus.current) return
    const go = () => {
      const card = hoaxRef.current
      const a = document.activeElement
      if (!card || (a && a !== document.body && !card.contains(a))) return
      const el = card.querySelector<HTMLElement>('[data-ri-focus]')
      if (!el || el === a) return
      el.focus({ preventScroll: true })
      if (phase.kind === 'active' || (phase.kind === 'clarified' && !pendingRecovery)) wantFocus.current = false
    }
    go()
    const id = window.setTimeout(go, 450)
    return () => window.clearTimeout(id)
  }, [phase.kind, pendingRecovery, clarify])

  const onTrigger = useCallback(() => {
    wantFocus.current = true
    void trigger()
  }, [trigger])
  const onClarify = useCallback((m: 'draft' | 'approve') => {
    wantFocus.current = true
    setClarify(m)
  }, [])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const go = useCallback(
    (slug: 'siaga-wilayah' | 'meja-pimpinan' | 'sapa-warga', focus?: string) => {
      const h = demoHref(slug, getSession(), focus)
      void goTo(new URLSearchParams(window.location.search).get('controls') === 'all' ? `${h}&controls=all` : h, navigate, pathname)
    },
    [navigate, pathname],
  )
  // Siaga Wilayah arrives on a gauge id (?focus=<gaugeId>): the map flies to the dam and its card shows the gauge
  const damGaugeId = meta.facts.hoax.gaugeId
  const onOpenSiaga = useCallback(() => go('siaga-wilayah', damGaugeId), [go, damGaugeId])
  const onOpenMp = useCallback(() => go('meja-pimpinan'), [go])
  // Sapa Warga opens the most urgent of the reports the card cites (?focus=<complaint id>: its ticket opens)
  const sapaFocus = sapa?.focusId
  const onOpenSapa = useCallback(() => go('sapa-warga', sapaFocus), [go, sapaFocus])
  const onSkip = useCallback(() => {
    if (clarAtR === null) return
    wantFocus.current = true
    const to = Math.min(1439, clarAtR + 31)
    afterPaint(() => clock.setTime(to))
  }, [clarAtR])
  // a detected hoax: fetch the clarification drawer while the visitor reads the card (the click then opens it at once)
  useEffect(() => {
    if (phase.kind !== 'active') return
    const id = window.setTimeout(() => void loadClarify().catch(() => undefined), 300)
    return () => window.clearTimeout(id)
  }, [phase.kind])
  // the kit KPI prefixes '+' to positive deltas itself: no plus sign here (else "++22")
  const fmtSent = useCallback((n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`, [])
  const fmtReach = useCallback((n: number) => compact(n, lang), [lang])

  /* charts: memoised elements, so a stream filter / drawer / badge update does not re-render them */
  const onBubble = useCallback((d: BubbleDatum) => openTopic(d.id), [openTopic])
  const bubbleEl = useMemo(
    () => <BubbleChart title={t.bubblesTitle} unit={t.bubblesUnit} seed={seed} data={bubbles} selectedId={topic} onSelect={onBubble} height={sm ? 260 : 300} className="dk-ri-bubbles" />,
    [t, seed, bubbles, topic, onBubble, sm],
  )
  const sentX = useMemo(() => series.map((p) => p.at), [series])
  const sentSeries = useMemo(() => [{ id: 'sent', label: t.sentSeries, values: series.map((p) => p.value) }], [series, t.sentSeries])
  const sentEl = useMemo(
    () => (
      <LineChart
        title={res === '24h' ? t.sentTitle : t.sentTitle3}
        unit={t.sentUnit}
        actions={
          <Segmented<SentRes>
            size="sm"
            label={t.sentRange}
            value={res}
            onChange={setRes}
            options={[
              { value: '24h', label: t.r24 },
              { value: '3h', label: t.r3 },
            ]}
          />
        }
        seed={seed}
        x={sentX}
        xFormat={(x) => clockWib(Number(x), lang)}
        series={sentSeries}
        yDomain={[-100, 100]}
        {...(markIdx ? { marker: markIdx } : {})}
        format={signedIdx}
        summary={sentSummary(series, lang, t.sentSeries)}
        height={sm ? 180 : 200}
        className="dk-ri-sentchart"
      />
    ),
    [res, t, seed, sentX, sentSeries, markIdx, lang, sm, series],
  )

  // re-rendered only when a figure changes (not on every world minute)
  const { count: kCount, prev: kPrev, sentiment: kSent, negTopics: kNeg, reach: kReach } = kpis
  const kpiStrip = useMemo(
    () => (
      // keyed by language: the kit count-up keeps its first formatter until the value changes ("219 rb" in EN)
      <KpiStrip label={t.kpiLabel} className="dk-ri-kpis">
        <Kpi label={t.kpiMentions} value={kCount} delta={kCount - kPrev} goodWhen="up" deltaLabel={narrow ? t.vsPrevShort : t.vsPrev} {...(narrow ? {} : { caption: t.kpiMentionsCap })} />
        <Kpi hero label={t.kpiSentiment} value={kSent} format={fmtSent} caption={fill(narrow ? t.kpiSentimentCap : t.kpiSentimentCapN, { w: sentCap, n: kCount })} />
        <Kpi label={t.kpiNegative} value={kNeg} caption={fill(narrow ? t.kpiNegativeCapShort : t.kpiNegativeCap, { d: negDominant })} />
        <Kpi label={t.kpiReach} value={kReach} format={fmtReach} caption={t.kpiReachCap} />
      </KpiStrip>
    ),
    [t, lang, kCount, kPrev, kSent, kNeg, kReach, narrow, fmtSent, fmtReach, sentCap, negDominant],
  )

  const hoaxCard = (
    <div ref={hoaxRef} className="dk-ri-col-hoax">
      <HoaxCard
        phase={phase}
        pendingRecovery={pendingRecovery}
        role={role}
        damName={damName}
        gauge={gauge}
        sapa={sapa}
        river={river}
        replayAt={replayAt}
        recovery={recovery}
        bursting={bursting}
        instructed={instructed}
        onTrigger={onTrigger}
        onClarify={onClarify}
        onInstruct={instruct}
        onSkip={onSkip}
        onOpenSiaga={onOpenSiaga}
        onOpenMp={onOpenMp}
        onOpenSapa={onOpenSapa}
        onPrefetch={prefetchBurst}
        compactIdle={!sm && !wide && !hoaxActive}
        rowIdle={sm && !hoaxActive}
      />
    </div>
  )

  return (
    <div className={`dk-ri-live${hoaxActive ? ' has-hoax' : ''}`}>
      <header className="dk-ri-live-h">
        <div className="dk-ri-live-ht">
          <h2 className="dk-ri-h2">{t.liveTitle}</h2>
          <p className="dk-ri-lead">{fill(t.liveLead, { r: region.shortName })}</p>
        </div>
        <div className="dk-ri-live-act">
          {speed ? (
            <button type="button" className="dk-ri-clockpill" onClick={() => clock.pause()} aria-label={fill(t.clockPauseAria, { t: clockWib(now, lang), x: speed })}>
              <LiveBadge label={fill(t.clockRunning, { t: clockWib(now, lang), x: speed })} />
              <Icon name="pause" size={14} />
            </button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon="play"
              onClick={() => {
                // ×60: a world hour per real minute, so the stream visibly moves within seconds
                clock.setSpeed(60)
                clock.play()
              }}
            >
              {fill(t.clockPlay, { t: clockWib(now, lang) })}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon="spark" onPointerEnter={warmAssistant} onFocus={warmAssistant} onClick={() => setAsk((a) => ({ open: true, prompt: null, n: a.n + 1 }))}>
            {t.askAi}
          </Button>
        </div>
      </header>

      {head && (
        <InsightCallout title={t.execTitle} className="dk-ri-exec">
          <p>
            {fill(t.execSent, {
              v: signedIdx(kpis.sentiment),
              w: sentWord,
            })}
          </p>
          {negTop && (
            <p>
              {fill(t.execTop, {
                t: topicName(negTop.topic, lang),
                n: negTop.count,
              })}
            </p>
          )}
          <p>
            {phase.kind === 'active'
              ? fill(t.execHoaxOn, { c: phase.alert.claim[lang] })
              : phase.kind === 'clarified'
                ? fill(t.execHoaxDone, {
                    c: phase.alert.claim[lang],
                    t: clockWib(phase.alert.clarification?.at ?? now, lang),
                  })
                : t.execHoaxNone}
          </p>
        </InsightCallout>
      )}

      {sm && hoaxCard}
      {!sm && kpiStrip}

      <div ref={gridRef} className="dk-ri-grid">
        {!sm && hoaxCard}
        <div className="dk-ri-col-stream">
          <p className="dk-ri-scan dk-num">
            <Icon name="search" size={13} /> {fill(t.streamScan, { n: scannedToday(now).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'), m: mentionsToday(mentions, now) })}{' '}
            <span>({t.streamScanNote})</span>
          </p>
          <Stream key={role} items={stream} initialFilter={head ? 'neg' : 'all'} onAssess={assess} compact={sm} />
        </div>
        <div className="dk-ri-col-mid">
          <div>{bubbleEl}</div>
          <div className="dk-ri-topicrow">
            <span className="dk-ri-hint">
              <Icon name="info" size={14} /> {COARSE ? t.bubblesHintTouch : t.bubblesHint}
            </span>
            <div className="dk-ri-chips" role="group" aria-label={t.bubblesTitle}>
              {clusters.slice(0, 6).map((c, i) => (
                <Button key={c.topic} size="sm" variant={i === 0 ? 'secondary' : 'ghost'} onClick={() => openTopic(c.topic)} data-topic={c.topic} aria-pressed={topic === c.topic}>
                  {topicName(c.topic, lang)} <span className="dk-num dk-ri-cnt">{c.count}</span>
                </Button>
              ))}
            </div>
          </div>
          {sentEl}
        </div>
      </div>
      {sm && kpiStrip}
      <p className="dk-ri-foot">
        <Icon name="info" size={14} /> {t.simNote}
      </p>

      <Drawer open={!!topic} onClose={() => setTopic(null)} title={topic ? topicName(topic, lang) : ''} eyebrow={topic && clusters[0]?.topic === topic ? t.topicBiggest : t.topicEyebrow} width={460}>
        {tc && (
          <div className="dk-ri-topic">
            <p className="dk-ri-topic-stats">
              {fill(t.topicStats, {
                n: tc.count,
                r: compact(tc.reach, lang),
                s: t[tc.sentiment].toLowerCase(),
              })}
            </p>
            <div className="dk-ri-topic-act">
              <Button
                size="sm"
                variant="primary"
                icon="search"
                onClick={() => {
                  const kw = topicName(tc.topic, lang).toLowerCase()
                  setTopic(null)
                  onDeep(kw)
                }}
              >
                {t.topicDeep}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="spark"
                onClick={() => {
                  const kw = topicName(tc.topic, lang).toLowerCase()
                  setTopic(null)
                  setAsk((a) => ({
                    open: true,
                    prompt: lang === 'id' ? `Analisis kata kunci ${kw}` : `Analyse the keyword ${kw}`,
                    n: a.n + 1,
                  }))
                }}
              >
                {t.topicAsk}
              </Button>
            </div>
            <h3 className="dk-ri-sec-t">{t.topicMentions}</h3>
            <ul className="dk-ri-mlist is-plain">
              {topicItems.map((m) => (
                <li key={m.id} className={`dk-ri-m is-${m.sentiment}`}>
                  <div className="dk-ri-m-top">
                    <span className="dk-ri-m-outlet">{m.outlet}</span>
                    <time className="dk-ri-m-time dk-num">{clockWib(m.at, lang)}</time>
                  </div>
                  <p className="dk-ri-m-text">{m.text[lang]}</p>
                  <div className="dk-ri-m-foot">
                    <span className={`dk-ri-sent is-${m.sentiment}`}>
                      <i aria-hidden="true" />
                      {t[m.sentiment]}
                    </span>
                    <span className="dk-ri-m-reach dk-num">{fill(t.reach, { n: compact(m.reach, lang) })}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>

      {clarify && phase.kind !== 'idle' && phase.kind !== 'burst' && (
        <Suspense fallback={null}>
          <Clarify open={!!clarify} mode={clarify} hoaxId={phase.alert.id} onClose={() => setClarify(null)} />
        </Suspense>
      )}
      {ask.n > 0 && (
        <Suspense fallback={null}>
          <Assistant
            key="assistant"
            open={ask.open}
            prompt={ask.prompt}
            promptKey={ask.n}
            onClose={() => setAsk((a) => ({ ...a, open: false, prompt: null }))}
            onOpenClarify={phase.kind === 'active' ? () => setClarify(head ? 'approve' : 'draft') : undefined}
          />
        </Suspense>
      )}
    </div>
  )
}
