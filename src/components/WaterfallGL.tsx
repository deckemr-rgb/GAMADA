/**
 * WaterfallGL — animated waterfall shader drawn inside a FrameSpace (2560 × 2304 canvas coords).
 *
 * The <canvas> is laid out in canvas px (left/top/width/height = rect) and FrameSpace scales it
 * by `s`, so its drawing buffer is rect × s × dpr to stay crisp on screen.
 *
 * Look (all in one fragment shader, no textures):
 *  - fast, vertically stretched fbm streaks in two translucent sheets moving at different speeds
 *  - soft, noisy side edges + a slight sway, brighter core
 *  - a billowing foam / mist pool over the bottom 12 % that spreads wider than the fall
 *  - spray droplets rising and falling near the base
 *  - a faint glow halo around the whole fall
 *
 * It sits on top of a static SVG fallback of the same rect, so the core is fairly opaque
 * (the fallback should not double up) while the edges stay feathered.
 *
 * Perf: driven by gsap.ticker; the callback returns before touching WebGL while the tab is hidden
 * or the owning scene is not visible (zero GPU work; the last frame is kept for when it reappears).
 * Drawing buffer = rect × FrameSpace scale × effectDpr (≤ 1.25 'high', 1 otherwise).
 * 'low' tier → not rendered at all (the static fallback layer shows). Degrade level ≥
 * DEGRADE.levelWaterfallStatic → the shader unmounts and frees its context (fallback stays).
 */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Mesh, Program, Triangle, type Renderer } from 'ogl'
import type { CanvasRect, SceneId } from '../lib/assets'
import { motionState, on } from '../lib/store'
import { getPerfTier, onDegrade } from '../lib/perf'
import { DEGRADE, WATERFALL } from '../lib/motion'
import { useFrameMapping } from '../lib/frameContext'
import { FULLSCREEN_VERT, GLSL_NOISE, clearGL, createGL, destroyGL, effectDpr, hexToRgb, mountCanvas, programOk, sizeGL } from '../lib/gl'
import '../styles/webgl.css'

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;   // width / height of the rect
uniform float uFall;
uniform float uFoamH;
uniform vec3 uCore;
uniform vec3 uTint;
${GLSL_NOISE}

// One sheet of falling water: long vertical streaks (x frequency high, y frequency low).
float sheet(vec2 p, float speed, float freqX, float seed) {
  vec2 q = vec2(p.x * freqX + seed, (p.y - uTime * speed) * 1.6);
  float n = fbm(q);
  // a second, finer streak layer for crisp highlights
  float m = vnoise(vec2(p.x * freqX * 2.3 + seed * 3.1, (p.y - uTime * speed * 1.25) * 3.0));
  return n * 0.7 + m * 0.3;
}

void main() {
  // v: 0 at the top of the rect, 1 at the bottom (OGL's uv.y grows upwards).
  float x = vUv.x;
  float v = 1.0 - vUv.y;
  float t = uTime;

  // ---- shape: centre line sways a little, the fall widens towards the base
  float sway = sin(v * 3.1 + t * 0.8) * 0.012 + (vnoise(vec2(v * 2.0, t * 0.35)) - 0.5) * 0.03 * v;
  float foamZone = smoothstep(1.0 - uFoamH * 1.4, 1.0, v);
  float halfW = mix(0.27, 0.33, v) + foamZone * 0.06;   // stays inside the rect (max ~0.39)
  // noisy, streaky edge so the silhouette is never a clean line
  float edgeJitter = (vnoise(vec2(v * 9.0 - t * uFall * 2.0, x * 3.0)) - 0.5) * 0.14;
  float d = abs(x - 0.5 - sway) / halfW + edgeJitter;   // 0 centre … 1 edge

  float body = 1.0 - smoothstep(0.62, 1.0, d);
  float core = 1.0 - smoothstep(0.0, 0.85, d);          // bright core
  float halo = exp(-max(d - 0.8, 0.0) * 6.0) * (1.0 - body);

  // ---- streaks: two translucent sheets at different speeds and densities
  vec2 p = vec2(x, v * 2.4 / max(uAspect * 6.0, 0.5));
  float s1 = sheet(p, uFall * 0.55, 26.0, 0.0);
  float s2 = sheet(p + vec2(0.13, 0.0), uFall * 0.85, 14.0, 7.3);
  float streak = smoothstep(0.38, 0.82, s1 * 0.6 + s2 * 0.55);
  float gaps = smoothstep(0.22, 0.42, s2);               // occasional thin gaps in the sheet

  // ---- top lip: fade in over the first 6 % (the cliff art covers the source)
  float lip = smoothstep(0.0, 0.06, v);
  // ---- never touch the rect's side edges, so the canvas never reads as a box
  float edgeX = smoothstep(0.0, 0.1, x) * (1.0 - smoothstep(0.9, 1.0, x));

  // ---- foam / mist pool (bottom 12 %), billowing upward
  float fb = fbm(vec2(x * 7.0 + t * 0.15, v * 10.0 + t * 1.1));
  float fb2 = fbm(vec2(x * 15.0 - t * 0.25, v * 18.0 + t * 1.8));
  float foamMask = smoothstep(1.0 - uFoamH, 1.0 - uFoamH * 0.35, v + (fb - 0.5) * 0.08);
  float foamW = 1.0 - smoothstep(0.75, 1.15, abs(x - 0.5) / (halfW + 0.05) + (fb2 - 0.5) * 0.3);
  float foam = foamMask * foamW * (0.55 + 0.45 * smoothstep(0.35, 0.75, fb * 0.6 + fb2 * 0.5));
  // soft mist rising above the foam
  float mist = smoothstep(1.0 - uFoamH * 2.6, 1.0, v) * (1.0 - smoothstep(0.35, 0.95, abs(x - 0.5) / 0.5)) *
               (0.35 + 0.65 * fbm(vec2(x * 4.0 - t * 0.1, v * 5.0 + t * 0.6)));
  // fade the very bottom edge so the pool blends into the pond / river art
  float bottomFade = 1.0 - smoothstep(0.965, 1.0, v);

  // ---- spray: droplets rising (and some falling) near the base, done per grid cell
  float spray = 0.0;
  float sprayZone = smoothstep(0.70, 0.92, v) * (1.0 - smoothstep(0.98, 1.0, v));
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float dir = fk < 0.5 ? 1.0 : -0.6;                    // up / down
    vec2 g = vec2(x * (12.0 + fk * 6.0), v * (40.0 + fk * 18.0) + dir * t * (2.2 + fk));
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 j = hash22(id + fk * 31.0) - 0.5;
    float on = step(0.62, hash21(id * 1.7 + fk));
    float r = length((f - j * 0.6) * vec2(1.0, 1.6));
    spray += on * smoothstep(0.16, 0.02, r) * (0.6 + 0.4 * sin(t * 6.0 + id.x * 3.0));
  }
  spray *= sprayZone * (1.0 - smoothstep(0.8, 1.3, abs(x - 0.5) / (halfW + 0.08)));

  // ---- colour
  vec3 col = mix(uTint, uCore, clamp(core * 0.55 + streak * 0.6, 0.0, 1.0));
  col = mix(col, vec3(1.0), clamp(foam * 0.85 + spray, 0.0, 1.0));
  col += uCore * streak * core * 0.18;                   // subtle glow on the brightest streaks

  // ---- alpha: opaque-ish core so the static fallback below does not double up
  float a = body * (0.62 + 0.30 * core) * mix(1.0, 0.82, 1.0 - gaps) + body * streak * 0.12;
  a = clamp(a, 0.0, 0.96) * lip;
  a = max(a, foam * 0.95);
  a = a + mist * 0.38 * (1.0 - a);
  a = a + spray * 0.9 * (1.0 - a);
  a = a + halo * 0.10 * lip * (1.0 - a);
  a *= bottomFade * edgeX;

  gl_FragColor = vec4(col * a, a);  // premultiplied
}
`

interface Props {
  sceneId: SceneId
  rect: CanvasRect
}

export default function WaterfallGL({ sceneId, rect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { s } = useFrameMapping()
  const scaleRef = useRef(s)
  const resizeRef = useRef<(() => void) | null>(null)
  // 'low' tier: keep the static SVG fallback only.
  const [enabled, setEnabled] = useState(() => getPerfTier() !== 'low')

  // staged degradation: last step turns the shader off for good
  useEffect(() => {
    if (!enabled) return
    return onDegrade((level) => {
      if (level >= DEGRADE.levelWaterfallStatic) setEnabled(false)
    })
  }, [enabled])

  useEffect(() => {
    const host = hostRef.current
    if (!enabled || !host) return
    const { canvas, remove } = mountCanvas(host)
    const renderer: Renderer | null = createGL(canvas)
    if (!renderer) {
      remove()
      return
    }
    const gl = renderer.gl
    const tier = getPerfTier()
    let lost = false

    const palette = sceneId === 'biodiversity' ? WATERFALL.colors.biodiversity : WATERFALL.colors.tranquility
    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: rect.w / rect.h },
        uFall: { value: WATERFALL.fallSpeed },
        uFoamH: { value: WATERFALL.foamHeight },
        uCore: { value: hexToRgb(palette.core) },
        uTint: { value: hexToRgb(palette.tint) },
      },
    })
    // premultiplied output → ONE, ONE_MINUS_SRC_ALPHA (OGL's default for premultiplied renderers)
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
    if (!programOk(gl, program)) {
      // shader failed (lost context / unsupported): leave the fallback alone
      destroyGL(gl)
      remove()
      return
    }

    const resize = () => {
      sizeGL(renderer, rect.w, rect.h, scaleRef.current * effectDpr(tier))
    }
    resize()
    resizeRef.current = resize
    const offResize = on('resize', resize)

    const onLost = (e: Event) => {
      e.preventDefault()
      lost = true
    }
    canvas.addEventListener('webglcontextlost', onLost)

    const tick = (time: number) => {
      if (lost || !motionState.pageVisible) return
      const visible = motionState.visible[sceneId]
      if (!visible) {
        // keep the last frame; nothing to draw while the scene is hidden
        return
      }
      program.uniforms.uTime!.value = time
      renderer.render({ scene: mesh }) // autoClear wipes to transparent first
    }
    clearGL(renderer)
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      offResize()
      resizeRef.current = null
      canvas.removeEventListener('webglcontextlost', onLost)
      destroyGL(gl)
      remove()
    }
    // rect is static geometry from assets.ts; its fields are listed so a change rebuilds the effect.
  }, [enabled, sceneId, rect.w, rect.h])

  // FrameSpace scale changed (viewport resize) → resize the drawing buffer only.
  useEffect(() => {
    scaleRef.current = s
    resizeRef.current?.()
  }, [s])

  if (!enabled) return null
  return (
    <div
      ref={hostRef}
      className="gl-waterfall"
      data-scene={sceneId}
      aria-hidden="true"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    />
  )
}
