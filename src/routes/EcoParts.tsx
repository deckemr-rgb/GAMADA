/**
 * EcoParts — small pieces shared by the ecosystem routes (/ekosistem, /ekosistem/:eco, /produk/:slug, /tur, /lab):
 * product card, ecosystem badge, WhatsApp "Hubungi kami" button, CTA band and the `fill()` template helper.
 * Tahap-1 functional versions on the site's dusk layer (the cinematic design arrives in tahap 6).
 */
import type { ReactNode } from 'react'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, type EcoOrInti, type ProductDef } from '../content/products'
import { waLink } from '../content/site'
import Card from '../components/ui/Card'
import { ButtonLink, WaIcon } from '../components/ui/Button'
import AppLink from '../components/AppLink'
import { Icon } from '../demo-kit/ui/icons'
import '../styles/eco.css'
import Arrow from '../components/ui/Arrow'

/** "{n} produk" + { n: 17 } → "17 produk" (unknown keys stay as they are). */
export function fill(s: string, v: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
}

/** The ecosystems in display order (Inti last: it is the foundation under the three). */
export const ECO_ORDER: readonly EcoOrInti[] = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti']

export function EcoBadge({ eco, className = '' }: { eco: EcoOrInti; className?: string }) {
  return (
    <span className={`eco-badge ${className}`} data-eco={eco}>
      <span className="eco-badge-dot" aria-hidden="true" />
      {ECOSYSTEMS[eco].name}
    </span>
  )
}

/** Product card: the whole card is one link to /produk/<slug> (or `to`). */
export function ProductCard({ p, to, cta, as = 'li', compact = false }: { p: ProductDef; to?: string; cta?: string; as?: 'li' | 'div'; compact?: boolean }) {
  const { lang, eco: copy } = useEcoI18n()
  return (
    <Card as={as} className={`eco-pcard${compact ? ' is-compact' : ''}`}>
      <AppLink to={to ?? `/produk/${p.slug}`} className="eco-pcard-link" data-eco={p.eco}>
        <span className="eco-pcard-top">
          <span className="eco-pcard-icon">
            <Icon name={p.icon} size={22} />
          </span>
          <span className="eco-pcard-code" aria-hidden="true">
            {p.code}
          </span>
        </span>
        <span className="eco-pcard-name">{p.name}</span>
        <span className="eco-pcard-desc">{p.descriptor[lang]}</span>
        {compact ? null : <span className="eco-pcard-tag">{p.tagline[lang]}</span>}
        <span className="eco-pcard-more">
          {cta ?? copy.common.productPage}
          <Arrow />
        </span>
      </AppLink>
    </Card>
  )
}

/** "Hubungi kami" — WhatsApp with a prefilled message (site.ts waLink). */
export function ContactButton({ text, label }: { text: string; label?: string }) {
  const { eco: copy } = useEcoI18n()
  const l = label ?? copy.common.contact
  return (
    <ButtonLink href={waLink(text)} variant="wa" icon={<WaIcon />} ariaLabel={`${l} ${copy.common.newTab}`}>
      {l}
    </ButtonLink>
  )
}

export function CtaRow({ children }: { children: ReactNode }) {
  return <div className="eco-ctas">{children}</div>
}

/** Closing band: heading, lead and actions. */
export function CtaBand({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="eco-band" aria-labelledby={id}>
      <div className="eco-band-sky" aria-hidden="true" />
      <h2 id={id} className="eco-band-title">
        {title}
      </h2>
      {lead ? <p className="eco-band-lead">{lead}</p> : null}
      <CtaRow>{children}</CtaRow>
    </section>
  )
}

/** Section heading used inside the page body. */
export function BodyHead({ id, eyebrow, title, lead, aside }: { id: string; eyebrow?: string; title: string; lead?: string; aside?: ReactNode }) {
  return (
    <header className="eco-head">
      <div>
        {eyebrow ? <p className="eco-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className="eco-h2">
          {title}
        </h2>
        {lead ? <p className="eco-lead">{lead}</p> : null}
      </div>
      {aside ? <div className="eco-head-aside">{aside}</div> : null}
    </header>
  )
}
