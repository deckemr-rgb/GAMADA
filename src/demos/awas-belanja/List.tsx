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
import { BAND_TONE, SLUG, daysLeft, findPump, isAnalysed, kecName, riskBand, rpShort, PUMP_KEY } from './model'
import { preloadDetail } from './preload'
import { useT, type Strings, type Lang } from './strings'
import type { RoleKey, TabId } from './types'

type Filter = 'aktif' | 'semua' | 'berisiko'
const ACTIVE: Procurement['status'][] = ['perencanaan', 'pengumuman', 'evaluasi']
const DEFAULT_FILTER: Record<RoleKey, Filter> = { ukpbj: 'aktif', inspektorat: 'semua' }

interface Kpis {
  active: number
  value: number
  high: number
  unanalysed: number
  gap: number
  corrected: number
}
function kpis(s: WorldState): Kpis {
  let active = 0, value = 0, high = 0, unanalysed = 0, gap = 0, corrected = 0
  for (const p of rows(s.procurements)) {
    if (p.status === 'selesai') continue
    active++
    value += p.recommendation ? p.recommendation.hpsCorrected : p.hps
    if ((p.riskScore ?? 0) >= 60) high++
    if (!isAnalysed(p)) unanalysed++
    const over = p.items.reduce((a, i) => a + (i.hpsPrice - i.marketPrice) * i.qty, 0)
    if (p.recommendation) corrected += Math.max(0, p.hps - p.recommendation.hpsCorrected)
    else gap += Math.max(0, over)
  }
  return { active, value, high, unanalysed, gap, corrected }
}

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
  const k = useWorld(kpis, shallowEqual)
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
        <Kpi label={t.kpiActive} value={k.active} caption={t.sim} />
        <Kpi label={t.kpiValue} value={k.value} format={(n) => rpShort(n, lang)} caption={t.kpiValueCap} />
        <Kpi label={t.kpiHigh} value={k.high} caption={t.kpiHighCap(k.unanalysed)} />
        <Kpi label={t.kpiGap} value={k.gap} format={(n) => rpShort(n, lang)} caption={k.corrected > 0 ? t.kpiSavedCap(rpShort(k.corrected, lang)) : t.kpiGapCap} />
      </KpiStrip>

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
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ flood banner */

const FloodBanner = memo(function FloodBanner({ b, t, lang, onOpen, onShortcut }: { b: Banner; t: Strings; lang: Lang; onOpen: ListProps['onOpen']; onShortcut: () => void }) {
  const session = useSession()
  // phones: a shorter label, so the hotspot badge (bottom-right corner) never covers the words
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
          {/* the hotspot sits on this wrapper: its padding keeps the ring off the button label (kit places it on the corner) */}
          <span className="dk-ab-hs" data-hotspot="ab-start">
            <Button
              size="sm"
              variant="primary"
              icon="alert"
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
          </span>
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

/* ------------------------------------------------------------------ table columns */

function RiskCell({ p, t }: { p: Procurement; t: Strings }) {
  if (p.riskScore == null) return <span className="dk-ab-risk is-none">{t.notAnalysed}</span>
  const band = riskBand(p.riskScore)
  return (
    <span className={`dk-ab-risk is-${band}`}>
      <b className="dk-num">{p.riskScore}</b>
      <span>{isAnalysed(p) ? t.riskBand[band] : t.prelim}</span>
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
      { id: 'hps', header: t.colHps, numeric: true, min: 110, value: (r) => r.procurement.hps, cell: (r) => rpShort(r.procurement.hps, lang) },
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
