/**
 * cek-berkas — mini-demo (Tahap 6 plan §2.3, P7 wow): a SPESIMEN document is uploaded, OCR boxes appear, the checklist
 * ticks itself and one cross-check mismatch flips the result to "Perlu Cek Manual". Fictional specimen fixture.
 */
import { PRODUCT_BY_SLUG, type Bi } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'unggah', ms: 1800, caption: { id: 'Berkas spesimen diunggah', en: 'A specimen file is uploaded' } },
  { id: 'baca', ms: 2400, caption: { id: 'Field dibaca dengan OCR', en: 'Fields are read with OCR' } },
  { id: 'centang', ms: 2800, caption: { id: 'Syarat dicentang satu per satu', en: 'Requirements ticked one by one' } },
  { id: 'beda', ms: 3200, caption: { id: 'Satu ketidakcocokan ditemukan', en: 'One mismatch found' } },
]

const CHECKS: readonly { k: Bi; bad?: boolean }[] = [
  { k: { id: 'Format NIK valid', en: 'ID number format valid' } },
  { k: { id: 'Tanggal lahir cocok dengan NIK', en: 'Birth date matches ID number' } },
  { k: { id: 'Masa berlaku', en: 'Validity period' } },
  { k: { id: 'Tanda tangan ada', en: 'Signature present' } },
  { k: { id: 'Nama di KK = nama di KTP', en: 'Name on family card = ID card' }, bad: true },
]

/** OCR boxes on the specimen card (% of the card) */
const BOXES: readonly [number, number, number, number][] = [
  [30, 22, 52, 9],
  [30, 36, 40, 8],
  [30, 49, 46, 8],
  [30, 62, 34, 8],
]

const T = {
  doc: { id: 'KTP · spesimen', en: 'ID card · specimen' },
  checks: { id: 'Cek konsistensi', en: 'Consistency checks' },
  manual: { id: 'Perlu Cek Manual', en: 'Needs Manual Check' },
  why: { id: 'KK: "Siti Rahayu" · KTP: "Siti Rahayuningsih"', en: 'Family card: "Siti Rahayu" · ID: "Siti Rahayuningsih"' },
  conf: { id: 'keyakinan', en: 'confidence' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const ticking = s.index >= frameIndex(FRAMES, 'centang')
  const mismatch = s.index >= frameIndex(FRAMES, 'beda')
  const delay = (i: number) => (s.id === 'centang' && !s.calm ? `${i * 0.35}s` : '0s')
  return (
    <MiniFrame slug="cek-berkas" kind={PRODUCT_BY_SLUG['cek-berkas'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateColumns: '46% 1fr' }}>
        <div className="mk-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
          <p className="mk-h">
            <span>{t(T.doc)}</span>
            <span className={'mk-pill mk-fade' + on('baca')}>97% {t(T.conf)}</span>
          </p>
          <div
            className={'mk-in' + on('unggah')}
            style={{ position: 'relative', alignSelf: 'center', aspectRatio: '1.58', borderRadius: '1.2cqw', background: 'linear-gradient(135deg, #cfe3f6, #e9f1fb)', overflow: 'hidden' }}
          >
            <span style={{ position: 'absolute', left: '5%', top: '22%', width: '20%', height: '52%', borderRadius: '0.6cqw', background: '#9fb7cf' }} />
            {[22, 36, 49, 62].map((y, i) => (
              <span key={y} style={{ position: 'absolute', left: '31%', top: `${y + 2}%`, width: `${[48, 36, 42, 30][i]}%`, height: '4%', borderRadius: '2px', background: '#6b7f96', opacity: 0.6 }} />
            ))}
            {BOXES.map(([x, y, w, h], i) => (
              <span
                key={i}
                className={'mk-fade' + on('baca')}
                style={{
                  position: 'absolute',
                  left: `${x - 1}%`,
                  top: `${y}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                  border: `1.5px solid ${i === 0 && mismatch ? 'var(--dk-danger)' : 'var(--dk-accent-fill)'}`,
                  borderRadius: '3px',
                  transitionDelay: s.id === 'baca' && !s.calm ? `${i * 0.3}s` : '0s',
                }}
              />
            ))}
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(179, 38, 30, 0.35)', fontWeight: 800, fontSize: '2.4em', letterSpacing: '0.2em', rotate: '-18deg' }}>
              SPESIMEN
            </span>
          </div>
          <span className={'mk-pill is-danger mk-pop' + on('beda')} style={{ justifySelf: 'start', marginTop: '1cqw' }}>
            {t(T.manual)}
          </span>
        </div>
        <div className="mk-panel">
          <p className="mk-h">{t(T.checks)}</p>
          <ul className="mk-list">
            {CHECKS.map((c, i) => {
              const bad = c.bad && mismatch
              const done = c.bad ? mismatch : ticking
              return (
                <li
                  key={c.k.en}
                  className="mk-item"
                  style={{ background: bad ? 'var(--dk-danger-12)' : undefined, border: bad ? '1px solid color-mix(in srgb, var(--dk-danger) 45%, transparent)' : '1px solid transparent' }}
                >
                  <span
                    className="mk-tick"
                    style={
                      done
                        ? { color: bad ? '#fff' : 'var(--dk-on-accent)', background: bad ? 'var(--dk-danger)' : 'var(--dk-accent)', borderColor: 'transparent', transition: 'background-color .3s', transitionDelay: delay(i) }
                        : undefined
                    }
                  >
                    {bad ? '!' : '✓'}
                  </span>
                  <span className="mk-t">{t(c.k)}</span>
                </li>
              )
            })}
          </ul>
          <p className={'mk-muted mk-in' + on('beda')} style={{ margin: '1.2cqw 0 0' }}>
            {t(T.why)}
          </p>
        </div>
      </div>
    </MiniFrame>
  )
}
