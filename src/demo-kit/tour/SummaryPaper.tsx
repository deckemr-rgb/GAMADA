/**
 * tour/SummaryPaper.tsx (lazy, on "Bawa pulang ringkasan") — two light A4 pages in PaperFrames: logo, region, day,
 * the 6 numbers (the same `tourSummary` as the screen), products seen with minutes, the chapter list.
 */
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { TOUR, TOUR_CHAPTERS } from '../../content/tour'
import { PaperFrame } from '../frames'
import { TOUR_STRINGS, fill } from './strings'
import { summaryNumbers } from './Summary'
import type { Lang, TourSummary } from './types'

export default function SummaryPaper({ lang, sum, region, seen }: { lang: Lang; sum: TourSummary; region: string; seen: Partial<Record<ProductSlug, number>> }) {
  const t = TOUR_STRINGS[lang]
  const day = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${TOUR.day}T12:00:00`))
  const nums = summaryNumbers(sum, lang)
  const products = (Object.entries(seen) as [ProductSlug, number][]).sort((a, b) => b[1] - a[1])
  return (
    <div className="dk-tour-papers" data-tour="paper">
      <PaperFrame label={`${t.paperTitle} 1/2`}>
        <header className="dk-tour-paper-head">
          <strong className="dk-tour-paper-logo">GAMADA</strong>
          <span>{t.paperTitle}</span>
        </header>
        <h1 className="dk-tour-paper-h">{fill(t.sumTitle, { region })}</h1>
        <p>
          {t.paperDay}: {day} · {region}
        </p>
        <ul className="dk-tour-paper-nums">
          {nums.map((x) => (
            <li key={x.key} data-sum={x.key}>
              <b>{x.fmt(x.value)}</b> {x.label}
            </li>
          ))}
        </ul>
        <p>{fill(t.paperEvents, { n: sum.events.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB') })}</p>
        <p className="dk-tour-paper-fine">{t.paperNote}</p>
      </PaperFrame>
      <PaperFrame label={`${t.paperTitle} 2/2`}>
        <h2 className="dk-tour-paper-h">{t.paperProducts}</h2>
        <ul>
          {products.map(([slug, ms]) => (
            <li key={slug}>
              {PRODUCT_BY_SLUG[slug].name} · {fill(t.minutes, { m: Math.max(1, Math.round(ms / 60000)) })}
            </li>
          ))}
        </ul>
        <h2 className="dk-tour-paper-h">{t.paperChapters}</h2>
        <ol>
          {TOUR_CHAPTERS.map((c) => (
            <li key={c.n}>
              {c.time ?? t.summary} · {c.title[lang]}
            </li>
          ))}
        </ol>
        <p className="dk-tour-paper-fine">{t.paperNote}</p>
      </PaperFrame>
    </div>
  )
}
