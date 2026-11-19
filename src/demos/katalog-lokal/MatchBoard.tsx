/**
 * MatchBoard + SupplierCard (pure props; reused by the Tahap 6 mini demo). The need node sits on a left rail; one
 * SVG line per verified card is drawn (stroke-dashoffset, staggered 150 ms, ≤ 1.2 s for six) when its `match.made`
 * row exists. Cards without a match row keep a faint dashed line ("some light up"). Below: the collapsed list of
 * unverified suppliers waiting for Kenal Mitra, with their KYB request code.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { BizBadges, motionMode } from '../../demo-kit/ui'
import type { Card } from '../../demo-kit/world/pasar-daerah'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { nf, rp, type Lang } from './model'
import type { T } from './strings'

export interface MatchBoardProps {
  cards: Card[]
  /** business ids that have a match.made row on this need */
  matched: ReadonlySet<string>
  waiting: Card[]
  picks: readonly string[]
  onPick: (bizId: string) => void
  kecName: (id: string) => string
  t: T
  lang: Lang
}

export function MatchBoard({ cards, matched, waiting, picks, onPick, kecName, t, lang }: MatchBoardProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<{ ys: number[]; h: number }>({ ys: [], h: 0 })
  const [drawn, setDrawn] = useState<Record<string, number>>({})
  const key = cards.map((c) => c.business.id).join(',')

  // card centre lines (offsetTop: immune to the flip transform)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => {
      const ys = Array.from(el.querySelectorAll<HTMLElement>('[data-kl-card]')).map((c) => c.offsetTop + Math.min(c.offsetHeight / 2, 34))
      setGeo((g) => (g.h === el.offsetHeight && g.ys.join() === ys.join() ? g : { ys, h: el.offsetHeight }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [key])

  // newly matched cards light one by one (one frame later, so the transition runs)
  useLayoutEffect(() => {
    const fresh = cards.filter((c) => matched.has(c.business.id) && drawn[c.business.id] === undefined).map((c) => c.business.id)
    if (!fresh.length) return
    const raf = requestAnimationFrame(() => setDrawn((d) => ({ ...d, ...Object.fromEntries(fresh.map((id, i) => [id, i])) })))
    return () => cancelAnimationFrame(raf)
  }, [cards, matched, drawn])

  const y0 = geo.ys[0] ?? 28
  const nLit = cards.filter((c) => matched.has(c.business.id)).length
  return (
    <div className="dk-kl-board" data-kl="match-board" data-lit={nLit} data-motion={motionMode()}>
      <p className="dk-kl-muted">{t.lit(nLit, cards.length)}</p>
      {cards.length === 0 ? (
        <p className="dk-kl-empty">{t.noTop}</p>
      ) : (
        <div className="dk-kl-rail-wrap" ref={listRef}>
          <svg className="dk-kl-rail" width="48" height={geo.h} viewBox={`0 0 48 ${geo.h || 1}`} aria-hidden="true">
            {geo.ys.map((y, i) => {
              const id = cards[i]?.business.id
              if (!id) return null
              const on = drawn[id] !== undefined
              return (
                <path
                  key={id}
                  d={`M8 ${y0} C 30 ${y0}, 18 ${y}, 48 ${y}`}
                  pathLength={1}
                  className={matched.has(id) ? `dk-kl-line${on ? ' is-lit' : ''}` : 'dk-kl-line is-dim'}
                  style={{ transitionDelay: `${(drawn[id] ?? 0) * 150}ms` }}
                />
              )
            })}
            <circle cx="8" cy={y0} r="6" className="dk-kl-node" />
          </svg>
          <div className="dk-kl-cards">
            {cards.map((c) => (
              <SupplierCard key={c.business.id} card={c} lit={matched.has(c.business.id)} picked={picks.includes(c.business.id)} canPick={picks.length < 3} onPick={onPick} kecName={kecName} t={t} lang={lang} />
            ))}
          </div>
        </div>
      )}
      {waiting.length > 0 && (
        <details className="dk-kl-wait" data-kl="waiting">
          <summary>{t.waiting(waiting.length)}</summary>
          <ul>
            {waiting.map((c) => (
              <li key={c.business.id} data-kl-wait={c.business.id}>
                <span className="dk-kl-wait-name">
                  <b>{c.business.name}</b>
                  <span className="dk-kl-muted">
                    {kecName(c.business.kecamatanId)} · {nf(lang, c.km, 1)} {t.km} · {Math.round(c.score * 100)}% {t.match}
                  </span>
                </span>
                <BizBadges badges={c.badges} bizId={c.business.id} />
                {c.requestId ? (
                  DEMO_READY['kenal-mitra'] ? (
                    <AppLink className="dk-kl-link" to={`/demo/kenal-mitra?focus=${c.requestId}`} data-kl="kyb-link">
                      {t.kybCode(c.requestId)} ↗
                    </AppLink>
                  ) : (
                    <span className="dk-kl-chip">{t.kybCode(c.requestId)}</span>
                  )
                ) : (
                  <span className="dk-kl-muted">KYB {t.noReq}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export interface SupplierCardProps {
  card: Card
  lit: boolean
  picked: boolean
  canPick: boolean
  onPick: (bizId: string) => void
  kecName: (id: string) => string
  t: T
  lang: Lang
}

export function SupplierCard({ card: c, lit, picked, canPick, onPick, kecName, t, lang }: SupplierCardProps) {
  const id = c.business.id
  const src = c.offer.source === 'bid' ? t.offerBid : c.offer.source === 'saran' ? t.offerSaran : t.offerKatalog
  const blocked = !picked && !canPick
  return (
    <article className={`dk-kl-sc${lit ? ' is-lit' : ''}${picked ? ' is-picked' : ''}`} data-kl-card={id} data-score={c.score} aria-label={c.business.name}>
      <header>
        <b className="dk-kl-sc-name">{c.business.name}</b>
        <span className="dk-kl-pct dk-num" title={t.boardNote}>
          {Math.round(c.score * 100)}% <small>{t.match}</small>
        </span>
      </header>
      <p className="dk-kl-muted">
        {kecName(c.business.kecamatanId)} · <span className="dk-num" data-kl="km">{nf(lang, c.km, 1)}</span> {t.km}
      </p>
      <BizBadges badges={c.badges} bizId={id} links />
      <ul className="dk-kl-lines">
        {c.offer.lines.map((l) => (
          <li key={l.category}>
            <span>{l.name[lang]}</span>
            <span className="dk-num" data-kl="unit-price">{rp(l.unitPrice)}</span>
            <span className={`dk-num${l.qtyAvailable < l.qty ? ' is-short' : ''}`} data-kl="avail">
              {nf(lang, l.qtyAvailable)} {t.avail}
              {l.qtyAvailable < l.qty ? ` · ${t.short(l.qty - l.qtyAvailable)}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <footer>
        <span>
          {t.total} <b className="dk-num" data-kl="total">{rp(c.offer.total)}</b> <span className="dk-kl-sim">{t.sim}</span>
          <span className={`dk-kl-src is-${c.offer.source}`}>{src}</span>
        </span>
        <label className={`dk-kl-pick${blocked ? ' is-blocked' : ''}`} title={blocked ? t.pickMax : undefined}>
          <input type="checkbox" checked={picked} disabled={blocked} onChange={() => onPick(id)} data-kl="pick" aria-describedby={blocked ? `kl-max-${id}` : undefined} />
          {t.pick}
          {blocked && (
            <span id={`kl-max-${id}`} className="dk-sr">
              {t.pickMax}
            </span>
          )}
        </label>
      </footer>
      <details className="dk-kl-parts">
        <summary>{t.parts}</summary>
        <dl>
          {(Object.keys(c.parts) as (keyof Card['parts'])[]).map((k) => (
            <div key={k}>
              <dt>{t.part[k]}</dt>
              <dd className="dk-num">{nf(lang, c.parts[k], 2)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  )
}
