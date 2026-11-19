/**
 * katalog-lokal — mini-demo for /produk/katalog-lokal and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop on the split frame (pemda | UMKM) from mini-kit + inline kit tokens: a need typed in plain words,
 * turned into a structured spec, matched to verified local SMEs, confirmed from the SME side. Fixture data only
 * (fictional SMEs; quantities are a demo-world scenario). No store, no clock, no AI call, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'katalog-lokal'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'kebutuhan', ms: 2400, caption: { id: 'Pemda menulis kebutuhan dengan bahasa biasa', en: 'The government writes its need in plain words' } },
  { id: 'spek', ms: 2400, caption: { id: 'Kebutuhan menjadi spesifikasi terstruktur', en: 'The need becomes a structured spec' } },
  { id: 'cocok', ms: 2600, caption: { id: 'UMKM lokal terverifikasi yang cocok muncul', en: 'Matching verified local SMEs appear' } },
  { id: 'konfirmasi', ms: 2800, caption: { id: 'UMKM menerima pesanan dari sisinya', en: 'The SME accepts the order on its side' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.6em 0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.4em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

const SPEC = [
  { k: { id: 'Barang', en: 'Item' }, v: { id: 'Karung pasir · 2.000', en: 'Sandbags · 2,000' } },
  { k: { id: 'Barang', en: 'Item' }, v: { id: 'Terpal 4×6 · 50', en: 'Tarps 4×6 · 50' } },
  { k: { id: 'Kirim', en: 'Deliver' }, v: { id: 'Kec. Kanor · 2 hari', en: 'Kanor district · 2 days' } },
]
const SMES = [
  { n: 'UD Karya Tani', d: { id: 'Baureno · 6 km', en: 'Baureno · 6 km' }, m: 96 },
  { n: 'CV Sumber Plastik', d: { id: 'Kanor · 2 km', en: 'Kanor · 2 km' }, m: 91 },
]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: '0.55em', minHeight: 0 }}>
            <div style={{ ...BOX, background: 'var(--dk-s2)' }}>
              <p style={H}>{t({ id: 'Pemda · buat kebutuhan', en: 'Government · create a need' })}</p>
              <span>{t({ id: '"Butuh 2.000 karung pasir dan 50 terpal untuk Kec. Kanor, kirim 2 hari."', en: '"Need 2,000 sandbags and 50 tarps for Kanor district, delivered in 2 days."' })}</span>
            </div>
            <div style={{ ...BOX, ...on(k >= 1), display: 'grid', gap: '0.15em' }}>
              {SPEC.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '4.2em 1fr', gap: '0.4em' }}>
                  <span style={{ color: 'var(--dk-muted)' }}>{t(r.k)}</span>
                  <b>{t(r.v)}</b>
                </div>
              ))}
            </div>
            <div style={{ ...BOX, ...on(k >= 2), display: 'grid', alignContent: 'start', gap: '0.3em' }}>
              {SMES.map((m, i) => (
                <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', padding: '0.2em 0.3em', borderRadius: '0.4em', background: i === 0 && k >= 3 ? 'var(--dk-acc-12)' : 'transparent' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{m.n}</b> <span style={{ color: 'var(--dk-pos)' }}>✓</span>
                    <span style={{ color: 'var(--dk-muted)' }}> · {t(m.d)}</span>
                  </span>
                  <b style={{ color: 'var(--dk-eco-acc)' }}>{m.m}%</b>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...BOX, background: 'var(--dk-s2)', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
            <p style={H}>{t({ id: 'Sisi UMKM', en: 'SME side' })}</p>
            <b>UD Karya Tani</b>
            <div style={{ ...on(k >= 3), display: 'grid', gap: '0.45em' }}>
              <span style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Pesanan baru dari pemda: karung pasir 2.000', en: 'New government order: 2,000 sandbags' })}</span>
              <span style={{ justifySelf: 'start', padding: '0.3em 0.8em', borderRadius: '99em', background: 'var(--dk-eco-acc)', color: 'var(--dk-bg)', fontWeight: 800 }}>{t({ id: 'Diterima ✓', en: 'Accepted ✓' })}</span>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
