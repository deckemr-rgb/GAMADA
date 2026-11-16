/**
 * media/tts.ts — speechSynthesis wrapper. TTS is user-initiated content: it plays when the visitor presses
 * "Dengarkan", independent of the site's ambient sound toggle (lib/audio.ts).
 *
 * speak() resolves 'error' quickly when synthesis is missing or silently broken (no `start` within
 * TTS.startTimeoutMs — e.g. headless browsers or no voices), so callers can fall back to the text-only timeline.
 */

export const TTS = {
  /** wait this long for `voiceschanged` before speaking with the default voice (ms) */
  voiceWaitMs: 1200,
  /** no `start` event within this → treat TTS as unavailable (ms) */
  startTimeoutMs: 2200,
  /** default speaking rate */
  rate: 1,
  /** fallback language */
  fallbackLang: 'id-ID',
} as const

export type SpeakResult = 'end' | 'cancel' | 'error'

export interface SpeakOptions {
  /** word boundary: char index into `text` */
  onBoundary?: (charIndex: number) => void
  onStart?: () => void
  rate?: number
  voice?: SpeechSynthesisVoice | null
}

export interface SpeakHandle {
  cancel(): void
  done: Promise<SpeakResult>
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}

let voicesCache: SpeechSynthesisVoice[] = []
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null

/** Voices, waiting briefly for the async `voiceschanged` (Chrome). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([])
  const now = window.speechSynthesis.getVoices()
  if (now.length) {
    voicesCache = now
    return Promise.resolve(now)
  }
  if (voicesPromise) return voicesPromise
  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      clearTimeout(timer)
      voicesCache = synth.getVoices()
      voicesPromise = null
      resolve(voicesCache)
    }
    const timer = setTimeout(done, TTS.voiceWaitMs)
    synth.addEventListener('voiceschanged', done)
  })
  return voicesPromise
}

/** Best voice for a BCP-47 tag: exact match, then same language, then the id-ID fallback; null = browser default. */
export function pickVoice(lang: string, voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const norm = (s: string) => s.toLowerCase().replace('_', '-')
  const want = norm(lang)
  const base = want.split('-')[0]
  const score = (v: SpeechSynthesisVoice) => (v.localService ? 0 : 1) // network voices tend to sound better
  const exact = voices.filter((v) => norm(v.lang) === want).sort((a, b) => score(b) - score(a))
  if (exact[0]) return exact[0]
  const same = voices.filter((v) => norm(v.lang).split('-')[0] === base)
  if (same[0]) return same[0]
  if (want !== norm(TTS.fallbackLang)) return pickVoice(TTS.fallbackLang, voices)
  return null
}

/** Is there a voice for this language (or its fallback)? Undefined until voices have loaded. */
export function hasVoiceFor(lang: string): boolean | undefined {
  if (!ttsSupported()) return false
  if (!voicesCache.length) return undefined
  return pickVoice(lang) !== null
}

let current: { cancel: () => void } | null = null

/** Speak one utterance. Cancels whatever this module was speaking before. */
export function speak(text: string, lang: string, opts: SpeakOptions = {}): SpeakHandle {
  if (!ttsSupported() || !text.trim()) return { cancel() {}, done: Promise.resolve('error') }
  current?.cancel()
  const synth = window.speechSynthesis
  let settled = false
  let resolveDone: (r: SpeakResult) => void = () => {}
  const done = new Promise<SpeakResult>((r) => (resolveDone = r))
  const finish = (r: SpeakResult) => {
    if (settled) return
    settled = true
    clearTimeout(watchdog)
    if (current === handle) current = null
    resolveDone(r)
  }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const voice = opts.voice === undefined ? pickVoice(lang) : opts.voice
  if (voice) u.voice = voice
  u.rate = opts.rate ?? TTS.rate
  let started = false
  u.onstart = () => {
    started = true
    clearTimeout(watchdog)
    opts.onStart?.()
  }
  u.onboundary = (e) => {
    if (e.name === 'word' || e.name === undefined) opts.onBoundary?.(e.charIndex)
  }
  u.onend = () => finish(started ? 'end' : 'error')
  u.onerror = (e) => finish(e.error === 'interrupted' || e.error === 'canceled' ? 'cancel' : 'error')
  const watchdog = setTimeout(() => {
    if (!started) {
      synth.cancel()
      finish('error')
    }
  }, TTS.startTimeoutMs)
  const handle = {
    cancel() {
      if (settled) return
      finish('cancel')
      synth.cancel()
    },
  }
  current = handle
  synth.cancel()
  synth.speak(u)
  return { cancel: handle.cancel, done }
}

/** Stop anything this module is speaking. */
export function cancel(): void {
  current?.cancel()
  if (ttsSupported()) window.speechSynthesis.cancel()
}
