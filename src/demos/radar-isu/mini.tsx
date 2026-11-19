/**
 * radar-isu — mini-demo (Tahap 6 plan §2.3, P4 wow): mentions stream, volume spikes on a "dam burst" hoax, the alert
 * shows its evidence from Siaga Wilayah, a clarification is drafted and sentiment recovers. Fictional fixture.
 */
import { PRODUCT_BY_SLUG, type Bi } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'pantau', ms: 2000, caption: { id: 'Pantauan berjalan normal', en: 'Monitoring runs as usual' } },
  { id: 'lonjakan', ms: 2000, caption: { id: 'Volume tiba-tiba melonjak', en: 'Volume suddenly spikes' } },
  { id: 'hoaks', ms: 2800, caption: { id: 'Peringatan hoaks dengan bukti', en: 'Hoax alert with evidence' } },
  { id: 'klarifikasi', ms: 2600, caption: { id: 'Draf klarifikasi siap', en: 'Draft clarification ready' } },
  { id: 'pulih', ms: 2600, caption: { id: 'Sentimen pulih setelah terbit', en: 'Sentiment recovers after publishing' } },
]

const MENTIONS: readonly { src: string; text: Bi; tone: 'pos' | 'neu' | 'neg' }[] = [
  { src: '@infobjn_', text: { id: 'BENDUNGAN JEBOL!! segera mengungsi', en: 'DAM BURST!! evacuate now' }, tone: 'neg' },
  { src: 'KabarKota', text: { id: 'Hujan deras sejak subuh di Kanor', en: 'Heavy rain since dawn in Kanor' }, tone: 'neu' },
  { src: '@warga_dander', text: { id: 'Posko sudah buka, terima kasih', en: 'The post is open, thank you' }, tone: 'pos' },
]

const T = {
  stream: { id: 'Pantauan live', en: 'Live monitoring' },
  vol: { id: 'Volume & sentimen 24 jam', en: 'Volume & sentiment, 24 h' },
  alert: { id: 'Peringatan hoaks', en: 'Hoax alert' },
  claim: { id: '"Bendungan jebol"', en: '"Dam burst"' },
  score: { id: 'Kemungkinan hoaks 91%', en: 'Hoax likelihood 91%' },
  proof: { id: 'Bukti: tinggi muka air normal (Siaga Wilayah)', en: 'Evidence: water level normal (Siaga Wilayah)' },
  draft: { id: 'Draf klarifikasi · nada menenangkan', en: 'Draft clarification · calming tone' },
  formats: [
    { id: 'Rilis pers', en: 'Press release' },
    { id: 'Caption', en: 'Caption' },
    { id: 'Infografis', en: 'Infographic' },
  ] as Bi[],
  rec: { id: 'Sentimen pulih', en: 'Sentiment recovering' },
}

const TONE = { pos: 'is-ok', neu: '', neg: 'is-danger' } as const
const TONE_L: Record<'pos' | 'neu' | 'neg', Bi> = {
  pos: { id: 'positif', en: 'positive' },
  neu: { id: 'netral', en: 'neutral' },
  neg: { id: 'negatif', en: 'negative' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const spiked = s.index >= frameIndex(FRAMES, 'lonjakan')
  const recovered = s.index >= frameIndex(FRAMES, 'pulih')
  return (
    <MiniFrame slug="radar-isu" kind={PRODUCT_BY_SLUG['radar-isu'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateColumns: '40% 1fr', gridTemplateRows: '46% 1fr' }}>
        <div className="mk-panel" style={{ gridRow: '1 / -1' }}>
          <p className="mk-h">{t(T.stream)}</p>
          <ul className="mk-list">
            {MENTIONS.map((m, i) => (
              <li key={m.src} className={'mk-item' + (i === 0 ? ' mk-in' + on('lonjakan') : '')} style={{ display: 'grid', gap: '0.3em' }}>
                <span className="mk-row">
                  <strong className="mk-t">{m.src}</strong>
                  <span className={'mk-pill ' + TONE[m.tone]}>{t(TONE_L[m.tone])}</span>
                </span>
                <span>{t(m.text)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mk-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}>
          <p className="mk-h">
            <span>{t(T.vol)}</span>
            <span className={'mk-pill is-ok mk-fade' + on('pulih')}>{t(T.rec)}</span>
          </p>
          <svg className="mk-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0 32 L20 30 L40 31 L55 29 L70 30 L85 29 L100 30" fill="none" stroke="var(--dk-muted)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" style={{ opacity: spiked ? 0 : 1, transition: 'opacity .35s' }} />
            <path d="M0 32 L20 30 L40 31 L55 26 L70 14 L85 6 L100 4" fill="none" stroke="var(--dk-danger)" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ opacity: spiked && !recovered ? 1 : 0, transition: 'opacity .35s' }} />
            <path d="M0 32 L20 30 L40 31 L55 26 L70 14 L80 12 L90 20 L100 26" fill="none" stroke="var(--dk-pos)" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ opacity: recovered ? 1 : 0, transition: 'opacity .35s' }} />
          </svg>
        </div>
        <div style={{ position: 'relative', minHeight: 0 }}>
          <div className={'mk-panel mk-in' + on('hoaks')} style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'start', gap: '0.9cqw', borderColor: 'color-mix(in srgb, var(--dk-danger) 50%, transparent)', opacity: s.index >= frameIndex(FRAMES, 'klarifikasi') ? 0 : undefined }}>
            <p className="mk-h" style={{ margin: 0 }}>
              <span>{t(T.alert)}</span>
              <span className="mk-pill is-danger">{t(T.score)}</span>
            </p>
            <strong>{t(T.claim)}</strong>
            <span className="mk-item">
              <span className="mk-tick is-on">✓</span>
              <span>{t(T.proof)}</span>
            </span>
          </div>
          <div className={'mk-panel mk-in' + on('klarifikasi')} style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'start', gap: '1cqw' }}>
            <p className="mk-h" style={{ margin: 0 }}>
              {t(T.draft)}
            </p>
            <span className="mk-row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {T.formats.map((f) => (
                <span key={f.en} className="mk-pill">
                  ✓ {t(f)}
                </span>
              ))}
            </span>
            <span className="mk-muted">
              {t({ id: 'Bendungan dalam kondisi aman. Tinggi muka air terpantau normal pagi ini…', en: 'The dam is safe. Water levels were normal this morning…' })}
            </span>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
