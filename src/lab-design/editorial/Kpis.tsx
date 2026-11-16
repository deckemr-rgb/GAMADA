/** 02 · KPI strip — six columns between hairlines, Fraunces numerals that tick up once on first view. */
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { KPIS, SERIES } from '../sample'
import { IconDown, IconUp } from './icons'
import { LDE, fmt, motionMode, observeOnce } from './lde'

type Kpi = (typeof KPIS)[number]

const C = {
  vs: { id: 'vs kemarin', en: 'vs yesterday' },
  yday: { id: 'Kemarin', en: 'Yesterday' },
  today: { id: 'Hari ini', en: 'Today' },
  target: { id: 'Target', en: 'Target' },
  days: { id: '14 hari', en: '14 days' },
  label: { id: 'Indikator utama hari ini', en: "Today's key indicators" },
}

const decimals = (k: Kpi) => (Number.isInteger(k.value) ? 0 : 1)

function deltaText(lang: Lang, k: Kpi) {
  const sign = k.delta > 0 ? '+' : k.delta < 0 ? '−' : '±'
  const abs = fmt(lang, Math.abs(k.delta), Number.isInteger(k.delta) ? 0 : 1)
  return `${sign}${abs}${k.unit === '%' ? ' pp' : ''}`
}

function Spark() {
  const pts = SERIES.actual.slice(-14)
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const W = 120
  const H = 24
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 2 - ((v - min) / (max - min)) * (H - 4)] as const)
  const last = xy[xy.length - 1] ?? [W, 0]
  return (
    <svg className="lde-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.5" className="lde-spark-dot" />
    </svg>
  )
}

function Viz({ k, lang }: { k: Kpi; lang: Lang }) {
  if (k.id === 'aduan')
    return (
      <div className="lde-kpi-viz">
        <Spark />
        <span className="lde-kpi-vizcap">{C.days[lang]}</span>
      </div>
    )
  if (k.unit === '%' || k.unit === '/100') {
    const pct = k.unit === '%' ? k.value : k.value
    const target = k.unit === '%' ? 90 : 80
    return (
      <div className="lde-kpi-viz">
        <div className="lde-meter" aria-hidden="true">
          <span className="lde-meter-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          <span className="lde-meter-target" style={{ left: `${target}%` }} />
        </div>
        <span className="lde-kpi-vizcap">
          {C.target[lang]} {target}
        </span>
      </div>
    )
  }
  const yday = k.value - k.delta
  const max = Math.max(yday, k.value)
  return (
    <div className="lde-kpi-viz lde-pair" aria-hidden="true">
      <span className="lde-pair-row">
        <span className="lde-pair-k">{C.yday[lang]}</span>
        <span className="lde-pair-track">
          <span className="lde-pair-bar lde-pair-y" style={{ transform: `scaleX(${yday / max})` }} />
        </span>
        <span className="lde-pair-v">{yday}</span>
      </span>
      <span className="lde-pair-row">
        <span className="lde-pair-k">{C.today[lang]}</span>
        <span className="lde-pair-track">
          <span className="lde-pair-bar" style={{ transform: `scaleX(${k.value / max})` }} />
        </span>
        <span className="lde-pair-v">{k.value}</span>
      </span>
    </div>
  )
}

export default function Kpis() {
  const { lang } = useI18n()
  const ref = useRef<HTMLDListElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const mode = motionMode()
    if (!el || mode === 'static') return
    const nums = Array.from(el.querySelectorAll<HTMLElement>('[data-lde-count]'))
    const ctx = gsap.context(() => {
      if (mode === 'reduced') gsap.set(el, { opacity: 0 })
      else {
        nums.forEach((n) => (n.textContent = fmt(lang, 0, Number(n.dataset.digits ?? 0))))
        gsap.set(el.querySelectorAll('.lde-kpi-viz'), { opacity: 0 })
      }
    }, el)
    const stop = observeOnce(el, () =>
      ctx.add(() => {
        if (mode === 'reduced') {
          gsap.to(el, { opacity: 1, duration: LDE.fade })
          return
        }
        nums.forEach((n, i) => {
          const target = Number(n.dataset.ldeCount)
          const digits = Number(n.dataset.digits ?? 0)
          const o = { v: 0 }
          gsap.to(o, {
            v: target,
            duration: LDE.count,
            delay: i * 0.04,
            ease: 'power2.out',
            onUpdate: () => {
              n.textContent = fmt(lang, digits ? o.v : Math.round(o.v), digits)
            },
          })
        })
        gsap.to(el.querySelectorAll('.lde-kpi-viz'), { opacity: 1, duration: LDE.panel, stagger: 0.04, delay: 0.2 })
      }),
    )
    return () => {
      stop()
      ctx.revert()
      nums.forEach((n) => (n.textContent = fmt(lang, Number(n.dataset.ldeCount), Number(n.dataset.digits ?? 0))))
    }
  }, [lang])

  return (
    <dl className="lde-kpis" ref={ref} aria-label={C.label[lang]}>
      {KPIS.map((k) => {
        const d = decimals(k)
        const up = k.delta > 0
        const tone = k.good ? 'pos' : 'warn'
        return (
          <div className="lde-kpi" key={k.id}>
            <dt className="lde-cap">{k.label[lang]}</dt>
            <dd className="lde-kpi-value">
              <span data-lde-count={k.value} data-digits={d}>
                {fmt(lang, k.value, d)}
              </span>
              {k.unit && <span className="lde-kpi-unit">{k.unit}</span>}
            </dd>
            <dd className={`lde-kpi-delta lde-tone-${tone}`}>
              {up ? <IconUp /> : <IconDown />}
              <span className="lde-num">{deltaText(lang, k)}</span>
              <span className="lde-kpi-vs">{C.vs[lang]}</span>
            </dd>
            <dd>
              <Viz k={k} lang={lang} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
