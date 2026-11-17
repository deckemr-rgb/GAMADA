/**
 * PageShell — shared hero + body frame for the inner pages (dusk hero, fireflies, eyebrow, h1,
 * lead, optional CTA row), plus the per-route <title> / meta description (React 19 hoists them into <head>).
 */
import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import Fireflies from './Fireflies'
import { Eyebrow } from './ui/SectionHeader'

interface Props {
  eyebrow: string
  title: string
  lead: string
  /** <title> text; defaults to "title — GAMADA". */
  docTitle?: string
  children?: ReactNode
  /** Extra content inside the hero above the eyebrow (back link …). */
  heroExtra?: ReactNode
  /** The page's primary actions (CTA row), set right under the lead inside the hero. */
  actions?: ReactNode
}

export default function PageShell({ eyebrow, title, lead, docTitle, children, heroExtra, actions }: Props) {
  const { t } = useI18n()
  return (
    <>
      <title>{docTitle ?? `${title} — GAMADA`}</title>
      <meta name="description" content={lead} />
      <section className="page-hero">
        <div className="page-hero-sky" aria-hidden="true" />
        <Fireflies seed={title.length} density={0.7} />
        <div className="page-hero-inner">
          {heroExtra}
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="page-title">{title}</h1>
          <p className="page-lead">{lead}</p>
          {actions ? <div className="page-hero-actions">{actions}</div> : null}
        </div>
      </section>
      <div className="page-body">{children ?? <p className="page-building">{t.pages.building}</p>}</div>
    </>
  )
}
