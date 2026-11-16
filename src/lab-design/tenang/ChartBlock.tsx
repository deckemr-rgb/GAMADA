/**
 * 06 · Small line chart: 30-day actuals (line + 16% area), 7-day forecast (dashed + 10% band),
 * draws in once with stroke-dashoffset (≤800 ms), pointer + keyboard crosshair, SR summary.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { SERIES } from '../sample'
import { Icon, SectionHead, TT, fmt, motionMode, useFirstView } from './shared'

const C = {
  id: {
    title: 'Grafik kecil',
    lead: 'Garis 2 px, area 16%, prakiraan putus-putus dengan pita 10%. Arahkan penunjuk atau pakai panah kiri/kanan.',
    chart: 'Aduan harian',
    unit: 'aduan / hari',
    source: 'Data simulasi · seed 42',
    actual: 'Aktual',
    forecast: 'Prakiraan',
    range: 'rentang',
    today: 'Hari ini',
    avg: 'Rata-rata 30 hari',
    change: 'Perubahan 30 hari',
    peak: 'Puncak prakiraan',
    summary: (a: number, b: number, pct: string, f0: number, f1: number) =>
      `Aduan harian naik dari ${a} menjadi ${b} dalam 30 hari (${pct}). Prakiraan 7 hari ke depan: ${f0} sampai ${f1} aduan per hari.`,
    help: 'Gunakan panah kiri dan kanan untuk membaca nilai per hari.',
  },
  en: {
    title: 'Small chart',
    lead: '2 px line, 16% area, dashed forecast with a 10% band. Hover, or use the left/right arrows.',
    chart: 'Daily complaints',
    unit: 'complaints / day',
    source: 'Simulated data · seed 42',
    actual: 'Actual',
    forecast: 'Forecast',
    range: 'range',
    today: 'Today',
    avg: '30-day average',
    change: '30-day change',
    peak: 'Forecast peak',
    summary: (a: number, b: number, pct: string, f0: number, f1: number) =>
      `Daily complaints rose from ${a} to ${b} over 30 days (${pct}). Next 7 days forecast: ${f0} to ${f1} complaints per day.`,
    help: 'Use the left and right arrows to read values per day.',
  },
}

const A = SERIES.actual
const F = SERIES.forecast
const B = SERIES.band
const N = A.length + F.length
const LAST = A.length - 1
const Y0 = 80
const Y1 = 190
const TICKS = [100, 120, 140, 160, 180]
const PAD = { l: 34, r: 14, t: 14, b: 26 }

export default function ChartBlock() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const wrapRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)
  const fcRef = useRef<SVGGElement>(null)
  const [w, setW] = useState(720)
  const [drawn, setDrawn] = useState(mode !== 'full')
  const [hi, setHi] = useState<number | null>(null)
  const [kbd, setKbd] = useState(false)
  const h = w < 520 ? 190 : 230

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setW(Math.max(280, Math.round(last.contentRect.width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useFirstView(wrapRef, () => setDrawn(true), 0.4)

  useLayoutEffect(() => {
    if (!drawn || mode !== 'full') return
    const line = lineRef.current
    if (!line) return
    const len = line.getTotalLength()
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: TT.chartDraw, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' })
      tl.fromTo(areaRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.35)
      tl.fromTo(fcRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, TT.chartDraw - 0.1)
    })
    return () => ctx.revert()
    // run once when drawn flips; width changes after that must not replay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, mode])

  const x = (i: number) => PAD.l + (i / (N - 1)) * (w - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - Y0) / (Y1 - Y0)) * (h - PAD.t - PAD.b)

  const paths = useMemo(() => {
    const line = A.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(LAST).toFixed(1)} ${y(Y0)} L${x(0).toFixed(1)} ${y(Y0)} Z`
    const fc = [`M${x(LAST).toFixed(1)} ${y(A[LAST]!).toFixed(1)}`, ...F.map((v, i) => `L${x(LAST + 1 + i).toFixed(1)} ${y(v).toFixed(1)}`)].join(' ')
    const up = F.map((v, i) => `L${x(LAST + 1 + i).toFixed(1)} ${y(v + B[i]!).toFixed(1)}`).join(' ')
    const lo = F.map((v, i) => [x(LAST + 1 + i).toFixed(1), y(v - B[i]!).toFixed(1)] as const)
      .reverse()
      .map(([a, b]) => `L${a} ${b}`)
      .join(' ')
    const band = `M${x(LAST).toFixed(1)} ${y(A[LAST]!).toFixed(1)} ${up} ${lo} Z`
    return { line, area, fc, band }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h])

  const day = (i: number) => new Date(2026, 10, 17 + (i - LAST))
  const dfmt = useMemo(() => new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' }), [lang])
  const val = (i: number) => (i <= LAST ? A[i]! : F[i - LAST - 1]!)

  const avg = A.reduce((s, v) => s + v, 0) / A.length
  const pct = ((A[LAST]! - A[0]!) / A[0]!) * 100
  const peak = Math.max(...F)
  const peakI = LAST + 1 + F.indexOf(peak)
  const pctTxt = `${pct >= 0 ? '+' : '−'}${fmt(lang, Math.abs(pct), 1)}%`

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * w
    const i = Math.round(((px - PAD.l) / (w - PAD.l - PAD.r)) * (N - 1))
    setKbd(false)
    setHi(Math.max(0, Math.min(N - 1, i)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = hi ?? LAST
    let n: number | null = null
    if (e.key === 'ArrowRight') n = Math.min(N - 1, cur + 1)
    else if (e.key === 'ArrowLeft') n = Math.max(0, cur - 1)
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = N - 1
    else if (e.key === 'Escape') setHi(null)
    if (n !== null) {
      e.preventDefault()
      setKbd(true)
      setHi(n)
    }
  }

  const isFc = hi !== null && hi > LAST
  const tipLabel =
    hi === null
      ? ''
      : isFc
        ? `${dfmt.format(day(hi))} · ${c.forecast} ${val(hi)} (${c.range} ${val(hi) - B[hi - LAST - 1]!}–${val(hi) + B[hi - LAST - 1]!})`
        : `${dfmt.format(day(hi))} · ${c.actual} ${val(hi)}`

  return (
    <section className="ldt-block" aria-labelledby="ldt-h-chart">
      <SectionHead num="06" id="ldt-h-chart" title={c.title} lead={c.lead} />
      <div className="ldt-card ldt-chartcard">
        <div className="ldt-chart-main">
          <div className="ldt-chart-head">
            <div>
              <h3 className="ldt-chart-title">
                {Icon.chart()}
                {c.chart}
              </h3>
              <p className="ldt-faint">{c.unit}</p>
            </div>
            <ul className="ldt-chart-key" aria-hidden="true">
              <li>
                <i className="k-line" />
                {c.actual}
              </li>
              <li>
                <i className="k-fc" />
                {c.forecast}
              </li>
            </ul>
          </div>
          <div
            className="ldt-chart-wrap"
            ref={wrapRef}
            tabIndex={0}
            role="group"
            aria-label={`${c.chart}, ${c.unit}`}
            aria-describedby="ldt-chart-sum"
            onKeyDown={onKey}
            onBlur={() => kbd && setHi(null)}
          >
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`ldt-chart${drawn ? '' : ' is-pre'}`} onPointerMove={onMove} onPointerLeave={() => !kbd && setHi(null)} aria-hidden="true">
              {TICKS.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="ldt-ch-grid" />
                  <text x={PAD.l - 8} y={y(t) + 4} className="ldt-ch-ytick">
                    {t}
                  </text>
                </g>
              ))}
              <line x1={PAD.l} x2={w - PAD.r} y1={y(Y0)} y2={y(Y0)} className="ldt-ch-base" />
              {[0, 14, LAST, N - 1].filter((i) => i !== LAST || x(N - 1) - x(LAST) > 84).map((i) => (
                <text key={i} x={x(i)} y={h - 8} className={`ldt-ch-xtick${i === 0 ? ' is-start' : i === N - 1 ? ' is-end' : ''}`}>
                  {dfmt.format(day(i))}
                </text>
              ))}
              <line x1={x(LAST)} x2={x(LAST)} y1={PAD.t} y2={y(Y0)} className="ldt-ch-today" />
              <text x={x(LAST) + (x(N - 1) - x(LAST) > 84 ? 6 : -6)} y={PAD.t + 10} className="ldt-ch-todaylbl" textAnchor={x(N - 1) - x(LAST) > 84 ? 'start' : 'end'}>
                {c.today}
              </text>
              <path d={paths.area} className="ldt-ch-area" ref={areaRef} />
              <g ref={fcRef} className="ldt-ch-fcg">
                <path d={paths.band} className="ldt-ch-band" />
                <path d={paths.fc} className="ldt-ch-fc" />
              </g>
              <path d={paths.line} className="ldt-ch-line" ref={lineRef} />
              <circle cx={x(LAST)} cy={y(A[LAST]!)} r="3.5" className="ldt-ch-last" />
              {hi !== null && (
                <g className="ldt-ch-cross">
                  <line x1={x(hi)} x2={x(hi)} y1={PAD.t} y2={y(Y0)} />
                  <circle cx={x(hi)} cy={y(val(hi))} r="4" className={isFc ? 'is-fc' : ''} />
                </g>
              )}
            </svg>
            {hi !== null && (
              <div className={`ldt-tip ldt-charttip${x(hi) > w - 160 ? ' is-r' : ''}`} style={{ left: x(hi), top: y(val(hi)) }} aria-hidden="true">
                <span className="ldt-faint">{dfmt.format(day(hi))}</span>
                <b className="ldt-num">
                  {val(hi)} <small>{isFc ? c.forecast.toLowerCase() : c.unit.split(' ')[0]}</small>
                </b>
                {isFc && (
                  <span className="ldt-faint ldt-num">
                    {c.range} {val(hi) - B[hi - LAST - 1]!}–{val(hi) + B[hi - LAST - 1]!}
                  </span>
                )}
              </div>
            )}
            <p className="ldt-sr" aria-live="polite">
              {kbd ? tipLabel : ''}
            </p>
          </div>
          <p className="ldt-chart-src">
            <span>{c.source}</span>
            <span className="ldt-faint">{c.help}</span>
          </p>
          <p id="ldt-chart-sum" className="ldt-sr">
            {c.summary(A[0]!, A[LAST]!, pctTxt, Math.min(...F), Math.max(...F))}
          </p>
        </div>
        <dl className="ldt-chart-stats">
          <div>
            <dt>{c.today}</dt>
            <dd className="ldt-num">{A[LAST]}</dd>
          </div>
          <div>
            <dt>{c.avg}</dt>
            <dd className="ldt-num">{fmt(lang, avg, 1)}</dd>
          </div>
          <div>
            <dt>{c.change}</dt>
            <dd className="ldt-num">{pctTxt}</dd>
          </div>
          <div>
            <dt>{c.peak}</dt>
            <dd className="ldt-num">
              {peak} <small>{dfmt.format(day(peakI))}</small>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
