/**
 * demos/pantau-merek/Channels.tsx — sentiment per channel (`sentimentByChannel`, shop, 24 h) as a local stacked bar
 * (positive · neutral · negative) + net score and a one-line text summary. Pure props.
 */
import { memo } from 'react'
import type { BrandMention } from '../../demo-kit/world'
import { BRAND_CHANNEL } from '../../demo-kit/world/usaha-pintar'
import { fill, signed, type Lang, type Strings } from './strings'

export interface ChannelRow { channel: BrandMention['channel']; pos: number; neu: number; neg: number; net: number }

export const Channels = memo(function Channels({ rows, t, lang }: { rows: ChannelRow[]; t: Strings; lang: Lang }) {
  const used = rows.filter((r) => r.pos + r.neu + r.neg > 0)
  const worst = [...used].sort((a, b) => a.net - b.net)[0]
  const best = [...used].sort((a, b) => b.net - a.net)[0]
  return (
    <section className="dk-pm-card dk-pm-chan" aria-labelledby="dk-pm-chan-h">
      <header className="dk-pm-sec-h">
        <h3 id="dk-pm-chan-h" className="dk-pm-sec-t">
          {t.chTitle}
          <span className="dk-pm-sec-meta">{t.chUnit}</span>
        </h3>
      </header>
      <ul className="dk-pm-stack">
        {rows.map((r) => {
          const n = Math.max(1, r.pos + r.neu + r.neg)
          return (
            <li key={r.channel} data-channel={r.channel}>
              <span className="dk-pm-stack-l">{BRAND_CHANNEL[r.channel][lang]}</span>
              <span className="dk-pm-stack-bar" aria-hidden="true">
                <i className="is-pos" style={{ flexGrow: r.pos / n }} />
                <i className="is-neu" style={{ flexGrow: r.neu / n }} />
                <i className="is-neg" style={{ flexGrow: r.neg / n }} />
              </span>
              <span className={`dk-pm-stack-net dk-num${r.net < 0 ? ' is-neg' : r.net > 0 ? ' is-pos' : ''}`}>
                <span className="dk-sr">{t.chNet} </span>
                {signed(r.net, lang)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="dk-pm-note">
        <span className="dk-pm-legend" aria-hidden="true">
          <i className="is-pos" />
          <i className="is-neu" />
          <i className="is-neg" />
        </span>
        {t.chLegend}
      </p>
      {worst && best && (
        <p className="dk-pm-note">
          {fill(t.chSummary, { c: BRAND_CHANNEL[worst.channel][lang], n: signed(worst.net, lang), p: BRAND_CHANNEL[best.channel][lang], q: signed(best.net, lang) })}
        </p>
      )}
    </section>
  )
})
