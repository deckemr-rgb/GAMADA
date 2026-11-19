/**
 * sinyal-pasar — mini-demo for /produk/sinyal-pasar and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: chilli and rice price lines start rising after the flood, an
 * early warning fires 5 days before the forecast peak, a market operation is recommended to Meja Pimpinan, the
 * simulation flattens the forecast. Prices shown as a change index only, all simulated. No store, no clock,
 * no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'sinyal-pasar'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'naik', ms: 2400, caption: { id: 'Setelah banjir, cabai dan beras mulai naik', en: 'After the flood, chilli and rice start rising' } },
  { id: 'peringatan', ms: 2600, caption: { id: 'Peringatan dini 5 hari sebelum puncak', en: 'Early warning 5 days before the peak' } },
  { id: 'rekomendasi', ms: 2400, caption: { id: 'Operasi pasar direkomendasikan ke Meja Pimpinan', en: 'A market operation is recommended to Meja Pimpinan' } },
  { id: 'simulasi', ms: 2800, caption: { id: 'Simulasi: prediksi harga melandai', en: 'Simulation: the price forecast flattens' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

/* index 0..100 over 10 days; day 6 = today; the forecast continues dashed */
const CABAI = [30, 31, 30, 33, 38, 44]
const CABAI_F = [44, 55, 66, 74, 78]
const CABAI_SIM = [44, 48, 50, 51, 51]
const BERAS = [40, 40, 41, 42, 44, 46]
const BERAS_F = [46, 50, 54, 57, 58]
const pts = (v: number[], from = 0) => v.map((y, i) => `${i ? 'L' : 'M'}${(from + i) * 11} ${100 - y}`).join(' ')

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const sim = k >= 3
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, display: 'flex', flexDirection: 'column' }}>
            <p style={H}>{t({ id: 'Indeks harga · Pasar Kota (simulasi)', en: 'Price index · Town market (simulated)' })}</p>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <path d="M55 0V100" stroke="var(--dk-line-2)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <path d={pts(BERAS)} fill="none" stroke="var(--dk-muted)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d={pts(BERAS_F, 5)} fill="none" stroke="var(--dk-muted)" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" style={{ opacity: sim ? 0.3 : 0.8, transition: 'opacity .5s ease' }} />
                <path d={pts(CABAI)} fill="none" stroke="var(--dk-danger)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <path d={pts(CABAI_F, 5)} fill="none" stroke="var(--dk-danger)" strokeWidth="2.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" style={{ opacity: k >= 1 && !sim ? 1 : 0.15, transition: 'opacity .5s ease' }} />
                <path d={pts(CABAI_SIM, 5)} fill="none" stroke="var(--dk-pos)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" style={{ opacity: sim ? 1 : 0, transition: 'opacity .6s ease' }} />
              </svg>
            </div>
            <div style={{ display: 'flex', gap: '1em', marginTop: '0.4em', fontSize: '0.88em' }}>
              <span style={{ color: 'var(--dk-danger)', fontWeight: 700 }}>{t({ id: 'Cabai +48%', en: 'Chilli +48%' })}</span>
              <span style={{ color: 'var(--dk-muted)', fontWeight: 700 }}>{t({ id: 'Beras +15%', en: 'Rice +15%' })}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto', alignContent: 'start', gap: '0.6em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 1), borderColor: 'var(--dk-warn)' }}>
              <b style={{ color: 'var(--dk-warn)' }}>{t({ id: 'Peringatan dini', en: 'Early warning' })}</b>
              <div style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Puncak cabai diperkirakan 5 hari lagi', en: 'Chilli peak expected in 5 days' })}</div>
            </div>
            <div style={{ ...BOX, ...on(k >= 2) }}>
              <b>{t({ id: 'Rekomendasi terkirim', en: 'Recommendation sent' })}</b>
              <div style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Operasi pasar → Meja Pimpinan', en: 'Market operation → Meja Pimpinan' })}</div>
            </div>
            <div style={{ ...BOX, ...on(sim), borderColor: 'var(--dk-pos)' }}>
              <b style={{ color: 'var(--dk-pos)' }}>{t({ id: 'Prediksi melandai', en: 'Forecast flattens' })}</b>
              <div style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Puncak turun dari +78 ke +51', en: 'Peak down from +78 to +51' })}</div>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
