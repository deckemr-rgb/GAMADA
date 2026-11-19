/**
 * indeks-ekonomi — mini-demo for /produk/indeks-ekonomi and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: district tiles "breathe" month by month, the flood dims the
 * affected districts, the "Operasi Pasar" programme is picked, its impact line recovers. District names are real
 * places; every index value is simulated. No map tiles, no store, no clock, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'indeks-ekonomi'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'bulan', ms: 2400, caption: { id: 'Ekonomi tiap kecamatan terbaca bulan demi bulan', en: 'Each district economy read month by month' } },
  { id: 'banjir', ms: 2400, caption: { id: 'Setelah banjir, kecamatan terdampak meredup', en: 'After the flood, affected districts dim' } },
  { id: 'program', ms: 2400, caption: { id: 'Program Operasi Pasar dipilih', en: 'The market operation programme is picked' } },
  { id: 'dampak', ms: 2800, caption: { id: 'Dampak kebijakan terukur', en: 'Policy impact, measured' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

/** [name, base level 0..1, flooded] */
const DISTRICTS: Array<[string, number, boolean]> = [
  ['Padangan', 0.6, false], ['Kalitidu', 0.7, false], ['Dander', 0.8, false],
  ['Kapas', 0.65, false], ['Balen', 0.55, true], ['Sumberrejo', 0.75, false],
  ['Kanor', 0.7, true], ['Baureno', 0.6, true], ['Trucuk', 0.5, false],
]
const BEFORE = [60, 62, 61, 63, 40, 38]
const AFTER = [60, 62, 61, 63, 40, 52]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const line = (v: number[]) => v.map((y, i) => `${i ? 'L' : 'M'}${i * 20} ${100 - y}`).join(' ')
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, display: 'flex', flexDirection: 'column' }}>
            <p style={H}>{t({ id: 'Indeks per kecamatan (simulasi)', en: 'Index per district (simulated)' })}</p>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3em', minHeight: 0 }}>
              {DISTRICTS.map(([n, lv, fl]) => {
                const v = fl && k >= 1 ? lv * 0.35 : lv
                return (
                  <span key={n} style={{ position: 'relative', borderRadius: '0.35em', background: 'var(--dk-s3)', overflow: 'hidden', display: 'grid', placeItems: 'end start', padding: '0.25em 0.35em', fontSize: '0.78em' }}>
                    <i style={{ position: 'absolute', inset: 0, background: 'var(--dk-eco-acc)', opacity: v, transition: 'opacity .7s ease' }} />
                    <span style={{ position: 'relative', fontWeight: 700, color: 'var(--dk-text)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{n}</span>
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 2), display: 'flex', alignItems: 'center', gap: '0.5em', borderColor: 'var(--dk-eco-acc)' }}>
              <span style={{ width: '0.8em', height: '0.8em', borderRadius: '50%', background: 'var(--dk-eco-acc)' }} />
              <b>{t({ id: 'Program: Operasi Pasar', en: 'Programme: market operation' })}</b>
            </div>
            <div style={{ ...BOX, display: 'flex', flexDirection: 'column' }}>
              <p style={H}>{t({ id: 'Indeks Kanor · 6 bulan', en: 'Kanor index · 6 months' })}</p>
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <path d={line(BEFORE)} fill="none" stroke="var(--dk-muted)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" style={{ opacity: k >= 1 ? 0.7 : 0, transition: 'opacity .5s ease' }} />
                  <path d={line(AFTER)} fill="none" stroke="var(--dk-eco-acc)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" style={{ opacity: k >= 3 ? 1 : 0, transition: 'opacity .6s ease' }} />
                </svg>
              </div>
              <b style={{ ...on(k >= 3), color: 'var(--dk-pos)' }}>{t({ id: '+14 poin setelah program (simulasi)', en: '+14 points after the programme (simulated)' })}</b>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
