/**
 * PriceCard.tsx — standalone (pure props): `priceAdvice` (fair range from the bid/HPS history, HPS, the shop's cost
 * price) and the bid price the document will carry (`price` = Σ unit prices × qty, model.bidLines). What-if chips
 * −3 % / Saran / +3 % recompute price, margin and the position against past bids.
 */
import type { Lang } from './model'
import { rp } from './model'
import { STRINGS } from './strings'

export interface PriceAdvice { hps: number; cost: number | null; range: [number, number]; suggested: number; margin: number | null; ratio: number; history: number[] }
export interface PriceCardProps {
  advice: PriceAdvice
  /** the bid price (the composed document's total) */
  price: number
  delta: -0.03 | 0 | 0.03
  onDelta?: (d: -0.03 | 0 | 0.03) => void
  lang: Lang
}

const pctTxt = (v: number, lang: Lang) => `${(Math.round(v * 1000) / 10).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}%`

export default function PriceCard({ advice, price, delta, onDelta, lang }: PriceCardProps) {
  const t = STRINGS[lang]
  const ratio = advice.hps > 0 ? price / advice.hps : 0
  const margin = advice.cost !== null && price > 0 ? (price - advice.cost) / price : null
  // strip plot 0.80 … 1.00 of the HPS
  const lo = 0.8
  const x = (r: number) => Math.max(0, Math.min(1, (r - lo) / (1 - lo))) * 100
  const opts: { v: -0.03 | 0 | 0.03; label: string }[] = [
    { v: -0.03, label: t.priceMinus },
    { v: 0, label: t.priceBase },
    { v: 0.03, label: t.pricePlus },
  ]
  return (
    <section className="dk-tp-price" aria-label={t.priceTitle} data-tp="price" data-price={price}>
      <header className="dk-tp-card-h">
        <h3>{t.priceTitle}</h3>
        <span className="dk-tp-sim">{t.priceSim}</span>
      </header>
      <div className="dk-tp-price-main">
        <span className="dk-tp-price-label">{t.priceSuggested}</span>
        <strong className="dk-tp-price-v dk-num" data-tp="bid-price">
          {rp(price)}
        </strong>
        <span className="dk-tp-price-ratio">{t.priceRatio(pctTxt(ratio, lang))}</span>
      </div>
      {onDelta && (
        <div className="dk-tp-whatif" role="group" aria-label={t.priceWhatIf}>
          <span className="dk-tp-whatif-l" aria-hidden="true">
            {t.priceWhatIf}
          </span>
          {opts.map((o) => (
            <button key={o.v} type="button" className={`dk-chip dk-chip--neutral${delta === o.v ? ' is-selected' : ''}`} aria-pressed={delta === o.v} onClick={() => onDelta(o.v)}>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
      <dl className="dk-tp-dl">
        <div>
          <dt>{t.priceRange}</dt>
          <dd className="dk-num">
            {rp(advice.range[0])} – {rp(advice.range[1])}
          </dd>
        </div>
        <div>
          <dt>{t.priceHps}</dt>
          <dd className="dk-num" data-tp="hps">
            {rp(advice.hps)}
          </dd>
        </div>
        <div>
          <dt>{t.priceCost}</dt>
          <dd className="dk-num">{advice.cost !== null ? rp(advice.cost) : '–'}</dd>
        </div>
        <div>
          <dt>{t.priceMargin}</dt>
          <dd className="dk-num">{margin !== null ? pctTxt(margin, lang) : t.priceUnknown}</dd>
        </div>
      </dl>
      {advice.history.length > 0 && (
        <figure className="dk-tp-strip">
          <figcaption>{t.priceHistory}</figcaption>
          <div className="dk-tp-strip-plot" role="img" aria-label={`${t.priceHistoryNote(advice.history.length)}: ${advice.history.map((h) => pctTxt(h, lang)).join(', ')}; ${pctTxt(ratio, lang)}`}>
            <span className="dk-tp-strip-axis" />
            {advice.history.map((h, i) => (
              <i key={i} className="dk-tp-strip-dot" style={{ left: `${x(h)}%` }} />
            ))}
            <b className="dk-tp-strip-now" style={{ left: `${x(ratio)}%` }} />
            <span className="dk-tp-strip-lo">80%</span>
            <span className="dk-tp-strip-hi">100%</span>
          </div>
          <p className="dk-tp-muted">{t.priceHistoryNote(advice.history.length)}</p>
        </figure>
      )}
    </section>
  )
}
