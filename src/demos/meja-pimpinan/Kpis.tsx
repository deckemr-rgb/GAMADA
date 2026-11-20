/**
 * Kpis — the six KPI cards (spec P2): complaints today (Δ vs yesterday), SLA on time, active alerts, negative
 * issues, overdue follow-ups, service index. Sekda sees the follow-up discipline as the hero number; a Kepala OPD
 * sees the six cards scoped to the chosen agency. Counts roll on change (kit Kpi count-up + flash).
 */
import { useI18n } from '../../lib/i18n'
import type { RoleId } from '../../content/products'
import { Kpi, KpiStrip } from '../../demo-kit/ui'
import { DAY_MIN, rows, shallowEqual, useWorld, type Minutes } from '../../demo-kit/world'
import { kpiStrip } from '../../demo-kit/world/satu-daerah'
import { negativeIssues } from '../../demo-kit/world'
import { complaintDays, mpLeaderboard, mpServiceIndex, negativeHours, rankedCount, riverNow, riverState, slaDays, useNow } from './data'
import { nf, topicLabel, tr, trf } from './strings'

/**
 * The tiles' sparkline: line, optional 16% area, end dot, and a spoken summary ("naik dari 12 ke 19"). Drawn here
 * rather than with the kit's viz Sparkline, which brings the chart frame and the number formatters (≈ 8 KB gzip) into
 * this first screen for three 28 px lines. The SVG stretches to the slot (no ResizeObserver); the stroke keeps 1.5 px.
 */
function Spark({ values, label, area, color = 'currentColor' }: { values: number[]; label: string; area?: boolean; color?: string }) {
  const { lang } = useI18n()
  const n = values.length
  const H = 28
  const lo = n ? Math.min(...values) : 0
  const hi = n ? Math.max(...values) : 1
  const x = (i: number) => 3 + (i / Math.max(1, n - 1)) * 93
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join('')
  const first = values[0] ?? 0
  const last = values[n - 1] ?? 0
  const num = (v: number) => nf(lang, v, Number.isInteger(v) ? 0 : 1)
  const trend = tr(last > first ? 'sparkUp' : last < first ? 'sparkDown' : 'sparkFlat', lang)
  return (
    <div className="dk-mp-spark" role="img" aria-label={trf('sparkAria', lang, { l: label, t: trend, a: num(first), b: num(last) })}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {area && n > 1 && <path d={`${line}L${x(n - 1).toFixed(2)},${H}L${x(0).toFixed(2)},${H}Z`} style={{ fill: color, fillOpacity: 0.16 }} />}
        <path d={line} fill="none" vectorEffect="non-scaling-stroke" style={{ stroke: color, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      </svg>
      {n > 0 && <span className="dk-mp-spark-dot" style={{ left: `${x(n - 1)}%`, top: y(last), background: color }} aria-hidden="true" />}
    </div>
  )
}

export function Kpis({ role, opdId, compact }: { role: RoleId; opdId: string; compact?: boolean }) {
  const { lang } = useI18n()
  const now = useNow(1)
  const k = useWorld((s) => kpiStrip(s, now), shallowEqual)
  const days = useWorld((s) => complaintDays(s, now))
  const sla = useWorld((s) => slaDays(s, Math.floor(now / DAY_MIN)))
  const neg = useWorld((s) => negativeHours(s, now))
  const topNeg = useWorld((s) => negativeIssues(s, now)[0]?.topic ?? null)
  // the index without the "new task dilutes the late ratio" effect (only follow-ups already due count)
  const svc = useWorld((s) => mpServiceIndex(s, now))
  const index = svc.index
  // no warning out while the river is past SIAGA: the tile says so (the same reading as the briefing and Siaga Wilayah)
  const river = useWorld((s) => riverNow(s, now)?.state ?? 'normal')
  const alertsCap = k.alerts ? tr('cAlertsSome', lang) : river !== 'normal' ? trf('cAlertsRiver', lang, { s: riverState(river)[lang] }) : tr('cAlertsNone', lang)
  const cls = `dk-mp-kpis${compact ? ' is-compact' : ''}`

  if (role === 'kepala-opd') return <OpdKpis now={now} opdId={opdId} cls={cls} />
  const sekda = role === 'sekretariat'
  return (
    <KpiStrip label={tr('kpis', lang)} className={cls}>
      <Kpi label={tr('kComplaints', lang)} value={k.complaints.today} delta={k.complaints.delta} goodWhen="down" spark={!compact && <Spark values={days} label={tr('spark7', lang)} area />} />
      <Kpi label={tr('kSla', lang)} value={svc.sla} unit="%" target={90} spark={!compact && <Spark values={sla} label={tr('sparkSla', lang)} />} />
      <Kpi label={tr('kAlerts', lang)} value={k.alerts} caption={alertsCap} className={k.alerts ? 'is-danger' : river !== 'normal' ? 'is-warn' : undefined} />
      <Kpi label={tr('kNegative', lang)} value={k.negativeIssues} caption={topNeg ? `${tr('cNegative', lang)} ${topicLabel(topNeg, lang)} · ${tr('cNeg24', lang)}` : tr('cNeg24', lang)} spark={!compact && <Spark values={neg} label={tr('sparkNeg', lang)} color="var(--dk-warn)" />} />
      <Kpi label={tr('kOverdue', lang)} value={k.overdue} caption={tr('cOverdue', lang)} hero={sekda} className={k.overdue ? 'is-warn' : undefined} />
      <Kpi label={tr('kIndex', lang)} value={index} unit="/100" caption={tr('cIndex', lang)} hero={!sekda} />
    </KpiStrip>
  )
}

function OpdKpis({ now, opdId, cls }: { now: Minutes; opdId: string; cls: string }) {
  const { lang } = useI18n()
  const lb = useWorld((s) => mpLeaderboard(s, now))
  const tasks = useWorld((s) => s.actionItems)
  const row = lb.find((r) => r.opdId === opdId)
  const mine = rows(tasks).filter((a) => a.opdId === opdId && a.status !== 'selesai')
  const late = mine.filter((a) => a.dueAt < now).length
  // keyed by agency: switching the agency is a new view, not a change of the numbers (no "+n" tags)
  return (
    <KpiStrip key={opdId} label={tr('kpis', lang)} className={cls}>
      <Kpi label={tr('kOpdOpen', lang)} value={row?.openTickets ?? 0} caption={row?.lateTickets ? `${row.lateTickets} ${tr('colPastSla', lang).toLowerCase()}` : undefined} className={row?.lateTickets ? 'is-warn' : undefined} />
      {row?.slaPct != null ? <Kpi label={tr('kOpdSla', lang)} value={row.slaPct} unit="%" target={90} /> : <NoData label={tr('kOpdSla', lang)} />}
      <Kpi label={tr('kOpdTasks', lang)} value={mine.length} />
      <Kpi label={tr('kOpdLate', lang)} value={late} className={late ? 'is-warn' : undefined} />
      {row?.rating != null ? <Kpi label={tr('kOpdRating', lang)} value={row.rating} decimals={1} unit="/5" /> : <NoData label={tr('kOpdRating', lang)} />}
      {row?.rank != null ? <Kpi label={tr('kOpdRank', lang)} value={row.rank} unit={`/${rankedCount(lb)}`} hero /> : <NoData label={tr('kOpdRank', lang)} />}
    </KpiStrip>
  )
}

/** a KPI cell without a number yet (no closed tickets / ratings for this agency) */
function NoData({ label }: { label: string }) {
  const { lang } = useI18n()
  return (
    <div className="dk-kpi" role="group" aria-label={`${label}: ${tr('notEnough', lang)}`}>
      <span className="dk-kpi-label" aria-hidden="true">
        {label}
      </span>
      <div className="dk-kpi-row" aria-hidden="true">
        <span className="dk-kpi-val dk-mp-na">–</span>
      </div>
      <span className="dk-kpi-cap" aria-hidden="true">
        {tr('notEnough', lang)}
      </span>
    </div>
  )
}
