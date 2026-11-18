/**
 * Human SLA wording (ARAH-VISUAL §5.1 #1): "20 j lagi", "45 mnt lagi", "Lewat 2 j", "Tuntas" — never a
 * HH:MM:SS countdown (a ticking clock only in a detail panel when < 1 h is left: `formatSlaClock`).
 * Tone: 'ok' ≥ 8 h left · 'warn' (gold) < 8 h · 'late' (red) overdue · 'done'.
 */
import type { Lang } from '../../lib/i18n'

export type SlaTone = 'ok' | 'warn' | 'late' | 'done'

/** below this many minutes left the SLA turns gold */
export const SLA_WARN_MIN = 8 * 60

export interface SlaResult {
  text: string
  tone: SlaTone
}

function span(lang: Lang, min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return lang === 'id' ? `${m} mnt` : `${m} min`
  const h = m / 60
  if (h < 48) {
    const hr = Math.round(h)
    return lang === 'id' ? `${hr} j` : `${hr} h`
  }
  const d = Math.round(h / 24)
  return lang === 'id' ? `${d} hari` : `${d} ${d === 1 ? 'day' : 'days'}`
}

/**
 * `minutesLeft` may be negative (overdue). `done` short-circuits to "Tuntas" / "Resolved". With `now` (the current
 * minute, e.g. world minutes) a deadline 2+ days away counts CALENDAR days: the day after tomorrow reads
 * "Lusa" / "in 2 days" whatever the hour, not "3 hari lagi" for a late-afternoon deadline seen early in the morning.
 */
export function formatSla(minutesLeft: number, lang: Lang, done = false, now?: number): SlaResult {
  if (done) return { text: lang === 'id' ? 'Tuntas' : 'Resolved', tone: 'done' }
  if (minutesLeft < 0) return { text: lang === 'id' ? `Lewat ${span(lang, -minutesLeft)}` : `${span(lang, -minutesLeft)} late`, tone: 'late' }
  if (now !== undefined && minutesLeft >= 24 * 60) {
    const days = Math.floor((now + minutesLeft) / 1440) - Math.floor(now / 1440)
    if (days === 2) return { text: lang === 'id' ? 'Lusa' : 'in 2 days', tone: 'ok' }
    if (days > 2) return { text: lang === 'id' ? `${days} hari lagi` : `${days} days left`, tone: 'ok' }
  }
  return { text: lang === 'id' ? `${span(lang, minutesLeft)} lagi` : `${span(lang, minutesLeft)} left`, tone: minutesLeft < SLA_WARN_MIN ? 'warn' : 'ok' }
}

/** mm:ss countdown, only meant for detail panels when less than one hour is left. */
export function formatSlaClock(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
