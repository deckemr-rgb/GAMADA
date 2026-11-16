/**
 * map/rainLayer.ts — MapLibre custom WebGL layer that draws rain cells as soft radar blobs with stepped
 * intensity bands (cyan → lavender → gold; red stays reserved for danger). Geometry is 6 vertices per cell
 * rebuilt on the CPU per frame (≤ 12 cells); the noise pattern is in the fragment shader, so a frame costs
 * one small buffer upload and one draw call. No own RAF: the engine calls triggerRepaint() from gsap.ticker.
 */
import { rainSprites, type RainSprite } from './rain'
import type { BBox } from './geo'
import type { RainCellInput } from './types'

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute vec3 a_p;
uniform mat4 u_matrix;
uniform float u_world;
varying vec2 v_uv;
varying vec3 v_p;
void main() {
  v_uv = a_uv;
  v_p = a_p;
  gl_Position = u_matrix * vec4(a_pos * u_world, 0.0, 1.0);
}`

const FS = `
precision mediump float;
varying vec2 v_uv;
varying vec3 v_p;
uniform float u_time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float r = length(v_uv);
  if (r > 1.0) discard;
  vec2 q = v_uv + vec2(v_p.z * 17.0, v_p.z * 9.0);
  float n = noise(q * 2.6 + vec2(u_time * 0.07, -u_time * 0.05)) * 0.62 + noise(q * 6.5 - vec2(u_time * 0.11, u_time * 0.04)) * 0.38;
  float core = 1.0 - smoothstep(0.0, 1.0, r);
  float v = clamp(core * (0.5 + 0.75 * n) * (0.4 + 0.8 * v_p.x), 0.0, 1.0);
  float band = floor(v * 5.0) / 5.0;
  float vv = mix(v, band, 0.6);
  vec3 c1 = vec3(0.31, 0.82, 1.0);
  vec3 c2 = vec3(0.725, 0.698, 1.0);
  vec3 c3 = vec3(1.0, 0.843, 0.494);
  vec3 col = vv < 0.5 ? mix(c1, c2, vv * 2.0) : mix(c2, c3, (vv - 0.5) * 2.0);
  float a = smoothstep(0.1, 0.32, vv) * (0.22 + 0.5 * vv) * v_p.y;
  gl_FragColor = vec4(col * a, a);
}`

const STRIDE = 7 // pos2 uv2 p3
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
] as const

const mercX = (lng: number) => (180 + lng) / 360
const mercY = (lat: number) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360
const EARTH_CIRC_KM = 40075.016686

type GL = WebGLRenderingContext | WebGL2RenderingContext

export class RainLayer {
  readonly id: string
  readonly type = 'custom' as const
  readonly renderingMode = '2d' as const
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private data = new Float32Array(0)
  private sprites: RainSprite[] = []
  private loc: { pos: number; uv: number; p: number; matrix: WebGLUniformLocation | null; time: WebGLUniformLocation | null; world: WebGLUniformLocation | null } | null = null
  cells: RainCellInput[]
  bbox: BBox
  hour = 0
  ambientSec = 0
  visible = true
  private map: { getZoom(): number } | null = null

  constructor(id: string, cells: RainCellInput[], bbox: BBox) {
    this.id = id
    this.cells = cells
    this.bbox = bbox
  }

  onAdd(map: unknown, gl: GL): void {
    this.map = map as { getZoom(): number }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`rain shader: ${gl.getShaderInfoLog(s) ?? ''}`)
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`rain program: ${gl.getProgramInfoLog(p) ?? ''}`)
    this.program = p
    this.loc = {
      pos: gl.getAttribLocation(p, 'a_pos'),
      uv: gl.getAttribLocation(p, 'a_uv'),
      p: gl.getAttribLocation(p, 'a_p'),
      matrix: gl.getUniformLocation(p, 'u_matrix'),
      time: gl.getUniformLocation(p, 'u_time'),
      world: gl.getUniformLocation(p, 'u_world'),
    }
    this.buffer = gl.createBuffer()
  }

  onRemove(_map: unknown, gl: GL): void {
    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.program) gl.deleteProgram(this.program)
    this.buffer = null
    this.program = null
  }

  render(gl: GL, options: unknown): void {
    if (!this.visible || !this.program || !this.loc || !this.buffer || !this.cells.length) return
    // modelViewProjectionMatrix works in world pixels (512 · 2^zoom); vertices are mercator 0…1 scaled by u_world.
    const o = options as { modelViewProjectionMatrix?: ArrayLike<number> } | ArrayLike<number>
    const matrix = 'modelViewProjectionMatrix' in (o as object) ? (o as { modelViewProjectionMatrix: ArrayLike<number> }).modelViewProjectionMatrix : (o as ArrayLike<number>)
    if (!matrix) return

    const sprites = rainSprites(this.cells, this.bbox, this.hour, this.ambientSec, this.sprites)
    const need = sprites.length * 6 * STRIDE
    if (this.data.length !== need) this.data = new Float32Array(need)
    const d = this.data
    let k = 0
    for (const s of sprites) {
      const cx = mercX(s.lng)
      const cy = mercY(s.lat)
      const r = s.radiusKm / (EARTH_CIRC_KM * Math.cos((s.lat * Math.PI) / 180))
      for (const [u, v] of CORNERS) {
        d[k++] = cx + u * r
        d[k++] = cy - v * r
        d[k++] = u
        d[k++] = v
        d[k++] = s.power
        d[k++] = s.alpha
        d[k++] = s.seed
      }
    }
    const L = this.loc
    // never write attribute state into a vertex array object MapLibre left bound
    if ('bindVertexArray' in gl) gl.bindVertexArray(null)
    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW)
    const F = Float32Array.BYTES_PER_ELEMENT
    gl.enableVertexAttribArray(L.pos)
    gl.vertexAttribPointer(L.pos, 2, gl.FLOAT, false, STRIDE * F, 0)
    gl.enableVertexAttribArray(L.uv)
    gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, STRIDE * F, 2 * F)
    gl.enableVertexAttribArray(L.p)
    gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, STRIDE * F, 4 * F)
    gl.uniformMatrix4fv(L.matrix, false, matrix as Float32Array)
    gl.uniform1f(L.time, this.ambientSec)
    gl.uniform1f(L.world, 512 * Math.pow(2, this.map?.getZoom() ?? 0))
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6)
    gl.disableVertexAttribArray(L.pos)
    gl.disableVertexAttribArray(L.uv)
    gl.disableVertexAttribArray(L.p)
  }
}
