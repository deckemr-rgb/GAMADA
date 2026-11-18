/**
 * demos/pantau-merek/Competitors.tsx — Kompetitor (lazy): `competitorCompare(s, now, 7)` = share of voice (Donut), net
 * sentiment, average rating, top complaint, reply rate, median reply time and the 7-day reputation per brand. The
 * metric Segmented (Reputasi · Waktu balas · Rating) switches the comparison chart (mission 3). Table → cards < 640 px.
 * Competitor reply data is not in the world: those two cells are a stable simulated estimate and say so.
 */
import { useState } from 'react'
import { Segmented } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { BRAND_TOPIC, competitorCompare, type CompetitorRow } from '../../demo-kit/world/usaha-pintar'
import { useBrand } from './model'
import { AskLauncher } from './AskLauncher'
import { fill, nf, signed, useStr, type Lang } from './strings'

type Metric = 'rep' | 'reply' | 'rating'

const S = {
  id: {
    title: 'Toko vs pesaing · 7 hari',
    lead: 'Merek pesaing fiktif di pasar yang sama. Data simulasi.',
    metric: 'Metrik perbandingan',
    m: { rep: 'Reputasi', reply: 'Waktu balas', rating: 'Rating' } as Record<Metric, string>,
    sov: 'Porsi percakapan',
    sovUnit: 'sebutan 7 hari',
    cols: ['Merek', 'Porsi', 'Sentimen net', 'Rating', 'Keluhan utama', 'Tingkat balas', 'Balas median', 'Reputasi'],
    est: 'perkiraan',
    you: 'toko Anda',
    repT: 'Reputasi harian (0–100)',
    replyT: 'Waktu balas median',
    ratingT: 'Rating rata-rata (1–5)',
    summary: '{a}: {v}. Terbaik: {b} ({w}).',
    ask: 'Bandingkan dengan pesaing',
    askBtn: 'Bandingkan dengan AI',
    none: '–',
  },
  en: {
    title: 'Shop vs competitors · 7 days',
    lead: 'Fictional competitor brands in the same market. Simulated data.',
    metric: 'Comparison metric',
    m: { rep: 'Reputation', reply: 'Reply time', rating: 'Rating' } as Record<Metric, string>,
    sov: 'Share of voice',
    sovUnit: 'mentions, 7 days',
    cols: ['Brand', 'Share', 'Net sentiment', 'Rating', 'Top complaint', 'Reply rate', 'Median reply', 'Reputation'],
    est: 'estimate',
    you: 'your shop',
    repT: 'Daily reputation (0–100)',
    replyT: 'Median reply time',
    ratingT: 'Average rating (1–5)',
    summary: '{a}: {v}. Best: {b} ({w}).',
    ask: 'Compare with competitors',
    askBtn: 'Compare with AI',
    none: '–',
  },
}
const COLORS = ['var(--dk-eco-acc)', 'var(--dk-pos)', 'var(--dk-faint)']
const dur = (m: number | null, l: Lang) => (m == null ? '–' : m >= 60 ? `${Math.floor(m / 60)} ${l === 'id' ? 'j' : 'h'} ${m % 60} m` : `${m} m`)

/** share of voice: a local donut (stroke-dasharray on a circle of circumference 100), legend + text summary */
function ShareDonut({ rows, lang }: { rows: CompetitorRow[]; lang: Lang }) {
  const L = S[lang]
  let off = 0
  return (
    <figure className="dk-pm-donut" data-pm="sov" aria-label={L.sov}>
      <figcaption className="dk-pm-k">
        {L.sov} · {L.sovUnit}
      </figcaption>
      <div className="dk-pm-donut-row">
        <svg viewBox="0 0 42 42" aria-hidden="true">
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--dk-s2)" strokeWidth="6" />
          {rows.map((r, i) => {
            const el = <circle key={r.brand} cx="21" cy="21" r="15.9155" fill="none" stroke={COLORS[i % 3]} strokeWidth="6" strokeDasharray={`${r.share} ${100 - r.share}`} strokeDashoffset={25 - off} />
            off += r.share
            return el
          })}
          <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="dk-pm-donut-c">
            {rows[0]?.share ?? 0}%
          </text>
        </svg>
        <ul className="dk-pm-cmp-leg is-col">
          {rows.map((r, i) => (
            <li key={r.brand}>
              <i style={{ background: COLORS[i % 3] }} aria-hidden="true" />
              {r.label} <b className="dk-num">{r.share}%</b>
            </li>
          ))}
        </ul>
      </div>
      <p className="dk-sr">{rows.map((r) => `${r.label} ${r.share}%`).join(', ')}</p>
    </figure>
  )
}

function Compare({ rows, metric, lang }: { rows: CompetitorRow[]; metric: Metric; lang: Lang }) {
  const L = S[lang]
  if (metric === 'rep') {
    const n = rows[0]?.series.length ?? 7
    const x = (i: number) => (i / Math.max(1, n - 1)) * 100
    const last = rows.map((r) => ({ r, v: r.series[r.series.length - 1] ?? 0 }))
    const best = [...last].sort((a, b) => b.v - a.v)[0]
    return (
      <figure className="dk-pm-cmp" data-pm="cmp-rep" aria-label={L.repT}>
        <figcaption className="dk-pm-k">{L.repT}</figcaption>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          {rows.map((r, i) => (
            <polyline key={r.brand} points={r.series.map((v, j) => `${x(j).toFixed(1)},${(40 - (v / 100) * 40).toFixed(1)}`).join(' ')} fill="none" stroke={COLORS[i % 3]} strokeWidth={i ? 1.5 : 2.5} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <ul className="dk-pm-cmp-leg">
          {last.map(({ r, v }, i) => (
            <li key={r.brand}>
              <i style={{ background: COLORS[i % 3] }} aria-hidden="true" />
              {r.label} <b className="dk-num">{v}</b>
            </li>
          ))}
        </ul>
        <p className="dk-sr">{fill(L.summary, { a: rows[0]?.label ?? '', v: last[0]?.v ?? 0, b: best?.r.label ?? '', w: best?.v ?? 0 })}</p>
      </figure>
    )
  }
  const val = (r: CompetitorRow) => (metric === 'reply' ? (r.medianReplyMin ?? 0) : (r.avgRating ?? 0))
  const max = Math.max(1, ...rows.map(val))
  const fmt = (r: CompetitorRow) => (metric === 'reply' ? dur(r.medianReplyMin, lang) : r.avgRating == null ? '–' : r.avgRating.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'))
  const best = [...rows].sort((a, b) => (metric === 'reply' ? val(a) - val(b) : val(b) - val(a)))[0]
  return (
    <figure className="dk-pm-cmp" data-pm={`cmp-${metric}`} aria-label={metric === 'reply' ? L.replyT : L.ratingT}>
      <figcaption className="dk-pm-k">{metric === 'reply' ? L.replyT : L.ratingT}</figcaption>
      <ul className="dk-pm-bars">
        {rows.map((r, i) => (
          <li key={r.brand} className="dk-pm-bar">
            <span className="dk-pm-bar-l">{r.label}</span>
            <span className="dk-pm-bar-track" aria-hidden="true">
              <i style={{ transform: `scaleX(${val(r) / (metric === 'rating' ? 5 : max)})`, background: COLORS[i % 3] }} />
            </span>
            <span className="dk-pm-bar-v dk-num">{fmt(r)}</span>
          </li>
        ))}
      </ul>
      <p className="dk-sr">{fill(L.summary, { a: rows[0]?.label ?? '', v: rows[0] ? fmt(rows[0]) : '', b: best?.label ?? '', w: best ? fmt(best) : '' })}</p>
    </figure>
  )
}

export default function Competitors({ now }: { now: number }) {
  const { lang } = useStr()
  const L = S[lang]
  const shell = useShell()
  const [metric, setMetric] = useState<Metric>('rep')
  const rows = useBrand((s, n) => competitorCompare(s, n, 7), now)
  const own = rows[0]?.brand
  const onMetric = (m: Metric) => {
    setMetric(m)
    shell.markMission('kompetitor')
  }
  return (
    <div className="dk-pm-comp">
      <header className="dk-pm-head">
        <div className="dk-pm-head-t">
          <h2 className="dk-pm-h2">{L.title}</h2>
          <p className="dk-pm-lead">{L.lead}</p>
        </div>
        <div className="dk-pm-head-act">
          <Segmented<Metric> label={L.metric} value={metric} onChange={onMetric} options={(['rep', 'reply', 'rating'] as Metric[]).map((m) => ({ value: m, label: L.m[m] }))} className="dk-pm-metric" />
        </div>
      </header>
      <div className="dk-pm-comp-grid">
        <div className="dk-pm-card">
          <ShareDonut rows={rows} lang={lang} />
        </div>
        <div className="dk-pm-card">
          <Compare rows={rows} metric={metric} lang={lang} />
        </div>
      </div>
      <div className="dk-pm-card dk-pm-ctable-wrap">
        <table className="dk-pm-ctable" data-pm="comp-table">
          <thead>
            <tr>
              {L.cols.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mine = r.brand === own
              return (
                <tr key={r.brand} className={mine ? 'is-own' : undefined}>
                  <th scope="row" data-l={L.cols[0]}>
                    {r.label}
                    {mine && <span className="dk-pm-tagchip is-acc">{L.you}</span>}
                  </th>
                  <td data-l={L.cols[1]} className="dk-num">
                    {r.share}%
                  </td>
                  <td data-l={L.cols[2]} className="dk-num">
                    {signed(r.net, lang)}
                  </td>
                  <td data-l={L.cols[3]} className="dk-num">
                    {r.avgRating == null ? L.none : r.avgRating.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}
                  </td>
                  <td data-l={L.cols[4]}>{r.topComplaint ? BRAND_TOPIC[r.topComplaint][lang] : L.none}</td>
                  <td data-l={L.cols[5]} className="dk-num">
                    {nf(r.replyRate, lang)}%{!mine && <small> · {L.est}</small>}
                  </td>
                  <td data-l={L.cols[6]} className="dk-num">
                    {dur(r.medianReplyMin, lang)}
                    {!mine && <small> · {L.est}</small>}
                  </td>
                  <td data-l={L.cols[7]} className="dk-num" data-pm={mine ? 'comp-rep' : undefined}>
                    {r.series[r.series.length - 1] ?? L.none}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AskLauncher prompt={L.ask} label={L.askBtn} pm="ask-compare" />
    </div>
  )
}
