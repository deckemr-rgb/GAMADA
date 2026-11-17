/**
 * PatternsTab.tsx — "Pola": the 7 detectors with Lolos / Waspada / Tinggi and an explanation each. While a scan
 * runs, rows fill one by one (progress bar = CSS transform scaleX, status chips drop in); the result comes from
 * analyzeProcurement and is emitted as procurement.flagged by Detail. Inspektorat also sees the audit trail.
 */
import { memo, useEffect, useMemo, useRef } from 'react'
import { Button, Icon, StatusChip, Timeline, dropChips, motionMode, type TimelineItem } from '../../demo-kit/ui'
import { auditFor, hhmm, useWorld, type ProcurementFinding, type WorldState } from '../../demo-kit/world'
import { DETECTORS, LEVEL_TONE, isAnalysed, noteText, type Detector } from './model'
import { useT, type Strings, type Lang } from './strings'
import type { RoleKey } from './types'

export interface ScanState {
  pid: string
  /** detectors finished (0..7) */
  step: number
  findings: ProcurementFinding[]
  riskScore: number
  /** one per run (emit-once guard) */
  token: number
}

const sel = (id: string) => (s: WorldState) => s.procurements.byId[id]

export default function PatternsTab({ id, scan, onAnalyse, roleKey, stepSec }: { id: string; scan: ScanState | null; onAnalyse: () => void; roleKey: RoleKey; stepSec: number }) {
  const { t, lang } = useT()
  const p = useWorld(sel(id))
  if (!p) return null
  const running = scan?.pid === id ? scan : null
  const analysed = isAnalysed(p)
  const byDet = new Map<Detector, ProcurementFinding>((running ? running.findings : p.findings).map((f) => [f.detector, f]))
  const doneCount = running ? running.step : analysed ? DETECTORS.length : 0
  const live = running
    ? running.step < DETECTORS.length
      ? t.scanAnnounce(running.step + 1, DETECTORS.length, DETECTORS[running.step]!.name[lang])
      : ''
    : analysed
      ? t.scanDone(p.riskScore ?? 0, p.findings.filter((f) => f.level !== 'lolos').length)
      : ''
  return (
    <div className="dk-ab-pat">
      <header className="dk-ab-pat-head">
        <div>
          <h3 className="dk-ab-h3">{t.patternsTitle}</h3>
          <p className="dk-ab-muted">{t.patternsLead}</p>
        </div>
        {!running && !analysed && (
          <Button variant="primary" icon="zap" onClick={onAnalyse}>
            {t.analyse}
          </Button>
        )}
      </header>
      {!running && !analysed && (
        <p className="dk-ab-notice">
          <Icon name="info" size={16} />
          <span>
            {t.notScanned}
            {p.riskScore != null && ` ${t.prelimNote(p.riskScore)}`}
          </span>
        </p>
      )}
      <p className="dk-sr" aria-live="polite">
        {live}
      </p>
      <ol className={`dk-ab-dets${running ? ' is-running' : ''}`} style={{ ['--ab-step' as string]: `${stepSec}s` }}>
        {DETECTORS.map((d, i) => {
          const f = byDet.get(d.id)
          const state: 'done' | 'scan' | 'wait' | 'idle' = i < doneCount && f ? 'done' : running && i === running.step ? 'scan' : running ? 'wait' : 'idle'
          return <DetRow key={d.id} det={d.id} index={i} name={d.name[lang]} checks={d.checks[lang]} state={state} f={state === 'done' ? f : undefined} t={t} lang={lang} />
        })}
      </ol>
      {roleKey === 'inspektorat' && <AuditTrail id={id} lang={lang} />}
    </div>
  )
}

const DetRow = memo(function DetRow({ det, index, name, checks, state, f, t, lang }: { det: Detector; index: number; name: string; checks: string; state: 'done' | 'scan' | 'wait' | 'idle'; f: ProcurementFinding | undefined; t: Strings; lang: Lang }) {
  const chip = useRef<HTMLSpanElement>(null)
  const prev = useRef(state)
  useEffect(() => {
    // drop the verdict chip in when this row finishes during a live scan
    if (prev.current === 'scan' && state === 'done' && chip.current && motionMode() !== 'static') dropChips([chip.current])
    prev.current = state
  }, [state])
  return (
    <li data-det={det} className={`dk-ab-det is-${state}${f ? ` is-${f.level}` : ''}`} aria-busy={state === 'scan' || undefined}>
      <span className="dk-ab-det-i dk-num" aria-hidden="true">
        {state === 'done' ? <Icon name={f?.level === 'lolos' ? 'check' : 'alert'} size={14} /> : index + 1}
      </span>
      <div className="dk-ab-det-tx">
        <p className="dk-ab-det-n">{name}</p>
        <p className="dk-ab-det-c">{f ? noteText(f.note, lang) : checks}</p>
        {state === 'scan' && (
          <span className="dk-ab-det-bar" aria-hidden="true">
            <i />
          </span>
        )}
      </div>
      <span ref={chip} className="dk-ab-det-s">
        {state === 'done' && f ? (
          <StatusChip label={t.levels[f.level] ?? f.level} tone={LEVEL_TONE[f.level]} />
        ) : state === 'scan' ? (
          <span className="dk-ab-det-st is-scan">{t.scanning}</span>
        ) : state === 'wait' ? (
          <span className="dk-ab-det-st">{t.pending}</span>
        ) : null}
      </span>
    </li>
  )
})

function AuditTrail({ id, lang }: { id: string; lang: Lang }) {
  const rowsA = useWorld((s) => auditFor(s, id))
  const items = useMemo<TimelineItem[]>(
    () =>
      rowsA.slice(-8).reverse().map((a) => ({
        id: a.id,
        time: hhmm(a.at),
        title: a.summary[lang],
        source: a.source,
        tone: a.type === 'procurement.flagged' ? 'danger' : a.type === 'procurement.recommended' ? 'done' : 'neutral',
      })),
    [rowsA, lang],
  )
  if (!items.length) return null
  return (
    <section className="dk-ab-trail" aria-label={lang === 'id' ? 'Jejak audit paket' : 'Package audit trail'}>
      <h4 className="dk-ab-h4">
        <Icon name="shield" size={16} />
        {lang === 'id' ? 'Jejak audit (Inspektorat)' : 'Audit trail (Inspectorate)'}
      </h4>
      <Timeline items={items} label={lang === 'id' ? 'Jejak audit paket' : 'Package audit trail'} live />
    </section>
  )
}

