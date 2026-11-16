/**
 * AudioPlayer — plays a SpeechClip (transcript "recording"): "Dengarkan" speaks it segment by segment with
 * speechSynthesis (id-ID voice when available) or runs the silent text-only timeline. Waveform timeline with
 * seek + markers, time read-out, transcript with speaker labels, current segment + current word highlight;
 * clicking a line restarts from it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Icon } from '../ui/icons'
import { CATEGORICAL_HEX } from '../viz/palette'
import { mmss, segmentAt, wordsOf, type ClipMarker, type SpeechClip } from './playback'
import { usePlayback } from './usePlayback'
import { Waveform } from './Waveform'
import './media.css'

export interface AudioPlayerProps {
  clip: SpeechClip
  /** current segment changed (minutes writing themselves, coaching moments …) */
  onSegment?: (index: number) => void
  onMarker?: (m: ClipMarker) => void
  /** show the transcript list (default true) */
  transcript?: boolean
  /** transcript max height (CSS), default 320px */
  maxHeight?: string
  /** try speechSynthesis (default true); false = always the silent text timeline */
  tts?: boolean
  className?: string
}

const S = {
  id: { listen: 'Dengarkan', pause: 'Jeda', resume: 'Lanjutkan', replay: 'Putar ulang', tts: 'Suara sintetis', text: 'Mode teks · tanpa suara', timeline: 'Linimasa rekaman', of: 'dari', jump: 'Lompat ke', transcript: 'Transkrip', fromHere: 'Putar dari sini' },
  en: { listen: 'Listen', pause: 'Pause', resume: 'Resume', replay: 'Replay', tts: 'Synthetic voice', text: 'Text mode · silent', timeline: 'Recording timeline', of: 'of', jump: 'Jump to', transcript: 'Transcript', fromHere: 'Play from here' },
}

export function AudioPlayer({ clip, onSegment, onMarker, transcript = true, maxHeight = '320px', tts = true, className }: AudioPlayerProps) {
  const { lang } = useI18n()
  const s = S[lang]
  const { pb, state } = usePlayback(clip.segments, clip.lang, { tts })
  const listRef = useRef<HTMLOListElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const [started, setStarted] = useState(false)
  const dur = pb.duration
  const progress = useCallback(() => (dur ? pb.getState().time / dur : 0), [pb, dur])
  const color = useMemo(() => new Map(clip.speakers.map((sp, i) => [sp.id, CATEGORICAL_HEX[i % CATEGORICAL_HEX.length] ?? '#b9b2ff'])), [clip.speakers])
  const label = useMemo(() => new Map(clip.speakers.map((sp) => [sp.id, sp.label[lang]])), [clip.speakers, lang])
  const words = useMemo(() => clip.segments.map((x) => wordsOf(x.text)), [clip.segments])

  // time read-out on the ticker while playing (no re-render per frame)
  useEffect(() => {
    const el = timeRef.current
    if (!el) return
    const write = () => {
      el.textContent = mmss(pb.getState().time)
    }
    write()
    if (!state.playing) return
    gsap.ticker.add(write)
    return () => gsap.ticker.remove(write)
  }, [pb, state.playing, state.seg])

  // segment callbacks + keep the current line in view (inside the list only)
  const onSegRef = useRef(onSegment)
  onSegRef.current = onSegment
  useEffect(() => {
    if (state.seg < 0) return
    onSegRef.current?.(state.seg)
    const list = listRef.current
    const li = list?.children[state.seg] as HTMLElement | undefined
    if (list && li) {
      const top = li.offsetTop - list.offsetTop
      if (top < list.scrollTop || top + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
    }
  }, [state.seg])

  const play = () => {
    setStarted(true)
    pb.toggle()
  }
  const seekFrac = (f: number) => {
    setStarted(true)
    pb.seek(f * dur)
  }
  const fromSeg = (i: number) => {
    setStarted(true)
    pb.toSegment(i)
    if (!pb.getState().playing) pb.play()
  }
  const markers = clip.markers ?? []
  const jumpMarker = (m: ClipMarker) => {
    onMarker?.(m)
    fromSeg(segmentAt(clip.segments, m.t + 0.01))
  }

  const btnLabel = state.playing ? s.pause : state.ended ? s.replay : started ? s.resume : s.listen
  return (
    <section className={`dk-ap${className ? ` ${className}` : ''}`} aria-label={clip.title[lang]}>
      <header className="dk-ap-head">
        <Button variant="primary" icon={state.playing ? 'pause' : state.ended ? 'replay' : 'play'} onClick={play} aria-pressed={state.playing}>
          {btnLabel}
        </Button>
        <div className="dk-ap-title">
          <b>{clip.title[lang]}</b>
          <span className="dk-ap-mode">
            <Icon name={state.mode === 'tts' ? 'mic' : 'doc'} size={12} />
            {state.mode === 'tts' ? s.tts : s.text}
          </span>
        </div>
        <span className="dk-ap-time dk-num" aria-hidden="true">
          <span ref={timeRef}>00:00</span> / {mmss(dur)}
        </span>
      </header>
      <Waveform
        peaks={clip.peaks}
        progress={progress}
        active={state.playing}
        height={44}
        label={s.timeline}
        valueText={`${mmss(state.seg >= 0 ? (clip.segments[state.seg]?.start ?? 0) : 0)} ${s.of} ${mmss(dur)}`}
        onSeek={seekFrac}
        markers={markers.map((m) => ({ id: m.id, at: dur ? m.t / dur : 0, label: m.label[lang], tone: m.tone ?? 'neutral' }))}
        onMarker={(id) => {
          const m = markers.find((x) => x.id === id)
          if (m) jumpMarker(m)
        }}
      />
      {markers.length > 0 && (
        <div className="dk-ap-marks" role="group" aria-label={s.jump}>
          {markers.map((m) => (
            <button key={m.id} type="button" className={`dk-ap-mark is-${m.tone ?? 'neutral'}`} onClick={() => jumpMarker(m)}>
              <span className="dk-num">{mmss(m.t)}</span>
              {m.label[lang]}
            </button>
          ))}
        </div>
      )}
      {transcript && (
        <ol ref={listRef} className="dk-ap-list" style={{ maxHeight }} aria-label={s.transcript}>
          {clip.segments.map((seg, i) => {
            const cur = i === state.seg
            const ws = words[i] ?? []
            return (
              <li key={seg.id} className={cur ? 'is-cur' : i < state.seg ? 'is-past' : undefined}>
                <button type="button" className="dk-ap-line" onClick={() => fromSeg(i)} aria-current={cur ? 'true' : undefined} aria-label={`${s.fromHere}: ${mmss(seg.start)} ${label.get(seg.speaker) ?? ''}`}>
                  <span className="dk-ap-ts dk-num">{mmss(seg.start)}</span>
                  <span className="dk-ap-who" style={{ color: color.get(seg.speaker) }}>
                    {label.get(seg.speaker)}
                  </span>
                </button>
                <p className="dk-ap-text">
                  {cur && state.word >= 0
                    ? ws.map((w, k) => (
                        <span key={k}>
                          {k === state.word ? <mark>{w.w}</mark> : w.w}
                          {k < ws.length - 1 ? ' ' : ''}
                        </span>
                      ))
                    : seg.text}
                </p>
                {lang === 'en' && seg.en && <p className="dk-ap-tr">{seg.en}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
