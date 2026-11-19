/**
 * FlowDiagram — a timeline of product steps (plan §2.1 "Bagaimana semuanya terhubung", §2.2 "Alur antarproduk").
 * Wide screens (≥ 1100 px): a horizontal track with the step texts above / below in turn; narrower: a vertical list.
 * The DOM is an <ol> in reading order (time, title, sentence, product chips, link), so it reads fine without the
 * drawing. Motion (transform / opacity only): the track fills and a pulse travels with ScrollTrigger scrub; with
 * `scrub` on wide screens the diagram stays in view (CSS sticky, ECO_SITE.flow.pinVh) while the pulse crosses it.
 * Reduced motion: drawn complete, nothing moves.
 */
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { ECO_SITE, prefersReducedMotion } from '../../lib/motion'
import { Icon } from '../../demo-kit/ui/icons'
import AppLink from '../../components/AppLink'
import Arrow from '../../components/ui/Arrow'
import { ProductChips, useMedia } from './parts'

gsap.registerPlugin(ScrollTrigger)

export interface FlowStep {
  key: string
  time: string | null
  /** small line above the title ("Bab 4") */
  kicker?: string
  title: string
  body?: string
  products: readonly ProductSlug[]
  /** product whose icon the node shows when `products` is empty */
  slug?: ProductSlug
  link?: { to: string; label: string }
}

const WIDE = '(min-width: 1100px)'

export default function FlowDiagram({ steps, label, scrub = false }: { steps: readonly FlowStep[]; label: string; scrub?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const wide = useMedia(WIDE)
  const reduced = prefersReducedMotion()
  const pinned = scrub && wide && !reduced && steps.length > 1
  const n = steps.length

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.flw-step'))
    const fills = items.map((li) => li.querySelector<HTMLElement>('.flw-fill'))
    const pulses = items.map((li) => li.querySelector<HTMLElement>('.flw-pulse'))
    const axis = wide ? 'x' : 'y'
    let lens: number[] = []
    const measure = () => {
      lens = items.map((li) => {
        const seg = li.querySelector<HTMLElement>('.flw-seg')
        return seg ? (axis === 'x' ? seg.offsetWidth : seg.offsetHeight) : 0
      })
    }
    const apply = (p: number) => {
      const at = p * Math.max(1, n - 1)
      items.forEach((li, i) => {
        li.toggleAttribute('data-on', at >= i - 0.02)
        const f = Math.min(1, Math.max(0, at - i))
        const fill = fills[i]
        if (fill) fill.style.transform = axis === 'x' ? `scaleX(${f})` : `scaleY(${f})`
        const pulse = pulses[i]
        if (pulse) {
          const moving = f > 0 && f < 1
          pulse.style.opacity = moving ? '1' : '0'
          const d = f * (lens[i] ?? 0)
          pulse.style.transform = axis === 'x' ? `translate3d(${d}px,0,0)` : `translate3d(0,${d}px,0)`
        }
      })
    }
    if (reduced || n < 2) {
      apply(1)
      return
    }
    measure()
    apply(0)
    const state = { p: 0 }
    const trigger = pinned ? root.querySelector<HTMLElement>('.flw-pin') : root.querySelector<HTMLElement>('.flw-list')
    const tween = gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: () => apply(state.p),
      scrollTrigger: pinned
        ? { trigger, start: 'top top', end: 'bottom bottom', scrub: ECO_SITE.flow.scrub, onRefresh: measure }
        : { trigger, start: 'top 75%', end: 'bottom 55%', scrub: ECO_SITE.flow.scrub, onRefresh: measure },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      items.forEach((li) => li.removeAttribute('data-on'))
    }
  }, [wide, pinned, reduced, n])

  const list = (
    <ol className="flw-list" aria-label={label} style={{ '--n': n } as CSSProperties}>
      {steps.map((s, i) => {
        const first = PRODUCT_BY_SLUG[s.products[0] ?? s.slug ?? 'inti']
        return (
          <li key={s.key} className="flw-step" data-eco={first.eco} data-side={i % 2 ? 'top' : 'bottom'}>
            <span className="flw-node" aria-hidden="true">
              <Icon name={first.icon} size={20} />
            </span>
            {i < n - 1 ? (
              <span className="flw-seg" aria-hidden="true">
                <i className="flw-fill" />
                <b className="flw-pulse" />
              </span>
            ) : null}
            <div className="flw-text">
              <p className="flw-time">
                {s.time ? <time>{s.time}</time> : null}
                {s.kicker ? <span className="flw-kicker">{s.kicker}</span> : null}
              </p>
              <h3 className="flw-title">{s.title}</h3>
              {s.body ? <p className="flw-body">{s.body}</p> : null}
              {s.products.length ? <ProductChips slugs={s.products} className="is-small" /> : null}
              {s.link ? (
                <AppLink to={s.link.to} className="flw-link">
                  {s.link.label}
                  <Arrow />
                </AppLink>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )

  return (
    <div ref={ref} className="flw" data-wide={wide ? '' : undefined}>
      {pinned ? (
        <div className="flw-pin" style={{ height: `${ECO_SITE.flow.pinVh}vh` }}>
          <div className="flw-stage">{list}</div>
        </div>
      ) : (
        list
      )}
    </div>
  )
}
