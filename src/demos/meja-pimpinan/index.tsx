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
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { DemoCanvasProps } from '../registry'
import type { ProductSlug } from '../../content/products'
import { useShell, type Mission } from '../../demo-kit/shell'
import { clock, emit, isEvent, rows, useSession, useWorld, world, type EntityRef, type WorldState } from '../../demo-kit/world'
import { WallScreenFrame } from '../../demo-kit/frames'
import { Button, LiveBadge, LoadingText, Select, Tabs, motionMode, useElementWidth } from '../../demo-kit/ui'
import type { MapViewHandle } from '../../demo-kit/map'
import { Kpis as KpisP } from './Kpis'
import { MapPanel as MapPanelP } from './MapPanel'
import { Briefing as BriefingP } from './Briefing'
import { Leaderboard as LeaderboardP } from './Leaderboard'
import { Events as EventsP } from './Events'
import { AskBox as AskBoxP } from './AskBox'
import { HoaxBanner } from './HoaxBanner'
import { MP, desaName, mpBriefingItems, useNow } from './data'
import { leaderTitle, nf, tr, trf, type Bi } from './strings'
import './mp.css'

/* the panels re-render from their own world / clock subscriptions; opening or closing a dialog, the assembling
   moment or a toast arrival re-renders only the canvas root (INP: a root render no longer re-renders the wall) */
const Kpis = memo(KpisP)
const MapPanel = memo(MapPanelP)
const Briefing = memo(BriefingP)
const Leaderboard = memo(LeaderboardP)
const Events = memo(EventsP)
const AskBox = memo(AskBoxP)

const InstructionDialog = lazy(() => import('./InstructionDialog'))
const Scorecard = lazy(() => import('./Scorecard'))
const MeetingMode = lazy(() => import('./MeetingMode'))
const PhoneBriefing = lazy(() => import('./PhoneBriefing'))
const OpdTasks = lazy(() => import('./OpdTasks'))

/** what "Beri instruksi" opens with (a suggestion, a briefing item, an AI draft, a market operation) */
export interface InstructionPreset {
  text?: Bi
  opdIds?: string[]
  refs?: EntityRef[]
  origin?: EntityRef
  /** a briefing item: the dialog derives the suggestion itself (keeps the suggestion code out of the first screen) */
  item?: { title: Bi; source: ProductSlug; refs: EntityRef[] }
}

type Dialog = { kind: 'instruct'; preset?: InstructionPreset } | { kind: 'scorecard'; opdId: string } | { kind: 'phone' } | { kind: 'meeting' } | null
type MobileTab = 'briefing' | 'opd' | 'ask' | 'events'

/* ------------------------------------------------------------------ missions + hotspot (module contract) */

export const missions: readonly Mission[] = [
  {
    id: 'briefing',
    label: { id: 'Susun briefing pagi', en: 'Compose the morning briefing' },
    hint: { id: 'Tekan "Susun briefing": butirnya dirakit dari 6 produk lain, masing-masing bertaut ke sumbernya.', en: 'Press "Compose briefing": its items are assembled from 6 other products, each linked to its source.' },
    done: (e) => isEvent(e, 'briefing.generated') && e.source === 'meja-pimpinan',
  },
  {
    id: 'listen',
    label: { id: 'Dengarkan 1 butir briefing', en: 'Listen to 1 briefing item' },
    hint: { id: 'Di panel Briefing Pagi tekan "Dengarkan briefing": butir yang sedang dibacakan disorot.', en: 'In the Morning Briefing panel press "Listen to briefing": the item being read is highlighted.' },
  },
  {
    id: 'ask',
    label: { id: 'Ajukan 1 pertanyaan data', en: 'Ask 1 data question' },
    hint: { id: 'Di "Tanya data", misalnya: "Kenapa aduan jalan naik minggu ini?" Jawaban datang dengan grafik dan peta.', en: 'In "Ask the data", e.g. "Why are road complaints up this week?" The answer comes with a chart and the map.' },
  },
  {
    id: 'instruct',
    label: { id: 'Beri 1 instruksi', en: 'Issue 1 instruction' },
    hint: { id: 'Tekan "Beri instruksi", pilih saran AI atau tulis sendiri. Instruksi menjadi disposisi di Naskah Pintar.', en: 'Press "Issue instruction", pick an AI suggestion or write your own. It becomes a disposition in Naskah Pintar.' },
    done: (e) => isEvent(e, 'instruction.issued') && e.source === 'meja-pimpinan',
  },
  {
    id: 'meeting',
    label: { id: 'Buka mode rapat', en: 'Open meeting mode' },
    hint: { id: 'Tombol "Mode rapat": layar penuh, huruf besar, panel berganti tiap 15 detik.', en: 'The "Meeting mode" button: full screen, large type, panels rotate every 15 seconds.' },
    hintSm: { id: 'Mode rapat untuk layar ruang rapat: buka demo ini di tablet atau komputer (lebar ≥ 768 px).', en: 'Meeting mode is for the meeting-room screen: open this demo on a tablet or computer (≥ 768 px wide).' },
    // the button is not rendered below 768 px: phones list and complete 4 of 4
    hideSm: true,
  },
]

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
  const compose = useCallback(() => {
    if (assembling) return
    const items = mpBriefingItems(world.get(), clock.get().minutes)
    const sources = [...new Set(items.map((i) => i.source))]
    const finish = () => {
      timer.current = null
      const fresh = mpBriefingItems(world.get(), clock.get().minutes)
      emit('briefing.generated', { items: fresh.map(({ title, source, refs }) => ({ title, source, refs })) }, 'meja-pimpinan')
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
  }, [assembling, reveal])

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

  const preload = (f: () => Promise<unknown>) => () => void f().catch(() => {})

  const header = (
    <header className="dk-mp-head">
      <div className="dk-mp-titles">
        <p className="dk-mp-eyebrow">
          <span>Meja Pimpinan</span>
          <span aria-hidden="true">·</span>
          <span>{regionName}</span>
          <LiveBadge />
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
        <Button variant="ghost" size="sm" icon="phone" onClick={() => setDlg({ kind: 'phone' })} onPointerEnter={preload(() => import('./PhoneBriefing'))}>
          {tr('phone', lang)}
        </Button>
        {!phone && (
          <Button variant="ghost" size="sm" icon="fullscreen" onClick={() => setDlg({ kind: 'meeting' })} onPointerEnter={preload(() => import('./MeetingMode'))} data-mp="meeting">
            {tr('meeting', lang)}
          </Button>
        )}
        {canInstruct && (
          <Button variant="secondary" size="sm" icon="send" onClick={() => openInstruct()} onPointerEnter={preload(() => import('./InstructionDialog'))} data-mp="instruct">
            {isSekda ? tr('instructSekda', lang) : tr('instruct', lang)}
          </Button>
        )}
        {canInstruct &&
          (phone ? (
            <div className="dk-mp-cta" data-hotspot="briefing">
              <Button variant="primary" size="sm" icon="spark" onClick={compose} busy={!!assembling}>
                {composeLabel}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" icon="spark" onClick={compose} busy={!!assembling} data-hotspot={briefing ? 'briefing' : undefined}>
              {composeLabel}
            </Button>
          ))}
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

  const hoaxBanner = useMemo(() => (hoax ? <HoaxBanner hoax={hoax} onClarify={canInstruct ? openInstruct : undefined} overlay={wall} /> : null), [hoax, canInstruct, openInstruct, wall])
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
      <Tabs<MobileTab>
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
        <div className="dk-mp-tabbody">{tab === 'briefing' ? briefingPanel : tab === 'opd' ? leaderboard : tab === 'ask' ? ask : events}</div>
      </Tabs>
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
      <Suspense fallback={null}>
        {dlg?.kind === 'instruct' && <InstructionDialog open onClose={close} preset={dlg.preset} />}
        {dlg?.kind === 'scorecard' && <Scorecard open onClose={close} opdId={dlg.opdId} onInstruct={canInstruct ? (opdIds) => openInstruct({ opdIds }) : undefined} />}
        {dlg?.kind === 'phone' && <PhoneBriefing open onClose={close} onCompose={canInstruct ? compose : undefined} onInstruct={canInstruct ? () => openInstruct() : undefined} leader={leader} />}
        {dlg?.kind === 'meeting' && !phone && (
          <MeetingMode
            onClose={close}
            onOpened={() => shell.markMission('meeting')}
            title={`${tr('title', lang)} · ${regionName}`}
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
