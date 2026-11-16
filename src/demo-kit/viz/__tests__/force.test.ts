/**
 * Self-test for viz/force.ts (network layout) and BubbleChart packing.
 * Run: npx tsx src/demo-kit/viz/__tests__/force.test.ts
 */
import { NET, hash01, idealLinkLength, makeLinks, settle, type Sim, type SimNode } from '../force'
import { packBubbles } from '../pack'

let failed = 0
let passed = 0
function ok(label: string, cond: boolean, info = '') {
  if (cond) passed++
  else {
    failed++
    console.error(`✗ ${label} ${info}`)
  }
}

function build(n: number, W: number, H: number): Sim {
  const nodes: SimNode[] = Array.from({ length: n }, (_, i) => {
    const a = hash01(`n${i}`) * Math.PI * 2
    return { id: `n${i}`, x: W / 2 + Math.cos(a) * 20, y: H / 2 + Math.sin(a) * 20, vx: 0, vy: 0, r: i % 5 === 0 ? 9 : 7, fx: null, fy: null }
  })
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ source: `n${i + 1}`, target: `n${Math.floor(hash01(`e${i}`) * (i + 1))}` }))
  return { nodes, links: makeLinks(nodes, edges, idealLinkLength(n, W, H)), alpha: 1, alphaTarget: 0, w: W, h: H }
}

for (const [n, W, H] of [
  [14, 1300, 380],
  [40, 360, 320],
  [120, 900, 420],
] as const) {
  const sim = build(n, W, H)
  const steps = settle(sim, 2000)
  ok(`settles (${n} nodes, ${W}×${H})`, steps <= 320 && sim.alpha <= NET.alphaMin + 1e-9, `steps=${steps} alpha=${sim.alpha}`)
  ok(`in bounds (${n})`, sim.nodes.every((p) => p.x >= p.r && p.x <= W - p.r && p.y >= p.r && p.y <= H - p.r))
  let overlaps = 0
  for (let i = 0; i < sim.nodes.length; i++)
    for (let j = i + 1; j < sim.nodes.length; j++) {
      const a = sim.nodes[i]!
      const b = sim.nodes[j]!
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 0.5) overlaps++
    }
  ok(`no overlaps (${n})`, overlaps === 0, `overlaps=${overlaps}`)
  const xs = sim.nodes.map((p) => p.x)
  const ys = sim.nodes.map((p) => p.y)
  const spanX = (Math.max(...xs) - Math.min(...xs)) / W
  const spanY = (Math.max(...ys) - Math.min(...ys)) / H
  ok(`uses the frame (${n})`, spanX > 0.5 && spanY > 0.45, `spanX=${spanX.toFixed(2)} spanY=${spanY.toFixed(2)}`)
  ok(`finite (${n})`, sim.nodes.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
}

/* determinism */
const a = build(20, 600, 400)
const b = build(20, 600, 400)
settle(a)
settle(b)
ok('deterministic', a.nodes.every((p, i) => p.x === b.nodes[i]!.x && p.y === b.nodes[i]!.y))

/* bubble packing */
for (const [W, H, n] of [
  [1300, 340, 12],
  [820, 340, 12],
  [358, 300, 12],
  [600, 300, 40],
  [200, 200, 1],
] as const) {
  const vols = Array.from({ length: n }, (_, i) => (i < 3 ? 900 + i * 200 : 120 + hash01(`v${i}`) * 600))
  const pk = packBubbles(vols, W, H)
  ok(`pack count ${W}×${H}`, pk.length === n && pk.every(Boolean))
  ok(`pack bounds ${W}×${H}`, pk.every((c) => c.x - c.r >= 0 && c.x + c.r <= W && c.y - c.r >= 0 && c.y + c.r <= H))
  let ov = 0
  for (let i = 0; i < pk.length; i++) for (let j = i + 1; j < pk.length; j++) if (Math.hypot(pk[i]!.x - pk[j]!.x, pk[i]!.y - pk[j]!.y) < pk[i]!.r + pk[j]!.r) ov++
  ok(`pack no overlap ${W}×${H}`, ov === 0, `overlaps=${ov}`)
  const area = pk.reduce((s, c) => s + Math.PI * c.r * c.r, 0) / (W * H)
  ok(`pack density ${W}×${H}`, area > 0.15, `density=${area.toFixed(2)}`)
  const order = vols.map((_, i) => i).sort((a, b) => vols[b]! - vols[a]!)
  ok(`pack area ∝ volume ${W}×${H}`, n < 2 || pk[order[0]!]!.r >= pk[order[n - 1]!]!.r)
}
ok('pack empty', packBubbles([], 100, 100).length === 0)

console.log(`${failed ? '✗' : '✓'} viz force: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
