/**
 * Banner.tsx — the peach "Tender baru cocok" notice for the emergency tender (C21 → C22). The probability is the
 * tender's `matches[shop]` (the same number as the gauge, the feed row and the audit row).
 */
import { Button, IconButton } from '../../demo-kit/ui'
import type { Strings } from './strings'

export default function Banner({ title, pct, deadline, onOpen, onClose, t }: { title: string; pct: number; deadline: string; onOpen: () => void; onClose: () => void; t: Strings }) {
  return (
    <div className="dk-tp-banner" data-tp="banner" data-prob={pct}>
      <span className="dk-tp-banner-dot" aria-hidden="true" />
      <div className="dk-tp-banner-text">
        <p className="dk-tp-banner-title">{t.bannerTitle(title, pct, deadline)}</p>
        <p className="dk-tp-banner-body">{t.bannerBody}</p>
      </div>
      <div className="dk-tp-banner-act">
        <Button size="sm" variant="primary" icon="forward" onClick={onOpen} data-hotspot="tp-open">
          {t.open}
        </Button>
        <IconButton icon="close" size="sm" label={t.bannerClose} onClick={onClose} />
      </div>
    </div>
  )
}
