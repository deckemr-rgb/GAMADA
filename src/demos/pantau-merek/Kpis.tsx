/**
 * demos/pantau-merek/Kpis.tsx — the KPI strip (`brandKpi`): reputation 0–100 (simulated index), shop mentions in 24 h,
 * unanswered complaints, median reply time. Pure props: reusable on the product page.
 */
import { memo } from 'react'
import { Kpi, KpiStrip } from '../../demo-kit/ui'
import { fill, type Strings } from './strings'

export interface KpiData {
  reputation: number
  repYesterday: number
  mentions24h: number
  unreplied: number
  medianReplyMin: number | null
}

export const Kpis = memo(function Kpis({ k, t }: { k: KpiData; t: Strings }) {
  return (
    <section className="dk-pm-kpis" aria-label={t.kpiLabel} data-pm="kpis">
      <KpiStrip>
        <Kpi
          hero
          label={t.kpiRep}
          value={k.reputation}
          unit="/100"
          delta={k.reputation - k.repYesterday}
          goodWhen="up"
          deltaLabel={t.vsYesterday}
          caption={`${t.kpiRepCap} · ${t.sim}`}
          wrapLabel
        />
        <Kpi label={t.kpiMentions} value={k.mentions24h} caption={t.kpiMentionsCap} wrapLabel />
        <Kpi label={t.kpiUnreplied} value={k.unreplied} caption={t.kpiUnrepliedCap} wrapLabel />
        <Kpi label={t.kpiMedian} value={k.medianReplyMin ?? 0} format={(n) => (k.medianReplyMin == null ? '–' : t.dur(Math.round(n)))} caption={fill('{c} · {s}', { c: t.kpiMedianCap, s: t.sim })} wrapLabel />
      </KpiStrip>
    </section>
  )
})
