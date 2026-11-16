/**
 * assets.ts — layer manifest for every scene + preloading.
 *
 * CANVAS: every layer file is 2560 × 2304 (16:9 frame of 2560 × 1440 plus 30 %
 * bleed above and below — 432 px each side). All layers of a scene share the
 * same canvas so they stay aligned under object-fit: cover. Swap any .svg for a
 * .webp/.avif of the same canvas size by changing only `src` here.
 */
import type { ReactNode } from 'react'

export const CANVAS = {
  w: 2560,
  h: 2304,
  /** Visible 16:9 frame inside the canvas. */
  frameTop: 432,
  frameH: 1440,
  /** Bleed as a fraction of the frame height (top and bottom each). */
  bleed: 0.3,
} as const

export type SceneId = 'hero' | 'tranquility' | 'biodiversity'

/** Live (code-driven) layers that are rendered by a React component instead of an image. */
export type SlotId =
  | 'hero-birds'
  | 'tranquility-godrays'
  | 'tranquility-waterfall'
  | 'tranquility-bats'
  | 'biodiversity-godrays'
  | 'biodiversity-waterfall'
  | 'biodiversity-birds'

/** Rect in canvas coordinates (2560 × 2304 space). */
export interface CanvasRect {
  x: number
  y: number
  w: number
  h: number
}

export interface LayerDef {
  id: string
  /** Image layer: art key `<scene>/<layer>` (see layers.generated.json). Exactly one of src / slot is set. */
  src?: string
  /** Live layer. `space: 'frame'` → children get canvas coordinates; 'box' → plain full-layer box. */
  slot?: SlotId
  space?: 'frame' | 'box'
  /** 0 = farthest (sky) … 1 = nearest (foreground). Drives every parallax effect. */
  depth: number
  /** Grass/plants that sway with wind; pivot is the bottom of the layer. */
  wind?: boolean
  /** Rotational sway around a pivot (canvas coords), e.g. a scarf. Amplitude in degrees. */
  sway?: { x: number; y: number; amp: number }
  /** Foreground layer that gets fake depth-of-field blur while moving fast. */
  dof?: boolean
  /** Pose layers cross-fade within a group (index 0 is the resting pose). */
  pose?: { group: string; index: number }
  blend?: 'normal' | 'screen' | 'multiply' | 'soft-light' | 'overlay' | 'lighten'
  opacity?: number
}

/** Layout of a scene's copy. The words themselves live in content/i18n/home/scenes.ts (ID + EN). */
export interface CopyDef {
  /** 'start' = hero CTAs (WhatsApp + continue the journey); 'more' = text link to `href` (route or #anchor). */
  cta: { kind: 'start' | 'more'; href?: string }
  align: 'left' | 'right'
  heading: 'h1' | 'h2'
  /** Show the little bar icon before the eyebrow (hero only). */
  eyebrowIcon?: boolean
}

export interface SceneDef {
  id: SceneId
  index: number
  /** Fallback name (the rail shows t.home.scenes[id].name). */
  name: string
  /** Horizontal focus (0 = left, 1 = right) for object-position on desktop / mobile. */
  focusX: number
  focusXMobile: number
  /** Colour-grading overlay: two gradient stops + blend mode. */
  grade: { a: string; b: string; blend: 'soft-light' | 'overlay' | 'color' }
  /** Nav text tone on top of this scene. */
  navTone: 'light' | 'dark'
  audio: 'wind' | 'water' | 'forest'
  layers: LayerDef[]
  copy: CopyDef
}

export interface BridgeDef {
  id: string
  from: SceneId
  to: SceneId
  /** Art key (src-art/scenes/<key>.svg); same 2560 × 2304 canvas, opaque band centred on y = 1152. */
  src: string
}

/* ------------------------------------------------------------------ live layer geometry (canvas coords) */

export const WATERFALLS: Record<'tranquility' | 'biodiversity', CanvasRect> = {
  tranquility: { x: 360, y: 300, w: 260, h: 1380 },
  biodiversity: { x: 1930, y: 380, w: 210, h: 1180 },
}

export const GODRAYS: Record<'tranquility' | 'biodiversity', { x: number; y: number; angle: number; length: number; count: number; color: string }> = {
  tranquility: { x: 760, y: 360, angle: 28, length: 1900, count: 5, color: '#bfe3ff' },
  biodiversity: { x: 1500, y: 320, angle: 18, length: 1700, count: 4, color: '#ffe6b8' },
}

/* ------------------------------------------------------------------ scenes */

// `src` is an art key: the source lives in src-art/scenes/<key>.svg and tools/build-layers.mjs turns it
// into trimmed AVIF/WebP variants listed in src/lib/layers.generated.json.
const h = (f: string) => `hero/${f}`
const t = (f: string) => `tranquility/${f}`
const b = (f: string) => `biodiversity/${f}`

export const SCENES: SceneDef[] = [
  {
    id: 'hero',
    index: 0,
    name: 'Jelajah',
    focusX: 0.7,
    focusXMobile: 0.81,
    grade: { a: '#ff9d6b', b: '#6a3fa0', blend: 'soft-light' },
    navTone: 'light',
    audio: 'wind',
    layers: [
      { id: 'sky', src: h('sky'), depth: 0 },
      // sun-glow (screen blend) is baked into the sky at build time — no runtime mix-blend-mode
      { id: 'clouds-back', src: h('clouds-back'), depth: 0.12 },
      { id: 'mountain', src: h('mountain'), depth: 0.22 },
      { id: 'clouds-front', src: h('clouds-front'), depth: 0.32 },
      { id: 'birds', slot: 'hero-birds', space: 'box', depth: 0.38 },
      { id: 'hills', src: h('hills'), depth: 0.46 },
      { id: 'lake', src: h('lake'), depth: 0.56 },
      { id: 'rocks', src: h('rocks'), depth: 0.64 },
      { id: 'grass-back', src: h('grass-back'), depth: 0.74, wind: true },
      { id: 'traveler', src: h('traveler'), depth: 0.84 },
      { id: 'scarf', src: h('scarf'), depth: 0.84, sway: { x: 1852, y: 1404, amp: 5 } },
      { id: 'grass-front', src: h('grass-front'), depth: 1, wind: true, dof: true },
    ],
    copy: {
      cta: { kind: 'start' },
      align: 'left',
      heading: 'h1',
      eyebrowIcon: true,
    },
  },
  {
    id: 'tranquility',
    index: 1,
    name: 'Ketenangan',
    focusX: 0.38,
    focusXMobile: 0.3,
    grade: { a: '#4fd1ff', b: '#2a2580', blend: 'soft-light' },
    navTone: 'light',
    audio: 'water',
    layers: [
      { id: 'backdrop', src: t('backdrop'), depth: 0 },
      { id: 'cave-far', src: t('cave-far'), depth: 0.14 },
      { id: 'godrays', slot: 'tranquility-godrays', space: 'frame', depth: 0.2 },
      { id: 'waterfall-fallback', src: t('waterfall'), depth: 0.3 },
      { id: 'waterfall', slot: 'tranquility-waterfall', space: 'frame', depth: 0.3 },
      { id: 'cave-mid', src: t('cave-mid'), depth: 0.4 },
      { id: 'bats', slot: 'tranquility-bats', space: 'box', depth: 0.46 },
      { id: 'plants-back', src: t('plants-back'), depth: 0.54, wind: true },
      { id: 'pond', src: t('pond'), depth: 0.62 },
      { id: 'elder', src: t('elder'), depth: 0.72 },
      { id: 'elder-rod', src: t('elder-rod'), depth: 0.72, sway: { x: 831, y: 1286, amp: 1.5 } },
      { id: 'turtle', src: t('turtle'), depth: 0.8 },
      { id: 'turtle-head', src: t('turtle-head'), depth: 0.8, sway: { x: 1160, y: 1682, amp: 3 } },
      { id: 'plants-front', src: t('plants-front'), depth: 1, wind: true, dof: true },
    ],
    copy: {
      cta: { kind: 'more', href: '/proses' },
      align: 'right',
      heading: 'h2',
    },
  },
  {
    id: 'biodiversity',
    index: 2,
    name: 'Biodiversitas',
    focusX: 0.6,
    focusXMobile: 0.66,
    grade: { a: '#3fe0c0', b: '#5b2c9a', blend: 'soft-light' },
    navTone: 'light',
    audio: 'forest',
    layers: [
      { id: 'backdrop', src: b('backdrop'), depth: 0 },
      { id: 'forest-far', src: b('forest-far'), depth: 0.14 },
      { id: 'godrays', slot: 'biodiversity-godrays', space: 'frame', depth: 0.2 },
      { id: 'waterfall-fallback', src: b('waterfall'), depth: 0.3 },
      { id: 'waterfall', slot: 'biodiversity-waterfall', space: 'frame', depth: 0.3 },
      { id: 'forest-mid', src: b('forest-mid'), depth: 0.4 },
      { id: 'birds', slot: 'biodiversity-birds', space: 'box', depth: 0.46 },
      { id: 'river', src: b('river'), depth: 0.56 },
      { id: 'flowers-back', src: b('flowers-back'), depth: 0.66, wind: true },
      { id: 'deer-rest', src: b('deer-rest'), depth: 0.78, pose: { group: 'deer', index: 0 } },
      { id: 'deer-alert', src: b('deer-alert'), depth: 0.78, pose: { group: 'deer', index: 1 } },
      { id: 'deer-ear', src: b('deer-ear'), depth: 0.78, pose: { group: 'deer', index: 2 } },
      { id: 'flowers-front', src: b('flowers-front'), depth: 1, wind: true, dof: true },
    ],
    copy: {
      cta: { kind: 'more', href: '#integrasi' },
      align: 'left',
      heading: 'h2',
    },
  },
]

export const BRIDGES: BridgeDef[] = [
  { id: 'hero-tranquility', from: 'hero', to: 'tranquility', src: 'bridges/hero-tranquility' },
  { id: 'tranquility-biodiversity', from: 'tranquility', to: 'biodiversity', src: 'bridges/tranquility-biodiversity' },
]

/* ------------------------------------------------------------------ preloading */

/** Art keys of every image layer of a scene. */
export function sceneArtKeys(id: SceneId): string[] {
  const s = SCENES.find((x) => x.id === id)
  return s ? s.layers.flatMap((l) => (l.src ? [l.src] : [])) : []
}

/** Wait until a DOM <img> has loaded and is decoded (never rejects). */
function ready(img: HTMLImageElement): Promise<void> {
  const decode = () => img.decode().catch(() => undefined)
  if (img.complete && img.naturalWidth > 0) return decode()
  return new Promise<void>((resolve) => {
    const finish = () => {
      img.removeEventListener('load', finish)
      img.removeEventListener('error', finish)
      void decode().then(() => resolve())
    }
    img.addEventListener('load', finish)
    img.addEventListener('error', finish) // a missing layer must never block the experience
  })
}

const imgsFor = (keys: string[]): HTMLImageElement[] =>
  keys.flatMap((k) => Array.from(document.querySelectorAll<HTMLImageElement>(`img[data-art="${k}"]`)))

/**
 * Preload with real progress: waits for the DOM layer images of the given art keys to load AND
 * decode (the browser has already picked the right AVIF/WebP variant via srcset/sizes).
 */
export async function preloadAssets(onProgress: (fraction: number) => void, critical: string[] = criticalUrls()): Promise<void> {
  const imgs = imgsFor(critical)
  let done = 0
  const total = Math.max(1, imgs.length)
  onProgress(0)
  await Promise.all(
    imgs.map((img) =>
      ready(img).then(() => {
        done += 1
        onProgress(done / total)
      }),
    ),
  )
}

const warmed = new Map<SceneId, Promise<void>>()
/** Load + decode a scene's layers (and the bridge leading into it) ahead of its transition. */
export function warmScene(id: SceneId): Promise<void> {
  let p = warmed.get(id)
  if (!p) {
    const bridge = BRIDGES.find((br) => br.to === id)
    p = Promise.all(imgsFor([...sceneArtKeys(id), ...(bridge ? [bridge.src] : [])]).map(ready)).then(() => undefined)
    warmed.set(id, p)
  }
  return p
}

/** Slot renderers are injected by App; kept here only for typing convenience. */
export type SlotRenderers = Partial<Record<SlotId, ReactNode>>

/** Art keys the preloader waits for: the hero plus the first bridge. Everything else is warmed lazily. */
export function criticalUrls(): string[] {
  const first = BRIDGES[0]
  return [...sceneArtKeys('hero'), ...(first ? [first.src] : [])]
}
