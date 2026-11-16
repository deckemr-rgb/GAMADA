/**
 * Contact — the closing CTA: a big dusk panel (CSS sunset sky + gold horizon glow + SVG hills with a
 * scroll-drawn rim light, fireflies), the WhatsApp CTA (magnetic), the email when SITE.email is set,
 * and a short form. No backend: the form validates inline, then opens WhatsApp in a new tab with the
 * message pre-filled and shows a success state (role="status") with a fallback link.
 * Reveals: lib/reveal.ts; the success state animates transform / opacity only.
 */
import { useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { EASE, prefersReducedMotion } from '../lib/motion'
import { SITE, waLink } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import { MagneticLink, WaIcon } from '../components/ui/Button'
import Fireflies from '../components/Fireflies'
import '../styles/sections/contact.css'

/* ---- local constants (to be moved into motion.ts / a form config by the integrator) */
const CONTACT = {
  nameMin: 2,
  messageMin: 10,
  /** Success state entrance (s). */
  successDur: 0.6,
  successStagger: 0.08,
} as const

type Field = 'name' | 'need' | 'message'
interface Values {
  name: string
  /** Index into copy.form.needs as a string ('' = nothing chosen) so a language switch keeps it. */
  need: string
  message: string
}
type Errors = Partial<Record<Field, true>>

const EMPTY: Values = { name: '', need: '', message: '' }
const ORDER: Field[] = ['name', 'need', 'message']

function validate(v: Values): Errors {
  const e: Errors = {}
  if (v.name.trim().length < CONTACT.nameMin) e.name = true
  if (v.need === '') e.need = true
  if (v.message.trim().length < CONTACT.messageMin) e.message = true
  return e
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.5 6.6 11.5 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Contact() {
  const { t } = useI18n()
  const c = t.home.contact
  const f = c.form

  const ref = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const fieldRefs = useRef<Partial<Record<Field, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({})

  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [attempted, setAttempted] = useState(false)
  const [sentText, setSentText] = useState<string | null>(null)
  const refocusName = useRef(false)

  useReveal(ref, (kit, root) => {
    kit.image(root.querySelector('.ctc-art'))
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .ctc-actions, .ctc-points'), { stagger: 0.1 })
    kit.cards(root.querySelectorAll('.ctc-card'))
    kit.stroke(root.querySelectorAll('.ctc-ridge'), root.querySelector('.ctc-panel'), { start: 'top 80%', end: 'bottom 85%' })
  })

  // success entrance (transform / opacity), then focus its heading
  useLayoutEffect(() => {
    const el = successRef.current
    if (!sentText && refocusName.current) {
      refocusName.current = false
      fieldRefs.current.name?.focus()
    }
    if (!sentText || !el) return
    const parts = el.querySelectorAll('[data-anim]')
    const icon = el.querySelector('.ctc-ok-icon')
    const reduced = prefersReducedMotion()
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.from(el, { opacity: 0, duration: 0.3 })
        return
      }
      if (icon) gsap.from(icon, { scale: 0.4, opacity: 0, duration: CONTACT.successDur, ease: EASE.overshoot })
      gsap.from(parts, { y: 16, opacity: 0, duration: CONTACT.successDur, ease: EASE.out, stagger: CONTACT.successStagger, delay: 0.08 })
    }, el)
    el.querySelector<HTMLElement>('.ctc-ok-title')?.focus({ preventScroll: true })
    return () => ctx.revert()
  }, [sentText])

  const onChange = (field: Field) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...values, [field]: e.target.value }
    setValues(next)
    // after the first submit, errors clear (or come back) as the visitor types
    if (attempted) setErrors(validate(next))
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errs = validate(values)
    setAttempted(true)
    setErrors(errs)
    const firstBad = ORDER.find((k) => errs[k])
    if (firstBad) {
      fieldRefs.current[firstBad]?.focus()
      return
    }
    const needLabel = f.needs[Number(values.need)] ?? f.needs[f.needs.length - 1] ?? ''
    const text = f.compose(values.name.trim(), needLabel, values.message.trim())
    window.open(waLink(text), '_blank', 'noopener')
    setSentText(text)
  }

  const reset = () => {
    setSentText(null)
    setValues(EMPTY)
    setErrors({})
    setAttempted(false)
    refocusName.current = true // focus the first field once the form is back (layout effect)
  }

  const describe = (field: Field) => (errors[field] ? `ctc-${field}-err` : undefined)

  return (
    <Section id="kontak" tone="ink" labelledBy="kontak-title" fireflies={0.4} width="wide">
      <div ref={ref} className="ctc">
        <div className="ctc-panel">
          <div className="ctc-art" aria-hidden="true">
            <div className="ctc-sky">
              <span className="ctc-glow" />
            </div>
            <Fireflies seed={41} density={0.9} className="ctc-flies" />
            <svg className="ctc-hills" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
              <defs>
                <radialGradient id="ctc-sun" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#fff1c4" />
                  <stop offset="0.55" stopColor="#ffd77e" />
                  <stop offset="1" stopColor="#f59a62" />
                </radialGradient>
              </defs>
              <circle className="ctc-sun" cx="1040" cy="150" r="62" fill="url(#ctc-sun)" />
              <path
                className="ctc-hill ctc-hill--back"
                d="M0 182c96-34 196-58 300-48 112 11 176 52 296 50 120-2 196-60 324-66 120-5 214 40 320 46 82 5 150-14 200-26V320H0Z"
              />
              <path
                className="ctc-ridge"
                d="M0 182c96-34 196-58 300-48 112 11 176 52 296 50 120-2 196-60 324-66 120-5 214 40 320 46 82 5 150-14 200-26"
              />
              <path
                className="ctc-hill ctc-hill--mid"
                d="M0 236c120-30 220-40 340-22 120 18 210 44 340 34 130-10 220-52 360-50 150 2 260 38 400 30V320H0Z"
              />
              <path className="ctc-hill ctc-hill--front" d="M0 284c160-20 300-26 470-14 160 11 300 24 470 18 190-7 330-26 500-20V320H0Z" />
            </svg>
          </div>

          <div className="ctc-grid">
            <div className="ctc-copy">
              <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="kontak-title" lead={c.lead} />
              <div className="ctc-actions">
                <MagneticLink href={waLink(c.waPrefill)} variant="wa" icon={<WaIcon />} className="ctc-wa">
                  {c.waCta}
                  <span className="sr-only"> {f.newTab}</span>
                </MagneticLink>
                {SITE.email ? (
                  <p className="ctc-email">
                    {c.emailLabel} <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                  </p>
                ) : null}
              </div>
              <ul className="ctc-points">
                <li>
                  <Check />
                  {c.points.free}
                </li>
                <li>
                  <Check />
                  {c.points.reply(SITE.stats.responseHours)}
                </li>
                <li>
                  <Check />
                  {c.points.estimate}
                </li>
              </ul>
            </div>

            <div className="ctc-card">
              <form
                className="ctc-form"
                noValidate
                onSubmit={onSubmit}
                aria-labelledby="ctc-form-title"
                data-done={!!sentText}
                inert={!!sentText}
                aria-hidden={sentText ? true : undefined}
              >
                <h3 id="ctc-form-title" className="ctc-form-title">
                  {f.title}
                </h3>
                <p className="ctc-form-note">{f.note}</p>

                <div className="ctc-field" data-invalid={!!errors.name}>
                  <label htmlFor="ctc-name">{f.name}</label>
                  <input
                    ref={(el) => {
                      fieldRefs.current.name = el
                    }}
                    id="ctc-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder={f.namePh}
                    value={values.name}
                    onChange={onChange('name')}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={describe('name')}
                    aria-required="true"
                  />
                  {errors.name ? (
                    <p id="ctc-name-err" className="ctc-err">
                      {f.errors.name}
                    </p>
                  ) : null}
                </div>

                <div className="ctc-field" data-invalid={!!errors.need}>
                  <label htmlFor="ctc-need">{f.need}</label>
                  <div className="ctc-select">
                    <select
                      ref={(el) => {
                        fieldRefs.current.need = el
                      }}
                      id="ctc-need"
                      name="need"
                      value={values.need}
                      onChange={onChange('need')}
                      aria-invalid={errors.need ? true : undefined}
                      aria-describedby={describe('need')}
                      aria-required="true"
                    >
                      <option value="" disabled>
                        {f.needPh}
                      </option>
                      {f.needs.map((n, i) => (
                        <option key={i} value={String(i)}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {errors.need ? (
                    <p id="ctc-need-err" className="ctc-err">
                      {f.errors.need}
                    </p>
                  ) : null}
                </div>

                <div className="ctc-field" data-invalid={!!errors.message}>
                  <label htmlFor="ctc-message">{f.message}</label>
                  <textarea
                    ref={(el) => {
                      fieldRefs.current.message = el
                    }}
                    id="ctc-message"
                    name="message"
                    rows={4}
                    placeholder={f.messagePh}
                    value={values.message}
                    onChange={onChange('message')}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={describe('message')}
                    aria-required="true"
                  />
                  {errors.message ? (
                    <p id="ctc-message-err" className="ctc-err">
                      {f.errors.message}
                    </p>
                  ) : null}
                </div>

                <button type="submit" className="btn btn--primary ctc-submit">
                  <span className="btn-label">
                    <span className="btn-icon" aria-hidden="true">
                      <WaIcon />
                    </span>
                    {f.submit}
                    <span className="sr-only"> {f.newTab}</span>
                  </span>
                </button>
              </form>

              {/* the live region stays mounted (never display:none) so the success text is announced;
                  it holds only the message, the follow-up actions sit next to it */}
              <div ref={successRef} className="ctc-done">
                <div role="status" className="ctc-status">
                  {sentText ? (
                    <div className="ctc-ok">
                      <span className="ctc-ok-icon" aria-hidden="true">
                        <Check />
                      </span>
                      <h3 className="ctc-ok-title" tabIndex={-1} data-anim>
                        {f.successTitle}
                      </h3>
                      <p className="ctc-ok-body" data-anim>
                        {f.successBody}
                      </p>
                    </div>
                  ) : null}
                </div>
                {sentText ? (
                  <div className="ctc-ok-actions" data-anim>
                    <a className="btn btn--wa" href={waLink(sentText)} target="_blank" rel="noopener noreferrer">
                      <span className="btn-label">
                        <span className="btn-icon" aria-hidden="true">
                          <WaIcon />
                        </span>
                        {f.successRetry}
                        <span className="sr-only"> {f.newTab}</span>
                      </span>
                    </a>
                    <button type="button" className="btn btn--ghost" onClick={reset}>
                      <span className="btn-label">{f.successAgain}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
