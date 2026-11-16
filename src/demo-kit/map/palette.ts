/**
 * map/palette.ts — concrete colours for MapLibre (it cannot read CSS variables), derived from the dusk tokens
 * (viz/palette TOKEN_HEX). Basemap = direction C: ink land, slightly lighter indigo water, muted roads,
 * subtle labels. Choropleth = sequential ramp indigo → ecosystem teal; red stays reserved for danger.
 */
import { TOKEN_HEX, luminance } from '../viz/palette'
import type { MapTone } from './types'

export const MAPC = {
  land: TOKEN_HEX.ink, // #1a1638
  landAlt: '#1e1942',
  water: '#2a2560',
  waterLine: '#3a3480',
  wood: '#1c1a3e',
  roadMinor: '#2b2654',
  roadMajor: '#3a3468',
  roadTrunk: '#4a4384',
  building: '#221d4a',
  boundary: '#4a4384',
  label: '#8f88bd',
  labelHalo: TOKEN_HEX.ink,
  /** outside-the-region dimming */
  mask: '#100d26',
  /** region pack overlays */
  kecLine: TOKEN_HEX.lavender,
  desaLine: '#8f88bd',
  outline: '#d9d4ff',
  river: TOKEN_HEX.cyan,
  hazardHigh: TOKEN_HEX.cyan,
  hazardMid: '#7aa7ff',
  hover: TOKEN_HEX.lavender,
  select: TOKEN_HEX.teal,
  affected: TOKEN_HEX.gold,
} as const

/** Sequential choropleth ramp (5 classes) — dark indigo to the Satu Daerah accent. ≥ 3:1 between ends. */
export const RAMP = ['#2c2a5c', '#2f4c78', '#2f7686', '#35a597', TOKEN_HEX.teal] as const

/** Heatmap ramp (density 0 → 1): transparent → indigo → lavender → peach → gold. */
export const HEAT_RAMP = [
  [0, 'rgba(43,33,82,0)'],
  [0.2, 'rgba(93,76,170,0.55)'],
  [0.45, 'rgba(185,178,255,0.7)'],
  [0.7, 'rgba(245,154,98,0.8)'],
  [1, 'rgba(255,215,126,0.92)'],
] as const

/** Badge colours per marker tone: [fill, glyph]. */
export const TONE_BADGE: Record<MapTone, [string, string]> = {
  accent: [TOKEN_HEX.teal, '#06231e'],
  neutral: ['#3a3470', '#f3f0ff'],
  warn: [TOKEN_HEX.gold, '#2a1d00'],
  danger: [TOKEN_HEX.red, '#ffffff'],
  info: [TOKEN_HEX.lavender, '#1a1638'],
}

/** Swatch colour of a tone for HTML legends (same as the badge fill). */
export const toneColor = (t: MapTone): string => TONE_BADGE[t][0]

/** Label text colour on top of a fill: dark text on light fills, light text on dark fills (AA on both). */
export function labelInk(fill: string | null): { color: string; halo: string } {
  if (fill && luminance(fill) > 0.28) return { color: '#0f0c24', halo: 'rgba(255,255,255,0.35)' }
  return { color: '#f3f0ff', halo: 'rgba(16,13,38,0.85)' }
}

/** n-1 quantile breaks for `values` (ascending, de-duplicated). */
export function quantileBreaks(values: number[], classes = RAMP.length): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length < 2) return []
  const out: number[] = []
  for (let k = 1; k < classes; k++) {
    const q = v[Math.min(v.length - 1, Math.floor((k / classes) * v.length))]!
    if (!out.length || q > out[out.length - 1]!) out.push(q)
  }
  return out
}

/** Class index of `v` given ascending breaks (0 … breaks.length). */
export function classOf(v: number, breaks: number[]): number {
  let c = 0
  while (c < breaks.length && v >= breaks[c]!) c++
  return c
}

/** Ramp colour for class c of (breaks.length + 1) classes, spread over the 5-stop ramp. */
export function classColor(c: number, nClasses: number): string {
  if (nClasses <= 1) return RAMP[RAMP.length - 1]!
  const idx = Math.round((c / (nClasses - 1)) * (RAMP.length - 1))
  return RAMP[Math.max(0, Math.min(RAMP.length - 1, idx))]!
}
