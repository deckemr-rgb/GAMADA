/**
 * demos/sapa-warga/Speak.tsx — "Dengarkan" / "Putar" for one text (TTS, or a silent word walk when the browser has no
 * voice for the language). Lazy: the media kit loads with the first AI answer, never with the page.
 */
import { useSpeakText } from '../../demo-kit/media/Speak'
import { Icon } from '../../demo-kit/ui/icons'

export default function Speak({ text, lang, label }: { text: string; lang: string; label: string }) {
  const sp = useSpeakText(text, lang)
  return (
    <button type="button" className={`dk-sw-speak${sp.state.playing ? ' is-on' : ''}`} aria-pressed={sp.state.playing} onClick={sp.toggle}>
      <Icon name={sp.state.playing ? 'pause' : 'play'} size={13} />
      {label}
    </button>
  )
}
