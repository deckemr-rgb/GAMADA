/**
 * demos/radar-isu/Live.tsx — "Pantauan Live" (spec P4): KPI strip, the mention stream on the world clock, topic
 * bubbles + the 24 h sentiment index, and the Hoax Alert card. Emits the false-narrative burst ("Picu skenario",
 * source radar-isu: the world raises ONE hoax.detected on the 6th post → toast to Meja Pimpinan) and, for the
 * Regional Head, an instruction to the Comms Office. Clarify and the AI analyst are lazy drawers.
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Button, Drawer, Kpi, KpiStrip, InsightCallout, Icon, LiveBadge, Segmented, motionMode } from '../../demo-kit/ui'
import { BubbleChart, LineChart, type BubbleDatum } from '../../demo-kit/viz'
import { clockWib, compact } from '../../demo-kit/viz/format'
import { useLocation, useNavigate } from 'react-router'
import { goTo } from '../../components/AppLink'
import { demoHref, useShell } from '../../demo-kit/shell'
import { clock, emit, getSession, isEvent, onEvent, useClock, useSession, useWorld, world, type Mention, type WorldState } from '../../demo-kit/world'
import { HoaxCard } from './HoaxCard'
import { Stream } from './Stream'
import { RADAR, burstPosts, hoaxPhase, radarKpis, sentimentIndex, streamOf, topicsOf, useNow, type SentRes } from './model'
import { STR, fill, topicName, useStr } from './strings'

const Clarify = lazy(() => import('./Clarify'))
const Assistant = lazy(() => import('./Assistant'))

const selMentions = (s: WorldState) => s.mentions
const selHoax = (s: WorldState) => s.hoaxAlerts
const selGauges = (s: WorldState) => s.gauges
const selMeta = (s: WorldState) => s.meta
const selRegion = (s: WorldState) => s.region
const selSeed = (s: WorldState) => s.seed
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
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

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
  const ck = useClock()
  const mentions = useWorld(selMentions)
  const hoaxAlerts = useWorld(selHoax)
  const gauges = useWorld(selGauges)
  const meta = useWorld(selMeta)
  const region = useWorld(selRegion)
  const seed = useWorld(selSeed)
  const gauge = gauges.byId[meta.facts.hoax.gaugeId]
  const damName = meta.facts.hoax.damName || gauge?.name || 'Bendungan'

  /* ---------------------------------------------------------------- derived */
  const kpis = radarKpis(mentions, now)
  const [res, setRes] = useState<SentRes>('24h')
  const series = sentimentIndex(mentions, now, res)
  const zoom = sentimentIndex(mentions, now, '3h')
  const phase = useMemo(() => hoaxPhase({ mentions, hoaxAlerts, meta }, now), [mentions, hoaxAlerts, meta, now])
  const stream = useMemo(() => streamOf(mentions, now, RADAR.streamLimit), [mentions, now])
  // bubbles move in 10-minute steps (a smooth glide, not a re-layout on every world minute at ×60)
  const nowQ = Math.floor(now / 10) * 10
  const clusters = useMemo(() => topicsOf(mentions, nowQ, 24), [mentions, nowQ])
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
  const recovery = useMemo(() => {
    if (phase.kind !== 'clarified' || !phase.alert.clarification) return null
    const at = phase.alert.clarification.at
    const sr = zoom[0] && zoom[0].at <= at ? zoom : sentimentIndex(mentions, now, '24h')
    const before = [...sr].reverse().find((p) => p.at <= at)?.value ?? 0
    return { before, after: sr[sr.length - 1]?.value ?? 0 }
  }, [phase, zoom, mentions, now])
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
  const trigger = useCallback(async () => {
    if (burst.current) return
    const s = world.get()
    const start = Math.max(0, clock.get().minutes - 25)
    burst.current = { rest: [], facts: s.meta.facts }
    const posts = await burstPosts(s, start)
    if (!posts.length || world.get().meta.facts !== s.meta.facts) {
      burst.current = null
      return
    }
    const run = { rest: [...posts], facts: s.meta.facts }
    burst.current = run
    setBursting(true)
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
    (m: Mention) =>
      setAsk((a) => ({
        open: true,
        prompt: `${lang === 'id' ? 'Nilai unggahan ini' : 'Assess this post'}: «${m.text[lang]}»`,
        n: a.n + 1,
      })),
    [lang],
  )

  const tc = topic ? clusters.find((c) => c.topic === topic) : undefined
  const topicItems = useMemo(() => (topic ? stream.filter((m) => m.topic === topic) : []), [stream, topic])

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
  const negTop = [...clusters].filter((c) => c.score < -0.2).sort((a, b) => b.count - a.count)[0]
  const sm = shell.size === 'sm'
  const wide = useWide(gridRef)
  const hoaxActive = phase.kind !== 'idle'

  const onTrigger = useCallback(() => void trigger(), [trigger])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const gaugeId = gauge?.id ?? null
  const onOpenSiaga = useCallback(() => void goTo(demoHref('siaga-wilayah', getSession(), gaugeId), navigate, pathname), [navigate, pathname, gaugeId])
  const clarAt = phase.kind === 'clarified' ? (phase.alert.clarification?.at ?? null) : null
  const onSkip = useCallback(() => {
    if (clarAt !== null) clock.setTime(Math.min(1439, clarAt + 31))
  }, [clarAt])
  const fmtSent = useCallback((n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`, [])
  const fmtReach = useCallback((n: number) => compact(n, lang), [lang])

  /* charts: memoised elements, so a stream filter / drawer / badge update does not re-render them */
  const onBubble = useCallback((d: BubbleDatum) => openTopic(d.id), [openTopic])
  const bubbleEl = useMemo(
    () => (
      <BubbleChart
        title={t.bubblesTitle}
        unit={t.bubblesUnit}
        seed={seed}
        data={bubbles}
        selectedId={topic}
        onSelect={onBubble}
        height={sm ? 260 : 300}
        className="dk-ri-bubbles"
      />
    ),
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
        target={{ value: 0, label: t.netral }}
        {...(markIdx ? { marker: markIdx } : {})}
        format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
        height={sm ? 180 : 200}
        className="dk-ri-sentchart"
      />
    ),
    [res, t, seed, sentX, sentSeries, markIdx, lang, sm],
  )

  const hoaxCard = (
    <div ref={hoaxRef} className="dk-ri-col-hoax" data-hotspot="radar-start">
      <HoaxCard
        phase={phase}
        now={now}
        role={role}
        damName={damName}
        gauge={gauge}
        recovery={recovery}
        bursting={bursting}
        instructed={instructed}
        onTrigger={onTrigger}
        onClarify={setClarify}
        onInstruct={instruct}
        onSkip={onSkip}
        onOpenSiaga={onOpenSiaga}
        compactIdle={!wide && !hoaxActive}
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
          {ck.running ? (
            <LiveBadge label={fill(t.clockRunning, { x: ck.speed })} />
          ) : (
            <Button size="sm" variant="secondary" icon="play" onClick={() => clock.play()}>
              {t.clockPlay}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon="spark" onClick={() => setAsk((a) => ({ open: true, prompt: null, n: a.n + 1 }))}>
            {t.askAi}
          </Button>
        </div>
      </header>

      {head && (
        <InsightCallout title={t.execTitle} className="dk-ri-exec">
          <p>
            {fill(t.execSent, {
              v: `${kpis.sentiment > 0 ? '+' : kpis.sentiment < 0 ? '−' : ''}${Math.abs(kpis.sentiment)}`,
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
      <KpiStrip label={t.kpiLabel} className="dk-ri-kpis">
        <Kpi label={t.kpiMentions} value={kpis.count} delta={kpis.count - kpis.prev} goodWhen="up" deltaLabel={t.vsPrev} />
        <Kpi hero label={t.kpiSentiment} value={kpis.sentiment} format={fmtSent} caption={t.kpiSentimentCap} />
        <Kpi label={t.kpiNegative} value={kpis.negTopics} />
        <Kpi label={t.kpiReach} value={kpis.reach} format={fmtReach} caption={t.kpiReachCap} />
      </KpiStrip>

      <div ref={gridRef} className="dk-ri-grid">
        {!sm && hoaxCard}
        <div className="dk-ri-col-stream">
          <Stream key={role} items={stream} initialFilter={head ? 'neg' : 'all'} onAssess={assess} />
        </div>
        <div className="dk-ri-col-mid">
          {bubbleEl}
          <div className="dk-ri-topicrow">
            <span className="dk-ri-hint">
              <Icon name="info" size={14} /> {t.bubblesHint}
            </span>
            <div className="dk-ri-chips" role="group" aria-label={t.bubblesTitle}>
              {clusters.slice(0, 6).map((c, i) => (
                <Button
                  key={c.topic}
                  size="sm"
                  variant={i === 0 ? 'secondary' : 'ghost'}
                  onClick={() => openTopic(c.topic)}
                  data-topic={c.topic}
                  aria-pressed={topic === c.topic}
                >
                  {topicName(c.topic, lang)} <span className="dk-num dk-ri-cnt">{c.count}</span>
                </Button>
              ))}
            </div>
          </div>
          {sentEl}
        </div>
      </div>
      <p className="dk-ri-foot">
        <Icon name="info" size={14} /> {t.simNote}
      </p>

      <Drawer
        open={!!topic}
        onClose={() => setTopic(null)}
        title={topic ? topicName(topic, lang) : ''}
        eyebrow={topic && clusters[0]?.topic === topic ? t.topicBiggest : t.topicEyebrow}
        width={460}
      >
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
