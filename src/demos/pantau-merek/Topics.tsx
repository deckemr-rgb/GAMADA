/**
 * demos/pantau-merek/Topics.tsx — topic bars of the shop's mentions in 24 h (`brandTopics`) with the change vs the
 * previous 24 h (a 2 px tick marks the previous count). Text summary for screen readers; pure props.
 */
import { memo } from 'react'
import type { BrandTopic } from '../../demo-kit/world'
import { BRAND_TOPIC } from '../../demo-kit/world/usaha-pintar'
import { fill, signed, type Lang, type Strings } from './strings'

export interface TopicRow { topic: BrandTopic; count: number; prev: number; delta: number }

export const Topics = memo(function Topics({ rows, t, lang }: { rows: TopicRow[]; t: Strings; lang: Lang }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.count, r.prev)))
  const top = [...rows].sort((a, b) => b.count - a.count)[0]
  return (
    <section className="dk-pm-card dk-pm-topics" aria-labelledby="dk-pm-topics-h">
      <header className="dk-pm-sec-h">
        <h3 id="dk-pm-topics-h" className="dk-pm-sec-t">
          {t.topicsTitle}
          <span className="dk-pm-sec-meta">{t.vsPrev}</span>
        </h3>
      </header>
      <ul className="dk-pm-bars">
        {rows.map((r) => (
          <li key={r.topic} className="dk-pm-bar" data-topic={r.topic}>
            <span className="dk-pm-bar-l">{BRAND_TOPIC[r.topic][lang]}</span>
            <span className="dk-pm-bar-track" aria-hidden="true">
              <i style={{ transform: `scaleX(${r.count / max})` }} />
              <b style={{ left: `${(r.prev / max) * 100}%` }} />
            </span>
            <span className="dk-pm-bar-v dk-num">{r.count}</span>
            <span className={`dk-pm-bar-d dk-num${r.delta > 0 ? ' is-up' : r.delta < 0 ? ' is-down' : ''}`}>{signed(r.delta, lang)}</span>
          </li>
        ))}
      </ul>
      {top && <p className="dk-sr">{fill(t.topicsSummary, { t: BRAND_TOPIC[top.topic][lang], n: top.count, d: signed(top.delta, lang) })}</p>}
    </section>
  )
})
