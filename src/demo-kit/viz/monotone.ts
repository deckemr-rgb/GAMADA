/**
 * viz/monotone.ts — the monotone-x line and area paths of d3-shape (curveMonotoneX, d3-path with its default 3
 * digits), ported line for line so the SVG path strings are byte-identical (viz/__tests__/monotone.test.ts compares
 * them with d3). Sparkline uses it instead of d3-shape: a demo that only shows sparklines (Meja Pimpinan's KPI cards)
 * then does not download the shared d3-shape chunk the full charts need.
 * Steffen 1990, "A Simple Method for Monotonic Interpolation in One Dimension" (the method d3 uses).
 */

const r3 = (v: number) => Math.round(v * 1000) / 1000

/** d3-path's Path with digits = 3 (only what the curve calls; the current y is not needed for that) */
class PathOut {
  s = ''
  private x0: number | null = null
  private x1: number | null = null
  moveTo(x: number, y: number) {
    this.s += `M${r3((this.x0 = this.x1 = x))},${r3(y)}`
  }
  lineTo(x: number, y: number) {
    this.s += `L${r3((this.x1 = x))},${r3(y)}`
  }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.s += `C${r3(x1)},${r3(y1)},${r3(x2)},${r3(y2)},${r3((this.x1 = x))},${r3(y)}`
  }
  closePath() {
    if (this.x1 !== null) {
      this.x1 = this.x0
      this.s += 'Z'
    }
  }
}

const sign = (x: number) => (x < 0 ? -1 : 1)

/** d3-shape's MonotoneX curve */
class MonotoneX {
  private line: number | undefined = undefined
  private point0 = 0
  private x0 = NaN
  private x1 = NaN
  private y0 = NaN
  private y1 = NaN
  private t0 = NaN
  constructor(private ctx: PathOut) {}
  private slope3(x2: number, y2: number): number {
    const h0 = this.x1 - this.x0
    const h1 = x2 - this.x1
    const s0 = (this.y1 - this.y0) / (h0 || ((h1 < 0 && -0) as number))
    const s1 = (y2 - this.y1) / (h1 || ((h0 < 0 && -0) as number))
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  private slope2(t: number): number {
    const h = this.x1 - this.x0
    return h ? ((3 * (this.y1 - this.y0)) / h - t) / 2 : t
  }
  private curveTo(t0: number, t1: number) {
    const dx = (this.x1 - this.x0) / 3
    this.ctx.bezierCurveTo(this.x0 + dx, this.y0 + dx * t0, this.x1 - dx, this.y1 - dx * t1, this.x1, this.y1)
  }
  areaStart() {
    this.line = 0
  }
  areaEnd() {
    this.line = NaN
  }
  lineStart() {
    this.x0 = this.x1 = this.y0 = this.y1 = this.t0 = NaN
    this.point0 = 0
  }
  lineEnd() {
    switch (this.point0) {
      case 2:
        this.ctx.lineTo(this.x1, this.y1)
        break
      case 3:
        this.curveTo(this.t0, this.slope2(this.t0))
        break
    }
    if (this.line || (this.line !== 0 && this.point0 === 1)) this.ctx.closePath()
    this.line = 1 - (this.line as number)
  }
  point(x: number, y: number) {
    let t1 = NaN
    if (x === this.x1 && y === this.y1) return // coincident points are ignored
    switch (this.point0) {
      case 0:
        this.point0 = 1
        if (this.line) this.ctx.lineTo(x, y)
        else this.ctx.moveTo(x, y)
        break
      case 1:
        this.point0 = 2
        break
      case 2:
        this.point0 = 3
        t1 = this.slope3(x, y)
        this.curveTo(this.slope2(t1), t1)
        break
      default:
        t1 = this.slope3(x, y)
        this.curveTo(this.t0, t1)
        break
    }
    this.x0 = this.x1
    this.x1 = x
    this.y0 = this.y1
    this.y1 = y
    this.t0 = t1
  }
}

/** = d3.line().x(xs[i]).y(ys[i]).curve(curveMonotoneX)(data): null for no points */
export function monotoneLine(xs: readonly number[], ys: readonly number[]): string | null {
  const out = new PathOut()
  const c = new MonotoneX(out)
  if (xs.length) {
    c.lineStart()
    for (let i = 0; i < xs.length; i++) c.point(+xs[i]!, +ys[i]!)
    c.lineEnd()
  }
  return out.s || null
}

/** = d3.area().x(xs[i]).y0(y0).y1(ys[i]).curve(curveMonotoneX)(data): null for no points */
export function monotoneArea(xs: readonly number[], ys: readonly number[], y0: number): string | null {
  const out = new PathOut()
  const c = new MonotoneX(out)
  const n = xs.length
  if (n) {
    c.areaStart()
    c.lineStart()
    for (let i = 0; i < n; i++) c.point(+xs[i]!, +ys[i]!)
    c.lineEnd()
    c.lineStart()
    for (let k = n - 1; k >= 0; k--) c.point(+xs[k]!, +y0)
    c.lineEnd()
    c.areaEnd()
  }
  return out.s || null
}

/** = d3.extent: [min, max] of the comparable values, [undefined, undefined] when there are none */
export function extentOf(values: readonly number[]): [number | undefined, number | undefined] {
  let lo: number | undefined
  let hi: number | undefined
  for (const v of values) {
    if (v != null && v >= v) {
      if (lo === undefined) lo = hi = v
      else {
        if (lo > v) lo = v
        if (hi! < v) hi = v
      }
    }
  }
  return [lo, hi]
}
