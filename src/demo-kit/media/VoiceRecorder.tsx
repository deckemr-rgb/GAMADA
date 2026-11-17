/**
 * VoiceRecorder — press-and-hold (pointer, or keyboard Space) to record with the Web Speech API; live interim
 * transcript and mic level. Language: region pack speechCodes, then id-ID.
 * Never a dead button: without SpeechRecognition, without a microphone, or after a denied permission, the main
 * control becomes "Pakai voice note contoh", which plays a bundled voice note (TTS when available, silent
 * timeline otherwise) and streams its transcript the same way.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Icon } from '../ui/icons'
import { motionMode } from '../ui/motion'
import { MicOpenError, micSupported, openMic, type MicHandle } from './mic'
import { timeline, peaksForClip, wordsOf } from './playback'
import { usePlayback } from './usePlayback'
import { createRecognizer, recognitionSupported, speechLangs, type Recognizer } from './speech'
import type { VoiceSample } from './samples'
import { Waveform } from './Waveform'
import './media.css'

export const RECORDER = {
  /** shorter holds show the "hold longer" hint (ms) */
  minHoldMs: 450,
  /** auto stop (ms) */
  maxHoldMs: 60000,
  /** level → ring scale */
  ringGain: 0.35,
  /** sample voice note speaking rate */
  sampleRate: 0.95,
} as const

export interface VoiceResult {
  text: string
  source: 'mic' | 'sample'
  /** BCP-47 actually used */
  lang: string
  sampleId?: string
}

export interface VoiceRecorderProps {
  /** region pack languages.speechCodes (fallback id-ID) */
  speechCodes?: readonly string[]
  /** bundled voice note used as fallback / alternative */
  sample: VoiceSample
  onResult: (r: VoiceResult) => void
  onInterim?: (text: string) => void
  /** accessible name / visible caption of the hold button */
  label?: string
  className?: string
  /** words per second of the sample playback timeline (default 2.3; higher = shorter sample, e.g. 4 ≈ 7 s) */
  sampleWps?: number
}

type Phase = 'idle' | 'starting' | 'recording' | 'finishing' | 'sample'
type Block = null | 'unsupported' | 'denied' | 'nomic' | 'network'

const S = {
  id: {
    hold: 'Tahan untuk bicara',
    holdKey: 'Tahan tombol (atau Spasi) sambil berbicara',
    listening: 'Mendengarkan… lepas untuk selesai',
    starting: 'Meminta izin mikrofon…',
    finishing: 'Memproses ucapan…',
    sample: 'Pakai voice note contoh',
    playing: 'Memutar voice note contoh…',
    stop: 'Hentikan',
    short: 'Tahan tombol sedikit lebih lama sambil berbicara.',
    empty: 'Tidak ada suara yang tertangkap. Coba lagi, atau pakai voice note contoh.',
    unsupported: 'Browser ini belum mendukung pengenalan suara. Coba voice note contoh di bawah.',
    denied: 'Izin mikrofon ditolak. Aktifkan lewat ikon gembok di bilah alamat, atau pakai voice note contoh.',
    nomic: 'Mikrofon tidak ditemukan. Pakai voice note contoh.',
    network: 'Layanan pengenalan suara tidak terjangkau. Pakai voice note contoh.',
    level: 'Level suara mikrofon',
    wave: 'Gelombang voice note',
    lang: 'Bahasa',
    translation: 'Terjemahan',
    retry: 'Coba mikrofon lagi',
  },
  en: {
    hold: 'Hold to talk',
    holdKey: 'Hold the button (or Space) while speaking',
    listening: 'Listening… release to finish',
    starting: 'Asking for the microphone…',
    finishing: 'Processing speech…',
    sample: 'Use a sample voice note',
    playing: 'Playing the sample voice note…',
    stop: 'Stop',
    short: 'Hold the button a little longer while speaking.',
    empty: 'No speech was captured. Try again, or use the sample voice note.',
    unsupported: 'This browser does not support speech recognition yet. Try the sample voice note below.',
    denied: 'Microphone permission was denied. Allow it from the padlock in the address bar, or use the sample voice note.',
    nomic: 'No microphone found. Use the sample voice note.',
    network: 'The speech service cannot be reached. Use the sample voice note.',
    level: 'Microphone level',
    wave: 'Voice note waveform',
    lang: 'Language',
    translation: 'Translation',
    retry: 'Try the microphone again',
  },
}

export function VoiceRecorder({ speechCodes, sample, onResult, onInterim, label, className, sampleWps = 2.3 }: VoiceRecorderProps) {
  const { lang } = useI18n()
  const s = S[lang]
  const langs = useMemo(() => speechLangs(speechCodes), [speechCodes])
  const [phase, setPhase] = useState<Phase>('idle')
  const [block, setBlock] = useState<Block>(() => (!recognitionSupported() || !micSupported() ? 'unsupported' : null))
  const [note, setNote] = useState<string | null>(null)
  const [interim, setInterim] = useState('')
  const [usedLang, setUsedLang] = useState(langs[0] ?? 'id-ID')
  const mic = useRef<MicHandle | null>(null)
  const rec = useRef<Recognizer | null>(null)
  const holding = useRef(false)
  const t0 = useRef(0)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ring = useRef<HTMLSpanElement>(null)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase
  const cb = useRef({ onResult, onInterim })
  cb.current = { onResult, onInterim }

  /* ---------------------------------------------------------------- sample voice note */
  const sampleSegs = useMemo(() => timeline([{ speaker: 'warga', text: sample.text }], { wps: sampleWps, start: 0.2 }), [sample.text, sampleWps])
  const samplePeaks = useMemo(() => peaksForClip(sampleSegs, 48, sample.id.length * 13), [sampleSegs, sample.id])
  const { pb, state: ps } = usePlayback(sampleSegs, sample.lang, { rate: RECORDER.sampleRate })
  const sampleWords = useMemo(() => wordsOf(sample.text), [sample.text])
  const sampleProgress = useCallback(() => (pb.duration ? pb.getState().time / pb.duration : 0), [pb])
  useEffect(() => {
    if (phase !== 'sample') return
    if (ps.playing) {
      const t = sampleWords
        .slice(0, Math.max(0, ps.word) + 1)
        .map((w) => w.w)
        .join(' ')
      setInterim(t)
      cb.current.onInterim?.(t)
    } else if (ps.ended) {
      setInterim(sample.text)
      setPhase('idle')
      cb.current.onResult({ text: sample.text, source: 'sample', lang: sample.lang, sampleId: sample.id })
    }
  }, [phase, ps.playing, ps.ended, ps.word, sampleWords, sample])
  const playSample = () => {
    if (phase === 'sample') {
      pb.pause()
      setPhase('idle')
      return
    }
    setNote(null)
    setInterim('')
    setPhase('sample')
    pb.toSegment(0)
    pb.play()
  }

  /* ---------------------------------------------------------------- recording */
  const cleanup = useCallback(() => {
    if (maxTimer.current) clearTimeout(maxTimer.current)
    maxTimer.current = null
    mic.current?.close()
    mic.current = null
  }, [])
  useEffect(
    () => () => {
      rec.current?.abort()
      cleanup()
    },
    [cleanup],
  )

  const finish = useCallback(
    (text: string, used: string) => {
      cleanup()
      setPhase('idle')
      if (!text) {
        if (Date.now() - t0.current < RECORDER.minHoldMs) setNote(s.short)
        else setNote(s.empty)
        return
      }
      setInterim(text)
      cb.current.onResult({ text, source: 'mic', lang: used })
    },
    [cleanup, s.short, s.empty],
  )

  const start = async () => {
    if (phaseRef.current !== 'idle' || block) return
    holding.current = true
    t0.current = Date.now()
    setNote(null)
    setInterim('')
    setPhase('starting')
    try {
      mic.current = await openMic()
    } catch (e) {
      holding.current = false
      setPhase('idle')
      setBlock(e instanceof MicOpenError ? (e.kind === 'denied' ? 'denied' : e.kind === 'nomic' ? 'nomic' : 'unsupported') : 'unsupported')
      return
    }
    if (!holding.current) {
      // released while the permission prompt was open
      cleanup()
      setPhase('idle')
      setNote(s.short)
      return
    }
    const r = createRecognizer({
      langs,
      onStart: (l) => setUsedLang(l),
      onInterim: (t) => {
        setInterim(t)
        cb.current.onInterim?.(t)
      },
      onError: (err) => {
        if (err === 'denied') setBlock('denied')
        else if (err === 'nomic') setBlock('nomic')
        else if (err === 'network' || err === 'unsupported') setBlock('network')
      },
      onEnd: (text, used) => finish(text, used),
    })
    if (!r) {
      cleanup()
      setPhase('idle')
      setBlock('unsupported')
      return
    }
    rec.current = r
    r.start()
    setPhase('recording')
    maxTimer.current = setTimeout(() => stop(), RECORDER.maxHoldMs)
  }

  const stop = () => {
    if (!holding.current) return
    holding.current = false
    if (phaseRef.current === 'recording') {
      setPhase('finishing')
      rec.current?.stop()
    }
  }

  // ring follows the live level (transform only)
  useEffect(() => {
    const el = ring.current
    if (phase !== 'recording' || !el || motionMode() !== 'full') return
    const set = gsap.quickSetter(el, 'scale')
    const tick = () => set(1 + (mic.current?.level() ?? 0) * RECORDER.ringGain)
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      gsap.set(el, { scale: 1 })
    }
  }, [phase])

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    void start()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Spacebar') return
    e.preventDefault()
    if (!e.repeat) void start()
  }
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Spacebar') return
    e.preventDefault()
    stop()
  }

  const level = useCallback(() => mic.current?.level() ?? 0, [])
  const status =
    phase === 'starting' ? s.starting : phase === 'recording' ? s.listening : phase === 'finishing' ? s.finishing : phase === 'sample' ? s.playing : block ? s[block] : (note ?? s.holdKey)
  const recording = phase === 'recording'

  return (
    <section className={`dk-vr${recording ? ' is-rec' : ''}${className ? ` ${className}` : ''}`} aria-label={label ?? s.hold}>
      <div className="dk-vr-main">
        {!block ? (
          <button
            // distinct keys: when the mic is denied mid-hold, the sample button must be a NEW element, so the
            // release of the hold does not land on it as a click
            key="hold"
            type="button"
            className="dk-vr-btn"
            aria-pressed={recording}
            onPointerDown={onPointerDown}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={stop}
            onContextMenu={(e) => e.preventDefault()}
            disabled={phase === 'sample' || phase === 'finishing'}
          >
            <span ref={ring} className="dk-vr-ring" aria-hidden="true" />
            <Icon name="mic" size={26} />
            <span className="dk-sr">{label ?? s.hold}</span>
          </button>
        ) : (
          <button key="sample" type="button" className="dk-vr-btn is-sample" onClick={playSample} aria-pressed={phase === 'sample'}>
            <span ref={ring} className="dk-vr-ring" aria-hidden="true" />
            <Icon name={phase === 'sample' ? 'pause' : 'play'} size={26} />
            <span className="dk-sr">{phase === 'sample' ? s.stop : s.sample}</span>
          </button>
        )}
        <div className="dk-vr-side">
          <b className="dk-vr-cap">{block ? s.sample : (label ?? s.hold)}</b>
          <p className={`dk-vr-status${block || note ? ' is-note' : ''}`} role="status">
            {status}
          </p>
          {recording ? (
            <Waveform level={level} active bars={36} height={36} label={s.level} />
          ) : phase === 'sample' ? (
            <Waveform peaks={samplePeaks} progress={sampleProgress} active={ps.playing} height={36} label={s.wave} />
          ) : null}
        </div>
      </div>
      <div className="dk-vr-foot">
        {!block && (
          <Button size="sm" variant="quiet" icon={phase === 'sample' ? 'pause' : 'play'} onClick={playSample} disabled={phase === 'starting' || recording || phase === 'finishing'}>
            {phase === 'sample' ? s.stop : s.sample}
          </Button>
        )}
        {block && block !== 'unsupported' && phase !== 'sample' && (
          <Button size="sm" variant="quiet" icon="mic" onClick={() => setBlock(null)}>
            {s.retry}
          </Button>
        )}
        <span className="dk-vr-lang">
          {s.lang}: <b>{phase === 'sample' || block ? sample.lang : usedLang}</b>
        </span>
      </div>
      {(interim || phase === 'recording') && (
        <div className="dk-vr-text" aria-live="polite">
          <p>{interim || '…'}</p>
          {phase === 'idle' && interim === sample.text && sample.translation && sample.translation[lang] !== sample.text && (
            <small>
              {s.translation}: {sample.translation[lang]}
            </small>
          )}
        </div>
      )}
    </section>
  )
}
