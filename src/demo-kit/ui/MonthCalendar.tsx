/**
 * MonthCalendar — a month grid (Monday first) with event chips; a week strip below 640 px or with `compact`.
 * Keyboard: the grid is one tab stop, arrows move a day / a week, Home / End the week ends, PageUp / PageDown the
 * month, Enter or Space selects (onSelect gets the date and the events of that day). `icsFor(events)` writes an
 * all-day iCalendar file of the same events ("Tambah ke kalender").
 *   events: { id, at: 'YYYY-MM-DD', label: Bi, tone?: 'neutral' | 'warn' | 'danger' | 'done', href? }
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { useMedia } from './motion'
import './calendar.css'

type Bi = { id: string; en: string }
export interface CalendarEvent { id: string; at: string; label: Bi; tone?: 'neutral' | 'warn' | 'danger' | 'done'; href?: string }
export interface MonthCalendarProps {
  /** 'YYYY-MM' shown first */
  month: string
  /** 'YYYY-MM-DD' (the world day) */
  today: string
  events: readonly CalendarEvent[]
  onSelect?: (date: string, events: CalendarEvent[]) => void
  /** force the week strip */
  compact?: boolean
  label: Bi
  className?: string
}

const NAMES = {
  id: { days: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], prev: 'Bulan sebelumnya', next: 'Bulan berikutnya', prevW: 'Minggu sebelumnya', nextW: 'Minggu berikutnya', today: 'hari ini', none: 'Tidak ada jadwal' },
  en: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], prev: 'Previous month', next: 'Next month', prevW: 'Previous week', nextW: 'Next week', today: 'today', none: 'Nothing scheduled' },
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (s: string) => new Date(`${s}T00:00:00Z`)
const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const addMonths = (m: string, n: number) => {
  const d = parse(`${m}-01`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return iso(d).slice(0, 7)
}
/** Monday-based weekday 0..6 */
const dow = (s: string) => (parse(s).getUTCDay() + 6) % 7

export function MonthCalendar({ month, today, events, onSelect, compact, label, className }: MonthCalendarProps) {
  const { lang } = useI18n()
  const t = NAMES[lang]
  const narrow = useMedia('(max-width: 639px)')
  const strip = compact || narrow
  const [shown, setShown] = useState(month)
  const [focus, setFocus] = useState(() => (today.startsWith(month) ? today : `${month}-01`))
  useEffect(() => {
    setShown(month)
  }, [month])
  const grid = useRef<HTMLDivElement>(null)
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) m.set(e.at, [...(m.get(e.at) ?? []), e])
    return m
  }, [events])
  const fmtMonth = (m: string) => parse(`${m}-01`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const fmtDay = (d: string) => parse(d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  // the days on screen: the month grid (6 weeks) or the week of the focused day
  const days = useMemo(() => {
    if (strip) {
      const start = addDays(focus, -dow(focus))
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    const first = `${shown}-01`
    const start = addDays(first, -dow(first))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [strip, shown, focus])

  const move = (to: string) => {
    setFocus(to)
    if (!to.startsWith(shown)) setShown(to.slice(0, 7))
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${to}"]`)?.focus())
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (k in map) move(addDays(focus, map[k]!))
    else if (k === 'Home') move(addDays(focus, -dow(focus)))
    else if (k === 'End') move(addDays(focus, 6 - dow(focus)))
    else if (k === 'PageUp') move(`${addMonths(focus.slice(0, 7), -1)}-${focus.slice(8)}`.replace(/-(3[01])$/, '-28'))
    else if (k === 'PageDown') move(`${addMonths(focus.slice(0, 7), 1)}-${focus.slice(8)}`.replace(/-(3[01])$/, '-28'))
    else if (k === 'Enter' || k === ' ') onSelect?.(focus, byDay.get(focus) ?? [])
    else return
    e.preventDefault()
  }
  const step = (n: number) => (strip ? move(addDays(focus, 7 * n)) : (setShown(addMonths(shown, n)), setFocus(`${addMonths(shown, n)}-01`)))

  return (
    <section className={`dk-cal${strip ? ' is-strip' : ''}${className ? ` ${className}` : ''}`} aria-label={label[lang]}>
      <header className="dk-cal-head">
        <button type="button" className="dk-cal-nav" onClick={() => step(-1)} aria-label={strip ? t.prevW : t.prev}>
          ‹
        </button>
        <h3 className="dk-cal-title" aria-live="polite">
          {fmtMonth(strip ? focus.slice(0, 7) : shown)}
        </h3>
        <button type="button" className="dk-cal-nav" onClick={() => step(1)} aria-label={strip ? t.nextW : t.next}>
          ›
        </button>
      </header>
      <div className="dk-cal-dow" aria-hidden="true">
        {t.days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div ref={grid} className="dk-cal-grid" role="grid" aria-label={fmtMonth(shown)} onKeyDown={onKey}>
        {Array.from({ length: days.length / 7 }, (_, w) => (
          <div key={w} role="row" className="dk-cal-row">
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const evs = byDay.get(d) ?? []
              const out = !strip && !d.startsWith(shown)
              const tone = evs.find((x) => x.tone === 'danger')?.tone ?? evs.find((x) => x.tone === 'warn')?.tone ?? evs[0]?.tone
              return (
                <div
                  key={d}
                  role="gridcell"
                  data-day={d}
                  tabIndex={d === focus ? 0 : -1}
                  aria-selected={d === focus}
                  aria-current={d === today ? 'date' : undefined}
                  aria-label={`${fmtDay(d)}${d === today ? ` (${t.today})` : ''}: ${evs.length ? evs.map((x) => x.label[lang]).join(', ') : t.none}`}
                  className={`dk-cal-day${out ? ' is-out' : ''}${d === today ? ' is-today' : ''}${evs.length ? ` has-ev is-${tone ?? 'neutral'}` : ''}`}
                  onClick={() => {
                    setFocus(d)
                    onSelect?.(d, evs)
                  }}
                >
                  <span className="dk-cal-num">{Number(d.slice(8))}</span>
                  {evs.slice(0, strip ? 3 : 2).map((x) => (
                    <span key={x.id} className={`dk-cal-ev is-${x.tone ?? 'neutral'}`}>
                      {x.label[lang]}
                    </span>
                  ))}
                  {evs.length > (strip ? 3 : 2) && <span className="dk-cal-more">+{evs.length - (strip ? 3 : 2)}</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

/** all-day iCalendar (RFC 5545) of the events; `lang` picks the label language */
export function icsFor(events: readonly CalendarEvent[], opts: { lang?: 'id' | 'en'; calName?: string; stamp?: string } = {}): string {
  const lang = opts.lang ?? 'id'
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const stamp = opts.stamp ?? '20261117T000000Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GAMADA//Demo simulasi//ID', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(opts.calName ?? 'GAMADA (simulasi)')}`]
  for (const e of events) {
    const d = e.at.replace(/-/g, '')
    lines.push('BEGIN:VEVENT', `UID:${e.id}@demo.gamada.id`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(e.at, 1).replace(/-/g, '')}`, `SUMMARY:${esc(e.label[lang])}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
