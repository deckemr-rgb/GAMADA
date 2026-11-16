/**
 * viz/force.ts — a small force simulation for NetworkGraph (no d3-force dependency).
 * Velocity Verlet-style integration with link springs, n-body charge (repulsion), centring gravity and a
 * soft collision pass. `alpha` cools geometrically toward `alphaTarget`; the caller stops ticking below
 * `alphaMin`. Pure and deterministic (seeded start positions), so it also runs in Node.
 */

export interface SimNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Fixed position while dragging (null = free). */
  fx: number | null
  fy: number | null
}

export interface SimLink {
  s: SimNode
  t: SimNode
  len: number
  k: number
  bias: number
}

export interface Sim {
  nodes: SimNode[]
  links: SimLink[]
  alpha: number
  alphaTarget: number
  w: number
  h: number
}

/** Simulation timing (per ticker frame). Kept here so the module stays free of gsap/DOM imports. */
export const NET = {
  /** Cooling per step (≈ 300 steps from 1 to alphaMin, like d3-force). */
  alphaDecay: 0.0228,
  alphaMin: 0.004,
  velocityDecay: 0.42,
  /** Alpha after a drag / unfold / resize. */
  reheat: 0.6,
  /** Steps pre-run when animation is off (static / reduced). */
  preRun: 320,
} as const

export const FORCE = {
  charge: -520,
  gravity: 0.06,
  linkBase: 64,
  collidePad: 6,
  /** Max distance (px) for the charge force. */
  chargeMax: 520,
} as const

/** Deterministic 0..1 from a string (FNV-1a). */
export function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** Rest length that lets `n` nodes fill a W×H frame (clamped 44…150 px). */
export function idealLinkLength(n: number, W: number, H: number): number {
  return Math.max(44, Math.min(150, Math.sqrt((W * H) / Math.max(1, n)) * 0.5))
}

export function makeLinks(nodes: SimNode[], edges: { source: string; target: string; weight?: number }[], base: number = FORCE.linkBase): SimLink[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const count = new Map<string, number>()
  for (const e of edges) {
    count.set(e.source, (count.get(e.source) ?? 0) + 1)
    count.set(e.target, (count.get(e.target) ?? 0) + 1)
  }
  const out: SimLink[] = []
  for (const e of edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (!s || !t || s === t) continue
    const cs = count.get(s.id) ?? 1
    const ct = count.get(t.id) ?? 1
    out.push({ s, t, len: base + s.r + t.r, k: 1 / Math.min(cs, ct), bias: cs / (cs + ct) })
  }
  return out
}

/** One simulation step. */
export function step(sim: Sim): void {
  const { nodes, links } = sim
  const a = sim.alpha
  /* links */
  for (const l of links) {
    let dx = l.t.x + l.t.vx - l.s.x - l.s.vx
    let dy = l.t.y + l.t.vy - l.s.y - l.s.vy
    let d = Math.hypot(dx, dy) || 1e-3
    d = ((d - l.len) / d) * a * l.k
    dx *= d
    dy *= d
    l.t.vx -= dx * l.bias
    l.t.vy -= dy * l.bias
    l.s.vx += dx * (1 - l.bias)
    l.s.vy += dy * (1 - l.bias)
  }
  /* charge (n²; graphs here stay < 200 nodes) */
  const maxD2 = FORCE.chargeMax * FORCE.chargeMax
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j]!
      let dx = q.x - p.x
      let dy = q.y - p.y
      let d2 = dx * dx + dy * dy
      if (d2 > maxD2) continue
      if (d2 < 1) {
        dx = (hash01(p.id + q.id) - 0.5) * 2
        dy = (hash01(q.id + p.id) - 0.5) * 2
        d2 = dx * dx + dy * dy + 1
      }
      const f = (FORCE.charge * a) / d2
      p.vx += dx * f
      p.vy += dy * f
      q.vx -= dx * f
      q.vy -= dy * f
    }
  }
  /* gravity toward the centre */
  const cx = sim.w / 2
  const cy = sim.h / 2
  /* anisotropic gravity: a wide frame pulls less horizontally, so the graph fills its aspect ratio */
  const ar = sim.w / Math.max(1, sim.h)
  const gx = FORCE.gravity / Math.max(1, ar)
  const gy = FORCE.gravity * Math.max(1, 1 / ar)
  for (const n of nodes) {
    n.vx += (cx - n.x) * gx * a
    n.vy += (cy - n.y) * gy * a
  }
  /* integrate */
  const keep = 1 - NET.velocityDecay
  for (const n of nodes) {
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx
      n.y = n.fy
      n.vx = 0
      n.vy = 0
      continue
    }
    n.vx *= keep
    n.vy *= keep
    n.x += n.vx
    n.y += n.vy
  }
  /* soft collisions + bounds */
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j]!
      const dx = q.x - p.x
      const dy = q.y - p.y
      const d = Math.hypot(dx, dy) || 1e-3
      const min = p.r + q.r + FORCE.collidePad
      if (d < min) {
        const push = ((min - d) / d) * 0.5
        const pf = p.fx === null ? 1 : 0
        const qf = q.fx === null ? 1 : 0
        const tot = pf + qf || 1
        p.x -= dx * push * (pf / tot)
        p.y -= dy * push * (pf / tot)
        q.x += dx * push * (qf / tot)
        q.y += dy * push * (qf / tot)
      }
    }
  }
  for (const n of nodes) {
    const m = n.r + 4
    n.x = Math.max(m, Math.min(sim.w - m, n.x))
    n.y = Math.max(m, Math.min(sim.h - m, n.y))
  }
  sim.alpha += (sim.alphaTarget - sim.alpha) * NET.alphaDecay
}

/** Run until cool (or `max` steps) — static / reduced mode and tests. */
export function settle(sim: Sim, max: number = NET.preRun): number {
  let k = 0
  while (k < max && (sim.alpha > NET.alphaMin || sim.alphaTarget > 0)) {
    step(sim)
    k++
  }
  return k
}
