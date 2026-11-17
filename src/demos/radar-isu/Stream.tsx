/**
 * demos/radar-isu/Stream.tsx — the live mention stream (spec P4 "Kolom kiri"): fictional outlets and accounts, newest
 * first, sentiment badge, topic, reach, hoax / suspicious-narrative tags. New rows slide in with the kit highlight;
 * one polite live region announces the newest mention. Each row can be sent to the AI analyst ("Nilai dengan AI").
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon, IconButton, Segmented, EmptyState, flashNewRow, type IconName } from '../../demo-kit/ui'
import type { Mention } from '../../demo-kit/world'
import { clockWib, compact } from '../../demo-kit/viz/format'
import { fill, topicName, useStr, type Strings } from './strings'

export type StreamFilter = 'all' | 'berita' | 'sosmed' | 'neg'

const KIND_ICON: Record<Mention['kind'], IconName> = {
  berita: 'doc',
  sosmed: 'chat',
  forum: 'users',
}

const Row = memo(function Row({ m, t, lang, onAssess }: { m: Mention; t: Strings; lang: 'id' | 'en'; onAssess: (m: Mention) => void }) {
  const kind = m.kind === 'berita' ? t.kindBerita : m.kind === 'sosmed' ? t.kindSosmed : t.kindForum
  // the rumour's own posts are flagged; the positive posts that answer it (same hoaxId, no rumour key) are not
  const flagged = !!m.rumor
  const related = !m.rumor && !!m.hoaxId
  return (
    <li className={`dk-ri-m is-${m.sentiment}${flagged ? ' is-flag' : ''}`} data-id={m.id}>
      <div className="dk-ri-m-top">
        <span className="dk-ri-m-kind" title={kind} aria-label={kind}>
          <Icon name={KIND_ICON[m.kind]} size={14} />
        </span>
        <span className="dk-ri-m-outlet">{m.outlet}</span>
        {m.kind !== 'berita' && m.author !== m.outlet && <span className="dk-ri-m-author">{m.author}</span>}
        <time className="dk-ri-m-time dk-num">{clockWib(m.at, lang)}</time>
      </div>
      <p className="dk-ri-m-text">{m.text[lang]}</p>
      <div className="dk-ri-m-foot">
        <span className={`dk-ri-sent is-${m.sentiment}`}>
          <i aria-hidden="true" />
          {t[m.sentiment]}
        </span>
        <span className="dk-ri-m-topic">#{topicName(m.topic, lang)}</span>
        <span className="dk-ri-m-reach dk-num">{fill(t.reach, { n: compact(m.reach, lang) })}</span>
        {flagged && <span className="dk-ri-flag">{m.hoaxId ? t.hoaxTag : t.rumorTag}</span>}
        {related && <span className="dk-ri-flag is-related">{t.clarTag}</span>}
        <IconButton icon="spark" size="sm" variant="quiet" label={`${t.assess}: ${m.outlet}`} className="dk-ri-m-ai" onClick={() => onAssess(m)} />
      </div>
    </li>
  )
})

/** the filter lives here, so switching it re-renders only the stream (not the charts beside it) */
export const Stream = memo(function Stream({ items, initialFilter, onAssess }: { items: Mention[]; initialFilter: StreamFilter; onAssess: (m: Mention) => void }) {
  const { t, lang } = useStr()
  const [filter, onFilter] = useState<StreamFilter>(initialFilter)
  const list = useMemo(
    () => items.filter((m) => (filter === 'all' ? true : filter === 'neg' ? m.sentiment === 'negatif' : filter === 'berita' ? m.kind === 'berita' : m.kind !== 'berita')),
    [items, filter],
  )
  const ul = useRef<HTMLUListElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const [said, setSaid] = useState('')

  // slide + highlight rows that were not there before (not on first paint, not when the filter changes)
  const lastFilter = useRef(filter)
  useLayoutEffect(() => {
    const ids = new Set(list.map((m) => m.id))
    const prev = seen.current
    const refilter = lastFilter.current !== filter
    lastFilter.current = filter
    seen.current = ids
    if (!prev || refilter) return
    const fresh = list.filter((m) => !prev.has(m.id))
    if (!fresh.length) return
    const kills: (() => void)[] = []
    for (const m of fresh.slice(0, 6)) {
      const el = ul.current?.querySelector<HTMLElement>(`[data-id="${m.id}"]`)
      if (el) kills.push(flashNewRow(el))
    }
    const top = fresh[0]
    if (top)
      setSaid(
        fill(t.newMention, {
          o: top.outlet,
          s: t[top.sentiment].toLowerCase(),
        }),
      )
    return () => {
      // let the running highlight finish; only drop references
      kills.length = 0
    }
  }, [list, filter, t])

  return (
    <section className="dk-ri-stream" aria-labelledby="dk-ri-stream-h">
      <header className="dk-ri-sec-h">
        <h3 id="dk-ri-stream-h" className="dk-ri-sec-t">
          {t.streamTitle}
          <span className="dk-ri-sec-meta">{t.streamMeta}</span>
        </h3>
      </header>
      <Segmented<StreamFilter>
        size="sm"
        label={t.filterLabel}
        value={filter}
        onChange={onFilter}
        options={[
          { value: 'all', label: t.fAll },
          { value: 'berita', label: t.fNews },
          { value: 'sosmed', label: t.fSocial },
          { value: 'neg', label: t.fNeg },
        ]}
        className="dk-ri-filter"
      />
      <p className="dk-sr" aria-live="polite">
        {said}
      </p>
      {list.length ? (
        <ul ref={ul} className="dk-ri-mlist">
          {list.map((m) => (
            <Row key={m.id} m={m} t={t} lang={lang} onAssess={onAssess} />
          ))}
        </ul>
      ) : (
        <EmptyState compact art="inbox" title={t.streamEmpty} action={{ label: t.streamEmptyCta, onClick: () => onFilter('all') }} />
      )}
    </section>
  )
})
