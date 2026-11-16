/**
 * intro.ts — 4.5 choreography after the preloader (≤ 2.5s, skippable):
 * sky fades in → mountain rises with a soft overshoot → foreground settles →
 * birds enter from the right (Birds listens to the 'intro' event) → nav + hero copy.
 *
 * Animates only `.layer-img` / slot children inside hero layers, never the layer
 * wrappers (those belong to the master timeline / pointer / ambient controllers).
 */
import { gsap } from 'gsap'
import { DUR, EASE, isEnabled, prefersReducedMotion } from '../lib/motion'
import { emit, motionState } from '../lib/store'
import { copyIn, hideCopy } from '../components/SceneCopy'
import { navIntro } from '../components/Navbar'

const layerContent = (stage: HTMLElement, id: string): HTMLElement[] =>
  Array.from(stage.querySelectorAll<HTMLElement>(`.scene[data-scene="hero"] .layer[data-layer="${id}"] .layer-wind > *`))

export function playIntro(stage: HTMLElement): gsap.core.Timeline {
  const heroCopy = stage.querySelector<HTMLElement>('.scene-copy[data-copy="hero"]')
  const finish = () => {
    motionState.introDone = true
    emit('intro')
  }

  const tl = gsap.timeline({ onComplete: finish })
  if (prefersReducedMotion() || !isEnabled('preloader')) {
    if (heroCopy) tl.add(copyIn(heroCopy, { reduced: true }), 0)
    tl.add(navIntro(), 0)
    tl.call(finish, [], 0.01)
    return tl
  }

  if (heroCopy) hideCopy(heroCopy)
  const sky = [...layerContent(stage, 'sky'), ...layerContent(stage, 'sun-glow')]
  const mountain = layerContent(stage, 'mountain')
  const clouds = [...layerContent(stage, 'clouds-back'), ...layerContent(stage, 'clouds-front')]
  const ground = ['hills', 'lake', 'rocks', 'grass-back', 'traveler', 'scarf', 'grass-front'].flatMap((id) => layerContent(stage, id))

  tl.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: DUR.introSky, ease: 'sine.out' }, 0)
  tl.fromTo(mountain, { yPercent: 9, opacity: 0 }, { yPercent: 0, opacity: 1, duration: DUR.introMountain, ease: EASE.overshoot }, 0.15)
  tl.fromTo(clouds, { yPercent: 4, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.0, ease: EASE.out, stagger: 0.1 }, 0.3)
  tl.fromTo(ground, { yPercent: 5, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: EASE.out, stagger: 0.05 }, 0.35)
  tl.call(() => emit('intro'), [], 0.55) // birds fly in from the right
  tl.add(navIntro(), 0.7)
  if (heroCopy) tl.add(copyIn(heroCopy), 0.9)
  // clamp total length to the 2.5s budget
  if (tl.duration() > DUR.introTotalMax) tl.timeScale(tl.duration() / DUR.introTotalMax)

  // skippable with a click, key, wheel or touch
  const skip = () => {
    if (tl.progress() < 1) tl.progress(1)
    off()
  }
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
  const off = () => events.forEach((e) => window.removeEventListener(e, skip))
  events.forEach((e) => window.addEventListener(e, skip, { passive: true, once: true }))
  // In a hidden tab/panel requestAnimationFrame stops, which would freeze the intro half-way
  // (hidden layers, half-revealed copy). Jump to the end state instead.
  const onHidden = () => {
    if (document.visibilityState === 'hidden' && tl.progress() < 1) tl.progress(1)
  }
  document.addEventListener('visibilitychange', onHidden)
  onHidden()
  const detach = () => {
    off()
    document.removeEventListener('visibilitychange', onHidden)
  }
  tl.eventCallback('onComplete', () => {
    detach()
    finish()
  })
  // killed before the end (route change mid-intro): drop the listeners, never mark the intro done
  tl.eventCallback('onInterrupt', detach)
  return tl
}
