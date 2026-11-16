# GAMADA — module contracts (for parallel contributors)

Project: Vite + React 19 + TS strict + GSAP 3.15 (ScrollTrigger, SplitText, CustomEase) + Lenis + OGL + Tailwind v4.
Dev server is ALREADY running at http://127.0.0.1:5173/ (do not start/stop it, do not run `npm install`).

## Ground rules
- Only edit the files you own (listed in your brief). Everything else is read-only for you.
- All timings / eases / counts come from `src/lib/motion.ts` (`DUR`, `EASE`, `CAMERA`, `WIND`, `PARTICLES`, `BIRDS`, `MAGNETIC`, `REVEAL`…). If you need a new constant, define it at the top of YOUR file in a single `const` block and mention it in your report (the integrator will move it into motion.ts).
- Feature flags: `isEnabled('<flag>')` from motion.ts (already folds in prefers-reduced-motion and `?off=` overrides).
- One RAF loop: use `gsap.ticker.add(fn)` / `remove` — never your own `requestAnimationFrame` loop.
- Hot shared state: `motionState` in `src/lib/store.ts` (read every frame, no React re-render). Events: `on('scene'|'intro'|'sound'|'resize', fn)` returns an unsubscribe. `emit()` for 'sound' only (audio owner).
- Cleanup everything on unmount (ticker callbacks, listeners, WebGL contexts, gsap.context().revert()).
- TypeScript strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`). Check with `npx tsc --noEmit` and fix errors in YOUR files (ignore errors in files you don't own — others are mid-edit).
- Decorative output gets `aria-hidden="true"`; no console errors.
- Styles: Tailwind utilities and/or your own CSS file in `src/styles/<yours>.css`, imported from your component. Do not edit `src/index.css`. Z-index tokens live in `src/styles/tokens.css` (`--z-curtain`, `--z-particles`, `--z-rail`, `--z-nav`, `--z-cursor`, `--z-preloader`).

## Coordinate systems
- Layer canvas: **2560 × 2304** = 16:9 frame (2560×1440) + 30 % bleed top and bottom (432 px each). Frame is y ∈ [432, 1872].
- Layer box in the DOM: 106 % viewport width (3 % overscan each side) × 160 % viewport height, top −30 %. Images are `object-fit: cover; object-position: focusX 50%`.
- `FrameSpace` (src/components/FrameSpace.tsx) gives children a 2560×2304 div already scaled/offset onto the image mapping; `useFrameMapping()` (src/lib/frameContext.ts) returns `{ s, ox, oy }` (canvas px → box px scale/offset) for crisp canvas sizing.
- Slots with `space: 'box'` get a plain full-layer box (`.slot-box`, i.e. 106 % × 160 % of the viewport, starting 30 % above it).

## Scene system (owned by the integrator)
`App.tsx` → `.track` (tall) → `.stage` (sticky 100vh) → three `.scene` stacks + `.bridge` per transition + `.seam-mist` + `<CurtainGL/>` + `<Particles/>` + `.grade` + `.copy-scrim` + `.copy-layer` (SceneCopy ×3) + `<ProgressRail/>`.
Master timeline (`src/timelines/masterTimeline.ts`) writes: `motionState.progress` (0..2 continuous), `progressNorm` (0..1), `transition` (0 resting … 1 mid-transition), `seamY` (viewport fraction of the seam; outside [0,1] when none), `visible[sceneId]`, `activeScene` + emits 'scene'; sets `html[data-scene]`.
Intro (`src/timelines/intro.ts`) calls `navIntro()` from Navbar and emits 'intro' (possibly twice — treat only the first).
`src/lib/navigation.ts`: `scrollToScene(index, duration?)`.
`src/lib/smoothScroll.ts`: `getLenis()` (may be null when smooth scroll is off).
`src/lib/perf.ts`: `getPerfTier(): 'high'|'mid'|'low'`, `hasWebGL()`, `onDegrade(fn(level: 0..4))`, `getDegradeLevel()` (1 DOF off · 2 particles 50 % · 3 birds off · 4 waterfall static), plus the legacy `onLowFps(fn)` / `isDegraded()` (= level ≥ 1).
`src/lib/layers.ts` + `src/components/LayerArt.tsx`: trimmed raster layers from `layers.generated.json` (built by `tools/build-layers.mjs` from `src-art/`), placed via `--s/--ox/--oy` set by `useCoverVars`.

## Component contracts
| File | Export | Mounted where |
|---|---|---|
| components/Navbar.tsx | `default Navbar()`, `navIntro(): gsap.core.Timeline` (NOT paused; animates nav items in) | App, fixed |
| components/StartButton.tsx | `default StartButton({label})` → `scrollToScene(1)` | inside hero SceneCopy CTA |
| components/LearnMore.tsx | `default LearnMore({label, href})` | other SceneCopy CTAs |
| components/ProgressRail.tsx | `default ProgressRail()` | inside `.stage` |
| components/Cursor.tsx | `default Cursor()` | App |
| components/Preloader.tsx | `default Preloader({onDone})` – preload `criticalUrls()` with real progress via `preloadAssets()` | App |
| components/SoundToggle.tsx | `default SoundToggle()` using `audio` from lib/audio.ts | App |
| components/WaterfallGL.tsx | `default WaterfallGL({sceneId, rect: CanvasRect})` | FrameSpace slot (canvas coords) |
| components/Particles.tsx | `default Particles()` | `.stage`, full-screen overlay |
| components/CurtainGL.tsx | `default CurtainGL()` | `.stage`, full-screen overlay |
| components/Birds.tsx | `default Birds({mode: 'cranes'|'bats'|'songbirds', sceneId})` | box slot |
| components/GodRays.tsx | `default GodRays({sceneId: 'tranquility'|'biodiversity'})` uses `GODRAYS[sceneId]` | FrameSpace slot |
| lib/audio.ts | `export const audio = { enable(): Promise<void>; disable(): void; isOn(): boolean; toggle(): Promise<void> }` | — |
