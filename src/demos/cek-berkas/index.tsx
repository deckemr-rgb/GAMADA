/**
 * demos/cek-berkas — P7 Cek Berkas: Verifikasi Dokumen Otomatis (spec §11 P7, plan docs/build/tahap2-plan.md P7).
 *
 * BrowserFrame with two modes: Satu Berkas (gallery of SPESIMEN documents → OCR boxes in sequence, fields with
 * confidence, consistency checks, tamper heatmap, verdict) and Massal (lazy: 50 flood-aid applicant files in ≈ 8 s,
 * duplicate-NIK lines, addresses checked against the Siaga Wilayah zone, CSV export). Roles: Loket Perizinan
 * (default, Satu Berkas, permit files) and Dinsos (Massal first, aid files incl. house photos).
 * Emits `document.verified` (source cek-berkas); consumes `flood.alert` → `eligibility.opened` (quota banner + zone).
 */
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { demoHref, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Drawer, Icon, LoadingText, motionMode, Segmented, useCountUp } from '../../demo-kit/ui'
import { clock, emit, hhmm, onEvent, rows, shallowEqual, useClock, useNaturalEvents, useSession, useWorld, world, type AuditEntry, type Program, type WorldState } from '../../demo-kit/world'
import { useI18n, type Lang } from '../../lib/i18n'
import { asRole, bulkLog, DEFAULT_MODE, GALLERY, HOTSPOT_ID, pad2, resumeSession, saveWorldNow, sessionLog, type BulkRun, type CekRole, type Mode } from './model'
import { STR } from './strings'
import Single from './Single'
import './cek-berkas.css'

// memoised: a tab press re-renders the canvas root, never the (large) mode subtrees
const SingleMode = memo(Single)
const loadBulk = () => import('./Bulk')
const Bulk = lazy(() => loadBulk().then((m) => ({ default: memo(m.default) })))
/** the mode tab the visitor pressed (the heavy `mode` subtree follows one paint later) */
let tabNow: Mode = 'single'
const tabSubs = new Set<() => void>()
const tabStore = {
  get: (): Mode => tabNow,
  /** the root's first render: no subscriber to tell yet */
  init(m: Mode): void {
    tabNow = m
  },
  set(m: Mode): void {
    if (m === tabNow) return
    tabNow = m
    tabSubs.forEach((f) => f())
  },
  sub(f: () => void): () => void {
    tabSubs.add(f)
    return () => void tabSubs.delete(f)
  },
}
const useTab = () => useSyncExternalStore(tabStore.sub, tabStore.get, tabStore.get)

const Head = memo(function Head({ lang, role, onMode, onIntent }: { lang: Lang; role: CekRole; onMode: (m: Mode) => void; onIntent: (m: Mode) => void }) {
  const t = STR[lang]
  const tab = useTab()
  return (
    <header className="dk-cb-head">
      <div className="dk-cb-title">
        <h2>
          <Icon name="shield" size={18} />
          {tab === 'single' ? t.single : t.bulk}
        </h2>
        <p className="dk-cb-value">{t.value[tab]}</p>
        <Proof lang={lang} />
        <p className="dk-cb-role">{t.roleNote[role]}</p>
        <p className="dk-cb-lead">{t.lead[tab]}</p>
      </div>
      <Segmented<Mode>
        label={t.modes}
        value={tab}
        onChange={onMode}
        onIntent={onIntent}
        options={[
          { value: 'single', label: t.single, icon: 'doc' },
          { value: 'bulk', label: t.bulk, icon: 'layers', hook: 'cb-bulk' },
        ]}
      />
    </header>
  )
})

// the canvas root's other parts only read lang / role: a mode-tab press leaves them alone (INP)
const ClockDriver = memo(ClockDriverView)
const Proof = memo(ProofView)
const Connected = memo(ConnectedView)
const Stats = memo(StatsView)

/* ------------------------------------------------------------------ module exports for DemoShell */

export const missions: readonly Mission[] = [
  {
    id: 'verify-ktp',
    label: { id: 'Verifikasi 1 KTP spesimen', en: 'Verify one specimen ID card' },
    hint: { id: 'Pilih KTP di galeri, lalu tekan “Verifikasi berkas”.', en: 'Pick an ID card in the gallery, then press “Verify file”.' },
  },
  {
    id: 'find-edited',
    label: { id: 'Temukan dokumen yang diedit', en: 'Find the edited document' },
    hint: { id: 'Pilih “KTP · sengaja diedit”: peta panas menyala dan hasilnya Perlu Cek Manual.', en: 'Pick “ID card · deliberately edited”: the heatmap lights up and the result is Needs manual check.' },
  },
  {
    id: 'ask-ai',
    label: { id: 'Tanya AI soal hasil pemeriksaan', en: 'Ask the AI about a check result' },
    hint: { id: 'Setelah satu berkas selesai, tekan “Tanya AI tentang berkas ini”.', en: 'After a file is checked, press “Ask AI about this file”.' },
  },
  {
    id: 'bulk',
    label: { id: 'Jalankan verifikasi massal', en: 'Run the bulk verification' },
    hint: { id: 'Buka mode Massal, lalu proses 50 berkas pendaftar bansos banjir.', en: 'Open Bulk mode, then process the 50 flood-aid applicant files.' },
  },
  {
    id: 'export',
    label: { id: 'Ekspor hasil massal ke CSV', en: 'Export the bulk result as CSV' },
    hint: { id: 'Setelah massal selesai, tekan “Ekspor CSV”.', en: 'After the bulk run, press “Export CSV”.' },
  },
]

// the kit places the label beside the target (never over the CTA text); a gallery pick retires it (Single.select)
export const hotspot = { target: '[data-hotspot="cek-go"]', id: HOTSPOT_ID, label: { id: 'Mulai di sini', en: 'Start here' } }

/* ------------------------------------------------------------------ selectors */

const openProgram = (s: WorldState): Program | null => rows(s.programs).find((p) => p.open && p.kind === 'bansos-banjir') ?? null
const deskCounts = (s: WorldState) => {
  let waiting = 0
  let applicants = 0
  for (const id of s.documents.ids) {
    const d = s.documents.byId[id]
    if (!d) continue
    if (d.program === 'perizinan' && d.status === 'baru') waiting++
    if (d.program === 'bansos-banjir' && d.kind === 'ktp') applicants++
  }
  return { waiting, applicants }
}
const kecNames = (s: WorldState) => s.region.kecamatan

function useSessionLog() {
  return useSyncExternalStore(sessionLog.subscribe, sessionLog.get, sessionLog.get)
}
function useBulkLog() {
  return useSyncExternalStore(bulkLog.subscribe, bulkLog.get, bulkLog.get)
}

/* ------------------------------------------------------------------ the world clock drives the desk (simulated) */

/** scenario: the Siaga Wilayah flood warning is issued at 07:20 when nobody sent one by hand */
const AUTO_ALERT_AT = 7 * 60 + 20
const DAY_START = 7 * 60
const DESK_KINDS = { id: ['KTP', 'KK', 'NIB', 'Surat domisili'], en: ['ID card', 'Family card', 'NIB', 'Domicile letter'] } as const
/** new files reaching the licensing desk: one slot every 10 world minutes from 07:05, 1–2 files per slot (simulated) */
const SLOT0 = DAY_START + 5
const slotFiles = (k: number) => (k % 3 === 1 ? 2 : 1)
function arrivalsBy(minute: number): number {
  let n = 0
  for (let k = 0, m = SLOT0; m <= minute && m < 16 * 60; k++, m += 10) n += slotFiles(k)
  return n
}
/** the other desk officers clear each new file about 25 world minutes after it arrives (simulated throughput), so
 *  the queue hovers around a handful of files all day instead of piling up */
const CLEAR_AFTER = 25
const clearedBy = (minute: number): number => arrivalsBy(minute - CLEAR_AFTER)

/** "Tonton kuota dibuka": jump to 07:15 and play at ×60; once the quota opens the clock drops back to ×10 */
const JUMP_TO = 7 * 60 + 15
let fastToQuota = false
function watchQuota() {
  fastToQuota = true
  if (clock.get().minutes < JUMP_TO) clock.setTime(JUMP_TO)
  clock.setSpeed(60)
  clock.play()
}

/** the world clock starts on its own at the demo's 07.00 start (×10, as Meja Pimpinan does), unless motion is
 *  reduced / off, the page was opened at another time (?t=), a test drives it (?e2e=1) or it already ran this tab */
const AUTOPLAY_KEY = 'gamada:cb:autoplay'
function useAutoplay(present: boolean) {
  useEffect(() => {
    if (present || motionMode() !== 'full') return
    if (new URLSearchParams(window.location.search).get('e2e') === '1') return
    let done = false
    try {
      done = window.sessionStorage.getItem(AUTOPLAY_KEY) === '1'
    } catch {
      /* storage blocked: autoplay once per page load */
    }
    if (done) return
    const id = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== DAY_START || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => window.clearTimeout(id)
  }, [present])
}

/** Mounted with the canvas: the clock opens the bansos quota at 07:20 (scenario warning, natural events on) and
 *  announces new desk files while it runs. Renders nothing. */
function ClockDriverView({ lang }: { lang: Lang }) {
  const { minutes } = useClock()
  const natural = useNaturalEvents()
  const shell = useShell()
  const fired = useRef(false)
  useEffect(() => {
    if (!natural || fired.current || minutes < AUTO_ALERT_AT) return
    fired.current = true
    const s = world.get()
    // a warning or programme already exists (sent by hand in Siaga Wilayah, or earlier): nothing to do
    if (rows(s.alerts).some((a) => a.kind === 'banjir') || rows(s.programs).some((p) => p.kind === 'bansos-banjir')) return
    // the same payload the Siaga Wilayah flow emits; a background event of the clock in Siaga Wilayah's domain.
    // satu-daerah loads here (after a clock step), never with the first paint
    void import('../../demo-kit/world/satu-daerah').then(({ floodScenarioAlert }) => {
      const now = world.get()
      if (rows(now.alerts).some((a) => a.kind === 'banjir') || rows(now.programs).some((p) => p.kind === 'bansos-banjir')) return
      emit('flood.alert', floodScenarioAlert(now, AUTO_ALERT_AT, { level: 3 }), 'clock', { at: AUTO_ALERT_AT, origin: 'siaga-wilayah' })
    })
  }, [minutes, natural])

  // "Tonton kuota dibuka" played ×60 up to the quota: back to the calm default speed once it is open
  useEffect(() => {
    if (fastToQuota && minutes >= AUTO_ALERT_AT + 1) {
      fastToQuota = false
      if (clock.get().speed === 60) clock.setSpeed(10)
    }
  }, [minutes])

  // desk arrivals: a small toast while the clock runs (never for jumps), at most one per 12 s
  const last = useRef(0)
  const t = STR[lang]
  useEffect(
    () =>
      clock.onMinute((m) => {
        if (m < SLOT0 || m >= 16 * 60 || (m - SLOT0) % 10 !== 0) return
        const k = (m - SLOT0) / 10
        const n = slotFiles(k)
        const now = performance.now()
        if (now - last.current < 12000) return
        last.current = now
        const before = arrivalsBy(m - 1)
        const kinds = Array.from({ length: n }, (_, i) => DESK_KINDS[lang][(before + i) % DESK_KINDS[lang].length]!).join(' · ')
        shell.toast({ title: t.arrivalTitle(n), body: t.arrivalBody(kinds), tone: 'neutral', icon: 'doc' })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  )
  return null
}

/* ------------------------------------------------------------------ canvas */

const MODE_KEY = 'gamada:cb:mode'
function readMode(): Mode | null {
  try {
    const m = window.sessionStorage.getItem(MODE_KEY)
    return m === 'bulk' || m === 'single' ? m : null
  } catch {
    return null
  }
}
function saveMode(m: Mode) {
  try {
    window.sessionStorage.setItem(MODE_KEY, m)
  } catch {
    /* ignore */
  }
}

export default function CekBerkas({ product }: DemoCanvasProps) {
  const { lang } = useI18n()
  const t = STR[lang]
  const shell = useShell()
  const session = useSession()
  const role = asRole(session.role)
  // a mount keeps this tab's session (a hop to another product and back) unless the world was reset; runs before the
  // first render so the KPI strip and the bulk result come back at once (and Massal reopens when it was left there)
  const [resumed] = useState(() => {
    resumeSession(world.get())
    return !!bulkLog.get() && readMode() === 'bulk'
  })
  // `tab` answers the click at once (segmented control); `mode` swaps the heavy subtree one paint later (INP)
  const [mode, setModeNow] = useState<Mode>(() => (resumed ? 'bulk' : DEFAULT_MODE[role]))
  // the tab lives in a tiny store: a press re-renders only the header + banner, never the canvas root (INP)
  useState(() => tabStore.init(mode))
  const swap = useRef(0)
  const setMode = useCallback((m: Mode) => {
    tabStore.set(m)
    saveMode(m)
    const id = ++swap.current
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (swap.current === id) setModeNow(m)
      }, 0),
    )
  }, [])
  const [pick, setPick] = useState<string>(() => GALLERY[role][0]!)
  const [focusDoc, setFocusDoc] = useState<string | null>(null)
  const program = useWorld(openProgram)

  useAutoplay(session.present)


  // role switch → that role's default mode and gallery
  const lastRole = useRef(role)
  useEffect(() => {
    if (lastRole.current === role) return
    lastRole.current = role
    setMode(DEFAULT_MODE[role])
    setPick(GALLERY[role][0]!)
  }, [role, setMode])

  // ?focus=<id> from a cross-product toast / briefing: a programme or applicant file → Massal, a sample → Satu Berkas
  const { focus, clearFocus } = shell
  useEffect(() => {
    if (!focus) return
    if (GALLERY.perizinan.includes(focus) || GALLERY.dinsos.includes(focus)) {
      setMode('single')
      setPick(focus)
    } else {
      setMode('bulk')
      setFocusDoc(focus)
    }
    clearFocus()
  }, [focus, clearFocus, setMode])

  const onMode = setMode
  const onBulk = useCallback(() => setMode('bulk'), [setMode])
  const onFocusDone = useCallback(() => setFocusDoc(null), [])
  const [seen, setSeen] = useState<Mode[]>(() => [mode])
  useEffect(() => setSeen((s) => (s.includes(mode) ? s : [...s, mode])), [mode])

  // Massal is fetched on intent (pointer over / focus on / touch of its tab, never at open: size limit) and then
  // rendered hidden in idle time, so the press itself only swaps visibility (INP)
  const warmed = useRef(false)
  const onIntent = useCallback((v: Mode) => {
    if (v !== 'bulk' || warmed.current) return
    warmed.current = true
    void loadBulk().then(() => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      const show = () => setSeen((s) => (s.includes('bulk') ? s : [...s, 'bulk']))
      if (w.requestIdleCallback) w.requestIdleCallback(show, { timeout: 1500 })
      else window.setTimeout(show, 200)
    }, () => {
      warmed.current = false
    })
  }, [])

  return (
    <BrowserFrame path={`${product}/${mode === 'single' ? 'satu-berkas' : 'massal'}`} label={t.frame} className="dk-cb-frame">
      <ClockDriver lang={lang} />
      <div className="dk-cb" data-mode={mode}>
        <Head lang={lang} role={role} onMode={onMode} onIntent={onIntent} />

        <div className="dk-cb-status">
          <ProgramBanner program={program} lang={lang} role={role} onOpen={onBulk} />
          <Stats role={role} lang={lang} />
        </div>

        {/* a visited mode stays mounted (hidden): a running bulk batch keeps going, and the shell's hotspot ring
            never points at a detached element */}
        {seen.includes('single') && (
          <div hidden={mode !== 'single'}>
            <SingleMode role={role} pick={pick} onPick={setPick} />
          </div>
        )}
        {seen.includes('bulk') && (
          <div hidden={mode !== 'bulk'}>
            <Suspense fallback={<LoadingText>{lang === 'id' ? 'Memuat mode massal…' : 'Loading bulk mode…'}</LoadingText>}>
              <Bulk role={role} active={mode === 'bulk'} focusDoc={focusDoc} onFocusDone={onFocusDone} />
            </Suspense>
          </div>
        )}

        <Connected lang={lang} />

        <p className="dk-cb-foot">
          <Icon name="info" size={14} />
          {t.specimenNote}
        </p>
      </div>
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ the session's real numbers under the value line */

function ProofView({ lang }: { lang: Lang }) {
  const t = STR[lang]
  const log = useSessionLog()
  const bulk = useBulkLog()
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const parts: string[] = []
  if (bulk) parts.push(t.proofBulk(bulk.summary.total, (bulk.ms / 1000).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), bulk.summary.gandaPairs))
  const edited = new Set(log.filter((r) => r.tampered && r.verdict === 'cek-manual').map((r) => r.docId)).size
  if (edited) parts.push(t.proofEdited(edited))
  else if (log.length && !bulk) parts.push(t.proofSingle(log.length))
  if (!parts.length) return null
  return (
    <p className="dk-cb-proof" role="status">
      <Icon name="checkCircle" size={14} />
      <span>
        <b>{t.proofLabel}:</b> {parts.join(' · ')}
      </span>
    </p>
  )
}

/* ------------------------------------------------------------------ cross-product links (what really flows in and out) */

function ConnectedView({ lang }: { lang: Lang }) {
  const t = STR[lang]
  const session = useSession()
  const [audit, setAudit] = useState(false)
  return (
    <section className="dk-cb-links" aria-label={t.linksTitle}>
      <h3>{t.linksTitle}</h3>
      <ul>
        <li>
          <a href={demoHref('siaga-wilayah', session)} onClick={saveWorldNow}>
            <Icon name="water" size={16} />
            <span>
              <b>Siaga Wilayah</b>
              <small>{t.linkSiaga}</small>
            </span>
            <Icon name="arrowRight" size={14} />
          </a>
        </li>
        <li>
          <a href={demoHref('meja-pimpinan', session)} onClick={saveWorldNow}>
            <Icon name="chart" size={16} />
            <span>
              <b>Meja Pimpinan</b>
              <small>{t.linkMeja}</small>
            </span>
            <Icon name="arrowRight" size={14} />
          </a>
        </li>
        <li>
          <button type="button" onClick={() => setAudit(true)} aria-haspopup="dialog">
            <Icon name="shield" size={16} />
            <span>
              <b>{lang === 'id' ? 'Log audit' : 'Audit log'}</b>
              <small>{t.linkAudit}</small>
            </span>
            <Icon name="arrowRight" size={14} />
          </button>
        </li>
      </ul>
      <Drawer open={audit} onClose={() => setAudit(false)} title={t.auditTitle} eyebrow={t.simLabel} width={440}>
        {audit && <AuditList lang={lang} />}
      </Drawer>
    </section>
  )
}

const AUDIT_MAX = 60
const auditRows = (s: WorldState) => s.auditLog
const docProgram = (s: WorldState) => s.documents.byId

/** the world's audit row in the words of the grid and the CSV: "#01 · DK-0011 · Sulastri … · Luar zona + Kurang" */
function auditLabel(e: AuditEntry, lang: Lang, run: BulkRun | null): string {
  const t = STR[lang]
  if (e.type !== 'document.verified') return e.summary[lang]
  const doc = /\b(DK-\d+)\b/.exec(e.summary.id)?.[1] ?? null
  const status = /:\s*(lengkap|kurang|cek-manual)\b/i.exec(e.summary.id)?.[1]?.toLowerCase() ?? null
  if (!doc) return e.summary[lang]
  const f = run?.files[doc]
  if (f) {
    const findings = f.findings.length ? f.findings.map((x) => t.result[x]).join(' + ') : t.result.lolos!
    const pair = f.pairNos.length ? ` = #${f.pairNos.map(pad2).join(', #')}` : ''
    return `#${pad2(f.n)} · ${doc} · ${f.name} · ${findings}${pair}`
  }
  return status ? t.auditVerified(doc, t.auditStatus[status] ?? status) : e.summary[lang]
}

type AuditItem = { kind: 'one'; e: AuditEntry } | { kind: 'bulk'; key: string; at: number; items: AuditEntry[] }

function AuditList({ lang }: { lang: Lang }) {
  const t = STR[lang]
  const log = useWorld(auditRows)
  const docs = useWorld(docProgram)
  const run = useBulkLog()
  const shell = useShell()
  const mine = useMemo(() => rows(log).filter((e) => e.source === 'cek-berkas' || (e.source === 'clock' && e.type === 'flood.alert')).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id)), [log])
  // a bulk run writes one row per file in the same minute: shown as one expandable row (the 50 rows inside)
  const items = useMemo(() => {
    const out: AuditItem[] = []
    for (const e of mine) {
      const doc = e.type === 'document.verified' ? /\b(DK-\d+)\b/.exec(e.summary.id)?.[1] : undefined
      const bansos = !!doc && docs[doc]?.program === 'bansos-banjir'
      const last = out[out.length - 1]
      if (bansos && last?.kind === 'bulk' && last.at === e.at) last.items.push(e)
      else if (bansos) out.push({ kind: 'bulk', key: e.id, at: e.at, items: [e] })
      else out.push({ kind: 'one', e })
    }
    // a lone applicant check stays a plain row
    return out.map((x): AuditItem => (x.kind === 'bulk' && x.items.length < 5 ? { kind: 'one', e: x.items[0]! } : x))
  }, [mine, docs])
  const flat = useMemo(() => items.flatMap((x) => (x.kind === 'one' ? [x.e] : x.items)), [items])
  const exportLog = () => {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const head = lang === 'id' ? ['# DATA SIMULASI · log audit demo GAMADA, bukan log resmi.', 'waktu,entri,ringkasan,sumber'] : ['# SIMULATED DATA · GAMADA demo audit log, not an official log.', 'time,entry,summary,source']
    const lines = flat.map((e) => [hhmm(e.at), e.id, auditLabel(e, lang, run), e.source === 'clock' ? 'Siaga Wilayah (jam dunia)' : 'Cek Berkas'].map(q).join(','))
    const blob = new Blob([String.fromCharCode(0xfeff), [...head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = lang === 'id' ? 'cek-berkas-log-audit-simulasi.csv' : 'cek-berkas-audit-log-simulated.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    shell.toast({ title: t.auditExport, body: t.auditExported, tone: 'accent', icon: 'download' })
  }
  let shown = 0
  return (
    <div className="dk-cb-audit">
      <p className="dk-cb-audit-lead">{t.auditLead}</p>
      {items.length === 0 ? (
        <p className="dk-cb-audit-empty">{t.auditEmpty}</p>
      ) : (
        <>
          <Button size="sm" variant="secondary" icon="download" onClick={exportLog} className="dk-cb-audit-x">
            {t.auditExport}
          </Button>
          <ol>
            {items.map((x) => {
              if (shown >= AUDIT_MAX) return null
              if (x.kind === 'one') {
                shown++
                return (
                  <li key={x.e.id}>
                    <span className="dk-cb-audit-m dk-num">
                      {hhmm(x.e.at)} · {x.e.id}
                    </span>
                    <span>{auditLabel(x.e, lang, run)}</span>
                  </li>
                )
              }
              shown++
              const files = x.items.map((e) => run?.files[/\b(DK-\d+)\b/.exec(e.summary.id)?.[1] ?? ''])
              const known = files.every(Boolean)
              const c = (k: string) => files.filter((f) => f && (k === 'lolos' ? !f.findings.length : f.findings.includes(k as never))).length
              const sorted = [...x.items].sort((a, b) => a.id.localeCompare(b.id))
              return (
                <li key={x.key} className="is-bulk">
                  <details>
                    <summary>
                      <span className="dk-cb-audit-m dk-num">
                        {hhmm(x.at)} · {sorted[0]!.id}–{sorted[sorted.length - 1]!.id}
                      </span>
                      <span>
                        <b>{t.auditBulk(x.items.length)}</b>
                        {known && <> · {t.auditBulkParts(c('lolos'), c('kurang'), c('ganda'), c('luar-zona'))}</>}
                      </span>
                    </summary>
                    <ol>
                      {sorted.map((e) => (
                        <li key={e.id}>
                          <span className="dk-cb-audit-m dk-num">{e.id}</span>
                          <span>{auditLabel(e, lang, run)}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </li>
              )
            })}
          </ol>
        </>
      )}
      {items.length > AUDIT_MAX && <p className="dk-cb-audit-empty">{t.auditMore(items.length - AUDIT_MAX)}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ programme banner (consumes eligibility.opened) */

function ProgramBanner({ program, lang, role, onOpen }: { program: Program | null; lang: Lang; role: CekRole; onOpen: () => void }) {
  const mode = useTab()
  const t = STR[lang]
  const session = useSession()
  const kec = useWorld(kecNames)
  const shell = useShell()
  const [fresh, setFresh] = useState(false)

  // a flood warning issued while this page is open: the banner arrives with an accent flash + a toast
  useEffect(
    () =>
      onEvent('eligibility.opened', (e) => {
        setFresh(true)
        shell.toast({
          title: t.quotaOpen,
          body: lang === 'id' ? `Kuota ${e.payload.quota.toLocaleString('id-ID')} KK · ${e.payload.kecamatanIds.length} kecamatan` : `Quota ${e.payload.quota.toLocaleString('en-US')} households · ${e.payload.kecamatanIds.length} districts`,
          tone: 'accent',
          icon: 'users',
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  )

  if (!program) {
    return (
      <div className="dk-cb-banner is-idle" role="note">
        <Icon name="info" size={16} />
        <div>
          <b>{role === 'dinsos' ? t.noProgramDinsos : t.noProgram}</b> <span className="dk-cb-banner-long">{role === 'dinsos' ? t.noProgramDinsosBody : t.noProgramBody}</span>
          <span className="dk-cb-banner-short">{t.noProgramShort}</span>
        </div>
        <span className="dk-cb-banner-acts">
          <Button size="sm" variant="primary" icon="play" onClick={watchQuota} title={t.jumpQuotaHint} aria-label={`${t.jumpQuota}: ${t.jumpQuotaHint}`}>
            {t.jumpQuota}
          </Button>
          <a className="dk-cb-link" href={demoHref('siaga-wilayah', session)}>
            {t.openSiaga}
            <Icon name="arrowRight" size={14} />
          </a>
        </span>
      </div>
    )
  }
  const names = program.kecamatanIds.map((id) => kec.find((k) => k.id === id)?.name ?? id)
  const q = program.quota.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')
  return (
    <div className={`dk-cb-banner is-open${fresh ? ' is-fresh' : ''}`} role="status" aria-live="polite">
      <span className="dk-cb-pulse" aria-hidden="true" />
      <div>
        <b>{t.quotaOpen}</b> <span>{t.quotaBody(q, names.join(', '), hhmm(program.openedAt))}</span>
      </div>
      {mode === 'single' && (
        <Button size="sm" variant="secondary" iconEnd="arrowRight" onClick={onOpen}>
          {t.quotaGo}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ KPI strip */

function Stat({ label, value, decimals = 0, unit, caption, lang }: { label: string; value: number; decimals?: number; unit?: string; caption?: string; lang: Lang }) {
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const ref = useCountUp<HTMLSpanElement>(value, { format: (n) => n.toLocaleString(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) })
  return (
    <div className="dk-cb-stat">
      <span className="dk-cb-stat-l">{label}</span>
      <span className="dk-cb-stat-v dk-num">
        <span ref={ref}>{value.toLocaleString(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
        {unit && <small>{`\u2009${unit}`}</small>}
      </span>
      {caption && (
        <span className="dk-cb-stat-c" title={caption}>
          {caption}
        </span>
      )}
    </div>
  )
}

function StatsView({ role, lang }: { role: 'perizinan' | 'dinsos'; lang: Lang }) {
  const t = STR[lang]
  const log = useSessionLog()
  const bulk = useBulkLog()
  const desk = useWorld(deskCounts, shallowEqual)
  const program = useWorld(openProgram)
  const { minutes } = useClock()
  const arrived = arrivalsBy(minutes)
  const cleared = clearedBy(minutes)
  // single reads + the last bulk run (its files counted once, however often it is re-run)
  const verified = log.length + (bulk?.summary.total ?? 0)
  const manual = log.filter((r) => r.verdict === 'cek-manual').length + (bulk?.manual ?? 0)
  // a bulk run with the animation off (reduced motion / ?off=) takes ~0 s: shown, but kept out of the average
  const bulkTimed = !!bulk && bulk.ms >= 1000
  const timed = log.length + (bulkTimed ? bulk.summary.total : 0)
  const avg = timed ? (log.reduce((a, r) => a + r.ms, 0) + (bulkTimed ? bulk.ms : 0)) / timed / 1000 : 0
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const avgCaption = bulk
    ? bulkTimed
      ? t.kpiBulkCaption((bulk.ms / 1000).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), bulk.summary.total)
      : t.kpiBulkInstant(bulk.summary.total)
    : timed
      ? undefined
      : t.kpiAvgNone
  const fourth = useMemo(
    () =>
      role === 'dinsos'
        ? program
          ? { label: t.kpiApplicants, value: desk.applicants, caption: `${lang === 'id' ? 'kuota' : 'quota'} ${program.quota.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}` }
          : { label: t.kpiPractice, value: desk.applicants, caption: t.kpiPracticeCap }
        : { label: t.kpiQueue, value: Math.max(0, desk.waiting + arrived - cleared), caption: t.kpiQueueCap(arrived, cleared) },
    [role, t, desk, program, lang, arrived, cleared],
  )
  return (
    <div className="dk-cb-stats" role="group" aria-label={lang === 'id' ? 'Ringkasan' : 'Summary'}>
      <Stat label={t.kpiVerified} value={verified} lang={lang} />
      <Stat label={t.kpiManual} value={manual} caption={bulk ? t.kpiManualCap : undefined} lang={lang} />
      {timed ? (
        <Stat label={t.kpiAvg} value={avg} decimals={avg > 0 && avg < 1 ? 2 : 1} unit={t.sec} caption={avgCaption} lang={lang} />
      ) : (
        <div className="dk-cb-stat is-none">
          <span className="dk-cb-stat-l">{t.kpiAvg}</span>
          <span className="dk-cb-stat-v dk-num">
            <span aria-hidden="true">–</span>
          </span>
          {avgCaption && <span className="dk-cb-stat-c">{avgCaption}</span>}
        </div>
      )}
      <Stat label={fourth.label} value={fourth.value} caption={fourth.caption} lang={lang} />
    </div>
  )
}
