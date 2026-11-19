/**
 * inti — mini-demo (Tahap 6 plan §2.3, P0 wow): "Lihat jejak data" — complaint SW-0142 lights up across 6 products,
 * one hop per frame. Kit atoms only (no Inti store, no world): a constant fixture below.
 */
import { PRODUCT_BY_SLUG, type Bi, type ProductSlug } from '../../content/products'
import { Icon, isIconName } from '../../demo-kit/ui/icons'
import { MiniFrame, frameIndex, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'aduan', ms: 1800, caption: { id: 'Aduan SW-0142 masuk lewat Sapa Warga', en: 'Complaint SW-0142 arrives through Sapa Warga' } },
  { id: 'siaga', ms: 1700, caption: { id: 'Siaga Wilayah mengonfirmasi zona banjir', en: 'Siaga Wilayah confirms the flood zone' } },
  { id: 'meja', ms: 1700, caption: { id: 'Masuk ke briefing Meja Pimpinan', en: 'It enters the Meja Pimpinan briefing' } },
  { id: 'naskah', ms: 1700, caption: { id: 'Naskah Pintar membuat disposisi', en: 'Naskah Pintar issues a disposition' } },
  { id: 'belanja', ms: 1700, caption: { id: 'Awas Belanja memeriksa paket darurat', en: 'Awas Belanja checks the emergency package' } },
  { id: 'jejak', ms: 3000, caption: { id: 'Jejak lengkap melintasi 6 produk', en: 'The full trail across 6 products' } },
]

/** the trail (spec §11 P0), node position in % of the stage, and the event at each hop */
const TRAIL: readonly { slug: ProductSlug; x: number; y: number; ev: Bi; at: string }[] = [
  { slug: 'sapa-warga', x: 13, y: 36, ev: { id: 'aduan banjir', en: 'flood report' }, at: '08.15' },
  { slug: 'siaga-wilayah', x: 38, y: 24, ev: { id: 'zona terkonfirmasi', en: 'zone confirmed' }, at: '08.16' },
  { slug: 'meja-pimpinan', x: 63, y: 36, ev: { id: 'butir briefing', en: 'briefing item' }, at: '08.20' },
  { slug: 'naskah-pintar', x: 87, y: 54, ev: { id: 'disposisi', en: 'disposition' }, at: '09.05' },
  { slug: 'awas-belanja', x: 60, y: 76, ev: { id: 'paket pompa', en: 'pump package' }, at: '11.00' },
  { slug: 'katalog-lokal', x: 32, y: 76, ev: { id: 'pesanan UMKM', en: 'SME order' }, at: '11.40' },
]

const T = {
  entity: { id: 'Entitas', en: 'Entity' },
  title: { id: 'Jejak data · SW-0142', en: 'Data trail · SW-0142' },
  done: { id: '6 produk · 6 kejadian · tercatat di Audit', en: '6 products · 6 events · in the Audit log' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const last = frameIndex(FRAMES, 'jejak')
  // frame i lights hops 0..i; the last frame lights all six
  const lit = (i: number): boolean => (s.index >= last ? true : i <= s.index)
  return (
    <MiniFrame slug="inti" kind={PRODUCT_BY_SLUG.inti.frame} eco="inti" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateRows: 'auto 1fr' }}>
        <div className="mk-row">
          <span className="mk-pill">{t(T.entity)}</span>
          <strong className="mk-t" style={{ flex: 1 }}>
            {t(T.title)}
          </strong>
          <span className={'mk-pill is-ok mk-fade' + (s.index >= last ? ' is-on' : '')}>{t(T.done)}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <svg className="mk-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            {TRAIL.slice(1).map((n, i) => {
              const a = TRAIL[i]!
              return (
                <path
                  key={n.slug}
                  d={`M${a.x} ${a.y}L${n.x} ${n.y}`}
                  pathLength={1}
                  className={'mk-draw' + (lit(i + 1) ? ' is-on' : '')}
                  style={{ fill: 'none', stroke: 'var(--dk-accent)', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' }}
                />
              )
            })}
          </svg>
          {TRAIL.map((n, i) => {
            const prod = PRODUCT_BY_SLUG[n.slug]
            const on = lit(i)
            return (
              <div
                key={n.slug}
                data-eco={prod.eco}
                style={{
                  position: 'absolute',
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  transform: `translate(-50%, -50%) scale(${on ? 1 : 0.86})`,
                  opacity: on ? 1 : 0.35,
                  transition: 'opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)',
                  display: 'grid',
                  justifyItems: 'center',
                  gap: '0.5cqw',
                  width: '23%',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '7cqw',
                    height: '7cqw',
                    borderRadius: '50%',
                    color: 'var(--dk-accent)',
                    background: 'var(--dk-s1)',
                    border: '1.5px solid var(--dk-accent)',
                    boxShadow: on ? '0 0 2.4cqw color-mix(in srgb, var(--dk-accent) 55%, transparent)' : 'none',
                  }}
                >
                  {isIconName(prod.icon) ? <Icon name={prod.icon} size={18} /> : null}
                </span>
                <strong className="mk-t" style={{ maxWidth: '100%' }}>
                  {prod.name}
                </strong>
                <span className="mk-muted mk-t" style={{ fontSize: '0.85em', maxWidth: '100%' }}>
                  {n.at} · {t(n.ev)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </MiniFrame>
  )
}
