/**
 * Accordion — accessible disclosure list (button[aria-expanded] + region[aria-labelledby]).
 * Smooth height (GSAP height 0 ↔ auto, the one layout animation the brief asks for), rotating ▾.
 * Items can be deep-linked: an item whose `id` equals the URL hash opens on mount.
 * `highlight` wraps matches of a search term in <mark> (used by /faq search).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { EASE, prefersReducedMotion } from '../../lib/motion'
import '../../styles/ui-kit.css'

export interface AccordionItem {
  id: string
  q: string
  a: ReactNode
}

function Mark({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      <Mark text={text.slice(i + term.length)} term={term} />
    </>
  )
}

function Item({ item, open, onToggle, term }: { item: AccordionItem; open: boolean; onToggle: () => void; term?: string }) {
  const uid = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const p = panelRef.current
    if (!p) return
    if (first.current || prefersReducedMotion()) {
      first.current = false
      gsap.set(p, { height: open ? 'auto' : 0 })
      return
    }
    gsap.to(p, { height: open ? 'auto' : 0, duration: 0.45, ease: EASE.reveal, overwrite: true })
  }, [open])

  return (
    <div className="acc-item" id={item.id} data-open={open} data-rv="card">
      <h3 className="acc-h">
        <button type="button" className="acc-btn" id={`${uid}-b`} aria-expanded={open} aria-controls={`${uid}-p`} onClick={onToggle}>
          <span>
            <Mark text={item.q} term={term} />
          </span>
          <svg className="acc-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div ref={panelRef} className="acc-panel" id={`${uid}-p`} role="region" aria-labelledby={`${uid}-b`} inert={!open}>
        <div className="acc-body">{typeof item.a === 'string' ? <Mark text={item.a} term={term} /> : item.a}</div>
      </div>
    </div>
  )
}

export default function Accordion({ items, term, single = false }: { items: AccordionItem[]; term?: string; single?: boolean }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  // deep link: /faq#biaya opens that item
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id && items.some((i) => i.id === id)) setOpen(new Set([id]))
  }, [items])

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(single ? [] : prev)
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="acc">
      {items.map((it) => (
        <Item key={it.id} item={it} open={open.has(it.id)} onToggle={() => toggle(it.id)} term={term} />
      ))}
    </div>
  )
}
