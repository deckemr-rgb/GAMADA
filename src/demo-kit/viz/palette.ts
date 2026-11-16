/**
 * viz/palette.ts — chart colours. Everything is a CSS variable so `[data-eco]` and `[data-theme="paper"]`
 * re-colour charts without JS; the hex fallbacks are the base tokens (src/styles/tokens.css) and are what
 * __tests__/palette.test.ts checks for contrast on --c-ink / --c-ink-2 (WCAG 1.4.11: ≥ 3:1 for graphics).
 *
 * Rules (spec §8.4, ARAH-VISUAL §1): ≤ 6 categorical colours per chart; red only for danger; single-series
 * charts use the ecosystem accent.
 */

/** Hex values of the tokens the palette is built from (kept in sync with src/styles/tokens.css). */
export const TOKEN_HEX = {
  ink: '#1a1638',
  ink2: '#231b48',
  indigo: '#2b2152',
  teal: '#3fe0c0',
  cyan: '#4fd1ff',
  lavender: '#b9b2ff',
  peach: '#f59a62',
  gold: '#ffd77e',
  plumLight: '#c08ad0',
  red: '#c8382f',
  dangerInk: '#ff8d82',
  muted: '#c9c3ea',
  neutral: '#8f88bd',
  paper: '#f8f6f0',
} as const

/** The six categorical colours, in order of use. Index 0 follows the ecosystem accent. */
export const CATEGORICAL_HEX = [TOKEN_HEX.teal, TOKEN_HEX.lavender, TOKEN_HEX.peach, TOKEN_HEX.cyan, TOKEN_HEX.gold, TOKEN_HEX.plumLight] as const

/** CSS values for the categorical palette (`--dk-viz-1…6` are set in viz.css on `.dk-viz`). */
export const CATEGORICAL = [1, 2, 3, 4, 5, 6].map((i) => `var(--dk-viz-${i})`)

export const MAX_SERIES = CATEGORICAL.length

/** Colour for series `i` (wraps after 6 — callers should not need more, see MAX_SERIES). */
export function seriesColor(i: number): string {
  return CATEGORICAL[((i % MAX_SERIES) + MAX_SERIES) % MAX_SERIES] ?? 'var(--dk-viz-1)'
}

/** Semantic colours (CSS). */
export const TONE = {
  accent: 'var(--dk-viz-acc)',
  danger: 'var(--dk-viz-danger)',
  warn: 'var(--dk-viz-warn)',
  ok: 'var(--dk-viz-ok)',
  neutral: 'var(--dk-viz-neutral)',
  pos: 'var(--dk-viz-pos)',
  neg: 'var(--dk-viz-neg)',
} as const
export type Tone = keyof typeof TONE

/**
 * Sentiment −1…1 → CSS colour, mixed in oklab between negative (danger ink), neutral and positive (accent).
 * Uses color-mix(), so it follows the theme variables.
 */
export function sentimentColor(s: number): string {
  const v = Math.max(-1, Math.min(1, s))
  if (Math.abs(v) < 0.02) return 'var(--dk-viz-neutral)'
  const pct = Math.round(Math.abs(v) * 100)
  const end = v < 0 ? 'var(--dk-viz-neg)' : 'var(--dk-viz-pos)'
  return `color-mix(in oklab, ${end} ${pct}%, var(--dk-viz-neutral))`
}

/* ------------------------------------------------------------------ contrast (used by the self-test) */

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
