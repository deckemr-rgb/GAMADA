/**
 * CurtainGL — a translucent WATER CURTAIN drawn over the scene seam while transitioning.
 *
 * WebGL cannot sample the DOM underneath, so instead of displacing the page we paint a convincing
 * sheet of falling water on top of the seam (the bridge art + seam mist already hide the cut):
 *  - a horizontal band centred on motionState.seamY (viewport fraction, 0 = top), ~38 % tall,
 *    with wavy, noisy top/bottom edges
 *  - falling-water streaks (vertically stretched noise, flowing faster when scrolling fast)
 *  - refraction-like ripples: ridged, domain-warped noise → bright caustic lines + darker troughs
 *  - droplets sliding down the sheet
 *  - a soft white mist along both edges
 * intensity = transition × (0.35 + speed × 1.4), clamped → fast scrolling ripples harder.
 *
 * Nothing to draw (transition == 0, seam off screen, intensity ~0) → the canvas is cleared once,
 * its host is set to visibility: hidden (no compositing of an empty full-viewport layer) and the
 * ticker callback returns before touching WebGL — zero GPU work per idle frame.
 * The canvas fills the viewport-sized overlay (inset: 0 in the 100vh stage), at CURTAIN.resolution.
 * Only on the 'high' tier; unmounted from degrade level ≥ DEGRADE.levelParticlesHalf.
 */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Mesh, Program, Triangle, type Renderer } from 'ogl'
import { CURTAIN, DEGRADE, clamp } from '../lib/motion'
import { motionState, on } from '../lib/store'
import { getPerfTier, onDegrade } from '../lib/perf'
import { FULLSCREEN_VERT, GLSL_NOISE, clearGL, createGL, destroyGL, effectDpr, hexToRgb, mountCanvas, programOk, sizeGL } from '../lib/gl'
import '../styles/webgl.css'

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uFlow;       // accumulated fall offset
uniform float uSeam;       // seam centre, viewport fraction from the top
uniform float uHalf;       // half band height (viewport fraction)
uniform float uIntensity;  // 0..1
uniform float uSpeed;      // 0..1 normalised scroll speed
uniform float uAspect;     // width / height
uniform vec3 uTint;
uniform vec3 uTrough;
${GLSL_NOISE}

void main() {
  float x = vUv.x;
  float y = 1.0 - vUv.y;                 // 0 = top of the viewport
  float dy = (y - uSeam) / uHalf;        // -1..1 inside the band
  if (abs(dy) > 1.5) { gl_FragColor = vec4(0.0); return; }

  float ax = x * uAspect;                // isotropic x
  float t = uTime;

  // ---- band envelope with wavy, noisy edges (each edge wobbles independently)
  float eTop = (fbm(vec2(ax * 2.2, t * 0.25)) - 0.5) * 0.55 + sin(ax * 5.0 + t * 1.3) * 0.05;
  float eBot = (fbm(vec2(ax * 2.0 + 13.0, t * 0.22)) - 0.5) * 0.55 + sin(ax * 4.3 - t * 1.1) * 0.05;
  float dyw = dy < 0.0 ? dy + eTop : dy + eBot;
  float body = 1.0 - smoothstep(0.55, 0.95, abs(dyw));

  // ---- falling streaks (stretched vertically, flowing down)
  float s1 = fbm(vec2(ax * 18.0, y * 1.1 - uFlow));
  float s2 = vnoise(vec2(ax * 55.0 + 3.0, y * 2.4 - uFlow * 1.4));
  float streak = smoothstep(0.42, 0.8, s1 * 0.75 + s2 * 0.35);
  // slow thickness variation of the sheet (wide bands that slide down)
  float thick = fbm(vec2(ax * 1.4, y * 1.3 - uFlow * 0.6));

  // ---- refraction ripples: domain-warped ridged noise; ripples tighten with speed
  vec2 rp = vec2(ax * 3.2, y * 6.5 - uFlow * 0.35);
  vec2 warp = vec2(fbm(rp * 0.8 + vec2(t * 0.15, 0.0)), fbm(rp * 0.8 + vec2(5.2, t * 0.18)));
  float n = fbm(rp + warp * (1.4 + uSpeed * 1.6));
  float ridge = 1.0 - abs(n * 2.0 - 1.0);                      // 1 on the ridge lines
  float hRipple = sin(y * (70.0 + uSpeed * 60.0) - t * 7.0 + n * 9.0) * 0.5 + 0.5;
  float caustic = pow(ridge, 7.0) * (0.75 + 0.5 * uSpeed) + pow(hRipple, 10.0) * (0.15 + 0.5 * uSpeed) * ridge;
  float trough = smoothstep(0.55, 0.15, ridge);

  // ---- droplets sliding down
  float drops = 0.0;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 g = vec2(ax * (16.0 + fk * 10.0), y * (9.0 + fk * 5.0) - uFlow * (1.6 + fk * 0.8));
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 j = (hash22(id + fk * 17.0) - 0.5) * 0.6;
    float on = step(0.86, hash21(id * 1.31 + fk * 7.0));
    vec2 q = (f - j) * vec2(1.0, 0.8);                          // slightly elongated along the fall
    float r = length(q);
    drops += on * (smoothstep(0.08, 0.02, r) + 0.25 * smoothstep(0.16, 0.06, r));
  }

  // ---- mist along both edges (soft, billowing white)
  float edgeDist = abs(abs(dyw) - 0.8);
  float mistN = fbm(vec2(ax * 3.0 - t * 0.2, y * 5.0 + t * 0.35));
  float mist = exp(-edgeDist * edgeDist * 14.0) * (0.45 + 0.55 * mistN);
  mist += (1.0 - smoothstep(0.0, 1.3, abs(dyw))) * 0.18 * mistN; // light haze inside

  // ---- composite (premultiplied, back to front)
  vec4 c = vec4(0.0);
  // translucent water body
  float aBody = body * (0.12 + thick * 0.14 + streak * 0.3);
  c = vec4(uTint * aBody, aBody);
  // darker troughs (refraction shadows)
  float aT = body * trough * 0.22;
  c = vec4(uTrough * aT, aT) + c * (1.0 - aT);
  // bright caustic lines + streak highlights
  float aC = clamp(body * (caustic * 0.6 + streak * streak * 0.32), 0.0, 1.0);
  c = vec4(mix(uTint, vec3(1.0), 0.6) * aC, aC) + c * (1.0 - aC);
  // droplets
  float aD = clamp(drops * body * 0.75, 0.0, 1.0);
  c = vec4(vec3(1.0) * aD, aD) + c * (1.0 - aD);
  // mist
  float aM = clamp(mist * 0.55, 0.0, 1.0);
  c = vec4(mix(uTint, vec3(1.0), 0.75) * aM, aM) + c * (1.0 - aM);

  gl_FragColor = c * uIntensity;
}
`

export default function CurtainGL() {
  const hostRef = useRef<HTMLDivElement>(null)
  // 'high' tier only, and permanently off once the fps degrade reaches the heavy-effects step.
  const [enabled, setEnabled] = useState(() => getPerfTier() === 'high')

  useEffect(() => {
    if (!enabled) return
    return onDegrade((level) => {
      if (level >= DEGRADE.levelParticlesHalf) setEnabled(false)
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
    let cleared = true
    let inView = true
    let flow = 0
    const tintA = hexToRgb(CURTAIN.tintA)
    const tintB = hexToRgb(CURTAIN.tintB)

    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: 0 },
        uSeam: { value: 2 },
        uHalf: { value: CURTAIN.height / 2 },
        uIntensity: { value: 0 },
        uSpeed: { value: 0 },
        uAspect: { value: 1 },
        uTint: { value: [...tintA] },
        uTrough: { value: hexToRgb(CURTAIN.trough) },
      },
    })
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
    if (!programOk(gl, program)) {
      // shader failed (lost context / unsupported): leave the fallback alone
      destroyGL(gl)
      remove()
      return
    }
    const u = program.uniforms

    // the host is hidden while idle; hide/show only on state changes (no per-frame style writes)
    let shown = true
    const show = (v: boolean) => {
      if (v === shown) return
      shown = v
      host.style.visibility = v ? '' : 'hidden'
    }
    show(false)

    const resize = () => {
      const w = host.clientWidth || motionState.vw
      const h = host.clientHeight || motionState.vh
      sizeGL(renderer, w, h, effectDpr(tier) * CURTAIN.resolution)
      u.uAspect!.value = w / Math.max(1, h)
      clearGL(renderer)
      cleared = true
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    const offResize = on('resize', resize)

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView = e.isIntersecting
    })
    io.observe(host)

    const onLost = (e: Event) => {
      e.preventDefault()
      lost = true
    }
    canvas.addEventListener('webglcontextlost', onLost)

    const tick = (time: number, deltaMs: number) => {
      if (lost || !inView || !motionState.pageVisible) return
      const seam = motionState.seamY
      const half = CURTAIN.height / 2
      const intensity = clamp(motionState.transition * (CURTAIN.base + motionState.speed * CURTAIN.speedGain))
      const onScreen = seam > -half * 1.5 && seam < 1 + half * 1.5
      if (motionState.transition <= 0 || intensity <= 0.002 || !onScreen) {
        // nothing to draw: clear once, then skip
        if (!cleared) {
          clearGL(renderer)
          cleared = true
        }
        show(false)
        return
      }
      show(true)
      const dt = Math.min(deltaMs, 100) / 1000
      flow = (flow + dt * (CURTAIN.flow + motionState.speed * CURTAIN.flowSpeedGain)) % 1000

      // tint: hero→tranquility uses A, tranquility→biodiversity uses B
      const k = clamp(motionState.progress - 0.5) // 0 up to 0.5, 1 from 1.5, blends while resting on scene 1
      const tint = u.uTint!.value as number[]
      tint[0] = tintA[0] + (tintB[0] - tintA[0]) * k
      tint[1] = tintA[1] + (tintB[1] - tintA[1]) * k
      tint[2] = tintA[2] + (tintB[2] - tintA[2]) * k

      u.uTime!.value = time
      u.uFlow!.value = flow
      u.uSeam!.value = seam
      u.uHalf!.value = half
      u.uIntensity!.value = intensity
      u.uSpeed!.value = clamp(motionState.speed)
      renderer.render({ scene: mesh })
      cleared = false
    }
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      ro.disconnect()
      io.disconnect()
      offResize()
      canvas.removeEventListener('webglcontextlost', onLost)
      destroyGL(gl)
      remove()
      host.style.visibility = ''
    }
  }, [enabled])

  if (!enabled) return null
  return <div ref={hostRef} className="gl-overlay gl-curtain" aria-hidden="true" />
}
