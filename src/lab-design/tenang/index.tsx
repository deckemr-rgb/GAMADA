/**
 * Direction C — "Data-dense tenang" (calm, data-dense). An operations console for people who work
 * in it all day: compact Manrope 12/13, 32 px rows, split panes, quiet surfaces with crisp 1 px
 * lines, colour only for status and the ecosystem accent dot, real keyboard affordances.
 * Wow moments: the KPI strip counting up live when a new ticket lands, and the document
 * extraction filling the side panel field by field with confidence bars.
 */
import { useI18n } from '../../lib/i18n'
import ChartBlock from './ChartBlock'
import Chat from './Chat'
import Console from './Console'
import DocBlock from './DocBlock'
import MapBlock from './MapBlock'
import { Kbd } from './shared'
import TokenSheet from './TokenSheet'
import './tenang.css'

const C = {
  id: {
    code: 'Arah C',
    name: 'Data-dense tenang',
    title: 'Konsol yang tenang untuk kerja seharian',
    lead: 'Padat tapi tidak bising. Ritme 4 px, angka rata kanan yang selalu sejajar, garis 1 px, dan warna hanya muncul saat ada yang perlu diperhatikan.',
    specs: [
      ['12/13', 'px teks UI'],
      ['32', 'px baris padat'],
      ['1', 'px garis'],
      ['0', 'warna dekoratif'],
    ],
    keys: 'Papan ketik',
  },
  en: {
    code: 'Direction C',
    name: 'Calm data-dense',
    title: 'A calm console for all-day work',
    lead: 'Dense but never noisy. A 4 px rhythm, right-aligned numbers that always line up, 1 px lines, and colour only when something needs attention.',
    specs: [
      ['12/13', 'px UI text'],
      ['32', 'px compact rows'],
      ['1', 'px lines'],
      ['0', 'decorative colours'],
    ],
    keys: 'Keyboard',
  },
}

export default function Direction() {
  const { lang } = useI18n()
  const c = C[lang]
  return (
    <div className="ldt-root">
      <header className="ldt-intro">
        <div className="ldt-intro-l">
          <p className="ldt-eyebrow">
            <span className="ldt-dot ldt-dot--teal" aria-hidden="true" />
            {c.code} · {c.name}
          </p>
          <h2 className="ldt-display ldt-intro-title">{c.title}</h2>
          <p className="ldt-intro-lead">{c.lead}</p>
        </div>
        <dl className="ldt-intro-specs">
          {c.specs.map(([v, l]) => (
            <div key={l}>
              <dt className="ldt-num">{v}</dt>
              <dd>{l}</dd>
            </div>
          ))}
          <div className="ldt-intro-keys">
            <dt>{c.keys}</dt>
            <dd>
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              <Kbd>↵</Kbd>
              <Kbd>N</Kbd>
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
            </dd>
          </div>
        </dl>
      </header>
      <TokenSheet />
      <Console />
      <Chat />
      <MapBlock />
      <ChartBlock />
      <DocBlock />
    </div>
  )
}
