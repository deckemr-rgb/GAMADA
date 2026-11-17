/**
 * demos/sapa-warga/VoiceSheet.tsx — hold-to-talk voice note inside the phone (lazy: the media kit loads only when the
 * citizen opens it). Web Speech in the region's language when the browser supports it, else the bundled sample voice
 * note (TTS / silent timeline), whose transcript streams word by word.
 */
import { useEffect, useRef } from 'react'
import { useI18n } from '../../lib/i18n'
import { VoiceRecorder } from '../../demo-kit/media/VoiceRecorder'
import { IconButton } from '../../demo-kit/ui'
import type { RegionPack } from '../../demo-kit/region/types'
import { regionalLanguageLabel } from '../../demo-kit/i18n'
import { voiceSampleFor, type PersonaKey } from './model'
import { fill, useT } from './strings'

export default function VoiceSheet({ persona, pack, onClose, onResult }: {
  persona: PersonaKey
  pack: RegionPack | null
  onClose: () => void
  onResult: (r: { text: string; source: 'mic' | 'sample'; lang: string }) => void
}) {
  const { lang } = useI18n()
  const t = useT()
  const sample = voiceSampleFor(persona, pack)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const back = document.activeElement
    root.current?.querySelector<HTMLElement>('.dk-vr-foot button, .dk-vr-btn')?.focus()
    return () => {
      if (back instanceof HTMLElement && document.contains(back)) back.focus()
    }
  }, [])
  const speakLang = sample.lang.startsWith('id') ? 'Bahasa Indonesia' : (regionalLanguageLabel(pack, lang) ?? sample.lang)
  return (
    <div ref={root} className="dk-sw-sheet is-voice" role="dialog" aria-modal="false" aria-label={t.voiceTitle} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header>
        <b>{t.voiceTitle}</b>
        <IconButton icon="close" label={t.close} onClick={onClose} size="sm" />
      </header>
      <p className="dk-sw-muted">{fill(t.voiceHelp, { lang: speakLang })}</p>
      <VoiceRecorder
        speechCodes={persona === 'raka' ? ['id-ID'] : pack?.languages.speechCodes}
        sample={{ id: sample.id, text: sample.text, lang: sample.lang, title: sample.title, translation: sample.translation }}
        onResult={(r) => onResult({ text: r.text, source: r.source, lang: r.lang })}
        label={t.voiceHold}
      />
    </div>
  )
}
