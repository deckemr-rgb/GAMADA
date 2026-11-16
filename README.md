# GAMADA — Taman Alam

An illustrated, scroll-driven landing page in three scenes: **Jelajah** (hero), **Ketenangan** and **Biodiversitas**. The transitions are designed to feel like a camera descending through one continuous vertical landscape. The illustrations are original layered SVG sources (`src-art/`). A build step turns them into trimmed AVIF/WebP layers (`public/scenes/`). Performance and size numbers are in [docs/PERF.md](docs/PERF.md), and the art specification is in [ASSETS.md](ASSETS.md).

Stack: Vite · React 19 · TypeScript (strict) · GSAP 3.15 (ScrollTrigger, SplitText, CustomEase) · Lenis · OGL · Tailwind CSS v4 · @fontsource (Fraunces + Manrope).

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://127.0.0.1:4173
npm run art        # svgo the SVG sources + rasterise them to trimmed AVIF/WebP (≈3 min)
npm run perf       # frame-time harness against the preview build (CPU 4× throttle)
```

Useful query strings:

| Query | Effect |
|---|---|
| `?off=particles,birds` | turn individual flags off (names below) |
| `?motion=reduced` / `?motion=full` | force reduced-motion on/off |
| `?tier=low\|mid\|high` | force the performance tier (WebGL/particle budget) |
| `?degrade=1..4` | force a perf degradation level (1 DOF off · 2 particles 50 % · 3 birds off · 4 waterfall shader off) |
| `?debug=fps` | HUD with p50/p95 frame time and long frames; enables the ticker probe used by `tools/perf.mjs` |

Dev tools:
- `tools/preview.html?scene=hero` stacks one scene's layers without the app. Add `&solo=mountain`, `&only=sky,mountain`, `&rects=1`, or `&to=tranquility&seam=0.5` to preview a transition frame.
- `node tools/shot.mjs <url> <out.png> <w> <h> <mobile 0|1> [scrollY] [fullPage] [waitMs] [evalJs]` takes a headless Chrome screenshot via CDP and prints console errors. It deletes its temporary Chrome profile when it finishes.
- `node tools/perf.mjs [url] [cpuThrottle] [w] [h] [dpr] [label]` drives the page with real wheel input on the hardware GPU and prints a p50/p95/long-frame table. Add `TRACE=1` (long-task breakdown), `PROFILE=1` (JS self time) or `TICKS=1` (slow ticker callbacks).
- `tools/build-layers.mjs` and `tools/optimize-svg.mjs` form the art pipeline (see `npm run art`).

## How it works

```
.track (tall, sets the scroll length)
└─ .stage (position: sticky; 100vh)
   ├─ .scene ×3 ─ .scene-clip ─ .scene-inner ─ .layer[data-depth] ─ .layer-pointer ─ .layer-wind ─ <LayerArt> | slot
   ├─ .bridge ×2         connective band (cliff lip, waterfall, mist) that rides the seam
   ├─ .seam-mist         thickens at the seam
   ├─ CurtainGL          WebGL water curtain on the seam (velocity-driven)
   ├─ Particles          GPU instanced dust / fireflies
   ├─ .grade ×3          per-scene colour grading (static gradients, opacity cross-fade)
   ├─ .copy-layer        SceneCopy ×3 (SplitText reveals)
   └─ ProgressRail
```

Each wrapper level is owned by exactly one system, so transforms never fight:

| Element | Owner | What it animates |
|---|---|---|
| `.scene-clip` / `.scene-inner` | `timelines/masterTimeline.ts` | seam clipping with transforms only (compositor-friendly) |
| `.layer` | master timeline + `ambient.ts` (DOF) | scroll parallax `yPercent = k(depth)·travel`, dolly zoom, blur |
| `.layer-pointer` | `timelines/pointer.ts` | mouse / gyro parallax (`quickTo`) |
| `.layer-wind` | `timelines/ambient.ts` | wind skew, scarf sway, deer pose cross-fades |
| `img` / slot children | `timelines/intro.ts` | intro choreography |

The **master timeline** is a single GSAP timeline with the labels `scene-0..2`. One ScrollTrigger maps the scroll position (including a short tail hold) onto it, smoothed by a `quickTo` playhead. Snapping goes through Lenis on `scrollEnd`, so it never fights the smooth scroll. Every tween is `fromTo` with `immediateRender: false`, which makes scrolling back up exact.

One RAF loop: Lenis, the timeline, WebGL, boids, wind and the cursor all run on `gsap.ticker`.

## Adding a scene

1. Paint the layers on the shared canvas (**2560 × 2304**: a 16:9 frame plus 30 % bleed top and bottom, see `ASSETS.md`). Put the SVG sources in `src-art/scenes/<id>/` and run `npm run art`.
2. Add a `SceneDef` to `SCENES` in `src/lib/assets.ts`. It needs the layers (each with a `depth` from 0 to 1, plus optional `wind`, `sway`, `dof`, `pose`, `blend`), `focusX` / `focusXMobile`, `grade`, `navTone`, `audio` and the copy (`eyebrow`, `title`, `body`, `cta`, `align`, `heading`).
3. Add a `BridgeDef` from the previous scene, with its band centred on y = 1152. Layer `src` values are art keys like `hero/sky`.
4. If you need live layers, add a `SlotId`, a layer `{ slot, space: 'frame' | 'box' }`, and its renderer in the `slots` map in `App.tsx`.

The master timeline, progress rail, snapping, audio mix and grading adapt to the new count automatically. No other code changes are needed. Each image layer is trimmed to its alpha bbox at build time and placed at runtime through the scene's `--s/--ox/--oy` cover mapping (`useCoverVars` + `LayerArt`).

## Animation flags (`src/lib/motion.ts → FLAGS`)

| Flag | Section | What it controls |
|---|---|---|
| `smoothScroll` | — | Lenis smooth scrolling |
| `pointerParallax` | 4.1 | mouse parallax per depth (`quickTo`, power3.out) |
| `gyroParallax` | 4.1 | DeviceOrientation parallax on touch devices (iOS asks permission on first tap) |
| `dollyZoom` | 4.1 | far layers ×1.06, near layers ×1.18 while transitioning |
| `depthOfField` | 4.1 | foreground blur at high scroll velocity: a pre-blurred twin cross-faded by opacity, high tier only |
| `displacementTransition` | 4.2 | WebGL water curtain on the seam |
| `colorGrading` | 4.2 | warm → cold → humid grade (per-scene gradients cross-faded by opacity, no blend modes) |
| `transitionMist` | 4.2 | mist that peaks on the seam |
| `snap` | 4.2 | soft snap to the nearest scene label |
| `birds`, `boidsCursorAvoid` | 4.3 | crane / bat / songbird flocks (boids, sprite frames) and cursor avoidance |
| `waterfallShader` | 4.3 | animated waterfalls (static SVG fallback underneath) |
| `godRays` | 4.3 | breathing light shafts |
| `particles` | 4.3 | GPU dust / fireflies (300 desktop · 80 mobile · 40 low tier) |
| `wind` | 4.3 | grass skew + scarf sway, boosted by scroll velocity |
| `deerPoses` | 4.3 | deer head / ear pose cross-fades |
| `splitTextReveal` | 4.4 | per-character / per-line masked reveals |
| `magneticButton` | 4.4 | magnetic "Mulai perjalanan" button |
| `customCursor` | 4.4 | blend-mode cursor (desktop only) |
| `progressRail` | 4.4 | 01 / 03 rail on the right |
| `preloader` | 4.5 | preloader with real progress + intro (≤ 2.5 s, skippable) |
| `audio` | 4.6 | sound toggle (synthesised Web Audio ambience; sound is always OFF by default) |

All timings, eases, distances and counts live in `motion.ts` (`DUR`, `EASE`, `SCROLL`, `SNAP`, `CAMERA`, `TIMELINE`, `WIND`, `DOF`, `REVEAL`, `MAGNETIC`, `PARTICLES`, `BIRDS`).

## Accessibility and performance

- `prefers-reduced-motion` turns off smooth scroll, parallax, shaders, particles, flocks and split reveals. Scenes then switch with a 0.4 s cross-fade.
- Headings are semantic (`h1` for the hero, `h2` per scene), illustrations use `alt=""` / `aria-hidden`, focus rings are visible, and a skip link goes to the visit information.
- Only `transform` and `opacity` animate. Layers of **live** scenes (the active one plus the next one in the scroll direction) are permanently composited, and the rest are `content-visibility: hidden`. The next scene's images are loaded and `decode()`d while you rest. WebGL and flocks pause when they are not visible or the tab is hidden.
- The performance tier comes from cores, memory, viewport and WebGL support. A frame sampler on `gsap.ticker` (stopped after 20 s) degrades in stages through `onDegrade()`: 1 DOF off → 2 particles 50 % → 3 birds off → 4 waterfall shader off.
- Measurements: see [docs/PERF.md](docs/PERF.md).
