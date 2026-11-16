/**
 * Particles — full-stage GPU particle overlay (dust motes → fireflies).
 *
 * One instanced quad per particle; all motion happens in the vertex shader:
 *  - base position (0..1 viewport) + a global drift accumulated on the CPU (so changing the drift
 *    direction / speed between scenes never makes particles jump)
 *  - gentle per-particle wander (bounded sines)
 *  - a scroll offset accumulated from motionState.velocity × PARTICLES.velocityPush, scaled by
 *    each particle's depth (near particles are pushed harder), wrapping around the viewport
 *
 * Look is interpolated by motionState.progress (0 hero … 1 tranquility … 2 biodiversity):
 *  hero          warm peach / gold dust motes, small, slowly twinkling, drifting with the wind
 *  tranquility   cyan fireflies (sparser, larger glow, blinking)
 *  biodiversity  yellow-green fireflies
 *
 * Additive blending, low global opacity so it never fights the copy.
 * Count: PARTICLES.desktop ('high' tier, > 768 px) / PARTICLES.mobile ('mid' or ≤ 768 px) /
 * PARTICLES.low ('low' tier). Degrade level ≥ DEGRADE.levelParticlesHalf → count × DEGRADE.particleFactor
 * and DPR 1.
 *
 * The canvas fills the host overlay, which is `inset: 0` inside the sticky 100vh `.stage` — i.e. the
 * viewport, never the (much taller) layer box. Drawing buffer = viewport × effectDpr (≤ 1.25).
 */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Geometry, Mesh, Program, type Renderer } from 'ogl'
import { DEGRADE, PARTICLES, PARTICLE_LOOK, clamp, isMobileViewport } from '../lib/motion'
import { motionState, on } from '../lib/store'
import { getPerfTier, onDegrade } from '../lib/perf'
import { createGL, destroyGL, effectDpr, hexToRgb, mountCanvas, programOk, rng, sizeGL } from '../lib/gl'
import '../styles/webgl.css'

const VERT = /* glsl */ `
precision highp float;
attribute vec2 position;   // quad corner -1..1
attribute vec4 aSeed;      // x depth 0..1, y/z/w random
attribute vec2 aPos;       // base position 0..1
attribute float aSize;     // 0..1
attribute float aSpeed;    // 0.5..1.5

uniform float uTime;
uniform vec2 uDrift;       // accumulated drift (viewport fractions)
uniform float uScroll;     // accumulated scroll push (viewport fractions)
uniform vec3 uMix;         // weights: hero, tranquility, biodiversity
uniform vec2 uRes;         // drawing buffer px
uniform float uPx;         // css px → buffer px
uniform float uFireShare;
uniform vec3 uHeroA; uniform vec3 uHeroB;
uniform vec3 uTranqA; uniform vec3 uTranqB;
uniform vec3 uBioA; uniform vec3 uBioB;

varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vFly;

void main() {
  float depth = aSeed.x;
  float fly = uMix.y + uMix.z;               // 0 = dust motes, 1 = fireflies
  float aspect = uRes.x / max(uRes.y, 1.0);

  // ---- position: base + global drift (per-particle speed) + scroll push (per-particle depth)
  vec2 p = aPos + uDrift * aSpeed * (0.5 + depth);
  p.y -= uScroll * (0.25 + 0.75 * depth);

  // ---- wander: bounded sines; fireflies roam more than dust
  float ph = aSeed.y * 6.2831;
  float wAmp = mix(0.006, 0.028, fly);
  vec2 wander = vec2(
    sin(uTime * (0.21 + aSeed.z * 0.25) + ph) + 0.5 * sin(uTime * (0.53 + aSeed.w * 0.3) + ph * 1.7),
    cos(uTime * (0.17 + aSeed.w * 0.22) + ph * 1.3) + 0.5 * sin(uTime * (0.47 + aSeed.z * 0.4) + ph * 0.6)
  ) * wAmp;
  wander.x /= aspect;
  p += wander;

  // wrap into -0.05..1.05 so particles leave the screen before re-entering
  p = fract(p) * 1.1 - 0.05;

  // ---- size (css px radius of the glow quad)
  float rDust = mix(2.5, 7.0, aSize * aSize) * mix(0.7, 1.3, depth);
  float rFly = mix(9.0, 20.0, aSize) * mix(0.75, 1.25, depth);
  float r = mix(rDust, rFly, fly) * uPx;

  // ---- brightness: dust twinkles softly; fireflies blink (mostly dim, short bright pulses)
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.z * 1.6) + ph * 3.0);
  float blinkWave = sin(uTime * (0.55 + aSeed.w * 0.9) + aSeed.y * 40.0);
  float blink = 0.08 + 0.92 * smoothstep(0.45, 1.0, blinkWave);
  float isFly = step(1.0 - uFireShare, aSeed.z);   // only a share of particles become fireflies
  float aDust = twinkle * mix(0.35, 0.9, depth);
  float aFly = blink * isFly;
  vAlpha = mix(aDust, aFly, fly);

  // ---- colour: interpolated by scene weights
  vec3 cHero = mix(uHeroA, uHeroB, aSeed.w);
  vec3 cTranq = mix(uTranqA, uTranqB, aSeed.w);
  vec3 cBio = mix(uBioA, uBioB, aSeed.w);
  vColor = cHero * uMix.x + cTranq * uMix.y + cBio * uMix.z;
  vFly = fly;
  vCorner = position;

  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  clip += position * r * 2.0 / uRes;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity;
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vFly;

void main() {
  float d2 = dot(vCorner, vCorner);
  if (d2 > 1.0) discard;
  // dust: soft round mote; firefly: hot core + wide halo
  float dust = pow(1.0 - d2, 2.2);
  float fly = exp(-d2 * 28.0) + 0.38 * exp(-d2 * 4.5) * (1.0 - d2);
  float shape = mix(dust, fly, vFly);
  float a = clamp(shape * vAlpha * uOpacity, 0.0, 1.0);
  // white-hot centre for fireflies
  vec3 col = mix(vColor, vec3(1.0), exp(-d2 * 60.0) * vFly * 0.6);
  gl_FragColor = vec4(col * a, a);   // premultiplied; blended additively
}
`

function particleCount(): number {
  const tier = getPerfTier()
  if (tier === 'low') return PARTICLES.low
  if (tier === 'mid' || isMobileViewport()) return PARTICLES.mobile
  return PARTICLES.desktop
}

export default function Particles() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [count] = useState(particleCount)

  useEffect(() => {
    const host = hostRef.current
    if (!host || count <= 0) return
    const { canvas, remove } = mountCanvas(host)
    const renderer: Renderer | null = createGL(canvas)
    if (!renderer) {
      remove()
      return
    }
    const gl = renderer.gl
    const tier = getPerfTier()
    let degraded = false
    let lost = false
    let inView = true
    let px = 1

    // ---- instanced geometry (deterministic layout)
    const rand = rng(0x6a3fa0)
    const seed = new Float32Array(count * 4)
    const pos = new Float32Array(count * 2)
    const size = new Float32Array(count)
    const speed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      seed[i * 4] = rand()
      seed[i * 4 + 1] = rand()
      seed[i * 4 + 2] = rand()
      seed[i * 4 + 3] = rand()
      pos[i * 2] = rand()
      pos[i * 2 + 1] = rand()
      size[i] = rand()
      speed[i] = 0.5 + rand()
    }
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]) },
      index: { data: new Uint16Array([0, 1, 2, 0, 2, 3]) },
      aSeed: { instanced: 1, size: 4, data: seed },
      aPos: { instanced: 1, size: 2, data: pos },
      aSize: { instanced: 1, size: 1, data: size },
      aSpeed: { instanced: 1, size: 1, data: speed },
    })

    const c = PARTICLE_LOOK.colors
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDrift: { value: [0, 0] },
        uScroll: { value: 0 },
        uMix: { value: [1, 0, 0] },
        uRes: { value: [1, 1] },
        uPx: { value: 1 },
        uOpacity: { value: PARTICLE_LOOK.opacity },
        uFireShare: { value: PARTICLE_LOOK.fireflyShare },
        uHeroA: { value: hexToRgb(c.heroA) },
        uHeroB: { value: hexToRgb(c.heroB) },
        uTranqA: { value: hexToRgb(c.tranqA) },
        uTranqB: { value: hexToRgb(c.tranqB) },
        uBioA: { value: hexToRgb(c.bioA) },
        uBioB: { value: hexToRgb(c.bioB) },
      },
    })
    program.setBlendFunc(gl.ONE, gl.ONE) // additive
    const mesh = new Mesh(gl, { geometry, program })
    if (!programOk(gl, program)) {
      // shader failed (lost context / unsupported): leave the fallback alone
      destroyGL(gl)
      remove()
      return
    }
    const u = program.uniforms

    // viewport-sized: the host overlay is inset: 0 in the 100vh stage
    const resize = () => {
      const w = host.clientWidth || motionState.vw
      const h = host.clientHeight || motionState.vh
      px = effectDpr(tier, degraded)
      sizeGL(renderer, w, h, px)
      u.uRes!.value = [gl.canvas.width, gl.canvas.height]
      u.uPx!.value = px
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const offDegrade = onDegrade((level) => {
      if (degraded || level < DEGRADE.levelParticlesHalf) return
      degraded = true
      geometry.setInstancedCount(Math.max(1, Math.floor(count * DEGRADE.particleFactor)))
      resize()
    })

    // pause when the stage has scrolled away (footer)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView = e.isIntersecting
    })
    io.observe(host)

    const onLost = (e: Event) => {
      e.preventDefault()
      lost = true
    }
    canvas.addEventListener('webglcontextlost', onLost)

    // CPU-side accumulators (kept continuous across scene changes)
    const drift: [number, number] = [0, 0]
    let scroll = 0

    const tick = (time: number, deltaMs: number) => {
      if (lost || !inView || !motionState.pageVisible) return
      const dt = Math.min(deltaMs, 100) / 1000
      const frames = dt * 60

      // scene weights from continuous progress
      const pr = motionState.progress
      const wHero = clamp(1 - pr)
      const wBio = clamp(pr - 1)
      const wTranq = clamp(1 - Math.abs(pr - 1))
      const fly = wTranq + wBio

      const dx = PARTICLE_LOOK.driftHero[0] * (1 - fly) + PARTICLE_LOOK.driftFirefly[0] * fly
      const dy = PARTICLE_LOOK.driftHero[1] * (1 - fly) + PARTICLE_LOOK.driftFirefly[1] * fly
      // keep accumulators small (fract() in the shader makes the wrap seamless at integers)
      drift[0] = (drift[0] + dx * dt) % 1000
      drift[1] = (drift[1] + dy * dt) % 1000
      const push = motionState.velocity * PARTICLES.velocityPush * frames
      scroll = (scroll + clamp(push, -PARTICLE_LOOK.maxPushPerFrame, PARTICLE_LOOK.maxPushPerFrame)) % 1000

      u.uTime!.value = time
      u.uDrift!.value = drift
      u.uScroll!.value = scroll
      u.uMix!.value = [wHero, wTranq, wBio]
      renderer.render({ scene: mesh })
    }
    gsap.ticker.add(tick)
    const offResize = on('resize', resize)

    return () => {
      gsap.ticker.remove(tick)
      ro.disconnect()
      io.disconnect()
      offResize()
      offDegrade()
      canvas.removeEventListener('webglcontextlost', onLost)
      destroyGL(gl)
      remove()
    }
  }, [count])

  if (count <= 0) return null
  return <div ref={hostRef} className="gl-overlay gl-particles" aria-hidden="true" />
}
