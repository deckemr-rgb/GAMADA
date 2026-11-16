/** 02 · KPI strip — count-up once on first view (≤ 600 ms), delta coloured by meaning, tiny viz. */
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { KPIS, SERIES } from '../sample'
import { DeltaArrow } from './icons'
import { SJ, fmtNum, motionMode, useEnter, useGsapContext } from './shared'

const C = {
  id: { strip: 'Indikator utama hari ini', vs: 'vs kemarin', better: 'membaik', worse: 'memburuk', yesterday: 'Kemarin', last14: '14 hari terakhir', of: 'dari' },
  en: { strip: 'Key indicators today', vs: 'vs yesterday', better: 'better', worse: 'worse', yesterday: 'Yesterday', last14: 'last 14 days', of: 'of' },
} as const

type Viz = 'spark' | 'bar' | 'pips' | 'prev'
const VIZ: Record<string, Viz> = { aduan: 'spark', sla: 'bar', peringatan: 'pips', isu: 'prev', terlambat: 'prev', indeks: 'bar' }

const SPARK = SERIES.actual.slice(-14)
const SW = 88
const SH = 26
function sparkPath(): { line: string; area: string } {
  const min = Math.min(...SPARK) - 4
  const max = Math.max(...SPARK) + 2
  const pts = SPARK.map((v, i) => [(i / (SPARK.length - 1)) * (SW - 4) + 2, SH - 2 - ((v - min) / (max - min)) * (SH - 4)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const lastPt = pts[pts.length - 1] ?? [SW, SH / 2]
  return { line, area: `${line} L${lastPt[0].toFixed(1)} ${SH} L2 ${SH} Z` }
}
const SPARK_D = sparkPath()

export default function Kpis() {
  const { lang } = useI18n()
  const c = C[lang]
  const ref = useRef<HTMLUListElement>(null)
  const ctx = useGsapContext(ref)
  const mode = motionMode()

  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      const cards = r.querySelectorAll('.lds-kpi')
      if (mode === 'reduced') {
        gsap.set(cards, { opacity: 0 })
        return
      }
      r.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        el.textContent = fmtNum(0, lang, Number(el.dataset.digits ?? 0))
      })
      gsap.set(cards, { opacity: 0, y: 12 })
      gsap.set(r.querySelectorAll('.lds-kpi-barfill'), { scaleX: 0 })
      gsap.set(r.querySelectorAll('.lds-spark-line'), { strokeDashoffset: 1 })
      gsap.set(r.querySelectorAll('.lds-spark-area'), { opacity: 0 })
      gsap.set(r.querySelectorAll('.lds-pip.is-on'), { scale: 0, opacity: 0 })
    })
  }, [ctx, mode, lang])

  useEnter(ref, () => {
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      const cards = r.querySelectorAll('.lds-kpi')
      if (mode === 'reduced') {
        gsap.to(cards, { opacity: 1, duration: SJ.fade })
        return
      }
      gsap.to(cards, { opacity: 1, y: 0, duration: SJ.panel, stagger: 0.05, ease: EASE.out })
      r.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
        const target = Number(el.dataset.value ?? 0)
        const digits = Number(el.dataset.digits ?? 0)
        const o = { v: 0 }
        gsap.to(o, {
          v: target,
          duration: SJ.countUp,
          delay: 0.05 * i,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = fmtNum(o.v, lang, digits)
          },
        })
      })
      gsap.to(r.querySelectorAll('.lds-kpi-barfill'), { scaleX: 1, duration: SJ.countUp, delay: 0.1, ease: EASE.out })
      gsap.to(r.querySelectorAll('.lds-spark-line'), { strokeDashoffset: 0, duration: SJ.countUp, delay: 0.1, ease: 'power1.inOut' })
      gsap.to(r.querySelectorAll('.lds-spark-area'), { opacity: 1, duration: SJ.panel, delay: 0.5 })
      gsap.to(r.querySelectorAll('.lds-pip.is-on'), { scale: 1, opacity: 1, duration: SJ.press, stagger: 0.08, delay: 0.2, ease: 'back.out(2)' })
    })
  })

  return (
    <ul className="lds-kpis" ref={ref} aria-label={c.strip}>
      {KPIS.map((k) => {
        const digits = Number.isInteger(k.value) ? 0 : 1
        const ddigits = Number.isInteger(k.delta) ? 0 : 1
        const up = k.delta > 0
        const viz = VIZ[k.id] ?? 'prev'
        const prev = k.value - k.delta
        return (
          <li key={k.id} className="lds-kpi">
            <p className="lds-kpi-label">{k.label[lang]}</p>
            <p className="lds-kpi-value">
              <span data-count="" data-value={k.value} data-digits={digits}>
                {fmtNum(k.value, lang, digits)}
              </span>
              {k.unit && <span className="lds-kpi-unit">{k.unit}</span>}
            </p>
            <div className="lds-kpi-foot">
              <p className={`lds-delta ${k.good ? 'is-good' : 'is-bad'}`}>
                <DeltaArrow up={up} />
                <span className="lds-delta-n">
                  {up ? '+' : '−'}
                  {fmtNum(Math.abs(k.delta), lang, ddigits)}
                  {k.unit === '%' ? ' pp' : ''}
                </span>
                <span className="lds-delta-vs">{c.vs}</span>
                <span className="lds-sr">, {k.good ? c.better : c.worse}</span>
              </p>
              <div className="lds-kpi-viz">
                {viz === 'spark' && (
                  <svg className="lds-spark" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" role="img" aria-label={c.last14}>
                    <defs>
                      <linearGradient id="lds-spark-g" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor="#ffc79a" stopOpacity="0.28" />
                        <stop offset="1" stopColor="#ffc79a" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path className="lds-spark-area" d={SPARK_D.area} fill="url(#lds-spark-g)" />
                    <path className="lds-spark-line" d={SPARK_D.line} pathLength={1} vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
                {viz === 'bar' && (
                  <span className="lds-kpi-bar" aria-hidden="true">
                    <span className="lds-kpi-barfill" style={{ width: `${k.value}%` }} />
                  </span>
                )}
                {viz === 'pips' && (
                  <span className="lds-pips" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className={`lds-pip${i < k.value ? ' is-on' : ''}`} />
                    ))}
                  </span>
                )}
                {viz === 'prev' && (
                  <span className="lds-kpi-prev">
                    {c.yesterday} <b>{fmtNum(prev, lang, digits)}</b>
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
