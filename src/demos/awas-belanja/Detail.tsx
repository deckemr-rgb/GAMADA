/**
 * Detail.tsx (lazy) — one package: header (HPS that corrects itself, risk ring, actions), the scan runner
 * (7 detectors in sequence → procurement.flagged), the 3 key findings, and the tabs HPS vs Pasar | Peserta | Pola |
 * Laporan. Peserta and Laporan are lazy chunks. On wide shells a rail lists the other packages.
 */
import { Suspense, lazy, memo, useCallback, useDeferredValue, useEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { Badge, Button, Icon, LoadingText, Score, StatusChip, Tabs, motionMode, useCountUp, useElementWidth, type TabItem } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { emit, useWorld, world, type Procurement, type ProcurementFinding, type WorldState } from '../../demo-kit/world'
import { analyzeProcurement, packages } from '../../demo-kit/world/satu-daerah'
import { AB, BAND_TONE, DETECTORS, DETECTOR_BY_ID, LEVEL_TONE, SLUG, isAnalysed, noteText, opdShort, riskBand, rpFull, rpShort, topFindings, type Detector } from './model'
import HpsTab from './HpsTab'
import PatternsTab, { type ScanState } from './PatternsTab'
import { useT, type Strings, type Lang } from './strings'
import type { RoleKey, TabId } from './types'

const BiddersTab = lazy(() => import('./BiddersTab'))
const MemoTab = lazy(() => import('./MemoTab'))
const preloadMemo = () => void import('./MemoTab').catch(() => undefined)
const preloadBidders = () => void import('./BiddersTab').catch(() => undefined)

export interface DetailProps {
  id: string
  tab: TabId
  onTab: (t: TabId) => void
  onBack: () => void
  onSwitch: (id: string) => void
  roleKey: RoleKey
  memoReq: number
  /** memo requests already started (owned by the Canvas instance) */
  memoHandled: RefObject<number>
  onRecommend: () => void
  arrived: boolean
}

/** bring a panel into view when its top sits low on the screen (phones: the tab body starts below the fold) */
function revealPanel(el: HTMLElement | null) {
  if (!el) return
  const top = el.getBoundingClientRect().top
  if (top < window.innerHeight * 0.6) return
  el.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
}

/** a one-shot highlight (opacity-only ::after) on the element a "Lihat bukti" link points at */
function flashEl(el: Element | null) {
  if (!(el instanceof HTMLElement)) return
  el.classList.remove('dk-ab-flash')
  void el.offsetWidth
  el.classList.add('dk-ab-flash')
  gsap.delayedCall(1.4, () => el.classList.remove('dk-ab-flash'))
}

const sel = (id: string) => (s: WorldState) => s.procurements.byId[id]
const opdSel = (s: WorldState) => s.region.opd

export default function Detail({ id, tab, onTab, onBack, onSwitch, roleKey, memoReq, memoHandled, onRecommend, arrived }: DetailProps) {
  const { t, lang } = useT()
  const { size, markMission } = useShell()
  const p = useWorld(sel(id))
  const opd = useWorld(opdSel)
  const [scan, setScan] = useState<ScanState | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const rootW = useElementWidth(rootRef)
  const emitted = useRef<number | null>(null)
  const tokens = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const runningRef = useRef(false)
  // the header paints first; the tab body (tables, chart) renders right after (keeps opening a package under INP)
  const shownTab = useDeferredValue<TabId | null>(tab, null)
  const stepSec = motionMode() === 'full' ? AB.scanStep : motionMode() === 'reduced' ? AB.scanStepReduced : 0

  // a scan never survives a package switch
  useEffect(() => () => setScan(null), [id])

  // focus the package title when a package opens (keyboard / screen-reader users keep their place)
  const hasP = !!p
  useEffect(() => {
    if (hasP) titleRef.current?.focus({ preventScroll: true })
  }, [id, hasP])

  // advance the scan one detector at a time; at the end emit procurement.flagged once
  useEffect(() => {
    if (!scan) return
    if (scan.step >= DETECTORS.length) {
      if (emitted.current !== scan.token) {
        emitted.current = scan.token
        emit('procurement.flagged', { procurementId: scan.pid, riskScore: scan.riskScore, findings: scan.findings }, SLUG)
      }
      const done = gsap.delayedCall(0.05, () => setScan(null))
      return () => {
        done.kill()
      }
    }
    if (!stepSec) {
      setScan((x) => (x ? { ...x, step: DETECTORS.length } : x))
      return
    }
    const c = gsap.delayedCall(stepSec, () => setScan((x) => (x ? { ...x, step: x.step + 1 } : x)))
    return () => {
      c.kill()
    }
  }, [scan, stepSec])

  const analyse = useCallback(() => {
    if (runningRef.current) return
    const r = analyzeProcurement(world.get(), id)
    setScan({ pid: id, step: 0, findings: r.findings, riskScore: r.riskScore, token: ++tokens.current })
    onTab('patterns')
    // the button that started the scan may unmount (Pola / Peserta / Laporan empty states): keep focus on the
    // header's analyse button, and on phones bring the scan (the wow moment) into view
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const a = document.activeElement
        if (!a || a === document.body || !a.isConnected) rootRef.current?.querySelector<HTMLElement>('[data-ab="analyse"]')?.focus({ preventScroll: true })
        revealPanel(panelRef.current)
      }),
    )
  }, [id, onTab])

  // "Lihat bukti": switch tab, reveal the panel, flash the evidence (also when that tab is already open)
  const see = useCallback(
    (d: Detector) => {
      const meta = DETECTOR_BY_ID[d]
      onTab(meta.tab)
      let tries = 0
      const go = () => {
        const panel = panelRef.current
        const sel = meta.tab === 'patterns' ? `[data-det="${d}"]` : meta.tab === 'hps' ? '.dk-ab-total' : '.dk-ab-bid-grid > :first-child'
        const el = panel?.querySelector(sel) ?? null
        if (!el && ++tries < 30) return void requestAnimationFrame(go)
        revealPanel(panel)
        flashEl(el)
      }
      requestAnimationFrame(go)
    },
    [onTab],
  )

  if (!p) {
    return (
      <div className="dk-ab-detail">
        <Button variant="ghost" icon="close" onClick={onBack}>
          {t.back}
        </Button>
      </div>
    )
  }

  const running = scan?.pid === id
  runningRef.current = running
  const analysed = isAnalysed(p)
  // the rail only when the main column still gets ≥ 760 px (tables stay tables)
  const wide = size !== 'sm' && rootW >= 1000
  const nonPass = p.findings.filter((f) => f.level !== 'lolos').length
  const sm = size === 'sm'
  const items: TabItem<TabId>[] = [
    { id: 'hps', label: t.tabs.hps, ...(sm ? {} : { icon: 'coins' as const }) },
    { id: 'bidders', label: t.tabs.bidders, ...(sm ? {} : { icon: 'users' as const }) },
    { id: 'patterns', label: t.tabs.patterns, ...(sm ? {} : { icon: 'shield' as const }), ...(analysed && nonPass ? { badge: nonPass } : {}) },
    { id: 'memo', label: t.tabs.memo, ...(sm ? {} : { icon: 'doc' as const }) },
  ]

  return (
    <div ref={rootRef} className={`dk-ab-detail${wide ? ' has-rail' : ''}`}>
      {wide && <Rail current={id} onSwitch={onSwitch} t={t} lang={lang} />}
      <div className="dk-ab-main">
        <Head
          titleRef={titleRef}
          p={p}
          opdLabel={opd.find((o) => o.id === p.opdId)?.short ?? opdShort(world.get(), p.opdId)}
          t={t}
          lang={lang}
          roleKey={roleKey}
          running={running}
          analysed={analysed}
          arrived={arrived}
          onBack={onBack}
          onAnalyse={analyse}
          onRecommend={onRecommend}
          onMemoTab={() => onTab('memo')}
        />
        {analysed && !running && <TopFindings findings={p.findings} t={t} lang={lang} onSee={see} />}
        <Tabs<TabId>
          className="dk-ab-tabs"
          items={items}
          value={tab}
          fill={size === 'sm'}
          label={t.tabsLabel}
          onChange={(v) => {
            onTab(v)
            if (v === 'memo') preloadMemo()
          }}
        >
          <div ref={panelRef} className="dk-ab-panel" onPointerEnter={tab === 'hps' ? preloadBidders : undefined}>
            {shownTab === null && <LoadingText>{t.loading}</LoadingText>}
            {shownTab === 'hps' && <HpsTab id={id} />}
            {shownTab === 'patterns' && <PatternsTab id={id} scan={running ? scan : null} onAnalyse={analyse} roleKey={roleKey} stepSec={stepSec} />}
            {shownTab === 'bidders' && (
              <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
                <BiddersTab id={id} onAnalyse={analyse} running={running} onEdge={() => markMission('find-affiliated')} />
              </Suspense>
            )}
            {shownTab === 'memo' && (
              <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
                <MemoTab id={id} roleKey={roleKey} memoReq={memoReq} memoHandled={memoHandled} onAnalyse={analyse} running={running} />
              </Suspense>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ header */

function Head({
  titleRef, p, opdLabel, t, lang, roleKey, running, analysed, arrived, onBack, onAnalyse, onRecommend, onMemoTab,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>
  p: Procurement
  opdLabel: string
  t: Strings
  lang: Lang
  roleKey: RoleKey
  running: boolean
  analysed: boolean
  arrived: boolean
  onBack: () => void
  onAnalyse: () => void
  onRecommend: () => void
  onMemoTab: () => void
}) {
  const hpsNow = p.recommendation ? p.recommendation.hpsCorrected : p.hps
  const hpsRef = useCountUp<HTMLSpanElement>(hpsNow, { format: (n) => rpFull(n, lang) })
  const corrected = !!p.recommendation
  const band = p.riskScore != null ? riskBand(p.riskScore) : null
  return (
    <header className="dk-ab-dhead">
      <div className="dk-ab-dhead-top">
        <Button variant="ghost" size="sm" icon="list" onClick={onBack} className="dk-ab-back">
          {t.back}
        </Button>
        {arrived && <StatusChip tone="new" label={t.focusArrived} />}
      </div>
      <div className="dk-ab-dhead-row">
        <div className="dk-ab-dhead-tx">
          <h2 ref={titleRef} className="dk-ab-dtitle" tabIndex={-1}>
            {p.name[lang]}
          </h2>
          <p className="dk-ab-dmeta">
            <span className="dk-num">{p.code}</span>
            <span>{opdLabel}</span>
            <span>{t.method[p.method] ?? p.method}</span>
            <StatusChip label={t.status[p.status] ?? p.status} tone={p.status === 'evaluasi' || p.status === 'pengumuman' ? 'new' : 'neutral'} />
            {p.emergency && <Badge tone="warn">{t.emergency}</Badge>}
            <span>{t.bidders(p.bidderIds.length)}</span>
            {p.scheduleDays != null && <span>{t.schedule(p.scheduleDays)}</span>}
          </p>
        </div>
        <div className="dk-ab-dhead-fig">
          <div className="dk-ab-hpsfig">
            <span className="dk-ab-hpsfig-l">{corrected ? t.hpsCorrected : t.hps}</span>
            <span ref={hpsRef} className={`dk-ab-hpsfig-v dk-num${corrected ? ' is-fixed' : ''}`} data-ab="head-hps">
              {rpFull(hpsNow, lang)}
            </span>
            {corrected && (
              <span className="dk-ab-hpsfig-was dk-num">
                <s>{rpFull(p.hps, lang)}</s> · {t.saving(rpShort(p.hps - hpsNow, lang))}
              </span>
            )}
            <span className="dk-ab-simtag">{t.sim}</span>
          </div>
          <div className="dk-ab-ring">
            {p.riskScore != null && analysed ? (
              <Score value={p.riskScore} label={t.riskScore} higherIsBetter={false} warn={35} danger={60} size={64} caption={band ? t.riskBand[band] : undefined} />
            ) : (
              <span className="dk-ab-ring-none">
                <b className="dk-num">{p.riskScore ?? '—'}</b>
                <small>{p.riskScore != null ? t.prelim : t.riskNone}</small>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="dk-ab-dhead-act">
        {/* one element for the whole scan, never disabled: a disabled or swapped button drops keyboard focus */}
        <Button
          variant={analysed ? 'ghost' : 'primary'}
          size={analysed ? 'sm' : 'md'}
          icon={analysed ? 'refresh' : 'zap'}
          onClick={onAnalyse}
          busy={running}
          aria-disabled={running || undefined}
          data-ab="analyse"
          data-hotspot={analysed ? undefined : 'ab-start'}
        >
          {running ? t.analysing : analysed ? t.reanalyse : t.analyse}
        </Button>
        {analysed &&
          (p.recommendation ? (
            <Button variant="secondary" icon="check" onClick={onMemoTab}>
              {t.recommended}
            </Button>
          ) : (
            <Button variant="primary" icon="spark" onClick={onRecommend} onPointerEnter={preloadMemo} onFocus={preloadMemo} disabled={running}>
              {t.recommend[roleKey]}
            </Button>
          ))}
      </div>
      {band && analysed && <span className={`dk-ab-dhead-edge is-${BAND_TONE[band]}`} aria-hidden="true" />}
    </header>
  )
}

/* ------------------------------------------------------------------ 3 key findings */

const TopFindings = memo(function TopFindings({ findings, t, lang, onSee }: { findings: ProcurementFinding[]; t: Strings; lang: Lang; onSee: (d: Detector) => void }) {
  const top = topFindings(findings)
  if (!top.length)
    return (
      <p className="dk-ab-allpass">
        <Icon name="check" size={16} />
        {t.allPass}
      </p>
    )
  return (
    <section className="dk-ab-top" aria-label={t.topTitle(top.length)}>
      <h3 className="dk-ab-top-h">{t.topTitle(top.length)}</h3>
      <ol className="dk-ab-top-list">
        {top.map((f) => {
          const d = DETECTOR_BY_ID[f.detector]
          return (
            <li key={f.detector} className={`dk-ab-top-card is-${f.level}`}>
              <p className="dk-ab-top-n">
                <StatusChip label={t.levels[f.level] ?? f.level} tone={LEVEL_TONE[f.level]} />
                {d.name[lang]}
              </p>
              <p className="dk-ab-top-b">{noteText(f.note, lang)}</p>
              <button type="button" className="dk-ab-inlink" onClick={() => onSee(f.detector)}>
                {t.topSee}
                <Icon name="forward" size={12} />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
})

/* ------------------------------------------------------------------ rail (wide shells) */

const Rail = memo(function Rail({ current, onSwitch, t, lang }: { current: string; onSwitch: (id: string) => void; t: Strings; lang: Lang }) {
  const all = useWorld(packages)
  const list = all.filter((r) => r.procurement.status !== 'selesai' || r.procurement.id === current)
  return (
    <nav className="dk-ab-rail" aria-label={t.railLabel}>
      <p className="dk-ab-rail-h">{t.listTitle}</p>
      <ul>
        {list.map(({ procurement: q }) => {
          const b = q.riskScore != null ? riskBand(q.riskScore) : null
          return (
            <li key={q.id}>
              <button type="button" className={`dk-ab-rail-i${q.id === current ? ' is-on' : ''}`} aria-current={q.id === current ? 'page' : undefined} onClick={() => onSwitch(q.id)}>
                <span className="dk-ab-rail-n">{q.name[lang]}</span>
                <span className="dk-ab-rail-m dk-num">
                  {q.code}
                  {b ? <i className={`dk-ab-rail-s is-${b}`}>{q.riskScore}</i> : <i className="dk-ab-rail-s">—</i>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
})
