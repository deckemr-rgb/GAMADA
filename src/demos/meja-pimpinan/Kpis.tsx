/**
 * Kpis — the six KPI cards (spec P2): complaints today (Δ vs yesterday), SLA on time, active alerts, negative
 * issues, overdue follow-ups, service index. Sekda sees the follow-up discipline as the hero number; a Kepala OPD
 * sees the six cards scoped to the chosen agency. Counts roll on change (kit Kpi count-up + flash).
 */
import { useI18n } from '../../lib/i18n'
import type { RoleId } from '../../content/products'
import { Kpi, KpiStrip } from '../../demo-kit/ui'
import { Sparkline } from '../../demo-kit/viz'
import { DAY_MIN, rows, shallowEqual, useWorld, type Minutes } from '../../demo-kit/world'
import { kpiStrip, opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { negativeIssues } from '../../demo-kit/world'
import { complaintDays, negativeHours, slaDays } from './data'
import { topicLabel, tr } from './strings'

export function Kpis({ now, role, opdId, compact }: { now: Minutes; role: RoleId; opdId: string; compact?: boolean }) {
  const { lang } = useI18n()
  const k = useWorld((s) => kpiStrip(s, now), shallowEqual)
  const days = useWorld((s) => complaintDays(s, now))
  const sla = useWorld((s) => slaDays(s, Math.floor(now / DAY_MIN)))
  const neg = useWorld((s) => negativeHours(s, now))
  const topNeg = useWorld((s) => negativeIssues(s, now)[0]?.topic ?? null)
  const cls = `dk-mp-kpis${compact ? ' is-compact' : ''}`

  if (role === 'kepala-opd') return <OpdKpis now={now} opdId={opdId} cls={cls} />
  const sekda = role === 'sekretariat'
  return (
    <KpiStrip label={tr('kpis', lang)} className={cls}>
      <Kpi label={tr('kComplaints', lang)} value={k.complaints.today} delta={k.complaints.delta} goodWhen="down" spark={!compact && <Sparkline values={days} label={tr('spark7', lang)} area />} />
      <Kpi label={tr('kSla', lang)} value={k.slaPct} unit="%" target={90} spark={!compact && <Sparkline values={sla} label={tr('sparkSla', lang)} />} />
      <Kpi label={tr('kAlerts', lang)} value={k.alerts} caption={k.alerts ? tr('cAlertsSome', lang) : tr('cAlertsNone', lang)} className={k.alerts ? 'is-danger' : undefined} />
      <Kpi label={tr('kNegative', lang)} value={k.negativeIssues} caption={topNeg ? `${tr('cNegative', lang)} ${topicLabel(topNeg, lang)}` : undefined} spark={!compact && <Sparkline values={neg} label={tr('sparkNeg', lang)} color="var(--dk-warn)" />} />
      <Kpi label={tr('kOverdue', lang)} value={k.overdue} caption={tr('cOverdue', lang)} hero={sekda} className={k.overdue ? 'is-warn' : undefined} />
      <Kpi label={tr('kIndex', lang)} value={k.serviceIndex} unit="/100" caption={tr('cIndex', lang)} hero={!sekda} />
    </KpiStrip>
  )
}

function OpdKpis({ now, opdId, cls }: { now: Minutes; opdId: string; cls: string }) {
  const { lang } = useI18n()
  const lb = useWorld((s) => opdLeaderboard(s, now))
  const tasks = useWorld((s) => s.actionItems)
  const i = lb.findIndex((r) => r.opdId === opdId)
  const row = lb[i]
  const mine = rows(tasks).filter((a) => a.opdId === opdId && a.status !== 'selesai')
  const late = mine.filter((a) => a.dueAt < now).length
  // keyed by agency: switching the agency is a new view, not a change of the numbers (no "+n" tags)
  return (
    <KpiStrip key={opdId} label={tr('kpis', lang)} className={cls}>
      <Kpi label={tr('kOpdOpen', lang)} value={row?.openTickets ?? 0} />
      {row?.slaPct != null ? <Kpi label={tr('kOpdSla', lang)} value={row.slaPct} unit="%" target={90} /> : <NoData label={tr('kOpdSla', lang)} />}
      <Kpi label={tr('kOpdTasks', lang)} value={mine.length} />
      <Kpi label={tr('kOpdLate', lang)} value={late} className={late ? 'is-warn' : undefined} />
      {row?.rating != null ? <Kpi label={tr('kOpdRating', lang)} value={row.rating} decimals={1} unit="/5" /> : <NoData label={tr('kOpdRating', lang)} />}
      {i >= 0 ? <Kpi label={tr('kOpdRank', lang)} value={i + 1} unit={`/${lb.length}`} hero /> : <NoData label={tr('kOpdRank', lang)} />}
    </KpiStrip>
  )
}

/** a KPI cell without a number yet (no closed tickets / ratings for this agency) */
function NoData({ label }: { label: string }) {
  const { lang } = useI18n()
  return (
    <div className="dk-kpi" role="group" aria-label={`${label}: ${tr('noSla', lang)}`}>
      <span className="dk-kpi-label" aria-hidden="true">
        {label}
      </span>
      <div className="dk-kpi-row" aria-hidden="true">
        <span className="dk-kpi-val dk-mp-na">–</span>
      </div>
      <span className="dk-kpi-cap" aria-hidden="true">
        {tr('noSla', lang)}
      </span>
    </div>
  )
}
