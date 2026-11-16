/**
 * FaqPreview — the light "dawn" section: four of the shared FAQ entries (content/faq.ts) in the
 * shared Accordion (ids prefixed `faq-` so they never collide with page anchors such as #biaya on
 * /faq), a link to the full /faq page and a small "ask us directly" card. Reveals: lib/reveal.ts.
 */
import { useMemo, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { faqFor, type FaqId } from '../content/faq'
import { waLink } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Accordion, { type AccordionItem } from '../components/ui/Accordion'
import { ButtonLink, WaIcon } from '../components/ui/Button'
import '../styles/sections/faq-preview.css'

/** Which shared entries the home shows, in order. */
const HOME_FAQ: readonly FaqId[] = ['beda', 'biaya', 'teknis', 'purnajual']

export default function FaqPreview() {
  const { t, lang } = useI18n()
  const c = t.home.faqPreview
  const ref = useRef<HTMLDivElement>(null)

  const items = useMemo<AccordionItem[]>(() => {
    const all = faqFor(lang)
    return HOME_FAQ.flatMap((id) => {
      const e = all.find((x) => x.id === id)
      if (!e) return []
      return [
        {
          id: `faq-${e.id}`,
          q: e.q,
          a: (
            <>
              {e.a.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </>
          ),
        },
      ]
    })
  }, [lang])

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .faqp-more'), { stagger: 0.1 })
    kit.cards(root.querySelectorAll('.acc-item, .faqp-ask'))
  })

  return (
    <Section id="faq" tone="dawn" labelledBy="faq-title" ambient>
      <div ref={ref} className="faqp">
        <div className="faqp-side">
          <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="faq-title" lead={c.lead}>
            <div className="faqp-more">
              <ButtonLink to="/faq" variant="text">
                {c.all}
              </ButtonLink>
            </div>
          </SectionHeader>
          <aside className="faqp-ask" aria-labelledby="faqp-ask-title">
            <svg className="faqp-ask-art" viewBox="0 0 160 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
              <circle cx="112" cy="50" r="20" />
              <path d="M0 80c26-18 50-26 76-22s40 12 58 8 18-8 26-8v22H0Z" />
              <path d="M40 80c22-10 44-14 66-10s34 6 54 2v8H40Z" />
            </svg>
            <h3 id="faqp-ask-title" className="faqp-ask-title">
              {c.askTitle}
            </h3>
            <p className="faqp-ask-body">{c.askBody}</p>
            <ButtonLink href={waLink(c.askPrefill)} variant="wa" icon={<WaIcon />}>
              {c.askCta}
              <span className="sr-only"> {c.newTab}</span>
            </ButtonLink>
          </aside>
        </div>
        <div className="faqp-list">
          <Accordion items={items} />
        </div>
      </div>
    </Section>
  )
}
