/**
 * Deadlines.tsx (lazy) — the deadline calendar of the open matched tenders (MonthCalendar; week strip on phones) and
 * the .ics export. Dates come from the tenders' `deadlineAt` (the same as the countdown chips).
 */
import { useMemo, useState } from 'react'
import { Button, MonthCalendar, icsFor, type CalendarEvent } from '../../demo-kit/ui'
import { rows, useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { deadlineText, isoOf } from './model'
import { DOC_STRINGS, useDocT } from './strings-doc'

const whole = (s: WorldState) => s

export default function Deadlines({ tenderId }: { tenderId: string }) {
  const { d, lang } = useDocT()
  const s = useWorld(whole)
  const now = useClock().minutes
  const [said, setSaid] = useState('')
  const events = useMemo<CalendarEvent[]>(() => {
    const shop = s.meta.shopId
    return rows(s.tenders)
      .filter((t) => t.status === 'dibuka' && t.publishedAt <= now && t.deadlineAt > now && t.matches[shop] !== undefined)
      .map((t) => ({
        id: t.id,
        at: isoOf(s.day, t.deadlineAt),
        label: { id: `Tenggat ${t.code} ${t.title.id} (${deadlineText(s.day, t.deadlineAt, 'id')})`, en: `Deadline ${t.code} ${t.title.en} (${deadlineText(s.day, t.deadlineAt, 'en')})` },
        tone: t.id === tenderId ? 'danger' : t.deadlineAt - now <= 3 * 1440 ? 'warn' : 'neutral',
      }))
  }, [s, now, tenderId])
  const today = isoOf(s.day, now)
  const download = () => {
    const text = icsFor(events, { lang, calName: 'TenderPilot (simulasi)' })
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'tenderpilot-tenggat.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="dk-tp-deadlines">
      <MonthCalendar month={today.slice(0, 7)} today={today} events={events} label={{ id: DOC_STRINGS.id.calTitle, en: DOC_STRINGS.en.calTitle }} onSelect={(date, ev) => setSaid(d.calPick(ev.length, date))} />
      <p className="dk-tp-muted" role="status" aria-live="polite">
        {said}
      </p>
      <Button size="sm" variant="ghost" icon="download" onClick={download} data-tp="ics">
        {d.ics}
      </Button>
    </div>
  )
}
