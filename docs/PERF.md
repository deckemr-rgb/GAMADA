# GAMADA — performance and size report

Measured with `tools/perf.mjs`. The harness runs headless Chrome with **hardware GPU** (ANGLE / D3D11, RTX 4060 Laptop), uses **real wheel input** (so Lenis, ScrollTrigger and snap behave as they do for a user), and reads the `?debug=fps` HUD (`window.__fps`).
Viewport 1440×900 at DPR 1.25 unless noted. Scenarios: idle on the hero (4 s) · scroll hero→tranquility · tranquility→biodiversity · back to the hero.
Raw outputs are in `docs/perf/*.txt`. Run it yourself with `npm run build && npm run preview`, then `npm run perf`. Change the CPU-throttle argument to 1, 2 or 4.

> CPU throttling has a big effect on the result. **CPU 1×** is this machine (a fast laptop CPU). **CPU 2×** is used as the "mid-range laptop" proxy. **CPU 4×** (the DevTools preset named in the brief) is closer to a low-end machine. Throttled runs are noisy: the same build varies by about ±25 % in p50/p95 between runs, so each number below is one run, cross-checked against at least one repeat.

## Before / after

### CPU 1× (this machine)

| scenario | before p50 / p95 / max (ms) | before frames >50 ms | after p50 / p95 / max (ms) | after frames >50 ms |
|---|---|---|---|---|
| idle hero | 82.8 / 110.3 / 113.6 (12 fps) | 47 | **7.0 / 7.2 / 7.7 (144 fps)** | **0** |
| hero → tranquility | 61.6 / 107.0 / 570.6 | 186 | **6.9 / 8.0 / 77.8** | 2 |
| tranquility → biodiversity | 40.7 / 67.1 / 162.8 | 77 | **7.0 / 8.6 / 41.6** | **0** |
| back to hero | 43.3 / 82.3 / 368.2 | 125 | **7.0 / 8.2 / 59.3** | 2 |

### CPU 2× ("mid-range laptop" proxy)

| scenario | after p50 / p95 / max (ms) | frames >50 ms | 1920×1080 p95 / max | 1024×768 p95 / max |
|---|---|---|---|---|
| idle hero | 6.9 / 8.3 / 16.5 (143 fps) | 0 | 8.5 / 14.4 | 8.7 / 14.2 |
| hero → tranquility | 9.7 / **17.0** / 68.2 | 2 | 20.5 / 96.1 | 21.0 / 93.7 |
| tranquility → biodiversity | 13.7 / 22.3 / 32.4 | **0** | 21.5 / 34.8 | 16.6 / 25.7 |
| back to hero | 13.6 / 20.9 / 111.9 | 2 | 20.5 / 78.2 | 13.7 / 24.8 |

### CPU 4× (DevTools preset)

| scenario | before p50 / p95 / max (ms) | before >50 ms | after p50 / p95 / max (ms) | after >50 ms |
|---|---|---|---|---|
| idle hero | 77 / 122 / 194 (12 fps) | 47 | 8.1 / 15.3 / 34.9 (107 fps) | 0 |
| hero → tranquility | 121.8 / 276.8 / 592.6 (7 fps) | 193 | 20.5 / 47.1 / 108.6 (40 fps) | 14 |
| tranquility → biodiversity | 96.5 / 249.7 / 552.5 | 172 | 16.9 / 35.9 / 51.3 | 1 |
| back to hero | 61.6 / 120.8 / 343.6 | 243 | 18.4 / 34.9 / 107.7 | 5 |

### Pass criteria (brief, section A)

| criterion | result |
|---|---|
| p95 < 20 ms while scrolling, mid-range laptop at DPR 1.25, 1024–1920 px | **Met at CPU 1×** (8–9 ms). **At the edge at CPU 2×**: 14–22 ms, about half the scenarios under 20 ms. **Not met at CPU 4×** (35–47 ms). |
| no frame > 50 ms when changing scene | **Met for tranquility → biodiversity** at every throttle level. **Not fully met for the transitions into and out of the hero:** 1–3 frames of 60–110 ms per crossing at CPU 1–2×. See "Remaining spikes". |
| GPU memory down | Yes. About 32 full-canvas SVG surfaces (each covering the whole layer box, 1.06 vw × 1.6 vh) became trimmed bitmaps. Bird canvases dropped from about 41 MB to about 14 MB, particle and curtain canvases are viewport-sized, DPR is capped at 1.25 (high) / 1 (mid, low), and hidden canvases do no work. |

## What changed, one step at a time (each step measured)

| step | change | measured effect |
|---|---|---|
| A1 | `?debug=fps` HUD (p50/p95/long frames, on the GSAP ticker) and `tools/perf.mjs` (wheel input, CPU throttle, trace/profile modes `TRACE=1`, `PROFILE=1`, `TICKS=1`) | Baseline above. The diagnosis isolated **wind** as the idle killer: `?off=wind` alone took idle from 12 to 131 fps. |
| A3 + A5 | Permanent compositing (`will-change: transform`) for the layers and wind/sway wrappers of **live** scenes (active + next); non-live scenes get `content-visibility: hidden`; `gsap.config({ force3D: true })`; wind and sway use `gsap.quickSetter` with a 0.02° change threshold; pointer parallax skips hidden scenes. The `.is-moving` will-change toggle is gone. | CPU 1×: idle 12 → **144 fps**, scroll p95 107 → **8 ms**. CPU 4×: idle 12 → 114 fps, scroll p95 277 → 36 ms. Before this, every frame re-rasterised a 2560-px SVG on the main thread. |
| A2 | `tools/build-layers.mjs` (sharp/librsvg) renders every SVG and trims it to its alpha bounding box, then writes AVIF + WebP at 1280 / 1920 / 2560 canvas widths into `src/lib/layers.generated.json`. `<LayerArt>` places each bitmap at its bbox through CSS variables `--s/--ox/--oy` (the same cover mapping as `computeFrame`) using `<picture>`, `srcset` and `sizes`; phones are pinned to the 1280 variant. | Transition hitches went from 213–765 ms to under 90 ms. No SVG is rasterised at runtime. |
| A4 | DOF uses a pre-blurred `*-blur` twin baked at build time and cross-faded with opacity, instead of animating `filter: blur()`. High tier only; it is the first thing to go at degrade level 1. | Only transform and opacity are animated now. |
| A6 | `sun-glow` (screen blend) is baked into the sky at build time. The `.grade` soft-light overlay over the whole stage became one static gradient per scene, cross-faded by opacity with no blend mode. The navbar `backdrop-filter` became a solid semi-opaque background, and the rail and start button have no backdrop-filter. | No blend modes or backdrop filters remain over moving content (the cursor's `difference` blend is a 10 px element). |
| A7 | Particle and curtain canvases are viewport-sized. DPR is capped at 1.25 / 1. Bird canvases are cropped to their flight band, with counts ×0.6 on mid tier and ×0.4 on low. Hidden-scene canvases do no work. **Staged degradation** (`onDegrade`): 1 DOF off → 2 particles 50 % → 3 birds off → 4 waterfall shader off (static art stays). The sampler runs on `gsap.ticker` and stops after 20 s. The `hasWebGL` probe context is released. | Test: `?degrade=N` forces a level. In a 30 fps stress test, the levels stepped up one at a time at 8.4, 10.4, 12.5 and 14.5 s. |
| A8 | `warmScene()` waits for the scene's real DOM `<img>` elements (and the bridge leading into it) to load and `decode()`. It is called for the next scene as soon as a scene becomes active. The next scene stays "live" (painted and composited, clipped off-screen) while you rest. | No black or half-empty frames during transitions. |
| A9 | One RAF: everything runs on `gsap.ticker` (Lenis, timeline, WebGL, boids, wind, HUD). The perf sampler no longer has its own rAF. | — |

### Experiments that were reverted (no gain)
- **Keep both neighbour scenes live** so that scenes don't toggle `content-visibility`: the spikes stayed and p95 was slightly worse. Reverted.
- **Hide the hero→tranquility bridge** (to test whether its first decode or raster causes the spike): no change, so it is not the cause.

### Remaining spikes (honest status)
Crossing **into or out of the hero** still produces 1–3 frames of 60–110 ms at CPU 1–2×. Tranquility → biodiversity has none. Trace and probe findings:
- The long task is one `BeginMainFrame`: about 30 ms of rAF JavaScript plus about 18 ms of style, layout and layerize.
- No single ticker callback takes more than 8 ms (`TICKS=1`). The largest is Lenis `raf` at 8.4 ms, which also drives ScrollTrigger and the timeline render.
- Turning off birds, DOF, split-text reveals, particles, the curtain or the bridge does not remove the spike.

Next hypotheses to test:
1. Render cost of the GSAP root timeline when the hero copy's character tweens start (7 large 3D-masked glyph layers being created).
2. Layerization churn while hero layers change their compositing reasons at the start of the dolly.
3. Lenis `scrollTo` cost on the first wheel burst.

## Size (section B)

| | before | after |
|---|---|---|
| Scene art shipped to the browser | **2.6 MB of SVG**, loaded by every device | **AVIF**, one variant per layer: desktop 2560w **892 KB** (+38 KB DOF twins, high tier only) · laptop 1920w **791 KB** · mobile 1280w **397 KB** |
| WebP fallback (older browsers) | — | desktop 1393 KB · mobile 681 KB |
| SVG sources (`src-art/`, not shipped) | 2501 KB | **1351 KB** after svgo multipass (precision 1, mergePaths, removeUselessDefs, cleanupIds, reusePaths) plus duplicate-gradient merge (−46 %; pixel diff < 0.2/255 on average) |
| Character figures | 24–44 KB each, boxy | traveler 21 KB · scarf 13 KB · deer poses 21–23 KB · elder 14 KB · rod 4.5 KB · turtle 8 KB · turtle head 1.4 KB (all under 25 KB after svgo) |
| Fonts in bundle | 7 woff2 (latin, latin-ext, cyrillic, greek, vietnamese), about 154 KB | **3 woff2, latin only: 107 KB.** Fraunces normal and a **real italic** for the scene titles (previously synthetic), plus Manrope. |
| JS (gzip) | 168.7 KB | 175.0 KB (HUD/probe, LayerArt, staged degrade, a11y work) |
| `dist/` on disk | 3.3 MB | 6.0 MB. On-disk size grows because it holds 3 widths × 2 formats; the bytes a device actually downloads drop by 65–85 % (see the first row). |
| Preload | none | `<link rel=preload>` for the 2 latin fonts and the hero's 1920 AVIF layers (desktop media query) only. `cssMinify` is on, the module-preload polyfill is off. |

## How to re-measure
```bash
npm run art            # svgo + rasterise src-art → public/scenes (about 3 min)
npm run build && npm run preview
npm run perf           # CPU 4× · or: node tools/perf.mjs http://127.0.0.1:4173/ 2 1440 900 1.25 "label"
TRACE=1 node tools/perf.mjs …   # long-task breakdown
TICKS=1 node tools/perf.mjs …   # gsap.ticker callbacks > 8 ms
```
A/B any effect with `?off=<flag>`. Force a perf tier with `?tier=low|mid|high` and a degrade level with `?degrade=1..4`.
