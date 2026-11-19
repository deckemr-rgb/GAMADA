/**
 * demos/pantau-merek/Reviews.tsx — Ulasan (lazy): the shop's reviews and mentions with filter chips, 44 px checkboxes
 * on unanswered complaints, "Pilih 5 dari lonjakan" and a sticky "Balas n terpilih" bar that opens the bulk reply
 * sheet (lazy). Replies sent show under each review (ReplyChip + text). `?focus=BM-…` selects and scrolls to a review.
 */
import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, flashNewRow, motionMode } from '../../demo-kit/ui'
import { intentProps, useShell } from '../../demo-kit/shell'
import { world, type BrandMention } from '../../demo-kit/world'
import { BRAND_CHANNEL, BRAND_TOPIC, brandStream, replyCandidates } from '../../demo-kit/world/usaha-pintar'
import { ReplyChip } from './ReplyChip'
import { Stars } from './Stream'
import { afterPaint, cardAlert, reviewSelection, useBrand, useSelection } from './model'
import { loadBulk } from './loaders'
import type { Arrival } from './index'
import { STR, fill, tm, useStr, type Lang } from './strings'

const BulkReply = lazy(loadBulk)

type F = 'unreplied' | 'spike' | 'neg' | 'replied' | 'all'
const S = {
  id: {
    title: 'Ulasan & keluhan toko',
    meta: '{n} ulasan · {u} belum dibalas',
    filters: 'Saring ulasan',
    f: { unreplied: 'Belum dibalas', spike: 'Dari lonjakan', neg: 'Negatif', replied: 'Sudah dibalas', all: 'Semua' } as Record<F, string>,
    pick5: 'Pilih 5 dari lonjakan',
    pick5Base: 'Pilih 5 keluhan terbaru',
    noPick: 'Belum ada keluhan yang perlu dibalas.',
    select: 'Pilih ulasan @{a} untuk dibalas',
    selected: '{n} terpilih',
    bulk: 'Balas {n} terpilih',
    bulkNone: 'Pilih ulasan dulu (centang di kiri kartu).',
    clear: 'Kosongkan',
    empty: 'Tidak ada ulasan untuk saringan ini.',
    more: 'Muat {n} lagi',
    spikeTag: 'lonjakan',
    order: 'pesanan {o}',
  },
  en: {
    title: 'Shop reviews & complaints',
    meta: '{n} reviews · {u} unanswered',
    filters: 'Filter reviews',
    f: { unreplied: 'Unanswered', spike: 'From the spike', neg: 'Negative', replied: 'Answered', all: 'All' } as Record<F, string>,
    pick5: 'Pick 5 from the spike',
    pick5Base: 'Pick the 5 newest complaints',
    noPick: 'No complaints waiting for a reply.',
    select: 'Select the review by @{a} to reply',
    selected: '{n} selected',
    bulk: 'Reply to {n} selected',
    bulkNone: 'Select reviews first (tick the box on the card).',
    clear: 'Clear',
    empty: 'No reviews for this filter.',
    more: 'Load {n} more',
    spikeTag: 'spike',
    order: 'order {o}',
  },
}

const Card = memo(function Card({ m, lang, on, toggle, spike }: { m: BrandMention; lang: Lang; on: boolean; toggle: (id: string) => void; spike: boolean }) {
  const L = S[lang]
  const t = STR[lang]
  const can = m.sentiment === 'negatif' && m.repliedAt == null
  const text = m.text[lang]
  return (
    <li className={`dk-pm-rv is-${m.sentiment}${on ? ' is-on' : ''}`} data-id={m.id}>
      {can ? (
        <label className="dk-pm-rv-check">
          <input type="checkbox" checked={on} onChange={() => toggle(m.id)} aria-label={fill(L.select, { a: m.author })} data-pm="select" />
        </label>
      ) : (
        <span className="dk-pm-rv-check is-none" aria-hidden="true" />
      )}
      <div className="dk-pm-rv-main">
        <div className="dk-pm-m-top">
          <span className="dk-pm-m-author">@{m.author}</span>
          <span className="dk-pm-m-ch">{BRAND_CHANNEL[m.channel][lang]}</span>
          {spike && <span className="dk-pm-m-tag is-neg">{L.spikeTag}</span>}
          <time className="dk-pm-m-time dk-num">{tm(m.at, lang)}</time>
        </div>
        <p className="dk-pm-m-text" lang={m.lang === 'en' ? 'en' : lang}>
          {text}
        </p>
        <div className="dk-pm-m-foot">
          <span className={`dk-pm-sent is-${m.sentiment}`}>
            <i aria-hidden="true" />
            {t[m.sentiment]}
          </span>
          <span className="dk-pm-m-topic">#{BRAND_TOPIC[m.topic][lang]}</span>
          {m.rating != null && <Stars n={m.rating} t={t} />}
          {m.orderCode && <span className="dk-pm-m-topic dk-num">{fill(L.order, { o: m.orderCode })}</span>}
          {m.repliedAt != null && <ReplyChip at={m.repliedAt} tone={m.replyTone} lang={lang} />}
        </div>
        {m.reply && m.repliedAt != null && (
          <p className="dk-pm-m-reply" data-pm="reply">
            {m.reply[lang === 'en' || m.lang === 'en' ? 'en' : 'id']}
          </p>
        )}
      </div>
    </li>
  )
})

export default function Reviews({ now, arrive }: { now: number; arrive: Arrival | null }) {
  const { lang } = useStr()
  const L = S[lang]
  const shell = useShell()
  const step = shell.size === 'sm' ? 12 : 30
  const [f, setF] = useState<F>(() => (arrive?.kind === 'mention' ? 'all' : 'unreplied'))
  const [shown, setShown] = useState(step)
  const [bulk, setBulk] = useState(false)
  const sel = useSelection()
  const list = useBrand((s, n) => brandStream(s, n, { brand: 'shop' }), now)
  const alert = useBrand((s, n) => cardAlert(s, n).alert, now)
  const isSpike = (m: BrandMention) => !!alert && m.cause === alert.causeRef && m.sentiment === 'negatif'
  const shownList = useMemo(
    () =>
      list.filter((m) =>
        f === 'all' ? true : f === 'unreplied' ? m.sentiment === 'negatif' && m.repliedAt == null : f === 'spike' ? !!alert && m.cause === alert.causeRef && m.sentiment === 'negatif' : f === 'neg' ? m.sentiment === 'negatif' : m.repliedAt != null,
      ),
    [list, f, alert],
  )
  const unreplied = useMemo(() => list.filter((m) => m.sentiment === 'negatif' && m.repliedAt == null).length, [list])
  // a review answered meanwhile leaves the selection
  const valid = useMemo(() => sel.filter((id) => list.some((m) => m.id === id && m.repliedAt == null)), [sel, list])
  useEffect(() => {
    if (valid.length !== sel.length) reviewSelection.set(valid)
  }, [valid, sel])
  const toggle = (id: string) => {
    const cur = reviewSelection.get()
    reviewSelection.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }
  const pick5 = () => {
    const s = world.get()
    const c = replyCandidates(s, now, alert?.id)
    reviewSelection.set(c.slice(0, 5).map((m) => m.id))
    if (alert) setF('spike')
  }
  const canPick = useBrand((s, n) => replyCandidates(s, n).length > 0, now)

  // ?focus=BM-… : show it, scroll there, flash
  const ul = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (arrive?.kind !== 'mention') return
    setF('all')
    const i = list.findIndex((m) => m.id === arrive.id)
    if (i >= shown) setShown(i + 1)
    const tm2 = window.setTimeout(() => {
      const el = ul.current?.querySelector<HTMLElement>(`[data-id="${arrive.id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
      flashNewRow(el)
    }, 60)
    return () => window.clearTimeout(tm2)
  }, [arrive]) // eslint-disable-line react-hooks/exhaustive-deps

  const n = valid.length
  return (
    <div className="dk-pm-reviews">
      <header className="dk-pm-head">
        <div className="dk-pm-head-t">
          <h2 className="dk-pm-h2">{L.title}</h2>
          <p className="dk-pm-lead dk-num">{fill(L.meta, { n: list.length, u: unreplied })}</p>
        </div>
        <div className="dk-pm-head-act">
          <Button size="sm" variant="secondary" icon="check" onClick={pick5} disabled={!canPick} aria-describedby={canPick ? undefined : 'dk-pm-nopick'} data-pm="select-alert-5">
            {alert ? L.pick5 : L.pick5Base}
          </Button>
          {!canPick && (
            <span id="dk-pm-nopick" className="dk-pm-note">
              {L.noPick}
            </span>
          )}
        </div>
      </header>
      <div className="dk-pm-chips" role="group" aria-label={L.filters}>
        {(['unreplied', 'spike', 'neg', 'replied', 'all'] as F[]).map((k) => (
          <Chip key={k} selected={f === k} aria-current={f === k} onToggle={() => (setF(k), setShown(step))}>
            {L.f[k]}
          </Chip>
        ))}
      </div>
      {shownList.length ? (
        <ul className="dk-pm-rvlist" ref={ul} data-pm="reviews">
          {shownList.slice(0, shown).map((m) => (
            <Card key={m.id} m={m} lang={lang} on={valid.includes(m.id)} toggle={toggle} spike={isSpike(m)} />
          ))}
        </ul>
      ) : (
        <p className="dk-pm-empty">{L.empty}</p>
      )}
      {shownList.length > shown && (
        <Button size="sm" variant="ghost" icon="plus" className="dk-pm-more" onClick={() => setShown((x) => x + step)}>
          {fill(L.more, { n: Math.min(step, shownList.length - shown) })}
        </Button>
      )}
      <div className="dk-pm-bulkbar" data-pm="bulk-bar">
        <span className="dk-pm-bulk-n dk-num" aria-live="polite">
          {fill(L.selected, { n })}
        </span>
        {n > 0 && (
          <Button size="sm" variant="quiet" onClick={() => reviewSelection.set([])} data-pm="bulk-clear">
            {L.clear}
          </Button>
        )}
        <Button variant="primary" icon="send" disabled={!n} aria-describedby={n ? undefined : 'dk-pm-bulknone'} onClick={() => afterPaint(() => setBulk(true))} data-pm="bulk-open" {...intentProps(loadBulk)}>
          {fill(L.bulk, { n })}
        </Button>
        {!n && (
          <span id="dk-pm-bulknone" className="dk-pm-note">
            {L.bulkNone}
          </span>
        )}
      </div>
      {bulk && (
        <Suspense fallback={null}>
          <BulkReply open={bulk} ids={valid} alertId={alert?.id ?? null} onClose={() => setBulk(false)} />
        </Suspense>
      )}
    </div>
  )
}
