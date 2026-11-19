/**
 * kenal-mitra — mini-demo for /produk/kenal-mitra and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: an ID card arrives, checks tick one by one, the SME gets its
 * "Terverifikasi" badge, 200 CVs are narrowed to the top 10. Fixture data only (a fictional person and SME; the
 * ID number is masked). No store, no clock, no camera, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'kenal-mitra'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'unggah', ms: 2000, caption: { id: 'Foto KTP dan swafoto diterima', en: 'ID card photo and selfie received' } },
  { id: 'cek', ms: 3000, caption: { id: 'Format NIK, kecocokan wajah, dan izin usaha dicek', en: 'ID format, face match and business licence checked' } },
  { id: 'lencana', ms: 2400, caption: { id: 'UMKM terverifikasi dan berlencana', en: 'SME verified and badged' } },
  { id: 'cv', ms: 2800, caption: { id: '200 CV disaring menjadi 10 terbaik beserta alasannya', en: '200 CVs narrowed to the top 10, with reasons' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

const CHECKS = [
  { id: 'Format NIK valid', en: 'ID number format valid' },
  { id: 'Wajah cocok dengan KTP', en: 'Face matches the ID card' },
  { id: 'NIB usaha aktif', en: 'Business ID active' },
]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.7em', alignItems: 'center', background: 'var(--dk-s2)' }}>
              <span style={{ width: '3.2em', height: '3.8em', borderRadius: '0.4em', background: 'var(--dk-s3)', display: 'grid', placeItems: 'center', color: 'var(--dk-muted)' }}>◔</span>
              <span style={{ display: 'grid', gap: '0.3em' }}>
                <b>{t({ id: 'KTP · Dewi Lestari', en: 'ID card · Dewi Lestari' })}</b>
                <span style={{ color: 'var(--dk-muted)' }}>3522 •••• •••• 0047</span>
                <span style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Usaha: Keripik Dewi, Dander', en: 'Business: Keripik Dewi, Dander' })}</span>
              </span>
            </div>
            <div style={BOX}>
              <p style={H}>{t({ id: 'Pemeriksaan', en: 'Checks' })}</p>
              {CHECKS.map((c, i) => {
                const done = k >= 2 || (k === 1 && i < 2)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', padding: '0.3em 0', opacity: k >= 1 ? 1 : 0.45, transition: 'opacity .4s ease' }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: '1.3em', height: '1.3em', borderRadius: '50%', background: done ? 'var(--dk-pos)' : 'var(--dk-s3)', color: 'var(--dk-bg)', fontSize: '0.85em', fontWeight: 800, transition: 'background .4s ease' }}>
                      {done ? '✓' : ''}
                    </span>
                    {t(c)}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 2), textAlign: 'center', borderColor: 'var(--dk-eco-acc)' }}>
              <span style={{ display: 'inline-block', padding: '0.3em 0.8em', borderRadius: '99em', background: 'var(--dk-eco-acc)', color: 'var(--dk-bg)', fontWeight: 800 }}>{t({ id: 'Terverifikasi ✓', en: 'Verified ✓' })}</span>
              <div style={{ marginTop: '0.4em', color: 'var(--dk-muted)' }}>{t({ id: 'Lencana tampil di etalase pemda', en: 'Badge shown in the government showcase' })}</div>
            </div>
            <div style={{ ...BOX, ...on(k >= 3) }}>
              <p style={H}>{t({ id: 'Saring kandidat', en: 'Screen candidates' })}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <b style={{ fontSize: '1.5em' }}>200</b>
                <span style={{ flex: 1, height: '0.5em', borderRadius: '99em', background: 'linear-gradient(90deg, var(--dk-s3), var(--dk-eco-acc))' }} />
                <b style={{ fontSize: '1.5em', color: 'var(--dk-eco-acc)' }}>10</b>
              </div>
              <div style={{ marginTop: '0.5em', color: 'var(--dk-muted)' }}>{t({ id: '#1 Fajar: 4 tahun gudang, sertifikat K3', en: '#1 Fajar: 4 years in warehousing, safety certificate' })}</div>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
