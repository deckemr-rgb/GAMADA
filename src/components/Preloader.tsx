/**
 * Preloader — dusk overlay with the GAMADA wordmark, a rolling percentage and a thin bar,
 * driven by the real progress of preloadAssets(criticalUrls()).
 *
 * - Lenis is stopped while visible, scroll is reset to the top on mount.
 * - Stays at least DUR.preloaderMinVisible; any click / wheel / touch / key skips immediately.
 * - Exit: the overlay wipes up (clip-path) over DUR.preloaderOut. onDone() fires exactly once,
 *   as the wipe starts (so the intro's first frame is already hidden under the overlay and is
 *   revealed by the wipe instead of flashing), and the component unmounts when the wipe ends.
 * - Flag off / reduced motion: quick fade; onDone after preloading or UI.preloader.quickMax s.
 * - StrictMode safe: loading starts once (ref), onDone guarded by a ref.
 * - The wordmark is decorative (<p aria-hidden>), not a heading; the progressbar carries the label.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { criticalUrls, preloadAssets } from '../lib/assets'
import { DUR, EASE, UI, isEnabled, prefersReducedMotion } from '../lib/motion'
import { getLenis } from '../lib/smoothScroll'
import { useI18n } from '../lib/i18n'
import '../styles/ui.css'

const PRELOADER = UI.preloader

const WORD = 'GAMADA'
const DIGITS = Array.from({ length: 10 }, (_, d) => d)

type Phase = 'loading' | 'exiting' | 'done'

export default function Preloader({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const [quick] = useState(() => !isEnabled('preloader') || prefersReducedMotion())
  const [phase, setPhase] = useState<Phase>('loading')
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const progRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<Array<HTMLSpanElement | null>>([])
  const hundredsRef = useRef<HTMLSpanElement>(null)

  const loadRef = useRef<Promise<void> | null>(null)
  const realRef = useRef(0)
  const doneRef = useRef(false)
  const exitingRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let alive = true
    const started = performance.now()

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    getLenis()?.stop()

    // start loading once (StrictMode re-runs this effect)
    loadRef.current ??= preloadAssets((f) => {
      realRef.current = f
    }, criticalUrls())

    const fireDone = () => {
      if (doneRef.current) return
      doneRef.current = true
      getLenis()?.start()
      onDoneRef.current()
    }

    let stopChase = () => {}
    const center = root.querySelector<HTMLElement>('.preloader-center')
    const foot = root.querySelector<HTMLElement>('.preloader-foot')

    const ctx = gsap.context(() => {
      const shown = { v: 0 }
      let lastShown = -1
      const render = () => {
        const v = Math.round(shown.v)
        if (v === lastShown) return
        lastShown = v
        if (barRef.current) gsap.set(barRef.current, { scaleX: shown.v / 100 })
        progRef.current?.setAttribute('aria-valuenow', String(v))
        const tens = Math.floor(v / 10) % 10
        const ones = v % 10
        const roll = (el: HTMLSpanElement | null | undefined, d: number) => {
          if (el) gsap.to(el, { yPercent: -d * 10, duration: PRELOADER.digitRoll, ease: EASE.out, overwrite: true })
        }
        roll(colRefs.current[0], tens)
        roll(colRefs.current[1], ones)
        if (hundredsRef.current) hundredsRef.current.dataset.show = String(v >= 100)
        roll(colRefs.current[2], v >= 100 ? 1 : 0)
      }

      const exit = () => {
        if (exitingRef.current || !alive) return
        exitingRef.current = true
        removeSkip()
        stopChase()
        setPhase('exiting')
        const tl = gsap.timeline({
          onComplete: () => {
            fireDone()
            if (alive) setPhase('done')
          },
        })
        if (quick) {
          tl.call(fireDone)
          tl.to(root, { autoAlpha: 0, duration: DUR.reducedCrossfade, ease: 'power1.out' })
          return
        }
        tl.to(shown, { v: 100, duration: PRELOADER.finishCount, ease: 'power2.out', onUpdate: render, overwrite: true })
        tl.call(fireDone)
        tl.to(root, { clipPath: 'inset(0% 0% 100% 0%)', duration: DUR.preloaderOut, ease: EASE.reveal })
        if (center)
          tl.to(
            center,
            {
              yPercent: PRELOADER.exitLiftYPercent,
              opacity: 0,
              duration: DUR.preloaderOut * PRELOADER.exitCenterFraction,
              ease: EASE.reveal,
            },
            '<',
          )
        if (foot) tl.to(foot, { opacity: 0, duration: DUR.preloaderOut * PRELOADER.exitFootFraction }, '<')
        // A hidden tab/panel pauses requestAnimationFrame: the wipe would freeze half-way and leave a
        // hard horizontal edge over the hero. Finish it instantly instead.
        const jumpIfHidden = () => {
          if (document.visibilityState === 'hidden' && tl.progress() < 1) tl.progress(1)
        }
        document.addEventListener('visibilitychange', jumpIfHidden)
        tl.eventCallback('onComplete', () => {
          document.removeEventListener('visibilitychange', jumpIfHidden)
          fireDone()
          if (alive) setPhase('done')
        })
        jumpIfHidden()
      }

      // skip: any intent to interact
      const skipEvents = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const
      const onSkip = () => exit()
      const removeSkip = () => skipEvents.forEach((ev) => window.removeEventListener(ev, onSkip))
      skipEvents.forEach((ev) => window.addEventListener(ev, onSkip, { passive: true }))

      if (quick) {
        const timer = gsap.delayedCall(PRELOADER.quickMax, exit)
        void loadRef.current?.then(() => {
          timer.kill()
          exit()
        })
        return () => removeSkip()
      }

      // wordmark rises letter by letter
      gsap.fromTo(
        '.preloader-char',
        { yPercent: 110 },
        { yPercent: 0, duration: PRELOADER.charRise, ease: EASE.out, stagger: PRELOADER.charStagger, delay: PRELOADER.charDelay },
      )
      gsap.fromTo(
        '.preloader-caption, .preloader-foot',
        { opacity: 0 },
        { opacity: 1, duration: PRELOADER.captionFade, delay: PRELOADER.captionDelay },
      )

      // displayed % chases the real one
      let chased = 0
      const chase = () => {
        const target = realRef.current * 100
        if (target <= chased) return
        chased = target
        gsap.to(shown, { v: target, duration: PRELOADER.countFollow, ease: 'power1.out', onUpdate: render, overwrite: true })
      }
      gsap.ticker.add(chase)
      stopChase = () => gsap.ticker.remove(chase)
      render()

      const safety = gsap.delayedCall(PRELOADER.maxWait, exit)
      void loadRef.current?.then(() => {
        if (!alive) return
        const waited = (performance.now() - started) / 1000
        gsap.delayedCall(Math.max(0, DUR.preloaderMinVisible - waited), exit)
      })

      return () => {
        stopChase()
        safety.kill()
        removeSkip()
      }
    }, root)

    return () => {
      alive = false
      ctx.revert()
      // StrictMode: let the re-run decide again; a real unmount mid-load must not leave scroll locked
      if (!doneRef.current) {
        exitingRef.current = false
        getLenis()?.start()
      }
    }
  }, [quick])

  if (phase === 'done') return null

  return (
    <div
      ref={rootRef}
      className={`preloader${quick ? ' preloader--quick' : ''}`}
      aria-busy={phase === 'loading'}
      style={{ '--ui-hover': `${DUR.hover}s` } as CSSProperties}
    >
      <span className="preloader-sun" aria-hidden="true" />
      <svg className="preloader-ridges" viewBox="0 0 1600 360" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 230 L170 150 L300 196 L470 92 L620 180 L780 120 L930 200 L1110 110 L1290 190 L1440 140 L1600 186 L1600 360 L0 360 Z" fill="#3a2a66" opacity="0.55" />
        <path d="M0 276 C220 226 380 262 560 236 C760 206 900 258 1100 238 C1300 218 1460 252 1600 232 L1600 360 L0 360 Z" fill="#241c4c" opacity="0.8" />
        <path d="M0 318 C260 296 520 322 820 306 C1120 290 1380 318 1600 300 L1600 360 L0 360 Z" fill="#17133a" />
      </svg>

      <div className="preloader-center">
        <p className="preloader-caption">{t.preloader.caption}</p>
        <p className="preloader-word" aria-hidden="true">
          {WORD.split('').map((c, i) => (
            <span className="preloader-char-mask" key={i}>
              <span className="preloader-char">{c}</span>
            </span>
          ))}
        </p>
      </div>

      <div className="preloader-foot">
        <span className="preloader-pct" aria-hidden="true">
          <span ref={hundredsRef} className="preloader-col" data-col="h" data-show="false">
            <span ref={(el) => void (colRefs.current[2] = el)} className="preloader-col-strip">
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
          <span className="preloader-col">
            <span ref={(el) => void (colRefs.current[0] = el)} className="preloader-col-strip">
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
          <span className="preloader-col">
            <span ref={(el) => void (colRefs.current[1] = el)} className="preloader-col-strip">
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
          <span>%</span>
        </span>
        <div
          ref={progRef}
          className="preloader-bar"
          role="progressbar"
          aria-label={t.preloader.loading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span ref={barRef} className="preloader-bar-fill" />
        </div>
        <span className="preloader-skip">{t.preloader.skip}</span>
      </div>
    </div>
  )
}
