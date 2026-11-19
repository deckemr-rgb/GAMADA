/**
 * demos/meja-pimpinan — P2 Meja Pimpinan, the regional head's command center (spec §11 P2, brief tahap2-plan §2 P2).
 *
 * Desktop: a WallScreenFrame with a 12-column grid — 6 KPIs, the real regional map with layers, the self-assembling
 * "Briefing Pagi", the OPD leaderboard, today's events and "Tanya data". Phones (< 768 px): no wall frame, KPIs
 * 2-up, map 60vh, the panels as tabs; meeting mode is not offered there.
 * Everything reads the shared simulated world; the product emits `briefing.generated` and `instruction.issued`
 * (source 'meja-pimpinan') and reacts to hoaxes, clusters, alerts and market operations from the other products.
 * Lazy: chat (+ scenario + query engine + charts), scorecard, instruction dialog, meeting mode, phone view,
 * briefing voice and the Kepala OPD task list load on the user action that needs them.
 */
import { lazy, memo, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { DemoCanvasProps } from '../registry'
import type { ProductSlug } from '../../content/products'
import { dismissHotspot, useShell, type Mission } from '../../demo-kit/shell'
import { clock, emit, isEvent, rows, setSession, useClock, useSession, useWorld, world, type EntityRef, type WorldState } from '../../demo-kit/world'
import { WallScreenFrame } from '../../demo-kit/frames'
import { Button, IconButton, LiveBadge, LoadingText, Select, motionMode, useElementWidth, type TabsProps } from '../../demo-kit/ui'
import type { MapViewHandle } from '../../demo-kit/map'
import { Kpis as KpisP } from './Kpis'
import { MapPanel as MapPanelP } from './MapPanel'
import { Briefing as BriefingP } from './Briefing'
import { Leaderboard as LeaderboardP } from './Leaderboard'
import { Events as EventsP } from './Events'
import { AskBox as AskBoxP } from './AskBox'
import { MP, desaName, mpBriefingItems, useNow } from './data'
import { leaderTitle, nf, regionLabel, tr, trf, type Bi } from './strings'
import './mp.css'

/* the panels re-render from their own world / clock subscriptions; opening or closing a dialog, the assembling
   moment or a toast arrival re-renders only the canvas root (INP: a root render no longer re-renders the wall) */
const Kpis = memo(KpisP)
const MapPanel = memo(MapPanelP)
const Briefing = memo(BriefingP)
const Leaderboard = memo(LeaderboardP)
const Events = memo(EventsP)
const AskBox = memo(AskBoxP)

/* the map is the centre of the first screen: start the MapLibre engine chunk, its stylesheet and the basemap host
   connection while the world is still being generated, instead of when the MapView first mounts (it then waited for
   the world, the region pack and the panels to render first: the "map still loading 3 s after open" gap). The same
   chunk the MapView imports (MapLibre stays out of the demo budget); errors surface there, not here. */
if (typeof window !== 'undefined') {
  void Promise.all([import('../../demo-kit/map/engine'), import('maplibre-gl/dist/maplibre-gl.css')]).catch(() => {})
  if (!document.querySelector('link[data-mp-preconnect]')) {
    const l = document.createElement('link')
    l.rel = 'preconnect'
    l.href = 'https://tiles.openfreemap.org'
    l.crossOrigin = 'anonymous'
    l.dataset.mpPreconnect = ''
    document.head.appendChild(l)
  }
}

/* the tab strip exists only on phones (< 768 px): its code comes with the phone layout, fetched at once on a narrow
   window and never on the wall screen */
const loadTabs = () => import('../../demo-kit/ui/Tabs')
const Tabs = lazy(() => loadTabs().then((m) => ({ default: m.Tabs as (p: TabsProps<MobileTab>) => ReturnType<typeof m.Tabs> })))
if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767.98px)').matches) void loadTabs().catch(() => {})

const InstructionDialog = lazy(() => import('./InstructionDialog'))
const Scorecard = lazy(() => import('./Scorecard'))
const MeetingMode = lazy(() => import('./MeetingMode'))
const PhoneBriefing = lazy(() => import('./PhoneBriefing'))
const OpdTasks = lazy(() => import('./OpdTasks'))
/* the hoax banner arrives with the 10.30 hoax (or the skip chip): its code waits for that moment */
const loadHoax = () => import('./HoaxBanner')
const HoaxBanner = lazy(() => loadHoax().then((m) => ({ default: m.HoaxBanner })))

/** what "Beri instruksi" opens with (a suggestion, a briefing item, an AI draft, a market operation) */
export interface InstructionPreset {
  text?: Bi
  opdIds?: string[]
  refs?: EntityRef[]
  origin?: EntityRef
  /** a briefing item: the dialog derives the suggestion itself (keeps the suggestion code out of the first screen) */
  item?: { title: Bi; source: ProductSlug; refs: EntityRef[] }
  /** deadline preset (urgent items such as a hoax clarification: today) */
  due?: 'today' | 'tomorrow' | 'd3'
}

type Dialog = { kind: 'instruct'; preset?: InstructionPreset } | { kind: 'scorecard'; opdId: string } | { kind: 'phone' } | { kind: 'meeting' } | null
type MobileTab = 'briefing' | 'opd' | 'ask' | 'events'

/* ------------------------------------------------------------------ missions + hotspot (module contract) */

export const missions: readonly Mission[] = [
  {
    id: 'briefing',
    label: { id: 'Susun briefing pagi', en: 'Compose the morning briefing' },
    hint: { id: 'Tekan "Susun briefing": butirnya dirakit dari 6 produk lain, masing-masing bertaut ke sumbernya.', en: 'Press "Compose briefing": its items are assembled from 6 other products, each linked to its source.' },
    target: '[data-hotspot="briefing"]',
    done: (e) => isEvent(e, 'briefing.generated') && e.source === 'meja-pimpinan',
  },
  {
    id: 'listen',
    label: { id: 'Dengarkan 1 butir briefing', en: 'Listen to 1 briefing item' },
    hint: { id: 'Di panel briefing tekan "Dengarkan briefing" (di perangkat tanpa suara: "Baca bersama"): butir yang sedang dibacakan disorot.', en: 'In the briefing panel press "Listen to briefing" (on a device without a voice: "Read along"): the item being read is highlighted.' },
    target: '[data-mp="listen"]',
  },
  {
    id: 'ask',
    label: { id: 'Ajukan 1 pertanyaan data', en: 'Ask 1 data question' },
    hint: { id: 'Di "Tanya data" tekan contoh pertanyaan pertama (kategori aduan yang memang naik pekan ini), atau ketik misalnya "Berapa aduan jalan rusak bulan ini?" (boleh dengan nama kecamatan) Jawaban datang dengan grafik dan peta.', en: 'In "Ask the data" press the first example (the complaint category that really rose this week), or type e.g. "How many road complaints this month?" (a district name works too) The answer comes with a chart and the map.' },
  },
  {
    id: 'instruct',
    label: { id: 'Beri 1 instruksi', en: 'Issue 1 instruction' },
    hint: { id: 'Tekan "Beri instruksi", pilih saran AI atau tulis sendiri. Instruksi menjadi disposisi di Naskah Pintar. (Peran Kepala Daerah atau Sekretariat; Kepala OPD menerima tugasnya.)', en: 'Press "Issue instruction", pick an AI suggestion or write your own. It becomes a disposition in Naskah Pintar. (Regional head or Secretariat role; an agency head receives the task.)' },
    target: '[data-mp="instruct"]',
    done: (e) => isEvent(e, 'instruction.issued') && e.source === 'meja-pimpinan',
  },
  {
    id: 'meeting',
    label: { id: 'Buka mode rapat', en: 'Open meeting mode' },
    hint: { id: 'Tombol "Mode rapat": layar penuh, huruf besar, panel berganti tiap 15 detik.', en: 'The "Meeting mode" button: full screen, large type, panels rotate every 15 seconds.' },
    hintSm: { id: 'Mode rapat untuk layar ruang rapat: buka demo ini di tablet atau komputer (lebar ≥ 768 px).', en: 'Meeting mode is for the meeting-room screen: open this demo on a tablet or computer (≥ 768 px wide).' },
    // the button is not rendered below 768 px: phones list and complete 4 of 4
    hideSm: true,
    target: '[data-mp="meeting"]',
  },
]

/** DemoShell's default hotspot id (`${slug}:${target}`), for retiring the ring once a briefing exists */
const HOTSPOT_ID = 'meja-pimpinan:[data-hotspot="briefing"]'
export const hotspot = { target: '[data-hotspot="briefing"]', label: { id: 'Mulai di sini: briefing pagi tersusun sendiri dari 6 produk', en: 'Start here: the morning briefing assembles itself from 6 products' } }

/* ------------------------------------------------------------------ selectors */

const latestBriefing = (s: WorldState) => {
  for (const id of s.briefings.ids) {
    const b = s.briefings.byId[id]
    if (b && b.at >= 0) return b
  }
  return null
}
const activeHoax = (s: WorldState) => rows(s.hoaxAlerts).find((h) => h.status === 'aktif') ?? null

/** the time in the header: the only part of the first screen that re-renders every world minute */
function NowText() {
  const now = useNow(1)
  return <span className="dk-num">{`${String(Math.floor(now / 60)).padStart(2, '0')}.${String(now % 60).padStart(2, '0')}`}</span>
}

/** "LANGSUNG" only while the world clock runs; paused, the chip says so and one tap starts the day again */
function ClockChip() {
  const { lang } = useI18n()
  const c = useClock()
  const on = c.running && c.speed > 0
  return (
    <span className={`dk-mp-clock${on ? ' is-on' : ''}`}>
      {on ? <LiveBadge label={`${tr('live', lang)} ×${c.speed}`} /> : <span className="dk-mp-paused">{tr('paused', lang)}</span>}
      <IconButton icon={on ? 'pause' : 'play'} size="sm" variant="quiet" label={on ? tr('clockPause', lang) : tr('clockPlay', lang)} onClick={() => clock.toggle()} data-mp="clock" />
    </span>
  )
}

/** the world clock starts on its own at the demo's 07.00 start, unless motion is reduced / off, the page was opened
 *  at another time (a shared ?t= link) or the visitor already paused it this session. A fast start (×60 up to 07.30,
 *  about 30 s) puts several arrivals on screen in the first minute, then the clock settles at ×10 (unless the visitor
 *  picked a speed meanwhile). */
const FAST_UNTIL = 7 * 60 + 30
const AUTOPLAY_KEY = 'gamada:mp:autoplay'
function useAutoplay(present: boolean) {
  useEffect(() => {
    if (present || motionMode() !== 'full') return
    let done = false
    try {
      done = window.sessionStorage.getItem(AUTOPLAY_KEY) === '1'
    } catch {
      /* storage blocked: autoplay once per page load */
    }
    if (done) return
    let stop: (() => void) | null = null
    // after the shell has applied the link's time and the world is ready (its own effects run after the canvas')
    const id = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.setSpeed(60)
      clock.play()
      const un = clock.subscribe(() => {
        const k = clock.get()
        if (k.speed !== 60) return un()
        if (k.minutes >= FAST_UNTIL) {
          un()
          clock.setSpeed(10)
        }
      })
      stop = un
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => {
      window.clearTimeout(id)
      stop?.()
    }
  }, [present])
}

/** before the morning's viral hoax: one tap to the moment it lands (the jump replays every event in between) */
const SKIP_TO = 10 * 60 + 30
const warmHoax = () => void loadHoax().catch(() => {})
function SkipChip() {
  const { lang } = useI18n()
  const now = useNow(5)
  const hoaxSeen = useWorld((s) => rows(s.hoaxAlerts).some((h) => h.at >= 0 && h.at <= now))
  // half an hour before the hoax lands, fetch its banner's code
  const near = now >= SKIP_TO - 60
  useEffect(() => {
    if (near) warmHoax()
  }, [near])
  if (now >= 10 * 60 || hoaxSeen) return null
  return (
    <button type="button" className="dk-mp-skip" onClick={() => clock.setTime(SKIP_TO)} onPointerEnter={warmHoax} onPointerDown={warmHoax} onFocus={warmHoax} data-mp="skip">
      {tr('skipHoax', lang)}
    </button>
  )
}

/* ------------------------------------------------------------------ canvas */

export default function MejaPimpinan({ product }: DemoCanvasProps) {
  const { lang } = useI18n()
  const shell = useShell()
  const session = useSession()
  const role = session.role
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(rootRef)
  const phone = shell.size === 'sm'
  const wall = !phone && width >= MP.wallMinW
  const mapRef = useRef<MapViewHandle | null>(null)
  const pendingFly = useRef<(() => void) | null>(null)
  const [selKec, setSelKec] = useState<string | null>(null)
  const [dlg, setDlg] = useState<Dialog>(null)
  const [assembling, setAssembling] = useState<string[] | null>(null)
  const [fresh, setFresh] = useState(false)
  const [tab, setTab] = useState<MobileTab>('briefing')
  // phones: the tab strip answers the tap at once; the panel below follows in an interruptible render (INP)
  const shownTab = useDeferredValue(tab)
  const [note, setNote] = useState<string | null>(null)
  const isOpd = role === 'kepala-opd'
  const isSekda = role === 'sekretariat'
  const regionType = shell.pack?.type
  const leader = useMemo(() => leaderTitle(regionType), [regionType])
  const { markMission } = shell
  const onFreshDone = useCallback(() => setFresh(false), [])
  const onListened = useCallback(() => markMission('listen'), [markMission])
  const onAnswered = useCallback(() => markMission('ask'), [markMission])
  const onNoteDone = useCallback(() => setNote(null), [])
  const opdList = useWorld((s) => s.region.opd)
  const [opdScope, setOpdScope] = useState<string>(() => opdList.find((o) => o.id === 'pupr')?.id ?? opdList[0]?.id ?? '')
  const briefing = useWorld(latestBriefing)
  const hoax = useWorld(activeHoax)
  const regionName = useWorld((s) => s.region.name)
  const day = useWorld((s) => s.day)
  useAutoplay(shell.present)
  useEffect(() => {
    const go = () => {
      off()
      void import('./InstructionDialog').catch(() => {})
    }
    const opts = { passive: true, capture: true } as const
    const off = () => {
      window.removeEventListener('pointerdown', go, opts)
      window.removeEventListener('keydown', go, opts)
      window.removeEventListener('scroll', go, opts)
    }
    window.addEventListener('pointerdown', go, opts)
    window.addEventListener('keydown', go, opts)
    window.addEventListener('scroll', go, opts)
    return off
  }, [])

  /* map control (the handle may not exist yet when a focus arrives) */
  const tabsRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef(phone)
  phoneRef.current = phone
  /** phones: bring a section into view after an explicit action (never while the viewer is reading an answer) */
  const reveal = useCallback((sel: 'map' | 'tabs') => {
    if (!phoneRef.current) return
    const el = sel === 'tabs' ? tabsRef.current : rootRef.current?.querySelector('.dk-mp-map')
    window.requestAnimationFrame(() => el?.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' }))
  }, [])
  const flyTo = useCallback((kec: string, show?: boolean) => {
    if (show) reveal('map')
    setSelKec(kec)
    const go = () => mapRef.current?.fitKecamatan(kec)
    if (mapRef.current) go()
    else pendingFly.current = go
  }, [reveal])
  const onMapReady = useCallback((h: MapViewHandle) => {
    mapRef.current = h
    pendingFly.current?.()
    pendingFly.current = null
  }, [])

  /* "Susun briefing": a short assembling moment, then the world event (the panel reads the briefing back from the world) */
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])
  const composing = useRef(false)
  const compose = useCallback(() => {
    if (assembling || composing.current) return
    // INP: the click paints first; the briefing items (a pass over the whole world) and the phone tab switch follow
    composing.current = true
    window.requestAnimationFrame(() => window.setTimeout(() => {
      composing.current = false
      composeNow()
    }, 0))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembling])
  const composeNow = () => {
    const items = mpBriefingItems(world.get(), clock.get().minutes)
    const sources = [...new Set(items.map((i) => i.source))]
    const finish = () => {
      timer.current = null
      const fresh = mpBriefingItems(world.get(), clock.get().minutes)
      emit('briefing.generated', { items: fresh.map(({ title, source, refs }) => ({ title, source, refs })) }, 'meja-pimpinan')
      // the start ring has done its job (whichever button composed it: the panel, the header, "as the leader")
      dismissHotspot(HOTSPOT_ID)
      setAssembling(null)
      setFresh(true)
    }
    if (phoneRef.current) {
      setTab('briefing')
      reveal('tabs')
    }
    if (motionMode() === 'static') return finish()
    setAssembling(sources)
    timer.current = window.setTimeout(finish, Math.round(sources.length * MP.assembleTick * 1000) + 240)
  }

  /* Kepala OPD: the leader's actions (briefing, instruction, meeting mode) are one click away in the leader's role */
  /* the role switch re-renders the whole canvas and the shell: paint the pressed state first, then switch (INP) */
  const [switching, setSwitching] = useState(false)
  const composeAsLeader = useCallback(() => {
    if (switching) return
    setSwitching(true)
    window.requestAnimationFrame(() =>
      window.setTimeout(() => {
        setSession({ role: 'kepala-daerah' })
        setSwitching(false)
        compose()
      }, 0),
    )
  }, [compose, switching])

  const openInstruct = useCallback((preset?: InstructionPreset) => setDlg({ kind: 'instruct', ...(preset ? { preset } : {}) }), [])
  const openScorecard = useCallback((opdId: string) => setDlg({ kind: 'scorecard', opdId }), [])
  const close = useCallback(() => setDlg(null), [])

  /* arrivals from cross-product toasts (?focus=<entity>) */
  const { focus, clearFocus } = shell
  useEffect(() => {
    if (!focus) return
    const s = world.get()
    const cl = s.clusters.byId[focus]
    const al = s.alerts.byId[focus]
    const mo = s.marketOps.byId[focus]
    const co = s.complaints.byId[focus]
    if (cl) {
      flyTo(cl.kecamatanId)
      setNote(trf('arrivedCluster', lang, { d: `${desaName(s, cl.kecamatanId, cl.desaId)}`, n: cl.complaintIds.length }))
    } else if (al && al.kecamatanIds[0]) flyTo(al.kecamatanIds[0])
    else if (co) flyTo(co.kecamatanId)
    else if (mo) {
      const dag = s.region.opd.find((o) => o.id === 'disperindag')?.id
      const name = s.region.commodities.find((c) => c.id === mo.commodityId)?.name ?? { id: mo.commodityId, en: mo.commodityId }
      openInstruct({ text: { id: `Setujui operasi pasar ${name.id.toLowerCase()}`, en: `Approve the ${name.en.toLowerCase()} market operation` }, opdIds: dag ? [dag] : [], refs: [`marketOps:${mo.id}`], origin: `marketOps:${mo.id}` })
    }
    clearFocus()
  }, [focus, clearFocus, flyTo, openInstruct, lang])

  /* role switch to Kepala OPD on a phone: open the tasks tab */
  useEffect(() => {
    if (isOpd) setTab('briefing')
  }, [isOpd])

  const canInstruct = !isOpd
  const dateText = useMemo(() => new Date(`${day}T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [day, lang])
  const sub = isOpd ? `${tr('opdView', lang)} · ${opdList.find((o) => o.id === opdScope)?.short ?? ''}` : isSekda ? `${tr('sekdaFor', lang)} ${leader[lang]}` : `${tr('forLeader', lang)} ${leader[lang]}`
  const composeLabel = briefing ? tr('recompose', lang) : isSekda ? tr('composeSekda', lang) : tr('compose', lang)

  // fetch a dialog's code at the first sign of intent (hover, touch, keyboard focus), so the tap opens it at once
  const warm = (f: () => Promise<unknown>) => {
    const go = () => void f().catch(() => {})
    return { onPointerEnter: go, onPointerDown: go, onFocus: go }
  }

  const header = (
    <header className="dk-mp-head">
      <div className="dk-mp-titles">
        <p className="dk-mp-eyebrow">
          <span>Meja Pimpinan</span>
          <span aria-hidden="true">·</span>
          <span>{regionLabel(regionName, lang)}</span>
          {/* phones: the kit top bar carries the clock chip */}
          {!phone && <ClockChip />}
          {!isOpd && <SkipChip />}
        </p>
        <h2 className="dk-mp-title">{tr('title', lang)}</h2>
        <p className="dk-mp-sub">
          {sub} · {dateText} · <NowText /> WIB
          {phone && ` · ${tr('simData', lang)}`}
        </p>
      </div>
      <div className="dk-mp-actions">
        {isOpd && (
          <label className="dk-mp-opdpick">
            <span>{tr('opdPick', lang)}</span>
            <Select value={opdScope} onChange={(e) => setOpdScope(e.target.value)} options={opdList.map((o) => ({ value: o.id, label: o.short }))} aria-label={tr('opdPick', lang)} />
          </label>
        )}
        {/* phones: the kit top bar carries the guide pill ("Coba ini n/m") */}
        {!phone && (
          <Button variant="ghost" size="sm" icon="phone" onClick={() => setDlg({ kind: 'phone' })} {...warm(() => import('./PhoneBriefing'))}>
            {tr('phone', lang)}
          </Button>
        )}
        {!phone && (
          <Button variant="ghost" size="sm" icon="fullscreen" onClick={() => setDlg({ kind: 'meeting' })} {...warm(() => import('./MeetingMode'))} data-mp="meeting">
            {tr('meeting', lang)}
          </Button>
        )}
        {canInstruct && (
          <Button variant="secondary" size="sm" icon="send" onClick={() => openInstruct()} {...warm(() => import('./InstructionDialog'))} data-mp="instruct">
            {isSekda ? tr('instructSekda', lang) : tr('instruct', lang)}
          </Button>
        )}
        {/* desktop: the start ring sits on the empty briefing panel's button (a hint here would cover the KPI labels) */}
        {isOpd && (
          <Button variant="primary" size={phone ? 'md' : 'sm'} icon="spark" onClick={composeAsLeader} busy={switching} data-hotspot={phone ? 'briefing' : undefined}>
            {trf('composeAs', lang, { l: leader[lang] })}
          </Button>
        )}
        {canInstruct && (
          <Button variant="primary" size={phone ? 'md' : 'sm'} icon="spark" onClick={compose} busy={!!assembling} data-hotspot={phone ? 'briefing' : undefined}>
            {composeLabel}
          </Button>
        )}
      </div>
    </header>
  )

  const briefingPanel = isOpd ? (
    <Suspense fallback={<LoadingText>{tr('loading', lang)}</LoadingText>}>
      <OpdTasks opdId={opdScope} />
    </Suspense>
  ) : (
    <Briefing
      briefing={briefing}
      assembling={assembling}
      fresh={fresh}
      onFreshDone={onFreshDone}
      onCompose={compose}
      onInstruct={canInstruct ? openInstruct : undefined}
      onListened={onListened}
      leader={leader}
      hotspot={!phone}
    />
  )
  const leaderboard = <Leaderboard onOpen={openScorecard} sortDefault={isSekda ? 'late' : 'score'} highlight={isOpd ? opdScope : null} />
  const events = <Events />
  const ask = <AskBox onFly={flyTo} onInstruct={openInstruct} onAnswered={onAnswered} leader={leader[lang]} />

  const hoaxBanner = useMemo(() => (hoax ? <Suspense fallback={null}><HoaxBanner hoax={hoax} onClarify={canInstruct ? openInstruct : undefined} overlay={wall} /></Suspense> : null), [hoax, canInstruct, openInstruct, wall])
  const top = (
    <div className="dk-mp-top">
      {header}
      {!wall && hoaxBanner}
    </div>
  )

  const body = phone ? (
    <div className="dk-mp-phone">
      {top}
      <Kpis role={role} opdId={opdScope} compact />
      <MapPanel selected={selKec} onSelect={setSelKec} onReady={onMapReady} onFly={flyTo} note={note} onNoteDone={onNoteDone} opdId={isOpd ? opdScope : null} phone />
      <div ref={tabsRef} className="dk-mp-tabs">
      <Suspense fallback={<div className="dk-mp-tabbody">{briefingPanel}</div>}>
      <Tabs
        fill
        label={tr('tabsLabel', lang)}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'briefing', label: isOpd ? tr('tabTasks', lang) : tr('tabBrief', lang) },
          { id: 'opd', label: 'OPD' },
          { id: 'ask', label: tr('tabAsk', lang) },
          { id: 'events', label: tr('tabEvents', lang) },
        ]}
      >
        <div className="dk-mp-tabbody">{shownTab === 'briefing' ? briefingPanel : shownTab === 'opd' ? leaderboard : shownTab === 'ask' ? ask : events}</div>
      </Tabs>
      </Suspense>
      </div>
    </div>
  ) : (
    <WallScreenFrame label={tr('wallLabel', lang)} caption={tr('wallCaption', lang)} className={`dk-mp-wall${wall ? '' : ' is-stack'}`}>
      <div className={`dk-mp-screen${wall ? ' is-wall' : ' is-stack'}`}>
        {top}
        <Kpis role={role} opdId={opdScope} />
        <MapPanel selected={selKec} onSelect={setSelKec} onReady={onMapReady} onFly={flyTo} note={note} onNoteDone={onNoteDone} opdId={isOpd ? opdScope : null} overlay={wall ? hoaxBanner : null} />
        <div className="dk-mp-right">
          <div className="dk-mp-cell dk-mp-cell--brief">{briefingPanel}</div>
          <div className="dk-mp-cell dk-mp-cell--ask">{ask}</div>
        </div>
        <div className="dk-mp-cell dk-mp-cell--lb">{leaderboard}</div>
        <div className="dk-mp-cell dk-mp-cell--ev">{events}</div>
      </div>
    </WallScreenFrame>
  )

  return (
    <div ref={rootRef} className={`dk-mp${phone ? ' is-phone' : ''}`} data-product={product} data-role={role}>
      {body}
      <Suspense fallback={dlg ? <div className="dk-mp-dlgwait" role="status"><LoadingText>{tr('loading', lang)}</LoadingText></div> : null}>
        {dlg?.kind === 'instruct' && <InstructionDialog open onClose={close} preset={dlg.preset} />}
        {dlg?.kind === 'scorecard' && <Scorecard open onClose={close} opdId={dlg.opdId} onInstruct={canInstruct ? (opdIds) => openInstruct({ opdIds }) : undefined} />}
        {dlg?.kind === 'phone' && <PhoneBriefing open onClose={close} onCompose={canInstruct ? compose : undefined} onInstruct={canInstruct ? () => openInstruct() : undefined} leader={leader} />}
        {dlg?.kind === 'meeting' && !phone && (
          <MeetingMode
            onClose={close}
            onOpened={() => shell.markMission('meeting')}
            title={`${tr('title', lang)} · ${regionLabel(regionName, lang)}`}
            leader={leader}
          />
        )}
      </Suspense>
      <p className="dk-sr" aria-live="polite">
        {assembling ? trf('assembling', lang, { n: nf(lang, assembling.length) }) : ''}
      </p>
    </div>
  )
}
