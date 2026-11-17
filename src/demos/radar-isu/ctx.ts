/**
 * demos/radar-isu/ctx.ts — the compact world summary the AI reads (≈ 3–5 KB JSON): the simulated scenario answers
 * from it (ctx.world) and Live sends the same object to the proxy, so both modes see exactly what is on screen.
 */
import { rows, type Bi, type WorldState } from '../../demo-kit/world'
import { getDeepResult, hoaxPhase, negIssues, radarKpis, sentimentIndex } from './model'
import { TOPIC } from './strings'

export interface RadarCtx {
  product: 'radar-isu'
  note: string
  region: string
  regionShort: string
  /** world minute + "HH:MM" */
  nowMin: number
  now: string
  kpis: {
    mentions24h: number
    prev24h: number
    sentimentIndex: number
    negativeTopics: number
    reach24h: number
  }
  topics: {
    topic: string
    label: Bi
    count: number
    reach: number
    score: number
  }[]
  /** topics with negative mentions in 24 h, most negative mentions first (the ecosystem's "isu negatif") */
  negIssues: {
    topic: string
    label: Bi
    /** negative mentions */
    count: number
    /** all mentions of the topic */
    total: number
    reach: number
    score: number
  }[]
  sentimentTrend: { at: string; value: number }[]
  hoax: null | {
    id: string
    status: 'aktif' | 'diklarifikasi'
    claim: Bi
    score: number
    spreadPerHour: number
    accounts: string[]
    evidence: Bi | null
    posts: number
    detectedAt: string
    firstPostAt: string | null
    clarification: { at: string; tone: string; channels: string[] } | null
  }
  burst: { posts: number; threshold: number } | null
  dam: {
    name: string
    level: number
    normal: number
    siaga: number
    awas: number
    updatedAt: string
  } | null
  latest: {
    outlet: string
    kind: string
    text: Bi
    sentiment: string
    topic: string
    reach: number
    at: string
  }[]
  outlets: { outlet: string; count: number }[]
  floodAlert: { level: number; kecamatan: string[] } | null
  complaintClusters: number
  deep: {
    keywords: string[]
    days: number
    lead: {
      keyword: string
      total: number
      momentum: number
      negative: number
    } | null
  } | null
}

const pad = (n: number) => String(n).padStart(2, '0')
export const hm = (min: number): string => {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function radarCtx(s: WorldState, now: number): RadarCtx {
  const k = radarKpis(s.mentions, now)
  const by = new Map<string, { n: number; reach: number; sum: number }>()
  const outlets = new Map<string, number>()
  for (const m of rows(s.mentions)) {
    if (m.at > now || m.at <= now - 1440) continue
    const g = by.get(m.topic) ?? { n: 0, reach: 0, sum: 0 }
    g.n++
    g.reach += m.reach
    g.sum += m.score
    by.set(m.topic, g)
    outlets.set(m.outlet, (outlets.get(m.outlet) ?? 0) + 1)
  }
  const topics = [...by.entries()]
    .map(([topic, g]) => ({
      topic,
      label: TOPIC[topic] ?? { id: topic, en: topic },
      count: g.n,
      reach: g.reach,
      score: Math.round((g.sum / g.n) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.reach - a.reach)
    .slice(0, 8)
  const neg = negIssues(s.mentions, now)
    .slice(0, 5)
    .map((n) => {
      const g = by.get(n.topic)
      return {
        topic: n.topic,
        label: TOPIC[n.topic] ?? { id: n.topic, en: n.topic },
        count: n.count,
        total: g?.n ?? n.count,
        reach: n.reach,
        score: g ? Math.round((g.sum / g.n) * 100) / 100 : -1,
      }
    })
  const series = sentimentIndex(s.mentions, now)
  const trend = series.filter((_, i) => i % 8 === 0 || i === series.length - 1).map((p) => ({ at: hm(p.at), value: p.value }))
  const ph = hoaxPhase(s, now)
  const g = s.gauges.byId[s.meta.facts.hoax.gaugeId]
  const alert = rows(s.alerts).find((a) => a.status === 'aktif' && a.kind === 'banjir')
  const deep = getDeepResult()
  const lead = deep ? [...deep.keywords].sort((a, b) => b.total - a.total)[0] : undefined
  const latest = rows(s.mentions)
    .filter((m) => m.at <= now)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((m) => ({
      outlet: m.outlet,
      kind: m.kind,
      text: m.text,
      sentiment: m.sentiment,
      topic: m.topic,
      reach: m.reach,
      at: hm(m.at),
    }))
  return {
    product: 'radar-isu',
    note: 'Semua media, akun, dan angka adalah SIMULASI (fiktif); nama tempat nyata.',
    region: s.region.name,
    regionShort: s.region.shortName,
    nowMin: now,
    now: hm(now),
    kpis: {
      mentions24h: k.count,
      prev24h: k.prev,
      sentimentIndex: k.sentiment,
      negativeTopics: k.negTopics,
      reach24h: k.reach,
    },
    topics,
    negIssues: neg,
    sentimentTrend: trend,
    hoax:
      ph.kind === 'active' || ph.kind === 'clarified'
        ? {
            id: ph.alert.id,
            status: ph.alert.status,
            claim: ph.alert.claim,
            score: ph.alert.score,
            spreadPerHour: ph.alert.spreadPerHour,
            accounts: ph.alert.accounts,
            evidence: ph.alert.evidence,
            posts: ph.posts.length,
            detectedAt: hm(ph.alert.at),
            firstPostAt: ph.posts[0] ? hm(ph.posts[0].at) : null,
            clarification: ph.alert.clarification
              ? {
                  at: hm(ph.alert.clarification.at),
                  tone: ph.alert.clarification.tone,
                  channels: ph.alert.clarification.channels,
                }
              : null,
          }
        : null,
    burst: ph.kind === 'burst' ? { posts: ph.posts.length, threshold: 6 } : null,
    dam: g
      ? {
          name: g.name,
          level: g.level,
          normal: g.normal,
          siaga: g.siaga,
          awas: g.awas,
          updatedAt: hm(g.updatedAt),
        }
      : null,
    latest,
    outlets: [...outlets.entries()]
      .map(([outlet, count]) => ({ outlet, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    floodAlert: alert
      ? {
          level: alert.level,
          kecamatan: alert.kecamatanIds.map((id) => s.region.kecamatan.find((x) => x.id === id)?.name ?? id),
        }
      : null,
    complaintClusters: rows(s.clusters).filter((c) => c.category === 'banjir').length,
    deep: deep
      ? {
          keywords: deep.input.keywords,
          days: deep.input.days,
          lead: lead
            ? {
                keyword: lead.keyword,
                total: lead.total,
                momentum: lead.momentum,
                negative: lead.sentiment.neg,
              }
            : null,
        }
      : null,
  }
}
