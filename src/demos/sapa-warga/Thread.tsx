/**
 * demos/sapa-warga/Thread.tsx — the chat thread on the citizen phone: greeting, the citizen's bubbles (text, voice
 * note, photo + location), the AI's streamed answers with their cards (ticket, checklist, slot picker, ticket status),
 * and the messages the WORLD sends to this citizen (ticket updates with rating, queue tickets with QR, early warnings,
 * officer replies). Everything reads the world store, so a status change in the console shows here at once.
 */
import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import type { ChatMessage, Structured } from '../../demo-kit/ai/chat'
import { CATEGORY_LABEL, emit, hhmm, shallowEqual, useWorld, type Bi, type CitizenMessage, type ComplaintCategory, type TicketStatus } from '../../demo-kit/world'
import { Icon } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { preloadDemo } from '../registry'
import { FakeQr, LocationTile, Photo, StaticWave } from './photos'
import { SLUG, looksEnglish, slaText, slashBreak, type Created, type PhotoId } from './model'
import { STATUS_LABEL, STATUS_ORDER, fill, toolLabel, useT } from './strings'

const Speak = lazy(() => import('./Speak'))
const EMPTY_CHIPS: readonly string[] = []

/* ------------------------------------------------------------------ types shared with Phone */

export type Entry = { k: 'g' } | { k: 'm'; id: string } | { k: 'w'; id: string }
export interface MsgMeta {
  voice?: { lang: string; translation: Bi | null; secs: number; label: string }
  photo?: { id: PhotoId | 'own'; url?: string; title: Bi }
  loc?: { label: string }
  /** the ticket the phone created for this message (voice note / photo report) */
  created?: Created
}
export interface Conv {
  messages: ChatMessage[]
  timeline: Entry[]
  meta: Record<string, MsgMeta>
  /** assistant message id → ticket created from its structured result (pred = the code the answer text used) */
  created: Record<string, Created & { pred?: string }>
  /** structured results already acted on (`msgId:index`) */
  done: string[]
}
export const emptyConv = (): Conv => ({ messages: [], timeline: [{ k: 'g' }], meta: {}, created: {}, done: [] })

export interface ThreadActions {
  send: (text: string) => void
  openForm: (serviceId: string) => void
  openSlots: (serviceId: string) => void
}

/* ------------------------------------------------------------------ small parts */

const StatusDots = memo(function StatusDots({ status, lang }: { status: TicketStatus; lang: Lang }) {
  const cur = STATUS_ORDER.indexOf(status)
  return (
    <div className="dk-sw-dots" role="img" aria-label={STATUS_LABEL[status][lang]}>
      {STATUS_ORDER.map((s, i) => (
        <i key={s} className={i <= cur ? 'is-on' : undefined} />
      ))}
      <span>{STATUS_LABEL[status][lang]}</span>
    </div>
  )
})

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="dk-sw-kv">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ AI cards */

function TicketCard({ data, created, msgId, actions }: { data: Record<string, unknown>; created: (Created & { pred?: string }) | undefined; msgId: string; actions: ThreadActions }) {
  const { lang } = useI18n()
  const t = useT()
  const live = useWorld((s) => {
    const tk = created ? s.tickets.byId[created.ticketId] : undefined
    return tk ? { status: tk.status, opd: s.region.opd.find((o) => o.id === tk.opdId)?.short ?? tk.opdId, due: tk.slaDueAt - tk.createdAt } : null
  }, shallowEqual)
  const code = created?.code ?? String(data.code ?? '')
  const cat = (data.categoryId as ComplaintCategory | undefined) ?? null
  const hours = typeof data.slaHours === 'number' ? data.slaHours : live ? Math.round(live.due / 60) : 24
  const urg = String(data.urgency ?? '')
  const loc = data.location as { desa?: string; kecamatan?: string; detail?: string } | undefined
  return (
    <section className="dk-sw-card is-ticket" aria-label={`${t.ticketCard} ${code}`} data-msg-card={msgId}>
      <header>
        <Icon name="receipt" size={16} />
        <span>{t.ticketCard}</span>
        <b className="dk-num">{code || '…'}</b>
      </header>
      <dl>
        <Row k={t.category} v={slashBreak(cat ? CATEGORY_LABEL[cat][lang] : String(data.category ?? ''))} />
        <Row k={t.opd} v={live?.opd ?? String(data.opd ?? '')} />
        <Row k={t.sla} v={slaText(hours, lang)} />
        {urg && <Row k={t.urgency} v={urg === 'tinggi' || urg === 'kritis' ? (lang === 'id' ? 'Tinggi' : 'High') : urg === 'rendah' ? (lang === 'id' ? 'Rendah' : 'Low') : lang === 'id' ? 'Sedang' : 'Medium'} />}
        {loc?.detail && <Row k={t.where} v={loc.detail} />}
      </dl>
      {live && <StatusDots status={live.status} lang={lang} />}
      {code && (
        <div className="dk-sw-card-act">
          <button type="button" className="dk-sw-cbtn" onClick={() => actions.send(lang === 'id' ? `Status ${code}` : `Status of ${code}`)}>
            <Icon name="search" size={15} />
            {t.track}
          </button>
        </div>
      )}
    </section>
  )
}

function ChecklistCard({ data, actions }: { data: Record<string, unknown>; actions: ThreadActions }) {
  const t = useT()
  const shell = useShell()
  const serviceId = String(data.serviceId ?? '')
  const name = String(data.service ?? '')
  const reqs = Array.isArray(data.requirements) ? (data.requirements as unknown[]).map(String) : []
  const isNib = serviceId === 'nib-oss' || /\bNIB\b/i.test(name)
  const channel = String(data.channel ?? '')
  const formable = isNib || serviceId === 'izin-usaha-mikro'
  const queueable = !channel || channel === 'mpp' || channel === 'online'
  useEffect(() => {
    if (isNib) shell.markMission('nib')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNib])
  const sid = serviceId || (isNib ? 'nib-oss' : 'ktp-el')
  return (
    <section className="dk-sw-card is-check" aria-label={fill(t.checklist, { service: name })}>
      <header>
        <Icon name="checkCircle" size={16} />
        <span>{fill(t.checklist, { service: name })}</span>
      </header>
      <ul className="dk-sw-reqs">
        {reqs.map((r, i) => (
          <li key={i}>
            <Icon name="check" size={14} strokeWidth={2} />
            {r}
          </li>
        ))}
      </ul>
      <dl>
        {data.refNo ? <Row k={t.refNo} v={<span className="dk-num">{String(data.refNo)}</span>} /> : null}
        {data.refStatus ? <Row k={t.refStatus} v={String(data.refStatus)} /> : null}
        {data.estimate ? <Row k={t.estimate} v={String(data.estimate)} /> : null}
        {data.office ? <Row k={t.office} v={String(data.office)} /> : null}
        {data.fee ? <Row k={t.fee} v={String(data.fee)} /> : null}
      </dl>
      {(formable || queueable) && (
        <div className="dk-sw-card-act">
          {formable && (
            <button type="button" className="dk-sw-cbtn is-primary" onClick={() => actions.openForm(sid)} data-sw="fill-form">
              <Icon name="edit" size={15} />
              {t.fillForm}
            </button>
          )}
          {queueable && (
            <button type="button" className="dk-sw-cbtn" onClick={() => actions.openSlots(sid)} data-sw="take-queue">
              <Icon name="calendar" size={15} />
              {t.takeQueue}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function StatusCard({ data }: { data: Record<string, unknown> }) {
  const { lang } = useI18n()
  const t = useT()
  const tid = String(data.ticketId ?? '')
  const status = useWorld((s) => s.tickets.byId[tid]?.status ?? null)
  const st = (status ?? String(data.status ?? '')) as TicketStatus | 'tidak-ditemukan'
  return (
    <section className="dk-sw-card is-status" aria-label={`${t.status} ${String(data.ticketCode ?? '')}`}>
      <header>
        <Icon name="pulse" size={16} />
        <span>{t.status}</span>
        <b className="dk-num">{String(data.ticketCode ?? '')}</b>
      </header>
      {st === 'tidak-ditemukan' ? <p className="dk-sw-muted">{lang === 'id' ? 'Tidak ditemukan' : 'Not found'}</p> : <StatusDots status={st} lang={lang} />}
      {data.opd ? (
        <dl>
          <Row k={t.opd} v={String(data.opd)} />
        </dl>
      ) : null}
    </section>
  )
}

function StructuredCard({ value, msgId, created, actions }: { value: Structured; msgId: string; created: (Created & { pred?: string }) | undefined; actions: ThreadActions }) {
  const t = useT()
  switch (value.kind) {
    case 'ticket':
      return <TicketCard data={value.data} created={created} msgId={msgId} actions={actions} />
    case 'checklist':
    case 'service':
      return <ChecklistCard data={{ ...value.data, requirements: value.data.requirements ?? value.data.steps ?? [] }} actions={actions} />
    case 'ticket-status':
      return <StatusCard data={value.data} />
    case 'sapa-warga/slot-pick':
      return (
        <div className="dk-sw-card-act is-solo">
          <button type="button" className="dk-sw-cbtn is-primary" onClick={() => actions.openSlots(String(value.data.serviceId ?? 'ktp-el'))} data-sw="take-queue">
            <Icon name="calendar" size={15} />
            {t.slotTitle}
          </button>
        </div>
      )
    case 'booking':
      return (
        <p className="dk-sw-note">
          <Icon name="calendar" size={14} /> {String(value.data.service ?? '')} · {String(value.data.slot ?? '')}
        </p>
      )
    default:
      return null
  }
}

/* ------------------------------------------------------------------ bubbles */

function AssistantBubble({ m, isLast, created, actions, skipChips }: { m: ChatMessage; isLast: boolean; created: (Created & { pred?: string }) | undefined; actions: ThreadActions; skipChips: Set<string> }) {
  const { lang } = useI18n()
  const t = useT()
  const fix = (s: string) => (created?.pred && created.pred !== created.code ? s.split(created.pred).join(created.code) : s)
  const text = fix(m.content)
  const done = m.status === 'done'
  const jv = !!m.translation
  /* no chip twice: not one the phone already shows in its fixed row, not a queue chip when a card above offers the queue */
  const cardQueue = (m.structured ?? []).some((v) => v.kind === 'sapa-warga/slot-pick' || ((v.kind === 'checklist' || v.kind === 'service') && (!v.data.channel || v.data.channel === 'mpp' || v.data.channel === 'online')))
  const norm = (x: string) => x.trim().toLowerCase()
  const follow = (m.followUps ?? []).filter((f) => !skipChips.has(norm(f)) && !(cardQueue && /antrean|antrian|queue|slot/i.test(f)))
  return (
    <div className="dk-sw-row is-ai" data-msg={m.id}>
      <div className="dk-sw-bubble is-ai">
        {m.status === 'thinking' ? (
          <span className="dk-sw-typing" role="status" aria-label={t.thinking}>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <p className="dk-sw-text">{text}</p>
        )}
        {done && m.translation && (
          <p className="dk-sw-trans">
            <span>{t.translation}</span> {fix(m.translation)}
          </p>
        )}
        {done && !!m.toolCalls?.length && (
          <p className="dk-sw-steps" aria-label={t.steps}>
            {m.toolCalls.map((c, i) => (
              <span key={c.id || i}>
                {toolLabel(c.name, lang)}
                {c.ms ? <em className="dk-num"> {(c.ms / 1000).toFixed(1).replace('.', lang === 'id' ? ',' : '.')} s</em> : null}
              </span>
            ))}
          </p>
        )}
        {(m.structured ?? []).map((v, i) => (
          <StructuredCard key={i} value={v} msgId={m.id} created={created} actions={actions} />
        ))}
        {done && (
          <div className="dk-sw-meta">
            <span className={`dk-sw-mode${m.mode === 'live' ? ' is-live' : ''}`}>{m.fellBack ? t.fellBack : m.mode === 'live' ? t.live : t.sim}</span>
            {text && (
              <Suspense fallback={null}>
                <Speak text={text} lang={jv ? 'jv-ID' : looksEnglish(text) ? 'en-GB' : 'id-ID'} label={t.listen} />
              </Suspense>
            )}
          </div>
        )}
      </div>
      {isLast && done && follow.length > 0 && (
        <div className="dk-sw-follow" role="group" aria-label={t.quick}>
          {follow.map((f) => (
            <button key={f} type="button" className="dk-sw-chip" onClick={() => actions.send(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** the voice-note language line follows the UI language (it used to be frozen in the language of the moment it was sent) */
function voiceLabel(v: NonNullable<MsgMeta['voice']>, lang: Lang, tpl: string): string {
  const id = /^id\b|^id-/i.test(v.lang)
  if (id) return lang === 'id' ? 'Bahasa Indonesia' : 'Indonesian'
  const from = /^jv/i.test(v.lang) || /jawa|javanese/i.test(v.label) ? (lang === 'id' ? 'Basa Jawa' : 'Javanese') : lang === 'id' ? 'Bahasa daerah' : 'Regional language'
  return fill(tpl, { from })
}

function UserBubble({ m, meta }: { m: ChatMessage; meta: MsgMeta | undefined }) {
  const { lang } = useI18n()
  const t = useT()
  const v = meta?.voice
  return (
    <div className="dk-sw-row is-me" data-msg={m.id}>
      <div className={`dk-sw-bubble is-me${meta?.photo ? ' has-media' : ''}`}>
        {meta?.photo && (meta.photo.id === 'own' && meta.photo.url ? <img className="dk-sw-photo" src={meta.photo.url} alt={meta.photo.title[lang]} /> : meta.photo.id !== 'own' ? <Photo id={meta.photo.id} label={meta.photo.title[lang]} tag={`${t.photo} · ${meta.loc?.label ?? ''}`} /> : null)}
        {meta?.loc && (
          <div className="dk-sw-loc">
            <LocationTile label={`${t.location}: ${meta.loc.label}`} />
            <span>
              <Icon name="pin" size={13} /> {meta.loc.label}
            </span>
          </div>
        )}
        {v ? (
          <div className="dk-sw-voice">
            <span className="dk-sw-voice-top">
              <Icon name="mic" size={14} />
              <StaticWave seed={m.content} />
              <span className="dk-num">0:{String(Math.min(59, v.secs)).padStart(2, '0')}</span>
            </span>
            <span className="dk-sw-badge">{voiceLabel(v, lang, t.voiceLang)}</span>
            <p className="dk-sw-text">{m.content}</p>
            {v.translation && v.translation[lang] !== m.content && (
              <p className="dk-sw-trans">
                <span>{t.translation}</span> {v.translation[lang]}
              </p>
            )}
            <Suspense fallback={null}>
              <Speak text={m.content} lang={v.lang} label={t.play} />
            </Suspense>
          </div>
        ) : (
          m.content && <p className="dk-sw-text">{m.content}</p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ world messages */

function WorldMessage({ msg, hidden, latest, onAsk }: { msg: CitizenMessage; hidden: boolean; latest: boolean; onAsk: (text: string) => void }) {
  const { lang } = useI18n()
  const t = useT()
  const tid = msg.refs.find((r) => r.startsWith('tickets:'))?.slice(8) ?? ''
  const bid = msg.refs.find((r) => r.startsWith('bookings:'))?.slice(9) ?? ''
  const ticket = useWorld((s) => (tid ? s.tickets.byId[tid] ?? null : null))
  const booking = useWorld((s) => (bid ? s.bookings.byId[bid] ?? null : null))
  const svc = useWorld((s) => (booking ? s.region.services.find((x) => x.id === booking.serviceId)?.name ?? null : null))
  if (hidden) return null
  if (msg.kind === 'peringatan')
    return (
      <div className="dk-sw-row is-ai" data-wmsg={msg.id}>
        <section className="dk-sw-card is-warn" aria-label={t.warning}>
          <header>
            <Icon name="alert" size={16} />
            <span>{t.warning} · BPBD</span>
            <b className="dk-num">{hhmm(msg.at).replace(':', '.')}</b>
          </header>
          <p>{msg.text[lang]}</p>
          <div className="dk-sw-card-act">
            <button type="button" className="dk-sw-cbtn" onClick={() => onAsk(lang === 'id' ? 'Apakah perlu mengungsi?' : 'Should we evacuate?')}>
              <Icon name="help" size={15} />
              {lang === 'id' ? 'Apakah perlu mengungsi?' : 'Should we evacuate?'}
            </button>
          </div>
        </section>
      </div>
    )
  if (msg.kind === 'antrean')
    return (
      <div className="dk-sw-row is-ai" data-wmsg={msg.id}>
        <section className="dk-sw-card is-queue" aria-label={t.queueTicket}>
          <header>
            <Icon name="calendar" size={16} />
            <span>{t.queueTicket}</span>
            <b className="dk-num">{booking?.code ?? ''}</b>
          </header>
          <div className="dk-sw-queue">
            {booking && <FakeQr code={booking.code} label={t.qrNote} />}
            <div>
              <p className="dk-sw-queue-svc">{svc?.[lang] ?? ''}</p>
              <p className="dk-sw-queue-time dk-num">{booking ? hhmm(booking.slotAt).replace(':', '.') : ''} WIB</p>
              <p className="dk-sw-muted">{msg.text[lang].replace(/\b(\d{1,2}):(\d{2})\b/g, '$1.$2')}</p>
              <p className="dk-sw-fine">{t.qrNote}</p>
            </div>
          </div>
        </section>
      </div>
    )
  if (msg.kind === 'info')
    return (
      <div className="dk-sw-row is-ai" data-wmsg={msg.id}>
        <div className="dk-sw-bubble is-ai is-officer">
          <span className="dk-sw-from">
            <Icon name="user" size={13} /> {t.officer}
          </span>
          <p className="dk-sw-text">{msg.text[lang]}</p>
        </div>
      </div>
    )
  // ticket update
  const done = ticket?.status === 'selesai' && /selesai|resolved|penilaian|rate/i.test(msg.text.id + msg.text.en)
  return (
    <div className="dk-sw-row is-ai" data-wmsg={msg.id}>
      <section className="dk-sw-card is-update" aria-label={t.update}>
        <header>
          <Icon name="bell" size={16} />
          <span>{t.update}</span>
          <b className="dk-num">{hhmm(msg.at).replace(':', '.')}</b>
        </header>
        <p>{msg.text[lang]}</p>
        {ticket && latest && <StatusDots status={ticket.status} lang={lang} />}
        {done && ticket && (ticket.rating ? <p className="dk-sw-rated">{fill(t.rated, { n: ticket.rating })}</p> : <Rating ticketId={ticket.id} />)}
      </section>
    </div>
  )
}

function Rating({ ticketId }: { ticketId: string }) {
  const t = useT()
  return (
    <div className="dk-sw-rate" role="group" aria-label={t.rateAsk}>
      <span>{t.rateAsk}</span>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={fill(t.rateLabel, { n })} data-sw={`rate-${n}`} onClick={() => emit('ticket.statusChanged', { ticketId, status: 'selesai', rating: n }, SLUG)}>
            <Icon name="star" size={22} />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ the thread */

export function Thread({ conv, worldMsgs, greeting, tips, actions, scrollRef, quickChips = EMPTY_CHIPS }: {
  /** the texts / labels of the phone's fixed quick-chip row (a follow-up chip never repeats one) */
  quickChips?: readonly string[]
  conv: Conv
  worldMsgs: Record<string, CitizenMessage>
  greeting: { text: string; translation: string | null; hint?: string | null }
  /** what this persona can try (shown while the conversation is empty) */
  tips: { icon: 'mic' | 'camera' | 'bell' | 'checkCircle' | 'calendar' | 'search' | 'share'; text: string; go?: () => void }[]
  actions: ThreadActions
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const t = useT()
  const skip = useMemo(() => new Set(quickChips.map((x) => x.trim().toLowerCase())), [quickChips])
  const byId = new Map(conv.messages.map((m) => [m.id, m]))
  let lastAi: string | null = null
  for (let i = conv.messages.length - 1; i >= 0; i--)
    if (conv.messages[i]!.role === 'assistant') {
      lastAi = conv.messages[i]!.id
      break
    }
  // the same ticket update twice (a rating re-sends "selesai") shows once
  const seen = new Set<string>()
  const hide = new Set<string>()
  for (const e of conv.timeline) {
    if (e.k !== 'w') continue
    const m = worldMsgs[e.id]
    if (!m || m.kind !== 'tiket') continue
    const key = `${m.refs[0] ?? ''}|${m.text.id}`
    if (seen.has(key)) hide.add(m.id)
    seen.add(key)
  }
  // only the newest visible update of a ticket shows the live status bar
  const latest = new Map<string, string>()
  for (const e of conv.timeline) {
    const m = e.k === 'w' ? worldMsgs[e.id] : undefined
    if (m && m.kind === 'tiket' && !hide.has(m.id)) latest.set(m.refs[0] ?? m.id, m.id)
  }
  const end = useRef<HTMLDivElement>(null)
  const last = conv.messages[conv.messages.length - 1]
  const sig = `${conv.timeline.length}|${last?.content.length ?? 0}|${last?.status ?? ''}|${last?.structured?.length ?? 0}`
  // open at the latest message; then follow the conversation unless the reader scrolled up
  const lastH = useRef(0)
  useLayoutEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    sc.scrollTop = sc.scrollHeight
    // a restored thread (reload / Back) keeps growing for a moment (cards, lazy play buttons, photos): stay pinned to
    // the newest message until the reader scrolls themselves
    let user = false
    const mark = () => (user = true)
    sc.addEventListener('wheel', mark, { passive: true })
    sc.addEventListener('touchstart', mark, { passive: true })
    const ids = [120, 400, 900, 1600].map((ms) =>
      window.setTimeout(() => {
        if (!user) sc.scrollTop = sc.scrollHeight
      }, ms),
    )
    return () => {
      ids.forEach((x) => window.clearTimeout(x))
      sc.removeEventListener('wheel', mark)
      sc.removeEventListener('touchstart', mark)
    }
  }, [scrollRef])
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    const grew = sc.scrollHeight > lastH.current
    const nearEnd = lastH.current - sc.scrollTop - sc.clientHeight < 220
    lastH.current = sc.scrollHeight
    if (grew && nearEnd) sc.scrollTop = sc.scrollHeight
  }, [sig, scrollRef])
  return (
    <div className="dk-sw-thread" role="log" aria-live="polite" aria-label={t.phone}>
      {conv.timeline.map((e) => {
        if (e.k === 'g')
          return (
            <div key="g" className="dk-sw-row is-ai">
              <div className="dk-sw-bubble is-ai">
                <p className="dk-sw-text">{greeting.text}</p>
                {greeting.translation && (
                  <p className="dk-sw-trans">
                    <span>{t.translation}</span> {greeting.translation}
                  </p>
                )}
                {greeting.hint && <p className="dk-sw-text dk-sw-ghint">{greeting.hint}</p>}
              </div>
              {conv.messages.length === 0 && (
                <ul className="dk-sw-tips" aria-label={t.tryHere}>
                  {tips.map((x) => (
                    <li key={x.text}>
                      <Icon name={x.icon} size={15} />
                      {x.go ? (
                        <button type="button" className="dk-sw-tiplink" onClick={x.go} onPointerEnter={() => preloadDemo('siaga-wilayah')} onFocus={() => preloadDemo('siaga-wilayah')} onTouchStart={() => preloadDemo('siaga-wilayah')} data-sw="tip-siaga">
                          {x.text}
                          <Icon name="arrowUpRight" size={13} />
                        </button>
                      ) : (
                        x.text
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        if (e.k === 'w') {
          const m = worldMsgs[e.id]
          return m ? <WorldMessage key={`w${e.id}`} msg={m} hidden={hide.has(m.id)} latest={latest.get(m.refs[0] ?? m.id) === m.id} onAsk={actions.send} /> : null
        }
        const m = byId.get(e.id)
        if (!m) return null
        return m.role === 'user' ? (
          <UserBubble key={m.id} m={m} meta={conv.meta[m.id]} />
        ) : (
          <AssistantBubble key={m.id} m={m} isLast={m.id === lastAi} created={conv.created[m.id]} actions={actions} skipChips={skip} />
        )
      })}
      <div ref={end} />
    </div>
  )
}
