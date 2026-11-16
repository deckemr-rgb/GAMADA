/**
 * frame.ts — maps canvas coordinates (2560 × 2304 layer space) to a layer box,
 * replicating `object-fit: cover; object-position: <focusX> 50%` exactly.
 */
import { CANVAS } from './assets'

export interface FrameMapping {
  /** Scale from canvas px to box px. */
  s: number
  /** Offset of the canvas origin inside the box (px). */
  ox: number
  oy: number
}

export function computeFrame(boxW: number, boxH: number, focusX: number): FrameMapping {
  const s = Math.max(boxW / CANVAS.w, boxH / CANVAS.h)
  return { s, ox: (boxW - CANVAS.w * s) * focusX, oy: (boxH - CANVAS.h * s) / 2 }
}

export function canvasToBox(x: number, y: number, m: FrameMapping): { x: number; y: number } {
  return { x: m.ox + x * m.s, y: m.oy + y * m.s }
}

/** Layer boxes are 106 % wide (3 % overscan each side for pointer parallax) and 160 % tall (30 % bleed). */
export const LAYER_BOX = { overscanX: 0.03, bleedY: 0.3 } as const

export function layerBoxSize(vw: number, vh: number): { w: number; h: number } {
  return { w: vw * (1 + LAYER_BOX.overscanX * 2), h: vh * (1 + LAYER_BOX.bleedY * 2) }
}
