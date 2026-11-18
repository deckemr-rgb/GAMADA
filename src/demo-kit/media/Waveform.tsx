/**
 * Waveform — SVG bars. Two sources:
 *   - live: `level()` (mic AnalyserNode) sampled once per frame into a scrolling history;
 *   - peaks: precomputed bars with a played overlay driven by `progress()`: a clip box slid by CSS transform (outer
 *     translateX(p − 1), inner translateX(1 − p), both own layers), so playback is compositor-only — no SVG
 *     attribute writes and no repaint per frame.
 * Bars move by `transform` on gsap.ticker; the ticker only runs while active, on screen and the tab is visible.
 * With `onSeek` it becomes a slider (click / ←→ / Home / End); `markers` render as jump buttons.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { gsap } from 'gsap'
import { useInView, usePageVisible, motionMode } from '../ui/motion'
import './media.css'

export const WAVE = {
  /** bar pitch in viewBox units (bar + gap) */
  pitch: 4,
  gap: 1.4,
  /** keyboard seek step (fraction) */
  seekStep: 0.05,
  /** smoothing of the live level (0..1, higher = snappier) */
  attack: 0.55,
  /** minimum visible bar */
  floor: 0.06,
} as const

export interface WaveMarker {
  id: string
  /** 0..1 along the waveform */
  at: number
  label: string
  tone?: 'neutral' | 'ok' | 'warn' | 'danger'
}

export interface WaveformProps {
  peaks?: number[]
  level?: () => number
  progress?: () => number
  /** run the per-frame update (recording / playing) */
  active?: boolean
  /** bars in live mode (default 40) */
  bars?: number
  /** px (default 48) */
  height?: number
  markers?: WaveMarker[]
  onSeek?: (frac: number) => void
  onMarker?: (id: string) => void
  /** accessible name */
  label: string
  /** aria-valuetext for the slider ("00:42 dari 03:10") */
  valueText?: string
  className?: string
}

export function Waveform({ peaks, level, progress, active = false, bars = 40, height = 48, markers, onSeek, onMarker, label, valueText, className }: WaveformProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const baseG = useRef<SVGGElement>(null)
  const clipOut = useRef<HTMLDivElement>(null)
  const clipIn = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap, { once: false, threshold: 0 })
  const visible = usePageVisible()
  const live = !!level && !peaks
  const n = peaks?.length ?? bars
  const H = 40
  const W = n * WAVE.pitch
  const values = useMemo(() => peaks ?? Array.from({ length: n }, () => WAVE.floor), [peaks, n])

  const barT = (v: number) => {
    const s = Math.max(WAVE.floor, Math.min(1, v))
    return `translate(0 ${((H * (1 - s)) / 2).toFixed(2)}) scale(1 ${s.toFixed(3)})`
  }

  /** played share 0..1 → the clip box slides (transform only: compositor work, no repaint) */
  const setPlayed = (p: number) => {
    const q = Math.max(0, Math.min(1, p))
    if (clipOut.current) clipOut.current.style.transform = `translate3d(${((q - 1) * 100).toFixed(3)}%,0,0)`
    if (clipIn.current) clipIn.current.style.transform = `translate3d(${((1 - q) * 100).toFixed(3)}%,0,0)`
  }

  // per-frame updates
  useEffect(() => {
    if (!active || !inView || !visible) return
    if (!level && !progress) return
    const hist: number[] = Array.from({ length: n }, () => WAVE.floor as number)
    let smooth = 0
    const rects = baseG.current ? Array.from(baseG.current.querySelectorAll('rect')) : []
    const reduced = motionMode() !== 'full'
    const tick = () => {
      if (live && level) {
        const v = level()
        smooth = smooth + (v - smooth) * (reduced ? 1 : WAVE.attack)
        hist.shift()
        hist.push(smooth)
        for (let i = 0; i < rects.length; i++) rects[i]?.setAttribute('transform', barT(hist[i] ?? 0))
      }
      if (progress) setPlayed(progress())
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      if (live) for (const r of rects) r.setAttribute('transform', barT(WAVE.floor))
    }
  }, [active, inView, visible, level, progress, live, n])

  // reflect progress when paused / after a seek
  useEffect(() => {
    if (progress) setPlayed(progress())
  })

  const fracOf = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r || !r.width) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek || (e.target as Element).closest('.dk-wave-mk')) return
    onSeek(fracOf(e.clientX))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek || e.target !== e.currentTarget) return
    const cur = progress?.() ?? 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onSeek(Math.min(1, cur + WAVE.seekStep))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onSeek(Math.max(0, cur - WAVE.seekStep))
    else if (e.key === 'Home') onSeek(0)
    else if (e.key === 'End') onSeek(1)
    else return
    e.preventDefault()
  }

  const bar = (v: number, i: number) => <rect key={i} x={i * WAVE.pitch + WAVE.gap / 2} y={0} width={WAVE.pitch - WAVE.gap} height={H} rx={1.2} transform={barT(v)} />
  const seekable = !!onSeek
  return (
    <div
      ref={wrap}
      className={`dk-wave${live ? ' is-live' : ''}${active ? ' is-active' : ''}${seekable ? ' is-seek' : ''}${className ? ` ${className}` : ''}`}
      style={{ height }}
      {...(seekable
        ? {
            role: 'slider',
            tabIndex: 0,
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round((progress?.() ?? 0) * 100),
            ...(valueText ? { 'aria-valuetext': valueText } : {}),
            onPointerDown: onPointer,
            onKeyDown: onKey,
          }
        : { role: 'img', 'aria-label': label })}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <g ref={baseG} className="dk-wave-base">
          {values.map(bar)}
        </g>
      </svg>
      {progress && (
        <div ref={clipOut} className="dk-wave-clip" aria-hidden="true" style={{ transform: 'translate3d(-100%,0,0)' }}>
          <div ref={clipIn} className="dk-wave-clip-in" style={{ transform: 'translate3d(100%,0,0)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <g className="dk-wave-played">{values.map(bar)}</g>
            </svg>
          </div>
        </div>
      )}
      {markers?.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`dk-wave-mk is-${m.tone ?? 'neutral'}`}
          style={{ left: `${m.at * 100}%` }}
          aria-label={m.label}
          title={m.label}
          onClick={() => (onMarker ? onMarker(m.id) : onSeek?.(m.at))}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
