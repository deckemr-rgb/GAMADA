/**
 * viz/pack.ts — deterministic circle packing for BubbleChart (pure; tested in __tests__/force.test.ts).
 * Largest first; each next circle takes the free spot tangent to an already placed circle that lies closest
 * to the centre (distance normalised by the frame's aspect ratio). If a circle cannot fit, the whole layout is
 * retried at 90% scale, so the result never overlaps and always stays inside the frame.
 */
export interface Placed {
  x: number
  y: number
  r: number
}

export function packBubbles(volumes: number[], W: number, H: number, fill = 0.42, pad = 3): Placed[] {
  const n = volumes.length
  if (!n || W <= 0 || H <= 0) return []
  const total = volumes.reduce((a, b) => a + Math.max(0, b), 0) || 1
  const order = volumes.map((_, i) => i).sort((a, b) => (volumes[b] ?? 0) - (volumes[a] ?? 0) || a - b)
  const cx = W / 2
  const cy = H / 2
  const nx = W / 2
  const ny = H / 2
  let k = Math.sqrt((fill * W * H) / (Math.PI * total))
  for (let attempt = 0; attempt < 14; attempt++, k *= 0.9) {
    const out: Placed[] = new Array(n)
    const placed: Placed[] = []
    let failed = false
    for (const i of order) {
      const r = Math.max(3, k * Math.sqrt(Math.max(0, volumes[i] ?? 0)))
      if (2 * r + 4 > Math.min(W, H)) {
        failed = true
        break
      }
      let best: Placed | null = null
      let bestD = Infinity
      const consider = (x: number, y: number) => {
        if (x - r < 2 || x + r > W - 2 || y - r < 2 || y + r > H - 2) return
        const d = ((x - cx) / nx) ** 2 + ((y - cy) / ny) ** 2
        if (d >= bestD) return
        for (const q of placed) if (Math.hypot(q.x - x, q.y - y) < q.r + r + pad - 1e-6) return
        best = { x, y, r }
        bestD = d
      }
      if (!placed.length) consider(cx, cy)
      for (const q of placed) {
        for (let s = 0; s < 36; s++) {
          const a = (s / 36) * Math.PI * 2
          const dist = q.r + r + pad
          consider(q.x + Math.cos(a) * dist, q.y + Math.sin(a) * dist)
        }
      }
      if (!best) {
        failed = true
        break
      }
      placed.push(best)
      out[i] = best
    }
    if (!failed) return out
  }
  /* last resort: a simple grid (never overlaps) */
  const cols = Math.ceil(Math.sqrt((n * W) / H))
  const cw = W / cols
  const rows = Math.ceil(n / cols)
  const ch = H / rows
  const r = Math.max(2, Math.min(cw, ch) / 2 - pad)
  return volumes.map((_, i) => ({ x: (i % cols) * cw + cw / 2, y: Math.floor(i / cols) * ch + ch / 2, r }))
}
