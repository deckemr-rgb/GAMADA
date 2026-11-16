/**
 * gl.ts — tiny shared helpers for the OGL effects (WaterfallGL, Particles, CurtainGL).
 *
 *  - createGL()      transparent, premultiplied, depth-less OGL renderer (null when WebGL is missing)
 *  - sizeGL()        resize the drawing buffer WITHOUT touching the canvas' CSS size
 *  - destroyGL()     lose the context so the browser frees the GPU memory immediately
 *  - effectDpr()     DPR cap per perf tier (motion.ts → WEBGL: 1.25 on 'high', 1 on 'mid' / 'low')
 *  - hexToRgb()      '#rrggbb' → [r, g, b] in 0..1 for vec3 uniforms
 *  - GLSL_NOISE      hash / value-noise / fbm chunk shared by every fragment shader
 */
import { Renderer } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { hasWebGL, type PerfTier } from './perf'
import { WEBGL } from './motion'

/** DPR to render an effect canvas at: WEBGL.dprHigh on 'high', WEBGL.dprLow on 'mid' / 'low' (or when degraded). */
export function effectDpr(tier: PerfTier, degraded = false): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const cap = tier === 'high' && !degraded ? WEBGL.dprHigh : WEBGL.dprLow
  return Math.min(dpr, cap)
}

/**
 * Creates a transparent OGL renderer on `canvas`. Returns null instead of throwing (or
 * letting OGL log an error) when WebGL is unavailable, so callers can simply bail out.
 */
export function createGL(canvas: HTMLCanvasElement): Renderer | null {
  if (!hasWebGL()) return null
  try {
    const renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'low-power',
      dpr: 1,
      width: 1,
      height: 1,
    })
    const gl = renderer.gl
    if (!gl) return null
    // OGL's constructor calls setSize(), which writes inline px sizes; CSS owns layout here.
    canvas.style.width = ''
    canvas.style.height = ''
    gl.clearColor(0, 0, 0, 0)
    return renderer
  } catch {
    return null
  }
}

/**
 * Sets the drawing buffer to `cssW × cssH × scale` (rounded) and keeps OGL's viewport in sync.
 * Unlike `renderer.setSize`, this never writes inline CSS width/height, so the canvas can be
 * sized by stylesheet (inset: 0) or by its own canvas-space style.
 */
export function sizeGL(renderer: Renderer, cssW: number, cssH: number, scale: number): void {
  const bw = Math.max(1, Math.round(cssW * scale))
  const bh = Math.max(1, Math.round(cssH * scale))
  const canvas = renderer.gl.canvas
  if (canvas.width !== bw) canvas.width = bw
  if (canvas.height !== bh) canvas.height = bh
  // OGL computes the viewport as width * dpr; feed it the exact buffer size.
  renderer.dpr = 1
  renderer.width = bw
  renderer.height = bh
}

/** Clears the canvas to fully transparent. */
export function clearGL(renderer: Renderer): void {
  const gl = renderer.gl
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
}

/**
 * Creates a fresh <canvas> inside `host` for one effect lifetime. Effects must NOT reuse a
 * React-rendered canvas: after `loseContext()` (cleanup) the same element would hand back the
 * dead context on the next mount (e.g. React StrictMode's mount → unmount → mount).
 * Returns the canvas and a remover for cleanup.
 */
export function mountCanvas(host: HTMLElement): { canvas: HTMLCanvasElement; remove: () => void } {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'gl-canvas'
  host.appendChild(canvas)
  return { canvas, remove: () => canvas.remove() }
}

/** True when the OGL program compiled and linked (false e.g. on a lost context). */
export function programOk(gl: OGLRenderingContext, program: { program: WebGLProgram }): boolean {
  try {
    return !gl.isContextLost() && !!gl.getProgramParameter(program.program, gl.LINK_STATUS)
  } catch {
    return false
  }
}

/** Frees the GPU context right away (browsers cap live contexts at ~16). */
export function destroyGL(gl: OGLRenderingContext | null | undefined): void {
  if (!gl) return
  try {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    /* already lost */
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Deterministic PRNG (mulberry32) so particle layouts are stable between reloads. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fullscreen-triangle vertex shader (OGL's Triangle gives `position` + `uv`). */
export const FULLSCREEN_VERT = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

/** Hash + value noise + fbm (GLSL ES 1.00, works on WebGL1 and WebGL2). */
export const GLSL_NOISE = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}
`
