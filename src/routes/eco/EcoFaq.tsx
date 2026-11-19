/**
 * EcoFaq — "FAQ ekosistem" (plan §2.1 item 5): the home FAQ pattern (dawn section, accordion markup + classes of
 * components/ui/Accordion, reveal kit) with five honest, claim-free answers (plan §7 Q5).
 * The disclosure is local on purpose: importing ui/Accordion from a route splits it out of the home HomeSections
 * chunk (+0.3 KB on the home load). Same markup and classes (.acc-*), same GSAP height animation.
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { EASE, prefersReducedMotion } from '../../lib/motion'
import { useReveal } from '../../lib/reveal'
import Section from '../../components/ui/Section'
import SectionHeader from '../../components/ui/SectionHeader'
import type { EcoPagesCopy } from '../../content/ecoPages'

/** one disclosure (also used by the /produk FAQ, routes/produk/Sections.tsx, for the same reason) */
export function FaqItem({ id, q, a }: { id: string; q: string; a: string }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useLayoutEffect(() => {
    const p = panel.current
    if (!p) return
    if (first.current || prefersReducedMotion()) {
      first.current = false
      gsap.set(p, { height: open ? 'auto' : 0 })
      return
    }
    gsap.to(p, { height: open ? 'auto' : 0, duration: 0.45, ease: EASE.reveal, overwrite: true })
  }, [open])
  return (
    <div className="acc-item" id={id} data-open={open} data-rv="card">
      <h3 className="acc-h">
        <button type="button" className="acc-btn" id={`${uid}-b`} aria-expanded={open} aria-controls={`${uid}-p`} onClick={() => setOpen((o) => !o)}>
          <span>{q}</span>
          <svg className="acc-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div ref={panel} className="acc-panel" id={`${uid}-p`} role="region" aria-labelledby={`${uid}-b`} inert={!open}>
        <div className="acc-body">
          <p>{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function EcoFaq({ F, children }: { F: EcoPagesCopy['hub']['faq']; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .es-faq-side > :not(.sec-head)'))
    kit.cards(root.querySelectorAll('.acc-item'))
  })

  return (
    <Section id="faq-ekosistem" tone="dawn" labelledBy="efaq-title" ambient className="es-faq-sec">
      <div ref={ref} className="es-faq">
        <div className="es-faq-side">
          <SectionHeader eyebrow={F.eyebrow} title={F.title} titleId="efaq-title" lead={F.lead} />
          {children}
        </div>
        <div className="es-faq-list acc">
          {F.items.map((it) => (
            <FaqItem key={it.id} id={`efaq-${it.id}`} q={it.q} a={it.a} />
          ))}
        </div>
      </div>
    </Section>
  )
}
