/**
 * Inti Kanal (lazy) — one inbox over WhatsApp / web / phone from every product (unifiedInbox): filters (channel,
 * ecosystem, unread), the thread in a Drawer (ChatThread), "Tandai dibaca" ⇒ chat.read (source inti; the source
 * product sees it read too) and "Buka percakapan di <produk>" (READY targets only).
 */
import { useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { useShell } from '../../demo-kit/shell'
import { Button, ChatThread, Drawer, Icon, Segmented, type ChatMessage } from '../../demo-kit/ui'
import { emit, hhmm, useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { inboxKpi, unifiedInbox, type InboxRow, type Scope } from '../../demo-kit/world/inti'
import { canLink, hrefTo, productName, type KanalFilter } from './model'
import { tm, useT, type Lang } from './strings'


const S = {
  id: {
    kpi: (t: number, u: number, wa: number, web: number, tel: number) => `${t} percakapan · ${u} belum dibaca · WA ${wa} · web ${web} · telepon ${tel}`,
    channel: 'Kanal',
    channels: { semua: 'Semua', wa: 'WA', web: 'Web', telepon: 'Telepon' },
    eco: 'Ekosistem',
    ecos: { semua: 'Semua', 'satu-daerah': 'Warga', 'usaha-pintar': 'Usaha', 'pasar-daerah': 'Pasar' } as Record<string, string>,
    unread: 'Belum dibaca saja',
    list: 'Kotak masuk gabungan',
    voice: 'pesan suara',
    empty: 'Tidak ada percakapan dengan filter ini.',
    more: (n: number) => `Tampilkan ${n} lagi`,
    read: 'Tandai dibaca',
    readAll: (n: number) => `Tandai ${n} dibaca`,
    already: 'Sudah dibaca',
    open: (p: string) => `Buka percakapan di ${p}`,
    notReady: (p: string) => `${p} belum dibuka untuk umum`,
    readAt: (t: string) => `Dibaca di GAMADA Inti pukul ${t}`,
    status: 'Status',
    noneUnread: 'Tidak ada pesan belum dibaca di daftar ini',
  },
  en: {
    kpi: (t: number, u: number, wa: number, web: number, tel: number) => `${t} conversations · ${u} unread · WA ${wa} · web ${web} · phone ${tel}`,
    channel: 'Channel',
    channels: { semua: 'All', wa: 'WA', web: 'Web', telepon: 'Phone' },
    eco: 'Ecosystem',
    ecos: { semua: 'All', 'satu-daerah': 'Citizens', 'usaha-pintar': 'Business', 'pasar-daerah': 'Market' } as Record<string, string>,
    unread: 'Unread only',
    list: 'Unified inbox',
    voice: 'voice note',
    empty: 'No conversation with these filters.',
    more: (n: number) => `Show ${n} more`,
    read: 'Mark as read',
    readAll: (n: number) => `Mark ${n} as read`,
    already: 'Already read',
    open: (p: string) => `Open the conversation in ${p}`,
    notReady: (p: string) => `${p} is not public yet`,
    readAt: (t: string) => `Read in GAMADA Inti at ${t}`,
    status: 'Status',
    noneUnread: 'No unread message in this list',
  },
}
const ICON = { wa: 'chat', web: 'globe', telepon: 'phone' } as const
const all = (s: WorldState) => s
const PAGE = 30

function threadOf(s: WorldState, r: InboxRow, lang: Lang): ChatMessage[] {
  const [t, id] = r.ref.split(':') as [string, string]
  const out: ChatMessage[] = []
  if (t === 'complaints') {
    const c = s.complaints.byId[id]
    if (c) {
      out.push({ id: `${r.id}-o`, side: 'them', text: c.text, at: c.at, author: r.from })
      if (c.lang !== 'id' || lang === 'en') out.push({ id: `${r.id}-s`, side: 'system', text: c.summary, at: c.at })
      if (c.readAt != null) out.push({ id: `${r.id}-r`, side: 'system', text: { id: S.id.readAt(tm(hhmm(c.readAt), 'id')), en: S.en.readAt(tm(hhmm(c.readAt), 'en')) } })
      return out
    }
  }
  out.push({ id: `${r.id}-p`, side: t === 'orders' || t === 'calls' ? 'system' : 'them', text: r.preview, at: r.at, author: r.from })
  const readAt = t === 'calls' ? s.calls.byId[id]?.readAt : undefined
  if (readAt != null) out.push({ id: `${r.id}-r`, side: 'system', text: { id: S.id.readAt(tm(hhmm(readAt), 'id')), en: S.en.readAt(tm(hhmm(readAt), 'en')) } })
  return out
}

export default function Kanal({ scope, filter, setFilter }: { scope: Scope; filter: KanalFilter; setFilter: (f: KanalFilter) => void }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const shell = useShell()
  const s = useWorld(all)
  const now = useClock().minutes
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(
    () => unifiedInbox(s, now, { channel: filter.channel, ...(filter.eco !== 'semua' ? { eco: filter.eco } : {}), unreadOnly: filter.unread, scope }),
    [s, now, filter, scope],
  )
  const kpi = useMemo(() => inboxKpi(s, now, scope), [s, now, scope])
  const row = open ? list.find((r) => r.id === open) ?? unifiedInbox(s, now, { scope }).find((r) => r.id === open) ?? null : null
  const unreadRefs = list.filter((r) => r.unread).map((r) => r.ref)
  const markRead = (refs: string[]) => {
    if (refs.length) emit('chat.read', { refs }, 'inti')
  }
  const ecoOpts = (scope === 'usaha' ? ['semua', 'usaha-pintar', 'pasar-daerah'] : ['semua', 'satu-daerah', 'usaha-pintar', 'pasar-daerah']) as KanalFilter['eco'][]

  return (
    <div className="dk-in-kanal">
      <p className="dk-in-status" data-in="kanal-kpi" data-unread={kpi.unread}>
        {L.kpi(kpi.total, kpi.unread, kpi.byChannel.wa, kpi.byChannel.web, kpi.byChannel.telepon)}
      </p>
      <div className="dk-in-filters">
        <Segmented size="sm" label={L.channel} value={filter.channel} onChange={(v) => setFilter({ ...filter, channel: v })} options={(['semua', 'wa', 'web', 'telepon'] as const).map((k) => ({ value: k, label: L.channels[k] }))} />
        <Segmented size="sm" label={L.eco} value={filter.eco} onChange={(v) => setFilter({ ...filter, eco: v })} options={ecoOpts.map((k) => ({ value: k, label: L.ecos[k]! }))} />
        <button type="button" className={`dk-in-root${filter.unread ? ' is-on' : ''}`} aria-pressed={filter.unread} data-in="unread-only" onClick={() => setFilter({ ...filter, unread: !filter.unread })}>
          <span>{L.unread}</span>
        </button>
        <Button size="sm" variant="ghost" icon="check" disabled={!unreadRefs.length} title={unreadRefs.length ? undefined : L.noneUnread} data-in="read-all" onClick={() => markRead(unreadRefs)}>
          {unreadRefs.length ? L.readAll(unreadRefs.length) : L.noneUnread}
        </Button>
      </div>
      <section className="dk-in-box" aria-label={L.list}>
        {list.length === 0 ? (
          <p className="dk-in-muted">{L.empty}</p>
        ) : (
          <ul className="dk-in-inbox">
            {list.slice(0, limit).map((r) => (
              <li key={r.id}>
                <button type="button" className={`dk-in-msg${r.unread ? ' is-unread' : ''}`} data-eco={r.eco} data-msg={r.id} onClick={() => setOpen(r.id)} aria-haspopup="dialog">
                  <Icon name={ICON[r.channel]} size={16} />
                  <span className="dk-in-msg-main">
                    <span className="dk-in-msg-from">
                      {r.from}
                      {r.voice && <span className="dk-in-mic">· {L.voice}</span>}
                    </span>
                    <span className="dk-in-msg-prev">{r.preview[lang as Lang]}</span>
                  </span>
                  <span className="dk-in-msg-meta">
                    <span>{productName(r.product)}</span>
                    <time>{tm(hhmm(r.at), lang as Lang)}</time>
                    {r.unread && <span className="dk-in-unread" aria-label={L.unread} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.length > limit && (
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            {L.more(Math.min(PAGE, list.length - limit))}
          </Button>
        )}
      </section>
      {row && (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={row.from}
          eyebrow={<span>{productName(row.product)} · {L.channels[row.channel]} · {tm(hhmm(row.at), lang as Lang)}</span>}
          width={shell.size === 'sm' ? 480 : 440}
          className="dk-in-thread-ov"
          footer={
            <div className="dk-in-dfoot">
              <Button variant="secondary" icon="check" disabled={!row.unread} data-in="mark-read" onClick={() => markRead([row.ref])}>
                {row.unread ? L.read : L.already}
              </Button>
              {canLink(row.product) ? (
                <AppLink className="dk-btn dk-btn--primary dk-btn--md" to={hrefTo(row.product, { focus: row.href.split('focus=')[1] ?? row.id })} data-in="open-conv">
                  {L.open(productName(row.product))}
                </AppLink>
              ) : (
                <span className="dk-in-muted">{L.notReady(productName(row.product))}</span>
              )}
            </div>
          }
        >
          <ChatThread messages={threadOf(s, row, lang as Lang)} label={{ id: S.id.list, en: S.en.list }} />
        </Drawer>
      )}
    </div>
  )
}
