/** DemoLink — a link to another demo when it is READY (else plain text), keeping region / language. */
import type { ReactNode } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import type { ProductSlug } from '../../content/products'
import { withSession } from './model'

export function DemoLink({ slug, href, children, className }: { slug: ProductSlug; href: string; children: ReactNode; className?: string }) {
  return DEMO_READY[slug] ? (
    <AppLink to={withSession(href)} className={className}>
      {children}
    </AppLink>
  ) : (
    <span className={className}>{children}</span>
  )
}
