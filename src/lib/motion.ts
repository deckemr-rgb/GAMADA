/**
 * motion.ts — the single source of truth for every timing, ease, distance and
 * feature flag in the experience. No other file should hard-code motion numbers.
 *
 * Flags can also be switched off at runtime for testing with a query string:
 *   ?off=particles,birds,displacementTransition
 * and everything can be forced on/off with ?motion=reduced
 */
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)
// Every GSAP transform goes through translate3d/matrix3d so layers stay on the compositor.
gsap.config({ force3D: true })

/* ------------------------------------------------------------------ flags */

export const FLAGS = {
  /** Lenis smooth scrolling (native scroll when off). */
  smoothScroll: true,
  /** 4.1 mouse parallax on top of scroll parallax. */
  pointerParallax: true,
  /** 4.1 DeviceOrientation parallax on touch devices (after permission). */
  gyroParallax: true,
  /** 4.1 dolly zoom while transitioning. */
  dollyZoom: true,
  /** 4.1 fake depth of field on foreground layers while moving fast. */
  depthOfField: true,
  /** 4.2 WebGL water-curtain displacement at the scene seam. */
  displacementTransition: true,
  /** 4.2 per-scene colour grading overlay. */
  colorGrading: true,
  /** 4.2 mist that thickens on the seam. */
  transitionMist: true,
  /** 4.2 soft snapping to the nearest scene label. */
  snap: true,
  /** 4.3 bird / bat flocks (boids). */
  birds: true,
  /** 4.3 flock flees the cursor. */
  boidsCursorAvoid: true,
  /** 4.3 waterfall shader (static SVG fallback when off). */
  waterfallShader: true,
  /** 4.3 animated god rays. */
  godRays: true,
  /** 4.3 GPU particles (dust / fireflies). */
  particles: true,
  /** 4.3 wind on grass + scarf, boosted by scroll velocity. */
  wind: true,
  /** 4.3 deer pose cross-fades. */
  deerPoses: true,
  /** 4.4 character / line reveals (plain fades when off). */
  splitTextReveal: true,
  /** 4.4 magnetic CTA. */
  magneticButton: true,
  /** 4.4 custom cursor (desktop only). */
  customCursor: true,
  /** 4.4 scene progress rail. */
  progressRail: true,
  /** 4.5 preloader + intro choreography. */
  preloader: true,
  /** 4.6 ambient audio toggle (sound itself always starts OFF). */
  audio: true,
  /** Site: 3D tilt + cursor spotlight on cards. */
  cardTilt: true,
  /** Site: statistics count up once when 60 % visible (final value shown when off). */
  statCounter: true,
  /** Site: mist curtain between pages (instant swap when off). */
  pageCurtain: true,
  /** Site: low-tier fireflies / dust behind content sections and the footer. */
  sectionParticles: true,
  /** Demo: micro-interactions inside the product sandboxes (KPI roll, row slide-in, chip drop, stamps). */
  demoAnimations: true,
  /** Demo: cinematic parts of the guided tour (fog curtain, map fly, clock spin). */
  tourCinematics: true,
  /** Demo: animated rain cells / flood growth on maps (static frames when off). */
  mapRain: true,
  /** Demo: animated constellation on /ekosistem (static SVG when off). */
  constellation: true,
} as const

export type FlagKey = keyof typeof FLAGS

/** Flags that are forced off when the user prefers reduced motion. */
const MOTION_HEAVY: ReadonlySet<FlagKey> = new Set<FlagKey>([
  'smoothScroll',
  'pointerParallax',
  'gyroParallax',
  'dollyZoom',
  'depthOfField',
  'displacementTransition',
  'transitionMist',
  'birds',
  'boidsCursorAvoid',
  'waterfallShader',
  'godRays',
  'particles',
  'wind',
  'deerPoses',
  'splitTextReveal',
  'magneticButton',
  'customCursor',
  'cardTilt',
  'statCounter',
  'pageCurtain',
  'sectionParticles',
  'demoAnimations',
  'tourCinematics',
  'mapRain',
  'constellation',
])

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const OFF_FROM_URL = new Set((query.get('off') ?? '').split(',').map((s) => s.trim()).filter(Boolean))

let reducedCache: boolean | null = null
/** True when the OS asks for reduced motion (or ?motion=reduced). */
export function prefersReducedMotion(): boolean {
  if (reducedCache !== null) return reducedCache
  if (typeof window === 'undefined') return false
  const forced = query.get('motion')
  reducedCache = forced === 'reduced' ? true : forced === 'full' ? false : window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reducedCache
}

/** Is a feature flag on, after reduced-motion and URL overrides? */
export function isEnabled(flag: FlagKey): boolean {
  if (!FLAGS[flag]) return false
  if (OFF_FROM_URL.has(flag)) return false
  if (prefersReducedMotion() && MOTION_HEAVY.has(flag)) return false
  return true
}

/* ------------------------------------------------------------------ eases */

export const EASE = {
  /** Section 4.4 reveal ease: cubic-bezier(.65,0,.35,1). */
  reveal: CustomEase.create('gamadaReveal', '0.65,0,0.35,1'),
  /** Camera move between scenes. */
  camera: CustomEase.create('gamadaCamera', '0.45,0,0.2,1'),
  /** Programmatic scroll (Start the journey). */
  scrollTo: CustomEase.create('gamadaScrollTo', '0.7,0,0.2,1'),
  /** Soft overshoot used by the intro (mountain rise). */
  overshoot: 'back.out(1.35)',
  pointer: 'power3.out',
  snap: 'power2.inOut',
  out: 'power3.out',
  inOut: 'power2.inOut',
} as const

/* ------------------------------------------------------------------ durations (seconds) */

export const DUR = {
  pointerFollow: 1.0,
  scrollToScene: 2.2,
  reducedCrossfade: 0.4,
  hover: 0.45,
  magneticReturn: 0.7,
  navStagger: 0.06,
  navIntro: 0.9,
  railCounter: 0.6,
  preloaderMinVisible: 0.6,
  preloaderOut: 0.7,
  /** Whole intro after the preloader must stay ≤ 2.5s. */
  introTotalMax: 2.5,
  introSky: 0.8,
  introMountain: 1.2,
  introCopy: 1.1,
  deerPoseHoldMin: 2.4,
  deerPoseHoldMax: 5.5,
  deerPoseFade: 0.35,
  audioFade: 1.2,
} as const

/* ------------------------------------------------------------------ scroll + camera */

export const SCROLL = {
  /** Scroll distance per scene transition, in viewport heights. */
  vhPerTransition: 1.6,
  /** Extra hold at the end so the last scene can breathe, in vh. */
  vhTailHold: 0.35,
  /** ScrollTrigger scrub smoothing (seconds). With Lenis on this can be small. */
  scrub: 0.6,
  lenisDuration: 1.15,
  lenisWheelMultiplier: 0.9,
  lenisTouchMultiplier: 1.4,
} as const

export const SNAP = {
  durationMin: 0.4,
  durationMax: 1.0,
  delay: 0.12,
} as const

export const CAMERA = {
  /** Scroll parallax speed per depth: lerp(kMin, kMax, depth). */
  kMin: 0.3,
  kMax: 1.4,
  /** How far (in viewport heights) a k=1 layer travels during one transition. */
  travel: 0.8,
  /** Seam position (viewport fraction) at transition start / end. */
  seamFrom: 1.32,
  seamTo: -0.32,
  /** Dolly zoom scale for far (depth 0) / near (depth 1) layers of the outgoing scene. */
  dollyFar: 1.06,
  dollyNear: 1.18,
  /** Incoming scene settles from this scale to 1. */
  incomingScale: 1.035,
  /** Pointer parallax max shift in px for a depth-1 layer. */
  pointerMaxX: 30,
  pointerMaxY: 16,
  /** Gyro: degrees of tilt that map to full pointer range. */
  gyroRange: 22,
} as const

export const TIMELINE = {
  /** Timeline units per transition (labels sit at 0, 1, 2 …). */
  segment: 1,
  /** Copy of the outgoing scene leaves during [copyOutStart, copyOutEnd]. */
  copyOutStart: 0.06,
  copyOutEnd: 0.34,
  /** Copy of the incoming scene arrives during [copyInStart, copyInEnd] (dwell after it). */
  copyInStart: 0.58,
  copyInEnd: 0.94,
  /** Mist peaks at the seam crossing. */
  mistPeak: 0.5,
} as const

export const WIND = {
  /** Base skew amplitude in degrees for wind layers. */
  baseSkew: 1.1,
  /** Extra skew per unit of normalised scroll velocity. */
  velocitySkew: 4.5,
  maxSkew: 7,
  /** Sway frequency (Hz) for layers; each layer gets a phase offset. */
  frequency: 0.32,
  /** How fast the wind value follows velocity (0..1 per frame at 60fps). */
  follow: 0.06,
  /** Velocity (px/frame) treated as "1" when normalising. */
  velocityNorm: 60,
  /** Skip transform writes smaller than this (degrees). */
  minDelta: 0.02,
} as const

export const GRADE = {
  /** Opacity of the per-scene grading gradient (normal blending — no mix-blend-mode). */
  opacity: 0.22,
} as const

export const DOF = {
  /** Normalised velocity above which foreground starts to blur. */
  threshold: 0.18,
  /** Blur baked into the *-blur twins (css px at 1440w); see tools/build-layers.mjs. */
  maxBlurPx: 4,
  follow: 0.12,
} as const

export const REVEAL = {
  charYPercent: 110,
  charRotateX: -38,
  charStagger: 0.03,
  lineStagger: 0.08,
  lineYPercent: 105,
  ruleScale: 0,
  /** Duration (timeline units in scrubbed context, seconds otherwise). */
  inDuration: 0.6,
  outDuration: 0.45,
} as const

export const MAGNETIC = {
  strength: 0.35,
  textStrength: 0.18,
  radius: 1.4,
} as const

export const PARTICLES = {
  desktop: 300,
  mobile: 80,
  low: 40,
  velocityPush: 0.004,
} as const

export const BIRDS = {
  cranes: 13,
  bats: 9,
  songbirds: 8,
  mobileFactor: 0.6,
  frames: 10,
  avoidRadius: 170,
} as const

/* ------------------------------------------------------------------ helpers */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v))

/** Parallax speed factor for a layer depth in [0, 1]. */
export const depthToSpeed = (depth: number): number => lerp(CAMERA.kMin, CAMERA.kMax, clamp(depth))

/** Dolly target scale for a layer depth in [0, 1]. */
export const depthToDolly = (depth: number): number => lerp(CAMERA.dollyFar, CAMERA.dollyNear, clamp(depth))

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches

export const isMobileViewport = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

/* ---------------- WEBGL (tuning) — A7: shared effect-canvas settings (lib/gl.ts, Birds) */
export const WEBGL = {
  /** Max device-pixel-ratio for every effect canvas (WebGL + bird 2D canvases) on the 'high' tier. */
  dprHigh: 1.25,
  /** Max DPR on the 'mid' / 'low' tiers. */
  dprLow: 1,
} as const

/* ---------------- DEGRADE (tuning) — A7: staged fps degradation (lib/perf.ts) */
export const DEGRADE = {
  /** Sampling never starts earlier than this after navigation start (ms), and only after the intro. */
  startDelayMs: 3500,
  /** Start anyway this long after the first subscriber if the intro never fires (ms). */
  introTimeoutMs: 9000,
  /** Length of one fps window (ms). */
  windowMs: 1000,
  /** A window is "bad" when its average fps is below this. */
  minFps: 50,
  /** Consecutive bad windows needed to step up one level. */
  badWindows: 2,
  /** Sampling stops after this much sampled (visible) time (ms), or once the last level is reached. */
  maxSampleMs: 20000,
  /** A frame gap longer than this (tab switch, debugger) discards the current window (ms). */
  maxGapMs: 1000,
  /** Level at which each effect steps down (1 = DOF off is handled by ambient.ts). */
  levelDof: 1,
  levelParticlesHalf: 2,
  levelBirdsOff: 3,
  levelWaterfallStatic: 4,
  /** Particle count multiplier from `levelParticlesHalf`. */
  particleFactor: 0.5,
} as const

/* ---------------- PARTICLE_LOOK (tuning) — A7: Particles.tsx */
export const PARTICLE_LOOK = {
  /** Global opacity of the layer. */
  opacity: 0.6,
  /** Drift velocity (viewport fractions per second) per scene: [x, y] (y down). */
  driftHero: [0.012, -0.006],
  driftFirefly: [0.002, -0.004],
  /** Largest scroll push per frame (viewport fractions) so flicks never teleport particles. */
  maxPushPerFrame: 0.05,
  /** Fraction of particles that act as fireflies in the forest scenes (others fade out). */
  fireflyShare: 0.5,
  colors: {
    heroA: '#ffc79a',
    heroB: '#ffd77e',
    tranqA: '#8fe8ff',
    tranqB: '#4fd1ff',
    bioA: '#e2ff8a',
    bioB: '#b4f06a',
  },
} as const

/* ---------------- CURTAIN (tuning) — A7: CurtainGL.tsx */
export const CURTAIN = {
  /** Band height as a fraction of the viewport height. */
  height: 0.38,
  /** intensity = transition × (base + speed × speedGain), clamped to 0..1. */
  base: 0.35,
  speedGain: 1.4,
  /** Streak flow speed (uv units / s) at rest, and extra per unit of scroll speed. */
  flow: 0.9,
  flowSpeedGain: 5,
  /** The curtain renders at a fraction of the viewport resolution (it is soft anyway). */
  resolution: 0.75,
  /** Water tints for transition 0→1 (hero → tranquility) and 1→2 (tranquility → biodiversity). */
  tintA: '#cfe4ff',
  tintB: '#c4fff0',
  /** Dark trough colour (indigo from the palette). */
  trough: '#231b48',
} as const

/* ---------------- WATERFALL (tuning) — A7: WaterfallGL.tsx */
export const WATERFALL = {
  /** Core / tint colours per scene. */
  colors: {
    tranquility: { core: '#dff6ff', tint: '#8fd8ff' },
    biodiversity: { core: '#f0fff9', tint: '#9ff0dd' },
  },
  /** Streak fall speed (uv units per second). */
  fallSpeed: 1.35,
  /** Fraction of the rect height covered by the foam pool. */
  foamHeight: 0.12,
} as const

/* ---------------- BIRD_FLIGHT (tuning) — A7: Birds.tsx (counts stay in BIRDS) */
export const BIRD_FLIGHT = {
  /** Count multiplier per perf tier (combined with BIRDS.mobileFactor via min()). */
  tierFactor: { high: 1, mid: 0.6, low: 0.4 },
  /** Sprite sheets are rendered at this resolution multiplier (crisp up to DPR 1.5 at max bird size). */
  sheetScale: 1.6,
  /** Reference viewport width for sizes / speeds (px). */
  refWidth: 1440,
  /**
   * Canvas rect per mode in viewport fractions (same space as the flight bands; the layer box spans
   * x −0.03…1.03, y −0.3…1.3). Only this band gets a drawing buffer; birds fade out near an inner edge.
   */
  canvas: {
    cranes: { x0: -0.03, x1: 1.03, y0: -0.08, y1: 0.68 },
    bats: { x0: -0.03, x1: 1.03, y0: -0.06, y1: 0.6 },
    songbirds: { x0: 0.38, x1: 1.03, y0: 0.02, y1: 0.78 },
  },
  /** Fade distance (px at the reference width) before a bird reaches an inner canvas edge. */
  edgeFade: 48,
  /** Cranes: viewport-fraction band, cruise speed (px/s at ref width), flap Hz, drawn length (px). */
  craneBand: [0.22, 0.45],
  craneSpeed: 62,
  craneFlapHz: [0.55, 0.78],
  craneLength: [88, 136],
  /** Cranes start this far (px) beyond the right viewport edge; entrance speed boost decays over `entranceTime` s. */
  craneEntranceBoost: 4.5,
  craneEntranceTime: 5,
  /** Bats: band, speed, flap Hz, size, pause between groups (s). */
  batBand: [0.08, 0.44],
  batSpeed: 165,
  batFlapHz: [6.5, 9.5],
  batSize: [34, 52],
  batGroupGap: [2.5, 7],
  batGroupSize: [2, 4],
  /** Songbirds: perch region (viewport fractions), speed, flap Hz, size, perch time (s). */
  songRegion: { x0: 0.54, x1: 0.95, y0: 0.16, y1: 0.62 },
  songSpeed: 230,
  songFlapHz: [9, 13],
  songSize: [30, 42],
  songPerch: [0.45, 2.2],
  /** How strongly the flock flees the cursor (px/s at the centre of the radius). */
  avoidPush: 420,
} as const

/* ---------------- CRANE_COLORS (tuning) — A7: Birds.tsx crane palette (cool-lavender cel shade on white) */
export const CRANE_COLORS = {
  white: '#fdf8f1',
  shade: '#cdc4ea',
  farWhite: '#ddd5f0',
  black: '#1b1828',
  farBlack: '#3b3450',
  red: '#e2362c',
  beak: '#cdbb8e',
  leg: '#342e44',
} as const

/* ---------------- GODRAY_MOTION (tuning) — A7: GodRays.tsx (geometry stays in assets.ts → GODRAYS) */
export const GODRAY_MOTION = {
  widthMin: 60,
  widthMax: 220,
  /** ± angle offset of individual rays (deg). */
  spread: 10,
  /** Rays start spread along a short gap rather than from a single point (canvas px). */
  gap: 150,
  periodMin: 4,
  periodMax: 9,
  /** Slow angle drift amplitude (deg) and its period range (s). */
  drift: 0.9,
  driftPeriod: [11, 19],
  /** Opacity range of the breathing (multiplies the ray's base strength). */
  breatheLow: 0.45,
  noise: 0.12,
  /** Length variation (fraction of GODRAYS.length). */
  lengthMin: 0.62,
  glowSize: 520,
} as const

/* ---------------- AUDIO_MIX (tuning) — A7: lib/audio.ts */
export const AUDIO_MIX = {
  master: 0.35,
  /** Per-bed trims so the three beds feel equally loud. */
  wind: 0.9,
  water: 0.75,
  forest: 0.85,
  /** Smoothing time constant for bed level changes (s). */
  mixTau: 0.12,
  /** Seconds between chirp phrases (scaled by the forest level). */
  chirpGap: [1.6, 5.5],
  noiseSeconds: 6,
  /** Give up waiting for AudioContext.resume() after this long (ms). */
  resumeTimeoutMs: 2500,
} as const

/* ---------------- UI (tuning) — JS-driven chrome timings: cursor, preloader, magnetic CTA, nav menu */
export const UI = {
  cursor: {
    /** Dot follows the pointer (s). */
    follow: 0.25,
    /** Grow / shrink over interactive elements (s). */
    grow: 0.35,
    /** Show / hide fade (s). */
    fade: 0.2,
    /** Press feedback (s) and scale factor while pressed. */
    press: 0.15,
    pressScale: 0.8,
    /** Size ratio of the 56px element: rest 10px, hover 56px. */
    restScale: 10 / 56,
    hoverScale: 1,
  },
  preloader: {
    /** Upper bound (s) before the quick / reduced variant gives up waiting for assets. */
    quickMax: 1.5,
    /** Safety net (s): never keep the full preloader up longer than this. */
    maxWait: 8,
    /** Displayed percentage chases the real one with this duration (s). */
    countFollow: 0.45,
    /** Time (s) to run the counter up to 100 before the wipe. */
    finishCount: 0.3,
    /** Rolling digit duration (s). */
    digitRoll: 0.28,
    /** Wordmark letters rise. */
    charRise: 0.9,
    charStagger: 0.06,
    charDelay: 0.05,
    /** Caption + footer fade in. */
    captionFade: 0.6,
    captionDelay: 0.25,
    /** Exit: centre block drifts up by this yPercent; centre / foot fade as fractions of DUR.preloaderOut. */
    exitLiftYPercent: -40,
    exitCenterFraction: 0.8,
    exitFootFraction: 0.4,
  },
  magnetic: {
    /** Follow duration while the pointer is inside the magnetic zone (s). */
    follow: 0.45,
    /** Elastic return when the pointer leaves the zone (duration = DUR.magneticReturn). */
    returnEase: 'elastic.out(1, 0.4)',
  },
  menu: {
    /** Delay (ms) before focusing the first menu item, so visibility has flipped. */
    focusDelayMs: 30,
  },
} as const

/* ---------------- SITE (multi-page shell): navbar, page curtain, floating WhatsApp, footer fireflies */
export const SITE_MOTION = {
  nav: {
    /** Scroll distance (px) after which the bar turns solid with a shadow. */
    solidAfterPx: 4,
    /** Below this width (px) the links collapse into the full-screen menu. */
    collapseBelowPx: 960,
    /** Hover-out grace (ms) before a dropdown closes. */
    dropdownCloseDelayMs: 140,
    /** Dropdown panel fade / lift (s). */
    dropdown: 0.28,
    /** Mobile curtain menu: slide (s) and link stagger (s). */
    menuCurtain: 0.55,
    menuStagger: 0.05,
  },
  curtain: {
    /** Mist rising over the old page (s). The page chunk downloads in parallel. */
    cover: 0.24,
    /** Mist lifting off the new page (s), shortened when route work ate into the budget … */
    reveal: 0.3,
    /** … but never shorter than this (s). */
    minReveal: 0.16,
    /** Whole transition budget, cover start → reveal end (ms). */
    budgetMs: 700,
    /** Safety net (ms): never leave the curtain down longer than this. */
    maxHoldMs: 2500,
  },
  fireflies: {
    /** Count per perf tier. */
    high: 18,
    mid: 12,
    low: 8,
  },
} as const

/* ---------------- SITE_REVEAL: the shared animation language of the content sections (lib/reveal.ts) */
export const SITE_REVEAL = {
  /** Where a reveal starts (ScrollTrigger start). */
  start: 'top 84%',
  /** Section titles: masked lines from below. */
  headingDur: 0.95,
  headingStagger: 0.08,
  lineYPercent: 105,
  /** Eyebrow / badge: fade + thin line growing. */
  eyebrowDur: 0.7,
  /** Cards: rise 24 px + fade, batched. */
  cardY: 24,
  cardDur: 0.75,
  cardStagger: 0.06,
  /** Images / screenshots: clip-path wipe up + scale 1.08 → 1. */
  imageDur: 1.1,
  imageScale: 1.08,
  /** Stat counters: start when 60 % of the number is visible, run once. */
  counterStart: '60% bottom',
  counterDur: 1.6,
  /** Reduced-motion fallback: plain fade. */
  fadeDur: 0.45,
  /** Card hover: max tilt (deg), follow time (s), perspective (px). */
  tiltMax: 6,
  tiltFollow: 0.5,
  tiltPerspective: 900,
  /** Slow dusk gradient drift behind sections (s per loop). */
  ambientLoop: 38,
} as const

/* ------------------------------------------------------------------ demos (ekosistem) */

/**
 * DEMO — timings for the product sandboxes (spec §8.3). Seconds unless the name says ms.
 * Reduced motion: every movement becomes a fade of at most `reducedFade`.
 */
export const DEMO = {
  hover: 0.12,
  press: 0.2,
  panel: 0.32,
  screen: 0.6,
  /** "wow" moments: min / max */
  wowMin: 0.9,
  wowMax: 1.4,
  reducedFade: 0.15,
  /** KPI count-up upper bound */
  countUp: 0.6,
  /** new row: slide distance (px), highlight alpha, highlight fade (s) */
  rowSlidePx: 8,
  rowHighlightAlpha: 0.12,
  rowHighlightFade: 1.5,
  /** structured chips drop stagger (s) */
  chipStagger: 0.06,
  /** AI token stream: tokens per second range + punctuation pause (ms) */
  tokensPerSecMin: 25,
  tokensPerSecMax: 45,
  punctuationPauseMs: 140,
  /** skeleton max duration in simulation mode (ms) */
  skeletonMaxMs: 400,
  /** chart draw-in (s) */
  chartDraw: 0.8,
  /** confetti on mission complete (s) */
  confetti: 1,
  /** toasts: max stacked, auto-dismiss (ms) */
  toastMax: 3,
  toastMs: 6000,
  /** live AI: no first token within this → fall back to simulation (ms) */
  liveFirstTokenTimeoutMs: 10000,
  /** map rain animation cap (fps) on mid tier */
  rainFpsMid: 30,
} as const

/* ------------------------------------------------------------------ site pages (Tahap 6) */

/**
 * ECO_SITE — timings of the ecosystem site pages (/ekosistem, /ekosistem/:eco, /produk/:slug, /lab) and the
 * product mini-demos (src/demos/mini-kit.tsx). Seconds unless the name says ms / px / vh.
 * Flag `constellation` (FLAGS above, ?off=constellation) gates the hub sky; reduced motion and ?static=1 show
 * final states (lines drawn, no twinkle, no zoom; minis on their final frame with a "Putar" button).
 */
export const ECO_SITE = {
  constellation: {
    /** relation lines draw in on enter (stroke-dashoffset): per-line duration and total stagger spread */
    lineDraw: 1.2,
    lineStagger: 1.2,
    /** hover / focus: other lines + stars dim to this opacity */
    dimTo: 0.25,
    /** stars twinkling at once (opacity only) and one twinkle cycle */
    twinkleCount: 6,
    twinkle: 2.4,
    /** click → star scales 1 → zoomScale while the sky fades, then navigate (ms) */
    zoomScale: 8,
    zoomMs: 300,
    /** min hit area of a star (px) */
    hitPx: 44,
  },
  flow: {
    /** desktop pinned length of the "Bagaimana semuanya terhubung" diagram (vh), scrub smoothing */
    pinVh: 150,
    scrub: 0.6,
  },
  mini: {
    /** mount a mini when its frame is this close to the viewport (IntersectionObserver rootMargin) */
    rootMargin: '200px',
    /** autoplay while at least this share of the frame is visible */
    playThreshold: 0.5,
    /** /lab: hover / focus delay before the preview loads (ms) and max minis kept mounted (LRU) */
    previewDelayMs: 220,
    maxMounted: 3,
    /** default hold per frame when a script step gives none (ms), and the cross-fade between frames (s) */
    frameMs: 2200,
    crossfade: 0.35,
  },
} as const
