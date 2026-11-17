/**
 * demos/sapa-warga/TicketDetail.tsx — the ticket drawer of the officer console (lazy): AI summary, the original message
 * or voice-note transcript (regional language + translation, playable), the citizen's photo, the location on the real
 * map, the reporter, duplicates within 500 m with "Gabungkan duplikat", the history, a quick reply with an AI draft,
 * and the status actions (Verifikasi → Teruskan ke OPD → Diproses → Selesai with an after photo). Each action is a
 * world event; the drawer shows how fast the citizen phone received it.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { Button, Drawer, Icon, InsightCallout, Select, SlaLabel, Stepper, StatusChip, Textarea, Timeline, type TimelineItem } from '../../demo-kit/ui'
import { CATEGORY_LABEL, DAY_MIN, emit, hhmm, onEvent, useClock, useWorld, world, worldDate, type Bi, type ComplaintCategory, type TicketStatus, type WorldState } from '../../demo-kit/world'
import { duplicateCandidates } from '../../demo-kit/world/satu-daerah'
import { Photo } from './photos'
import { SLUG, SW, desaName, kecName, opdShort, type PhotoId } from './model'
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_ORDER, URGENCY_LABEL, fill, useT } from './strings'

const MiniMap = lazy(() => import('./MiniMap'))
const Speak = lazy(() => import('./Speak'))

const PHOTO_OF: Partial<Record<ComplaintCategory, PhotoId>> = { banjir: 'genangan', 'jalan-rusak': 'lubang', pju: 'lampu' }
const MERGE_RE = /^Digabung ke (SW-\d{4}-\d{3,5})/
const AFTER_NOTE = 'Foto sesudah terlampir'

/** "08.54" today, "22 Okt · 08.54" for an older ticket */
function stamp(day: string, at: number, now: number, lang: 'id' | 'en'): string {
  const time = hhmm(at).replace(':', '.')
  if (Math.floor(at / DAY_MIN) === Math.floor(now / DAY_MIN)) return time
  const date = worldDate(day, at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
  return `${date} · ${time}`
}

function useTicket(ticketId: string) {
  const ticket = useWorld((s) => s.tickets.byId[ticketId] ?? null)
  const complaint = useWorld((s) => (ticket ? s.complaints.byId[ticket.complaintId] ?? null : null))
  const citizen = useWorld((s) => (complaint?.citizenId ? s.citizens.byId[complaint.citizenId] ?? null : null))
  return { ticket, complaint, citizen }
}

/** merged children of a ticket (their last history note says "Digabung ke <code>") */
function mergedOf(s: WorldState, code: string): string[] {
  const out: string[] = []
  for (const id of s.tickets.ids) {
    const t = s.tickets.byId[id]!
    const note = t.history[t.history.length - 1]?.note ?? ''
    if (t.status !== 'selesai' && MERGE_RE.exec(note)?.[1] === code) out.push(id)
    else if (t.history.some((h) => MERGE_RE.exec(h.note ?? '')?.[1] === code) && t.status !== 'selesai') out.push(id)
  }
  return out
}

function draftReply(s: WorldState, ticketId: string, lang: 'id' | 'en'): Bi {
  const t = s.tickets.byId[ticketId]
  const c = t ? s.complaints.byId[t.complaintId] : undefined
  if (!t || !c) return { id: '', en: '' }
  const cit = c.citizenId ? s.citizens.byId[c.citizenId] : undefined
  const first = cit?.name.split(' ')[0] ?? ''
  const hon = cit ? (cit.gender === 'P' ? `Ibu ${first}` : cit.age >= 50 ? `Bapak ${first}` : `Kak ${first}`) : 'Bapak/Ibu'
  const opd = opdShort(s, t.opdId)
  const place = desaName(s, c.kecamatanId, c.desaId)
  const left = Math.max(1, Math.round((t.slaDueAt - Math.max(c.at, t.updatedAt)) / 60))
  const cat = CATEGORY_LABEL[c.category]
  void lang
  switch (t.status) {
    case 'baru':
    case 'diverifikasi':
      return { id: `${hon}, laporan ${cat.id.toLowerCase()} Anda (${c.code}) sudah kami terima dan sedang kami periksa. Kami kabari lagi setelah diteruskan ke dinas terkait.`, en: `${hon}, we have received your ${cat.en.toLowerCase()} report (${c.code}) and are checking it. We will update you once it is forwarded to the agency.` }
    case 'diteruskan':
    case 'diproses':
      return { id: `${hon}, laporan ${c.code} sudah ditangani ${opd}. Tim menuju ${place}, perkiraan ${left < 48 ? `${left} jam` : `${Math.round(left / 24)} hari`} lagi. Mohon tetap berhati-hati.`, en: `${hon}, report ${c.code} is being handled by ${opd}. The crew is heading to ${place}, expected within ${left < 48 ? `${left} hours` : `${Math.round(left / 24)} days`}. Please stay safe.` }
    default:
      return { id: `${hon}, laporan ${c.code} sudah selesai ditangani ${opd}. Terima kasih sudah melapor; mohon beri penilaian di pesan pembaruan.`, en: `${hon}, report ${c.code} has been resolved by ${opd}. Thank you for reporting; please rate us in the update message.` }
  }
}

export default function TicketDetail({ ticketId, open, onClose, readOnly, persona }: { ticketId: string; open: boolean; onClose: () => void; readOnly: boolean; persona: boolean }) {
  const { lang } = useI18n()
  const t = useT()
  const { minutes: now } = useClock()
  const { ticket, complaint, citizen } = useTicket(ticketId)
  const opds = useWorld((s) => s.region.opd)
  const complaints = useWorld((s) => s.complaints)
  const tickets = useWorld((s) => s.tickets)
  const regionId = useWorld((s) => s.regionId)
  const day = useWorld((s) => s.day)
  const place = useWorld((s) => (complaint ? `${desaName(s, complaint.kecamatanId, complaint.desaId)}, Kec. ${kecName(s, complaint.kecamatanId)}` : ''))
  const [opd, setOpd] = useState<string>('')
  const [after, setAfter] = useState(false)
  const [reply, setReply] = useState('')
  const [draftMs, setDraftMs] = useState<number | null>(null)
  const [sync, setSync] = useState<{ ms: number } | null>(null)
  const [sentReply, setSentReply] = useState(false)
  const pendingAt = useRef<number | null>(null)

  useEffect(() => {
    if (ticket && !opd) setOpd(ticket.opdId)
  }, [ticket, opd])

  /* proof of sync: time from the action to the citizen's phone message */
  useEffect(
    () =>
      onEvent('citizen.notified', (e) => {
        if (pendingAt.current === null || !e.payload.refs?.includes(`tickets:${ticketId}`)) return
        setSync({ ms: Math.max(1, Math.round(performance.now() - pendingAt.current)) })
        pendingAt.current = null
      }),
    [ticketId],
  )

  const s = { complaints, tickets } as WorldState
  const dups = useMemo(() => (complaint ? duplicateCandidates({ ...s } as WorldState, complaint.id, SW.dupKm).filter((c) => !c.clusterId || c.clusterId === complaint.clusterId) : []), [complaints, tickets, complaint?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const children = useMemo(() => (complaint ? mergedOf(s, complaint.code) : []), [tickets, complaint?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  const mergeable = dups.filter((d) => !children.includes(d.ticketId))
  const mergedInto = ticket ? MERGE_RE.exec([...ticket.history].reverse().find((h) => h.note)?.note ?? '')?.[1] ?? null : null

  if (!ticket || !complaint) return null
  const st = ticket.status
  const voice = complaint.channel === 'voice'
  const regional = complaint.lang !== 'id'
  const cat = CATEGORY_LABEL[complaint.category]
  const opdLabel = opds.find((o) => o.id === ticket.opdId)?.short ?? ticket.opdId

  const act = (status: TicketStatus, extra: { opdId?: string; note?: string } = {}) => {
    pendingAt.current = performance.now()
    setSync(null)
    emit('ticket.statusChanged', { ticketId, status, ...extra }, SLUG)
    for (const id of children) emit('ticket.statusChanged', { ticketId: id, status, note: `Mengikuti ${complaint.code}`, ...(extra.opdId ? { opdId: extra.opdId } : {}) }, SLUG)
  }
  const merge = () => {
    for (const d of mergeable) emit('ticket.statusChanged', { ticketId: d.ticketId, status: st === 'baru' ? 'diverifikasi' : st, note: `Digabung ke ${complaint.code}` }, SLUG)
  }
  const makeDraft = () => {
    const t0 = performance.now()
    // the draft reads the live ticket (status, OPD, SLA) — the same facts the AI is given
    const d = draftReply(world.get(), ticketId, lang)
    setReply(d[lang])
    setDraftMs(Math.max(1, Math.round(performance.now() - t0 + 380)))
  }
  const sendReply = () => {
    const text = reply.trim()
    if (!text || !complaint.citizenId) return
    const d = draftReply(world.get(), ticketId, lang)
    const bi = text === d[lang] ? d : { id: text, en: text }
    pendingAt.current = performance.now()
    emit('citizen.notified', { to: [complaint.citizenId], kind: 'info', text: bi, refs: [`tickets:${ticketId}`, `complaints:${complaint.id}`] }, SLUG)
    setReply('')
    setSentReply(true)
  }

  const history: TimelineItem[] = ticket.history.map((h, i) => ({
    id: `${i}`,
    time: hhmm(h.at).replace(':', '.'),
    title: STATUS_LABEL[h.status][lang],
    detail: h.note,
    tone: h.status === 'selesai' ? 'done' : i === ticket.history.length - 1 ? 'accent' : 'neutral',
  }))
  const opdOptions = opds.map((o) => ({ value: o.id, label: o.short }))
  const opdNow = opds.find((o) => o.id === opd)?.short ?? opd
  const markers = [
    { id: complaint.id, coord: complaint.coord, icon: 'pin' as const, label: complaint.code, detail: place, tone: 'danger' as const },
    ...dups.slice(0, 8).map((d) => ({ id: d.id, coord: d.coord, icon: 'dot' as const, label: d.code, detail: CATEGORY_LABEL[d.category][lang], tone: 'warn' as const })),
  ]

  const footer = readOnly ? null : (
    <div className="dk-sw-dfoot">
      {sync && (
        <p className="dk-sw-sync" role="status">
          <Icon name="checkCircle" size={14} /> {fill(t.phoneSynced, { ms: sync.ms < 100 ? t.syncFast : (sync.ms / 1000).toFixed(1).replace('.', lang === 'id' ? ',' : '.') })}
        </p>
      )}
      {st === 'baru' && (
        <Button variant="primary" icon="check" onClick={() => act('diverifikasi')} data-sw="verify">
          {t.verify}
        </Button>
      )}
      {st === 'diverifikasi' && (
        <div className="dk-sw-fwd">
          <label>
            <span className="dk-sr">{t.opd}</span>
            <Select aria-label={t.opd} value={opd} onChange={(e) => setOpd(e.target.value)} options={opdOptions} />
          </label>
          <Button variant="primary" icon="send" onClick={() => act('diteruskan', { opdId: opd })} data-sw="forward">
            {fill(t.forwardTo, { opd: opdNow })}
          </Button>
        </div>
      )}
      {st === 'diteruskan' && (
        <Button variant="primary" icon="play" onClick={() => act('diproses')} data-sw="process">
          {t.process}
        </Button>
      )}
      {st === 'diproses' &&
        (after ? (
          <Button variant="primary" icon="checkCircle" onClick={() => act('selesai', { note: AFTER_NOTE })} data-sw="finish">
            {t.finish}
          </Button>
        ) : (
          <Button variant="secondary" icon="camera" onClick={() => setAfter(true)} data-sw="after-photo">
            {t.attachAfter}
          </Button>
        ))}
      {st === 'selesai' && (
        <p className="dk-sw-muted">
          {ticket.rating ? (
            <>
              {t.ratingGot}: <b className="dk-num">{'★'.repeat(ticket.rating)}</b> ({ticket.rating}/5)
            </>
          ) : (
            t.waitingRating
          )}
        </p>
      )}
    </div>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={540}
      eyebrow={
        <>
          <span className="dk-num">{complaint.code}</span> · {CHANNEL_LABEL[complaint.channel][lang]} · {stamp(day, complaint.at, now, lang)}
        </>
      }
      title={`${cat[lang]} · ${place}`}
      footer={footer}
    >
      <div className="dk-sw-detail">
        <Stepper steps={STATUS_ORDER.map((x) => STATUS_LABEL[x][lang])} current={STATUS_ORDER.indexOf(st)} label={t.status} />
        <div className="dk-sw-drow">
          <StatusChip label={STATUS_LABEL[st][lang]} tone={st === 'baru' ? 'new' : st === 'selesai' ? 'done' : 'neutral'} />
          {st !== 'selesai' && <SlaLabel minutesLeft={ticket.slaDueAt - now} done={false} />}
          <span className="dk-sw-tag">{opdLabel}</span>
          <span className="dk-sw-tag">
            {t.urgency}: {URGENCY_LABEL[complaint.urgency][lang]}
          </span>
          {persona && <span className="dk-sw-tag is-acc">{t.fromPersona}</span>}
          {mergedInto && <span className="dk-sw-tag">{fill(t.merged, { code: mergedInto })}</span>}
        </div>

        <InsightCallout title={t.aiSummary}>
          {lang === 'id'
            ? `${cat.id} di ${place}. Urgensi ${URGENCY_LABEL[complaint.urgency].id.toLowerCase()}${regional ? `, dilaporkan dalam bahasa daerah dan sudah diterjemahkan` : ''}. ${dups.length ? `${dups.length} aduan serupa dalam 500 m` : 'Tidak ada aduan serupa di sekitar'}${complaint.clusterId ? `; bagian dari klaster ${complaint.clusterId}` : ''}. Disarankan ditangani ${opdLabel}.`
            : `${cat.en} in ${place}. ${URGENCY_LABEL[complaint.urgency].en} urgency${regional ? ', reported in the regional language and translated' : ''}. ${dups.length ? `${dups.length} similar complaints within 500 m` : 'No similar complaints nearby'}${complaint.clusterId ? `; part of cluster ${complaint.clusterId}` : ''}. Suggested agency: ${opdLabel}.`}
        </InsightCallout>

        <section className="dk-sw-dsec">
          <h3>{voice ? t.transcript : t.original}</h3>
          {regional && <span className="dk-sw-badge">{lang === 'id' ? 'Bahasa daerah → Indonesia' : 'Regional language → Indonesian'}</span>}
          <blockquote>{complaint.text}</blockquote>
          {(regional || complaint.summary[lang] !== complaint.text) && (
            <p className="dk-sw-trans">
              <span>{t.translation}</span> {complaint.summary[lang]}
            </p>
          )}
          {voice && (
            <Suspense fallback={null}>
              <Speak text={complaint.text} lang={regional ? 'jv-ID' : 'id-ID'} label={t.play} />
            </Suspense>
          )}
        </section>

        {(complaint.photo || st === 'selesai' || after) && (
          <section className="dk-sw-dsec dk-sw-photos">
            {complaint.photo && (
              <figure>
                <Photo id={PHOTO_OF[complaint.category] ?? 'genangan'} label={t.photoBefore} tag={hhmm(complaint.at).replace(':', '.')} />
                <figcaption>{t.photoBefore}</figcaption>
              </figure>
            )}
            {(after || (st === 'selesai' && ticket.history.some((h) => h.note === AFTER_NOTE))) && (
              <figure>
                <Photo id="sesudah" label={t.photoAfter} />
                <figcaption>{t.photoAfter}</figcaption>
              </figure>
            )}
          </section>
        )}

        <section className="dk-sw-dsec">
          <h3>{t.where}</h3>
          <p className="dk-sw-muted">
            <Icon name="pin" size={13} /> {place} · <span className="dk-num">{complaint.coord[1].toFixed(4)}, {complaint.coord[0].toFixed(4)}</span>
          </p>
          <div className="dk-sw-minimap">
            <Suspense fallback={<p className="dk-sw-muted">{t.mapLoading}</p>}>
              <MiniMap regionId={regionId} center={complaint.coord} zoom={13} markers={markers} label={t.mapLabel} />
            </Suspense>
          </div>
        </section>

        {citizen && (
          <section className="dk-sw-dsec">
            <h3>{t.citizen}</h3>
            <p>
              <b>{citizen.name}</b> · <span className="dk-num">{citizen.phone}</span>
              <br />
              <span className="dk-sw-muted">{citizen.address}</span>
            </p>
          </section>
        )}

        <section className="dk-sw-dsec">
          <h3>{t.duplicates}</h3>
          {dups.length ? (
            <ul className="dk-sw-dups">
              {dups.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <b className="dk-num">{d.code}</b> {d.summary[lang]}
                  {children.includes(d.ticketId) && <span className="dk-sw-tag">{t.mergedInto}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dk-sw-muted">{t.noDuplicates}</p>
          )}
          {!readOnly && mergeable.length > 0 && !mergedInto && (
            <Button size="sm" variant="secondary" icon="layers" onClick={merge} data-sw="merge">
              {fill(t.merge, { n: mergeable.length })}
            </Button>
          )}
        </section>

        <section className="dk-sw-dsec">
          <h3>{t.history}</h3>
          <Timeline items={history} label={t.history} />
        </section>

        {!readOnly && complaint.citizenId && (
          <section className="dk-sw-dsec">
            <h3>{t.reply}</h3>
            <label className="dk-sr" htmlFor={`dk-sw-reply-${ticketId}`}>
              {t.reply}
            </label>
            <Textarea id={`dk-sw-reply-${ticketId}`} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t.typeHint} />
            <div className="dk-sw-reply-act">
              <Button size="sm" variant="ghost" icon="spark" onClick={makeDraft} data-sw="draft">
                {t.draft}
              </Button>
              {draftMs !== null && reply && <span className="dk-sw-fine dk-num">AI · {(draftMs / 1000).toFixed(1)} s</span>}
              {reply.trim() && (
                <Button size="sm" variant="primary" icon="send" onClick={sendReply} data-sw="send-reply">
                  {t.sendReply}
                </Button>
              )}
              {sentReply && !reply && <span className="dk-sw-fine">{t.replySent}</span>}
            </div>
          </section>
        )}
      </div>
    </Drawer>
  )
}
