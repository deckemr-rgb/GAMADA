/** 06 · Small chart — 30-day line + 16 % area, dashed forecast + 10 % band, crosshair tooltip, keyboard. */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { SERIES } from '../sample'
import { LDE, dayLabel, fmt, motionMode, observeOnce } from './lde'

const C = {
  title: { id: 'Aduan harian, 30 hari terakhir dan prakiraan 7 hari', en: 'Daily complaints, last 30 days and 7-day forecast' },
  unit: { id: 'Satuan: aduan per hari', en: 'Unit: complaints per day' },
  source: { id: 'Data simulasi · seed 42', en: 'Simulated data · seed 42' },
  today: { id: 'Hari ini', en: 'Today' },
  forecast: { id: 'Prakiraan', en: 'Forecast' },
  actual: { id: 'Aktual', en: 'Actual' },
  band: { id: 'Rentang', en: 'Range' },
  keys: { id: 'Gunakan panah kiri dan kanan untuk menelusuri hari.', en: 'Use the left and right arrow keys to step through days.' },
  growth: { id: 'dalam 30 hari', en: 'in 30 days' },
  peak: { id: 'Prakiraan puncak', en: 'Forecast peak' },
  complaints: { id: 'aduan', en: 'complaints' },
  todayTotal: { id: 'aduan hari ini', en: 'complaints today' },
}

const A = SERIES.actual
const F = SERIES.forecast
const B = SERIES.band
const N = A.length + F.length
const LAST = A.length - 1
const Y0 = 80
const Y1 = 190
const TICKS = [80, 100, 120, 140, 160, 180]
const PAD = { l: 36, r: 12, t: 14, b: 28 }

export default function Chart() {
  const { lang } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [w, setW] = useState(720)
  const [idx, setIdx] = useState<number | null>(null)
  const H = w < 520 ? 220 : 260

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setW(Math.round(last.contentRect.width))
    })
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const geo = useMemo(() => {
    const iw = w - PAD.l - PAD.r
    const ih = H - PAD.t - PAD.b
    const x = (i: number) => PAD.l + (i / (N - 1)) * iw
    const y = (v: number) => PAD.t + (1 - (v - Y0) / (Y1 - Y0)) * ih
    const line = A.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(LAST).toFixed(1)} ${y(Y0)} L${x(0)} ${y(Y0)} Z`
    const lastV = A[LAST] ?? 0
    const fc = [`M${x(LAST).toFixed(1)} ${y(lastV).toFixed(1)}`, ...F.map((v, i) => `L${x(LAST + 1 + i).toFixed(1)} ${y(v).toFixed(1)}`)].join(' ')
    const up = F.map((v, i) => `${x(LAST + 1 + i).toFixed(1)},${y(v + (B[i] ?? 0)).toFixed(1)}`)
    const dn = F.map((v, i) => `${x(LAST + 1 + i).toFixed(1)},${y(v - (B[i] ?? 0)).toFixed(1)}`).reverse()
    const band = [`${x(LAST).toFixed(1)},${y(lastV).toFixed(1)}`, ...up, ...dn].join(' ')
    return { x, y, line, area, fc, band, iw, ih }
  }, [w, H])

  // Draw-in on first view: stroke-dashoffset (≤ 800 ms) then area + forecast fade.
  useLayoutEffect(() => {
    const svg = svgRef.current
    const mode = motionMode()
    if (!svg || mode === 'static') return
    const line = svg.querySelector('.lde-ch-line')
    const fades = svg.querySelectorAll('.lde-ch-area, .lde-ch-fc, .lde-ch-today')
    const ctx = gsap.context(() => {
      if (mode === 'reduced') gsap.set(svg, { opacity: 0 })
      else {
        gsap.set(line, { strokeDasharray: 1, strokeDashoffset: 1 })
        gsap.set(fades, { opacity: 0 })
      }
    }, svg)
    const stop = observeOnce(svg, () =>
      ctx.add(() => {
        if (mode === 'reduced') {
          gsap.to(svg, { opacity: 1, duration: LDE.fade })
          return
        }
        const tl = gsap.timeline()
        tl.to(line, { strokeDashoffset: 0, duration: LDE.chartDraw, ease: EASE.reveal })
        tl.to(fades, { opacity: 1, duration: LDE.chartForecast, ease: 'none' }, `-=${LDE.chartForecast / 2}`)
        tl.set(line, { clearProps: 'strokeDasharray,strokeDashoffset' })
      }),
    0.35)
    return () => {
      stop()
      ctx.revert()
    }
  }, [])

  const pick = (e: RPointerEvent<SVGRectElement>) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const px = e.clientX - r.left
    const i = Math.round(((px - PAD.l) / geo.iw) * (N - 1))
    setIdx(Math.max(0, Math.min(N - 1, i)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    setIdx((cur) => {
      const c = cur ?? LAST
      if (e.key === 'Home') return 0
      if (e.key === 'End') return N - 1
      return Math.max(0, Math.min(N - 1, c + (e.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  const isF = idx !== null && idx > LAST
  const val = idx === null ? null : isF ? (F[idx - LAST - 1] ?? 0) : (A[idx] ?? 0)
  const bandV = isF && idx !== null ? (B[idx - LAST - 1] ?? 0) : 0
  const first = A[0] ?? 1
  const lastV = A[LAST] ?? 0
  const growth = Math.round(((lastV - first) / first) * 100)
  const peakI = F.indexOf(Math.max(...F))
  const tipLeft = idx === null ? 0 : geo.x(idx)
  const readout =
    idx === null || val === null
      ? ''
      : `${dayLabel(lang, idx - LAST)}: ${isF ? `${C.forecast[lang]} ${fmt(lang, val)} ± ${fmt(lang, bandV)}` : `${fmt(lang, val)} ${C.complaints[lang]}`}`

  const summary =
    lang === 'id'
      ? `Aduan harian naik dari ${first} menjadi ${lastV} dalam 30 hari (+${growth}%). Prakiraan 7 hari ke depan ${F[0]} hingga ${Math.max(...F)} aduan per hari.`
      : `Daily complaints rose from ${first} to ${lastV} over 30 days (+${growth}%). The 7-day forecast is ${F[0]} to ${Math.max(...F)} complaints per day.`

  return (
    <div className="lde-chart">
      <figure className="lde-chart-fig">
        <figcaption className="lde-chart-head">
          <span className="lde-chart-title">{C.title[lang]}</span>
          <span className="lde-chart-unit">{C.unit[lang]}</span>
        </figcaption>
        <div
          className="lde-chart-box"
          ref={box}
          tabIndex={0}
          role="group"
          aria-label={`${C.title[lang]}. ${C.keys[lang]}`}
          onKeyDown={onKey}
          onFocus={() => setIdx((c) => c ?? LAST)}
          onBlur={() => setIdx(null)}
        >
          <svg ref={svgRef} width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="lde-chart-svg" aria-hidden="true">
            <g className="lde-ch-grid">
              {TICKS.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={w - PAD.r} y1={geo.y(t)} y2={geo.y(t)} className={t === Y0 ? 'is-base' : undefined} />
                  <text x={PAD.l - 8} y={geo.y(t)} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {(w < 520 ? [0, 14, LAST] : [0, 7, 14, 21, LAST, N - 1]).map((i) => (
                <text key={i} x={geo.x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === N - 1 || (w < 520 && i === LAST) ? 'end' : 'middle'} className={i === LAST ? 'is-today' : undefined}>
                  {dayLabel(lang, i - LAST)}
                </text>
              ))}
            </g>
            <path d={geo.area} className="lde-ch-area" />
            <g className="lde-ch-fc">
              <polygon points={geo.band} className="lde-ch-band" />
              <path d={geo.fc} className="lde-ch-fcline" />
            </g>
            <g className="lde-ch-today">
              <line x1={geo.x(LAST)} x2={geo.x(LAST)} y1={PAD.t} y2={H - PAD.b} />
              <text x={geo.x(LAST) - 8} y={PAD.t + 10} textAnchor="end">
                {C.today[lang]}
              </text>
              {w >= 520 && (
                <text x={geo.x(LAST) + 8} y={PAD.t + 10} className="is-fc">
                  {C.forecast[lang]} →
                </text>
              )}
            </g>
            <path d={geo.line} className="lde-ch-line" pathLength={1} />
            {idx !== null && val !== null && (
              <g className="lde-ch-cross">
                <line x1={tipLeft} x2={tipLeft} y1={PAD.t} y2={H - PAD.b} />
                <circle cx={tipLeft} cy={geo.y(val)} r="4" className={isF ? 'is-fc' : undefined} />
              </g>
            )}
            <rect
              x={PAD.l}
              y={PAD.t}
              width={geo.iw}
              height={geo.ih}
              className="lde-ch-hit"
              onPointerMove={pick}
              onPointerDown={pick}
              onPointerLeave={() => setIdx(null)}
            />
          </svg>
          {idx !== null && val !== null && (
            <div
              className={`lde-tip lde-ch-tip ${tipLeft > w * 0.62 ? 'is-left' : ''}`}
              style={{ left: tipLeft, top: geo.y(val) }}
              aria-hidden="true"
            >
              <span className="lde-tip-k">
                {dayLabel(lang, idx - LAST)} · {isF ? C.forecast[lang] : C.actual[lang]}
              </span>
              <span className="lde-tip-v lde-num">{fmt(lang, val)}</span>
              {isF && (
                <span className="lde-tip-u lde-num">
                  {C.band[lang]} {fmt(lang, val - bandV)}–{fmt(lang, val + bandV)}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="lde-sr">{summary}</p>
        <p className="lde-sr" aria-live="polite">
          {readout}
        </p>
        <p className="lde-chart-source">{C.source[lang]}</p>
      </figure>

      <aside className="lde-chart-aside" aria-label={lang === 'id' ? 'Sorotan' : 'Highlights'}>
        <p className="lde-big lde-num">{fmt(lang, lastV)}</p>
        <p className="lde-big-cap">{C.todayTotal[lang]}</p>
        <p className="lde-aside-line">
          <span className="lde-tone-warn lde-num">+{growth}%</span> {C.growth[lang]}
        </p>
        <p className="lde-aside-line">
          {C.peak[lang]} <span className="lde-num lde-strong">{fmt(lang, Math.max(...F))}</span> · {dayLabel(lang, peakI + 1)}
        </p>
      </aside>
    </div>
  )
}
