/**
 * pajak-beres — mini-demo for /produk/pajak-beres and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 5-frame loop from mini-kit + inline kit tokens: a crumpled receipt is straightened, its fields are read, the
 * journal entry lands in the ledger, bank lines are categorised, the monthly report is ready. Fixture data only
 * (fictional shop; amounts are demo-world simulations shown as plain numbers). No store, no clock, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'pajak-beres'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'nota', ms: 1800, caption: { id: 'Foto nota kusut diunggah', en: 'A photo of a crumpled receipt is uploaded' } },
  { id: 'lurus', ms: 2000, caption: { id: 'Nota diluruskan dan teksnya ditandai', en: 'The receipt is straightened and its text marked' } },
  { id: 'ekstrak', ms: 2400, caption: { id: 'Tanggal, toko, dan total terbaca otomatis', en: 'Date, shop and total read automatically' } },
  { id: 'jurnal', ms: 2600, caption: { id: 'Entri jurnal masuk ke buku besar', en: 'The journal entry lands in the ledger' } },
  { id: 'laporan', ms: 2600, caption: { id: 'Laporan bulanan dan berkas pajak siap', en: 'Monthly report and tax file ready' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .5s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }
const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5em', padding: '0.3em 0', borderBottom: '1px solid var(--dk-line)' }

const FIELDS = [
  { k: { id: 'Tanggal', en: 'Date' }, v: '12/11' },
  { k: { id: 'Toko', en: 'Shop' }, v: 'UD Sinar Kanor' },
  { k: { id: 'Total', en: 'Total' }, v: '1.240.000' },
]
const BARS = [52, 61, 48, 70, 66, 78]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, display: 'grid', placeItems: 'center', background: 'var(--dk-s2)' }}>
            <div
              style={{
                width: '78%',
                aspectRatio: '3 / 4',
                borderRadius: '0.3em',
                background: 'var(--dk-paper)',
                padding: '0.8em 0.7em',
                display: 'grid',
                alignContent: 'start',
                gap: '0.45em',
                transform: k >= 1 ? 'none' : 'rotate(-9deg) skewX(4deg) scale(.92)',
                transition: 'transform .7s cubic-bezier(.2,.7,.2,1)',
                boxShadow: '0 0.6em 1.4em rgba(0,0,0,.35)',
              }}
            >
              {[70, 92, 56, 84, 40, 66].map((w, i) => (
                <i
                  key={i}
                  style={{
                    display: 'block',
                    height: '0.45em',
                    width: `${w}%`,
                    borderRadius: '0.2em',
                    background: 'var(--dk-paper-muted)',
                    opacity: 0.55,
                    outline: k >= 1 && i % 2 === 0 ? '1.5px solid var(--dk-eco-acc)' : '1.5px solid transparent',
                    outlineOffset: '0.18em',
                    transition: 'outline-color .4s ease',
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 2) }}>
              <p style={H}>{t({ id: 'Terbaca dari nota', en: 'Read from the receipt' })}</p>
              {FIELDS.map((f) => (
                <div key={f.v} style={ROW}>
                  <span style={{ color: 'var(--dk-muted)' }}>{t(f.k)}</span>
                  <b>{f.v}</b>
                </div>
              ))}
            </div>
            <div style={{ ...BOX, position: 'relative' }}>
              <div style={{ ...on(k <= 3), position: 'absolute', inset: '0.7em' }}>
                <p style={H}>{t({ id: 'Buku jurnal', en: 'Journal' })}</p>
                <div style={ROW}>
                  <span>{t({ id: 'Persediaan (D)', en: 'Inventory (Dr)' })}</span>
                  <span style={{ color: 'var(--dk-muted)' }}>1.240.000</span>
                </div>
                <div style={{ ...ROW, ...on(k >= 3, -1.2), background: k === 3 ? 'var(--dk-acc-12)' : 'transparent' }}>
                  <span>{t({ id: 'Kas (K)', en: 'Cash (Cr)' })}</span>
                  <span style={{ color: 'var(--dk-muted)' }}>1.240.000</span>
                </div>
              </div>
              <div style={{ ...on(k >= 4), position: 'absolute', inset: '0.7em', display: 'flex', flexDirection: 'column' }}>
                <p style={H}>{t({ id: 'Laba-rugi 6 bulan (simulasi)', en: '6-month profit & loss (simulated)' })}</p>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.5em', minHeight: 0 }}>
                  {BARS.map((b, i) => (
                    <i key={i} style={{ flex: 1, height: `${b}%`, borderRadius: '0.25em 0.25em 0 0', background: i === BARS.length - 1 ? 'var(--dk-eco-acc)' : 'var(--dk-s3)' }} />
                  ))}
                </div>
                <b style={{ marginTop: '0.5em', color: 'var(--dk-pos)' }}>{t({ id: 'Berkas pajak siap diekspor ✓', en: 'Tax file ready to export ✓' })}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
