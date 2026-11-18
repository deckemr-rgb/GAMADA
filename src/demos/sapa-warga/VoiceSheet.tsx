/**
 * demos/sapa-warga/VoiceSheet.tsx — the voice note sheet inside the phone (lazy: the media kit loads only when the
 * citizen opens it). Two ways in:
 *  - the "Voice note contoh" chip → the quick sample: the waveform plays and the Basa Jawa transcript appears word by
 *    word in ~3 s, then the ticket is created at once ("Lewati" sends it straight away);
 *  - the microphone → hold-to-talk with Web Speech in the region's language (kit VoiceRecorder). Its own sample
 *    sample plays at SAMPLE_WPS (about 6 s) and a "Lewati" control appears while it plays.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { VoiceRecorder } from '../../demo-kit/media/VoiceRecorder'
import { Waveform } from '../../demo-kit/media/Waveform'
import { peaksForClip, timeline } from '../../demo-kit/media/playback'
import { Button, IconButton } from '../../demo-kit/ui'
import type { RegionPack } from '../../demo-kit/region/types'
import { regionalLanguageLabel } from '../../demo-kit/i18n'
import { voiceSampleFor, type PersonaKey } from './model'
import { fill, useT } from './strings'

/** seconds from tap to a complete transcript in the quick sample */
const QUICK_S = 2.8
/** the mic sheet's own sample (kit VoiceRecorder) plays at a brisk demo pace (kit default 2.3 wps ≈ 12 s) */
const SAMPLE_WPS = 4.5

type Result = { text: string; source: 'mic' | 'sample'; lang: string }

function QuickSample({ text, lang: speechLang, title, onDone, onRecord }: { text: string; lang: string; title: string; onDone: (r: Result) => void; onRecord: () => void }) {
  const t = useT()
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const peaks = useMemo(() => peaksForClip(timeline([{ speaker: 'warga', text }], { wps: 2.3, start: 0.2 }), 48, text.length), [text])
  const [shown, setShown] = useState(0)
  const prog = useRef(0)
  const done = useRef(false)
  const cb = useRef(onDone)
  cb.current = onDone
  const finish = () => {
    if (done.current) return
    done.current = true
    prog.current = 1
    setShown(words.length)
    cb.current({ text, source: 'sample', lang: speechLang })
  }
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    const t0 = gsap.ticker.time
    let last = -1
    const tick = () => {
      const k = Math.min(1, (gsap.ticker.time - t0) / QUICK_S)
      prog.current = k
      const n = Math.min(words.length, Math.ceil(k * words.length * 1.08))
      if (n !== last) {
        last = n
        setShown(n)
      }
      if (k >= 1) {
        gsap.ticker.remove(tick)
        finishRef.current()
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [words.length])
  const progress = useMemo(() => () => prog.current, [])
  return (
    <div className="dk-sw-qs">
      <p className="dk-sw-qs-title">
        <b>{title}</b>
      </p>
      <Waveform peaks={peaks} progress={progress} active height={36} label={t.samplePlaying} />
      <p className="dk-sw-qs-status" role="status">
        {shown >= words.length ? t.sampleDone : t.samplePlaying}
      </p>
      <p className="dk-sw-qs-text" lang={speechLang}>
        {words.slice(0, shown).join(' ')}
        {shown < words.length && <span className="dk-sw-qs-caret" aria-hidden="true" />}
      </p>
      <div className="dk-sw-qs-act">
        <Button size="sm" variant="secondary" icon="send" onClick={finish} title={t.skipHint} data-sw="voice-skip">
          {t.skip}
        </Button>
        <Button size="sm" variant="quiet" icon="mic" onClick={onRecord}>
          {t.recordOwn}
        </Button>
      </div>
    </div>
  )
}

export default function VoiceSheet({ persona, pack, quick, onClose, onResult }: {
  persona: PersonaKey
  pack: RegionPack | null
  /** opened from the "Voice note contoh" chip: play the quick sample */
  quick: boolean
  onClose: () => void
  onResult: (r: Result) => void
}) {
  const { lang } = useI18n()
  const t = useT()
  const sample = voiceSampleFor(persona, pack)
  const root = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'quick' | 'mic'>(quick ? 'quick' : 'mic')
  const [skippable, setSkippable] = useState(false)
  useEffect(() => {
    const back = document.activeElement
    root.current?.querySelector<HTMLElement>('[data-sw="voice-skip"], .dk-vr-foot button, .dk-vr-btn')?.focus()
    return () => {
      if (back instanceof HTMLElement && document.contains(back)) back.focus()
    }
  }, [])
  const speakLang = sample.lang.startsWith('id') ? 'Bahasa Indonesia' : (regionalLanguageLabel(pack, lang) ?? sample.lang)
  const sendSample = () => onResult({ text: sample.text, source: 'sample', lang: sample.lang })
  return (
    <div ref={root} className="dk-sw-sheet is-voice" role="dialog" aria-modal="false" aria-label={t.voiceTitle} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header>
        <b>{t.voiceTitle}</b>
        <IconButton icon="close" label={t.close} onClick={onClose} size="sm" />
      </header>
      {mode === 'quick' ? (
        <QuickSample text={sample.text} lang={sample.lang} title={fill(t.sampleQuick, { lang: speakLang })} onDone={onResult} onRecord={() => setMode('mic')} />
      ) : (
        <>
          <p className="dk-sw-muted">{fill(t.voiceHelp, { lang: speakLang })}</p>
          <VoiceRecorder
            speechCodes={persona === 'raka' ? ['id-ID'] : pack?.languages.speechCodes}
            sample={{ id: sample.id, text: sample.text, lang: sample.lang, title: sample.title, translation: sample.translation }}
            sampleWps={SAMPLE_WPS}
            onResult={(r) => onResult({ text: r.text, source: r.source, lang: r.lang })}
            onInterim={(x) => setSkippable(!!x && x !== sample.text && sample.text.startsWith(x))}
            label={t.voiceHold}
          />
          {skippable && (
            <div className="dk-sw-qs-act">
              <Button size="sm" variant="secondary" icon="send" onClick={sendSample} title={t.skipHint} data-sw="voice-skip">
                {t.skip}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
