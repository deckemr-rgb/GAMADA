/**
 * awas-belanja — mini-demo (Tahap 6 plan §2.3, P6 wow): the emergency pump package is scanned detector by detector,
 * HPS is set against the market median and the overpriced line is flagged. Fictional fixture; no currency amounts.
 */
import { PRODUCT_BY_SLUG, type Bi } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'paket', ms: 1800, caption: { id: 'Paket pompa air darurat dibuka', en: 'The emergency pump package opens' } },
  { id: 'pindai', ms: 2800, caption: { id: 'Detektor memindai satu per satu', en: 'Detectors scan one by one' } },
  { id: 'hps', ms: 2800, caption: { id: 'HPS dibandingkan dengan pasar', en: 'The estimate is compared with the market' } },
  { id: 'flag', ms: 3200, caption: { id: 'Item kemahalan ditandai', en: 'Overpriced items are flagged' } },
]

const DETECTORS: readonly { k: Bi; r: 'ok' | 'warn' | 'high' }[] = [
  { k: { id: 'HPS vs pasar', en: 'Estimate vs market' }, r: 'high' },
  { k: { id: 'Penawaran seragam', en: 'Uniform bids' }, r: 'warn' },
  { k: { id: 'Pemenang berulang', en: 'Repeat winners' }, r: 'high' },
  { k: { id: 'Pemecahan paket', en: 'Split packages' }, r: 'ok' },
]
const R: Record<'ok' | 'warn' | 'high', { cls: string; l: Bi }> = {
  ok: { cls: 'is-ok', l: { id: 'Lolos', en: 'Pass' } },
  warn: { cls: 'is-warn', l: { id: 'Waspada', en: 'Watch' } },
  high: { cls: 'is-danger', l: { id: 'Tinggi', en: 'High' } },
}

/** deviation of HPS above the market median (simulated) */
const ITEMS: readonly { k: Bi; dev: number }[] = [
  { k: { id: 'Pompa 6 inci', en: '6-inch pump' }, dev: 38 },
  { k: { id: 'Selang 50 m', en: '50 m hose' }, dev: 9 },
  { k: { id: 'Genset 5 kVA', en: '5 kVA genset' }, dev: 14 },
]

const T = {
  pkg: { id: 'Pengadaan Pompa Air Darurat', en: 'Emergency Water Pump Procurement' },
  opd: { id: 'Dinas PUPR · Pengadaan langsung', en: 'Public Works · Direct procurement' },
  risk: { id: 'Skor risiko', en: 'Risk score' },
  det: { id: 'Detektor', en: 'Detectors' },
  dev: { id: 'Deviasi HPS vs median pasar', en: 'Estimate deviation vs market median' },
  rec: { id: 'Rekomendasi: koreksi HPS, undang UMKM lokal', en: 'Recommendation: correct the estimate, invite local SMEs' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const scanning = s.index >= frameIndex(FRAMES, 'pindai')
  const flagged = s.index >= frameIndex(FRAMES, 'flag')
  const bars = s.index >= frameIndex(FRAMES, 'hps')
  return (
    <MiniFrame slug="awas-belanja" kind={PRODUCT_BY_SLUG['awas-belanja'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateRows: 'auto 1fr', gridTemplateColumns: '42% 1fr' }}>
        <div className="mk-panel mk-row" style={{ gridColumn: '1 / -1' }}>
          <div style={{ minWidth: 0 }}>
            <strong className="mk-t" style={{ display: 'block' }}>
              {t(T.pkg)}
            </strong>
            <span className="mk-muted mk-t" style={{ display: 'block' }}>
              {t(T.opd)}
            </span>
          </div>
          <span className={'mk-pill is-danger mk-pop' + on('flag')}>
            {t(T.risk)} 82
          </span>
        </div>
        <div className="mk-panel">
          <p className="mk-h">{t(T.det)}</p>
          <ul className="mk-list">
            {DETECTORS.map((d, i) => (
              <li key={d.k.en} className="mk-item" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4em 1cqw' }}>
                <span className="mk-t">{t(d.k)}</span>
                <span className={'mk-pill mk-fade ' + R[d.r].cls + (scanning ? ' is-on' : '')} style={{ transitionDelay: s.id === 'pindai' && !s.calm ? `${0.4 + i * 0.5}s` : '0s' }}>
                  {t(R[d.r].l)}
                </span>
                <span className="mk-meter" style={{ gridColumn: '1 / -1' }}>
                  <i style={{ ['--v' as string]: scanning ? 1 : 0, transitionDelay: s.id === 'pindai' && !s.calm ? `${i * 0.5}s` : '0s' }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mk-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '1cqw' }}>
          <p className="mk-h" style={{ margin: 0 }}>
            {t(T.dev)}
          </p>
          <div style={{ display: 'grid', gap: '1.2cqw', alignContent: 'center' }}>
            {ITEMS.map((it, i) => {
              const hot = i === 0 && flagged
              return (
                <div
                  key={it.k.en}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34% 1fr 3.4em',
                    alignItems: 'center',
                    gap: '1cqw',
                    padding: '0.5cqw 0.8cqw',
                    borderRadius: '0.8cqw',
                    background: hot ? 'var(--dk-danger-12)' : 'transparent',
                    transition: 'background-color .35s',
                  }}
                >
                  <span className="mk-t">{t(it.k)}</span>
                  <span className={'mk-meter' + (it.dev > 25 ? ' is-danger' : '')}>
                    <i style={{ ['--v' as string]: bars ? it.dev / 45 : 0 }} />
                  </span>
                  <strong style={{ textAlign: 'right', color: it.dev > 25 ? 'var(--dk-danger)' : 'var(--dk-text)' }}>+{it.dev}%</strong>
                </div>
              )
            })}
          </div>
          <span className={'mk-item mk-in' + on('flag')} style={{ border: '1px solid var(--dk-line-act)' }}>
            <span className="mk-tick is-on">✓</span>
            <span>{t(T.rec)}</span>
          </span>
        </div>
      </div>
    </MiniFrame>
  )
}
