/** 03 · Ticket inbox — ruled table (cards under 640 px), density toggle, live "new ticket" insert. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { NEW_TICKET, STATUS_LABEL, TICKETS, type TicketRow, type TicketStatus } from '../sample'
import { IconPlus, IconReplay, IconRowsComfort, IconRowsCompact } from './icons'
import { LDE, fmt, motionMode } from './lde'
import { RuleToggle } from './parts'

const STEPS: TicketStatus[] = ['baru', 'verifikasi', 'opd', 'proses', 'selesai']
const CHANNEL: Record<TicketRow['channel'], { id: string; en: string }> = {
  WA: { id: 'WhatsApp', en: 'WhatsApp' },
  Web: { id: 'Web', en: 'Web' },
  Telepon: { id: 'Telepon', en: 'Phone' },
}

const C = {
  caption: { id: 'Kotak masuk aduan warga', en: 'Citizen complaint inbox' },
  open: { id: 'tiket terbuka', en: 'open tickets' },
  late: { id: 'lewat SLA', en: 'past SLA' },
  density: { id: 'Kepadatan baris', en: 'Row density' },
  comfy: { id: 'Nyaman', en: 'Comfortable' },
  compact: { id: 'Padat', en: 'Compact' },
  simulate: { id: 'Simulasikan tiket baru', en: 'Simulate new ticket' },
  again: { id: 'Ulangi simulasi', en: 'Run simulation again' },
  cols: {
    id: { id: 'Tiket', en: 'Ticket' },
    cat: { id: 'Kategori', en: 'Category' },
    kec: { id: 'Kecamatan', en: 'District' },
    opd: { id: 'OPD tujuan', en: 'Agency' },
    status: { id: 'Status', en: 'Status' },
    sla: { id: 'SLA', en: 'SLA' },
  },
  announce: { id: 'Tiket baru masuk', en: 'New ticket received' },
  step: { id: 'tahap', en: 'step' },
}

function sla(lang: Lang, t: TicketRow): { text: string; tone: 'done' | 'late' | 'soon' | 'ok' } {
  const h = lang === 'id' ? 'j' : 'h'
  if (t.status === 'selesai') return { text: lang === 'id' ? 'Tuntas' : 'Met', tone: 'done' }
  if (t.slaHours < 0) return { text: lang === 'id' ? `Lewat ${-t.slaHours} ${h}` : `${-t.slaHours} ${h} late`, tone: 'late' }
  const text = lang === 'id' ? `${t.slaHours} ${h} lagi` : `${t.slaHours} ${h} left`
  return { text, tone: t.slaHours <= 8 ? 'soon' : 'ok' }
}

function Status({ s, lang }: { s: TicketStatus; lang: Lang }) {
  const idx = STEPS.indexOf(s)
  return (
    <span className={`lde-status lde-status-${s}`}>
      <span className="lde-pips" aria-hidden="true">
        {STEPS.map((p, i) => (
          <span key={p} className={i <= idx ? 'is-on' : undefined} />
        ))}
      </span>
      <span className="lde-status-text">{STATUS_LABEL[s][lang]}</span>
      <span className="lde-sr">
        {' '}
        ({C.step[lang]} {idx + 1}/5)
      </span>
    </span>
  )
}

export default function Tickets() {
  const { lang } = useI18n()
  const [rows, setRows] = useState<TicketRow[]>(TICKETS)
  const [density, setDensity] = useState<'comfy' | 'compact'>('comfy')
  const [fresh, setFresh] = useState(0)
  const [announce, setAnnounce] = useState('')
  const tbody = useRef<HTMLTableSectionElement>(null)
  const inserted = rows[0]?.id === NEW_TICKET.id

  const timer = useRef<gsap.core.Tween | null>(null)
  useEffect(() => () => void timer.current?.kill(), [])

  const insert = () => {
    setRows([NEW_TICKET, ...TICKETS])
    setFresh((n) => n + 1)
    setAnnounce(`${C.announce[lang]}: ${NEW_TICKET.id}, ${NEW_TICKET.category[lang]}, ${NEW_TICKET.kecamatan}, ${NEW_TICKET.opd}.`)
  }
  const simulate = () => {
    timer.current?.kill()
    setAnnounce('')
    if (inserted) {
      // Replay: take the ticket out, then put it back a moment later so the entrance plays again.
      setRows(TICKETS)
      timer.current = gsap.delayedCall(0.08, insert)
    } else insert()
  }

  // Entrance of the inserted row: slide from 8 px above + accent wash (overlay opacity) fading over 1.5 s.
  useLayoutEffect(() => {
    if (!fresh) return
    const row = tbody.current?.querySelector<HTMLElement>(`[data-row="${NEW_TICKET.id}"]`)
    if (!row) return
    const flash = row.querySelector('.lde-row-flash')
    const mode = motionMode()
    const ctx = gsap.context(() => {
      if (mode === 'full') {
        gsap.fromTo(row, { y: -LDE.slideY, opacity: 0 }, { y: 0, opacity: 1, duration: LDE.panel, ease: EASE.out, clearProps: 'transform' })
        gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: LDE.highlight, ease: 'power1.in', delay: 0.2 })
      } else {
        gsap.fromTo(row, { opacity: 0 }, { opacity: 1, duration: LDE.fade })
        gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: LDE.fade, delay: LDE.highlight - LDE.fade })
      }
    })
    return () => ctx.revert()
  }, [fresh])

  const open = rows.filter((r) => r.status !== 'selesai').length
  const late = rows.filter((r) => r.status !== 'selesai' && r.slaHours < 0).length

  return (
    <div className="lde-inbox">
      <div className="lde-bar">
        <p className="lde-bar-stats">
          <span className="lde-bar-n">{fmt(lang, open)}</span> {C.open[lang]}
          <span className="lde-bar-sep" aria-hidden="true" />
          <span className="lde-bar-n lde-tone-danger">{fmt(lang, late)}</span> {C.late[lang]}
        </p>
        <div className="lde-bar-actions">
          <RuleToggle
            label={C.density[lang]}
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfy', label: C.comfy[lang], icon: <IconRowsComfort /> },
              { value: 'compact', label: C.compact[lang], icon: <IconRowsCompact /> },
            ]}
          />
          <button type="button" className="lde-btn lde-btn-primary" onClick={simulate}>
            {inserted ? <IconReplay /> : <IconPlus />}
            {inserted ? C.again[lang] : C.simulate[lang]}
          </button>
        </div>
      </div>

      <div className="lde-table-wrap">
        <table className={`lde-table lde-d-${density}`}>
          <caption className="lde-sr">{C.caption[lang]}</caption>
          <thead>
            <tr>
              <th scope="col">{C.cols.id[lang]}</th>
              <th scope="col">{C.cols.cat[lang]}</th>
              <th scope="col">{C.cols.kec[lang]}</th>
              <th scope="col">{C.cols.opd[lang]}</th>
              <th scope="col">{C.cols.status[lang]}</th>
              <th scope="col" className="lde-th-r">
                {C.cols.sla[lang]}
              </th>
            </tr>
          </thead>
          <tbody ref={tbody}>
            {rows.map((t) => {
              const s = sla(lang, t)
              return (
                <tr key={t.id} data-row={t.id} className={t.id === NEW_TICKET.id ? 'is-new' : undefined}>
                  <td className="lde-c-id">
                    <span className="lde-row-hover" aria-hidden="true" />
                    <span className="lde-row-flash" aria-hidden="true" />
                    <span className="lde-row-acc" aria-hidden="true" />
                    <span className="lde-num">{t.id}</span>
                  </td>
                  <td className="lde-c-cat">
                    <span className="lde-cat">{t.category[lang]}</span>
                    <span className="lde-chan">{CHANNEL[t.channel][lang]}</span>
                  </td>
                  <td className="lde-c-kec">{t.kecamatan}</td>
                  <td className="lde-c-opd">{t.opd}</td>
                  <td className="lde-c-status">
                    <Status s={t.status} lang={lang} />
                  </td>
                  <td className={`lde-c-sla lde-sla-${s.tone}`}>
                    {s.tone === 'late' && <span className="lde-sla-dot" aria-hidden="true" />}
                    <span className="lde-num">{s.text}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="lde-sr" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}
