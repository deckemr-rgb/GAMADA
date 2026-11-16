/**
 * media/playback.ts — the "recording" engine. A clip is a transcript with speaker labels and timestamps; playback
 * speaks it segment by segment with speechSynthesis, or — when TTS is unavailable or fails — runs a silent,
 * timer-driven "text only" timeline with the SAME API (time, segment, word, seek, markers).
 *
 * Seeking restarts from the segment containing the target time (speech cannot start mid-sentence).
 * Time advances on gsap.ticker; subscribers are notified only when segment / word / playing / mode change.
 */
import { gsap } from 'gsap'
import { speak, ttsSupported, loadVoices, type SpeakHandle } from './tts'

export interface ClipSegment {
  id: string
  /** speaker id (SpeechClip.speakers) */
  speaker: string
  /** seconds from the clip start */
  start: number
  end: number
  /** spoken text (clip language) */
  text: string
  /** English translation shown in EN mode */
  en?: string
}

export interface ClipMarker {
  id: string
  /** seconds */
  t: number
  label: { id: string; en: string }
  tone?: 'neutral' | 'ok' | 'warn' | 'danger'
}

export interface ClipSpeaker {
  id: string
  /** title / role (officials by title only) */
  label: { id: string; en: string }
}

export interface SpeechClip {
  id: string
  title: { id: string; en: string }
  /** BCP-47 for TTS, e.g. "id-ID" */
  lang: string
  speakers: ClipSpeaker[]
  segments: ClipSegment[]
  markers?: ClipMarker[]
  /** precomputed waveform peaks 0..1 (peaksForClip) */
  peaks?: number[]
}

export type PlaybackMode = 'tts' | 'text'

export interface PlaybackState {
  /** seconds */
  time: number
  /** segment index (-1 before the first) */
  seg: number
  /** word index inside the segment (-1 none) */
  word: number
  playing: boolean
  ended: boolean
  mode: PlaybackMode
}

export interface Playback {
  readonly duration: number
  getState(): PlaybackState
  subscribe(fn: () => void): () => void
  play(): void
  pause(): void
  toggle(): void
  /** restart from the segment containing `t` (or the next one) */
  seek(t: number): void
  toSegment(i: number): void
  destroy(): void
}

export interface PlaybackOptions {
  /** try speechSynthesis first (default true) */
  tts?: boolean
  rate?: number
}

export const PLAYBACK = {
  /** max time step per frame (s) — avoids jumps after a hidden tab */
  maxStep: 0.1,
} as const

export interface WordSpan {
  w: string
  start: number
}
export function wordsOf(text: string): WordSpan[] {
  const out: WordSpan[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push({ w: m[0], start: m.index })
  return out
}
function wordAt(words: WordSpan[], char: number): number {
  let k = -1
  for (let i = 0; i < words.length; i++) {
    if ((words[i]?.start ?? 0) <= char) k = i
    else break
  }
  return k
}

export function segmentAt(segs: ClipSegment[], t: number): number {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s && t < s.end) return i
  }
  return segs.length - 1
}

export function createPlayback(segments: ClipSegment[], lang: string, opts: PlaybackOptions = {}): Playback {
  const segs = segments
  const words = segs.map((s) => wordsOf(s.text))
  const duration = segs[segs.length - 1]?.end ?? 0
  let state: PlaybackState = { time: 0, seg: -1, word: -1, playing: false, ended: false, mode: opts.tts === false || !ttsSupported() ? 'text' : 'tts' }
  const subs = new Set<() => void>()
  let utter: SpeakHandle | null = null
  let ticking = false
  /** TTS: char-based anchor of the current word (so time never runs ahead of the voice) */
  let ttsCap = 0
  let token = 0

  const set = (patch: Partial<PlaybackState>) => {
    const next = { ...state, ...patch }
    const changed = next.seg !== state.seg || next.word !== state.word || next.playing !== state.playing || next.mode !== state.mode || next.ended !== state.ended
    state = next
    if (changed) subs.forEach((f) => f())
  }

  const segTimeOf = (i: number, char: number) => {
    const s = segs[i]
    if (!s) return 0
    return s.start + (char / Math.max(1, s.text.length)) * (s.end - s.start)
  }

  const tick = (_t: number, deltaMs: number) => {
    if (!state.playing) return
    const dt = Math.min(PLAYBACK.maxStep, deltaMs / 1000)
    let t = state.time + dt
    if (state.mode === 'text') {
      if (t >= duration) {
        stopTicker()
        set({ time: duration, playing: false, ended: true, word: -1 })
        return
      }
      const i = segmentAt(segs, t)
      const s = segs[i]
      const inSeg = !!s && t >= s.start
      const w = inSeg && s ? wordAt(words[i] ?? [], ((t - s.start) / (s.end - s.start)) * s.text.length) : -1
      state.time = t
      set({ seg: inSeg ? i : state.seg, word: w })
    } else {
      // voice leads: interpolate inside the current word only
      const s = segs[state.seg]
      if (s) t = Math.min(t, ttsCap, s.end)
      state.time = Math.max(state.time, t)
    }
  }
  const startTicker = () => {
    if (ticking) return
    ticking = true
    gsap.ticker.add(tick)
  }
  const stopTicker = () => {
    if (!ticking) return
    ticking = false
    gsap.ticker.remove(tick)
  }

  const speakFrom = async (i: number) => {
    const my = ++token
    const s = segs[i]
    if (!s) {
      set({ playing: false, ended: true, word: -1, time: duration })
      stopTicker()
      return
    }
    state.time = s.start
    set({ seg: i, word: 0 })
    if (state.mode === 'text') return
    await loadVoices()
    if (my !== token) return
    const w = words[i] ?? []
    ttsCap = segTimeOf(i, (w[1]?.start ?? s.text.length))
    utter = speak(s.text, lang, {
      ...(opts.rate ? { rate: opts.rate } : {}),
      onBoundary: (ch) => {
        if (my !== token) return
        const k = wordAt(w, ch)
        state.time = Math.max(state.time, segTimeOf(i, ch))
        ttsCap = segTimeOf(i, w[k + 1]?.start ?? s.text.length)
        set({ word: k })
      },
    })
    const r = await utter.done
    if (my !== token) return
    if (r === 'error') {
      // no usable voice → continue silently on the same timeline
      set({ mode: 'text' })
      state.time = s.start
      return
    }
    if (r === 'cancel') {
      // interrupted by another speaker on the page (our own cancels bump `token` first): pause here
      stopTicker()
      set({ playing: false })
      return
    }
    if (!state.playing) return
    if (i + 1 < segs.length) void speakFrom(i + 1)
    else {
      stopTicker()
      set({ time: duration, playing: false, ended: true, word: -1 })
    }
  }

  const api: Playback = {
    duration,
    getState: () => state,
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    play() {
      if (state.playing) return
      const from = state.ended ? 0 : Math.max(0, segmentAt(segs, state.time))
      set({ playing: true, ended: false })
      startTicker()
      void speakFrom(from)
    },
    pause() {
      if (!state.playing) return
      token++
      utter?.cancel()
      utter = null
      stopTicker()
      set({ playing: false })
    },
    toggle() {
      if (state.playing) api.pause()
      else api.play()
    },
    seek(t: number) {
      const i = segmentAt(segs, Math.max(0, Math.min(duration, t)))
      api.toSegment(i)
    },
    toSegment(i: number) {
      const s = segs[Math.max(0, Math.min(segs.length - 1, i))]
      if (!s) return
      const idx = segs.indexOf(s)
      token++
      utter?.cancel()
      utter = null
      state.time = s.start
      set({ seg: idx, word: -1, ended: false })
      if (state.playing) void speakFrom(idx)
    },
    destroy() {
      token++
      utter?.cancel()
      stopTicker()
      subs.clear()
    },
  }
  return api
}

/* ---------------------------------------------------------------- clip helpers */

/** Build timestamps from text length (≈ words per second) with a pause between turns. */
export function timeline(lines: { speaker: string; text: string; en?: string }[], opts: { wps?: number; gap?: number; start?: number } = {}): ClipSegment[] {
  const wps = opts.wps ?? 2.6
  const gap = opts.gap ?? 0.6
  let t = opts.start ?? 0.4
  return lines.map((l, i) => {
    const n = l.text.split(/\s+/).filter(Boolean).length
    const d = Math.max(1.6, Math.round((n / wps) * 10) / 10)
    const seg: ClipSegment = { id: `s${i + 1}`, speaker: l.speaker, start: Math.round(t * 10) / 10, end: Math.round((t + d) * 10) / 10, text: l.text, ...(l.en ? { en: l.en } : {}) }
    t += d + gap
    return seg
  })
}

/** Deterministic speech-like peaks (0..1): voiced inside segments, near-silent in the gaps. */
export function peaksForClip(segments: ClipSegment[], bars = 120, seed = 7): number[] {
  const dur = segments[segments.length - 1]?.end ?? 1
  let a = seed >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: bars }, (_, i) => {
    const t = ((i + 0.5) / bars) * dur
    const s = segments.find((x) => t >= x.start && t < x.end)
    if (!s) return 0.04 + rnd() * 0.05
    const p = (t - s.start) / (s.end - s.start)
    const env = Math.sin(Math.PI * Math.min(1, p * 1.15)) * 0.35 + 0.55
    return Math.min(1, Math.max(0.12, env * (0.55 + rnd() * 0.5)))
  })
}

/** "01:05" */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
