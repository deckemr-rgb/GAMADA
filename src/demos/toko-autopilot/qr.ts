/**
 * qr.ts — a deterministic 25×25 dummy QR pattern from the sale reference (finder squares + hashed modules). It is
 * NOT a real QR code and cannot be paid: the caption says so, and "QRIS" is plain text (no official logo).
 */
import { hashString, mulberry32 } from '../../demo-kit/world'

export const QR_N = 25
/** SVG path ("M x y h1 v1 h-1 z" per dark module) for a 25×25 grid */
export function qrPath(key: string): string {
  const rnd = mulberry32(hashString(key))
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [QR_N - 7, 0], [0, QR_N - 7]] as const) {
      const dx = x - fx
      const dy = y - fy
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return 0
        const ring = Math.min(dx, dy, 6 - dx, 6 - dy)
        return ring === 1 ? 0 : 1
      }
    }
    return -1
  }
  let d = ''
  for (let y = 0; y < QR_N; y++)
    for (let x = 0; x < QR_N; x++) {
      const f = finder(x, y)
      const on = f >= 0 ? f === 1 : (y === 6 || x === 6) ? (x + y) % 2 === 0 : rnd() < 0.48
      if (on) d += `M${x} ${y}h1v1h-1z`
    }
  return d
}
