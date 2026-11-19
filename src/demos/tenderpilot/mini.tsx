/**
 * tenderpilot — mini-demo for /produk/tenderpilot and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: a matching emergency tender arrives, the win chance is scored,
 * the requirement checklist fills in (one item from Pajak Beres), the bid document assembles. Fixture data only
 * (fictional vendor and tender; the score is simulated). No store, no clock, no AI call, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'tenderpilot'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'notif', ms: 2200, caption: { id: 'Tender baru yang cocok ditemukan', en: 'A matching new tender is found' } },
  { id: 'skor', ms: 2400, caption: { id: 'Peluang menang dinilai', en: 'The chance of winning is scored' } },
  { id: 'syarat', ms: 2800, caption: { id: 'Syarat dicentang, satu berkas diambil dari Pajak Beres', en: 'Requirements ticked, one file pulled from Pajak Beres' } },
  { id: 'dokumen', ms: 2800, caption: { id: 'Dokumen penawaran tersusun dalam beberapa detik', en: 'The bid document assembles in seconds' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.7em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

const REQS = [
  { id: 'NIB & KBLI sesuai', en: 'Business ID & KBLI match' },
  { id: 'Pengalaman sejenis', en: 'Similar experience' },
  { id: 'Surat penawaran', en: 'Offer letter' },
  { id: 'Bukti lapor pajak', en: 'Tax filing proof', from: 'Pajak Beres' },
]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const score = k >= 1 ? 78 : 0
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={{ ...BOX, gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.7em', borderColor: 'var(--dk-eco-acc)' }}>
            <span style={{ padding: '0.25em 0.6em', borderRadius: '99em', background: 'var(--dk-eco-acc)', color: 'var(--dk-bg)', fontWeight: 800, fontSize: '0.85em' }}>{t({ id: 'Baru · cocok', en: 'New · match' })}</span>
            <b style={{ flex: 1, minWidth: 0 }}>{t({ id: 'Pengadaan karung pasir & terpal (darurat)', en: 'Procurement: sandbags & tarps (emergency)' })}</b>
          </div>
          <div style={{ ...BOX, ...on(k >= 1), display: 'grid', placeItems: 'center', alignContent: 'center', gap: '0.4em' }}>
            <svg viewBox="0 0 40 40" style={{ width: '42%' }}>
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
                style={{ transition: 'stroke-dashoffset .8s ease' }}
              />
              <text x="20" y="23.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--dk-text)">
                {score}%
              </text>
            </svg>
            <span style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Peluang menang (simulasi)', en: 'Chance to win (simulated)' })}</span>
          </div>
          <div style={{ ...BOX, position: 'relative' }}>
            <div style={{ ...on(k <= 2), position: 'absolute', inset: '0.7em' }}>
              <p style={H}>{t({ id: 'Syarat', en: 'Requirements' })}</p>
              {REQS.map((r, i) => {
                const done = k >= 2 || i < 2
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45em', padding: '0.2em 0' }}>
                    <b style={{ color: done ? 'var(--dk-pos)' : 'var(--dk-faint)' }}>{done ? '✓' : '○'}</b>
                    <span style={{ flex: 1 }}>{t(r)}</span>
                    {r.from && k >= 2 ? <span style={{ fontSize: '0.8em', color: 'var(--dk-eco-acc)' }}>← {r.from}</span> : null}
                  </div>
                )
              })}
            </div>
            <div style={{ ...on(k >= 3), position: 'absolute', inset: '0.7em', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '0.5em' }}>
              <span style={{ position: 'relative', width: '3.2em', height: '4em' }}>
                {[0, 1, 2].map((i) => (
                  <i key={i} style={{ position: 'absolute', inset: 0, borderRadius: '0.3em', background: 'var(--dk-paper)', transform: `translate(${i * 0.35}em, ${-i * 0.35}em)`, boxShadow: '0 0.2em 0.6em rgba(0,0,0,.3)' }} />
                ))}
              </span>
              <b>{t({ id: 'Penawaran tersusun · 42 halaman', en: 'Bid assembled · 42 pages' })}</b>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
