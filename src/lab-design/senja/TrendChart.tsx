/** 06 · 30-day line + 16 % area, 7-day dashed forecast + 10 % band; draw-in ≤ 800 ms, crosshair tooltip. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { SERIES } from '../sample'
import { SJ, fmtNum, motionMode, useEnter, useGsapContext } from './shared'

const C = {
  id: {
    title: 'Aduan harian, Kabupaten Contoh',
    unit: 'aduan / hari',
    source: 'Data simulasi · seed 42',
    actual: 'Aktual',
    forecast: 'Prakiraan',
    band: 'Rentang prakiraan',
    today: 'Hari ini',
    help: 'Grafik interaktif. Gunakan panah kiri dan kanan untuk membaca nilai harian.',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    now: 'hari ini',
    change: 'dalam 30 hari',
    peak: 'Puncak prakiraan',
  },
  en: {
    title: 'Daily complaints, Sample Regency',
    unit: 'complaints / day',
    source: 'Simulated data · seed 42',
    actual: 'Actual',
    forecast: 'Forecast',
    band: 'Forecast range',
    today: 'Today',
    help: 'Interactive chart. Use the left and right arrow keys to read daily values.',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    now: 'today',
    change: 'over 30 days',
    peak: 'Forecast peak',
  },
} as const

const A = SERIES.actual
const F = SERIES.forecast
const B = SERIES.band
const NA = A.length
const N = NA + F.length
const TODAY = Date.UTC(2026, 10, 17)
const Y_MIN = 80
const Y_MAX = 190
const TICKS = [90, 120, 150, 180]

function dateOf(i: number, lang: Lang): string {
  const d = new Date(TODAY + (i - (NA - 1)) * 86400000)
  return `${d.getUTCDate()} ${C[lang].months[d.getUTCMonth()]}`
}
function pointAt(i: number): { v: number; lo?: number; hi?: number; fc: boolean } {
  if (i < NA) return { v: A[i] ?? 0, fc: false }
  const j = i - NA
  const v = F[j] ?? 0
  const b = B[j] ?? 0
  return { v, lo: v - b, hi: v + b, fc: true }
}

export default function TrendChart() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const ref = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const ctx = useGsapContext(ref)
  const [w, setW] = useState(880)
  const [idx, setIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setW(Math.max(280, Math.round(last.contentRect.width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const narrow = w < 560
  const h = narrow ? 220 : 280
  const m = { l: 34, r: 14, t: 20, b: 28 }
  const x = (i: number) => m.l + (i * (w - m.l - m.r)) / (N - 1)
  const y = (v: number) => m.t + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (h - m.t - m.b)

  const g = useMemo(() => {
    const line = A.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(NA - 1).toFixed(1)} ${y(Y_MIN)} L${x(0).toFixed(1)} ${y(Y_MIN)} Z`
    const last = A[NA - 1] ?? 0
    const fc = [`M${x(NA - 1).toFixed(1)} ${y(last).toFixed(1)}`, ...F.map((v, j) => `L${x(NA + j).toFixed(1)} ${y(v).toFixed(1)}`)].join(' ')
    const hi = F.map((v, j) => `L${x(NA + j).toFixed(1)} ${y(v + (B[j] ?? 0)).toFixed(1)}`).join(' ')
    const lo = F.map((v, j) => `L${x(NA + j).toFixed(1)} ${y(v - (B[j] ?? 0)).toFixed(1)}`)
      .reverse()
      .join(' ')
    const band = `M${x(NA - 1).toFixed(1)} ${y(last).toFixed(1)} ${hi} ${lo} Z`
    return { line, area, fc, band }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h])

  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      if (mode === 'reduced') return gsap.set(r.querySelector('.lds-chart-svg'), { opacity: 0 })
      gsap.set(r.querySelector('.lds-chart-line'), { strokeDashoffset: 1 })
      gsap.set(r.querySelectorAll('.lds-chart-area, .lds-chart-fc, .lds-chart-band, .lds-chart-end'), { opacity: 0 })
    })
  }, [ctx, mode])
  useEnter(plotRef, () =>
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      if (mode === 'reduced') return gsap.to(r.querySelector('.lds-chart-svg'), { opacity: 1, duration: SJ.fade })
      const tl = gsap.timeline()
      tl.to(r.querySelector('.lds-chart-line'), { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, 0)
      tl.to(r.querySelector('.lds-chart-area'), { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.25)
      tl.to(r.querySelectorAll('.lds-chart-band, .lds-chart-fc, .lds-chart-end'), { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0.6)
    }),
  )

  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    const i = Math.round(((px - m.l) / (w - m.l - m.r)) * (N - 1))
    setIdx(Math.max(0, Math.min(N - 1, i)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setIdx((cur) => {
        const base = cur ?? NA - 1
        return Math.max(0, Math.min(N - 1, base + (e.key === 'ArrowRight' ? 1 : -1)))
      })
    } else if (e.key === 'Home') setIdx(0)
    else if (e.key === 'End') setIdx(N - 1)
    else if (e.key === 'Escape') setIdx(null)
  }

  const first = A[0] ?? 0
  const lastV = A[NA - 1] ?? 0
  const pct = Math.round(((lastV - first) / first) * 100)
  const fMax = Math.max(...F)
  const summary =
    lang === 'id'
      ? `Aduan harian naik dari ${first} pada ${dateOf(0, lang)} menjadi ${lastV} hari ini (${dateOf(NA - 1, lang)}), naik ${pct} persen. Prakiraan 7 hari ke depan ${F[0]} sampai ${fMax} aduan per hari, dengan rentang ketidakpastian ${B[0]} sampai ${B[B.length - 1]}.`
      : `Daily complaints rose from ${first} on ${dateOf(0, lang)} to ${lastV} today (${dateOf(NA - 1, lang)}), up ${pct} percent. The 7-day forecast is ${F[0]} to ${fMax} complaints per day, with an uncertainty range of ${B[0]} to ${B[B.length - 1]}.`

  const labelIdx = narrow ? [0, 14, N - 1] : [0, 7, 14, 21, NA - 1, N - 1]
  const p = idx !== null ? pointAt(idx) : null
  const tipLeft = idx !== null ? x(idx) : 0

  return (
    <div className="lds-panel lds-chart" ref={ref}>
      <div className="lds-chart-head">
        <div>
          <h3 className="lds-h3">{c.title}</h3>
          <p className="lds-chart-unit">{c.unit}</p>
        </div>
        <dl className="lds-chart-stats">
          <div>
            <dt>{c.now}</dt>
            <dd>
              {lastV} <span className="is-up">+{pct}%</span>
            </dd>
          </div>
          <div>
            <dt>{c.peak}</dt>
            <dd>
              {fMax} <span className="is-muted">±{B[B.length - 1]}</span>
            </dd>
          </div>
        </dl>
      </div>
      <ul className="lds-chart-legend" aria-hidden="true">
        <li>
          <span className="lds-key is-line" />
          {c.actual}
        </li>
        <li>
          <span className="lds-key is-dash" />
          {c.forecast}
        </li>
        <li>
          <span className="lds-key is-band" />
          {c.band}
        </li>
      </ul>
      <div className="lds-chart-plot" ref={plotRef} tabIndex={0} role="img" aria-label={`${c.title}. ${c.help}`} onKeyDown={onKey} onBlur={() => setIdx(null)}>
        <svg
          className="lds-chart-svg"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setIdx(null)}
        >
          <defs>
            <linearGradient id="lds-area-g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#3fe0c0" stopOpacity="0.16" />
              <stop offset="1" stopColor="#3fe0c0" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {TICKS.map((t) => (
            <g key={t} className="lds-chart-grid">
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />
              <text x={m.l - 8} y={y(t) + 4}>
                {t}
              </text>
            </g>
          ))}
          <line className="lds-chart-today" x1={x(NA - 1)} x2={x(NA - 1)} y1={m.t - 6} y2={h - m.b} />
          <text className="lds-chart-today-t" x={x(NA - 1) + 6} y={m.t + 4}>
            {c.today}
          </text>
          <path className="lds-chart-band" d={g.band} />
          <path className="lds-chart-area" d={g.area} fill="url(#lds-area-g)" />
          <path className="lds-chart-fc" d={g.fc} />
          <path className="lds-chart-line" d={g.line} pathLength={1} />
          <circle className="lds-chart-end" cx={x(NA - 1)} cy={y(lastV)} r="4" />
          {labelIdx.map((i) => (
            <text key={i} className="lds-chart-x" x={x(i)} y={h - 8} textAnchor={i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle'}>
              {dateOf(i, lang)}
            </text>
          ))}
          {idx !== null && p && (
            <g className="lds-chart-cross">
              <line x1={x(idx)} x2={x(idx)} y1={m.t} y2={h - m.b} />
              {p.fc && p.lo !== undefined && p.hi !== undefined && <line className="is-range" x1={x(idx)} x2={x(idx)} y1={y(p.hi)} y2={y(p.lo)} />}
              <circle cx={x(idx)} cy={y(p.v)} r="5" className={p.fc ? 'is-fc' : undefined} />
            </g>
          )}
        </svg>
        {idx !== null && p && (
          <div className={`lds-charttip${tipLeft > w - 170 ? ' is-left' : ''}`} style={{ left: `${Math.round(tipLeft)}px`, top: `${Math.round(y(p.v))}px` }}>
            <span>
              {dateOf(idx, lang)} · {p.fc ? c.forecast : c.actual}
            </span>
            <b>
              {fmtNum(p.v, lang)} <small>{c.unit}</small>
            </b>
            {p.fc && p.lo !== undefined && p.hi !== undefined && (
              <span>
                {c.band}: {p.lo}–{p.hi}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="lds-sr">{summary}</p>
      <p className="lds-sr" aria-live="polite">
        {idx !== null && p ? `${dateOf(idx, lang)}: ${p.v} ${c.unit}${p.fc ? ` (${c.forecast})` : ''}` : ''}
      </p>
      <p className="lds-source">{c.source}</p>
    </div>
  )
}
