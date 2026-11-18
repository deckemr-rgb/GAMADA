/**
 * demos/awas-belanja — P6 Awas Belanja · Pengawas Pengadaan AI (spec §11 P6, brief docs/build/tahap2-plan.md P6).
 *
 * BrowserFrame "demo.gamada.id/awas-belanja": the package list (KPIs, flood banner, table) ⇄ the package detail
 * (lazy: header + scan, tabs HPS vs Pasar | Peserta | Pola | Laporan). Roles: UKPBJ (default) and Inspektorat change
 * the list filter + columns, the primary action, the memo letterhead and the audit trail.
 * Emits procurement.flagged / procurement.recommended (source awas-belanja); consumes flood.alert (via the
 * procurement.created reaction: the emergency pump package), match.made (local SME offers) and ?focus=<id>.
 */
import { gsap } from 'gsap'
import { Activity, Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, IconButton, LoadingText, motionMode } from '../../demo-kit/ui'
import { clock, emit, isEvent, onEvent, rows, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { floodScenarioAlert } from '../../demo-kit/world/satu-daerah'
import { STRINGS, useT } from './strings'
import { PUMP_KEY, SLUG, analyse, bareId, findPump, gapOf, isAnalysed, isOpenStage, prelimBefore, riskBand } from './model'
import List from './List'
import type { TabId } from './types'
import './awas-belanja.css'

const Detail = lazy(() => import('./Detail'))
const Assistant = lazy(() => import('./Assistant'))

const codeOf = (id: string | null) => (s: WorldState) => (id ? (s.procurements.byId[id]?.code ?? null) : null)

/**
 * The world clock drives the product (module-local timing, minutes since 00:00). Everything below is derived from
 * the world + the clock, so it is the same however the visitor arrives at a time: watching the clock run, "Lompat ke
 * 10:00", a shared ?t= link, or Back from another product (catchUp() replays every slot that is due, stamped with the
 * slot's own time):
 *  - 07:00 history check: completed packages whose 7-detector score is high are flagged (the red "pattern in past
 *    packages" line of the first screen: the same agency's ring the emergency package will meet);
 *  - screening: at 07:00 and every SCREEN_EVERY world minutes, one open package not analysed yet runs through the 7
 *    detectors (source 'clock': nobody pressed anything);
 *  - FLOOD_AT: BPBD's flood warning arrives by itself (as Siaga Wilayah would send it) if none is active yet;
 *  - PUMP_SCREEN_AFTER minutes after the emergency pump package arrives, the screening gives it a score (no detector
 *    detail: the full 7-detector analysis stays the visitor's mission).
 * At x10, one world minute is 6 s: the first screenings land within seconds and the flood after ~36 s.
 */
const SCREEN_EVERY = 2
const SCREEN_FROM = 7 * 60
const FLOOD_AT = 7 * 60 + 6
const PUMP_SCREEN_AFTER = 2
/** completed packages at or above this score are flagged by the history check */
const HISTORY_MIN = 60
/** autoplay waits for the shell to apply a link's time and the world to be ready */
const AUTOPLAY_DELAY_MS = 1500
const AUTOPLAY_KEY = 'gamada:ab:autoplay'

/** screened packages whose procurement.flagged has not been processed yet (world.get() does not show them) */
const pending = new Set<string>()

/** one open, not yet analysed package (the riskiest first) -> procurement.flagged; false when none is left */
function screenOne(at: number): boolean {
  const s = world.get()
  const next = rows(s.procurements)
    .filter((p) => isOpenStage(p) && !isAnalysed(p) && p.key !== PUMP_KEY && !pending.has(p.id))
    .map((p) => ({ p, r: analyse(s, p.id) }))
    .sort((a, b) => b.r.riskScore - a.r.riskScore || gapOf(b.p) - gapOf(a.p))[0]
  if (!next) return false
  pending.add(next.p.id)
  if (next.p.riskScore != null && !prelimBefore.has(next.p.id)) prelimBefore.set(next.p.id, next.p.riskScore)
  emit('procurement.flagged', { procurementId: next.p.id, riskScore: next.r.riskScore, findings: next.r.findings }, 'clock', { origin: SLUG, at })
  return true
}

/** open non-pump packages already screened or analysed (the screening slots used so far) */
const screenedCount = (s: WorldState) => rows(s.procurements).filter((p) => p.key !== PUMP_KEY && isOpenStage(p) && (isAnalysed(p) || pending.has(p.id))).length

type CatchUpToast = 'flood' | { pump: string; score: number } | null

/** what the clock owes the world at `now` (idempotent); returns the toast to show, if any */
function catchUp(now: number): CatchUpToast {
  if (now < SCREEN_FROM) return null
  let s = world.get()
  let toast: CatchUpToast = null
  // 07:00 history check (once per world: nothing completed is flagged yet)
  const done = rows(s.procurements).filter((p) => p.status === 'selesai')
  if (!done.some((p) => p.flagged || pending.has(p.id))) {
    for (const p of done) {
      const r = analyse(s, p.id)
      if (r.riskScore < HISTORY_MIN) continue
      pending.add(p.id)
      emit('procurement.flagged', { procurementId: p.id, riskScore: r.riskScore, findings: r.findings }, 'clock', { origin: SLUG, at: SCREEN_FROM })
    }
  }
  // screening slots (each stamped with its own time)
  const due = Math.floor((now - SCREEN_FROM) / SCREEN_EVERY) + 1
  for (let n = screenedCount(world.get()); n < due; n++) if (!screenOne(SCREEN_FROM + n * SCREEN_EVERY)) break
  // the flood warning
  s = world.get()
  if (now >= FLOOD_AT && !findPump(s) && !rows(s.alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')) {
    emit('flood.alert', floodScenarioAlert(s, FLOOD_AT, { level: 3 }), 'clock', { origin: 'siaga-wilayah', at: FLOOD_AT })
    toast = 'flood'
  }
  // the emergency package's screening score
  s = world.get()
  const pump = findPump(s)
  if (pump && pump.riskScore == null && !pending.has(pump.id) && now >= pump.createdAt + PUMP_SCREEN_AFTER) {
    const r = analyse(s, pump.id)
    pending.add(pump.id)
    emit('procurement.flagged', { procurementId: pump.id, riskScore: r.riskScore, findings: [] }, 'clock', { origin: SLUG, at: pump.createdAt + PUMP_SCREEN_AFTER })
    toast = { pump: pump.id, score: r.riskScore }
  }
  return toast
}

/** the world clock starts by itself on a first visit at 07:00 (x10), unless motion is reduced/off, the page was opened
 *  at another time (a shared ?t= link), it runs under test (?e2e=1) or it already started once this session */
function useAutoplay() {
  useEffect(() => {
    if (motionMode() !== 'full' || new URLSearchParams(window.location.search).has('e2e')) return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: autoplay once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== SCREEN_FROM) return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, AUTOPLAY_DELAY_MS)
    return () => window.clearTimeout(tm)
  }, [])
}

export default function Canvas(_props: DemoCanvasProps) {
  const { t, lang } = useT()
  const langRef = useRef(lang)
  langRef.current = lang
  const shell = useShell()
  const { role } = useSession()
  const roleKey = role === 'inspektorat' ? 'inspektorat' : 'ukpbj'
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('hps')
  const [chatOpen, setChatOpen] = useState(false)
  const [memoReq, setMemoReq] = useState(0)
  const [fresh, setFresh] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)
  const [said, setSaid] = useState('')
  const openPumpWhenReady = useRef(false)
  /** memo requests already started — per Canvas instance (a module-level counter broke after SPA re-mounts) */
  const memoHandled = useRef(0)
  /** the package that was open + where it was opened from, so Back can return focus there */
  const lastOpen = useRef<{ id: string; from: 'row' | 'banner' } | null>(null)
  const restoreFocus = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const code = useWorld(codeOf(openId))
  const [memoBusy, setMemoBusy] = useState(false)
  const toastRef = useRef(shell.toast)
  toastRef.current = shell.toast

  // toasts at the bottom edge on phones too: at the top they covered the "Coba ini" strip and the package title
  // (the shell lifts the stack to the top while a sheet is open; the sticky bar only shows after the analysis)
  const { setToastPlacement } = shell
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'bottom-left' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])

  // the world clock drives the history check, screening, the flood warning and the pump's screening score
  const openIdRef = useRef<string | null>(null)
  openIdRef.current = openId
  const openRef = useRef<(id: string) => void>(() => undefined)
  useAutoplay()
  useEffect(() => {
    const run = () => {
      const r = catchUp(clock.get().minutes)
      if (!r) return
      const L = STRINGS[langRef.current]
      if (r === 'flood') toastRef.current({ title: L.autoFloodTitle, body: L.autoFloodBody, tone: 'warn', icon: 'water' })
      else if (openIdRef.current !== r.pump) {
        const name = world.get().procurements.byId[r.pump]?.name[langRef.current] ?? ''
        const pid = r.pump
        toastRef.current({ title: L.pumpScreenTitle(r.score), body: L.pumpScreenBody(name), tone: riskBand(r.score) === 'high' ? 'danger' : 'warn', icon: 'alert', action: { label: L.screenOpen, onClick: () => openRef.current(pid) } })
      }
    }
    // shortly after the first paint (a delayed call: a StrictMode re-mount cancels the first), then on every minute
    const first = gsap.delayedCall(0.6, run)
    const off = clock.subscribe(run)
    const offFlag = onEvent('procurement.flagged', (e) => void pending.delete(e.payload.procurementId))
    // the pump package is created by the flood reaction after catchUp() returned: look again once it exists (a
    // paused clock, e.g. a ?t=10:00 link, sends no further minute)
    const later: gsap.core.Tween[] = []
    const offNew = onEvent('procurement.created', () => void later.push(gsap.delayedCall(0.05, run)))
    return () => {
      first.kill()
      off()
      offFlag()
      offNew()
      for (const c of later) c.kill()
    }
  }, [])

  // opening a package mounts the (heavy) detail: a transition keeps the click responsive (INP)
  const open = useCallback((id: string, t0: TabId = 'hps', from: 'row' | 'banner' = 'row') => {
    lastOpen.current = { id, from }
    startTransition(() => {
      setOpenId(id)
      setTab(t0)
    })
  }, [])

  openRef.current = (id: string) => open(id, 'hps', 'banner')

  // ?focus=<procurement id> (cross-product toast, Meja Pimpinan briefing)
  const { focus, clearFocus } = shell
  useEffect(() => {
    if (!focus) return
    const id = bareId(focus)
    if (world.get().procurements.byId[id]) {
      open(id)
      setArrived(true)
    }
    clearFocus()
  }, [focus, clearFocus, open])

  // the emergency pump package appears after a flood alert (reaction flood→pump-procurement)
  useEffect(
    () =>
      onEvent('procurement.created', (e) => {
        if (e.payload.key !== PUMP_KEY || !e.payload.id) return
        setFresh(e.payload.id)
        if (openPumpWhenReady.current) {
          openPumpWhenReady.current = false
          open(e.payload.id, 'hps', 'banner')
          const name = world.get().procurements.byId[e.payload.id]?.name[langRef.current]
          if (name) setSaid(STRINGS[langRef.current].autoOpened(name))
        }
      }),
    [open],
  )

  // local SME offers through Katalog Lokal (match.made) → price benchmark; tell the analyst
  const toast = shell.toast
  useEffect(
    () =>
      onEvent('*', (e) => {
        if (!isEvent(e, 'match.made')) return
        const s = world.get()
        const need = s.catalogNeeds.byId[e.payload.needId]
        if (!need?.cause?.startsWith('procurements:')) return
        const biz = s.businesses.byId[e.payload.businessId]?.name ?? e.payload.businessId
        const L = STRINGS[langRef.current]
        toast({ title: L.matchToast(biz), body: L.matchToastBody, tone: 'accent' })
      }),
    [toast],
  )

  // the open package lives in the URL (?pkg=): Back from another product returns to it, not to the list
  const pkgRestored = useRef(false)
  useEffect(() => {
    if (pkgRestored.current) return
    pkgRestored.current = true
    const id = new URLSearchParams(window.location.search).get('pkg')
    if (id && !focus && world.get().procurements.byId[id]) open(id)
  }, [focus, open])
  useEffect(() => {
    if (!pkgRestored.current) return
    const u = new URL(window.location.href)
    if ((u.searchParams.get('pkg') ?? null) === openId) return
    if (openId) u.searchParams.set('pkg', openId)
    else u.searchParams.delete('pkg')
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
  }, [openId])

  const back = useCallback(() => {
    restoreFocus.current = true
    setSaid('')
    startTransition(() => {
      setOpenId(null)
      setArrived(false)
    })
  }, [])

  // Back: focus returns to the row (or banner button) that opened the package
  useEffect(() => {
    if (openId || !restoreFocus.current) return
    restoreFocus.current = false
    const root = rootRef.current
    const last = lastOpen.current
    if (!root) return
    const row = last && last.from === 'row' ? root.querySelector<HTMLElement>(`[data-pid="${CSS.escape(last.id)}"]`)?.closest<HTMLElement>('[role="row"]') : null
    const target = row ?? root.querySelector<HTMLElement>('.dk-ab-flood .dk-btn') ?? root.querySelector<HTMLElement>('.dk-ab-h')
    target?.focus()
  }, [openId])
  // tab switches and the memo request render in a transition: the click paints at once, the (heavy) tab body follows
  const switchTab = useCallback((next: TabId) => startTransition(() => setTab(next)), [])
  const startMemo = useCallback(() => {
    startTransition(() => {
      setTab('memo')
      setMemoReq((n) => n + 1)
    })
  }, [])

  return (
    <BrowserFrame
      slug={SLUG}
      path={openId && code ? (shell.size === 'sm' ? `${SLUG}/${code}` : `${SLUG}/paket/${code}`) : SLUG}
      label={t.product}
      actions={
        shell.size === 'sm' ? (
          <IconButton icon="spark" label={t.askAi} onClick={() => setChatOpen(true)} className="dk-ab-askbtn" aria-haspopup="dialog" />
        ) : (
          <Button size="sm" variant="ghost" icon="spark" onClick={() => setChatOpen(true)} className="dk-ab-askbtn" aria-haspopup="dialog">
            {t.askAi}
          </Button>
        )
      }
    >
      <div
        ref={rootRef}
        className="dk-ab"
        data-role={roleKey}
        onPointerDownCapture={(e) => {
          if (openPumpWhenReady.current && !(e.target as Element).closest?.('[data-ab="flood-shortcut"]')) openPumpWhenReady.current = false
        }}
      >
        {/* the flood shortcut opens the pump package when it arrives, unless the visitor started something else */}
        <p className="dk-sr" role="status" aria-live="polite">
          {said}
        </p>
        {/* the open package comes first in the DOM: the shell hotspot takes the first [data-hotspot="ab-start"], which
            must be the package's "Run analysis" button, not the hidden list's banner button */}
        {openId && (
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            <Detail
              id={openId}
              tab={tab}
              onTab={switchTab}
              onBack={back}
              onSwitch={open}
              roleKey={roleKey}
              memoReq={memoReq}
              memoHandled={memoHandled}
              onRecommend={startMemo}
              memoBusy={memoBusy}
              onMemoBusy={setMemoBusy}
              arrived={arrived}
            />
          </Suspense>
        )}
        {/* the list stays mounted (hidden) while a package is open: Back is instant, and the search, the filter and
            the focus return to the same row */}
        <Activity mode={openId ? 'hidden' : 'visible'}>
          <List
            roleKey={roleKey}
            fresh={fresh}
            onOpen={open}
            onShortcut={() => {
              openPumpWhenReady.current = true
            }}
          />
        </Activity>
      </div>
      {chatOpen && (
        <Suspense fallback={null}>
          <Assistant
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            procurementId={openId}
            roleKey={roleKey}
            onOpenMemo={() => {
              setChatOpen(false)
              if (openId) startMemo()
            }}
            onOpenPackage={(id) => {
              setChatOpen(false)
              open(id)
            }}
          />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ guide missions (spec §11 P6) */

export const missions: readonly Mission[] = [
  {
    id: 'analyze-pump',
    label: { id: 'Analisis paket pompa darurat', en: 'Analyse the emergency pump package' },
    hint: {
      id: 'Paket muncul setelah peringatan banjir. Buka paketnya, lalu tekan "Jalankan analisis".',
      en: 'The package appears after a flood warning. Open it, then press "Run analysis".',
    },
    done: (e, s) => isEvent(e, 'procurement.flagged') && e.source === SLUG && s.procurements.byId[e.payload.procurementId]?.key === PUMP_KEY,
  },
  {
    id: 'find-affiliated',
    label: { id: 'Temukan peserta terafiliasi', en: 'Find the affiliated bidders' },
    hint: {
      id: 'Setelah analisis, buka tab Peserta lalu klik atau ketuk garis di antara dua perusahaan untuk melihat buktinya.',
      en: 'After the analysis, open the Bidders tab and click or tap the line between two companies to see the evidence.',
    },
  },
  {
    id: 'audit-memo',
    label: { id: 'Buat memo audit', en: 'Write the audit memo' },
    hint: {
      id: 'Tekan "Rekomendasikan koreksi" (UKPBJ) atau "Terbitkan memo audit" (Inspektorat): AI menyusun memo, usulan HPS dikirim ke PPK untuk disetujui.',
      en: 'Press "Recommend a correction" (UKPBJ) or "Issue audit memo" (Inspectorate): AI drafts the memo and the proposed HPS goes to the PPK for approval.',
    },
    done: (e) => isEvent(e, 'procurement.recommended') && e.source === SLUG,
  },
]

export const hotspot = { target: '[data-hotspot="ab-start"]', id: 'awas-belanja-start', label: { id: 'Mulai di sini', en: 'Start here' } }
