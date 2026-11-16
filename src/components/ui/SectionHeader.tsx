/**
 * Eyebrow, SplitHeading and SectionHeader — the text parts every section starts with.
 *
 * SplitHeading re-mounts per language (key = lang) because SplitText rewrites its DOM; React must
 * never patch text inside a split element. Animate them with kit.heading() / kit.eyebrow() from
 * lib/reveal.ts (SectionHeader marks them with data-rv="heading" / "eyebrow" / "lead").
 */
import type { ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import '../../styles/ui-kit.css'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`eyebrow ${className}`} data-rv="eyebrow">
      <span className="eyebrow-line" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

type HeadingTag = 'h1' | 'h2' | 'h3'

export function SplitHeading({ as = 'h2', id, className = '', children }: { as?: HeadingTag; id?: string; className?: string; children: string }) {
  const { lang } = useI18n()
  const Tag = as
  return (
    <Tag key={lang} id={id} className={`sec-title ${className}`} data-rv="heading">
      {children}
    </Tag>
  )
}

interface HeaderProps {
  eyebrow?: string
  title: string
  titleId: string
  lead?: ReactNode
  as?: HeadingTag
  align?: 'left' | 'center'
  children?: ReactNode
}

/** Eyebrow + split title + lead. Use with `kit.eyebrow(root.querySelector('[data-rv=eyebrow]'))` etc., or revealHeader(). */
export default function SectionHeader({ eyebrow, title, titleId, lead, as = 'h2', align = 'left', children }: HeaderProps) {
  return (
    <header className={`sec-head sec-head--${align}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <SplitHeading as={as} id={titleId}>
        {title}
      </SplitHeading>
      {lead ? (
        <p className="sec-lead" data-rv="lead">
          {lead}
        </p>
      ) : null}
      {children}
    </header>
  )
}
