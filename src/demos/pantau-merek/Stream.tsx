/**
 * demos/pantau-merek/Stream.tsx — the mention stream (`brandStream`, newest first): fictional accounts, generic channel
 * labels, sentiment, topic, rating and the reply under a replied review. New rows flash in (kit helper); one polite
 * live region announces at most one new mention per 10 s.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Segmented, flashNewRow } from '../../demo-kit/ui'
import type { BrandMention } from '../../demo-kit/world'
import { BRAND_CHANNEL, BRAND_TOPIC } from '../../demo-kit/world/usaha-pintar'
import { ReplyChip } from './ReplyChip'
import { fill, tm, type Lang, type Strings } from './strings'

export type StreamFilter = 'all' | 'shop' | 'neg' | 'comp'

export function Stars({ n, t }: { n: number; t: Strings }) {
  return (
    <span className="dk-pm-stars" role="img" aria-label={fill(t.stars, { n })}>
      {'★'.repeat(n)}
      <span aria-hidden="true">{'★'.repeat(Math.max(0, 5 - n))}</span>
    </span>
  )
}

export const MentionRow = memo(function MentionRow({ m, t, lang, shopId, highlight }: { m: BrandMention; t: Strings; lang: Lang; shopId: string; highlight?: boolean }) {
  const own = m.brand === shopId
  const text = lang === 'en' ? m.text.en : m.lang === 'en' ? m.text.en : m.text.id
  return (
    <li className={`dk-pm-m is-${m.sentiment}${highlight ? ' is-hl' : ''}`} data-id={m.id}>
      <div className="dk-pm-m-top">
        <span className="dk-pm-m-author">@{m.author}</span>
        <span className="dk-pm-m-ch">{BRAND_CHANNEL[m.channel][lang]}</span>
        {!own && <span className="dk-pm-m-tag">{m.brand === 'kategori' ? t.category : `${t.competitor} · ${m.brand}`}</span>}
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
        {m.inReplyTo && <span className="dk-pm-m-tag is-pos">{t.inReply}</span>}
        {m.repliedAt != null && <ReplyChip at={m.repliedAt} tone={m.replyTone} lang={lang} />}
      </div>
      {m.reply && m.repliedAt != null && <p className="dk-pm-m-reply">{m.reply[lang === 'en' || m.lang === 'en' ? 'en' : 'id']}</p>}
    </li>
  )
})

export const Stream = memo(function Stream({ items, t, lang, shopId, compact }: { items: BrandMention[]; t: Strings; lang: Lang; shopId: string; compact: boolean }) {
  const [filter, setFilter] = useState<StreamFilter>('all')
  const step = compact ? 12 : 20
  const [shown, setShown] = useState(step)
  const all = useMemo(
    () => items.filter((m) => (filter === 'all' ? true : filter === 'shop' ? m.brand === shopId : filter === 'neg' ? m.sentiment === 'negatif' : m.brand !== shopId && m.brand !== 'kategori')),
    [items, filter, shopId],
  )
  const list = all.slice(0, shown)
  const ul = useRef<HTMLUListElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const lastFilter = useRef(filter)
  const [said, setSaid] = useState('')
  const lastSaid = useRef(0)
  useEffect(() => setSaid(''), [lang])
  useLayoutEffect(() => {
    const ids = new Set(list.map((m) => m.id))
    const prev = seen.current
    const refilter = lastFilter.current !== filter
    lastFilter.current = filter
    seen.current = ids
    if (!prev || refilter) return
    const fresh = list.filter((m) => !prev.has(m.id))
    if (!fresh.length) return
    for (const m of fresh.slice(0, 6)) {
      const el = ul.current?.querySelector<HTMLElement>(`[data-id="${m.id}"]`)
      if (el) flashNewRow(el, { slide: fresh.length <= 2 })
    }
    const now = performance.now()
    const top = fresh[0]
    if (top && now - lastSaid.current >= 10_000) {
      lastSaid.current = now
      setSaid(fill(t.newMention, { a: top.author, s: t[top.sentiment].toLowerCase() }))
    }
  }, [list, filter, t])

  return (
    <section className="dk-pm-card dk-pm-stream" aria-labelledby="dk-pm-stream-h">
      <header className="dk-pm-sec-h">
        <h3 id="dk-pm-stream-h" className="dk-pm-sec-t">
          {t.streamTitle}
          <span className="dk-pm-sec-meta">{t.streamMeta}</span>
        </h3>
      </header>
      <Segmented<StreamFilter>
        size="sm"
        label={t.streamFilter}
        value={filter}
        onChange={(v) => {
          setFilter(v)
          setShown(step)
        }}
        className="dk-pm-filter"
        options={[
          { value: 'all', label: t.fAll },
          { value: 'shop', label: t.fShop },
          { value: 'neg', label: t.fNeg },
          { value: 'comp', label: t.fComp },
        ]}
      />
      <p className="dk-sr" aria-live="polite">
        {said}
      </p>
      {list.length ? (
        <ul ref={ul} className="dk-pm-mlist" data-pm="stream">
          {list.map((m) => (
            <MentionRow key={m.id} m={m} t={t} lang={lang} shopId={shopId} />
          ))}
        </ul>
      ) : (
        <p className="dk-pm-empty">{t.streamEmpty}</p>
      )}
      {all.length > list.length && (
        <Button size="sm" variant="ghost" icon="plus" className="dk-pm-more" onClick={() => setShown((n) => n + step)}>
          {fill(t.more, { n: Math.min(step, all.length - list.length) })}
        </Button>
      )}
    </section>
  )
})
