/**
 * docs/noise.ts — one static scan-grain tile, generated once on a canvas (seeded) and reused as a CSS background.
 * No SVG filters, nothing animated.
 */
import { mulberry32 } from '../world/rng'

const SIZE = 128
let cached: string | null = null

export function noiseUrl(): string {
  if (cached !== null) return cached
  if (typeof document === 'undefined') return (cached = '')
  try {
    const c = document.createElement('canvas')
    c.width = SIZE
    c.height = SIZE
    const ctx = c.getContext('2d')
    if (!ctx) return (cached = '')
    const img = ctx.createImageData(SIZE, SIZE)
    const rnd = mulberry32(0x5ca9)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = rnd()
      const dark = v < 0.5
      const o = i * 4
      const g = dark ? 40 : 255
      img.data[o] = g
      img.data[o + 1] = g
      img.data[o + 2] = dark ? 48 : 250
      // sparse speckles + light grain
      img.data[o + 3] = v < 0.012 ? 150 : Math.round(rnd() * 46)
    }
    ctx.putImageData(img, 0, 0)
    cached = `url(${c.toDataURL('image/png')})`
  } catch {
    cached = ''
  }
  return cached
}
