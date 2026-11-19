/**
 * toko-autopilot — mini-demo for /produk/toko-autopilot and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 5-frame loop built from mini-kit + inline kit tokens: a QRIS sale at the till, the flood alert pushing the
 * sandbag forecast up, a PO sent to the supplier and answered, a price suggestion applied. Fixture data only
 * (fictional shop and supplier; numbers are demo-world simulations). No store, no clock, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'toko-autopilot'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'kasir', ms: 2200, caption: { id: 'Kasir: tiga barang dipindai', en: 'Till: three items scanned' } },
  { id: 'bayar', ms: 2000, caption: { id: 'Dibayar dengan QRIS, stok langsung berkurang', en: 'Paid by QRIS, stock updates at once' } },
  { id: 'banjir', ms: 2800, caption: { id: 'Peringatan banjir: prediksi karung pasir melonjak', en: 'Flood warning: the sandbag forecast jumps' } },
  { id: 'po', ms: 2600, caption: { id: 'PO terkirim ke supplier, dan supplier membalas', en: 'PO sent to the supplier, and the supplier replies' } },
  { id: 'harga', ms: 2400, caption: { id: 'Saran harga diterapkan', en: 'Price suggestion applied' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }
const ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5em', padding: '0.3em 0', borderBottom: '1px solid var(--dk-line)' }
const PILL = (bg: string, fg = 'var(--dk-bg)'): CSSProperties => ({ display: 'inline-block', padding: '0.25em 0.7em', borderRadius: '99em', background: bg, color: fg, fontWeight: 700, fontSize: '0.85em' })

const ITEMS = [
  { id: 'Karung pasir', en: 'Sandbags', q: 'x4' },
  { id: 'Terpal 3×4', en: 'Tarp 3×4', q: 'x1' },
  { id: 'Senter LED', en: 'LED torch', q: 'x2' },
]
const BASE = [30, 32, 31, 33, 32, 34]
const JUMP = [30, 32, 31, 33, 70, 96]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${i * 20} ${100 - v}`).join(' ')
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, display: 'flex', flexDirection: 'column' }}>
            <p style={H}>{t({ id: 'Kasir · Toko Sumber Rejeki', en: 'Till · Toko Sumber Rejeki' })}</p>
            {ITEMS.map((it) => (
              <div key={it.id} style={ROW}>
                <span>{t(it)}</span>
                <span style={{ color: 'var(--dk-muted)' }}>{it.q}</span>
              </div>
            ))}
            <div style={{ ...on(k >= 1), marginTop: '0.7em', display: 'grid', gap: '0.3em', color: 'var(--dk-muted)', fontSize: '0.92em' }}>
              <span>{t({ id: 'Stok karung pasir: 46 → 42', en: 'Sandbag stock: 46 → 42' })}</span>
              <span style={on(k >= 2)}>{t({ id: 'Perlu dipesan: 200 karung', en: 'To reorder: 200 bags' })}</span>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '0.6em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={PILL(k >= 1 ? 'var(--dk-pos)' : 'var(--dk-eco-acc)')}>{k >= 1 ? t({ id: 'Lunas ✓', en: 'Paid ✓' }) : 'QRIS'}</span>
              <span style={{ ...on(k >= 4), ...PILL('var(--dk-s3)', 'var(--dk-text)') }}>{t({ id: 'Harga baru aktif', en: 'New price live' })}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gap: '0.6em', minWidth: 0, minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 2), borderColor: 'var(--dk-warn)', padding: '0.5em 0.7em' }}>
              <b style={{ color: 'var(--dk-warn)' }}>{t({ id: 'Peringatan banjir · Kec. Kanor', en: 'Flood warning · Kanor district' })}</b>
              <div style={{ color: 'var(--dk-muted)', fontSize: '0.9em' }}>{t({ id: 'Permintaan karung pasir diperkirakan naik 340% (simulasi)', en: 'Sandbag demand forecast up 340% (simulated)' })}</div>
            </div>
            <div style={{ ...BOX, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <p style={H}>{t({ id: 'Prediksi 6 hari · karung pasir', en: '6-day forecast · sandbags' })}</p>
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <path d={line(BASE)} fill="none" stroke="var(--dk-muted)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".5" />
                <path d={line(JUMP)} fill="none" stroke="var(--dk-eco-acc)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" style={{ opacity: k >= 2 ? 1 : 0, transition: 'opacity .6s ease' }} />
              </svg>
              </div>
            </div>
            <div style={{ ...BOX, ...on(k >= 3), padding: '0.5em 0.7em', display: 'grid', gap: '0.35em' }}>
              <span style={{ justifySelf: 'end', ...PILL('var(--dk-eco-acc)') }}>{t({ id: 'PO 200 karung pasir terkirim', en: 'PO for 200 sandbags sent' })}</span>
              <span style={{ justifySelf: 'start', ...PILL('var(--dk-s3)', 'var(--dk-text)'), ...on(k >= 3) }}>{t({ id: 'CV Tirta Makmur: siap, kirim besok pagi', en: 'CV Tirta Makmur: OK, delivering tomorrow morning' })}</span>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
