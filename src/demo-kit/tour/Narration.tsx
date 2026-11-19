/**
 * tour/Narration.tsx — chapter n / 20, the big world clock, title (Fraunces), body (≤ 60 words), "Yang terjadi",
 * the current step caption, and a polite live region (chapter title + first sentence on change; captions ≤ 1 / 5 s).
 */
import { useEffect, useRef, useState } from 'react'
import { useClock, formatTime } from '../world'
import { fillText } from './narration-load'
import { TOUR_STRINGS, fill } from './strings'
import type { Fills, Lang, NarrationEntry } from './types'

export function BigClock({ lang }: { lang: Lang }) {
  const { minutes } = useClock()
  const h = (minutes / 60) % 12
  const m = minutes % 60
  return (
    <span className="dk-tour-clock" aria-label={formatTime(minutes)}>
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" className="dk-tour-clock-face" />
        <line x1="20" y1="20" x2="20" y2="10" className="dk-tour-clock-h" style={{ transform: `rotate(${h * 30}deg)` }} />
        <line x1="20" y1="20" x2="20" y2="6" className="dk-tour-clock-m" style={{ transform: `rotate(${m * 6}deg)` }} />
      </svg>
      <span className="dk-tour-clock-t">{formatTime(minutes).replace(':', lang === 'id' ? '.' : ':')}</span>
    </span>
  )
}

export function NarrationText({ entry, fills, cap, lang, n, total, compact = false }: { entry: NarrationEntry | undefined; fills: Fills; cap: number | null; lang: Lang; n: number; total: number; compact?: boolean }) {
  const t = TOUR_STRINGS[lang]
  const title = entry ? fillText(entry.title, fills) : ''
  const body = entry ? fillText(entry.body, fills) : ''
  const caption = entry && cap != null && entry.caps[cap] ? fillText(entry.caps[cap]!, fills) : null
  // live region: title + first sentence on chapter change, captions throttled to one per 5 s
  const [live, setLive] = useState('')
  const lastCap = useRef(0)
  useEffect(() => {
    if (!entry) return
    setLive(`${fill(t.chapterOf, { n, total })}. ${title}. ${body.split(/(?<=[.!?])\s/)[0] ?? ''}`)
    lastCap.current = Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, entry, lang])
  useEffect(() => {
    if (!caption || Date.now() - lastCap.current < 5000) return
    lastCap.current = Date.now()
    setLive(caption)
  }, [caption])
  return (
    <div className="dk-tour-narr">
      <h1 className="dk-tour-title">{title}</h1>
      {!compact ? <p className="dk-tour-body">{body}</p> : null}
      {caption ? (
        <p className="dk-tour-caption" data-tour="caption">
          {caption}
        </p>
      ) : null}
      {!compact && entry && entry.happened.length ? (
        <section className="dk-tour-happened" aria-label={t.happened}>
          <h2 className="dk-tour-eyebrow">{t.happened}</h2>
          <ul>
            {entry.happened.map((h, i) => (
              <li key={i}>{fillText(h, fills)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
