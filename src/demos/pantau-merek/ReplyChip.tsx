/**
 * demos/pantau-merek/ReplyChip.tsx — "Dibalas 07.14 · empatik" under a review (standalone, pure props: product page
 * reuse). The reply text itself is shown by the caller.
 */
import { Icon } from '../../demo-kit/ui'

const TONE: Record<'empatik' | 'formal' | 'santai', { id: string; en: string }> = {
  empatik: { id: 'empatik', en: 'empathetic' },
  formal: { id: 'formal', en: 'formal' },
  santai: { id: 'santai', en: 'casual' },
}

export function ReplyChip({ at, tone, lang }: { at: number; tone?: 'empatik' | 'formal' | 'santai'; lang: 'id' | 'en' }) {
  const m = ((at % 1440) + 1440) % 1440
  const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(m % 60).padStart(2, '0')}`
  return (
    <span className="dk-pm-rchip">
      <Icon name="check" size={12} />
      {lang === 'id' ? `Dibalas ${hm}` : `Replied ${hm}`}
      {tone && ` · ${TONE[tone][lang]}`}
    </span>
  )
}
