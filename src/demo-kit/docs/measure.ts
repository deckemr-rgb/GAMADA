/**
 * docs/measure.ts — text width without a DOM (so ground-truth OCR boxes can be computed in plain TS, in tests and
 * in the simulated extraction). Widths are Helvetica/Arial AFM advance widths (per 1000 em) for ASCII; serif and
 * mono are scaled / fixed. The SVG renders with metric-compatible system fonts (Arial/Liberation Sans, Times New
 * Roman/Liberation Serif, Courier New/Liberation Mono), so the boxes land on the glyphs within a few percent.
 */
import type { Box, FontKind, Run } from './types'

// prettier-ignore
const HELV: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584,
  ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722,
  O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278,
  ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500,
  y: 500, z: 500, '{': 334, '|': 260, '}': 334, '~': 584,
}

/** Serif (Times) is narrower than Helvetica on average; hand (cursive fallback) a little wider. */
const FONT_SCALE: Record<FontKind, number> = { sans: 1, serif: 0.9, mono: 1, hand: 1.02 }
const BOLD_SCALE = 1.06

export function textWidth(text: string, size: number, font: FontKind = 'sans', weight = 400, ls = 0): number {
  if (font === 'mono') return text.length * size * 0.6 + text.length * ls * size
  let u = 0
  for (const ch of text) u += HELV[ch] ?? (/\d/.test(ch) ? 556 : 560)
  const w = (u / 1000) * size * FONT_SCALE[font] * (weight >= 600 ? BOLD_SCALE : 1)
  return w + text.length * ls * size
}

/** Ink box of a run (ascender → descender), slightly padded. */
export function runBox(r: Run, pad = 0.22): Box {
  const w = textWidth(r.text, r.size, r.font, r.weight, r.ls)
  const left = r.anchor === 'middle' ? r.x - w / 2 : r.anchor === 'end' ? r.x - w : r.x
  const p = r.size * pad
  return { x: left - p, y: r.y - r.size * 0.8 - p, w: w + 2 * p, h: r.size * 1.02 + 2 * p }
}

export function unionBox(boxes: Box[]): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of boxes) {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Greedy word wrap for a given width. */
export function wrap(text: string, maxW: number, size: number, font: FontKind = 'sans', weight = 400): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && textWidth(next, size, font, weight) > maxW) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

export const pct = (b: Box, w: number, h: number): Box => ({
  x: round2((b.x / w) * 100),
  y: round2((b.y / h) * 100),
  w: round2((b.w / w) * 100),
  h: round2((b.h / h) * 100),
})
const round2 = (n: number) => Math.round(n * 100) / 100
