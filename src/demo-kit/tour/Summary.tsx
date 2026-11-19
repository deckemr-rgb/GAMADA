/**
 * tour/Summary.tsx (lazy, chapter 20) — "Hari ini di {region}": the 6 numbers from `tourSummary` (the same
 * selectors as the products) with count-ups, the constellation all lit, "Bawa pulang ringkasan (PDF)" (2 light
 * pages through the print dialog), "Jadwalkan demo personal" (WhatsApp with region + the product watched longest),
 * "Coba sendiri" (every READY demo, on the tour's world) and "Ulangi tur".
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import AppLink from '../../components/AppLink'
import { waLink } from '../../content/site'
import { PRODUCTS, PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { DEMO_READY } from '../../demos/registry'
import { useCountUp } from '../ui/motion'
import { Icon } from '../ui/icons'
import { getSession, useWorld } from '../world'
import { Constellation } from './Constellation'
import { engine, loadWorldSteps } from './engine'
import { useTour } from './store'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang, TourSummary } from './types'

const SummaryPaper = lazy(() => import('./SummaryPaper'))

export function summaryNumbers(sum: TourSummary, lang: Lang): { key: string; value: number; label: string; fmt: (n: number) => string }[] {
  const t = TOUR_STRINGS[lang]
  const loc = lang === 'id' ? 'id-ID' : 'en-GB'
  const int = (n: number) => Math.round(n).toLocaleString(loc)
  const money = (n: number) => (lang === 'id' ? `Rp ${(n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })} jt` : `IDR ${(n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })} m`)
  return [
    { key: 'complaints', value: sum.complaintsHandled, label: t.nComplaints, fmt: int },
    { key: 'warnings', value: sum.warningsSent, label: t.nWarnings, fmt: int },
    { key: 'hoaxes', value: sum.hoaxesCountered, label: t.nHoaxes, fmt: int },
    { key: 'savings', value: sum.savingsRp, label: t.nSavings, fmt: money },
    { key: 'orders', value: sum.umkmOrders, label: t.nOrders, fmt: int },
    { key: 'prices', value: sum.pricesStabilised, label: t.nPrices, fmt: int },
  ]
}

function Num({ value, fmt, label, k }: { value: number; fmt: (n: number) => string; label: string; k: string }) {
  const ref = useCountUp<HTMLSpanElement>(value, { format: fmt })
  return (
    <li className="dk-tour-num" data-sum={k}>
      <span className="dk-tour-num-v" ref={ref} data-value={value}>
        {fmt(value)}
      </span>
      <span className="dk-tour-num-l">{label}</span>
    </li>
  )
}

export function useTourSummary(): TourSummary | null {
  const st = useTour()
  const w = useWorld((s) => s)
  const [sum, setSum] = useState<TourSummary | null>(null)
  useEffect(() => {
    let alive = true
    void loadWorldSteps().then((ws) => {
      if (alive) setSum(ws.tourSummary(w, Object.keys(st.seen)))
    })
    return () => {
      alive = false
    }
  }, [w, st.seen])
  return sum
}

export default function Summary({ lang, controls }: { lang: Lang; controls: ReactNode }) {
  const t = TOUR_STRINGS[lang]
  const st = useTour()
  const sum = useTourSummary()
  const region = (st.fills.region as string) ?? ''
  const [paper, setPaper] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)
  const nums = useMemo(() => (sum ? summaryNumbers(sum, lang) : []), [sum, lang])
  const top = (Object.entries(st.seen) as [ProductSlug, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'inti'
  const wa = waLink(fill(t.waText, { region, product: PRODUCT_BY_SLUG[top].name }))
  const s = getSession()
  const tryHref = (slug: ProductSlug) => `/demo/${slug}?world=tour&region=${encodeURIComponent(s.regionId)}&lang=${lang}${s.seed !== 2026 ? `&seed=${s.seed}` : ''}`

  // once the paper is mounted: print it (the print stylesheet prints PaperFrames only)
  useEffect(() => {
    if (!paper) return
    let alive = true
    void (async () => {
      for (let i = 0; i < 40 && alive && !paperRef.current?.querySelector('.dk-paper'); i++) await new Promise((r) => setTimeout(r, 50))
      const el = paperRef.current?.querySelector('.dk-paper')
      if (!alive || !el) return
      const { printPaper } = await import('../frames')
      printPaper(el)
    })()
    return () => {
      alive = false
    }
  }, [paper])

  return (
    <section className="dk-tour-summary" aria-labelledby="dk-tour-sum-h">
      <div className="dk-tour-sum-grid">
        <div>
          <p className="dk-tour-eyebrow">{fill(t.chapterOf, { n: 20, total: 20 })}</p>
          <h1 id="dk-tour-sum-h" className="dk-tour-op-title dk-tour-op-title--sm">
            {fill(t.sumTitle, { region })}
          </h1>
          <p className="dk-tour-body">{t.sumLead}</p>
          <ul className="dk-tour-nums" data-tour="summary-numbers">
            {nums.map((x) => (
              <Num key={x.key} k={x.key} value={x.value} fmt={x.fmt} label={x.label} />
            ))}
          </ul>
          <div className="dk-tour-op-ctas">
            <button type="button" className="dk-tour-btn dk-tour-btn--accent" onClick={() => (paper ? paperRef.current?.querySelector('.dk-paper') && import('../frames').then((m) => m.printPaper(paperRef.current!.querySelector('.dk-paper')!)) : setPaper(true))} aria-describedby="dk-tour-pdf-hint" data-tour-ctl="pdf">
              <Icon name="print" size={18} />
              <span>{t.pdf}</span>
            </button>
            <a className="dk-tour-btn" href={wa} target="_blank" rel="noopener noreferrer" data-tour-ctl="wa">
              <Icon name="chat" size={18} />
              <span>{t.wa}</span>
              <span className="sr-only"> {t.newTab}</span>
            </a>
            <button type="button" className="dk-tour-btn" onClick={() => void engine.start(1, { reset: true, regionId: s.regionId, seed: s.seed })} data-tour-ctl="again">
              <Icon name="replay" size={18} />
              <span>{t.again}</span>
            </button>
          </div>
          <p id="dk-tour-pdf-hint" className="dk-tour-fine">
            {t.pdfHint}
          </p>
          {controls}
        </div>
        <Constellation seen={st.seen} lang={lang} all size={220} />
      </div>
      <h2 className="dk-tour-h2">{t.tryTitle}</h2>
      <p className="dk-tour-fine">{t.tryLead}</p>
      <ul className="dk-tour-try">
        {PRODUCTS.filter((p) => DEMO_READY[p.slug]).map((p) => (
          <li key={p.slug} data-eco={p.eco}>
            <AppLink to={tryHref(p.slug)} className="dk-tour-try-card">
              <Icon name={p.icon} size={20} />
              <span>{p.name}</span>
            </AppLink>
          </li>
        ))}
      </ul>
      <div ref={paperRef} className="dk-tour-paperbox">
        {paper && sum ? (
          <Suspense fallback={null}>
            <SummaryPaper lang={lang} sum={sum} region={region} seen={st.seen} />
          </Suspense>
        ) : null}
      </div>
    </section>
  )
}
