/**
 * lde.ts — shared helpers for direction A "Presisi editorial": motion mode, timing constants,
 * viewport observers and number / date formatting. Everything here is local to src/lab-design/editorial.
 */
import type { Lang } from '../../lib/i18n'
import { prefersReducedMotion } from '../../lib/motion'

/* LDE timings (seconds). The integrator can move this block into motion.ts → DEMO. */
export const LDE = {
  hover: 0.12,
  press: 0.2,
  panel: 0.32,
  screen: 0.6,
  /** Reduced motion: every movement becomes a fade of at most this long. */
  fade: 0.15,
  /** KPI count-up (max 600 ms). */
  count: 0.6,
  /** Chart line draw (stroke-dashoffset, max 800 ms) + forecast fade. */
  chartDraw: 0.62,
  chartForecast: 0.18,
  /** New-row highlight fade + slide distance (px). */
  highlight: 1.5,
  slideY: 8,
  /** Chat. */
  tokenRateMin: 25,
  tokenRateMax: 45,
  pauseComma: 0.14,
  pauseStop: 0.3,
  thinking: 1.15,
  chipStagger: 0.06,
  /** Document wow: OCR marks rule themselves on, one by one. */
  ocrEdge: 0.3,
  ocrStagger: 0.24,
  stampDrop: 0.3,
} as const

export type Mode = 'full' | 'reduced' | 'static'

/** ?static=1 → final state, no entrance; reduced motion → fades only; otherwise full motion. */
export function motionMode(): Mode {
  if (typeof window === 'undefined') return 'static'
  if (new URLSearchParams(window.location.search).get('static') === '1') return 'static'
  return prefersReducedMotion() ? 'reduced' : 'full'
}

/** Runs `cb` once, the first time `el` is visible (reads only the LAST IntersectionObserver entry). */
export function observeOnce(el: Element, cb: () => void, threshold = 0.2): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      const last = entries[entries.length - 1]
      if (last && last.isIntersecting) {
        io.disconnect()
        cb()
      }
    },
    { threshold },
  )
  io.observe(el)
  return () => io.disconnect()
}

/** Reports visibility changes of `el` (used to pause loops while off-screen). */
export function observeVisibility(el: Element, cb: (visible: boolean) => void): () => void {
  const io = new IntersectionObserver((entries) => {
    const last = entries[entries.length - 1]
    if (last) cb(last.isIntersecting)
  })
  io.observe(el)
  return () => io.disconnect()
}

const nfCache = new Map<string, Intl.NumberFormat>()
export function fmt(lang: Lang, v: number, digits = 0): string {
  const key = `${lang}-${digits}`
  let f = nfCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    nfCache.set(key, f)
  }
  return f.format(v)
}

/** Sample "today" (the document date in sample.ts). */
export const TODAY = new Date(2026, 10, 17)
export function dayLabel(lang: Lang, offsetDays: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offsetDays)
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' }).format(d).replace('.', '')
}

/** Tiny seeded PRNG (mulberry32) so token pacing is identical on every replay. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Bi = { id: string; en: string }
