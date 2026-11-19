/**
 * mini-kit.tsx — shared parts of the product mini-demos (src/demos/<slug>/mini.tsx), Tahap 6 plan §1.2, §2.3.
 * Imported ONLY by mini.tsx files (never by routes: they reach a mini through MINIS in ./minis.ts).
 * B2 may extend this file; the API below stays.
 *
 *   const s = useMiniScript(FRAMES, playing, { still: frame, onCaption })
 *     FRAMES: readonly MiniStep[] = [{ id: 'masuk', ms: 2200, caption: { id, en } }, …]  (4–6 frames, 8–14 s loop;
 *     a MODULE CONSTANT: a new array every render restarts the ticker effect)
 *     s.id / s.index: the frame on screen; s.step: monotonic advance counter (tests: stops when paused);
 *     s.calm: reduced motion / ?static=1 (starts on the LAST frame; plays only once `playing` turns true).
 *   <MiniFrame slug kind label frame={s.id} step={s.step}> … </MiniFrame>
 *     fixed-ratio device box (16:10, phone 9:16): no layout shift; "Data simulasi" chip; data-mini attributes;
 *     the stage is aria-hidden + inert (the consumer puts a static text summary next to it).
 *
 * Motion: one gsap.ticker callback per playing mini, removed when paused / still / unmounted; no time passes while
 * document.hidden. Animate transform / opacity only (CSS transitions keyed on data-mini-frame are fine).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { gsap } from 'gsap'
import type { Bi, EcoOrInti, FrameKind, ProductSlug } from '../content/products'
import { useI18n } from '../lib/i18n'
import { ECO_SITE, isEnabled, prefersReducedMotion } from '../lib/motion'
import { getDegradeLevel } from '../lib/perf'
import '../demo-kit/ui/tokens.css'
import './mini-kit.css'

export type { MiniProps } from './minis'

export interface MiniStep {
  /** frame name (also usable as `frame` prop / copy.highlights[].frame for a still) */
  id: string
  /** hold time (ms); default ECO_SITE.mini.frameMs */
  ms?: number
  /** caption (shown by the consumer as "Simulasi · {caption}") */
  caption?: Bi
}

export interface MiniScriptOptions {
  /** show this named frame as a still: never ticks */
  still?: string
  /** called with the caption of the frame on screen */
  onCaption?(c: Bi): void
}

export interface MiniScriptState {
  index: number
  id: string
  /** times the script advanced (monotonic) */
  step: number
  /** reduced motion / ?static=1 / demoAnimations off */
  calm: boolean
}

/** true when minis must not autoplay (reduced motion, ?static=1, ?off=demoAnimations): show the final frame + "Putar". */
/** Same rule as demo-kit/ui/motion motionMode() !== 'full', without importing it (that module sits in the 43 KB demo-core chunk). */
export const miniCalm = (): boolean =>
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('static') === '1') ||
  !isEnabled('demoAnimations') ||
  prefersReducedMotion() ||
  getDegradeLevel() >= 3

/** Tiny frame player on gsap.ticker: loops while `playing`, holds otherwise. */
export function useMiniScript(frames: readonly MiniStep[], playing: boolean, opts: MiniScriptOptions = {}): MiniScriptState {
  const { still, onCaption } = opts
  const calm = useRef(miniCalm()).current
  const last = Math.max(0, frames.length - 1)
  const stillIndex = still ? frames.findIndex((f) => f.id === still) : -1
  const [index, setIndex] = useState(() => (still ? (stillIndex >= 0 ? stillIndex : last) : calm ? last : 0))
  const [step, setStep] = useState(0)
  const idxRef = useRef(index)
  idxRef.current = index
  const startedRef = useRef(false)

  useEffect(() => {
    if (still || !playing || frames.length < 2) return
    if (calm && !startedRef.current) {
      // first user-started play under reduced motion: run from the beginning
      idxRef.current = 0
      setIndex(0)
    }
    startedRef.current = true
    let elapsed = 0
    const tick = (_t: number, deltaMs: number) => {
      if (document.hidden) return
      elapsed += Math.min(deltaMs, 100)
      const hold = frames[idxRef.current]?.ms ?? ECO_SITE.mini.frameMs
      if (elapsed < hold) return
      elapsed = 0
      const next = (idxRef.current + 1) % frames.length
      idxRef.current = next
      setIndex(next)
      setStep((n) => n + 1)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [still, playing, frames, calm])

  const shown = still ? (stillIndex >= 0 ? stillIndex : last) : index
  const cap = frames[shown]?.caption
  const capRef = useRef(onCaption)
  capRef.current = onCaption
  useEffect(() => {
    if (cap) capRef.current?.(cap)
  }, [cap])

  return { index: shown, id: frames[shown]?.id ?? '', step, calm }
}

/** The active language's side of a Bi (minis follow the page language). */
export function useBi(): (b: Bi) => string {
  const { lang } = useI18n()
  return (b) => b[lang]
}

const SIMULATED: Bi = { id: 'Data simulasi', en: 'Simulated data' }

type BoxKind = 'browser' | 'phone' | 'tablet'
/** products.ts FrameKind → mini box: phone 9:16, everything else 16:10 (wall / split / paper read as a wide screen). */
export const miniBoxOf = (k: FrameKind): BoxKind => (k === 'phone' ? 'phone' : k === 'tablet' ? 'tablet' : 'browser')

export interface MiniFrameProps {
  slug: ProductSlug
  /** frame kind from products.ts (`PRODUCT_BY_SLUG[slug].frame`) */
  kind: FrameKind
  /** eco accent scope ([data-eco]) */
  eco?: EcoOrInti
  /** current frame id (data-mini-frame) and advance counter (data-mini-step) from useMiniScript */
  frame?: string
  step?: number
  /** hide the "Data simulasi" chip (only when the stage itself shows it) */
  noChip?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** Fixed-ratio device box for a mini. Decorative: aria-hidden + inert; put the text summary next to it. */
export function MiniFrame({ slug, kind, eco, frame, step, noChip, className, style, children }: MiniFrameProps) {
  const t = useBi()
  const box = miniBoxOf(kind)
  return (
    <div
      className={'mk-frame dk-root' + (className ? ' ' + className : '')}
      data-mini={slug}
      data-mini-box={box}
      data-mini-frame={frame}
      data-mini-step={step}
      data-eco={eco}
      style={style}
      aria-hidden="true"
      inert
    >
      {box !== 'phone' && (
        <div className="mk-bar">
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="mk-stage">{children}</div>
      {!noChip && <span className="mk-chip">{t(SIMULATED)}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ helpers for mini scripts (B2 extension) */

/** index of a named frame (−1 when absent) */
export const frameIndex = (frames: readonly MiniStep[], id: string): number => frames.findIndex((f) => f.id === id)

/** `is-on` once the script has reached frame `id` (for `.mk-in` elements that fade / rise in and stay) */
export function onFrom(frames: readonly MiniStep[], index: number, id: string): string {
  const i = frameIndex(frames, id)
  return i >= 0 && index >= i ? ' is-on' : ''
}
