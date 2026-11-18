/**
 * List.tsx — first screen: KPI strip (simulated), the flood / emergency-package banner and the package table
 * (cards below 640 px). Role decides the default filter and the last column (UKPBJ: deadline · Inspektorat: winner).
 */
import { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, EmptyState, Icon, Input, Kpi, KpiStrip, Segmented, StatusChip, Table, type TableColumn } from '../../demo-kit/ui'
import { demoHref, useShell } from '../../demo-kit/shell'
import { clock, emit, hhmm, rows, shallowEqual, useClock, useSession, useWorld, world, type Procurement, type WorldState } from '../../demo-kit/world'
import { floodScenarioAlert, packages, type PackageRow } from '../../demo-kit/world/satu-daerah'
import { BAND_TONE, SLUG, analyse, daysLeft, findPump, isAnalysed, isOpenStage, kecName, prelimBefore, riskBand, rpShort, watchSummary, PUMP_KEY } from './model'
import { preloadDetail } from './preload'
import { useT, type Strings, type Lang } from './strings'
import type { RoleKey, TabId } from './types'

type Filter = 'aktif' | 'semua' | 'berisiko'
/** the history check threshold and the first screening (same values as index.tsx) */
const HISTORY_MIN = 60
const SCREEN_START = 7 * 60
const ACTIVE: Procurement['status'][] = ['perencanaan', 'pengumuman', 'evaluasi']
const DEFAULT_FILTER: Record<RoleKey, Filter> = { ukpbj: 'aktif', inspektorat: 'semua' }

interface Banner {
  pumpId: string | null
  pumpName: { id: string; en: string } | null
  pumpAt: number
  analysed: boolean
  score: number | null
  kec: string
}
function banner(s: WorldState): Banner {
  const p = findPump(s)
  const alert = p?.alertId ? s.alerts.byId[p.alertId] : rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif')
  return {
    pumpId: p?.id ?? null,
    pumpName: p?.name ?? null,
    pumpAt: p?.createdAt ?? 0,
    analysed: !!p && isAnalysed(p),
    score: p?.riskScore ?? null,
    kec: alert ? alert.kecamatanIds.map((k) => kecName(s, k)).join(', ') : '',
  }
}

export interface ListProps {
  roleKey: RoleKey
  fresh: string | null
  onOpen: (id: string, tab?: TabId, from?: 'row' | 'banner') => void
  /** the flood shortcut was pressed: open the pump package once it exists */
  onShortcut: () => void
}

export default function List({ roleKey, fresh, onOpen, onShortcut }: ListProps) {
  const { t, lang } = useT()
  const k = useWorld(watchSummary, shallowEqual)
  const all = useWorld(packages)
  const b = useWorld(banner, shallowEqual)
  const opdOf = useWorld((s) => s.region.opd)
  const { minutes: now } = useClock()
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER[roleKey])
  const [q, setQ] = useState('')
  useEffect(() => setFilter(DEFAULT_FILTER[roleKey]), [roleKey])
  const pickFilter = (f: Filter) => startTransition(() => setFilter(f))

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const short = (id: string) => opdOf.find((o) => o.id === id)?.short ?? ''
    return all.filter(({ procurement: p }) => {
      if (filter === 'aktif' && !ACTIVE.includes(p.status)) return false
      if (filter === 'berisiko' && (p.riskScore ?? 0) < 35) return false
      if (!words.length) return true
      const hay = `${p.name.id} ${p.name.en} ${p.code} ${short(p.opdId)}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [all, filter, q, opdOf])

  // the deadline column changes only when a "days left" value changes, not every clock minute (INP: the table
  // re-renders all its cells when the columns change)
  const nowRef = useRef(now)
  nowRef.current = now
  const daysKey = roleKey === 'inspektorat' ? '' : shown.map(({ procurement: p }) => (ACTIVE.includes(p.status) ? daysLeft(p, now) : 'x')).join(',')
  const columns = useColumns(t, lang, roleKey, nowRef, daysKey)

  return (
    <div className="dk-ab-list">
      <Header t={t} roleKey={roleKey} />
      <KpiStrip label={t.kpiLabel} className="dk-ab-kpis">
        {/* the money first: what an overpriced HPS would cost (the 30-second benefit) */}
        <Kpi wrapLabel className="dk-ab-kpi-gap" label={t.kpiGap} value={k.gap} format={(n) => rpShort(n, lang)} caption={k.proposed > 0 ? t.kpiSavedCap(rpShort(k.proposed, lang)) : t.kpiGapCap} />
        <Kpi wrapLabel label={t.kpiHigh} value={k.high + k.mid} caption={t.kpiHighCap(k.high, k.mid, k.prelim + k.none)} />
        <Kpi wrapLabel label={t.kpiValue} value={k.value} format={(n) => rpShort(n, lang)} caption={t.kpiValueCap} />
        <Kpi wrapLabel label={t.kpiActive} value={k.watched} caption={t.kpiActiveCap(k.tender, k.contract, k.done)} />
      </KpiStrip>

      <Screening t={t} lang={lang} onOpen={onOpen} />

      <FloodBanner b={b} t={t} lang={lang} onOpen={onOpen} onShortcut={onShortcut} />

      <Table<PackageRow>
        className="dk-ab-table"
        rows={shown}
        columns={columns}
        rowId={(r) => r.procurement.id}
        label={t.listTitle}
        onOpen={(r) => onOpen(r.procurement.id)}
        activeId={fresh}
        densityToggle={false}
        defaultDensity="comfy"
        rowTone={(r) => (r.procurement.riskScore == null ? undefined : riskBand(r.procurement.riskScore) === 'high' ? 'danger' : riskBand(r.procurement.riskScore) === 'mid' ? 'warn' : undefined)}
        announce={(r) => t.newRowAnnounce(r.procurement.name[lang])}
        toolbar={
          <span className="dk-ab-tt">
            <Icon name="awas" size={16} />
            {t.listTitle}
            <span className="dk-ab-count dk-num">{t.listCount(shown.length)}</span>
          </span>
        }
        actions={
          <>
            <Input icon="search" type="search" className="dk-ab-search" placeholder={t.search} aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} />
            <Segmented<Filter>
              size="sm"
              label={t.filterLabel}
              value={filter}
              onChange={pickFilter}
              options={[
                { value: 'aktif', label: t.fActive },
                { value: 'semua', label: t.fAll },
                { value: 'berisiko', label: t.fRisky },
              ]}
            />
          </>
        }
        empty={
          <EmptyState
            compact
            art="inbox"
            title={t.emptyFilter}
            body={t.emptyFilterBody}
            action={{
              label: t.emptyFilterReset,
              icon: 'refresh',
              onClick: () => {
                setQ('')
                pickFilter('semua')
              },
            }}
          />
        }
      />
      <p className="dk-ab-src">{t.dataSource}</p>
    </div>
  )
}

function Header({ t, roleKey }: { t: Strings; roleKey: RoleKey }) {
  return (
    <header className="dk-ab-head">
      <div>
        <p className="dk-ab-eyebrow">{t.workspace[roleKey]}</p>
        <h2 className="dk-ab-h">{t.lead}</h2>
        <p className="dk-ab-lead">{t.leadRole[roleKey]}</p>
        <p className="dk-ab-gloss">{t.glossary}</p>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ flood banner */

const FloodBanner = memo(function FloodBanner({ b, t, lang, onOpen, onShortcut }: { b: Banner; t: Strings; lang: Lang; onOpen: ListProps['onOpen']; onShortcut: () => void }) {
  const session = useSession()
  // phones: a shorter label that fits one line on a full-width button
  const narrow = useShell().size === 'sm'
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (b.pumpId) setBusy(false)
  }, [b.pumpId])
  if (!b.pumpId || !b.pumpName) {
    const keep = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : ''
    return (
      <section className="dk-ab-flood is-none" aria-label={t.floodNoneTitle}>
        <span className="dk-ab-flood-ic" aria-hidden="true">
          <Icon name="water" size={20} />
        </span>
        <div className="dk-ab-flood-tx">
          <p className="dk-ab-flood-t">{t.floodNoneTitle}</p>
          <p className="dk-ab-flood-b">{t.floodNoneBody}</p>
        </div>
        <div className="dk-ab-flood-act">
          <Link className="dk-btn dk-btn--secondary dk-btn--sm dk-ab-linkbtn" to={demoHref('siaga-wilayah', session) + keep}>
            <Icon name="siaga" size={16} />
            <span className="dk-btn-label">{t.floodOpenSiaga}</span>
            <Icon name="external" size={14} />
          </Link>
          <Button
            size="sm"
            variant="primary"
            icon="alert"
            data-hotspot="ab-start"
            data-ab="flood-shortcut"
            busy={busy}
            title={t.floodShortcutHint}
            onPointerEnter={preloadDetail}
            onFocus={preloadDetail}
            onClick={() => {
              if (busy) return
              setBusy(true)
              onShortcut()
              // paint the busy state first, then run the whole flood reaction chain (INP)
              requestAnimationFrame(() =>
                setTimeout(() => {
                  const s = world.get()
                  emit('flood.alert', floodScenarioAlert(s, clock.get().minutes, { level: 3 }), SLUG, { origin: 'siaga-wilayah' })
                }, 0),
              )
            }}
          >
            {narrow ? t.floodShortcutShort : t.floodShortcut}
          </Button>
        </div>
      </section>
    )
  }
  return (
    <section className={`dk-ab-flood ${b.analysed ? 'is-done' : 'is-live'}`} aria-label={t.floodLiveTitle(b.kec)}>
      <span className="dk-ab-flood-ic" aria-hidden="true">
        <Icon name={b.analysed ? 'shield' : 'alert'} size={20} />
      </span>
      <div className="dk-ab-flood-tx">
        <p className="dk-ab-flood-t">
          {b.analysed ? t.floodDone : t.floodLiveTitle(b.kec)}
          {b.analysed && b.score != null && (
            <Badge tone={BAND_TONE[riskBand(b.score)] === 'neutral' ? 'neutral' : BAND_TONE[riskBand(b.score)]}>{`${t.riskScore} ${b.score}`}</Badge>
          )}
        </p>
        <p className="dk-ab-flood-b">{t.floodLiveBody(b.pumpName[lang], hhmm(b.pumpAt))}</p>
      </div>
      <div className="dk-ab-flood-act">
        <Button size="sm" variant={b.analysed ? 'secondary' : 'primary'} iconEnd="forward" data-hotspot="ab-start" onPointerEnter={preloadDetail} onFocus={preloadDetail} onClick={() => b.pumpId && onOpen(b.pumpId, 'hps', 'banner')}>
          {t.floodOpenPkg}
        </Button>
      </div>
    </section>
  )
})

/* ------------------------------------------------------------------ latest screening (the world clock at work) */

/** the latest procurement.flagged of a package still being watched, by world time (the log's order is not relied on) */
const lastFlag = (s: WorldState): { id: string; at: number; source: string } | null => {
  let best: { id: string; at: number; source: string; key: string } | null = null
  for (const aid of s.auditLog.ids) {
    const a = s.auditLog.byId[aid]
    if (a?.type !== 'procurement.flagged') continue
    const ref = a.entityRefs.find((r) => r.startsWith('procurements:'))
    if (!ref) continue
    const id = ref.slice('procurements:'.length)
    if (s.procurements.byId[id]?.status === 'selesai') continue
    if (!best || a.at > best.at || (a.at === best.at && a.id > best.key)) best = { id, at: a.at, source: a.source, key: a.id }
  }
  return best && { id: best.id, at: best.at, source: best.source }
}

/** completed packages whose 7-detector score is high (the 07:00 history check flags the same ones) */
interface History {
  n: number
  opd: string
  lo: number
  hi: number
  top: string
}
function history(s: WorldState): History | null {
  const hits = rows(s.procurements)
    .filter((p) => p.status === 'selesai')
    .map((p) => ({ p, score: analyse(s, p.id).riskScore }))
    .filter((x) => x.score >= HISTORY_MIN)
    .sort((a, b) => b.score - a.score)
  if (!hits.length) return null
  const opds = new Map<string, number>()
  for (const h of hits) opds.set(h.p.opdId, (opds.get(h.p.opdId) ?? 0) + 1)
  const opdId = [...opds.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  return { n: hits.length, opd: s.region.opd.find((o) => o.id === opdId)?.short ?? opdId, lo: hits[hits.length - 1]!.score, hi: hits[0]!.score, top: hits[0]!.p.id }
}
/** re-screening heartbeat once every open package has a result (world minutes) */
const RESCAN_EVERY = 10

const Screening = memo(function Screening({ t, lang, onOpen }: { t: Strings; lang: Lang; onOpen: ListProps['onOpen'] }) {
  const last = useWorld(lastFlag, shallowEqual)
  const p = useWorld((s) => (last ? s.procurements.byId[last.id] : undefined))
  const waiting = useWorld((s) => rows(s.procurements).filter((q) => isOpenStage(q) && q.riskScore == null).length)
  const watched = useWorld((s) => rows(s.procurements).filter((q) => q.status !== 'selesai').length)
  // completed packages never change during a session: computed once (analysis is pure)
  const hist = useMemo(() => history(world.get()), [])
  const { running, minutes } = useClock()
  const band = p?.riskScore != null ? riskBand(p.riskScore) : null
  const rescanAt = Math.floor(minutes / RESCAN_EVERY) * RESCAN_EVERY
  const rescan = !!last && !waiting && rescanAt > last.at
  let line = t.screenIdle
  let from: string | null = null
  if (p && last && band) {
    const full = isAnalysed(p)
    const pass = full && !p.findings.some((f) => f.level !== 'lolos')
    line = !full ? t.screenPrelim(hhmm(last.at), p.name[lang], p.riskScore ?? 0, t.riskBand[band] ?? band) : pass ? t.screenPass(hhmm(last.at), p.name[lang]) : t.screenLine(hhmm(last.at), p.name[lang], p.riskScore ?? 0, t.riskBand[band] ?? band)
    const was = prelimBefore.get(p.id)
    if (full && was != null && was !== p.riskScore) from = t.screenFrom(was)
  }
  return (
    <section className={`dk-ab-screen${running ? ' is-run' : ''}`} aria-label={t.screenLabel}>
      {hist && minutes >= SCREEN_START && (
        <div className="dk-ab-screen-row is-hist">
          <Icon name="alert" size={16} className="dk-ab-screen-ic" />
          <p className="dk-ab-screen-tx">
            <span>{t.historyLine(hist.n, hist.opd, hist.lo, hist.hi)}</span>
          </p>
          <button type="button" className="dk-ab-inlink" onPointerEnter={preloadDetail} onClick={() => onOpen(hist.top, 'patterns')}>
            {t.historyOpen}
            <Icon name="forward" size={12} />
          </button>
        </div>
      )}
      <div className="dk-ab-screen-row">
        <span className="dk-ab-screen-dot" aria-hidden="true" />
        <p className="dk-ab-screen-tx" aria-live="polite">
          <b>{last && last.source !== 'clock' ? t.lastAnalysis : t.screenLabel}</b>
          <span>{line}</span>
          {from && <small className="dk-ab-screen-from">{from}</small>}
          {rescan && <small className="dk-ab-screen-from">{t.rescan(hhmm(rescanAt), watched)}</small>}
        </p>
        {p && (
          <button type="button" className="dk-ab-inlink" onPointerEnter={preloadDetail} onClick={() => onOpen(p.id, isAnalysed(p) ? 'patterns' : 'hps')}>
            {t.screenOpen}
            <Icon name="forward" size={12} />
          </button>
        )}
      </div>
    </section>
  )
})

/* ------------------------------------------------------------------ table columns */

function RiskCell({ p, t }: { p: Procurement; t: Strings }) {
  if (p.riskScore == null) return <span className="dk-ab-risk is-none">{t.notAnalysed}</span>
  const band = riskBand(p.riskScore)
  const full = isAnalysed(p)
  // a package where every detector passed reads "Lolos", not a bare "0"
  const pass = full && !p.findings.some((f) => f.level !== 'lolos')
  const was = full ? prelimBefore.get(p.id) : undefined
  return (
    <span className={`dk-ab-risk is-${pass ? 'pass' : band}`}>
      <b className="dk-num">{pass ? t.passShort : p.riskScore}</b>
      <span>{pass ? t.screenPassShort : full ? t.riskBand[band] : t.prelim}</span>
      {was != null && was !== p.riskScore && <small className="dk-ab-risk-was dk-num">{t.wasScore(was)}</small>}
    </span>
  )
}

function useColumns(t: Strings, lang: Lang, roleKey: RoleKey, nowRef: { readonly current: number }, daysKey: string): TableColumn<PackageRow>[] {
  const opd = useWorld((s) => s.region.opd)
  const bidderName = useWorld((s) => s.bidders)
  return useMemo<TableColumn<PackageRow>[]>(() => {
    const short = (id: string) => opd.find((o) => o.id === id)?.short ?? id
    const cols: TableColumn<PackageRow>[] = [
      {
        id: 'pkg',
        header: t.colPkg,
        card: 'title',
        min: 240,
        grow: 3,
        value: (r) => r.procurement.name[lang],
        cell: (r) => (
          <span className="dk-ab-pkg" data-pid={r.procurement.id} onPointerEnter={preloadDetail}>
            <span className="dk-ab-pkg-n" title={r.procurement.name[lang]}>
              {r.procurement.key === PUMP_KEY && <i className="dk-ab-dot" aria-hidden="true" />}
              {r.procurement.name[lang]}
            </span>
            <span className="dk-ab-pkg-m dk-num">
              {r.procurement.code}
              {r.procurement.emergency && <span className="dk-ab-emg">{t.emergency}</span>}
            </span>
          </span>
        ),
      },
      { id: 'opd', header: t.colOpd, min: 90, grow: 1, value: (r) => short(r.procurement.opdId) },
      {
        id: 'hps',
        header: t.colHps,
        numeric: true,
        min: 110,
        value: (r) => r.procurement.hps,
        // a proposed correction shows under the HPS (the same two numbers as the package header)
        cell: (r) =>
          r.procurement.recommendation ? (
            <span className="dk-ab-hpscell">
              {rpShort(r.procurement.hps, lang)}
              <small className="dk-ab-hpscell-p">{t.proposedShort(rpShort(r.procurement.recommendation.hpsCorrected, lang))}</small>
            </span>
          ) : (
            rpShort(r.procurement.hps, lang)
          ),
      },
      { id: 'method', header: t.colMethod, min: 120, grow: 1, value: (r) => t.method[r.procurement.method] ?? r.procurement.method },
      {
        id: 'status',
        header: t.colStatus,
        min: 110,
        value: (r) => r.procurement.status,
        cell: (r) => <StatusChip label={t.status[r.procurement.status] ?? r.procurement.status} tone={r.procurement.status === 'pengumuman' || r.procurement.status === 'evaluasi' ? 'new' : r.procurement.status === 'selesai' ? 'done' : 'neutral'} />,
      },
      roleKey === 'inspektorat'
        ? {
            id: 'winner',
            header: t.colWinner,
            min: 140,
            grow: 1,
            value: (r) => (r.procurement.winnerId ? (bidderName.byId[r.procurement.winnerId]?.name ?? '') : ''),
            cell: (r) => {
              const w = r.procurement.winnerId ? bidderName.byId[r.procurement.winnerId] : undefined
              return w ? `${w.legal} ${w.name}` : t.noWinner
            },
          }
        : {
            id: 'deadline',
            header: t.colDeadline,
            min: 110,
            value: (r) => r.procurement.deadlineAt,
            cell: (r) => {
              if (!ACTIVE.includes(r.procurement.status)) return <span className="dk-faint">{t.closed}</span>
              const d = daysLeft(r.procurement, nowRef.current)
              return <span className={d <= 3 ? 'dk-ab-soon' : undefined}>{t.daysLeft(d)}</span>
            },
          },
      {
        id: 'risk',
        header: t.colRisk,
        card: 'meta',
        min: 120,
        value: (r) => r.procurement.riskScore ?? -1,
        cell: (r) => <RiskCell p={r.procurement} t={t} />,
      },
    ]
    return cols
  }, [t, lang, roleKey, daysKey, nowRef, opd, bidderName]) // eslint-disable-line react-hooks/exhaustive-deps
}
