/**
 * Self-test for viz/monotone.ts: its line / area paths and extent must equal d3-shape's curveMonotoneX and
 * d3-array's extent exactly (Sparkline switched from d3 to it). Run: npx tsx src/demo-kit/viz/__tests__/monotone.test.ts
 */
import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape'
import { extent } from 'd3-array'
import { extentOf, monotoneArea, monotoneLine } from '../monotone'

let failed = 0
let passed = 0
function eq(label: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++
  else {
    failed++
    if (failed < 8) console.error(`✗ ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`)
  }
}

let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const series: number[][] = [[], [5], [5, 5], [1, 2], [3, 3, 3], [1, 5, 2], [0, -2, 4, 4, 4, 1], [1e6, 1.5e6, 9e5]]
for (let k = 0; k < 400; k++) {
  const n = 1 + Math.floor(rnd() * 30)
  series.push(Array.from({ length: n }, () => (rnd() < 0.1 ? 0 : Math.round((rnd() - 0.3) * 10 ** (1 + Math.floor(rnd() * 5))) / (rnd() < 0.5 ? 1 : 7))))
}
for (const [k, vals] of series.entries()) {
  for (const w of [40, 120, 333.3]) {
    const height = 28
    const [lo = 0, hi = 1] = extent(vals) as [number | undefined, number | undefined]
    eq(`extent #${k}`, extentOf(vals), extent(vals))
    const n = vals.length
    const x = (i: number) => 2 + (i / Math.max(1, n - 1)) * (w - 6)
    const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)
    const xs = vals.map((_, i) => x(i))
    const ys = vals.map(y)
    eq(`line #${k} w${w}`, monotoneLine(xs, ys), d3line<number>().x((_, i) => x(i)).y(y).curve(curveMonotoneX)(vals))
    eq(`area #${k} w${w}`, monotoneArea(xs, ys, height), d3area<number>().x((_, i) => x(i)).y0(height).y1(y).curve(curveMonotoneX)(vals))
  }
}
eq('extent with NaN / null', extentOf([NaN, 3, NaN, -1, null as unknown as number]), extent([NaN, 3, NaN, -1, null as unknown as number]))

console.log(failed ? `✗ ${failed} failed, ${passed} passed` : `✓ monotone: ${passed} checks equal d3`)
;(globalThis as unknown as { process: { exit(c: number): never } }).process.exit(failed ? 1 : 0)
