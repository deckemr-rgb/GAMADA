/**
 * StatCounter — number that counts up once when 60 % of it is visible (SITE_REVEAL.counterStart).
 * The final value is in the HTML from the start (readable without JS, and for screen readers via the
 * visually hidden copy); flag `statCounter` off / reduced motion → no counting.
 */
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { EASE, SITE_REVEAL as R, isEnabled } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import '../../styles/ui-kit.css'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  value: number
  label: string
  prefix?: string
  suffix?: string
  /** Optional small note under the label. */
  note?: string
}

export default function StatCounter({ value, label, prefix = '', suffix = '', note }: Props) {
  const { lang } = useI18n()
  const numRef = useRef<HTMLSpanElement>(null)
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')

  useLayoutEffect(() => {
    const el = numRef.current
    if (!el || !isEnabled('statCounter')) return
    const proxy = { n: 0 }
    el.textContent = fmt(0)
    const tween = gsap.to(proxy, {
      n: value,
      duration: R.counterDur,
      ease: EASE.out,
      paused: true,
      onUpdate: () => {
        el.textContent = fmt(proxy.n)
      },
    })
    const st = ScrollTrigger.create({ trigger: el, start: R.counterStart, once: true, onEnter: () => tween.play() })
    return () => {
      st.kill()
      tween.kill()
      el.textContent = fmt(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, lang])

  return (
    <div className="stat" data-rv="card">
      <p className="stat-value">
        <span aria-hidden="true">
          {prefix}
          <span ref={numRef}>{fmt(value)}</span>
          {suffix}
        </span>
        <span className="sr-only">{`${prefix}${fmt(value)}${suffix}`}</span>
      </p>
      <p className="stat-label">{label}</p>
      {note ? <p className="stat-note">{note}</p> : null}
    </div>
  )
}
