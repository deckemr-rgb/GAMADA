/**
 * demos/pantau-merek/ctx.ts — the compact world summary the AI reads (sim scenario and Live, ≤ 6 KB): the alert, its
 * clusters with real sample texts, KPI, flood, affected orders, competitors and up to 8 selected reviews.
 */
import { WORLD, type WorldState } from '../../demo-kit/world'
import { affectedOrders, brandKpi, brandTopics, competitorCompare, complaintClusters, mentionPlace, reputationAt } from '../../demo-kit/world/usaha-pintar'
import { cardAlert, floodNotice, recovery, reviewSelection, shopOf } from './model'
import { alertKecs } from './announce-text'

export function brandCtx(s: WorldState, now: number) {
  const shop = shopOf(s)
  const { alert, ann } = cardAlert(s, now)
  const clusters = alert ? complaintClusters(s, now, alert.id) : []
  const pick = reviewSelection
    .get()
    .slice(0, 8)
    .map((id) => s.brandMentions.byId[id])
    .filter((m) => !!m)
    .map((m) => ({ id: m!.id, author: m!.author, text: m!.text[m!.lang ?? 'id'], item: m!.item ?? null, order: m!.orderCode ?? null, desa: mentionPlace(s, m!).desa, daysLate: m!.daysLate ?? null, lang: m!.lang ?? 'id' }))
  const rec = recovery(s, now)
  return {
    product: 'pantau-merek' as const,
    now,
    shop: { name: shop.name, owner: shop.ownerFirst, market: shop.market },
    region: s.region.shortName,
    kpi: brandKpi(s, now),
    repYesterday: reputationAt(s, now - 1440, s.meta.shopId),
    alert: alert ? { id: alert.id, at: alert.at, volume: alert.volume, deltaPct: alert.deltaPct, baselinePer2h: alert.baselinePer2h, status: alert.status, kecs: alertKecs(s, alert.id) } : null,
    announcement: ann ? { at: ann.at, channels: ann.channels, offer: ann.offer } : null,
    clusters: clusters.map((c) => ({ key: c.key, label: c.label, count: c.count, share: c.share, samples: c.sampleIds.map((id) => s.brandMentions.byId[id]?.text.id ?? '').filter(Boolean).slice(0, 2) })),
    pumpFactorPct: Math.round((WORLD.floodDemandFactor - 1) * 100),
    flood: floodNotice(s),
    affected: (() => {
      const a = affectedOrders(s, now)
      return { count: a.count, value: a.value }
    })(),
    topics: brandTopics(s, now, 24),
    competitors: competitorCompare(s, now, 7).map((r) => ({ label: r.label, share: r.share, net: r.net, avgRating: r.avgRating, topComplaint: r.topComplaint, replyRate: r.replyRate, medianReplyMin: r.medianReplyMin, rep: r.series[r.series.length - 1] ?? null })),
    recovery: rec,
    selected: pick,
  }
}
export type BrandCtx = ReturnType<typeof brandCtx>
