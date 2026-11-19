/**
 * sapa-warga — mini-demo (Tahap 6 plan §2.3, P1 wow): a Javanese voice note on the citizen's phone becomes a ticket in
 * the officer console, then similar reports cluster on a stylised district map. Kit atoms + a constant fixture only.
 */
import { PRODUCT_BY_SLUG } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'suara', ms: 2200, caption: { id: 'Ibu Siti merekam pesan suara', en: 'Ibu Siti records a voice note' } },
  { id: 'transkrip', ms: 2600, caption: { id: 'Transkrip Basa Jawa diterjemahkan', en: 'The Javanese transcript is translated' } },
  { id: 'tiket', ms: 2400, caption: { id: 'Tiket SW masuk ke Konsol Petugas', en: 'An SW ticket lands in the Officer Console' } },
  { id: 'klaster', ms: 3200, caption: { id: 'Aduan serupa menjadi klaster', en: 'Similar complaints form a cluster' } },
]

const T = {
  chat: { id: 'Layanan Bojonegoro (resmi)', en: 'Bojonegoro Services (official)' },
  via: { id: 'via WhatsApp', en: 'via WhatsApp' },
  jv: { id: '"Banyu wis mlebu omah, dalane ora iso diliwati."', en: '"Banyu wis mlebu omah, dalane ora iso diliwati."' },
  tr: { id: 'Air sudah masuk rumah, jalan tidak bisa dilewati.', en: 'Water is in the house, the road cannot be passed.' },
  lang: { id: 'Basa Jawa → Indonesia', en: 'Javanese → English' },
  reply: { id: 'Tiket SW-2026-0142 dibuat. Petugas segera datang.', en: 'Ticket SW-2026-0142 created. An officer is on the way.' },
  console: { id: 'Konsol Petugas', en: 'Officer Console' },
  newT: { id: 'Baru', en: 'New' },
  cat: { id: 'Banjir/Genangan · Kel. Kanor', en: 'Flooding · Kanor' },
  urgent: { id: 'Mendesak', en: 'Urgent' },
  sla: { id: 'SLA 4 jam', en: 'SLA 4 h' },
  cluster: { id: 'Klaster banjir · 12 aduan → Meja Pimpinan', en: 'Flood cluster · 12 reports → Meja Pimpinan' },
}

/** stylised district dots (no tiles): x, y in a 100×60 box; the cluster sits around (64, 34) */
const DOTS: readonly [number, number][] = [
  [14, 18], [30, 12], [46, 20], [80, 14], [22, 40], [40, 46], [86, 44], [56, 52], [72, 50],
]
const CLUSTER: readonly [number, number][] = [
  [62, 30], [66, 33], [60, 36], [68, 29], [64, 38], [70, 36],
]

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const recording = s.index === frameIndex(FRAMES, 'suara')
  return (
    <MiniFrame slug="sapa-warga" kind={PRODUCT_BY_SLUG['sapa-warga'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateColumns: '38% 1fr' }}>
        {/* citizen phone */}
        <div className="mk-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', borderRadius: '3cqw', padding: '1.4cqw' }}>
          <div className="mk-row" style={{ paddingBottom: '1cqw', borderBottom: '1px solid var(--dk-line)' }}>
            <strong className="mk-t">{t(T.chat)}</strong>
            <span className="mk-muted" style={{ fontSize: '0.8em' }}>
              {t(T.via)}
            </span>
          </div>
          <div style={{ display: 'grid', alignContent: 'end', gap: '0.8cqw', paddingTop: '1cqw', fontSize: '0.86em', minHeight: 0, overflow: 'hidden' }}>
            <div className="mk-bubble is-me" style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
              <span aria-hidden="true">▶</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '1.4em' }}>
                {[5, 9, 4, 11, 7, 12, 6, 9, 4, 8, 5].map((h, i) => (
                  <i
                    key={i}
                    style={{
                      width: '2px',
                      height: `${h * 8}%`,
                      background: 'currentColor',
                      borderRadius: '1px',
                      transform: recording ? `scaleY(${0.5 + ((i * 7 + s.step) % 5) / 8})` : 'none',
                      transition: 'transform .3s ease',
                    }}
                  />
                ))}
              </span>
              <span>0:07</span>
            </div>
            <div className={'mk-bubble mk-in' + on('transkrip')}>
              <span className="mk-pill" style={{ marginBottom: '0.4em' }}>
                {t(T.lang)}
              </span>
              <div style={{ fontStyle: 'italic' }}>{t(T.jv)}</div>
              <div className="mk-muted">{t(T.tr)}</div>
            </div>
            <div className={'mk-bubble mk-in' + on('tiket')}>{t(T.reply)}</div>
          </div>
        </div>
        {/* officer console */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '1.6cqw', minHeight: 0 }}>
          <div className="mk-panel">
            <p className="mk-h">
              <span>{t(T.console)}</span>
              <span className="mk-pill">{t(T.newT)}</span>
            </p>
            <div className={'mk-item mk-in' + on('tiket')} style={{ display: 'grid', gap: '0.4em', border: '1px solid var(--dk-line-act)' }}>
              <div className="mk-row">
                <strong>SW-2026-0142</strong>
                <span className="mk-pill is-danger">{t(T.urgent)}</span>
              </div>
              <div className="mk-row">
                <span className="mk-t mk-muted">{t(T.cat)}</span>
                <span className="mk-pill is-warn">{t(T.sla)}</span>
              </div>
            </div>
          </div>
          <div className="mk-panel" style={{ padding: 0 }}>
            <svg className="mk-svg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
              <path d="M4 30 C14 8 40 2 60 6 S96 14 96 34 S78 58 52 56 S2 52 4 30Z" fill="var(--dk-s2)" stroke="var(--dk-line-2)" strokeWidth="0.6" />
              <path d="M6 44 C26 36 40 40 54 30 S80 22 96 26" fill="none" stroke="var(--c-cyan)" strokeOpacity="0.5" strokeWidth="1.2" />
              {DOTS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="1.4" fill="var(--dk-muted)" opacity="0.6" />
              ))}
              <circle cx="64" cy="33" r="10" fill="var(--dk-danger)" fillOpacity="0.14" stroke="var(--dk-danger)" strokeWidth="0.6" className={'mk-pop' + on('klaster')} style={{ transformOrigin: '64px 33px', transformBox: 'view-box' }} />
              {CLUSTER.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="1.6"
                  fill="var(--dk-danger)"
                  className={'mk-fade' + (i === 0 ? on('tiket') : on('klaster'))}
                />
              ))}
            </svg>
            <span
              className={'mk-pill is-danger mk-in' + on('klaster')}
              style={{ position: 'absolute', left: '1.4cqw', top: '1.4cqw', maxWidth: 'calc(100% - 2.8cqw)', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {t(T.cluster)}
            </span>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
