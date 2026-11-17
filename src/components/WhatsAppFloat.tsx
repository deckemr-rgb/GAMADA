/**
 * WhatsAppFloat — floating WhatsApp button (bottom right, above the progress rail).
 * WhatsApp green with a peach focus/hover ring, a soft pulse ring (CSS transform + opacity,
 * none under reduced motion) and a "Chat kami" tooltip on hover / focus.
 *
 * It steps aside (opacity + transform, then visibility) once the footer content scrolls into view, so it never sits
 * on the last thing on the page (the footer has its own WhatsApp link). RootLayout leaves it out on the sandboxes
 * (/demo/*, /lab/_kit), whose controls fill the bottom of the screen.
 */
import { useEffect, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { waLink } from '../content/site'
import { WaIcon } from './ui/Button'

export default function WhatsAppFloat() {
  const { t } = useI18n()
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const el = ref.current
    const foot = document.querySelector('.sfoot-inner')
    if (!el || !foot || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      el.dataset.away = String(!!e?.isIntersecting)
    })
    io.observe(foot)
    return () => io.disconnect()
  }, [])

  return (
    <a ref={ref} className="wa-float" href={waLink(t.wa.prefill)} target="_blank" rel="noopener noreferrer" aria-label={t.wa.label}>
      <span className="wa-float-pulse" aria-hidden="true" />
      <WaIcon className="wa-float-icon" />
      <span className="wa-float-tip" aria-hidden="true">
        {t.wa.tooltip}
      </span>
    </a>
  )
}
