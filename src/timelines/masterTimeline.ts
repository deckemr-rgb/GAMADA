/**
 * masterTimeline.ts — ONE ScrollTrigger (sticky stage + scrub) that owns every
 * scene transition. Timeline units: label `scene-i` sits at i * TIMELINE.segment.
 *
 * For a transition i → i+1 with local progress p (0..1):
 *   seam      y_b(p) = lerp(seamFrom, seamTo, ease(p))           viewport fraction
 *   outgoing  clip window ends at y_b, its layers rise by k(depth)·travel and dolly in
 *   incoming  clip window starts at y_b, its layers rise from +k·travel to 0
 *   bridge    centred on y_b (hides the seam), mist peaks at p = .5
 *   copy      outgoing copy leaves in [0, copyOutEnd], incoming arrives in [copyInStart, 1]
 * Everything is fromTo / scrub-safe, so scrolling back is exact.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SCENES, type SceneId } from '../lib/assets'
import {
  CAMERA,
  DUR,
  EASE,
  SCROLL,
  SNAP,
  TIMELINE,
  GRADE,
  clamp,
  depthToDolly,
  depthToSpeed,
  isEnabled,
  lerp,
  prefersReducedMotion,
} from '../lib/motion'
import { emit, motionState } from '../lib/store'
import { registerScenePositions } from '../lib/navigation'
import { getLenis, scrollToY } from '../lib/smoothScroll'
import { copyIn, copyOut, hideCopy, prepareCopy, revertCopy } from '../components/SceneCopy'
import { warmScene } from '../lib/assets'

gsap.registerPlugin(ScrollTrigger)

const LAYER_BOX_H = 1.6 // layer boxes are 160 % of the viewport height

interface Refs {
  track: HTMLElement
  stage: HTMLElement
}

const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel))

/** Seam position for a local transition progress p. */
function seamAt(p: number): number {
  const e = (EASE.camera as (t: number) => number)(clamp(p))
  return lerp(CAMERA.seamFrom, CAMERA.seamTo, e)
}

export function createMasterTimeline({ track, stage }: Refs): () => void {
  const reduced = prefersReducedMotion()
  const ctx = gsap.context(() => {
    const scenes = q(stage, '.scene')
    const copies = q(stage, '.scene-copy')
    const bridges = q(stage, '.bridge')
    const grades = q(stage, '.grade[data-grade]')
    const mist = stage.querySelector<HTMLElement>('.seam-mist')
    const N = scenes.length

    copies.forEach((c) => prepareCopy(c))
    copies.forEach((c, i) => {
      if (i > 0) hideCopy(c)
    })

    // ---------------- initial state
    scenes.forEach((s, i) => {
      delete s.dataset.live // a rebuild (language switch / width resize) must not inherit the previous build's culling cache
      const clip = s.querySelector<HTMLElement>('.scene-clip')
      const inner = s.querySelector<HTMLElement>('.scene-inner')
      if (!clip || !inner) return
      if (reduced) {
        gsap.set(s, { autoAlpha: i === 0 ? 1 : 0 })
        return
      }
      const y = i === 0 ? 0 : 100 // waiting below the viewport
      gsap.set(clip, { yPercent: y, force3D: true })
      gsap.set(inner, { yPercent: -y, force3D: true })
      gsap.set(s, { visibility: i === 0 ? 'visible' : 'hidden' })
      if (i > 0) {
        q(s, '.layer').forEach((l) => {
          const k = depthToSpeed(Number(l.dataset.depth ?? 0))
          gsap.set(l, { yPercent: (k * CAMERA.travel * 100) / LAYER_BOX_H, scale: isEnabled('dollyZoom') ? CAMERA.incomingScale : 1 })
        })
      }
    })
    bridges.forEach((b) => gsap.set(b, { yPercent: ((CAMERA.seamFrom - 0.5) * 100) / LAYER_BOX_H, visibility: 'hidden' }))
    if (mist) gsap.set(mist, { opacity: 0 })
    // colour grade: one static gradient per scene, cross-faded with opacity (no blend modes, no repaint)
    grades.forEach((g, i) => gsap.set(g, { opacity: i === 0 ? GRADE.opacity : 0 }))
    const setSceneAttr = (i: number) => {
      document.documentElement.dataset.scene = SCENES[i]?.id ?? 'hero'
    }
    setSceneAttr(0)

    const totalVh = (N - 1) * SCROLL.vhPerTransition + SCROLL.vhTailHold
    track.style.height = `${(1 + totalVh) * 100}vh`

    // ---------------- reduced motion: discrete cross-fades, no scrub
    if (reduced) {
      let current = 0
      const go = (to: number) => {
        if (to === current) return
        const from = current
        current = to
        const sFrom = scenes[from]
        const sTo = scenes[to]
        if (sFrom && sTo) {
          gsap.to(sFrom, { autoAlpha: 0, duration: DUR.reducedCrossfade })
          gsap.to(sTo, { autoAlpha: 1, duration: DUR.reducedCrossfade })
        }
        const cFrom = copies[from]
        const cTo = copies[to]
        if (cFrom) gsap.to(cFrom, { autoAlpha: 0, duration: DUR.reducedCrossfade })
        if (cTo) {
          gsap.set(cTo, { autoAlpha: 1 })
          copyIn(cTo, { reduced: true }).play()
        }
        motionState.activeScene = to
        setSceneAttr(to)
        grades.forEach((g, gi) => gsap.to(g, { opacity: gi === to ? GRADE.opacity : 0, duration: DUR.reducedCrossfade, overwrite: true }))
        motionState.visible = Object.fromEntries(SCENES.map((sd, si) => [sd.id, si === to])) as Record<SceneId, boolean>
        const nextDef = SCENES[to + 1]
        if (nextDef) void warmScene(nextDef.id)
        emit('scene')
      }
      ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const pos = self.progress * ((N - 1) + SCROLL.vhTailHold / SCROLL.vhPerTransition)
          motionState.progress = Math.min(N - 1, pos)
          motionState.progressNorm = self.progress
          go(Math.min(N - 1, Math.round(pos)))
        },
      })
      registerPositions(track, N)
      return
    }

    // ---------------- the master timeline
    const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true })
    const seg = TIMELINE.segment
    for (let i = 0; i < N; i++) tl.addLabel(`scene-${i}`, i * seg)

    for (let i = 0; i < N - 1; i++) {
      const at = i * seg
      const out = scenes[i]
      const inc = scenes[i + 1]
      if (!out || !inc) continue
      const outClip = out.querySelector('.scene-clip')
      const outInner = out.querySelector('.scene-inner')
      const incClip = inc.querySelector('.scene-clip')
      const incInner = inc.querySelector('.scene-inner')
      const bridge = bridges[i]
      const proxy = { p: 0 }

      // seam: one proxy drives both clip windows + the bridge so they never drift apart
      tl.fromTo(
        proxy,
        { p: 0 },
        {
          p: 1,
          duration: seg,
          immediateRender: false,
          onUpdate: () => {
            const yb = seamAt(proxy.p)
            // The seam travels from below the viewport to above it; clip windows must be clamped
            // to the viewport or a resting scene would lose a band at the top/bottom.
            const outEdge = Math.min(1, yb)
            const inEdge = Math.max(0, yb)
            if (outClip && outInner) {
              gsap.set(outClip, { yPercent: (outEdge - 1) * 100 })
              gsap.set(outInner, { yPercent: -(outEdge - 1) * 100 })
            }
            if (incClip && incInner) {
              gsap.set(incClip, { yPercent: inEdge * 100 })
              gsap.set(incInner, { yPercent: -inEdge * 100 })
            }
            if (bridge) gsap.set(bridge, { yPercent: ((yb - 0.5) * 100) / LAYER_BOX_H })
          },
        },
        at,
      )

      // outgoing layers: rise with depth speed + dolly
      q(out, '.layer').forEach((l) => {
        const d = Number(l.dataset.depth ?? 0)
        const k = depthToSpeed(d)
        tl.fromTo(
          l,
          { yPercent: 0, scale: 1 },
          {
            yPercent: (-k * CAMERA.travel * 100) / LAYER_BOX_H,
            scale: isEnabled('dollyZoom') ? depthToDolly(d) : 1,
            duration: seg,
            ease: EASE.camera,
            immediateRender: false,
          },
          at,
        )
      })
      // incoming layers: arrive from below with the same law
      q(inc, '.layer').forEach((l) => {
        const k = depthToSpeed(Number(l.dataset.depth ?? 0))
        tl.fromTo(
          l,
          { yPercent: (k * CAMERA.travel * 100) / LAYER_BOX_H, scale: isEnabled('dollyZoom') ? CAMERA.incomingScale : 1 },
          { yPercent: 0, scale: 1, duration: seg, ease: EASE.camera, immediateRender: false },
          at,
        )
      })

      // mist thickens on the seam
      if (mist && isEnabled('transitionMist')) {
        tl.fromTo(mist, { opacity: 0 }, { opacity: 1, duration: seg * TIMELINE.mistPeak, ease: 'sine.in', immediateRender: false }, at)
        tl.to(mist, { opacity: 0, duration: seg * (1 - TIMELINE.mistPeak), ease: 'sine.out' }, at + seg * TIMELINE.mistPeak)
      }

      // colour grade cross-fade
      const gOut = grades[i]
      const gIn = grades[i + 1]
      if (gOut && gIn) {
        tl.fromTo(gOut, { opacity: GRADE.opacity }, { opacity: 0, duration: seg, immediateRender: false }, at)
        tl.fromTo(gIn, { opacity: 0 }, { opacity: GRADE.opacity, duration: seg, immediateRender: false }, at)
      }

      // copy — child timelines are time-scaled to fit their window, whatever their own length
      const cOut = copies[i]
      const cIn = copies[i + 1]
      // (copy holds fully readable for a short dwell around every label)
      if (cOut) tl.add(fit(copyOut(cOut), seg * (TIMELINE.copyOutEnd - TIMELINE.copyOutStart)), at + seg * TIMELINE.copyOutStart)
      if (cIn) tl.add(fit(copyIn(cIn), seg * (TIMELINE.copyInEnd - TIMELINE.copyInStart)), at + seg * TIMELINE.copyInStart)
    }
    // make sure the timeline is exactly (N-1) segments long
    tl.set({}, {}, (N - 1) * seg)

    const labelsTime = Array.from({ length: N }, (_, i) => i * seg)
    const tailUnits = SCROLL.vhTailHold / SCROLL.vhPerTransition
    const totalUnits = (N - 1) * seg + tailUnits

    // Scroll progress → timeline progress. The tail hold maps beyond the last label, so we
    // drive the timeline ourselves (smoothed with quickTo) instead of `animation + scrub`.
    const playhead = { p: 0 }
    const toTimeline = (scrollProgress: number) => Math.min(1, (scrollProgress * totalUnits) / ((N - 1) * seg))
    const smooth = gsap.quickTo(playhead, 'p', {
      duration: SCROLL.scrub,
      ease: 'power3.out',
      onUpdate: () => {
        tl.progress(playhead.p)

      },
    })

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => smooth(toTimeline(self.progress)),
      onRefresh: () => registerPositions(track, N, totalUnits),
    })
    // start exactly where the page is (e.g. after a reload mid-page)
    playhead.p = toTimeline(st.progress)
    tl.progress(playhead.p)

    // Soft snap to the nearest scene label once the user stops scrolling (Lenis-friendly).
    const onScrollEnd = () => {
      if (!isEnabled('snap') || st.progress <= 0 || st.progress >= 1) return
      const units = st.progress * totalUnits
      if (units > (N - 1) * seg) return // free scrolling inside the tail hold
      let best = labelsTime[0] ?? 0
      for (const t of labelsTime) if (Math.abs(t - units) < Math.abs(best - units)) best = t
      if (Math.abs(best - units) < 0.004) return
      const y = st.start + (best / totalUnits) * (st.end - st.start)
      const dist = Math.abs(best - units) / seg
      const duration = lerp(SNAP.durationMin, SNAP.durationMax, clamp(dist * 2))
      const y0 = window.scrollY
      window.setTimeout(() => {
        // snap only if nothing moved since scrollEnd (stale velocity is unreliable in native mode)
        if (Math.abs(window.scrollY - y0) < 1 && !getLenis()?.isScrolling) scrollToY(y, duration, gsap.parseEase(EASE.snap))
      }, SNAP.delay * 1000)
    }
    ScrollTrigger.addEventListener('scrollEnd', onScrollEnd)
    // is the sticky stage (inside the track) on screen at all? scene effects pause once it scrolls away
    const vst = ScrollTrigger.create({ trigger: track, start: 'top bottom', end: 'bottom top' })

    // per-frame derived state for effects
    let lastActive = -1
    const visKeys = SCENES.map((s) => s.id)
    const tick = () => {
      const time = tl.progress() * (N - 1) * seg
      motionState.progress = time / seg
      motionState.progressNorm = st.progress
      const i = Math.min(N - 2, Math.floor(motionState.progress))
      const local = clamp(motionState.progress - Math.max(0, i))
      motionState.transition = local > 0 && local < 1 ? 1 - Math.abs(local * 2 - 1) : 0
      motionState.seamY = local > 0 && local < 1 ? seamAt(local) : 2
      const moving = local > 0 && local < 1
      // the "active" scene flips when the seam crosses mid-screen, not at p = .5 of the scroll
      const active = moving ? (seamAt(local) < 0.5 ? i + 1 : i) : Math.round(motionState.progress)
      // truly visible scenes (effects pause when false)
      const vis = Object.fromEntries(visKeys.map((id) => [id, false])) as Record<SceneId, boolean>
      visKeys.forEach((id, idx) => {
        const yb = motionState.seamY
        const asOut = idx === i && moving && yb > 0
        const asIn = idx === i + 1 && moving && yb < 1
        vis[id] = vst.isActive && ((!moving && idx === Math.round(motionState.progress)) || asOut || asIn)
      })
      // "live" scenes stay painted + composited: the visible ones plus the next one in scroll direction,
      // so the incoming scene is already rasterised (its clip window keeps it off-screen) when the seam arrives.
      const dir = motionState.velocity < -0.5 ? -1 : 1
      const rest = Math.round(motionState.progress)
      scenes.forEach((s, idx) => {
        const id = visKeys[idx]
        if (!id) return
        const live = vis[id] || idx === rest || idx === rest + dir || (moving && (idx === i || idx === i + 1))
        if (s.dataset.live !== String(live)) {
          s.dataset.live = String(live)
          s.style.visibility = live ? 'visible' : 'hidden'
        }
      })
      bridges.forEach((b, idx) => {
        const v = idx === i && moving
        b.style.visibility = v ? 'visible' : 'hidden'
      })
      motionState.visible = vis
      if (active !== lastActive) {
        lastActive = active
        motionState.activeScene = active
        setSceneAttr(active)
        // load + decode the scene after the active one while we rest, so its first frame is instant
        const next = SCENES[active + 1]
        if (next) void warmScene(next.id)
        emit('scene')
      }
      stage.classList.toggle('is-moving', moving)
    }
    gsap.ticker.add(tick)
    registerPositions(track, N, totalUnits)

    return () => {
      gsap.ticker.remove(tick)
      vst.kill()
      ScrollTrigger.removeEventListener('scrollEnd', onScrollEnd)
    }
  }, stage)

  return () => {
    ctx.revert()
    q(stage, '.scene').forEach((s) => {
      delete s.dataset.live
      s.style.visibility = ''
    })
    // undo SplitText so a rebuild (resize / orientation change) re-splits with fresh line breaks
    q(stage, '.scene-copy').forEach((c) => revertCopy(c))
  }
}

/** Store absolute scroll positions for every scene label (used by scrollToScene). */
function registerPositions(track: HTMLElement, n: number, totalUnits?: number): void {
  const top = track.getBoundingClientRect().top + window.scrollY
  const scrollable = track.offsetHeight - window.innerHeight
  const units = totalUnits ?? n - 1
  registerScenePositions(Array.from({ length: n }, (_, i) => top + (scrollable * i) / units))
}

/** Time-scale a child timeline so it lasts exactly `units` inside the parent. */
function fit(child: gsap.core.Timeline, units: number): gsap.core.Timeline {
  const d = child.duration()
  if (d > 0 && units > 0) child.timeScale(d / units)
  return child
}

