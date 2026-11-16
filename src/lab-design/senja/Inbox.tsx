/** 03 · Ticket inbox — density toggle, live insert (slide 8 px + 12 % accent flash over 1.5 s), cards < 640 px. */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { NEW_TICKET, STATUS_LABEL, TICKETS, type TicketRow } from '../sample'
import { Icon, type IconName } from './icons'
import { SJ, motionMode, useGsapContext, useOnScreen } from './shared'

const C = {
  id: {
    title: 'Kotak masuk aduan',
    live: 'Langsung',
    tickets: 'tiket',
    late: 'melewati SLA',
    density: 'Kepadatan baris',
    comfort: 'Nyaman',
    compact: 'Padat',
    simulate: 'Simulasikan tiket baru',
    caption: 'Daftar tiket aduan warga, terbaru di atas',
    cols: ['Tiket', 'Kanal', 'Kategori', 'Kecamatan', 'OPD', 'Status', 'SLA'],
    left: 'j lagi',
    lateBy: 'Terlambat',
    h: 'j',
    done: 'Tuntas',
    announce: 'Tiket baru masuk',
    phone: 'Telepon',
    pipeline: 'Alur tiket',
    feed: 'Aktivitas terbaru',
    evNew: (id: string, kec: string) => <><b>{id}</b> masuk lewat WhatsApp · {kec}</>,
    evLate: (id: string, h: number, opd: string) => <><b>{id}</b> melewati SLA {h} j · {opd}</>,
    evDone: (id: string, opd: string) => <><b>{id}</b> diselesaikan {opd}</>,
    evFwd: (id: string, opd: string) => <><b>{id}</b> diteruskan ke {opd}</>,
  },
  en: {
    title: 'Complaints inbox',
    live: 'Live',
    tickets: 'tickets',
    late: 'past SLA',
    density: 'Row density',
    comfort: 'Comfortable',
    compact: 'Compact',
    simulate: 'Simulate new ticket',
    caption: 'Citizen complaint tickets, newest first',
    cols: ['Ticket', 'Channel', 'Category', 'District', 'Agency', 'Status', 'SLA'],
    left: 'h left',
    lateBy: 'Late',
    h: 'h',
    done: 'Closed',
    announce: 'New ticket received',
    phone: 'Phone',
    pipeline: 'Ticket flow',
    feed: 'Recent activity',
    evNew: (id: string, kec: string) => <><b>{id}</b> arrived via WhatsApp · {kec}</>,
    evLate: (id: string, h: number, opd: string) => <><b>{id}</b> breached SLA by {h} h · {opd}</>,
    evDone: (id: string, opd: string) => <><b>{id}</b> resolved by {opd}</>,
    evFwd: (id: string, opd: string) => <><b>{id}</b> sent to {opd}</>,
  },
} as const

const SORTED = [...TICKETS].sort((a, b) => b.id.localeCompare(a.id))
const CHANNEL_ICON: Record<TicketRow['channel'], IconName> = { WA: 'chat', Web: 'globe', Telepon: 'phone' }

function slaView(r: TicketRow, lang: Lang): { tone: 'ok' | 'warn' | 'late' | 'done'; text: string } {
  const c = C[lang]
  if (r.status === 'selesai') return { tone: 'done', text: c.done }
  if (r.slaHours < 0) return { tone: 'late', text: `${c.lateBy} ${Math.abs(r.slaHours)} ${c.h}` }
  return { tone: r.slaHours <= 8 ? 'warn' : 'ok', text: `${r.slaHours} ${c.left}` }
}

const STATUSES: TicketRow['status'][] = ['baru', 'verifikasi', 'opd', 'proses', 'selesai']

/** Activity feed derived from the sample rows (no invented data). */
function events(rows: TicketRow[], lang: Lang): { key: string; tone: string; icon: IconName; node: ReactNode; isNew?: boolean }[] {
  const c = C[lang]
  const out: { key: string; tone: string; icon: IconName; node: ReactNode; isNew?: boolean }[] = []
  const nw = rows.find((r) => r.id === NEW_TICKET.id)
  if (nw) out.push({ key: 'new', tone: 'baru', icon: 'chat', node: c.evNew(nw.id, nw.kecamatan), isNew: true })
  const late = rows.find((r) => r.status !== 'selesai' && r.slaHours < 0)
  if (late) out.push({ key: 'late', tone: 'late', icon: 'clock', node: c.evLate(late.id, Math.abs(late.slaHours), late.opd) })
  const done = rows.find((r) => r.status === 'selesai')
  if (done) out.push({ key: 'done', tone: 'selesai', icon: 'check', node: c.evDone(done.id, done.opd) })
  const fwd = rows.find((r) => r.status === 'opd')
  if (fwd) out.push({ key: 'fwd', tone: 'opd', icon: 'route', node: c.evFwd(fwd.id, fwd.opd) })
  return out.slice(0, 4)
}

interface Props {
  newKey: number
  busy: boolean
  onSimulate: () => void
  targetRef: RefObject<HTMLTableSectionElement | null>
}

export default function Inbox({ newKey, busy, onSimulate, targetRef }: Props) {
  const { lang } = useI18n()
  const c = C[lang]
  const [density, setDensity] = useState<'comfort' | 'compact'>('comfort')
  const ref = useRef<HTMLDivElement>(null)
  const ctx = useGsapContext(ref)
  const mode = motionMode()
  const pulse = useRef<gsap.core.Tween | null>(null)
  const rows = newKey > 0 ? [NEW_TICKET, ...SORTED] : SORTED
  const lateCount = rows.filter((r) => r.status !== 'selesai' && r.slaHours < 0).length
  const firstRun = useRef(true)

  // Live dot: a soft teal ring, looping only while on screen (full motion only).
  useLayoutEffect(() => {
    if (mode !== 'full') return
    ctx.current?.add(() => {
      pulse.current = gsap.fromTo(
        ref.current?.querySelector('.lds-live-ring') ?? [],
        { scale: 1, opacity: 0.7 },
        { scale: 2.6, opacity: 0, duration: 1.6, ease: 'power1.out', repeat: -1, paused: true },
      )
    })
  }, [ctx, mode])
  useOnScreen(ref, (v) => {
    if (v) pulse.current?.play()
    else pulse.current?.pause()
  })

  // New row: slide from 8 px above + 12 % accent overlay fading over 1.5 s.
  useLayoutEffect(() => {
    const initial = firstRun.current
    firstRun.current = false
    if (newKey === 0 || (initial && mode === 'static')) return
    ctx.current?.add(() => {
      const row = ref.current?.querySelector('tr[data-new]')
      if (!row) return
      const flash = row.querySelectorAll('.lds-flash')
      const ev = ref.current?.querySelector('.lds-feed li[data-new]')
      if (ev) gsap.from(ev, { opacity: 0, y: mode === 'full' ? -6 : 0, duration: mode === 'full' ? SJ.panel : SJ.fade, delay: mode === 'full' ? 0.2 : 0 })
      if (mode === 'full') {
        gsap.fromTo(row, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: SJ.panel, ease: EASE.out, clearProps: 'transform' })
        gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: SJ.flash, ease: 'power1.in', delay: 0.15 })
      } else {
        gsap.fromTo(row, { opacity: 0 }, { opacity: 1, duration: SJ.fade })
        gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: SJ.fade, delay: SJ.flash })
      }
    })
  }, [newKey, ctx, mode])

  return (
    <div className="lds-inbox" ref={ref}>
      <div className="lds-inbox-bar">
        <div className="lds-inbox-titles">
          <div className="lds-inbox-tline">
            <span className="lds-icon-chip" aria-hidden="true">
              <Icon name="inbox" size={18} />
            </span>
            <h3 className="lds-h3">{c.title}</h3>
            <span className="lds-live">
              <span className="lds-live-dot" aria-hidden="true">
                <span className="lds-live-ring" />
              </span>
              {c.live}
            </span>
          </div>
          <p className="lds-inbox-meta">
            <b>{rows.length}</b> {c.tickets} · <b className="is-late">{lateCount}</b> {c.late}
          </p>
        </div>
        <div className="lds-inbox-actions">
          <div className="lds-seg" role="group" aria-label={c.density}>
            <button type="button" className="lds-seg-btn" aria-pressed={density === 'comfort'} onClick={() => setDensity('comfort')}>
              <Icon name="rowsComfort" size={16} />
              <span>{c.comfort}</span>
            </button>
            <button type="button" className="lds-seg-btn" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>
              <Icon name="rowsCompact" size={16} />
              <span>{c.compact}</span>
            </button>
          </div>
          <button type="button" className="lds-btn is-primary" onClick={onSimulate} aria-disabled={busy}>
            <Icon name="plus" size={16} />
            {c.simulate}
          </button>
        </div>
      </div>
      <div className="lds-table-wrap">
        <table className="lds-table" data-density={density}>
          <caption className="lds-sr">{c.caption}</caption>
          <thead>
            <tr>
              {c.cols.map((h, i) => (
                <th key={h} scope="col" className={i === 6 ? 'is-end' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={targetRef}>
            {rows.map((r) => {
              const isNew = r.id === NEW_TICKET.id
              const sla = slaView(r, lang)
              const flash = isNew ? <span className="lds-flash" aria-hidden="true" /> : null
              return (
                <tr key={isNew ? `${r.id}-${newKey}` : r.id} data-new={isNew ? '' : undefined}>
                  <td className="lds-td-id" data-label={c.cols[0]}>
                    {flash}
                    <span className="lds-tid">{r.id}</span>
                  </td>
                  <td className="lds-td-ch" data-label={c.cols[1]}>
                    {flash}
                    <span className="lds-ch">
                      <Icon name={CHANNEL_ICON[r.channel]} size={16} />
                      {r.channel === 'Telepon' ? c.phone : r.channel === 'WA' ? 'WhatsApp' : 'Web'}
                    </span>
                  </td>
                  <td className="lds-td-cat" data-label={c.cols[2]}>
                    {flash}
                    {r.category[lang]}
                  </td>
                  <td className="lds-td-kec" data-label={c.cols[3]}>
                    {flash}
                    {r.kecamatan}
                  </td>
                  <td className="lds-td-opd" data-label={c.cols[4]}>
                    {flash}
                    {r.opd}
                  </td>
                  <td className="lds-td-st" data-label={c.cols[5]}>
                    {flash}
                    <span className={`lds-status is-${r.status}`}>
                      <i aria-hidden="true" />
                      {STATUS_LABEL[r.status][lang]}
                    </span>
                  </td>
                  <td className="lds-td-sla is-end" data-label={c.cols[6]}>
                    {flash}
                    <span className={`lds-sla is-${sla.tone}`}>
                      <Icon name={sla.tone === 'done' ? 'check' : 'clock'} size={14} />
                      {sla.text}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="lds-inbox-foot">
        <div className="lds-pipe">
          <p className="lds-label">{c.pipeline}</p>
          <div className="lds-pipe-bar" aria-hidden="true">
            {STATUSES.map((st) => {
              const n = rows.filter((r) => r.status === st).length
              return n ? <span key={st} className={`lds-st-${st}`} style={{ flexGrow: n }} /> : null
            })}
          </div>
          <ul className="lds-pipe-legend">
            {STATUSES.map((st) => (
              <li key={st} className={`lds-st-${st}`}>
                <i aria-hidden="true" />
                {STATUS_LABEL[st][lang]} <b>{rows.filter((r) => r.status === st).length}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="lds-feed">
          <p className="lds-label">{c.feed}</p>
          <ol>
            {events(rows, lang).map((e) => (
              <li key={e.key + (e.isNew ? newKey : '')} data-new={e.isNew ? '' : undefined} className={e.tone === 'late' ? 'is-late' : `lds-st-${e.tone}`}>
                <span className="lds-feed-ic" aria-hidden="true">
                  <Icon name={e.icon} size={14} />
                </span>
                <span>{e.node}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="lds-sr" aria-live="polite">
        {newKey > 0 && !(mode === 'static' && newKey === 1) ? `${c.announce}: ${NEW_TICKET.id}, ${NEW_TICKET.category[lang]}, ${NEW_TICKET.kecamatan}` : ''}
      </p>
    </div>
  )
}
