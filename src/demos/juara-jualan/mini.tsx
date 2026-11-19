/**
 * juara-jualan — mini-demo for /produk/juara-jualan and the /lab preview (Tahap 6 plan §2.3, owner Q1).
 * A 4-frame loop from mini-kit + inline kit tokens: the call list with scores, the recording jumps to the
 * unanswered objection, a suggestion, coaching assigned to the agent. Fixture data only (fictional agents and
 * customers; scores are simulated). No store, no clock, no audio, no network.
 */
import type { CSSProperties } from 'react'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const SLUG = 'juara-jualan'
const P = PRODUCT_BY_SLUG[SLUG]

const FRAMES: readonly MiniStep[] = [
  { id: 'daftar', ms: 2400, caption: { id: 'Setiap panggilan penjualan dinilai', en: 'Every sales call gets a score' } },
  { id: 'momen', ms: 2800, caption: { id: 'Loncat ke detik keberatan yang tidak dijawab', en: 'Jump to the second the objection went unanswered' } },
  { id: 'saran', ms: 2600, caption: { id: 'Saran jawaban untuk momen itu', en: 'A suggested answer for that moment' } },
  { id: 'coaching', ms: 2600, caption: { id: 'Coaching ditugaskan ke agen', en: 'Coaching assigned to the agent' } },
]

/* ---- tiny style kit (inline: minis ship no CSS of their own) */
const T = 'opacity .45s ease, transform .45s ease'
const on = (v: boolean, y = 0.5): CSSProperties => ({ opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}em)`, transition: T })
const WRAP: CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }
const ROOT: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gridTemplateRows: 'minmax(0, 1fr)', gap: '0.8em', padding: '0.9em 0.9em 2.6em', fontSize: '2.3cqw', lineHeight: 1.3, color: 'var(--dk-text)', fontFamily: 'var(--dk-font)' }
const BOX: CSSProperties = { background: 'var(--dk-s1)', border: '1px solid var(--dk-line)', borderRadius: '0.6em', padding: '0.7em', minWidth: 0, minHeight: 0 }
const H: CSSProperties = { margin: '0 0 0.5em', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--dk-muted)' }

const CALLS = [
  { who: 'Rina · PT Arta Niaga', s: 54 },
  { who: 'Dimas · CV Lestari', s: 81 },
  { who: 'Sari · UD Mekar', s: 76 },
  { who: 'Bayu · Toko Jaya', s: 88 },
]
const WAVE = [3, 6, 4, 8, 5, 9, 7, 4, 6, 10, 8, 5, 3, 7, 9, 6, 4, 8, 5, 3, 6, 8, 4, 5]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const k = s.index
  const tone = (v: number) => (v < 60 ? 'var(--dk-danger)' : v < 80 ? 'var(--dk-warn)' : 'var(--dk-pos)')
  return (
    <MiniFrame slug={SLUG} kind={P.frame} eco={P.eco} frame={s.id} step={s.step}>
      <div style={WRAP}>
        <div style={ROOT}>
          <div style={BOX}>
            <p style={H}>{t({ id: 'Panggilan hari ini', en: "Today's calls" })}</p>
            {CALLS.map((c, i) => (
              <div
                key={c.who}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.4em',
                  padding: '0.4em 0.45em',
                  borderRadius: '0.4em',
                  background: i === 0 && k >= 1 ? 'var(--dk-acc-12)' : 'transparent',
                  transition: 'background .4s ease',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.who}</span>
                <b style={{ color: tone(c.s) }}>{c.s}</b>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: '0.6em', minHeight: 0 }}>
            <div style={{ ...BOX, ...on(k >= 1) }}>
              <p style={H}>{t({ id: 'Rekaman · Rina', en: 'Recording · Rina' })}</p>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.2em', height: '2.6em' }}>
                {WAVE.map((h, i) => (
                  <i key={i} style={{ flex: 1, height: `${h * 9}%`, borderRadius: '0.2em', background: i < 14 ? 'var(--dk-eco-acc)' : 'var(--dk-s3)', opacity: i < 14 ? 0.9 : 0.6 }} />
                ))}
                <span style={{ position: 'absolute', left: '57%', top: '-0.3em', bottom: '-0.3em', width: '2px', background: 'var(--dk-danger)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4em', fontSize: '0.9em' }}>
                <span style={{ color: 'var(--dk-danger)', fontWeight: 700 }}>02:14 · {t({ id: 'keberatan harga tidak dijawab', en: 'price objection not answered' })}</span>
              </div>
            </div>
            <div style={{ ...BOX, ...on(k >= 2), borderColor: 'var(--dk-eco-acc)' }}>
              <b>{t({ id: 'Saran', en: 'Suggestion' })}</b>
              <div style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Akui kekhawatirannya, lalu tunjukkan hemat biaya kirim untuk pesanan rutin.', en: 'Acknowledge the concern, then show the delivery savings on repeat orders.' })}</div>
            </div>
            <div style={{ ...BOX, ...on(k >= 3), display: 'flex', alignItems: 'center', gap: '0.6em' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: '2.2em', height: '2.2em', borderRadius: '50%', background: 'var(--dk-eco-acc)', color: 'var(--dk-bg)', fontWeight: 800 }}>R</span>
              <span>
                <b>{t({ id: 'Coaching ditugaskan', en: 'Coaching assigned' })}</b>
                <br />
                <span style={{ color: 'var(--dk-muted)' }}>{t({ id: 'Roleplay: menjawab keberatan harga', en: 'Roleplay: handling a price objection' })}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
