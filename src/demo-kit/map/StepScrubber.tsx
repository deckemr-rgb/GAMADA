/**
 * StepScrubber (tahap 4) — TimeScrubber with discrete labelled `steps` (e.g. 12 months: value = step index,
 * aria-valuetext = the step label, ticks = short labels, Play runs the steps in SCRUB.playSeconds, onEnd at the last
 * one); without `steps` it behaves exactly like TimeScrubber (forecast hours). A separate module so the flood / rain
 * demos keep the original, smaller TimeScrubber chunk.
 *
 * Two outputs so the map can animate without React re-rendering 60× a second:
 *   onFrame(h)  — continuous (drag + playback, every gsap.ticker frame) → forward to MapViewHandle.setTime
 *   onChange(h) — quantised to `step` (default 0.25 h) → React state for lists, counts, captions
 * Playback runs on gsap.ticker (pauses with the tab), stops at the end; with reduced motion it steps through
 * whole hours instead of gliding (whole steps); it pauses when the scrubber leaves the screen.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { Icon } from '../ui/icons'
/** (local copy of map/strings fmt: this module must not share a chunk boundary with the TimeScrubber strings) */
const fmt = (n: number, lang: Lang, digits = 0): string => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
import './map.css'
import './time-scrubber.css'
import './step-scrubber.css'

/** this file's bilingual strings (kept per file so a demo loads only the strings of the parts it uses) */
const S = {
  time: { id: 'Waktu prediksi', en: 'Forecast time' },
  play: { id: 'Putar', en: 'Play' },
  pause: { id: 'Jeda', en: 'Pause' },
  now: { id: 'Sekarang', en: 'Now' },
} as const
const ms = (k: keyof typeof S, lang: Lang): string => S[k][lang]

const SCRUB = {
  /** real seconds for a full 0 → max run */
  playSeconds: 9,
  /** reduced motion: seconds per whole-hour step */
  stepSeconds: 0.7,
} as const

export interface StepScrubberProps {
  value: number
  onChange: (hours: number) => void
  onFrame?: (hours: number) => void
  /** max hours (default 6) */
  hours?: number
  /** quantisation of onChange (default 0.25) */
  step?: number
  label?: string
  className?: string
  /** discrete steps (value = index 0 … n−1): the label is read out / shown, `short` (default label) under the track */
  steps?: { value: number; label: { id: string; en: string }; short?: { id: string; en: string } }[]
  /** a full run ends (Play reached the last step) — e.g. a "watched all months" mission */
  onEnd?: () => void
}

export function StepScrubber(props: StepScrubberProps) {
  const { value, onChange, onFrame, label, className, steps, onEnd } = props
  const hours = steps ? Math.max(1, steps.length - 1) : (props.hours ?? 6)
  const step = steps ? 1 : (props.step ?? 0.25)
  const rootRef = useRef<HTMLDivElement>(null)
  const { lang } = useI18n()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const outRef = useRef<HTMLOutputElement>(null)
  const cur = useRef(value)
  const lastQ = useRef(value)
  const [playing, setPlaying] = useState(false)
  const cbs = useRef({ onChange, onFrame, onEnd })
  cbs.current = { onChange, onFrame, onEnd }

  /** the time as read out and shown: snapped to `step` (quarter hours print 2 decimals: '+0,25 j', '+1,5 j', '+2 j') */
  // the labels can change while Play runs (its frame loop keeps the closure of its first render): read the latest
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const text = (h: number) => {
    const steps = stepsRef.current
    if (steps) return steps[Math.max(0, Math.min(steps.length - 1, Math.round(h)))]?.label[lang] ?? ''
    const q = Math.round(h / step) * step
    if (q < 0.005) return ms('now', lang)
    const digits = Math.abs(q - Math.round(q)) < 1e-6 ? 0 : Math.abs(q * 2 - Math.round(q * 2)) < 1e-6 ? 1 : 2
    return `+${fmt(q, lang, digits)} ${lang === 'id' ? 'j' : 'h'}`
  }

  /** keyboard: arrows move one `step`, PageUp / PageDown one hour, Home / End the ends (the range itself steps 0.05 h
   *  so drag and playback glide). A product handler that already called preventDefault wins. */
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.defaultPrevented) return
    const d = ({ ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key]
    const base = Math.round(cur.current / step) * step
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? hours : d === undefined ? null : Math.max(0, Math.min(hours, base + d))
    if (next === null) return
    e.preventDefault()
    setPlaying(false)
    write(next)
  }

  /** write the position without a React render */
  const write = (h: number, emit = true) => {
    cur.current = h
    if (inputRef.current) {
      inputRef.current.value = String(h)
      inputRef.current.style.setProperty('--p', `${(h / hours) * 100}%`)
      inputRef.current.setAttribute('aria-valuetext', text(h))
    }
    if (outRef.current) outRef.current.textContent = text(h)
    if (!emit) return
    cbs.current.onFrame?.(h)
    const q = Math.round(h / step) * step
    if (q !== lastQ.current) {
      lastQ.current = q
      cbs.current.onChange(q)
    }
  }

  // external value changes (reset, tour) move the thumb
  useEffect(() => {
    if (Math.abs(value - lastQ.current) > 1e-6 && Math.abs(value - cur.current) > step / 2) {
      lastQ.current = value
      write(value, false)
      cbs.current.onFrame?.(value)
    } else write(cur.current, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, lang])

  // new step labels (the data behind them changed, e.g. a flood moved this month's index): rewrite the shown text
  useEffect(() => {
    write(cur.current, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps])

  useEffect(() => {
    if (!playing) return
    if (cur.current >= hours - 1e-3) write(0)
    if (!isEnabled('demoAnimations')) {
      const tick = () => {
        const next = Math.min(hours, Math.floor(cur.current + 1e-6) + 1)
        write(next)
        if (next >= hours) {
          setPlaying(false)
          cbs.current.onEnd?.()
        } else call = gsap.delayedCall(steps ? SCRUB.playSeconds / hours : SCRUB.stepSeconds, tick)
      }
      let call = gsap.delayedCall(steps ? SCRUB.playSeconds / hours : SCRUB.stepSeconds, tick)
      return () => {
        call.kill()
      }
    }
    const fn = (_t: number, dt: number) => {
      const next = Math.min(hours, cur.current + (Math.min(dt, 100) / 1000) * (hours / SCRUB.playSeconds))
      write(next)
      if (next >= hours) {
        setPlaying(false)
        cbs.current.onEnd?.()
      }
    }
    gsap.ticker.add(fn)
    return () => gsap.ticker.remove(fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hours])

  // off-screen: playback pauses (one RAF loop, nothing ticking out of view)
  useEffect(() => {
    const el = rootRef.current
    if (!playing || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([en]) => {
      if (en && !en.isIntersecting) setPlaying(false)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [playing])

  const ticks = Array.from({ length: hours + 1 }, (_, i) => i)
  return (
    <div ref={rootRef} className={`dk-mts${steps ? ' has-steps' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dk-mts-head">
        <label htmlFor={id} className="dk-mts-label">
          {label ?? ms('time', lang)}
        </label>
        <output ref={outRef} htmlFor={id} className="dk-mts-out dk-num" aria-live="off">
          {text(value)}
        </output>
      </div>
      <div className="dk-mts-row">
        <button type="button" className="dk-mts-play" aria-label={ms(playing ? 'pause' : 'play', lang)} title={ms(playing ? 'pause' : 'play', lang)} onClick={() => setPlaying((p) => !p)}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <div className="dk-mts-track">
          <input
            ref={inputRef}
            id={id}
            type="range"
            min={0}
            max={hours}
            step={steps ? 1 : 0.05}
            defaultValue={value}
            aria-valuetext={text(value)}
            className="dk-mts-range"
            onKeyDown={onKey}
            onInput={(e) => {
              setPlaying(false)
              write(Number((e.target as HTMLInputElement).value))
            }}
          />
          <div className="dk-mts-ticks" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t}>{steps ? (steps[t]?.short ?? steps[t]?.label)?.[lang] ?? '' : t === 0 ? '+0' : `+${t}`}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
