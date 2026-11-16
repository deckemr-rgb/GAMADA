/**
 * WhatsAppFloat — floating WhatsApp button (bottom right, above the progress rail).
 * WhatsApp green with a peach focus/hover ring, a soft pulse ring (CSS transform + opacity,
 * none under reduced motion) and a "Chat kami" tooltip on hover / focus.
 */
import { useI18n } from '../lib/i18n'
import { waLink } from '../content/site'

export default function WhatsAppFloat() {
  const { t } = useI18n()
  return (
    <a className="wa-float" href={waLink(t.wa.prefill)} target="_blank" rel="noopener noreferrer" aria-label={t.wa.label}>
      <span className="wa-float-pulse" aria-hidden="true" />
      <svg className="wa-float-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.04 3.2c-7.06 0-12.8 5.7-12.8 12.73 0 2.25.6 4.45 1.72 6.38L3.13 29l6.9-1.8a12.85 12.85 0 0 0 6 1.52h.01c7.06 0 12.8-5.7 12.8-12.73A12.68 12.68 0 0 0 16.04 3.2Zm0 23.33h-.01a10.66 10.66 0 0 1-5.42-1.48l-.39-.23-4.1 1.07 1.1-3.98-.26-.41a10.5 10.5 0 0 1-1.62-5.6c0-5.85 4.78-10.6 10.66-10.6a10.6 10.6 0 0 1 10.65 10.61c0 5.86-4.78 10.62-10.61 10.62Zm5.84-7.94c-.32-.16-1.89-.93-2.18-1.03-.3-.11-.51-.16-.72.16-.21.32-.83 1.03-1.01 1.24-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58a9.6 9.6 0 0 1-1.78-2.2c-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.72-.98-2.36-.26-.62-.53-.53-.72-.54h-.62c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.65 0 1.57 1.15 3.08 1.3 3.29.17.21 2.26 3.43 5.47 4.81.77.33 1.36.53 1.83.68.77.24 1.47.2 2.02.12.62-.09 1.89-.77 2.16-1.51.27-.75.27-1.38.19-1.51-.08-.14-.29-.22-.61-.38Z"
        />
      </svg>
      <span className="wa-float-tip" aria-hidden="true">
        {t.wa.tooltip}
      </span>
    </a>
  )
}
