/**
 * TimeScrubber — forecast time +0 … +6 h with play/pause.
 *
 * Two outputs so the map can animate without React re-rendering 60× a second:
 *   onFrame(h)  — continuous (drag + playback, every gsap.ticker frame) → forward to MapViewHandle.setTime
 *   onChange(h) — quantised to `step` (default 0.25 h) → React state for lists, counts, captions
 * Playback runs on gsap.ticker (pauses with the tab), stops at the end; with reduced motion it steps through
 * whole hours instead of gliding.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { Icon } from '../ui/icons'
import { fmt } from './strings'
import './map.css'
import './time-scrubber.css'

/** this file's bilingual strings (kept per file so a demo loads only the strings of the parts it uses) */
const S = {
  time: { id: 'Waktu prediksi', en: 'Forecast time' },
  play: { id: 'Putar', en: 'Play' },
  pause: { id: 'Jeda', en: 'Pause' },
  now: { id: 'Sekarang', en: 'Now' },
} as const
const ms = (k: keyof typeof S, lang: Lang): string => S[k][lang]

export const SCRUB = {
  /** real seconds for a full 0 → max run */
  playSeconds: 9,
  /** reduced motion: seconds per whole-hour step */
  stepSeconds: 0.7,
} as const

export interface TimeScrubberProps {
  value: number
  onChange: (hours: number) => void
  onFrame?: (hours: number) => void
  /** max hours (default 6) */
  hours?: number
  /** quantisation of onChange (default 0.25) */
  step?: number
  label?: string
  className?: string
}

export function TimeScrubber({ value, onChange, onFrame, hours = 6, step = 0.25, label, className }: TimeScrubberProps) {
  const { lang } = useI18n()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const outRef = useRef<HTMLOutputElement>(null)
  const cur = useRef(value)
  const lastQ = useRef(value)
  const [playing, setPlaying] = useState(false)
  const cbs = useRef({ onChange, onFrame })
  cbs.current = { onChange, onFrame }

  const text = (h: number) => (h < 0.005 ? ms('now', lang) : `+${fmt(h, lang, h % 1 ? 1 : 0)} ${lang === 'id' ? 'j' : 'h'}`)

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

  useEffect(() => {
    if (!playing) return
    if (cur.current >= hours - 1e-3) write(0)
    if (!isEnabled('demoAnimations')) {
      const tick = () => {
        const next = Math.min(hours, Math.floor(cur.current + 1e-6) + 1)
        write(next)
        if (next >= hours) setPlaying(false)
        else call = gsap.delayedCall(SCRUB.stepSeconds, tick)
      }
      let call = gsap.delayedCall(SCRUB.stepSeconds, tick)
      return () => {
        call.kill()
      }
    }
    const fn = (_t: number, dt: number) => {
      const next = Math.min(hours, cur.current + (Math.min(dt, 100) / 1000) * (hours / SCRUB.playSeconds))
      write(next)
      if (next >= hours) setPlaying(false)
    }
    gsap.ticker.add(fn)
    return () => gsap.ticker.remove(fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hours])

  const ticks = Array.from({ length: hours + 1 }, (_, i) => i)
  return (
    <div className={`dk-mts${className ? ` ${className}` : ''}`}>
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
            step={0.05}
            defaultValue={value}
            className="dk-mts-range"
            onInput={(e) => {
              setPlaying(false)
              write(Number((e.target as HTMLInputElement).value))
            }}
          />
          <div className="dk-mts-ticks" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t}>{t === 0 ? '+0' : `+${t}`}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
