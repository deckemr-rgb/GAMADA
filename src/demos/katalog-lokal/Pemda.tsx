/**
 * Sisi Pemda pieces (first load): the composer (textarea + 3 example chips; the parser/AI chunk loads on intent),
 * the need list (Terbuka / Dipesan / Selesai) and the read-only "HP UMKM" phone peek (one button = flip).
 */
import { useRef, type KeyboardEvent } from 'react'
import { Button, Segmented, Textarea } from '../../demo-kit/ui'
import { PhoneFrame } from '../../demo-kit/frames'
import { formatTime, type CatalogNeed, type Order } from '../../demo-kit/world'
import type { NeedTab } from '../../demo-kit/world/pasar-daerah'
import { nf, rp, type Lang } from './model'
import type { T } from './strings'

export interface ComposerProps {
  text: string
  onText: (v: string) => void
  examples: string[]
  onExample: (v: string) => void
  onCompose: () => void
  onIntent: () => void
  onAsk: () => void
  askIntent: () => void
  t: T
}

export function Composer({ text, onText, examples, onExample, onCompose, onIntent, onAsk, askIntent, t }: ComposerProps) {
  const empty = !text.trim()
  return (
    <section className="dk-kl-composer" aria-labelledby="kl-compose-h" onPointerEnter={onIntent} onFocusCapture={onIntent}>
      <h3 id="kl-compose-h">{t.composeTitle}</h3>
      <label className="dk-kl-label" htmlFor="kl-compose">
        {t.composeLabel}
      </label>
      <Textarea id="kl-compose" rows={3} value={text} placeholder={t.composePh} onChange={(e) => onText(e.target.value)} data-kl="composer" />
      <p className="dk-kl-muted">{t.examples}</p>
      <div className="dk-kl-examples">
        {examples.map((x, i) => (
          <button key={i} type="button" className="dk-kl-ex" onClick={() => onExample(x)} data-kl="example" {...(i === 0 ? { 'data-hotspot': 'kl-example' } : {})}>
            {x}
          </button>
        ))}
      </div>
      <div className="dk-kl-compose-act">
        <Button variant="primary" icon="spark" onClick={onCompose} disabled={empty} aria-describedby={empty ? 'kl-compose-why' : undefined} data-kl="compose">
          {t.compose}
        </Button>
        <Button variant="ghost" icon="chat" onClick={onAsk} onPointerEnter={askIntent} onFocus={askIntent} aria-haspopup="dialog" data-kl="ask">
          {t.ask}
        </Button>
      </div>
      {empty && (
        <p id="kl-compose-why" className="dk-kl-muted">
          {t.composeEmpty}
        </p>
      )}
    </section>
  )
}

export interface NeedListProps {
  tab: NeedTab
  onTab: (v: NeedTab) => void
  counts: Record<NeedTab, number>
  needs: CatalogNeed[]
  selected: string | null
  onOpen: (id: string) => void
  kecName: (id: string) => string
  matchCount: (id: string) => number
  t: T
  lang: Lang
}

export function NeedList({ tab, onTab, counts, needs, selected, onOpen, kecName, matchCount, t, lang }: NeedListProps) {
  const ref = useRef<HTMLUListElement>(null)
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const n = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (n) {
      e.preventDefault()
      n.focus()
    }
  }
  return (
    <section className="dk-kl-needs" aria-labelledby="kl-needs-h">
      <h3 id="kl-needs-h">{t.needs}</h3>
      <Segmented<NeedTab> options={(['terbuka', 'dipesan', 'selesai'] as const).map((k) => ({ value: k, label: `${t.tabs[k]} (${counts[k]})` }))} value={tab} onChange={onTab} label={t.needs} size="sm" className="dk-kl-needtabs" />
      {needs.length ? (
        <ul ref={ref} className="dk-kl-needlist" onKeyDown={onKey} data-kl="need-list">
          {needs.map((n) => {
            const m = matchCount(n.id)
            return (
              <li key={n.id} data-kl-need={n.id}>
                <button type="button" aria-current={selected === n.id ? 'true' : undefined} onClick={() => onOpen(n.id)}>
                  <span className="dk-kl-needrow-h">
                    <span className="dk-kl-code dk-num">{n.code}</span>
                    {n.emergency && <span className="dk-kl-chip is-warn">{t.emergency}</span>}
                    <span className="dk-kl-muted dk-num">{formatTime(((n.at % 1440) + 1440) % 1440)}</span>
                  </span>
                  <b>{n.title[lang]}</b>
                  <span className="dk-kl-muted">
                    {kecName(n.kecamatanId)} · {n.items.map((i) => `${nf(lang, i.qty)} ${i.unit}`).join(' + ')}
                    {m > 0 ? ` · ${m} UMKM ${t.match}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="dk-kl-muted dk-kl-empty">{t.noNeeds[tab]}</p>
      )}
    </section>
  )
}

export interface PhonePeekProps {
  biz: string
  orders: (Order & { isNew: boolean })[]
  minutes: number
  onOpen: () => void
  t: T
  lang: Lang
}

/** the live, read-only "HP UMKM" — the whole frame is one button that flips to the UMKM side */
export function PhonePeek({ biz, orders, minutes, onOpen, t, lang }: PhonePeekProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }
  return (
    <div className="dk-kl-peek" role="button" tabIndex={0} aria-label={`${t.phoneOpen} · ${t.phoneOf(biz)}`} onClick={onOpen} onKeyDown={onKey} data-kl="phone-peek">
      <PhoneFrame label={t.phone} time={formatTime(minutes)} tilt={false} width={230}>
        <div className="dk-kl-peek-in" aria-hidden="true">
          <p className="dk-kl-peek-h">
            <b>{t.phone}</b>
            <span>{biz}</span>
          </p>
          {orders.length ? (
            orders.slice(0, 3).map((o) => (
              <div key={o.id} className={`dk-kl-note${o.isNew ? ' is-new' : ''}`} data-kl-note={o.id}>
                <span className="dk-num">{o.code}</span>
                <b>{t.status[['dipesan', 'dikonfirmasi', 'dikirim', 'dibayar'].indexOf(o.status)]}</b>
                <span className="dk-num">{rp(o.total)}</span>
              </div>
            ))
          ) : (
            <p className="dk-kl-muted">{t.phoneEmpty}</p>
          )}
          <span className="dk-kl-peek-cta">{t.phoneOpen} →</span>
        </div>
      </PhoneFrame>
      <span className="dk-sr">{lang === 'id' ? `${orders.length} pesanan` : `${orders.length} orders`}</span>
    </div>
  )
}
