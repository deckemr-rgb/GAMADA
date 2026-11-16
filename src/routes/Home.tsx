/**
 * Home — the three illustrated scenes (the original App, unchanged in behaviour): pinned stage,
 * master timeline, pointer + ambient controllers, preloader + intro, sound toggle and scene rail.
 * Lenis lives in RootLayout (all pages); this route only builds the scene system.
 *
 * The preloader runs only when the home is the first page of the visit. Coming back from another
 * page the curtain already hides the swap, so the intro plays straight away.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BRIDGES, GODRAYS, SCENES, WATERFALLS, warmScene, type SlotRenderers } from '../lib/assets'
import { isEnabled } from '../lib/motion'
import { emit, motionState, on } from '../lib/store'
import { getLenis } from '../lib/smoothScroll'
import { createMasterTimeline } from '../timelines/masterTimeline'
import { initPointer } from '../timelines/pointer'
import { initAmbient } from '../timelines/ambient'
import { playIntro } from '../timelines/intro'
import { useI18n } from '../lib/i18n'
import Scene from '../components/Scene'
import Bridge from '../components/Bridge'
import SceneCopy from '../components/SceneCopy'
import Preloader from '../components/Preloader'
import ProgressRail from '../components/ProgressRail'
import SoundToggle from '../components/SoundToggle'
import Particles from '../components/Particles'
import CurtainGL from '../components/CurtainGL'
import WaterfallGL from '../components/WaterfallGL'
import GodRays from '../components/GodRays'
import Birds from '../components/Birds'
import { isFirstRoute } from '../lib/routeState'
import Stats from '../sections/Stats'

// below-the-fold sections: one lazy chunk (download starts when Home mounts)
const HomeSections = lazy(() => import('../sections/HomeSections'))

gsap.registerPlugin(ScrollTrigger)

const RESIZE_DEBOUNCE_MS = 250

const slots: SlotRenderers = {
  'hero-birds': isEnabled('birds') ? <Birds mode="cranes" sceneId="hero" /> : null,
  'tranquility-godrays': isEnabled('godRays') && GODRAYS.tranquility ? <GodRays sceneId="tranquility" /> : null,
  'tranquility-waterfall': isEnabled('waterfallShader') ? <WaterfallGL sceneId="tranquility" rect={WATERFALLS.tranquility} /> : null,
  'tranquility-bats': isEnabled('birds') ? <Birds mode="bats" sceneId="tranquility" /> : null,
  'biodiversity-godrays': isEnabled('godRays') ? <GodRays sceneId="biodiversity" /> : null,
  'biodiversity-waterfall': isEnabled('waterfallShader') ? <WaterfallGL sceneId="biodiversity" rect={WATERFALLS.biodiversity} /> : null,
  'biodiversity-birds': isEnabled('birds') ? <Birds mode="songbirds" sceneId="biodiversity" /> : null,
}

export default function Home() {
  const { t, lang } = useI18n()
  const rebuildRef = useRef<(() => void) | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [withPreloader] = useState(() => isFirstRoute('/'))
  const [systemReady, setSystemReady] = useState(false)
  const [loaded, setLoaded] = useState(!withPreloader)

  // Scene system: master timeline + pointer + ambient, built once fonts are ready
  // so SplitText measures the final glyphs.
  useLayoutEffect(() => {
    const track = trackRef.current
    const stage = stageRef.current
    if (!track || !stage) return
    let cancelled = false
    const cleanups: Array<() => void> = []
    let killMaster: (() => void) | null = null
    void document.fonts.ready.then(() => {
      if (cancelled) return
      killMaster = createMasterTimeline({ track, stage })
      cleanups.push(initPointer(stage))
      cleanups.push(initAmbient(stage))
      ScrollTrigger.refresh()
      setSystemReady(true)
    })
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)

    // html[data-stage]: 'in' while the pinned scenes own the screen (CSS hides the floating WhatsApp
    // button on phones there: every scene's copy + CTA sits at the bottom of the screen)
    const html = document.documentElement
    html.dataset.stage = 'in'
    // start 'top bottom' = already active at load, so a direct jump past the track (anchor, restored
    // scroll) still toggles it off; onRefresh re-syncs after layout changes (lazy sections mounting)
    const setStage = (self: ScrollTrigger) => {
      html.dataset.stage = self.isActive ? 'in' : 'out'
    }
    const stageST = ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom 70%',
      onToggle: setStage,
      onRefresh: setStage,
    })

    // Rebuild the master timeline when the width changes (line breaks of the split copy change).
    // Height-only changes (mobile toolbars) only need a refresh.
    let lastW = window.innerWidth
    let timer = 0
    // language switch: the copy layer re-mounts (new text), so the timeline + SplitText are rebuilt
    rebuildRef.current = () => {
      if (!killMaster) return
      killMaster()
      killMaster = createMasterTimeline({ track, stage })
      if (motionState.introDone) {
        const hero = stage.querySelector<HTMLElement>('.scene-copy[data-copy="hero"]')
        if (hero && motionState.activeScene === 0) gsap.set(hero, { autoAlpha: 1 })
      }
      ScrollTrigger.refresh()
    }
    const offResize = on('resize', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!killMaster || Math.abs(window.innerWidth - lastW) < 2) {
          ScrollTrigger.refresh()
          return
        }
        lastW = window.innerWidth
        killMaster()
        killMaster = createMasterTimeline({ track, stage })
        if (motionState.introDone) {
          const hero = stage.querySelector<HTMLElement>('.scene-copy[data-copy="hero"]')
          if (hero && motionState.activeScene === 0) gsap.set(hero, { autoAlpha: 1 })
        }
        ScrollTrigger.refresh()
      }, RESIZE_DEBOUNCE_MS)
    })
    return () => {
      cancelled = true
      rebuildRef.current = null
      window.clearTimeout(timer)
      offResize()
      window.removeEventListener('load', refresh)
      killMaster?.()
      cleanups.reverse().forEach((c) => c())
      // leave no scene state behind for the other pages
      stageST.kill()
      delete document.documentElement.dataset.scene
      delete document.documentElement.dataset.stage
      motionState.introDone = false
      getLenis()?.start()
    }
  }, [])

  // Intro once both the preloader and the scene system are ready.
  useEffect(() => {
    const stage = stageRef.current
    if (!systemReady || !loaded || !stage) return
    // Back/forward to a scrolled home: the master timeline already shows the right scene; replaying
    // the hero intro would paint the hero copy over scene 2/3.
    // also when the user scrolled before the scene system was ready (slow fonts / cold load)
    if (window.scrollY > 8) {
      motionState.introDone = true
      emit('intro')
      warmScene('tranquility')
      return
    }
    const tl = playIntro(stage)
    warmScene('tranquility')
    return () => {
      tl.kill()
    }
  }, [systemReady, loaded, withPreloader])

  // rebuild after the copy layer re-mounted in the new language (skip the first render)
  const langRef = useRef(lang)
  useLayoutEffect(() => {
    if (langRef.current === lang) return
    langRef.current = lang
    rebuildRef.current?.()
  }, [lang])

  const onLoaded = useCallback(() => setLoaded(true), [])

  return (
    <>
      <title>{t.meta.siteTitle}</title>
      <meta name="description" content={t.meta.description} />
      {withPreloader ? <Preloader onDone={onLoaded} /> : null}
      <SoundToggle />
      <div className="track" ref={trackRef}>
        <div className="stage" ref={stageRef}>
          {SCENES.map((s) => (
            <Scene key={s.id} def={s} slots={slots} />
          ))}
          {BRIDGES.map((b) => (
            <Bridge key={b.id} def={b} focusX={0.5} />
          ))}
          <div className="seam-mist" aria-hidden="true" />
          {isEnabled('displacementTransition') ? <CurtainGL /> : null}
          {isEnabled('particles') ? <Particles /> : null}
          {isEnabled('colorGrading') ? (
            <div className="grade-stack" aria-hidden="true">
              {SCENES.map((s) => (
                <div
                  key={s.id}
                  className="grade"
                  data-grade={s.id}
                  style={{ background: `linear-gradient(155deg, ${s.grade.a} 0%, transparent 55%, ${s.grade.b} 100%)` }}
                />
              ))}
            </div>
          ) : null}
          <div className="copy-scrim" aria-hidden="true" />
          <div className="copy-layer" key={lang}>
            {SCENES.map((s) => (
              <SceneCopy key={s.id} def={s} />
            ))}
          </div>
          {isEnabled('progressRail') ? <ProgressRail /> : null}
        </div>
      </div>
      <Stats />
      <Suspense fallback={<div className="sections-fallback" aria-hidden="true" />}>
        <HomeSections />
      </Suspense>
    </>
  )
}
