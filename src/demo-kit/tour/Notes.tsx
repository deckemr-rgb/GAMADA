/**
 * tour/Notes.tsx (lazy, /tur?notes=1) — the presenter notes window (Tahap 7 Could item 14). A second window that
 * follows the tour in the main window over a BroadcastChannel: chapter, narration (filled with the world numbers the
 * main window sends), "what happened", the next chapter and a chapter timer. It never drives the tour and loads no
 * world. `useNotesBridge` is the main window's side (called by the Player).
 */
import { useEffect, useRef, useState } from 'react'
import { TOUR_CHAPTERS } from '../../content/tour'
import { chapterOf, SUMMARY_N } from './chapters'
import { fillText, useNarration } from './narration-load'
import type { TourState } from './store'
import { TOUR_STRINGS, fill } from './strings'
import type { Fills, Lang } from './types'

const CHANNEL = 'gamada-tour-notes'

/** this window's own words (kept out of TOUR_STRINGS so the /tur first load does not carry them) */
export const NOTES_STRINGS = {
  id: {
    notes: 'Catatan presenter',
    open: 'Buka catatan presenter di jendela kedua',
    wait: 'Menunggu tur di jendela utama. Mulai tur di sana; catatan ini mengikuti bab, narasi, dan waktunya.',
    next: 'Berikutnya',
  },
  en: {
    notes: 'Presenter notes',
    open: 'Open the presenter notes in a second window',
    wait: 'Waiting for the tour in the main window. Start the tour there; these notes follow its chapter, narration and timing.',
    next: 'Next',
  },
} as const

interface NotesMsg {
  type: 'state'
  n: number
  phase: string
  playing: boolean
  rate: number
  lang: Lang
  fills: Fills
  /** chapter time already played (ms, wall clock) when this message was sent */
  elapsed: number
}

const channel = (): BroadcastChannel | null => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null)

/** main window: post the tour state on every chapter / play / fills change, and answer a notes window's "hello" */
export function useNotesBridge(st: TourState, lang: Lang): void {
  const ch = useRef<BroadcastChannel | null>(null)
  const clock = useRef({ n: -1, acc: 0, since: 0, playing: false })
  const last = useRef<() => void>(() => undefined)

  useEffect(() => {
    const c = channel()
    ch.current = c
    if (!c) return
    c.onmessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === 'hello') last.current()
    }
    return () => {
      c.close()
      ch.current = null
    }
  }, [])

  useEffect(() => {
    const k = clock.current
    const now = performance.now()
    if (k.n !== st.n) {
      k.n = st.n
      k.acc = 0
      k.since = now
    } else if (k.playing && !st.playing) k.acc += now - k.since
    else if (!k.playing && st.playing) k.since = now
    k.playing = st.playing
    const send = () => {
      const t = performance.now()
      const msg: NotesMsg = { type: 'state', n: st.n, phase: st.phase, playing: st.playing, rate: st.rate, lang, fills: st.fills, elapsed: k.acc + (k.playing ? t - k.since : 0) }
      ch.current?.postMessage(msg)
    }
    last.current = send
    send()
  }, [st.n, st.phase, st.playing, st.rate, st.fills, lang])
}

const mmss = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Notes({ lang: pageLang }: { lang: Lang }) {
  const [msg, setMsg] = useState<NotesMsg | null>(null)
  const [at, setAt] = useState(0)
  const [, tick] = useState(0)
  const lang = msg?.lang ?? pageLang
  const t = TOUR_STRINGS[lang]
  const w = NOTES_STRINGS[lang]
  const narr = useNarration(lang)

  useEffect(() => {
    const c = channel()
    if (!c) return
    c.onmessage = (e: MessageEvent<NotesMsg>) => {
      if (e.data?.type !== 'state') return
      setMsg(e.data)
      setAt(performance.now())
    }
    c.postMessage({ type: 'hello' })
    return () => c.close()
  }, [])

  useEffect(() => {
    if (!msg?.playing) return
    const id = window.setInterval(() => tick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [msg])

  const n = msg?.n ?? 0
  const summary = msg?.phase === 'summary' || n >= SUMMARY_N
  const entry = msg && narr ? narr[n] : undefined
  const fills = msg?.fills ?? {}
  const elapsed = msg ? msg.elapsed + (msg.playing ? performance.now() - at : 0) : 0
  const dur = ((chapterOf(n)?.duration ?? 0) * 1000) / (msg?.rate || 1)
  const nextTitle = !summary ? (n + 1 >= SUMMARY_N ? t.summary : TOUR_CHAPTERS.find((c) => c.n === n + 1)?.title[lang]) : null

  return (
    <section className="dk-tour-notes" lang={lang} aria-label={w.notes}>
      <title>{w.notes}</title>
      <p className="dk-tour-eyebrow">{w.notes}</p>
      {!msg || msg.phase === 'opener' || msg.phase === 'poster' ? (
        <p className="dk-tour-body">{w.wait}</p>
      ) : (
        <>
          <h1 className="dk-tour-op-title dk-tour-op-title--sm" aria-live="polite">
            {summary ? t.summary : `${fill(t.chapterOf, { n, total: SUMMARY_N })} · ${entry ? fillText(entry.title, fills) : ''}`}
          </h1>
          <p className="dk-tour-notes-timer" data-playing={msg.playing ? '' : undefined}>
            {mmss(elapsed)}
            {dur ? ` / ${mmss(dur)}` : ''} · {msg.playing ? t.play : t.paused}
          </p>
          {entry ? <p className="dk-tour-body">{fillText(entry.body, fills)}</p> : null}
          {entry?.happened.length ? (
            <>
              <h2 className="dk-tour-eyebrow">{t.happened}</h2>
              <ul className="dk-tour-notes-list">
                {entry.happened.map((h, i) => (
                  <li key={i}>{fillText(h, fills)}</li>
                ))}
              </ul>
            </>
          ) : null}
          {nextTitle ? (
            <p className="dk-tour-fine">
              {w.next}: {nextTitle}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
