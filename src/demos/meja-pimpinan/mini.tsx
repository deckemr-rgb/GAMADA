/**
 * meja-pimpinan — mini-demo (Tahap 6 plan §2.3, P2 wow): the 07:00 briefing assembles itself from other products, then
 * a plain-language question becomes a ranked chart and the instruction becomes an agency task. Constant fixture.
 */
import { PRODUCT_BY_SLUG, type Bi, type ProductSlug } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'kosong', ms: 1400, caption: { id: 'Pukul 07.00, briefing mulai disusun', en: '07:00, the briefing starts to assemble' } },
  { id: 'briefing', ms: 3000, caption: { id: 'Butir briefing dari enam produk', en: 'Briefing items from six products' } },
  { id: 'tanya', ms: 1800, caption: { id: 'Pimpinan bertanya dengan bahasa biasa', en: 'The head asks in plain words' } },
  { id: 'jawab', ms: 2800, caption: { id: 'Jawaban berupa grafik dan peringkat', en: 'The answer comes as a chart and ranking' } },
  { id: 'instruksi', ms: 2800, caption: { id: 'Instruksi menjadi tugas OPD', en: 'The instruction becomes an agency task' } },
]

const KPI: readonly { k: Bi; v: string; warn?: boolean }[] = [
  { k: { id: 'Aduan hari ini', en: 'Reports today' }, v: '148' },
  { k: { id: 'SLA tepat waktu', en: 'SLA on time' }, v: '87%' },
  { k: { id: 'Peringatan aktif', en: 'Active alerts' }, v: '4', warn: true },
  { k: { id: 'Isu negatif', en: 'Negative issues' }, v: '2', warn: true },
]

const BRIEF: readonly { from: ProductSlug; text: Bi }[] = [
  { from: 'siaga-wilayah', text: { id: 'Hujan lebat; 4 kecamatan waspada', en: 'Heavy rain; 4 districts on alert' } },
  { from: 'sapa-warga', text: { id: 'Klaster banjir Kel. Kanor: 12 aduan', en: 'Kanor flood cluster: 12 reports' } },
  { from: 'radar-isu', text: { id: 'Isu "bendungan jebol" mulai beredar', en: '"Dam burst" rumour starts to spread' } },
  { from: 'awas-belanja', text: { id: '1 paket darurat berisiko tinggi', en: '1 emergency package at high risk' } },
  { from: 'sinyal-pasar', text: { id: 'Harga cabai di atas pola musiman', en: 'Chilli price above seasonal pattern' } },
]

const RANK: readonly [string, number][] = [
  ['Kanor', 0.92],
  ['Baureno', 0.74],
  ['Kalitidu', 0.58],
  ['Dander', 0.41],
]

const T = {
  brief: { id: 'Briefing pagi · 07.00', en: 'Morning briefing · 07:00' },
  ask: { id: 'Tanya data', en: 'Ask the data' },
  q: { id: 'Desa mana paling berisiko?', en: 'Which village is most at risk?' },
  task: { id: 'Instruksi: kerahkan pompa ke Kanor', en: 'Instruction: send pumps to Kanor' },
  to: { id: 'Disposisi → Dinas PUPR · tugas dibuat', en: 'Disposition → Public Works · task created' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const briefFrom = frameIndex(FRAMES, 'briefing')
  return (
    <MiniFrame slug="meja-pimpinan" kind={PRODUCT_BY_SLUG['meja-pimpinan'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateRows: 'auto 1fr', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1.4cqw' }}>
          {KPI.map((k) => (
            <div key={k.v + k.k.id} className="mk-panel" style={{ padding: '1.2cqw 1.4cqw' }}>
              <div className="mk-muted mk-t" style={{ fontSize: '0.82em' }}>
                {t(k.k)}
              </div>
              <div className="mk-big" style={{ color: k.warn ? 'var(--dk-warn)' : 'var(--dk-text)' }}>
                {k.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mk-panel">
          <p className="mk-h">{t(T.brief)}</p>
          <ol className="mk-list">
            {BRIEF.map((b, i) => (
              <li
                key={b.from}
                className={'mk-item mk-in' + (s.index >= briefFrom ? ' is-on' : '')}
                style={{ transitionDelay: s.index === briefFrom && !s.calm ? `${i * 0.28}s` : '0s' }}
                data-eco={PRODUCT_BY_SLUG[b.from].eco}
              >
                <span className="mk-dot" />
                <span className="mk-t" style={{ flex: 1 }}>
                  {t(b.text)}
                </span>
                <span className="mk-muted mk-t" style={{ fontSize: '0.8em', maxWidth: '30%' }}>
                  {PRODUCT_BY_SLUG[b.from].name}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mk-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: '1cqw' }}>
          <p className="mk-h" style={{ margin: 0 }}>
            {t(T.ask)}
          </p>
          <div className={'mk-bubble is-me mk-in' + on('tanya')} style={{ maxWidth: '100%' }}>
            {t(T.q)}
          </div>
          <div style={{ display: 'grid', gap: '0.9cqw', alignContent: 'start' }}>
            {RANK.map(([name, v], i) => (
              <div key={name} className={'mk-fade' + on('jawab')} style={{ display: 'grid', gridTemplateColumns: '28% 1fr', alignItems: 'center', gap: '1cqw' }}>
                <span className="mk-t">{name}</span>
                <span className={'mk-meter' + (i === 0 ? ' is-danger' : '')}>
                  <i style={{ ['--v' as string]: s.index >= frameIndex(FRAMES, 'jawab') ? v : 0 }} />
                </span>
              </div>
            ))}
          </div>
          <div className={'mk-item mk-in' + on('instruksi')} style={{ display: 'grid', gap: '0.2em', border: '1px solid var(--dk-line-act)' }}>
            <strong className="mk-t">{t(T.task)}</strong>
            <span className="mk-row">
              <span className="mk-muted mk-t">{t(T.to)}</span>
              <span className="mk-tick is-on">✓</span>
            </span>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
