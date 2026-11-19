/**
 * pantau-merek — mini-demo for /produk/pantau-merek and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: complaint volume spikes after the flood, an alert fires, the
 * complaints are clustered, five reviews get personal draft replies. Fixture data only (fictional brand and
 * customers; volumes simulated). No store, no clock, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'pantau-merek'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'lonjakan', ms: 2400, caption: { id: 'Keluhan melonjak setelah banjir', en: 'Complaints spike after the flood' } },
  { id: 'peringatan', ms: 2200, caption: { id: 'Peringatan: "pengiriman lambat" naik tajam', en: 'Alert: "slow delivery" rising fast' } },
  { id: 'kelompok', ms: 2600, caption: { id: 'Keluhan dikelompokkan, akar masalah terlihat', en: 'Complaints clustered, root cause visible' } },
  { id: 'balas', ms: 2800, caption: { id: 'Lima ulasan dibalas dengan draf yang personal', en: 'Five reviews answered with personal drafts' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }
const CHIP: CSSProperties = { display: 'inline-block', padding: '0.25em 0.7em', borderRadius: '99em', background: 'var(--dk-s3)', fontSize: '0.9em' }

const VOL = [12, 14, 11, 15, 13, 16, 42, 78, 64]
const REVIEWS = ['Nita', 'Arif', 'Wulan', 'Hendra', 'Maya']

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, display: 'flex', flexDirection: 'column' }}>
              <p style={H}>{t({ id: 'Volume keluhan · Kopi Senja (simulasi)', en: 'Complaint volume · Kopi Senja (simulated)' })}</p>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.35em', minHeight: 0 }}>
                {VOL.map((v, i) => (
                  <i key={i} style={{ flex: 1, height: `${v}%`, borderRadius: '0.25em 0.25em 0 0', background: i >= 6 ? 'var(--dk-danger)' : 'var(--dk-s3)' }} />
                ))}
              </div>
            </div>
            <div style={{ ...BOX, ...on(k >= 1), borderColor: 'var(--dk-warn)', padding: '0.5em 0.7em' }}>
              <b style={{ color: 'var(--dk-warn)' }}>{t({ id: '"Pengiriman lambat" +380% dalam 24 jam', en: '"Slow delivery" +380% in 24 hours' })}</b>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 2) }}>
              <p style={H}>{t({ id: 'Kelompok keluhan', en: 'Complaint clusters' })}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em' }}>
                <span style={{ ...CHIP, background: 'var(--dk-eco-acc)', color: 'var(--dk-bg)', fontWeight: 700 }}>{t({ id: 'Pengiriman lambat · 64', en: 'Slow delivery · 64' })}</span>
                <span style={CHIP}>{t({ id: 'Paket basah · 12', en: 'Wet parcel · 12' })}</span>
                <span style={CHIP}>{t({ id: 'Lainnya · 5', en: 'Other · 5' })}</span>
              </div>
              <div style={{ marginTop: '0.4em', color: 'var(--dk-muted)', fontSize: '0.9em' }}>{t({ id: 'Terkait: jalan Kanor tergenang', en: 'Linked: Kanor road flooded' })}</div>
            </div>
            <div style={{ ...BOX, ...on(k >= 3) }}>
              <p style={H}>{t({ id: 'Balas 5 ulasan', en: 'Reply to 5 reviews' })}</p>
              {REVIEWS.map((n, i) => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.18em 0', ...on(k >= 3) , transitionDelay: `${i * 0.12}s` }}>
                  <span>{t({ id: `Halo Kak ${n}, maaf…`, en: `Hi ${n}, sorry…` })}</span>
                  <b style={{ color: 'var(--dk-pos)' }}>✓</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
