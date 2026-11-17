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
import { Button, Icon, LoadingText, Segmented, useCountUp } from '../../demo-kit/ui'
import { hhmm, onEvent, rows, shallowEqual, useSession, useWorld, type Program, type WorldState } from '../../demo-kit/world'
import { useI18n, type Lang } from '../../lib/i18n'
import { asRole, bulkLog, DEFAULT_MODE, GALLERY, sessionLog, type CekRole, type Mode } from './model'
import { STR } from './strings'
import Single from './Single'
import './cek-berkas.css'

// memoised: a tab press re-renders the canvas root, never the (large) mode subtrees
const SingleMode = memo(Single)
const Bulk = lazy(() => import('./Bulk').then((m) => ({ default: memo(m.default) })))

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

// the dot alone (kit default): the kit places its label over the target's right half, which hides the CTA text
export const hotspot = { target: '[data-hotspot="cek-go"]' }

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

/* ------------------------------------------------------------------ canvas */

export default function CekBerkas({ product }: DemoCanvasProps) {
  const { lang } = useI18n()
  const t = STR[lang]
  const shell = useShell()
  const session = useSession()
  const role = asRole(session.role)
  // `tab` answers the click at once (segmented control); `mode` swaps the heavy subtree one paint later (INP)
  const [mode, setModeNow] = useState<Mode>(() => DEFAULT_MODE[role])
  const [tab, setTab] = useState<Mode>(mode)
  const swap = useRef(0)
  const setMode = useCallback((m: Mode) => {
    setTab(m)
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

  // a fresh canvas (first mount, or the shell's Reset remount) starts a fresh session log
  useEffect(() => {
    sessionLog.clear()
    bulkLog.set(null)
  }, [])

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
  const onFocusDone = useCallback(() => setFocusDoc(null), [])
  const [seen, setSeen] = useState<Mode[]>(() => [mode])
  useEffect(() => setSeen((s) => (s.includes(mode) ? s : [...s, mode])), [mode])

  return (
    <BrowserFrame path={`${product}/${mode === 'single' ? 'satu-berkas' : 'massal'}`} label={t.frame} className="dk-cb-frame">
      <div className="dk-cb" data-mode={mode}>
        <header className="dk-cb-head">
          <div className="dk-cb-title">
            <h2>
              <Icon name="shield" size={18} />
              {tab === 'single' ? t.single : t.bulk}
            </h2>
            <p>{t.roleNote[role]}</p>
          </div>
          <Segmented<Mode>
            label={t.modes}
            value={tab}
            onChange={onMode}
            options={[
              { value: 'single', label: t.single, icon: 'doc' },
              { value: 'bulk', label: t.bulk, icon: 'layers' },
            ]}
          />
        </header>

        <div className="dk-cb-status">
          <ProgramBanner program={program} lang={lang} mode={tab} role={role} onOpen={() => setMode('bulk')} />
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

        <p className="dk-cb-foot">
          <Icon name="info" size={14} />
          {t.specimenNote}
        </p>
      </div>
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ programme banner (consumes eligibility.opened) */

function ProgramBanner({ program, lang, mode, role, onOpen }: { program: Program | null; lang: Lang; mode: Mode; role: CekRole; onOpen: () => void }) {
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
          <b>{role === 'dinsos' ? t.noProgramDinsos : t.noProgram}</b> <span>{role === 'dinsos' ? t.noProgramDinsosBody : t.noProgramBody}</span>
        </div>
        <a className="dk-cb-link" href={demoHref('siaga-wilayah', session)}>
          {t.openSiaga}
          <Icon name="arrowRight" size={14} />
        </a>
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
        {unit && <small>{unit}</small>}
      </span>
      {caption && <span className="dk-cb-stat-c">{caption}</span>}
    </div>
  )
}

function Stats({ role, lang }: { role: 'perizinan' | 'dinsos'; lang: Lang }) {
  const t = STR[lang]
  const log = useSessionLog()
  const bulk = useSyncExternalStore(bulkLog.subscribe, bulkLog.get, bulkLog.get)
  const desk = useWorld(deskCounts, shallowEqual)
  const program = useWorld(openProgram)
  // single reads + the last bulk run (its files counted once, however often it is re-run)
  const verified = log.length + (bulk?.summary.total ?? 0)
  const manual = log.filter((r) => r.verdict === 'cek-manual').length + (bulk?.manual ?? 0)
  const avg = verified ? (log.reduce((a, r) => a + r.ms, 0) + (bulk?.ms ?? 0)) / verified / 1000 : 0
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const avgCaption = bulk ? t.kpiBulkCaption((bulk.ms / 1000).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), bulk.summary.total) : undefined
  const fourth = useMemo(
    () =>
      role === 'dinsos'
        ? { label: t.kpiApplicants, value: desk.applicants, caption: program ? `${lang === 'id' ? 'kuota' : 'quota'} ${program.quota.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}` : t.simLabel }
        : { label: t.kpiQueue, value: desk.waiting, caption: t.simLabel },
    [role, t, desk, program, lang],
  )
  return (
    <div className="dk-cb-stats" role="group" aria-label={lang === 'id' ? 'Ringkasan' : 'Summary'}>
      <Stat label={t.kpiVerified} value={verified} lang={lang} />
      <Stat label={t.kpiManual} value={manual} lang={lang} />
      <Stat label={t.kpiAvg} value={avg} decimals={avg > 0 && avg < 1 ? 2 : 1} unit={t.sec} caption={avgCaption} lang={lang} />
      <Stat label={fourth.label} value={fourth.value} caption={fourth.caption} lang={lang} />
    </div>
  )
}
