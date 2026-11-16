/** React binding for media/playback.ts (re-renders only on segment / word / play-state changes). */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createPlayback, type ClipSegment, type Playback, type PlaybackOptions, type PlaybackState } from './playback'

export function usePlayback(segments: ClipSegment[], lang: string, opts: PlaybackOptions = {}): { pb: Playback; state: PlaybackState } {
  const tts = opts.tts ?? true
  const rate = opts.rate
  const pb = useMemo(() => createPlayback(segments, lang, { tts, ...(rate ? { rate } : {}) }), [segments, lang, tts, rate])
  useEffect(() => () => pb.destroy(), [pb])
  const state = useSyncExternalStore(pb.subscribe, pb.getState, pb.getState)
  return { pb, state }
}
