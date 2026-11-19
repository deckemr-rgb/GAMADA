/**
 * demos/indeks-ekonomi — P16 Indeks Ekonomi Daerah · plan docs/build/tahap4-plan.md §2 P16.
 *
 * Bappeda (Peta · Sektor · Harga · Dampak · Briefing), Dinas Koperasi & UMKM (lands on Sektor + aggregate cards) and
 * Kepala Daerah (Ringkasan + compact map + "Beri instruksi pemulihan"). Every tab is a lazy chunk; only the active
 * one is fetched (Peta = the map kit + kecamatan geometry). The KPI strip and the flood strip stay on top. Every
 * number comes from world/pasar-daerah econ selectors (simulated); a kecamatan with < 10 businesses is hidden
 * everywhere. URL: ?tab= ?role= ?focus= (kecId, kecId:YYYY-MM, OP-, PW-, LN-).
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { intentProps, replaceQuery, usePreloadOnIntent, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Icon, IconButton, Kpi, KpiStrip, LoadingText, Menu, Skeleton, motionMode } from '../../demo-kit/ui'
import { clock, isEvent, rows, useClock, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { MODAL_PROGRAM_ID, econFrame, econMonths, econPulse, econSeries } from '../../demo-kit/world/pasar-daerah'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { SLUG, monthLabel, nf, rpShort, useT, type IeRole, type TabId } from './strings'
import type { View } from './types'
import './indeks-ekonomi.css'

const MODS: readonly WorldModule[] = ['pasar-daerah']

const loadPeta = () => import('./Peta')
const loadRingkasan = () => import('./Ringkasan')
const loadSektor = () => import('./Sektor')
const loadHarga = () => import('./Harga')
const loadDampak = () => import('./Dampak')
const loadBriefing = () => import('./Briefing')
const loadDrawer = () => import('./KecDrawer')
const loadAssist = () => import('./Assist')
const loadInstruct = () => import('./Instruct')
const Peta = lazy(loadPeta)
const Ringkasan = lazy(loadRingkasan)
const Sektor = lazy(loadSektor)
const Harga = lazy(loadHarga)
const Dampak = lazy(loadDampak)
const Briefing = lazy(loadBriefing)
const KecDrawer = lazy(loadDrawer)
const Assist = lazy(loadAssist)
const Instruct = lazy(loadInstruct)
const LOAD: Record<TabId, () => Promise<unknown>> = { ringkasan: loadRingkasan, peta: loadPeta, sektor: loadSektor, harga: loadHarga, dampak: loadDampak, briefing: loadBriefing }

const TABS: Record<IeRole, TabId[]> = {
  bappeda: ['peta', 'sektor', 'harga', 'dampak', 'briefing'],
  dinkop: ['peta', 'sektor', 'harga', 'dampak', 'briefing'],
  'kepala-daerah': ['ringkasan', 'peta', 'dampak', 'briefing'],
}
/** Kepala Daerah: Sektor / Harga live in the ⋯ menu */
const MORE: Record<IeRole, TabId[]> = { bappeda: [], dinkop: [], 'kepala-daerah': ['sektor', 'harga'] }
const LANDING: Record<IeRole, TabId> = { bappeda: 'peta', dinkop: 'sektor', 'kepala-daerah': 'ringkasan' }
const allowed = (r: IeRole, t: TabId) => TABS[r].includes(t) || MORE[r].includes(t)
const roleOf = (r: string): IeRole => (r === 'dinkop' || r === 'kepala-daerah' ? r : 'bappeda')

const AUTOPLAY_KEY = 'gamada:ie:autoplay'
/** the clock starts by itself on a first visit at 07:00 (×10) unless motion is reduced/off, presenter mode, or a test
 *  (?e2e=1 without &autoplay=1) */
function useAutoplay(present: boolean) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (present || motionMode() !== 'full' || (q.get('e2e') === '1' && q.get('autoplay') !== '1')) return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1200)
    return () => window.clearTimeout(tm)
  }, [present])
}

/** the newest active flood alert (inline: the flood-scenario module is fetched only on the button's click) */
const floodAlert = (s: WorldState) => rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif') ?? null

type Route = { tab: TabId; month?: string; sel?: string; program?: string; measure?: boolean; hiddenSel?: boolean } | null
/** route a ?focus= id (null = unknown) */
function route(s: WorldState, raw: string): Route {
  const months = econMonths(s)
  const latest = months[months.length - 1]!
  const tryId = (x: string): Route => {
    if (s.marketOps.byId[x]) return { tab: 'dampak', program: x, measure: true }
    if (s.loanApps.byId[x]) return { tab: 'dampak', program: MODAL_PROGRAM_ID, measure: true }
    if (s.alerts.byId[x]) {
      const k = s.alerts.byId[x]!.kecamatanIds[0]
      return { tab: 'peta', month: latest, sel: k }
    }
    const c = s.econIndex.byId[x]
    if (c && months.includes(c.month)) return { tab: 'peta', month: c.month, sel: c.kecamatanId, hiddenSel: c.businesses < 10 }
    if (s.region.kecamatan.some((k) => k.id === x)) return { tab: 'peta', month: latest, sel: x, hiddenSel: (s.econIndex.byId[`${x}:${latest}`]?.businesses ?? 0) < 10 }
    return null
  }
  const r = tryId(raw)
  if (r) return r
  const i = raw.indexOf(':')
  return i > 0 ? tryId(raw.slice(i + 1)) : null
}

export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useWorldReady(MODS)
  const shell = useShell()
  useAutoplay(shell.present)
  const { setToastPlacement } = shell
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'top-right' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])
  if (!ready) return <IeSkeleton product={product} />
  return <Ie />
}

function IeSkeleton({ product }: { product: string }) {
  const { t } = useT()
  const p = usePdStrings()
  return (
    <BrowserFrame slug={SLUG} label={t.product}>
      <div className="dk-ie dk-ie-skel" data-product={product} aria-busy="true">
        <p className="dk-ie-sr" role="status">{p.pdLoading}</p>
        <Skeleton height={44} />
        <div className="dk-ie-kpis-skel">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={92} />)}</div>
        <Skeleton height={48} />
        <div className="dk-ie-peta">
          <Skeleton height={460} radius={12} />
          <Skeleton height={460} radius={12} />
        </div>
      </div>
    </BrowserFrame>
  )
}

function readTab(role: IeRole): TabId {
  const v = new URLSearchParams(window.location.search).get('tab') as TabId | null
  return v && allowed(role, v) ? v : LANDING[role]
}

function Ie() {
  const { t } = useT()
  const shell = useShell()
  const { role: rawRole } = useSession()
  const role = roleOf(rawRole)
  const phone = shell.size === 'sm'
  const day = useWorld((s) => s.day)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableMonths = useMemo(() => econMonths(world.get()), [day])
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>(() => readTab(role))
  const [monthIdx, setMonthIdxRaw] = useState(stableMonths.length - 1)
  const [sel, setSel] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [flash, setFlash] = useState(0)
  const [program, setProgram] = useState<string>(() => (role === 'dinkop' ? MODAL_PROGRAM_ID : world.get().meta.facts.pd?.pastOpId ?? MODAL_PROGRAM_ID))
  const [measure, setMeasure] = useState(0)
  const [ask, setAsk] = useState<{ open: boolean; prompt?: string; n: number }>({ open: false, n: 0 })
  const [instr, setInstr] = useState(false)
  const askRef = usePreloadOnIntent<HTMLButtonElement>(loadAssist)

  const go = useCallback((next: TabId) => startTransition(() => setTab(next)), [])
  const setMonthIdx = useCallback((i: number) => setMonthIdxRaw(i), [])
  const pick = useCallback((id: string | null, open = true, fly = false) => {
    setSel(id)
    setDrawer(!!id && open)
    if (fly && id) setFlash((n) => n + 1)
  }, [])

  // role switch: keep tab / month / selection when allowed, else the role's landing
  const prevRole = useRef(role)
  useEffect(() => {
    if (prevRole.current === role) return
    prevRole.current = role
    if (!allowed(role, tab)) go(LANDING[role])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])
  useEffect(() => void replaceQuery({ tab: tab === LANDING[role] ? null : tab }), [tab, role])

  // ?focus= arrival
  const { focus, clearFocus, toast } = shell
  useEffect(() => {
    if (!focus) return
    const s = world.get()
    const r = route(s, focus)
    if (!r) {
      toast({ title: t.notFound, body: t.notFoundBody, tone: 'warn', icon: 'alert' })
      go(LANDING[role])
    } else {
      go(r.tab)
      const ms = econMonths(s)
      if (r.month) setMonthIdxRaw(Math.max(0, ms.indexOf(r.month)))
      if (r.sel) {
        setSel(r.sel)
        setDrawer(!r.hiddenSel && r.tab === 'peta')
        setFlash((n) => n + 1)
      }
      if (r.program) {
        setProgram(r.program)
        if (r.measure) setMeasure((n) => n + 1)
      }
    }
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, clearFocus])

  const view: View = {
    role, months: stableMonths, monthIdx, setMonthIdx, sel, pick, flash, program, setProgram, measure, go, phone,
    ask: (prompt?: string) => setAsk((a) => ({ open: true, prompt, n: a.n + 1 })),
    instruct: () => setInstr(true),
  }

  const bar = [...TABS[role], ...(MORE[role].includes(tab) ? [tab] : [])]
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = bar.indexOf(tab)
    const j = e.key === 'ArrowRight' ? (i + 1) % bar.length : e.key === 'ArrowLeft' ? (i + bar.length - 1) % bar.length : e.key === 'Home' ? 0 : e.key === 'End' ? bar.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    go(bar[j]!)
    tabRefs.current[bar[j]!]?.focus()
  }

  return (
    <BrowserFrame
      slug={SLUG}
      path={tab === LANDING[role] ? SLUG : `${SLUG}/${tab}`}
      label={t.product}
      actions={
        phone ? (
          <IconButton ref={askRef} icon="spark" label={t.askAi} onClick={() => view.ask()} aria-haspopup="dialog" data-ie="ask" />
        ) : (
          <Button ref={askRef} size="sm" variant="ghost" icon="spark" onClick={() => view.ask()} aria-haspopup="dialog" data-ie="ask">
            {t.askAi}
          </Button>
        )
      }
    >
      <div className="dk-ie" data-tab={tab} data-role={role}>
        <div className="dk-ie-bar">
          <div className="dk-ie-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKey}>
            {bar.map((k) => (
              <button
                key={k}
                ref={(el) => void (tabRefs.current[k] = el)}
                type="button"
                role="tab"
                id={`dk-ie-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="dk-ie-panel"
                tabIndex={tab === k ? 0 : -1}
                className="dk-ie-tab"
                data-tour={k === 'dampak' ? 'ie-impact-tab' : undefined}
                {...intentProps(LOAD[k])}
                onClick={() => go(k)}
              >
                {t.tabs[k]}
              </button>
            ))}
          </div>
          {MORE[role].length > 0 && (
            <span {...intentProps(() => Promise.all(MORE[role].map((k) => LOAD[k]())))}>
              <Menu label={t.more} items={MORE[role].map((k) => ({ id: k, label: t.tabs[k], onSelect: () => go(k) }))} />
            </span>
          )}
        </div>
        <KpiRow months={stableMonths} />
        <FloodStrip view={view} />
        <div id="dk-ie-panel" role="tabpanel" aria-labelledby={`dk-ie-tab-${tab}`} className="dk-ie-panel">
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            {tab === 'peta' && <Peta view={view} />}
            {tab === 'ringkasan' && <Ringkasan view={view} />}
            {tab === 'sektor' && <Sektor view={view} />}
            {tab === 'harga' && <Harga view={view} />}
            {tab === 'dampak' && <Dampak view={view} />}
            {tab === 'briefing' && <Briefing view={view} />}
          </Suspense>
        </div>
      </div>
      {drawer && sel && (
        <Suspense fallback={null}>
          <KecDrawer view={view} kecId={sel} onClose={() => setDrawer(false)} />
        </Suspense>
      )}
      {ask.open && (
        <Suspense fallback={null}>
          <Assist key={ask.n} view={view} prompt={ask.prompt} onClose={() => setAsk((a) => ({ ...a, open: false }))} />
        </Suspense>
      )}
      {instr && (
        <Suspense fallback={null}>
          <Instruct
            view={view}
            onClose={() => setInstr(false)}
            onSent={(code, href) => {
              setInstr(false)
              toast({ title: t.instructed(code), body: t.instructedBody, tone: 'accent', icon: 'checkCircle', ...(href ? { action: { label: t.openMeja, onClick: () => navigate(href) } } : {}) })
              go('briefing')
            }}
          />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ KPI strip */

function KpiRow({ months }: { months: string[] }) {
  const { t, lang } = useT()
  const now = useClock().minutes
  const econ = useWorld((s) => s.econIndex)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kab = useMemo(() => econSeries(world.get(), null), [econ])
  const latest = months.length - 1
  const ym = months[latest]!
  const frame = useWorld((s) => econFrame(s, ym))
  const pulse = useWorld((s) => econPulse(s, now))
  const cur = kab.points[latest]?.index ?? 0
  const prev = kab.points[latest - 1]?.index ?? cur
  const mName = monthLabel(lang, ym).split(' ')[0]!
  return (
    <div className="dk-ie-kpiwrap">
      <KpiStrip label={t.kpiLabel} className="dk-ie-kpis">
        <Kpi wrapLabel hero label={t.kpiIndex(mName)} value={cur} decimals={1} delta={Math.round((cur - prev) * 10) / 10} deltaFormat={(d) => nf(lang, d, 1)} deltaLabel={t.vsPrev} caption={t.kpiIndexCap} />
        <Kpi wrapLabel label={t.kpiOmzet(mName)} value={frame.omzetTotal} format={(n) => rpShort(lang, n)} caption={`${nf(lang, frame.businessesTotal)} ${lang === 'id' ? 'usaha' : 'businesses'} · ${t.sim}`} />
        <Kpi wrapLabel label={t.kpiHidden} value={frame.hidden.length} caption={t.kpiHiddenCap} />
        <Kpi wrapLabel label={t.kpiTx} value={pulse.tx} caption={pulse.revenueVisible && pulse.revenue != null ? t.kpiTxRp(rpShort(lang, pulse.revenue), pulse.panelBusinesses) : t.kpiTxHidden(pulse.panelBusinesses)} />
      </KpiStrip>
      <span className="dk-ie-sim" data-ie="kpi-sim">{lang === 'id' ? 'Data simulasi' : 'Simulated data'}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ flood strip */

function FloodStrip({ view }: { view: View }) {
  const { t } = useT()
  const alert = useWorld(floodAlert)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (alert) setBusy(false)
  }, [alert])
  if (alert)
    return (
      <button
        type="button"
        className="dk-ie-flood is-on"
        data-ie="flood-banner"
        onClick={() => {
          view.setMonthIdx(view.months.length - 1)
          const s = world.get()
          const ym = view.months[view.months.length - 1]!
          // the lowest visible alert kecamatan this month (the C35 drop)
          const k = [...alert.kecamatanIds].filter((id) => (s.econIndex.byId[`${id}:${ym}`]?.businesses ?? 0) >= 10).sort((a, b) => (s.econIndex.byId[`${a}:${ym}`]?.index ?? 0) - (s.econIndex.byId[`${b}:${ym}`]?.index ?? 0))[0]
          if (k) view.pick(k, false, true)
          view.go('peta')
        }}
      >
        <Icon name="water" size={18} />
        <span>{t.floodOn(alert.kecamatanIds.length)}</span>
        <b>{t.floodSee} →</b>
      </button>
    )
  return (
    <div className="dk-ie-flood">
      <span className="dk-ie-muted">{t.noFlood}</span>
      <Button
        size="sm"
        variant="secondary"
        icon="play"
        busy={busy}
        data-ie="play-flood"
        onClick={() => {
          setBusy(true)
          void import('../../demo-kit/world/flood-scenario').then(({ ensureFloodScenario }) => ensureFloodScenario(world.get(), clock.get().minutes))
        }}
      >
        {t.playFlood}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ guide missions (plan §2 P16) */

export const missions: readonly Mission[] = [
  {
    id: 'timelapse',
    label: { id: 'Putar time-lapse 12 bulan', en: 'Play the 12-month time-lapse' },
    hint: { id: 'Di tab Peta tekan tombol Putar di bawah peta: indeks tiap kecamatan bergerak bulan demi bulan.', en: 'On the Map tab press Play under the map: each district’s index moves month by month.' },
    target: '[data-hotspot="ie-play"]',
  },
  {
    id: 'banjir',
    label: { id: 'Lihat dampak banjir', en: 'See the flood impact' },
    hint: { id: 'Tekan "Putar skenario banjir" di bawah angka ringkasan: indeks kecamatan yang tergenang turun dan tercatat di Kejadian ekonomi.', en: 'Press "Play the flood scenario" under the summary numbers: the flooded districts’ index drops and lands in Economic events.' },
    target: '[data-ie="play-flood"]',
    done: (e) => isEvent(e, 'econ.updated') && e.source === SLUG && e.payload.kind === 'banjir',
  },
  {
    id: 'dampak',
    label: { id: 'Ukur dampak operasi pasar', en: 'Measure a market operation' },
    hint: { id: 'Tab Dampak: pilih operasi pasar beras yang sudah selesai, lalu "Ukur dampak".', en: 'Impact tab: pick the finished rice market operation, then "Measure impact".' },
    hintSm: { id: 'Tab Dampak (geser deretan tab): pilih operasi pasar, lalu "Ukur dampak".', en: 'Impact tab (swipe the tab row): pick the market operation, then "Measure impact".' },
    target: '#dk-ie-tab-dampak',
  },
  {
    id: 'briefing',
    label: { id: 'Ekspor briefing kebijakan', en: 'Export a policy briefing' },
    hint: { id: 'Tab Briefing: pilih bagian dan kecamatan, periksa pratinjau kertasnya, lalu "Ekspor".', en: 'Briefing tab: choose sections and districts, check the paper preview, then "Export".' },
    hintSm: { id: 'Tab Briefing (geser deretan tab): pilih bagian, buka pratinjau, lalu "Ekspor" di akhir.', en: 'Briefing tab (swipe the tab row): choose sections, open the preview, then "Export" at its end.' },
    target: '#dk-ie-tab-briefing',
    done: (e) => isEvent(e, 'econ.briefed') && e.source === SLUG,
  },
]

export const hotspot = { target: '[data-hotspot="ie-play"]', id: 'indeks-ekonomi-start', label: { id: 'Mulai di sini: putar 12 bulan', en: 'Start here: play 12 months' } }
