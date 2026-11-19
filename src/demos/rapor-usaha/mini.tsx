/**
 * rapor-usaha — mini-demo for /produk/rapor-usaha and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: the health score built from three products' data, the factor
 * breakdown, the score rising after three journals are tidied, the working-capital request approved by the partner
 * cooperative. Fixture data only (fictional shop and cooperative; scores simulated). No store, no clock, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'rapor-usaha'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'skor', ms: 2200, caption: { id: 'Skor kesehatan usaha dari data nyata toko', en: "A business health score from the shop's real data" } },
  { id: 'faktor', ms: 2600, caption: { id: 'Faktor skor dari Toko Autopilot, Pajak Beres, dan Kenal Mitra', en: 'Score factors from Toko Autopilot, Pajak Beres and Kenal Mitra' } },
  { id: 'naik', ms: 2600, caption: { id: 'Tiga jurnal dirapikan, skor langsung naik', en: 'Three journals tidied, the score rises at once' } },
  { id: 'modal', ms: 2800, caption: { id: 'Pengajuan modal disetujui tanpa tumpukan berkas', en: 'Working capital approved without a stack of paperwork' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

const FACTORS = [
  { n: 'Toko Autopilot', l: { id: 'Arus kas', en: 'Cash flow' }, v: 72, up: 72 },
  { n: 'Pajak Beres', l: { id: 'Kerapian buku', en: 'Bookkeeping' }, v: 48, up: 80 },
  { n: 'Kenal Mitra', l: { id: 'Identitas', en: 'Identity' }, v: 90, up: 90 },
]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const score = k >= 2 ? 78 : 64
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, display: 'grid', placeItems: 'center', alignContent: 'center', gap: '0.4em' }}>
            <p style={{ ...H, margin: 0 }}>{t({ id: 'Rapor · Warung Bu Tini', en: 'Report · Warung Bu Tini' })}</p>
            <svg viewBox="0 0 40 40" style={{ width: '70%' }}>
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--dk-s3)" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--dk-eco-acc)"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset={100 - score}
                transform="rotate(-90 20 20)"
                style={{ transition: 'stroke-dashoffset .9s ease' }}
              />
              <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--dk-text)">
                {score}
              </text>
            </svg>
            <span style={{ color: k >= 2 ? 'var(--dk-pos)' : 'var(--dk-muted)', fontWeight: 700 }}>{k >= 2 ? '+14' : t({ id: 'skor simulasi', en: 'simulated score' })}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: '0.7em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 1) }}>
              <p style={H}>{t({ id: 'Faktor skor', en: 'Score factors' })}</p>
              {FACTORS.map((f) => {
                const v = k >= 2 ? f.up : f.v
                return (
                  <div key={f.n} style={{ padding: '0.25em 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92em' }}>
                      <span>
                        {t(f.l)} <span style={{ color: 'var(--dk-muted)' }}>· {f.n}</span>
                      </span>
                      <b>{v}</b>
                    </div>
                    <div style={{ height: '0.4em', marginTop: '0.25em', borderRadius: '99em', background: 'var(--dk-s3)', overflow: 'hidden' }}>
                      <i style={{ display: 'block', height: '100%', width: '100%', borderRadius: '99em', background: 'var(--dk-eco-acc)', transform: `scaleX(${v / 100})`, transformOrigin: 'left', transition: 'transform .8s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ ...BOX, ...on(k >= 3), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5em', borderColor: 'var(--dk-pos)' }}>
              <span>
                <b>{t({ id: 'Modal kerja', en: 'Working capital' })}</b>
                <span style={{ color: 'var(--dk-muted)' }}> · Koperasi Mitra Sejahtera</span>
              </span>
              <b style={{ color: 'var(--dk-pos)' }}>{t({ id: 'Disetujui ✓', en: 'Approved ✓' })}</b>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
