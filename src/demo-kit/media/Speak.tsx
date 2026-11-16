/**
 * "Dengarkan" for any text (AI answers, summaries, briefings): useSpeakText + SpeakButton + SpokenText
 * (current-word highlight). Falls back to a silent highlight walk when TTS is unavailable.
 */
import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { Button, type ButtonProps } from '../ui/Button'
import { timeline, wordsOf, type PlaybackState } from './playback'
import { usePlayback } from './usePlayback'

export function useSpeakText(text: string, lang = 'id-ID') {
  const segs = useMemo(() => timeline([{ speaker: 'ai', text }], { wps: 2.7, start: 0 }), [text])
  const { pb, state } = usePlayback(segs, lang)
  const words = useMemo(() => wordsOf(text), [text])
  return {
    state,
    words,
    toggle: () => {
      if (state.playing) pb.pause()
      else {
        pb.toSegment(0)
        pb.play()
      }
    },
    stop: () => pb.pause(),
  }
}

const S = {
  id: { listen: 'Dengarkan', stop: 'Hentikan', silent: 'tanpa suara' },
  en: { listen: 'Listen', stop: 'Stop', silent: 'silent' },
}

export function SpeakButton({ state, onToggle, ...rest }: { state: PlaybackState; onToggle: () => void } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { lang } = useI18n()
  const s = S[lang]
  return (
    <Button variant="secondary" icon={state.playing ? 'pause' : 'play'} onClick={onToggle} aria-pressed={state.playing} {...rest}>
      {state.playing ? s.stop : s.listen}
      {state.mode === 'text' && state.playing ? ` · ${s.silent}` : ''}
    </Button>
  )
}

export function SpokenText({ words, state, className }: { words: { w: string }[]; state: PlaybackState; className?: string }) {
  const active = state.playing ? state.word : -1
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span key={i}>
          {i === active ? <mark>{w.w}</mark> : w.w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}
