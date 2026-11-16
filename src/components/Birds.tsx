/**
 * Birds — boids flock on a 2D canvas inside its layer box (`.slot-box`: 106 % × 160 % of the
 * viewport, starting 30 % above it and 3 % left of it).
 *
 * The simulation runs in BOX px, but the canvas only covers the mode's flight band
 * (BIRD_FLIGHT.canvas, viewport fractions + padding), so the drawing buffer is ~3× smaller than
 * the box; birds fade out before reaching an inner band edge instead of being cut off.
 * DPR ≤ 1.25 on 'high', 1 on 'mid' / 'low'. Counts × BIRD_FLIGHT.tierFactor on 'mid' / 'low'.
 * The box rect for cursor avoidance is read once per frame in a prioritized ticker callback
 * (before anything writes styles), never inside simulate(). Degrade level ≥ DEGRADE.levelBirdsOff
 * unmounts the flock.
 *
 * Every wing-flap frame is drawn procedurally once at startup onto an offscreen
 * sprite sheet; each bird then blits one frame per tick (own phase / flap speed /
 * size / depth). Three behaviours share the same sprite + boids core:
 *   cranes    – hero: red-crowned cranes in a loose V gliding right → left across
 *               the upper-middle sky; they fly in from the right on the first 'intro'.
 *   bats      – tranquility: pale bats crossing the cave in small erratic groups.
 *   songbirds – biodiversity: small quick birds hopping between perches (right half).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import type { SceneId } from '../lib/assets'
import { BIRDS, BIRD_FLIGHT, CRANE_COLORS, DEGRADE, clamp, isEnabled, isMobileViewport } from '../lib/motion'
import { motionState, on } from '../lib/store'
import { getDegradeLevel, getPerfTier, onDegrade } from '../lib/perf'
import { effectDpr } from '../lib/gl'
import '../styles/ambient.css'

type Mode = 'cranes' | 'bats' | 'songbirds'

/* ------------------------------------------------------------------ helpers */

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const randIn = (r: readonly [number, number]) => rand(r[0], r[1])
const TAU = Math.PI * 2

interface Pt {
  x: number
  y: number
}
const P = (x: number, y: number): Pt => ({ x, y })
const mix = (a: Pt, b: Pt, t: number): Pt => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

/* ------------------------------------------------------------------ sprite sheets */

interface Sheet {
  canvas: HTMLCanvasElement
  /** Cell size in sprite units (before sheetScale). */
  cw: number
  ch: number
  /** Number of flap frames (an extra "folded" frame sits at index `frames`). */
  frames: number
  /** Frame index used while gliding. */
  glide: number
  /** Nominal body length in sprite units (used to convert desired px size → draw scale). */
  length: number
  /** Side view (mirror + rotate along velocity) or front view (tilt only). */
  view: 'side' | 'front'
}

type FrameDrawer = (ctx: CanvasRenderingContext2D, phase: number, folded: boolean) => void

function buildSheet(cw: number, ch: number, frames: number, length: number, view: Sheet['view'], draw: FrameDrawer, glide: number): Sheet {
  const S = BIRD_FLIGHT.sheetScale
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(cw * S) * (frames + 1)
  canvas.height = Math.ceil(ch * S)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 0; i <= frames; i++) {
      ctx.setTransform(S, 0, 0, S, Math.ceil(cw * S) * i + (cw * S) / 2, (ch * S) / 2)
      draw(ctx, (i / frames) * TAU, i === frames)
    }
  }
  return { canvas, cw: Math.ceil(cw * S) / S, ch: Math.ceil(ch * S) / S, frames, glide, length, view }
}

/** Generic side-view wing: leading edge S → W (wrist) → T (tip), trailing edge back to the root R. */
function wingShape(S: Pt, W: Pt, T: Pt, Wt: Pt, R: Pt): Path2D {
  const p = new Path2D()
  p.moveTo(S.x, S.y)
  p.quadraticCurveTo(S.x + 2, (S.y + W.y) / 2 - 2, W.x, W.y)
  p.quadraticCurveTo((W.x + T.x) / 2 + 1, (W.y + T.y) / 2 - 3, T.x, T.y)
  p.quadraticCurveTo((T.x + Wt.x) / 2 + 2, (T.y + Wt.y) / 2 + 2, Wt.x, Wt.y)
  p.quadraticCurveTo((Wt.x + R.x) / 2, (Wt.y + R.y) / 2 + 3, R.x, R.y)
  p.closePath()
  return p
}

const CRANE = CRANE_COLORS

/** Red-crowned crane in flight, side view facing +x. Body length ≈ 150 units (beak → toes). */
const drawCrane: FrameDrawer = (ctx, phi, glidePose) => {
  // wing elevation (rad) at the wrist and at the tip (the tip lags the stroke)
  const e = glidePose ? 0.3 : 0.24 + 0.72 * Math.sin(phi)
  const e2 = glidePose ? 0.22 : 0.24 + 0.86 * Math.sin(phi - 0.6)

  const wing = (far: boolean) => {
    // Camera slightly below: the near wing reads a bit lower, the far wing a bit higher.
    const k = far ? 0.34 : -0.3
    const h1 = Math.sin(e) + k * Math.cos(e)
    const h2 = Math.sin(e2) + k * Math.cos(e2)
    const len = far ? 0.84 : 1
    const ox = far ? 5 : 0
    const oy = far ? -3 : 0
    // leading edge: shoulder S → wrist W → tip T; trailing edge: Tt → Wt → root R (broad chord along the body)
    const S = P(11 + ox, -5 + oy)
    const R = P(-19 + ox, -2 + oy)
    const W = P(S.x - 5, S.y - 38 * len * h1)
    const T = P(W.x - 14 * len, W.y - 50 * len * h2)
    const Tt = P(T.x - 15 * len, T.y + 8 * Math.sign(h2 || 1))
    const Wt = P(W.x - 30, W.y + 4 * Math.sign(h1 || 1))
    const p = new Path2D()
    p.moveTo(S.x, S.y)
    p.quadraticCurveTo(S.x + 3, (S.y + W.y) / 2, W.x, W.y)
    p.quadraticCurveTo(W.x + 2, (W.y + T.y) / 2, T.x, T.y)
    p.lineTo(Tt.x, Tt.y)
    p.quadraticCurveTo((Tt.x + Wt.x) / 2 - 3, (Tt.y + Wt.y) / 2, Wt.x, Wt.y)
    p.quadraticCurveTo((Wt.x + R.x) / 2 - 2, (Wt.y + R.y) / 2, R.x, R.y)
    p.closePath()
    ctx.fillStyle = far ? CRANE.farWhite : CRANE.white
    ctx.fill(p)
    ctx.save()
    ctx.clip(p)
    // cel shade on the inner wing (underside in shadow)
    if (!far) {
      ctx.fillStyle = CRANE.shade
      ctx.globalAlpha = 0.5
      const a = mix(S, W, 0.5)
      const b = mix(R, Wt, 0.5)
      ctx.beginPath()
      ctx.moveTo(S.x, S.y)
      ctx.lineTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(R.x, R.y)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = far ? CRANE.farBlack : CRANE.black
    // black secondaries: trailing band of the inner wing
    {
      const a = mix(Wt, W, 0.38)
      const b = mix(R, S, 0.36)
      ctx.beginPath()
      ctx.moveTo(Wt.x - 3, Wt.y)
      ctx.lineTo(a.x, a.y)
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2, b.x, b.y)
      ctx.lineTo(R.x - 3, R.y)
      ctx.closePath()
      ctx.fill()
    }
    // black primary tips
    {
      const a = mix(T, W, 0.3)
      const b = mix(Tt, Wt, 0.3)
      ctx.beginPath()
      ctx.moveTo(T.x + 2, T.y)
      ctx.lineTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(Tt.x - 2, Tt.y)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
    // primary "fingers" fanning out of the hand
    const dx = T.x - W.x
    const dy = T.y - W.y
    const dl = Math.hypot(dx, dy) || 1
    ctx.strokeStyle = far ? CRANE.farBlack : CRANE.black
    ctx.lineWidth = 1.2
    for (let f = 0; f < 4; f++) {
      const spread = 0.12 + f * 0.2
      const c = Math.cos(spread)
      const sn = Math.sin(spread) * -Math.sign(h2 || 1)
      const ux = (dx * c - dy * sn) / dl
      const uy = (dx * sn + dy * c) / dl
      const o = mix(T, Tt, f / 3.5)
      ctx.beginPath()
      ctx.moveTo(o.x, o.y)
      ctx.lineTo(o.x + ux * (8 - f), o.y + uy * (8 - f))
      ctx.stroke()
    }
  }

  wing(true)

  // legs trailing behind
  ctx.strokeStyle = CRANE.leg
  ctx.lineWidth = 1.7
  ctx.beginPath()
  ctx.moveTo(-14, 5)
  ctx.quadraticCurveTo(-42, 8, -70, 8)
  ctx.moveTo(-14, 6)
  ctx.quadraticCurveTo(-42, 10, -68, 11)
  ctx.stroke()
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(-70, 8)
  ctx.lineTo(-76, 6.5)
  ctx.moveTo(-68, 11)
  ctx.lineTo(-74, 11.5)
  ctx.stroke()

  // tail + black tertial plumes
  ctx.fillStyle = CRANE.white
  ctx.beginPath()
  ctx.moveTo(-20, -4)
  ctx.quadraticCurveTo(-34, -3, -38, 1)
  ctx.quadraticCurveTo(-30, 5, -18, 5)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = CRANE.black
  ctx.beginPath()
  ctx.moveTo(-12, -3)
  ctx.quadraticCurveTo(-26, -2, -34, 4)
  ctx.quadraticCurveTo(-27, 9, -16, 6)
  ctx.closePath()
  ctx.fill()

  // body
  ctx.fillStyle = CRANE.white
  ctx.beginPath()
  ctx.ellipse(0, 0, 25, 8.5, -0.04, 0, TAU)
  ctx.fill()
  ctx.fillStyle = CRANE.shade
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.ellipse(1, 3.5, 22, 4.5, -0.04, 0, Math.PI)
  ctx.fill()
  ctx.globalAlpha = 1

  // long black neck (white nape patch near the head)
  ctx.fillStyle = CRANE.black
  ctx.beginPath()
  ctx.moveTo(18, -6)
  ctx.quadraticCurveTo(40, -9, 60, -8.5)
  ctx.lineTo(60, -4.5)
  ctx.quadraticCurveTo(40, -4, 20, 3)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = CRANE.white
  ctx.beginPath()
  ctx.ellipse(55, -7.6, 4.2, 1.3, -0.05, 0, TAU)
  ctx.fill()

  // head + red crown + beak
  ctx.fillStyle = CRANE.black
  ctx.beginPath()
  ctx.ellipse(62, -6.8, 5.2, 3.3, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = CRANE.red
  ctx.beginPath()
  ctx.ellipse(62, -9.2, 2.6, 1.4, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = CRANE.beak
  ctx.beginPath()
  ctx.moveTo(66, -8)
  ctx.lineTo(80, -6)
  ctx.lineTo(66, -5)
  ctx.closePath()
  ctx.fill()

  wing(false)
}

/** Pale bat seen from below (front view): wings spread left/right, scalloped trailing edge. */
const drawBat: FrameDrawer = (ctx, phi) => {
  const f = Math.sin(phi)
  const span = 0.72 + 0.28 * Math.cos(phi * 1 - 0.3) ** 2
  const fill = '#f1edff'
  const shade = '#bfb5ea'
  for (const side of [-1, 1]) {
    const sx = side
    const tipY = -16 * f + 2
    const wristY = -9 * f - 4
    const p = new Path2D()
    p.moveTo(3 * sx, -4)
    p.quadraticCurveTo(12 * sx * span, wristY - 4, 22 * sx * span, wristY)
    p.quadraticCurveTo(34 * sx * span, tipY - 3, 44 * sx * span, tipY)
    // scalloped trailing edge (three fingers)
    p.quadraticCurveTo(38 * sx * span, tipY + 6, 36 * sx * span, tipY + 12)
    p.quadraticCurveTo(30 * sx * span, (tipY + 12 + 5) / 2 + 2, 26 * sx * span, wristY + 13)
    p.quadraticCurveTo(20 * sx * span, wristY + 11, 16 * sx * span, wristY + 15)
    p.quadraticCurveTo(10 * sx * span, 6, 3 * sx, 7)
    p.closePath()
    ctx.fillStyle = fill
    ctx.fill(p)
    ctx.save()
    ctx.clip(p)
    ctx.fillStyle = shade
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.moveTo(3 * sx, 7)
    ctx.lineTo(22 * sx * span, wristY + 2)
    ctx.lineTo(44 * sx * span, tipY + 14)
    ctx.lineTo(3 * sx, 20)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // finger bones
    ctx.strokeStyle = shade
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(22 * sx * span, wristY)
    ctx.lineTo(36 * sx * span, tipY + 12)
    ctx.moveTo(22 * sx * span, wristY)
    ctx.lineTo(26 * sx * span, wristY + 13)
    ctx.stroke()
  }
  // body + ears
  ctx.fillStyle = '#e4defb'
  ctx.beginPath()
  ctx.ellipse(0, 1, 4.6, 8.5, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -7, 4, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-3.5, -9)
  ctx.lineTo(-3, -14)
  ctx.lineTo(-0.8, -10)
  ctx.moveTo(3.5, -9)
  ctx.lineTo(3, -14)
  ctx.lineTo(0.8, -10)
  ctx.fill()
}

/** Small songbird, side view facing +x: peach body, cream belly, red cap. Folded frame = wings closed. */
const drawSongbird: FrameDrawer = (ctx, phi, folded) => {
  const back = '#f2a36b'
  const belly = '#ffe6c7'
  const wingC = '#7d4f86'
  const wingShade = '#5a3a6e'
  const cap = '#d23a30'
  const wingDraw = (far: boolean) => {
    const e = 0.2 + 1.05 * Math.sin(phi + (far ? 0.15 : 0))
    const k = far ? 0.35 : -0.3
    const h = Math.sin(e) + k * Math.cos(e)
    const h2 = Math.sin(e - 0.35) + k * Math.cos(e - 0.35)
    const S = P(far ? 5 : 3, far ? -6 : -4)
    const W = P(S.x - 4, S.y - 13 * h)
    const T = P(W.x - 12, W.y - 14 * h2)
    const Wt = P(W.x - 9, W.y + 3)
    const R = P(S.x - 12, S.y + 1)
    ctx.fillStyle = far ? wingShade : wingC
    ctx.fill(wingShape(S, W, T, Wt, R))
  }
  if (!folded) wingDraw(true)
  // tail
  ctx.fillStyle = wingShade
  ctx.beginPath()
  ctx.moveTo(-8, -2)
  ctx.lineTo(-23, -3)
  ctx.lineTo(-22, 3)
  ctx.lineTo(-8, 3)
  ctx.closePath()
  ctx.fill()
  // body
  ctx.fillStyle = back
  ctx.beginPath()
  ctx.ellipse(0, 0, 11, 6.5, -0.1, 0, TAU)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(2, 2.6, 8.5, 3.6, -0.05, 0, TAU)
  ctx.fill()
  // head
  ctx.fillStyle = back
  ctx.beginPath()
  ctx.arc(10, -4, 5.4, 0, TAU)
  ctx.fill()
  ctx.fillStyle = cap
  ctx.beginPath()
  ctx.arc(10.5, -6.4, 3.6, Math.PI * 1.05, Math.PI * 1.95)
  ctx.fill()
  ctx.fillStyle = '#1b1828'
  ctx.beginPath()
  ctx.arc(12.6, -4.4, 1.05, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#3a2d3f'
  ctx.beginPath()
  ctx.moveTo(15, -5.2)
  ctx.lineTo(20, -3.8)
  ctx.lineTo(15, -2.6)
  ctx.closePath()
  ctx.fill()
  if (folded) {
    ctx.fillStyle = wingC
    ctx.beginPath()
    ctx.ellipse(-3, -1, 9, 4, 0.12, 0, TAU)
    ctx.fill()
    ctx.fillStyle = wingShade
    ctx.beginPath()
    ctx.ellipse(-6, 0.5, 6, 2.2, 0.15, 0, TAU)
    ctx.fill()
  } else {
    wingDraw(false)
  }
}

const sheetCache = new Map<Mode, Sheet>()
function getSheet(mode: Mode): Sheet {
  const cached = sheetCache.get(mode)
  if (cached) return cached
  const n = clamp(Math.round(BIRDS.frames), 8, 12)
  let sheet: Sheet
  if (mode === 'cranes') {
    // the extra cell (index n) is the glide pose: wings spread, held a little above the body
    sheet = buildSheet(176, 196, n, 156, 'side', drawCrane, n)
  } else if (mode === 'bats') {
    sheet = buildSheet(100, 64, n, 88, 'front', drawBat, Math.round(n * 0.5))
  } else {
    sheet = buildSheet(52, 44, n, 43, 'side', drawSongbird, n)
  }
  sheetCache.set(mode, sheet)
  return sheet
}

/* ------------------------------------------------------------------ simulation */

interface Bird {
  x: number
  y: number
  vx: number
  vy: number
  /** 0 = far … 1 = near. Smaller = slower + fainter. */
  depth: number
  /** Drawn body length in px at the reference width. */
  size: number
  alpha: number
  frame: number
  flapHz: number
  /** Gliding (cranes) / folded (songbirds) state + timers. */
  glide: number
  timer: number
  /** Facing (±1) with hysteresis so side sprites don't flicker around vx ≈ 0. */
  face: number
  /** Bats: active in the current crossing; songbirds: perched. */
  active: boolean
  perched: boolean
  tx: number
  ty: number
  seed: number
}

interface World {
  W: number
  H: number
  /** viewport-fraction → box px */
  vx: (f: number) => number
  vy: (f: number) => number
  /** Size / speed unit relative to the reference width. */
  u: number
}

function makeWorld(W: number, H: number): World {
  const vw = W / 1.06
  return {
    W,
    H,
    vx: (f) => (W * (0.03 + f)) / 1.06,
    vy: (f) => (H * (0.3 + f)) / 1.6,
    u: clamp(vw / BIRD_FLIGHT.refWidth, 0.42, 1.3),
  }
}

function newBird(depth: number, size: number, flapHz: number): Bird {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    depth,
    size,
    alpha: 0.55 + 0.45 * depth,
    frame: Math.random() * 100,
    flapHz,
    glide: 0,
    timer: rand(1, 6),
    face: -1,
    active: false,
    perched: false,
    tx: 0,
    ty: 0,
    seed: Math.random() * 1000,
  }
}

function spawnCranes(n: number, w: World): Bird[] {
  const birds: Bird[] = []
  const lead = P(w.vx(1) + 30 * w.u, w.vy(0.3))
  for (let i = 0; i < n; i++) {
    const depth = rand(0.15, 1)
    const b = newBird(depth, randIn(BIRD_FLIGHT.craneLength) * (0.62 + 0.38 * depth), randIn(BIRD_FLIGHT.craneFlapHz))
    // loose V: leader in front (left), wings of the V trailing to the right, up and down
    const row = Math.ceil(i / 2)
    const side = i % 2 === 0 ? 1 : -1
    b.x = lead.x + row * 62 * w.u + rand(-14, 14) * w.u
    b.y = lead.y + side * row * 24 * w.u + rand(-8, 8) * w.u
    b.vx = -BIRD_FLIGHT.craneSpeed * w.u
    b.vy = 0
    b.face = -1
    birds.push(b)
  }
  return birds.sort((a, b2) => a.depth - b2.depth)
}

function spawnBats(n: number, w: World): Bird[] {
  const birds: Bird[] = []
  for (let i = 0; i < n; i++) {
    const depth = rand(0.1, 1)
    const b = newBird(depth, randIn(BIRD_FLIGHT.batSize) * (0.6 + 0.4 * depth), randIn(BIRD_FLIGHT.batFlapHz))
    b.x = -9999
    b.y = w.vy(0.2)
    birds.push(b)
  }
  return birds.sort((a, b2) => a.depth - b2.depth)
}

function songTarget(b: Bird, w: World, near: boolean): void {
  const r = BIRD_FLIGHT.songRegion
  if (near && b.tx) {
    const ang = rand(0, TAU)
    const d = rand(60, 220) * w.u
    b.tx = clamp(b.x + Math.cos(ang) * d, w.vx(r.x0), w.vx(r.x1))
    b.ty = clamp(b.y + Math.sin(ang) * d * 0.6, w.vy(r.y0), w.vy(r.y1))
  } else {
    b.tx = w.vx(rand(r.x0, r.x1))
    b.ty = w.vy(rand(r.y0, r.y1))
  }
}

function spawnSongbirds(n: number, w: World): Bird[] {
  const birds: Bird[] = []
  for (let i = 0; i < n; i++) {
    const depth = rand(0.2, 1)
    const b = newBird(depth, randIn(BIRD_FLIGHT.songSize) * (0.65 + 0.35 * depth), randIn(BIRD_FLIGHT.songFlapHz))
    songTarget(b, w, false)
    b.x = b.tx
    b.y = b.ty
    b.perched = true
    b.timer = rand(0.1, 1.6)
    b.face = Math.random() < 0.5 ? -1 : 1
    songTarget(b, w, true)
    birds.push(b)
  }
  return birds.sort((a, b2) => a.depth - b2.depth)
}

/** Boids forces for one bird (separation, alignment, cohesion) among the given (active) neighbours. */
function flockForce(b: Bird, birds: Bird[], neighR: number, sepR: number, out: Pt): void {
  let ax = 0
  let ay = 0
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let n = 0
  for (const o of birds) {
    if (o === b || !o.active) continue
    const dx = o.x - b.x
    const dy = o.y - b.y
    const d2 = dx * dx + dy * dy
    if (d2 > neighR * neighR) continue
    n++
    ax += o.vx
    ay += o.vy
    cx += dx
    cy += dy
    if (d2 < sepR * sepR) {
      const d = Math.sqrt(d2) || 0.01
      const k = (sepR - d) / sepR
      sx -= (dx / d) * k
      sy -= (dy / d) * k
    }
  }
  out.x = 0
  out.y = 0
  if (!n) return
  const al = Math.hypot(ax, ay) || 1
  const cl = Math.hypot(cx, cy) || 1
  // weights: alignment, cohesion, separation (returned as unit-ish steering, caller scales)
  out.x = (ax / al) * 0.55 + (cx / cl) * 0.22 * Math.min(1, cl / neighR) + sx * 1.6
  out.y = (ay / al) * 0.55 + (cy / cl) * 0.22 * Math.min(1, cl / neighR) + sy * 1.6
}

/* ------------------------------------------------------------------ canvas band */

interface Band {
  /** Band rect as fractions (0..1) of the layer box. */
  l: number
  t: number
  w: number
  h: number
  /** Edges that lie inside the box (birds fade out there instead of being cut). */
  innerL: boolean
  innerR: boolean
  innerT: boolean
  innerB: boolean
}

/** BIRD_FLIGHT.canvas[mode] (viewport fractions) -> fractions of the box (x -3 %..103 %, y -30 %..130 %). */
function bandInBox(mode: Mode): Band {
  const c = BIRD_FLIGHT.canvas[mode]
  const l = clamp((c.x0 + 0.03) / 1.06)
  const r = clamp((c.x1 + 0.03) / 1.06)
  const t = clamp((c.y0 + 0.3) / 1.6)
  const b = clamp((c.y1 + 0.3) / 1.6)
  return {
    l,
    t,
    w: Math.max(0.01, r - l),
    h: Math.max(0.01, b - t),
    innerL: l > 0.001,
    innerR: r < 0.999,
    innerT: t > 0.001,
    innerB: b < 0.999,
  }
}

const pct = (f: number) => `${(f * 100).toFixed(4)}%`

/* ------------------------------------------------------------------ component */

export default function Birds({ mode, sceneId }: { mode: Mode; sceneId: SceneId }) {
  // staged degradation: flocks are switched off for good from DEGRADE.levelBirdsOff
  const [alive, setAlive] = useState(() => getDegradeLevel() < DEGRADE.levelBirdsOff)
  useEffect(() => {
    if (!alive) return
    return onDegrade((level) => {
      if (level >= DEGRADE.levelBirdsOff) setAlive(false)
    })
  }, [alive])

  if (!alive) return null
  return <Flock mode={mode} sceneId={sceneId} />
}

function Flock({ mode, sceneId }: { mode: Mode; sceneId: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [band] = useState(() => bandInBox(mode))

  useEffect(() => {
    const canvas = ref.current
    const box = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !box || !ctx) return

    const sheet = getSheet(mode)
    const S = BIRD_FLIGHT.sheetScale
    const cellPxW = Math.ceil(sheet.cw * S)
    const cellPxH = Math.ceil(sheet.ch * S)
    const tier = getPerfTier()
    const base = mode === 'cranes' ? BIRDS.cranes : mode === 'bats' ? BIRDS.bats : BIRDS.songbirds
    const factor = Math.min(BIRD_FLIGHT.tierFactor[tier], isMobileViewport() ? BIRDS.mobileFactor : 1)
    const count = Math.max(2, Math.round(base * factor))
    const avoid = isEnabled('boidsCursorAvoid')

    let dpr = effectDpr(tier)
    let world = makeWorld(Math.max(1, box.clientWidth), Math.max(1, box.clientHeight))
    // the canvas band in box px (simulation stays in box px; drawing is offset by bx / by)
    let bx = 0
    let by = 0
    let bw = 1
    let bh = 1
    let birds: Bird[] =
      mode === 'cranes' ? spawnCranes(count, world) : mode === 'bats' ? spawnBats(count, world) : spawnSongbirds(count, world)
    if (mode !== 'bats') for (const b of birds) b.active = true

    let clock = 0
    let released = mode !== 'cranes' || motionState.introDone
    let releasedAt = 0
    let nextGroup = mode === 'bats' ? 0.6 : 0
    const steer = P(0, 0)
    const pointer = P(-1e6, -1e6)

    const resize = () => {
      const W = Math.max(1, box.clientWidth)
      const H = Math.max(1, box.clientHeight)
      dpr = effectDpr(tier)
      const kx = W / world.W
      const ky = H / world.H
      if (kx !== 1 || ky !== 1) {
        for (const b of birds) {
          b.x *= kx
          b.y *= ky
          b.tx *= kx
          b.ty *= ky
        }
      }
      world = makeWorld(W, H)
      bx = band.l * W
      by = band.t * H
      bw = band.w * W
      bh = band.h * H
      const cw = Math.max(1, Math.round(bw * dpr))
      const ch = Math.max(1, Math.round(bh * dpr))
      if (canvas.width !== cw) canvas.width = cw
      if (canvas.height !== ch) canvas.height = ch
      draw()
    }

    const offIntro = on('intro', () => {
      if (released) return
      released = true
      releasedAt = clock
    })

    /* ---------------- per-mode steering */

    const stepCranes = (b: Bird, dt: number) => {
      const w = world
      const boost = released ? 1 + (BIRD_FLIGHT.craneEntranceBoost - 1) * clamp(1 - (clock - releasedAt) / BIRD_FLIGHT.craneEntranceTime) ** 2 : 0
      const cruise = BIRD_FLIGHT.craneSpeed * w.u * (0.72 + 0.28 * b.depth) * boost
      flockForce(b, birds, 170 * w.u, 64 * w.u, steer)
      let dx = -1 + steer.x * 0.9
      let dy = steer.y * 0.9 + Math.sin(clock * 0.35 + b.seed) * 0.08
      const top = w.vy(BIRD_FLIGHT.craneBand[0])
      const bot = w.vy(BIRD_FLIGHT.craneBand[1])
      if (b.y < top) dy += ((top - b.y) / (60 * w.u)) * 0.6
      if (b.y > bot) dy -= ((b.y - bot) / (60 * w.u)) * 0.6
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      b.vx += (dx * cruise - b.vx) * Math.min(1, dt * 0.9)
      b.vy += (dy * cruise * 0.6 - b.vy) * Math.min(1, dt * 0.9)
      // slow majestic flaps, interrupted by glides
      b.timer -= dt
      if (b.timer <= 0) {
        b.glide = b.glide > 0.5 ? 0 : 1
        b.timer = b.glide ? rand(1.4, 3.6) : rand(2.5, 6)
      }
      // wrap: re-enter from the right with a little stagger
      if (b.x < w.vx(0) - 140 * w.u) {
        b.x = w.vx(1) + rand(80, 380) * w.u
        b.y = w.vy(rand(BIRD_FLIGHT.craneBand[0] + 0.03, BIRD_FLIGHT.craneBand[1] - 0.05))
      } else if (b.x > w.vx(1) + 600 * w.u) {
        b.x = w.vx(0) - 100 * w.u
      }
    }

    const spawnBatGroup = () => {
      const w = world
      const idle = birds.filter((b) => !b.active)
      if (idle.length < 2) return
      const size = Math.min(idle.length, Math.round(randIn(BIRD_FLIGHT.batGroupSize)))
      const fromLeft = Math.random() < 0.5
      const gy = w.vy(rand(BIRD_FLIGHT.batBand[0] + 0.04, BIRD_FLIGHT.batBand[1] - 0.08))
      const dir = fromLeft ? 1 : -1
      const climb = rand(-0.18, 0.12)
      for (let i = 0; i < size; i++) {
        const b = idle[i]
        if (!b) break
        b.active = true
        b.x = fromLeft ? w.vx(0) - (40 + i * rand(30, 70)) * w.u : w.vx(1) + (40 + i * rand(30, 70)) * w.u
        b.y = gy + rand(-50, 50) * w.u
        b.tx = dir
        b.ty = climb
        const sp = BIRD_FLIGHT.batSpeed * w.u * (0.7 + 0.3 * b.depth)
        b.vx = dir * sp
        b.vy = climb * sp
      }
    }

    const stepBat = (b: Bird, dt: number) => {
      const w = world
      if (!b.active) return
      const sp = BIRD_FLIGHT.batSpeed * w.u * (0.7 + 0.3 * b.depth)
      flockForce(b, birds, 130 * w.u, 38 * w.u, steer)
      // erratic flutter: two incommensurate wobbles + random jolts
      const wob = Math.sin(clock * 3.1 + b.seed) * 0.55 + Math.sin(clock * 7.3 + b.seed * 1.7) * 0.35
      let dx = b.tx + steer.x * 0.5 + rand(-0.4, 0.4)
      let dy = b.ty + wob + steer.y * 0.5 + rand(-0.5, 0.5)
      const top = w.vy(BIRD_FLIGHT.batBand[0])
      const bot = w.vy(BIRD_FLIGHT.batBand[1])
      if (b.y < top) dy += 0.8
      if (b.y > bot) dy -= 0.8
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      b.vx += (dx * sp - b.vx) * Math.min(1, dt * 4)
      b.vy += (dy * sp - b.vy) * Math.min(1, dt * 4)
      if (b.x < w.vx(0) - 200 * w.u || b.x > w.vx(1) + 200 * w.u) {
        if ((b.tx < 0 && b.x < 0) || (b.tx > 0 && b.x > w.W)) b.active = false
      }
    }

    const stepSong = (b: Bird, dt: number) => {
      const w = world
      if (b.perched) {
        b.vx *= Math.max(0, 1 - dt * 12)
        b.vy *= Math.max(0, 1 - dt * 12)
        b.timer -= dt
        if (b.timer <= 0) {
          b.perched = false
          songTarget(b, w, Math.random() < 0.8)
          // little hop-off
          b.vy -= 60 * w.u
        }
        return
      }
      const dx = b.tx - b.x
      const dy = b.ty - b.y
      const d = Math.hypot(dx, dy) || 1
      const sp = BIRD_FLIGHT.songSpeed * w.u * (0.75 + 0.25 * b.depth) * Math.min(1, d / (50 * w.u) + 0.35)
      flockForce(b, birds, 70 * w.u, 26 * w.u, steer)
      const ux = dx / d + steer.x * 0.25
      // bounding flight: a dip while the wings are folded
      const uy = dy / d + steer.y * 0.25 + (b.glide > 0.5 ? 0.35 : -0.12)
      b.vx += (ux * sp - b.vx) * Math.min(1, dt * 6)
      b.vy += (uy * sp - b.vy) * Math.min(1, dt * 6)
      b.timer -= dt
      if (b.timer <= 0) {
        b.glide = b.glide > 0.5 ? 0 : 1
        b.timer = b.glide ? rand(0.12, 0.22) : rand(0.25, 0.5)
      }
      if (d < 10 * w.u) {
        b.perched = true
        b.glide = 0
        b.timer = randIn(BIRD_FLIGHT.songPerch)
      }
    }

    /* ---------------- tick */

    // Box rect for cursor avoidance: read at the very start of each tick (prioritized ticker
    // callback, before Lenis / the timeline write styles) so it never forces a synchronous layout.
    const rect = { left: 0, top: 0, width: 0, height: 0, ok: false }
    const readRect = () => {
      rect.ok = false
      if (!released || !motionState.visible[sceneId] || !motionState.pageVisible) return
      if (motionState.pointer.px <= -9000) return
      const r = box.getBoundingClientRect()
      rect.left = r.left
      rect.top = r.top
      rect.width = r.width
      rect.height = r.height
      rect.ok = r.width > 0 && r.height > 0
    }

    const simulate = (dt: number) => {
      clock += dt
      let px = -1e6
      let py = -1e6
      if (avoid && rect.ok && motionState.pointer.px > -9000) {
        px = ((motionState.pointer.px - rect.left) * world.W) / rect.width
        py = ((motionState.pointer.py - rect.top) * world.H) / rect.height
      }
      pointer.x = px
      pointer.y = py

      if (mode === 'bats') {
        nextGroup -= dt
        if (nextGroup <= 0) {
          spawnBatGroup()
          nextGroup = randIn(BIRD_FLIGHT.batGroupGap)
        }
      }

      const R = BIRDS.avoidRadius
      for (const b of birds) {
        if (!b.active) continue
        if (mode === 'cranes') stepCranes(b, dt)
        else if (mode === 'bats') stepBat(b, dt)
        else stepSong(b, dt)

        // flee the cursor
        const ddx = b.x - pointer.x
        const ddy = b.y - pointer.y
        const d2 = ddx * ddx + ddy * ddy
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 0.01
          const k = (1 - d / R) ** 2 * BIRD_FLIGHT.avoidPush * Math.max(0.6, world.u)
          b.vx += (ddx / d) * k * dt * 6
          b.vy += (ddy / d) * k * dt * 6
          if (b.perched) {
            b.perched = false
            songTarget(b, world, false)
          }
        }

        b.x += b.vx * dt
        b.y += b.vy * dt

        // flap phase (glide eases toward the glide / folded frame)
        const flapping = mode === 'cranes' ? b.glide < 0.5 : mode === 'songbirds' ? !b.perched && b.glide < 0.5 : true
        if (flapping) b.frame += dt * b.flapHz * sheet.frames
        else if (mode === 'cranes') {
          // finish the current stroke, then hold the glide pose
          const f = ((b.frame % sheet.frames) + sheet.frames) % sheet.frames
          const target = sheet.glide
          const diff = (target - f + sheet.frames) % sheet.frames
          if (diff > 0.3) b.frame += Math.min(diff, dt * b.flapHz * sheet.frames)
        }
        const sp = Math.hypot(b.vx, b.vy)
        if (b.vx < -0.2 * sp) b.face = -1
        else if (b.vx > 0.2 * sp) b.face = 1
      }
    }

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const fade = BIRD_FLIGHT.edgeFade * world.u
      for (const b of birds) {
        if (!b.active) continue
        const scale = (b.size * world.u) / sheet.length
        const half = Math.max(sheet.cw, sheet.ch) * scale
        // band-local position
        const lx = b.x - bx
        const ly = b.y - by
        if (lx < -half || lx > bw + half || ly < -half || ly > bh + half) continue
        // fade out before the sprite reaches an inner band edge (never a hard cut)
        const ext = half * 0.5
        let alpha = b.alpha
        if (band.innerL) alpha *= clamp((lx - ext) / fade)
        if (band.innerR) alpha *= clamp((bw - lx - ext) / fade)
        if (band.innerT) alpha *= clamp((ly - ext) / fade)
        if (band.innerB) alpha *= clamp((bh - ly - ext) / fade)
        if (alpha <= 0.01) continue
        const fpos = ((b.frame % sheet.frames) + sheet.frames) % sheet.frames
        let fi = Math.floor(fpos)
        // songbirds: folded wings while perched / bounding; cranes: glide pose once the stroke has finished
        if (mode === 'songbirds' && (b.perched || b.glide > 0.5)) fi = sheet.frames
        else if (mode === 'cranes' && b.glide > 0.5 && (fpos < 0.35 || fpos > sheet.frames - 0.35)) fi = sheet.glide
        let angle: number
        let fy = 1
        if (sheet.view === 'side') {
          // pitch along the velocity (clamped so nobody nose-dives); facing left = rotate by π − pitch
          // with the sprite flipped vertically so the bird stays upright
          const sp = Math.hypot(b.vx, b.vy)
          const maxPitch = mode === 'cranes' ? 0.28 : 0.6
          const pitch =
            mode === 'songbirds' && (b.perched || sp < 20) ? 0 : clamp(Math.atan2(b.vy, Math.abs(b.vx)), -maxPitch, maxPitch)
          if (b.face < 0) {
            fy = -1
            angle = Math.PI - pitch
          } else {
            angle = pitch
          }
        } else {
          angle = clamp(b.vx / (BIRD_FLIGHT.batSpeed * world.u * 3), -0.35, 0.35) + Math.sin(clock * 5 + b.seed) * 0.08
        }
        const c = Math.cos(angle) * scale * dpr
        const s = Math.sin(angle) * scale * dpr
        ctx.setTransform(c, s, -s * fy, c * fy, lx * dpr, ly * dpr)
        ctx.globalAlpha = alpha
        ctx.drawImage(sheet.canvas, fi * cellPxW, 0, cellPxW, cellPxH, -sheet.cw / 2, -sheet.ch / 2, sheet.cw, sheet.ch)
      }
      ctx.globalAlpha = 1
    }

    const tick = (_time: number, deltaMs: number) => {
      if (!motionState.visible[sceneId] || !motionState.pageVisible) return
      if (!released) return
      const dt = Math.min(0.05, Math.max(0, deltaMs / 1000))
      simulate(dt)
      draw()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)
    if (avoid) gsap.ticker.add(readRect, false, true)
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.remove(readRect)
      ro.disconnect()
      offIntro()
      birds = []
      // free the bitmap right away
      canvas.width = 0
      canvas.height = 0
    }
  }, [mode, sceneId, band])

  const style: CSSProperties = { left: pct(band.l), top: pct(band.t), width: pct(band.w), height: pct(band.h) }
  return <canvas ref={ref} className="birds-canvas" data-mode={mode} aria-hidden="true" style={style} />
}
