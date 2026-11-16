/**
 * SceneCopy — eyebrow, big serif title, thin rule, body and CTA for one scene,
 * plus the animation builders used by the master timeline and the intro.
 *
 * Contract:
 *   prepareCopy(el)  split title into chars and eyebrow/body into masked lines (idempotent)
 *   hideCopy(el)     put every part in its "before reveal" state
 *   copyIn(el)       timeline hidden → shown   (NOT paused; scrub-safe fromTo)
 *   copyOut(el)      timeline shown → hidden   (letters lift with reversed stagger)
 */
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { SceneDef } from '../lib/assets'
import { DUR, EASE, REVEAL, isEnabled } from '../lib/motion'
import StartButton from './StartButton'
import LearnMore from './LearnMore'
import { MagneticLink, WaIcon } from './ui/Button'
import { useI18n } from '../lib/i18n'
import { waLink } from '../content/site'

gsap.registerPlugin(SplitText)

function EyebrowIcon() {
  return (
    <svg className="copy-eyebrow-icon" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="12" width="6" height="26" rx="1" />
      <rect x="12" y="4" width="6" height="34" rx="1" />
      <rect x="22" y="8" width="6" height="30" rx="1" />
      <rect x="32" y="14" width="6" height="24" rx="1" />
      <rect x="0" y="34" width="40" height="5" rx="1" />
    </svg>
  )
}

/**
 * Scene copy. Words come from t.home.scenes (ID/EN); the parent re-mounts the copy layer when the
 * language changes (SplitText rewrites this DOM, React must not patch it).
 * Hero: badge, h1, subtitle, WhatsApp CTA (magnetic) + "continue the journey" CTA, demo note.
 */
export default function SceneCopy({ def }: { def: SceneDef }) {
  const { t } = useI18n()
  const { copy } = def

  if (def.id === 'hero') {
    const h = t.home.scenes.hero
    return (
      <div className="scene-copy" data-copy="hero" data-align={copy.align}>
        <p className="copy-eyebrow copy-badge" data-part="eyebrow">
          {copy.eyebrowIcon ? <EyebrowIcon /> : null}
          <span data-split="lines">{h.badge}</span>
        </p>
        <h1 className="copy-title copy-title--hero" data-part="title">
          {h.title}
        </h1>
        <p className="copy-body" data-part="body">
          <span data-split="lines">{h.body}</span>
        </p>
        <div className="copy-cta copy-cta--hero" data-part="cta">
          <div className="copy-cta-row">
            <MagneticLink href={waLink(h.waPrefill)} variant="primary" icon={<WaIcon />} className="copy-cta-wa">
              {h.ctaPrimary}
            </MagneticLink>
            <StartButton label={h.ctaSecondary} arrow="down" />
          </div>
          <p className="copy-demo">
            <span className="copy-demo-dot" aria-hidden="true" />
            {h.demoNote}
          </p>
        </div>
      </div>
    )
  }

  const sc = def.id === 'tranquility' ? t.home.scenes.tranquility : t.home.scenes.biodiversity
  const Heading = copy.heading
  return (
    <div className="scene-copy" data-copy={def.id} data-align={copy.align}>
      <p className="copy-eyebrow" data-part="eyebrow">
        {copy.eyebrowIcon ? <EyebrowIcon /> : null}
        <span data-split="lines">{sc.eyebrow}</span>
      </p>
      <Heading className={`copy-title copy-title--${def.id}`} data-part="title">
        {sc.title}
      </Heading>
      {copy.heading === 'h2' ? <span className="copy-rule" data-part="rule" aria-hidden="true" /> : null}
      <p className="copy-body" data-part="body">
        <span data-split="lines">{sc.body}</span>
      </p>
      <div className="copy-cta" data-part="cta">
        {copy.cta.kind === 'start' ? (
          <StartButton label={sc.cta} />
        ) : (
          <LearnMore label={sc.cta} href={copy.cta.href ?? '#info'} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ animation builders */

interface Parts {
  root: HTMLElement
  eyebrowLines: Element[]
  icon: Element | null
  chars: Element[]
  rule: HTMLElement | null
  bodyLines: Element[]
  cta: HTMLElement | null
}

const splits = new WeakMap<HTMLElement, SplitText[]>()
const split = () => isEnabled('splitTextReveal')

export function prepareCopy(root: HTMLElement): void {
  if (splits.has(root) || !split()) return
  const made: SplitText[] = []
  const title = root.querySelector<HTMLElement>('[data-part="title"]')
  if (title) made.push(SplitText.create(title, { type: 'words,chars', mask: 'chars', wordsClass: 'copy-word', charsClass: 'copy-char', aria: 'auto' }))
  root.querySelectorAll<HTMLElement>('[data-split="lines"]').forEach((el) => {
    made.push(SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'copy-line', aria: 'auto' }))
  })
  splits.set(root, made)
}

/** Undo SplitText (used on unmount / before re-splitting after a resize). */
export function revertCopy(root: HTMLElement): void {
  splits.get(root)?.forEach((s) => s.revert())
  splits.delete(root)
}

function parts(root: HTMLElement): Parts {
  const eyebrow = root.querySelector('[data-part="eyebrow"]')
  const body = root.querySelector('[data-part="body"]')
  const title = root.querySelector('[data-part="title"]')
  const lines = (el: Element | null) => (el ? Array.from(el.querySelectorAll('.copy-line')) : [])
  return {
    root,
    eyebrowLines: split() ? lines(eyebrow) : eyebrow ? [eyebrow] : [],
    icon: root.querySelector('.copy-eyebrow-icon'),
    chars: split() && title ? Array.from(title.querySelectorAll('.copy-char')) : title ? [title] : [],
    rule: root.querySelector<HTMLElement>('[data-part="rule"]'),
    bodyLines: split() ? lines(body) : body ? [body] : [],
    cta: root.querySelector<HTMLElement>('[data-part="cta"]'),
  }
}

export function hideCopy(root: HTMLElement): void {
  const p = parts(root)
  gsap.set(root, { autoAlpha: 0 })
  if (split()) {
    gsap.set(p.chars, { yPercent: REVEAL.charYPercent, rotateX: REVEAL.charRotateX, opacity: 0 })
    gsap.set([...p.eyebrowLines, ...p.bodyLines], { yPercent: REVEAL.lineYPercent })
  } else {
    gsap.set([...p.chars, ...p.eyebrowLines, ...p.bodyLines], { opacity: 0, y: 16 })
  }
  if (p.icon) gsap.set(p.icon, { opacity: 0, x: -10 })
  if (p.rule) gsap.set(p.rule, { scaleX: REVEAL.ruleScale, transformOrigin: '0% 50%' })
  if (p.cta) gsap.set(p.cta, { autoAlpha: 0, y: 18 })
}

export function copyIn(root: HTMLElement, opts: { reduced?: boolean } = {}): gsap.core.Timeline {
  const p = parts(root)
  const d = REVEAL.inDuration
  const tl = gsap.timeline({ defaults: { ease: EASE.reveal, immediateRender: false } })
  tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0)

  if (opts.reduced || !split()) {
    const all = [...p.eyebrowLines, ...p.chars, ...p.bodyLines]
    tl.fromTo(all, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: DUR.reducedCrossfade, stagger: 0.04, ease: 'power1.out' }, 0)
    if (p.icon) tl.fromTo(p.icon, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: DUR.reducedCrossfade }, 0)
    if (p.rule) tl.fromTo(p.rule, { scaleX: 0 }, { scaleX: 1, duration: DUR.reducedCrossfade, transformOrigin: '0% 50%' }, 0)
    if (p.cta) tl.fromTo(p.cta, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: DUR.reducedCrossfade }, 0.05)
    return tl
  }

  if (p.icon) tl.fromTo(p.icon, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: d }, 0)
  tl.fromTo(p.eyebrowLines, { yPercent: REVEAL.lineYPercent }, { yPercent: 0, duration: d, stagger: REVEAL.lineStagger }, 0)
  tl.fromTo(
    p.chars,
    { yPercent: REVEAL.charYPercent, rotateX: REVEAL.charRotateX, opacity: 0 },
    { yPercent: 0, rotateX: 0, opacity: 1, duration: d * 1.25, stagger: REVEAL.charStagger },
    d * 0.2,
  )
  if (p.rule) tl.fromTo(p.rule, { scaleX: 0 }, { scaleX: 1, duration: d, transformOrigin: '0% 50%' }, d * 0.55)
  tl.fromTo(p.bodyLines, { yPercent: REVEAL.lineYPercent }, { yPercent: 0, duration: d, stagger: REVEAL.lineStagger }, d * 0.6)
  if (p.cta) tl.fromTo(p.cta, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: d, ease: EASE.out }, d * 0.9)
  return tl
}

export function copyOut(root: HTMLElement): gsap.core.Timeline {
  const p = parts(root)
  const d = REVEAL.outDuration
  const tl = gsap.timeline({ defaults: { ease: EASE.reveal, immediateRender: false } })
  if (!split()) {
    tl.fromTo([...p.eyebrowLines, ...p.chars, ...p.bodyLines], { opacity: 1, y: 0 }, { opacity: 0, y: -16, duration: d, stagger: 0.03 }, 0)
  } else {
    tl.fromTo(
      p.chars,
      { yPercent: 0, rotateX: 0, opacity: 1 },
      { yPercent: -REVEAL.charYPercent, rotateX: -REVEAL.charRotateX, opacity: 0, duration: d, stagger: { each: REVEAL.charStagger, from: 'end' } },
      0,
    )
    tl.fromTo(p.eyebrowLines, { yPercent: 0 }, { yPercent: -REVEAL.lineYPercent, duration: d * 0.8, stagger: REVEAL.lineStagger }, 0)
    tl.fromTo(p.bodyLines, { yPercent: 0 }, { yPercent: -REVEAL.lineYPercent, duration: d * 0.8, stagger: REVEAL.lineStagger }, d * 0.1)
  }
  if (p.icon) tl.fromTo(p.icon, { opacity: 1 }, { opacity: 0, duration: d * 0.6 }, 0)
  if (p.rule) tl.fromTo(p.rule, { scaleX: 1 }, { scaleX: 0, duration: d * 0.7, transformOrigin: '100% 50%' }, 0)
  if (p.cta) tl.fromTo(p.cta, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -14, duration: d * 0.7 }, 0)
  tl.fromTo(root, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01 }, d * 1.4)
  return tl
}
