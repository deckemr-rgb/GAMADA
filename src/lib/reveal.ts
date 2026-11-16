/**
 * reveal.ts — the ONE animation language for every content section (do not re-implement reveals
 * in components). Use it through `useReveal(ref, (kit) => { ... })`:
 *
 *   kit.heading(el)      section title: SplitText per line, masked from below, stagger 0.08 (re-splits on resize)
 *   kit.eyebrow(el)      eyebrow / badge: fade + its `.eyebrow-line` grows (scaleX)
 *   kit.cards(els)       cards: rise 24 px + fade, stagger 0.06, ScrollTrigger.batch, once
 *   kit.fadeUp(els)      generic rise + fade (paragraphs, CTAs …), once
 *   kit.image(el)        screenshot / image wrapper: clip-path wipe + its first child scales 1.08 → 1
 *   kit.stroke(paths, trigger, {start, end})   SVG lines drawn by scroll (stroke-dashoffset, scrubbed)
 *   kit.reduced          true under prefers-reduced-motion / ?motion=reduced (everything becomes a fade)
 *
 * Everything runs inside a gsap.context scoped to the section and is reverted on unmount and when the
 * language changes (elements that SplitText touches must re-mount per language: use <SplitHeading>).
 * Only transform / opacity animate, plus clip-path and stroke-dashoffset where the brief asks for them.
 * Stat counters are self-contained: components/ui/StatCounter.tsx.
 */
import { useLayoutEffect, type DependencyList, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { EASE, SITE_REVEAL as R, isEnabled, prefersReducedMotion } from './motion'
import { useI18n } from './i18n'

gsap.registerPlugin(ScrollTrigger, SplitText)

type Targets = Element | Element[] | NodeListOf<Element> | null | undefined

export interface RevealKit {
  reduced: boolean
  heading: (el: Element | null | undefined) => void
  eyebrow: (el: Element | null | undefined) => void
  cards: (els: Targets) => void
  fadeUp: (els: Targets, opts?: { stagger?: number; start?: string }) => void
  image: (el: Element | null | undefined) => void
  stroke: (paths: Targets, trigger: Element | null | undefined, opts?: { start?: string; end?: string }) => void
}

const list = (t: Targets): Element[] => (!t ? [] : t instanceof Element ? [t] : Array.from(t))

function makeKit(): RevealKit {
  const reduced = prefersReducedMotion()
  const once = (trigger: Element, start: string = R.start) => ({ trigger, start, once: true })

  const fade = (els: Element[], start?: string) => {
    for (const el of els) gsap.from(el, { opacity: 0, duration: R.fadeDur, ease: 'power1.out', scrollTrigger: once(el, start) })
  }

  return {
    reduced,

    heading(el) {
      if (!el) return
      if (reduced || !isEnabled('splitTextReveal')) return fade([el])
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'rv-line',
        aria: 'auto',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: R.lineYPercent,
            duration: R.headingDur,
            ease: EASE.reveal,
            stagger: R.headingStagger,
            scrollTrigger: once(el),
          }),
      })
    },

    eyebrow(el) {
      if (!el) return
      if (reduced) return fade([el])
      const line = el.querySelector('.eyebrow-line')
      const tl = gsap.timeline({ scrollTrigger: once(el) })
      tl.from(el, { opacity: 0, duration: R.eyebrowDur, ease: 'power1.out' }, 0)
      if (line) tl.from(line, { scaleX: 0, transformOrigin: '0% 50%', duration: R.eyebrowDur, ease: EASE.reveal }, 0.05)
    },

    cards(els) {
      const items = list(els)
      if (!items.length) return
      if (reduced) {
        gsap.set(items, { opacity: 0 })
        ScrollTrigger.batch(items, {
          start: R.start,
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, duration: R.fadeDur, overwrite: true }),
        })
        return
      }
      gsap.set(items, { opacity: 0, y: R.cardY })
      ScrollTrigger.batch(items, {
        start: R.start,
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: R.cardDur, ease: EASE.out, stagger: R.cardStagger, overwrite: true, clearProps: 'transform' }),
      })
    },

    fadeUp(els, opts = {}) {
      const items = list(els)
      if (!items.length) return
      if (reduced) return fade(items, opts.start)
      const first = items[0]
      if (!first) return
      gsap.from(items, {
        opacity: 0,
        y: R.cardY,
        duration: R.cardDur,
        ease: EASE.out,
        stagger: opts.stagger ?? R.cardStagger,
        clearProps: 'transform',
        scrollTrigger: once(first, opts.start),
      })
    },

    image(el) {
      if (!el) return
      if (reduced) return fade([el])
      const inner = el.firstElementChild
      const tl = gsap.timeline({ scrollTrigger: once(el) })
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: R.imageDur, ease: EASE.reveal, clearProps: 'clipPath' }, 0)
      if (inner) tl.fromTo(inner, { scale: R.imageScale }, { scale: 1, duration: R.imageDur * 1.2, ease: EASE.out, clearProps: 'transform' }, 0)
    },

    stroke(paths, trigger, opts = {}) {
      const items = list(paths).filter((p): p is SVGGeometryElement => p instanceof SVGGeometryElement)
      if (!items.length || !trigger) return
      for (const p of items) {
        const len = Math.ceil(p.getTotalLength())
        if (reduced) {
          gsap.set(p, { strokeDasharray: 'none', strokeDashoffset: 0 })
          continue
        }
        gsap.fromTo(
          p,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: { trigger, start: opts.start ?? 'top 80%', end: opts.end ?? 'bottom 60%', scrub: true },
          },
        )
      }
    },
  }
}

/**
 * Build a section's reveals once its DOM is committed (layout effect → no flash of the final state).
 * Re-runs when the language changes (SplitText needs the new text) or when `deps` change.
 * `build` may return its own cleanup.
 */
export function useReveal(
  ref: RefObject<HTMLElement | null>,
  build: (kit: RevealKit, root: HTMLElement) => void | (() => void),
  deps: DependencyList = [],
): void {
  const { lang } = useI18n()
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let extra: void | (() => void)
    const ctx = gsap.context(() => {
      extra = build(makeKit(), root)
    }, root)
    return () => {
      if (typeof extra === 'function') extra()
      ctx.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ...deps])
}
