/**
 * demos/juara-jualan/Transcript.tsx — the transcript synced to the playback clock: the current line is highlighted
 * (and kept in view inside its own scroller), a click on a line seeks there. WA chats render as bubbles. In English the
 * Indonesian original stays and the translation sits under it.
 */
import { useEffect, useRef } from 'react'
import { mmss } from '../../demo-kit/media'
import { CALL_CRITERIA } from '../../demo-kit/world/usaha-pintar'
import type { BuiltClip } from './clips'
import type { Lang, Strings } from './strings'

export interface TranscriptProps {
  clip: BuiltClip
  current: number
  wa: boolean
  agent: string
  customer: string
  onLine: (i: number) => void
  t: Strings
  lang: Lang
}

export function Transcript({ clip, current, wa, agent, customer, onLine, t, lang }: TranscriptProps) {
  const box = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const root = box.current
    const li = root?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!root || !li) return
    const top = li.offsetTop - root.offsetTop
    if (top < root.scrollTop || top + li.offsetHeight > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, top - 12)
  }, [current])
  return (
    <ol ref={box} className={`dk-jj-tx${wa ? ' is-wa' : ''}`} aria-label={t.transcript}>
      {clip.segments.map((s, i) => {
        const l = clip.lines[i]!
        const miss = l.tags.filter((g) => !g.ok)
        return (
          <li key={s.id} className={`dk-jj-tl is-${l.sp}${i === current ? ' is-on' : ''}${miss.length ? ' is-miss' : ''}`} aria-current={i === current ? 'true' : undefined} data-line={i}>
            <button type="button" className="dk-jj-tl-btn" onClick={() => onLine(i)} aria-label={`${t.seekTo(mmss(s.start))}: ${l.sp === 'a' ? agent : customer}`}>
              <span className="dk-jj-tl-h">
                <b>{l.sp === 'a' ? agent : customer}</b>
                <span className="dk-num">{mmss(s.start)}</span>
                {miss.map((g) => (
                  <span key={g.k} className={`dk-jj-tag${g.k === clip.weak ? ' is-danger' : ''}`}>
                    {CALL_CRITERIA[g.k][lang]}
                  </span>
                ))}
              </span>
              <span className="dk-jj-tl-t">{s.text}</span>
              {lang === 'en' && s.en && <span className="dk-jj-tl-en">{s.en}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
