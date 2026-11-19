/**
 * siaga-wilayah — mini-demo (Tahap 6 plan §2.3, P5 wow): a rain cell crosses a stylised district map (SVG, no tiles),
 * flooding grows, an alert ring goes up and the recipient count rolls in. Constant fixture; transform/opacity only.
 */
import { PRODUCT_BY_SLUG, type Bi } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'awan', ms: 1800, caption: { id: 'Awan hujan mendekat', en: 'Rain clouds approach' } },
  { id: 'hujan', ms: 2200, caption: { id: 'Sel hujan di atas kecamatan', en: 'Rain cells over the districts' } },
  { id: 'genangan', ms: 2600, caption: { id: 'Prediksi genangan +6 jam', en: 'Flooding forecast +6 h' } },
  { id: 'peringatan', ms: 2400, caption: { id: 'Peringatan dini disiapkan', en: 'Early warning prepared' } },
  { id: 'terkirim', ms: 3000, caption: { id: 'Terkirim ke penerima di zona', en: 'Delivered to recipients in the zone' } },
]

/** stylised kecamatan centres (not a real projection), the four on alert first */
const KEC: readonly { n: string; x: number; y: number; alert?: boolean }[] = [
  { n: 'Kanor', x: 76, y: 30, alert: true },
  { n: 'Baureno', x: 86, y: 44, alert: true },
  { n: 'Kalitidu', x: 34, y: 34, alert: true },
  { n: 'Dander', x: 50, y: 52, alert: true },
  { n: 'Padangan', x: 12, y: 30 },
  { n: 'Ngasem', x: 24, y: 52 },
  { n: 'Bojonegoro', x: 56, y: 30 },
  { n: 'Sumberrejo', x: 70, y: 52 },
]

const T = {
  layer: { id: 'Peta risiko · +6 jam', en: 'Risk map · +6 h' },
  level: { id: 'Siaga 3 · 4 kecamatan', en: 'Level 3 · 4 districts' },
  send: { id: 'Kirim peringatan dini', en: 'Send early warning' },
  sent: { id: 'terkirim ke camat, kades & warga', en: 'sent to district heads, village heads & residents' },
  read: { id: 'dibaca', en: 'read' },
} satisfies Record<string, Bi>

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const i = s.index
  // rain cell drifts in from the west, one step per frame
  const cellX = [-30, 10, 30, 34, 34][i] ?? 34
  const flood = i >= frameIndex(FRAMES, 'genangan')
  const sent = i >= frameIndex(FRAMES, 'terkirim')
  return (
    <MiniFrame slug="siaga-wilayah" kind={PRODUCT_BY_SLUG['siaga-wilayah'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateColumns: '1fr 32%', padding: 0, gap: 0 }}>
        <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--dk-s1)' }}>
          <svg className="mk-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet">
            <rect width="100" height="70" fill="var(--dk-s1)" />
            <path d="M4 22 C16 10 36 12 52 14 S84 10 96 24 S98 56 84 62 S40 66 22 62 S0 40 4 22Z" fill="var(--dk-s2)" stroke="var(--dk-line-2)" strokeWidth="0.5" />
            <path d="M2 18 C20 22 30 26 44 22 S70 16 98 22" fill="none" stroke="var(--c-cyan)" strokeOpacity="0.7" strokeWidth="1.4" />
            {KEC.map((k) => (
              <g key={k.n}>
                {k.alert ? (
                  <circle cx={k.x} cy={k.y} r="7" fill="var(--c-cyan)" fillOpacity="0.28" className={'mk-pop' + on('genangan')} style={{ transformOrigin: `${k.x}px ${k.y}px`, transformBox: 'view-box' }} />
                ) : null}
                {k.alert ? (
                  <circle cx={k.x} cy={k.y} r="5" fill="none" stroke="var(--dk-danger)" strokeWidth="0.8" className={'mk-pop' + on('peringatan')} style={{ transformOrigin: `${k.x}px ${k.y}px`, transformBox: 'view-box' }} />
                ) : null}
                <circle cx={k.x} cy={k.y} r="1.3" fill={k.alert && flood ? 'var(--dk-danger)' : 'var(--dk-muted)'} />
                <text x={k.x} y={k.y + 4.4} fontSize="2.6" textAnchor="middle" fill="var(--dk-muted)">
                  {k.n}
                </text>
              </g>
            ))}
            <g style={{ transform: `translateX(${cellX}px)`, transition: 'transform 1.6s cubic-bezier(.45,0,.2,1)' }}>
              <ellipse cx="30" cy="30" rx="18" ry="12" fill="var(--c-lavender)" fillOpacity="0.16" />
              <ellipse cx="32" cy="31" rx="10" ry="7" fill="var(--c-lavender)" fillOpacity="0.22" />
              <ellipse cx="33" cy="31" rx="4.5" ry="3.2" fill="var(--c-lavender)" fillOpacity="0.32" />
            </g>
          </svg>
          <span className="mk-pill" style={{ position: 'absolute', left: '2cqw', top: '2cqw' }}>
            {t(T.layer)}
          </span>
        </div>
        <div className="mk-panel" style={{ borderRadius: 0, borderWidth: '0 0 0 1px', display: 'grid', alignContent: 'start', gap: '1.4cqw', paddingBottom: '6cqw' }}>
          <span className={'mk-pill is-danger mk-in' + on('genangan')}>{t(T.level)}</span>
          <ul className="mk-list">
            {KEC.filter((k) => k.alert).map((k, n) => (
              <li key={k.n} className={'mk-item mk-in' + on('genangan')} style={{ transitionDelay: s.id === 'genangan' && !s.calm ? `${n * 0.2}s` : '0s' }}>
                <span className="mk-dot" style={{ background: 'var(--dk-danger)' }} />
                <span className="mk-t">{k.n}</span>
              </li>
            ))}
          </ul>
          <span
            className={'mk-in' + on('peringatan')}
            style={{ display: 'block', textAlign: 'center', padding: '0.6em', borderRadius: '0.6em', fontWeight: 700, color: 'var(--dk-on-accent)', background: 'var(--dk-accent)' }}
          >
            {t(T.send)}
          </span>
          <div className={'mk-in' + on('terkirim')}>
            <div className="mk-big" style={{ color: 'var(--dk-accent)' }}>
              {sent ? t({ id: '1.248', en: '1,248' }) : '0'}
            </div>
            <div className="mk-muted">{t(T.sent)}</div>
            <div className="mk-meter" style={{ marginTop: '0.6em' }}>
              <i style={{ ['--v' as string]: sent ? 0.78 : 0 }} />
            </div>
            <div className="mk-muted" style={{ fontSize: '0.85em', marginTop: '0.3em' }}>
              78% {t(T.read)}
            </div>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
