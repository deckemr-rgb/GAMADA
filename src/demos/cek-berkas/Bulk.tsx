/**
 * Massal (lazy) — "Proses 50 berkas pendaftar bansos banjir": a grid of small cards that turn to their result one by
 * one (≈ 8 s, one gsap timeline on the shared ticker; CSS transitions on transform / opacity only; instant when motion
 * is reduced or off), a sticky summary (lolos · kurang · NIK ganda in pairs · luar zona, mutually exclusive), lines
 * between cards that share a NIK (anchored on the cards' NIK corner, drawn under the card text; full strength on
 * hover / focus of a pair or with the NIK ganda filter), addresses checked against the Siaga Wilayah zone
 * (programme → active flood alert → scenario zone), detail drawer, CSV export and, once done, the cross-check map
 * (lazy ZoneMap). The finished run emits one `document.verified` per file in one go (the world processes them as one
 * batch) and keeps that batch on screen: a later zone change marks the result stale until it is run again.
 */
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { gsap } from 'gsap'
import { useShell } from '../../demo-kit/shell'
import { Button, Drawer, Icon, LoadingText, motionMode } from '../../demo-kit/ui'
import { activeAlerts, emit, rows, useWorld, world, type WorldState } from '../../demo-kit/world'
import { bansosBatch, bansosCsv, type BansosBatch, type BansosRow } from '../../demo-kit/world/satu-daerah'
import { useI18n, type Lang } from '../../lib/i18n'
import { bulkLog, bulkProcessed, CEK, maskNik, STATUS_OF, summarize, zoneKey, type BulkResult, type CekRole } from './model'
import { STR, type CekStrings } from './strings'

const ZoneMap = lazy(() => import('./ZoneMap').then((m) => ({ default: memo(m.default) })))

type Phase = 'idle' | 'running' | 'done'
type Filter = 'all' | BulkResult
type Source = 'program' | 'alert' | 'scenario'
type CardState = 'done' | 'scan' | 'queued'

const batchOf = (s: WorldState): BansosBatch => bansosBatch(s)
const zoneSource = (s: WorldState): Source =>
  rows(s.programs).some((p) => p.open && p.kind === 'bansos-banjir') ? 'program' : activeAlerts(s).some((a) => a.kind === 'banjir') ? 'alert' : 'scenario'
const kecList = (s: WorldState) => s.region.kecamatan

const RESULT_ICON: Record<BulkResult, 'check' | 'info' | 'link' | 'pin'> = { lolos: 'check', kurang: 'info', ganda: 'link', 'luar-zona': 'pin' }

/** after the next paint: work that would otherwise land inside the click's frame (INP) */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0))

export default function Bulk({ role, active, focusDoc, onFocusDone }: { role: CekRole; active: boolean; focusDoc: string | null; onFocusDone: () => void }) {
  const { lang } = useI18n()
  const t = STR[lang]
  const shell = useShell()
  const live = useWorld(batchOf)
  const liveSource = useWorld(zoneSource)
  const kec = useWorld(kecList)
  const processed = useWorld(bulkProcessed)
  // the batch the last run used and emitted: what the grid, chips, map and AI show until the next run
  const [ran, setRan] = useState<{ batch: BansosBatch; source: Source } | null>(() => (processed ? { batch: live, source: liveSource } : null))
  const [phase, setPhase] = useState<Phase>(() => (processed ? 'done' : 'idle'))
  const [count, setCount] = useState(() => (processed ? live.rows.length : 0))
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [detail, setDetail] = useState<string | null>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const t0 = useRef(0)
  const kecName = useCallback((id: string) => kec.find((k) => k.id === id)?.name ?? id, [kec])
  const desaName = useCallback((kid: string, did: string) => kec.find((k) => k.id === kid)?.desa.find((d) => d.id === did)?.name ?? '', [kec])

  const batch = phase === 'idle' || !ran ? live : ran.batch
  const source = phase === 'idle' || !ran ? liveSource : ran.source
  const total = batch.rows.length
  const stale = phase === 'done' && !!ran && zoneKey(ran.batch.zone) !== zoneKey(live.zone)

  useEffect(() => () => void tl.current?.kill(), [])
  // the drawer is a portal: close it when the mode is switched away
  useEffect(() => {
    if (!active) setDetail(null)
  }, [active])

  const finish = useCallback(
    (b: BansosBatch) => {
      for (const r of b.rows) emit('document.verified', { documentId: r.doc.id, status: STATUS_OF[r.result], ...(r.missing ? { notes: r.missing } : {}) }, 'cek-berkas')
      const ms = performance.now() - t0.current
      const summary = summarize(b)
      bulkLog.set({ summary, zone: b.zone, ms, manual: summary.ganda + summary.luarZona })
      setCount(b.rows.length)
      setPhase('done')
      setElapsed(ms / 1000)
      shell.markMission('bulk')
    },
    [shell],
  )

  const run = useCallback(() => {
    tl.current?.kill()
    // this frame: only the button turns busy; the 50 cards reset one paint later (INP)
    setPhase('running')
    setDetail(null)
    t0.current = performance.now()
    afterPaint(() => {
      const s = world.get()
      const b = bansosBatch(s)
      setRan({ batch: b, source: zoneSource(s) })
      setFilter('all')
      setElapsed(null)
      setCount(0)
      const n = b.rows.length
      // reduced motion / ?off=demoAnimations / ?static=1: the final state at once
      if (motionMode() !== 'full' || n === 0) {
        afterPaint(() => finish(b))
        return
      }
      const line = gsap.timeline()
      for (let i = 1; i <= n; i++) line.call(() => setCount(i), [], CEK.bulkLead + i * CEK.bulkStagger)
      line.call(() => finish(b), [], CEK.bulkLead + n * CEK.bulkStagger + 0.25)
      tl.current = line
    })
  }, [finish])

  // arrival from a cross-product link: open that applicant's file
  useEffect(() => {
    if (!focusDoc) return
    if (batch.rows.some((r) => r.doc.id === focusDoc)) setDetail(focusDoc)
    onFocusDone()
  }, [focusDoc, batch, onFocusDone])

  const shownCount = phase === 'done' ? total : count
  const sum = useMemo(() => summarize(batch, shownCount), [batch, shownCount])
  const chipsLive = shownCount > 0

  const exportCsv = () => {
    const csv = bansosCsv(batch, lang)
    const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = lang === 'id' ? 'cek-berkas-pendaftar-bansos-banjir-spesimen.csv' : 'cek-berkas-flood-aid-applicants-specimen.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    shell.markMission('export')
    shell.toast({ title: t.exportCsv, body: t.csvSaved, tone: 'accent', icon: 'download' })
  }

  const zoneNames = batch.zone.map(kecName)
  const sourceLabel = source === 'program' ? t.zoneProgram : source === 'alert' ? t.zoneAlert : t.zoneScenario
  const detailIdx = detail ? batch.rows.findIndex((r) => r.doc.id === detail) : -1
  const detailRow = detailIdx >= 0 ? batch.rows[detailIdx]! : null
  const fmtS = (s: number) => s.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const pick = (f: Filter) => {
    if (chipsLive) setFilter(f)
  }
  const note = phase === 'running' ? t.runningNote(total) : phase === 'done' && elapsed !== null ? `${t.doneNote(fmtS(elapsed), total)} ${sum.gandaPairs > 0 ? t.dupLines : ''}` : sum.gandaPairs > 0 ? t.dupLines : ''

  return (
    <div className="dk-cb-bulk">
      <div className="dk-cb-bulk-head">
        <div>
          <h3>{t.bulkTitle}</h3>
          <p>{phase === 'done' ? t.bulkLeadDone(total) : t.bulkLead(total)}</p>
          <p className="dk-cb-zone">
            <Icon name="map" size={14} />
            <span>
              {t.zoneLine} <b>{sourceLabel}</b>: {zoneNames.join(', ')}
            </span>
          </p>
        </div>
        <div className="dk-cb-bulk-act">
          <Button variant="primary" icon={phase === 'done' ? 'replay' : 'play'} onClick={run} busy={phase === 'running'} disabled={phase === 'running'} data-hotspot="cek-go">
            {phase === 'running' ? t.running : phase === 'done' ? t.rerun : t.run(total)}
          </Button>
          {phase === 'done' && (
            <Button variant="secondary" icon="download" onClick={exportCsv}>
              {t.exportCsv}
            </Button>
          )}
        </div>
      </div>

      {stale && (
        <div className="dk-cb-stale" role="status">
          <Icon name="alert" size={16} />
          <p>
            <b>{t.staleTitle}</b> {t.staleBody(live.zone.map(kecName).join(', '), zoneNames.join(', '))}
          </p>
          <Button size="sm" variant="primary" icon="replay" onClick={run}>
            {t.staleRun}
          </Button>
        </div>
      )}

      {/* the sticky summary lives with the grid only: it lets go before the cross-check map */}
      <div className="dk-cb-results">
        <div className="dk-cb-summary" role="group" aria-label={lang === 'id' ? 'Ringkasan hasil' : 'Result summary'}>
          <div className="dk-cb-prog">
            <span className="dk-cb-prog-t dk-num">
              {t.progress(shownCount, total)}
              {elapsed !== null && phase === 'done' ? ` · ${t.elapsed(fmtS(elapsed))}` : ''}
            </span>
            <span className="dk-cb-prog-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${total ? shownCount / total : 0})` }} />
            </span>
          </div>
          <div className={`dk-cb-filters${chipsLive ? '' : ' is-idle'}`} role="group" aria-label={chipsLive ? t.filter : `${t.filter} · ${t.chipsIdle}`}>
            <FilterChip on={filter === 'all'} live={chipsLive} onClick={() => pick('all')} label={t.all} value={shownCount} tone="all" />
            <FilterChip on={filter === 'lolos'} live={chipsLive} onClick={() => pick('lolos')} label={t.sumLolos} value={sum.lolos} tone="lolos" />
            <FilterChip on={filter === 'kurang'} live={chipsLive} onClick={() => pick('kurang')} label={t.sumKurang} value={sum.kurang} tone="kurang" />
            <FilterChip on={filter === 'ganda'} live={chipsLive} onClick={() => pick('ganda')} label={t.sumGanda} value={sum.ganda} sub={t.sumGandaPairs(sum.gandaPairs)} tone="ganda" />
            <FilterChip on={filter === 'luar-zona'} live={chipsLive} onClick={() => pick('luar-zona')} label={t.sumLuar} value={sum.luarZona} sub={sum.outsideGanda ? t.sumLuarSub(sum.outsideGanda) : undefined} tone="luar-zona" />
          </div>
        </div>

        <Grid batch={batch} count={shownCount} phase={phase} filter={filter} onOpen={setDetail} t={t} kecName={kecName} />

        <p className="dk-cb-bulk-note" aria-live="polite">
          {note}
        </p>
      </div>

      {phase === 'done' && (
        <Suspense fallback={<LoadingText>{t.crossLoading}</LoadingText>}>
          <ZoneMap batch={batch} lang={lang} kecName={kecName} role={role} />
        </Suspense>
      )}

      <Drawer open={!!detailRow} onClose={() => setDetail(null)} title={detailRow ? detailRow.doc.ownerName : t.detail} eyebrow={t.detail} width={400}>
        {detailRow &&
          (detailIdx < shownCount ? (
            <Detail row={detailRow} idx={detailIdx} batch={batch} done={shownCount} lang={lang} kecName={kecName} desaName={desaName} zoneNames={zoneNames} onGoto={setDetail} />
          ) : (
            <Pending row={detailRow} idx={detailIdx} lang={lang} kecName={kecName} desaName={desaName} />
          ))}
      </Drawer>
    </div>
  )
}

/* ------------------------------------------------------------------ filter chips */

function FilterChip({ on, live, onClick, label, value, sub, tone }: { on: boolean; live: boolean; onClick: () => void; label: string; value: number; sub?: string | undefined; tone: string }) {
  return (
    <button type="button" className={`dk-cb-fchip is-${tone}${on && live ? ' is-on' : ''}`} aria-pressed={live ? on : undefined} aria-disabled={live ? undefined : true} onClick={onClick}>
      <span className="dk-cb-fdot" aria-hidden="true" />
      <span className="dk-cb-fl">{label}</span>
      <b className="dk-num">{value}</b>
      {sub && <small className="dk-num">{sub}</small>}
    </button>
  )
}

/* ------------------------------------------------------------------ grid + duplicate lines */

interface Line {
  key: string
  group: number
  d: string
  a: [number, number]
  b: [number, number]
  last: number
}

function Grid({ batch, count, phase, filter, onOpen, t, kecName }: { batch: BansosBatch; count: number; phase: Phase; filter: Filter; onOpen: (id: string) => void; t: CekStrings; kecName: (id: string) => string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLButtonElement>())
  const [focusIdx, setFocusIdx] = useState(0)
  const [hot, setHot] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const groupOf = useMemo(() => {
    const m = new Map<string, number>()
    batch.duplicateGroups.forEach((g, gi) => g.forEach((id) => m.set(id, gi)))
    return m
  }, [batch])
  const indexOf = useMemo(() => new Map(batch.rows.map((r, i) => [r.doc.id, i])), [batch])

  // geometry of the duplicate lines (re-measured on resize; positions in the wrapper's box). Each end sits on the
  // card's top edge above its NIK chip, so neither the line nor its dot covers a name.
  const measure = useCallback(() => {
    const w = wrap.current
    if (!w) return
    const box = w.getBoundingClientRect()
    const narrow = box.width < 640
    const anchor = (el: HTMLElement): [number, number] => {
      const r = el.getBoundingClientRect()
      const nik = el.querySelector('.dk-cb-card-nik')?.getBoundingClientRect()
      const x = nik && nik.width ? nik.left + nik.width / 2 : r.right - 16
      return [x - box.left, r.top - box.top]
    }
    const out: Line[] = []
    batch.duplicateGroups.forEach((g, gi) => {
      for (let k = 1; k < g.length; k++) {
        const a = cards.current.get(g[0]!)
        const b = cards.current.get(g[k]!)
        if (!a || !b) continue
        const pa = anchor(a)
        const pb = anchor(b)
        const dx = pb[0] - pa[0]
        const dy = pb[1] - pa[1]
        const dist = Math.hypot(dx, dy) || 1
        // bow perpendicular to the chord, upwards (into the gap above the cards), gentler on phones
        const bow = narrow ? Math.min(36, 14 + dist * 0.06) : Math.min(70, 20 + dist * 0.12)
        let px = -dy / dist
        let py = dx / dist
        if (py > 0 || (py === 0 && px < 0)) {
          px = -px
          py = -py
        }
        const mx = (pa[0] + pb[0]) / 2 + px * bow
        const my = (pa[1] + pb[1]) / 2 + py * bow
        out.push({ key: `${g[0]}-${g[k]}`, group: gi, d: `M${pa[0].toFixed(1)},${pa[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${pb[0].toFixed(1)},${pb[1].toFixed(1)}`, a: pa, b: pb, last: Math.max(indexOf.get(g[0]!) ?? 0, indexOf.get(g[k]!) ?? 0) })
      }
    })
    setLines(out)
  }, [batch, indexOf])

  useLayoutEffect(() => {
    measure()
  }, [measure])
  useEffect(() => {
    const w = wrap.current
    if (!w || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(w)
    return () => ro.disconnect()
  }, [measure])

  const cols = () => {
    const g = wrap.current?.querySelector('.dk-cb-grid')
    if (!g) return 1
    return getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length || 1
  }
  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
      const n = batch.rows.length
      let j = -1
      if (e.key === 'ArrowRight') j = Math.min(n - 1, i + 1)
      else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1)
      else if (e.key === 'ArrowDown') j = Math.min(n - 1, i + cols())
      else if (e.key === 'ArrowUp') j = Math.max(0, i - cols())
      else if (e.key === 'Home') j = 0
      else if (e.key === 'End') j = n - 1
      if (j < 0) return
      e.preventDefault()
      setFocusIdx(j)
      const id = batch.rows[j]?.doc.id
      if (id) cards.current.get(id)?.focus()
    },
    [batch],
  )
  const setRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) cards.current.set(id, el)
    else cards.current.delete(id)
  }, [])
  const onEnter = useCallback((id: string, i: number | null) => {
    if (i !== null) setFocusIdx(i)
    setHot(groupOf.get(id) ?? null)
  }, [groupOf])
  const onLeave = useCallback(() => setHot(null), [])

  const allHot = filter === 'ganda'
  const drawn = lines.filter((l) => l.last < count)
  const top = drawn.filter((l) => allHot || l.group === hot)
  return (
    <div className={`dk-cb-gridwrap${filter !== 'all' && filter !== 'ganda' ? ' is-filtered' : ''}`} ref={wrap}>
      <svg className="dk-cb-lines" aria-hidden="true" width="100%" height="100%">
        {lines.map((l) => (
          <path key={l.key} d={l.d} pathLength={1} className={l.last < count ? 'is-on' : ''} />
        ))}
      </svg>
      <div className="dk-cb-grid" role="group" aria-label={t.gridLabel}>
        {batch.rows.map((r, i) => {
          const state: CardState = i < count ? 'done' : i === count && phase === 'running' ? 'scan' : 'queued'
          const dim = state === 'done' && filter !== 'all' && r.result !== filter
          return <Card key={r.doc.id} row={r} i={i} state={state} dim={dim} tabbable={i === focusIdx} kec={kecName(r.doc.kecamatanId)} t={t} onOpen={onOpen} onKey={onKey} onEnter={onEnter} onLeave={onLeave} setRef={setRef} />
        })}
      </div>
      <svg className="dk-cb-lines is-top" aria-hidden="true" width="100%" height="100%">
        {top.map((l) => (
          <path key={l.key} d={l.d} />
        ))}
        {drawn.map((l) => (
          <g key={l.key} className={allHot || l.group === hot ? 'is-hot' : ''}>
            <circle cx={l.a[0]} cy={l.a[1]} r={3.5} />
            <circle cx={l.b[0]} cy={l.b[1]} r={3.5} />
          </g>
        ))}
      </svg>
    </div>
  )
}

interface CardProps {
  row: BansosRow
  i: number
  state: CardState
  dim: boolean
  tabbable: boolean
  kec: string
  t: CekStrings
  onOpen: (id: string) => void
  onKey: (e: KeyboardEvent<HTMLButtonElement>, i: number) => void
  onEnter: (id: string, i: number | null) => void
  onLeave: () => void
  setRef: (id: string, el: HTMLButtonElement | null) => void
}

/** one applicant card — memoised: a bulk step or a filter click re-renders only the cards whose state changed */
const Card = memo(function Card({ row: r, i, state, dim, tabbable, kec, t, onOpen, onKey, onEnter, onLeave, setRef }: CardProps) {
  const id = r.doc.id
  const res = state === 'done' ? t.result[r.result]! : state === 'scan' ? t.running : t.queued
  return (
    <button
      ref={(el) => setRef(id, el)}
      type="button"
      className={`dk-cb-card is-${state}${state === 'done' ? ` is-${r.result}` : ''}${r.outsideZone && state === 'done' ? ' is-out' : ''}${dim ? ' is-dim' : ''}`}
      style={{ '--i': i } as CSSProperties}
      tabIndex={tabbable ? 0 : -1}
      onFocus={() => onEnter(id, i)}
      onBlur={onLeave}
      onPointerEnter={() => onEnter(id, null)}
      onPointerLeave={onLeave}
      onKeyDown={(e) => onKey(e, i)}
      onClick={() => onOpen(id)}
      aria-label={t.cardLabel(i + 1, r.doc.ownerName, res)}
      data-result={state === 'done' ? r.result : state}
    >
      <span className="dk-cb-card-top">
        <span className="dk-cb-card-n dk-num">{String(i + 1).padStart(2, '0')}</span>
        <span className="dk-cb-card-nik dk-num">{r.doc.nik ? `…${r.doc.nik.slice(-4)}` : ''}</span>
      </span>
      <span className="dk-cb-card-name">{r.doc.ownerName}</span>
      <span className="dk-cb-card-kec">{kec}</span>
      <span className="dk-cb-card-res" aria-hidden="true">
        {state === 'done' && <Icon name={RESULT_ICON[r.result]} size={11} strokeWidth={2.2} />}
        {state === 'done' ? t.result[r.result] : state === 'scan' ? '' : t.queued}
      </span>
      <span className="dk-cb-card-tint" aria-hidden="true" />
      {state === 'scan' && <span className="dk-cb-card-scan" aria-hidden="true" />}
    </button>
  )
})

/* ------------------------------------------------------------------ detail */

function Address({ row, lang, kecName, desaName }: { row: BansosRow; lang: Lang; kecName: (id: string) => string; desaName: (k: string, d: string) => string }) {
  const desa = desaName(row.doc.kecamatanId, row.doc.desaId)
  return <>{lang === 'id' ? `${desa ? `Desa ${desa}, ` : ''}Kec. ${kecName(row.doc.kecamatanId)}` : `${desa ? `${desa} village, ` : ''}${kecName(row.doc.kecamatanId)} district`}</>
}

/** a queued file: who and where, no result yet */
function Pending({ row, idx, lang, kecName, desaName }: { row: BansosRow; idx: number; lang: Lang; kecName: (id: string) => string; desaName: (k: string, d: string) => string }) {
  const t = STR[lang]
  return (
    <div className="dk-cb-detail">
      <p className="dk-cb-dres is-pending">
        <Icon name="clock" size={16} strokeWidth={2} />
        {t.pendingTitle}
        <span className="dk-num">#{String(idx + 1).padStart(2, '0')}</span>
      </p>
      <dl className="dk-cb-dl">
        <div>
          <dt>{t.dName}</dt>
          <dd>{row.doc.ownerName}</dd>
        </div>
        <div>
          <dt>{t.dNik}</dt>
          <dd className="dk-num">{maskNik(row.doc.nik)}</dd>
        </div>
        <div>
          <dt>{t.dAddr}</dt>
          <dd>
            <Address row={row} lang={lang} kecName={kecName} desaName={desaName} />
          </dd>
        </div>
      </dl>
      <p className="dk-cb-dnote">
        <Icon name="info" size={14} />
        {t.pendingBody}
      </p>
    </div>
  )
}

function Detail({ row, idx, batch, done, lang, kecName, desaName, zoneNames, onGoto }: { row: BansosRow; idx: number; batch: BansosBatch; done: number; lang: Lang; kecName: (id: string) => string; desaName: (k: string, d: string) => string; zoneNames: string[]; onGoto: (id: string) => void }) {
  const t = STR[lang]
  const reason = row.result === 'ganda' ? t.dDupReason : row.result === 'luar-zona' ? t.dZoneOut(zoneNames.join(', ')) : row.result === 'kurang' ? (row.missing?.[lang] ?? '') : t.dLolos
  const pairs = row.duplicateOf.map((id) => ({ id, j: batch.rows.findIndex((r) => r.doc.id === id) })).filter((p) => p.j >= 0 && p.j < done)
  return (
    <div className="dk-cb-detail">
      <p className={`dk-cb-dres is-${row.result}`}>
        <Icon name={RESULT_ICON[row.result]} size={16} strokeWidth={2} />
        {t.result[row.result]}
        <span className="dk-num">#{String(idx + 1).padStart(2, '0')}</span>
      </p>
      <dl className="dk-cb-dl">
        <div>
          <dt>{t.dName}</dt>
          <dd>{row.doc.ownerName}</dd>
        </div>
        <div>
          <dt>{t.dNik}</dt>
          <dd className="dk-num">{maskNik(row.doc.nik)}</dd>
        </div>
        <div>
          <dt>{t.dAddr}</dt>
          <dd>
            <Address row={row} lang={lang} kecName={kecName} desaName={desaName} />
          </dd>
        </div>
        <div>
          <dt>{t.dReason}</dt>
          <dd>{reason}</dd>
        </div>
        {row.result !== 'luar-zona' && row.result !== 'lolos' && (
          <div>
            <dt>{lang === 'id' ? 'Zona' : 'Zone'}</dt>
            <dd>{row.outsideZone ? t.dZoneOut(zoneNames.join(', ')) : t.dZoneOk}</dd>
          </div>
        )}
      </dl>
      {pairs.length > 0 && (
        <div className="dk-cb-dup">
          <h4>{t.dDup}</h4>
          <ul>
            {pairs.map(({ id, j }) => {
              const other = batch.rows[j]
              return (
                <li key={id}>
                  <span>
                    <b>{other?.doc.ownerName ?? id}</b>
                    <small className="dk-num">
                      #{String(j + 1).padStart(2, '0')} · {other ? kecName(other.doc.kecamatanId) : ''}
                    </small>
                  </span>
                  <Button size="sm" variant="quiet" iconEnd="arrowRight" onClick={() => onGoto(id)}>
                    {t.dGoto}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <p className="dk-cb-dnote">
        <Icon name="info" size={14} />
        {lang === 'id' ? 'Spesimen fiktif. Temuan adalah indikasi untuk diperiksa petugas, bukan keputusan akhir.' : 'Fictional specimen. Findings are indications for an officer to check, not a final decision.'}
      </p>
    </div>
  )
}
