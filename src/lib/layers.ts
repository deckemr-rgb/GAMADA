/**
 * layers.ts — runtime view of the generated raster layers (tools/build-layers.mjs).
 * Each art key has a trimmed bbox in canvas px plus AVIF/WebP variants; the image is placed
 * inside the layer box with CSS variables (--s, --ox, --oy) that reproduce the cover mapping.
 */
import generated from './layers.generated.json'
import { CANVAS } from './assets'
import { LAYER_BOX } from './frame'

interface Variant {
  canvasW: number
  w: number
  h: number
  avif: string
  webp: string
  bytes: number
}
export interface ArtEntry {
  bbox: { x: number; y: number; w: number; h: number }
  opaque: boolean
  files: Variant[]
  blur?: { bbox: { x: number; y: number; w: number; h: number }; avif: string; webp: string; w: number; h: number }
}

const ART = generated as unknown as Record<string, ArtEntry | undefined>

export function getArt(key: string): ArtEntry | undefined {
  return ART[key]
}

export const srcSet = (a: ArtEntry, fmt: 'avif' | 'webp'): string => a.files.map((f) => `${f[fmt]} ${f.w}w`).join(', ')

/** Mobile always gets the 1280 variant (keeps phones under the byte budget). */
export const mobileSrc = (a: ArtEntry, fmt: 'avif' | 'webp'): string | undefined => a.files[0]?.[fmt]

/**
 * `sizes` for a bbox: rendered width = bbox.w · s, with s = max(boxW / 2560, boxH / 2304)
 * and the layer box = 106 vw × 160 vh.
 */
export function sizesFor(bboxW: number): string {
  const vw = ((bboxW * (1 + LAYER_BOX.overscanX * 2) * 100) / CANVAS.w).toFixed(2)
  const vh = ((bboxW * (1 + LAYER_BOX.bleedY * 2) * 100) / CANVAS.h).toFixed(2)
  return `max(${vw}vw, ${vh}vh)`
}

/** Inline position of a bbox inside a layer box driven by the scene's --s / --ox / --oy variables. */
export function placeStyle(b: { x: number; y: number; w: number; h: number }): Record<string, string> {
  return {
    left: `calc(var(--ox) + ${b.x}px * var(--s))`,
    top: `calc(var(--oy) + ${b.y}px * var(--s))`,
    width: `calc(${b.w}px * var(--s))`,
    height: `calc(${b.h}px * var(--s))`,
  }
}
