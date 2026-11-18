/**
 * OpdTasks (lazy, role "Kepala OPD") — the right-hand panel as an agency head sees it: the tasks addressed to the
 * chosen agency (leader instructions first), each movable baru → proses → selesai (`actionItem.statusChanged`,
 * the same event Naskah Pintar's board uses), and the leader's latest briefing read-only underneath.
 */
import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { Button, Icon, StatusChip, formatSla, type IconName } from '../../demo-kit/ui'
import { CATEGORY_LABEL, DAY_MIN, emit, hhmm, rows, useWorld, world, type ActionItem, type Minutes, type WorldState } from '../../demo-kit/world'
import { kecName, useNow } from './data'

const O = {
  title: { id: 'Tugas untuk {o}', en: 'Tasks for {o}' },
  none: { id: 'Belum ada tugas untuk OPD ini.', en: 'No tasks for this agency yet.' },
  fromLeader: { id: 'Instruksi pimpinan', en: "Leader's instruction" },
  fromMeeting: { id: 'Hasil rapat', en: 'Meeting outcome' },
  other: { id: 'Tindak lanjut', en: 'Follow-up' },
  start: { id: 'Mulai kerjakan', en: 'Start' },
  finish: { id: 'Tandai selesai', en: 'Mark done' },
  late: { id: 'Terlambat', en: 'Late' },
  baru: { id: 'Baru', en: 'New' },
  proses: { id: 'Diproses', en: 'In progress' },
  selesai: { id: 'Selesai', en: 'Done' },
  due: { id: 'tenggat', en: 'due' },
  brief: { id: 'Briefing pimpinan terakhir', en: "Leader's latest briefing" },
  noBrief: { id: 'Pimpinan belum menyusun briefing hari ini.', en: 'The leader has not composed a briefing today.' },
  tickets: { id: 'Tiket terbuka, SLA terdekat dulu', en: 'Open tickets, nearest SLA first' },
  noTickets: { id: 'Tidak ada tiket terbuka.', en: 'No open tickets.' },
  more: { id: '+{n} tiket lain', en: '+{n} more tickets' },
}

const world0 = () => world.get()
const latest = (s: WorldState) => rows(s.briefings).find((b) => b.at >= 0) ?? null

export default function OpdTasks({ opdId }: { opdId: string }) {
  const { lang } = useI18n()
  const now = useNow(5)
  const items = useWorld((s) => s.actionItems)
  const ticketsT = useWorld((s) => s.tickets)
  const complaints = useWorld((s) => s.complaints)
  const open = useMemo(() => rows(ticketsT).filter((t) => t.opdId === opdId && t.status !== 'selesai').sort((a, b) => a.slaDueAt - b.slaDueAt), [ticketsT, opdId])
  const short = useWorld((s) => s.region.opd.find((o) => o.id === opdId)?.short ?? opdId)
  const b = useWorld(latest)
  const list = useMemo(() => {
    const rank = (a: ActionItem) => (a.status === 'selesai' ? 3 : a.source.kind === 'instruction' ? 0 : a.dueAt < now ? 1 : 2)
    return rows(items).filter((a) => a.opdId === opdId).sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt).slice(0, 20)
  }, [items, opdId, now])
  const move = (a: ActionItem) => emit('actionItem.statusChanged', { actionItemId: a.id, status: a.status === 'baru' ? 'proses' : 'selesai' }, 'meja-pimpinan')
  const due = (m: Minutes) => {
    const d = Math.floor(m / DAY_MIN) - Math.floor(now / DAY_MIN)
    return d === 0 ? hhmm(m) : d < 0 ? (lang === 'id' ? `${-d} hari lalu` : `${-d} days ago`) : lang === 'id' ? `${d} hari lagi` : `in ${d} days`
  }
  return (
    <section className="dk-mp-panel dk-mp-tasks" aria-labelledby="dk-mp-tasks-h">
      <header className="dk-mp-ph">
        <h3 id="dk-mp-tasks-h">
          <Icon name="kanban" size={16} />
          {O.title[lang].replace('{o}', short)}
        </h3>
      </header>
      <div className="dk-mp-pb">
        {list.length ? (
          <ul className="dk-mp-task-list" aria-live="polite">
            {list.map((a) => {
              const late = a.status !== 'selesai' && a.dueAt < now
              return (
                <li key={a.id} className={a.source.kind === 'instruction' ? 'is-ins' : ''}>
                  <p className="dk-mp-task-k">
                    <Icon name={a.source.kind === 'instruction' ? 'send' : a.source.kind === 'meeting' ? 'mic' : 'doc'} size={12} />
                    {a.source.kind === 'instruction' ? O.fromLeader[lang] : a.source.kind === 'meeting' ? O.fromMeeting[lang] : O.other[lang]}
                    <span className="dk-num">
                      · {O.due[lang]} {due(a.dueAt)}
                    </span>
                  </p>
                  <p className="dk-mp-task-t">{a.title[lang]}</p>
                  <div className="dk-mp-task-a">
                    <StatusChip tone={late ? 'danger' : a.status === 'selesai' ? 'done' : a.status === 'proses' ? 'warn' : 'new'} label={late ? O.late[lang] : O[a.status][lang]} />
                    {a.status !== 'selesai' && (
                      <Button size="sm" variant={a.status === 'baru' ? 'secondary' : 'primary'} onClick={() => move(a)}>
                        {a.status === 'baru' ? O.start[lang] : O.finish[lang]}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-mp-meta">{O.none[lang]}</p>
        )}
        <h4 className="dk-mp-sc-h">
          {O.tickets[lang]} <span className="dk-mp-meta">{open.length}</span>
        </h4>
        {open.length ? (
          <ul className="dk-mp-sc-list">
            {open.slice(0, 6).map((t) => {
              const c = complaints.byId[t.complaintId]
              const sl = formatSla(t.slaDueAt - now, lang)
              return (
                <li key={t.id}>
                  <span className="dk-mp-sc-code dk-num">{t.code}</span>
                  <span className="dk-mp-sc-t">{c ? `${CATEGORY_LABEL[c.category][lang]} · ${kecName(world0(), c.kecamatanId)}` : ''}</span>
                  <span className={`dk-mp-sla is-${sl.tone}`}>{sl.text}</span>
                </li>
              )
            })}
            {open.length > 6 && <li className="dk-mp-meta">{O.more[lang].replace('{n}', String(open.length - 6))}</li>}
          </ul>
        ) : (
          <p className="dk-mp-meta">{O.noTickets[lang]}</p>
        )}
        <h4 className="dk-mp-sc-h">{O.brief[lang]}</h4>
        {b ? (
          <ol className="dk-mp-blist">
            {b.items.map((it, i) => (
              <li key={i}>
                {it.title[lang]}{' '}
                <span className="dk-mp-meta">
                  · <Icon name={PRODUCT_BY_SLUG[it.source].icon as IconName} size={11} /> {PRODUCT_BY_SLUG[it.source].name}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dk-mp-meta">{O.noBrief[lang]}</p>
        )}
      </div>
    </section>
  )
}
