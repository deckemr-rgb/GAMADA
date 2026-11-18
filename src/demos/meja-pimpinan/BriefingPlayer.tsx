/**
 * BriefingPlayer (lazy, loads on "Dengarkan briefing") — reads the briefing aloud with the browser voice
 * (id-ID / en-GB), segment by segment, and reports the item being read so the panel can highlight it. Without a
 * voice it runs the same timeline silently (text mode) so the highlight still walks the items. Stopping is the panel's
 * own "Hentikan" button (one stop control); this bar offers pause / resume.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { IconButton } from '../../demo-kit/ui'
import { timeline, usePlayback } from '../../demo-kit/media'
import type { ShownItem } from './Briefing'

const P = {
  // short on purpose: item 1 (and its highlight) should start within ~3 s, not after a long greeting
  intro: { id: (l: string, n: number) => `Briefing untuk ${l}, ${n} butir.`, en: (l: string, n: number) => `Briefing for the ${l}, ${n} items.` },
  item: { id: 'Butir', en: 'Item' },
  reading: { id: 'Membacakan butir {i} dari {n}', en: 'Reading item {i} of {n}' },
  intro2: { id: 'Pembukaan', en: 'Opening' },
  silent: { id: 'tanpa suara: perangkat tidak punya suara bahasa ini', en: 'silent: this device has no voice for the language' },
  pause: { id: 'Jeda', en: 'Pause' },
  play: { id: 'Lanjutkan', en: 'Resume' },
}

export default function BriefingPlayer({ items: live, at, leader, onActive, onListened, onEnd }: {
  items: ShownItem[]
  at: string
  leader: string
  onActive: (i: number) => void
  onListened: () => void
  onEnd: () => void
}) {
  const { lang } = useI18n()
  // the items as they were when reading started (world updates must not restart the voice)
  const [items] = useState(live)
  const segs = useMemo(
    () =>
      timeline(
        [{ speaker: 'ai', text: P.intro[lang](leader, items.length) }, ...items.map((it, i) => ({ speaker: 'ai', text: `${P.item[lang]} ${i + 1}. ${it.title[lang]}. ${it.detail ? `${it.detail[lang]}.` : ''}` }))],
        { wps: 2.6, gap: 0.5, start: 0.2 },
      ),
    [items, lang, at, leader],
  )
  const { pb, state } = usePlayback(segs, lang === 'id' ? 'id-ID' : 'en-GB')
  const listened = useRef(false)
  const ended = useRef(false)
  const cb = useRef({ onActive, onListened, onEnd })
  cb.current = { onActive, onListened, onEnd }

  useEffect(() => {
    // a destroyed-and-reused playback (React StrictMode re-runs effects in dev; usePlayback's cleanup destroys it)
    // still says "playing" with its ticker stopped: play() would then return early and the silent text mode would
    // sit on the opening forever. Pause first so play() really restarts the timeline.
    if (pb.getState().playing) pb.pause()
    pb.toSegment(0)
    pb.play()
  }, [pb])
  useEffect(() => {
    cb.current.onActive(state.seg - 1)
    // "Dengarkan 1 butir": the first item was read to its end
    if (!listened.current && (state.seg >= 2 || (state.ended && state.seg >= 1))) {
      listened.current = true
      cb.current.onListened()
    }
    if (state.ended && !ended.current) {
      ended.current = true
      cb.current.onEnd()
    }
  }, [state.seg, state.ended])
  useEffect(() => () => cb.current.onActive(-1), [])
  // stall guard: some browser voices start an utterance and never report its end, which would leave the reading
  // (and the highlight) stuck; a segment that runs well past its expected length moves on to the next one
  useEffect(() => {
    if (!state.playing || state.mode !== 'tts' || state.seg < 0) return
    const seg = segs[state.seg]
    if (!seg) return
    const id = window.setTimeout(() => {
      const now = pb.getState()
      if (!now.playing || now.seg !== state.seg) return
      if (state.seg + 1 < segs.length) pb.toSegment(state.seg + 1)
      else {
        pb.pause()
        cb.current.onEnd()
      }
    }, Math.round(((seg.end - seg.start) * 2.2 + 2.5) * 1000))
    return () => window.clearTimeout(id)
  }, [pb, segs, state.playing, state.mode, state.seg])

  const i = Math.max(0, state.seg)
  const pct = segs.length ? Math.min(1, (i + (state.playing ? 0.5 : 0)) / segs.length) : 0
  return (
    <div className="dk-mp-player" role="group" aria-label={P.reading[lang].replace('{i}', String(Math.max(1, state.seg))).replace('{n}', String(items.length))}>
      <IconButton icon={state.playing ? 'pause' : 'play'} size="sm" label={state.playing ? P.pause[lang] : P.play[lang]} onClick={() => pb.toggle()} />
      <div className="dk-mp-player-b">
        <p aria-live="polite">
          {state.seg <= 0 ? P.intro2[lang] : P.reading[lang].replace('{i}', String(state.seg)).replace('{n}', String(items.length))}
          {state.mode === 'text' && <span className="dk-mp-player-m"> · {P.silent[lang]}</span>}
        </p>
        <span className="dk-mp-player-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct})` }} />
        </span>
      </div>
    </div>
  )
}
