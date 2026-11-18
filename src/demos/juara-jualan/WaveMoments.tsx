/**
 * demos/juara-jualan/WaveMoments.tsx — standalone recording player (pure props, reused by the Tahap 6 mini demo): play /
 * pause, the kit Waveform with one marker per criterion moment (`data-tone`), the clock text, "Putar suara" (browser
 * TTS, off by default) and, on phones, a scrolling "Momen" chip row (44 px). The danger moment carries the hotspot.
 */
import { useEffect, useRef } from 'react'
import { Button, Icon, IconButton } from '../../demo-kit/ui'
import { Waveform, mmss, type PlaybackState } from '../../demo-kit/media'
import type { Moment } from './clips'
import type { Lang, Strings } from './strings'

export interface WaveMomentsProps {
  peaks: number[]
  duration: number
  moments: Moment[]
  state: PlaybackState
  progress: () => number
  onToggle: () => void
  onSeek: (sec: number) => void
  onMoment: (m: Moment) => void
  voice: boolean
  onVoice: () => void
  /** phone layout: chip row instead of relying on the small markers */
  chips?: boolean
  /** put `data-hotspot="jj-marker-danger"` on the danger moment */
  hotspot?: boolean
  t: Strings
  lang: Lang
}

export function WaveMoments({ peaks, duration, moments, state, progress, onToggle, onSeek, onMoment, voice, onVoice, chips, hotspot, t, lang }: WaveMomentsProps) {
  const ref = useRef<HTMLDivElement>(null)
  // the kit renders the marker buttons: tag the danger one for the shell hotspot (desktop)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    root.querySelectorAll('.dk-wave-mk[data-hotspot]').forEach((el) => el.removeAttribute('data-hotspot'))
    if (!hotspot || chips) return
    const mk = root.querySelector<HTMLElement>('.dk-wave-mk[data-tone="danger"]')
    mk?.setAttribute('data-hotspot', 'jj-marker-danger')
  }, [hotspot, chips, moments])

  const markers = moments.map((m) => ({ id: m.id, at: duration ? m.t / duration : 0, label: `${m.label[lang]} · ${mmss(m.t)}`, tone: m.tone === 'ok' ? ('ok' as const) : m.tone }))
  return (
    <div ref={ref} className="dk-jj-player" data-playhead={state.time.toFixed(2)} data-moments={moments.map((m) => `${m.id}:${m.tone}:${m.t}`).join(' ')}>
      <div className="dk-jj-player-row">
        <IconButton icon={state.playing ? 'pause' : 'play'} label={state.playing ? t.pause : t.play} onClick={onToggle} className="dk-jj-playbtn" aria-keyshortcuts="Space" />
        <div className="dk-jj-wavebox">
          <Waveform
            peaks={peaks}
            progress={progress}
            active={state.playing}
            height={56}
            markers={markers}
            onSeek={(f) => onSeek(f * duration)}
            onMarker={(id) => {
              const m = moments.find((x) => x.id === id)
              if (m) onMoment(m)
            }}
            label={t.wave}
            valueText={t.waveText(mmss(state.time), mmss(duration))}
          />
        </div>
        <span className="dk-jj-time dk-num" aria-hidden="true">
          {mmss(state.time)} / {mmss(duration)}
        </span>
      </div>
      <div className="dk-jj-player-sub">
        <Button size="sm" variant={voice ? 'secondary' : 'ghost'} icon={voice ? 'mic' : 'play'} aria-pressed={voice} onClick={onVoice}>
          {voice ? t.voiceOff : t.voice}
        </Button>
        <span className="dk-jj-faint">{t.silent}</span>
      </div>
      {chips && (
        <div className="dk-jj-chips" role="group" aria-label={t.moments}>
          {moments.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`dk-jj-mchip is-${m.tone}`}
              data-tone={m.tone}
              {...(hotspot && m.tone === 'danger' ? { 'data-hotspot': 'jj-marker-danger' } : {})}
              onClick={() => onMoment(m)}
            >
              {m.tone === 'danger' && <Icon name="alert" size={14} />}
              <span>{m.label[lang]}</span>
              <span className="dk-num">{mmss(m.t)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
