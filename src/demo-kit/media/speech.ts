/**
 * media/speech.ts — Web Speech API recognition (SpeechRecognition / webkitSpeechRecognition) with a language
 * fallback chain: region pack speechCodes (e.g. ["jv-ID", "id-ID"]) then id-ID.
 */

/* minimal typings (not in lib.dom for every TS version) */
interface RecAlternative {
  transcript: string
  confidence: number
}
interface RecResult {
  readonly isFinal: boolean
  readonly length: number
  [i: number]: RecAlternative
}
interface RecEvent extends Event {
  readonly resultIndex: number
  readonly results: { readonly length: number; [i: number]: RecResult }
}
interface RecErrorEvent extends Event {
  readonly error: string
}
interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: RecErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type RecognitionCtor = new () => Recognition

export const SPEECH = {
  fallbackLang: 'id-ID',
} as const

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function recognitionSupported(): boolean {
  return ctor() !== null
}

/** Ordered, de-duplicated language list ending with id-ID. */
export function speechLangs(codes?: readonly string[]): string[] {
  return [...new Set([...(codes ?? []), SPEECH.fallbackLang])]
}

export type RecognitionError = 'denied' | 'no-speech' | 'nomic' | 'network' | 'unsupported' | 'other'

export interface RecognizerOptions {
  langs: string[]
  onInterim?: (text: string) => void
  /** final text so far (all final chunks joined) */
  onFinal?: (text: string) => void
  onError?: (err: RecognitionError, raw: string) => void
  /** recognition ended (after stop() or by itself) — `text` is final + last interim */
  onEnd?: (text: string, lang: string) => void
  onStart?: (lang: string) => void
}

export interface Recognizer {
  start(): void
  stop(): void
  abort(): void
  lang(): string
}

const ERR: Record<string, RecognitionError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'no-speech': 'no-speech',
  'audio-capture': 'nomic',
  network: 'network',
  'language-not-supported': 'unsupported',
}

export function createRecognizer(o: RecognizerOptions): Recognizer | null {
  const C = ctor()
  if (!C) return null
  let idx = 0
  let finals = ''
  let interim = ''
  let rec: Recognition | null = null
  let stopped = false
  let retrying = false

  const make = () => {
    const r = new C()
    r.lang = o.langs[idx] ?? SPEECH.fallbackLang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => o.onStart?.(r.lang)
    r.onresult = (e) => {
      interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const t = res?.[0]?.transcript ?? ''
        if (res?.isFinal) {
          finals = `${finals} ${t}`.trim()
          o.onFinal?.(finals)
        } else interim += t
      }
      o.onInterim?.(`${finals} ${interim}`.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'language-not-supported' && idx < o.langs.length - 1 && !stopped) {
        idx++
        retrying = true
        return
      }
      if (e.error === 'aborted') return
      o.onError?.(ERR[e.error] ?? 'other', e.error)
    }
    r.onend = () => {
      if (retrying) {
        retrying = false
        rec = make()
        rec.start()
        return
      }
      o.onEnd?.(`${finals} ${interim}`.trim(), r.lang)
    }
    return r
  }

  return {
    start() {
      stopped = false
      finals = ''
      interim = ''
      rec = make()
      try {
        rec.start()
      } catch {
        o.onError?.('other', 'start-failed')
      }
    },
    stop() {
      stopped = true
      rec?.stop()
    },
    abort() {
      stopped = true
      if (rec) {
        rec.onend = null
        rec.onerror = null
        rec.onresult = null
        rec.abort()
      }
    },
    lang: () => rec?.lang ?? o.langs[idx] ?? SPEECH.fallbackLang,
  }
}
