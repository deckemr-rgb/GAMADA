/**
 * Scorecard (lazy drawer) — one agency's 30-day scorecard (spec P2 step 4): composite score and rank, daily on-time
 * SLA trend, open tickets with their SLA clock, and the agency's follow-up tasks (late ones first). From here the
 * leader can instruct the agency directly.
 */
import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { Button, Drawer, Icon, StatusChip, formatSla } from '../../demo-kit/ui'
import { LineChart } from '../../demo-kit/viz'
import { CATEGORY_LABEL, DAY_MIN, hhmm, useSession, useWorld, world, type Minutes } from '../../demo-kit/world'
import { opdLeaderboard, opdScorecard } from '../../demo-kit/world/satu-daerah'
import { kecName, withControls } from './data'

const C = {
  eyebrow: { id: 'Scorecard OPD · 30 hari', en: 'Agency scorecard · 30 days' },
  score: { id: 'Skor', en: 'Score' },
  rank: { id: 'Peringkat', en: 'Rank' },
  sla: { id: 'SLA tepat waktu', en: 'SLA on time' },
  rating: { id: 'Kepuasan', en: 'Satisfaction' },
  closed: { id: 'tiket selesai 30 hari', en: 'tickets closed in 30 days' },
  trend: { id: 'SLA tepat waktu per hari', en: 'On-time SLA per day' },
  noTrend: { id: 'Belum ada tiket selesai dalam 30 hari, jadi tren SLA belum bisa digambar.', en: 'No tickets closed in 30 days yet, so there is no SLA trend to draw.' },
  trendUnit: { id: '% tiket selesai tepat waktu (hari tanpa penutupan memakai nilai terdekat)', en: '% closed on time (days without closures carry the nearest value)' },
  open: { id: 'Tiket terbuka', en: 'Open tickets' },
  noOpen: { id: 'Tidak ada tiket terbuka.', en: 'No open tickets.' },
  tasks: { id: 'Tindak lanjut', en: 'Follow-ups' },
  noTasks: { id: 'Tidak ada tindak lanjut.', en: 'No follow-ups.' },
  late: { id: 'Terlambat', en: 'Late' },
  due: { id: 'tenggat', en: 'due' },
  instruct: { id: 'Beri instruksi ke OPD ini', en: 'Instruct this agency' },
  tickets: { id: 'Lihat tiket di Sapa Warga', en: 'See tickets in Sapa Warga' },
  st: { baru: { id: 'Baru', en: 'New' }, proses: { id: 'Proses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Done' } },
  tst: { baru: { id: 'Baru', en: 'New' }, diverifikasi: { id: 'Diverifikasi', en: 'Verified' }, diteruskan: { id: 'Diteruskan', en: 'Forwarded' }, diproses: { id: 'Diproses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Done' } },
}

export default function Scorecard({ open, onClose, opdId, now, onInstruct }: { open: boolean; onClose: () => void; opdId: string; now: Minutes; onInstruct?: (opdIds: string[]) => void }) {
  const { lang } = useI18n()
  const session = useSession()
  const lb = useWorld((s) => opdLeaderboard(s, now))
  const tickets = useWorld((s) => s.tickets)
  const actions = useWorld((s) => s.actionItems)
  // opdScorecard reads tickets + actionItems: recompute when they change
  const card = useMemo(() => opdScorecard(world.get(), opdId, now), [tickets, actions, opdId, now])
  const day = useWorld((s) => s.day)
  const i = lb.findIndex((r) => r.opdId === opdId)
  const row = lb[i]
  const name = useWorld((s) => s.region.opd.find((o) => o.id === opdId)?.name ?? opdId)
  const complaints = useWorld((s) => s.complaints)
  // days before the first closure take the first known value (a leading 0 would read as "failed every ticket")
  let last = card.trend.find((d) => d.onTimePct !== null)?.onTimePct ?? 0
  const sla = card.trend.map((d) => (d.onTimePct === null ? last : (last = d.onTimePct)))
  const x = card.trend.map((d) => {
    const dt = new Date(`${day}T00:00:00`)
    dt.setDate(dt.getDate() + d.day)
    return dt.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' })
  })
  const closed = card.trend.reduce((a, d) => a + d.closed, 0)
  const tasks = [...card.actions].sort((a, b) => Number(b.status !== 'selesai' && b.dueAt < now) - Number(a.status !== 'selesai' && a.dueAt < now) || a.dueAt - b.dueAt)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={name}
      eyebrow={C.eyebrow[lang]}
      width={480}
      footer={
        <>
          <AppLink className="dk-mp-linkbtn" to={withControls(demoHref('sapa-warga', session))}>
            {C.tickets[lang]}
            <Icon name="arrowUpRight" size={12} />
          </AppLink>
          {onInstruct && (
            <Button variant="primary" icon="send" onClick={() => onInstruct([opdId])}>
              {C.instruct[lang]}
            </Button>
          )}
        </>
      }
    >
      <div className="dk-mp-sc">
        <dl className="dk-mp-sc-stats">
          <div>
            <dt>{C.score[lang]}</dt>
            <dd className="dk-num">{row?.score ?? '–'}</dd>
          </div>
          <div>
            <dt>{C.rank[lang]}</dt>
            <dd className="dk-num">{i >= 0 ? `${i + 1}/${lb.length}` : '–'}</dd>
          </div>
          <div>
            <dt>{C.sla[lang]}</dt>
            <dd className="dk-num">{row?.slaPct === null || !row ? '–' : `${row.slaPct}%`}</dd>
          </div>
          <div>
            <dt>{C.rating[lang]}</dt>
            <dd className="dk-num">{row?.rating ?? '–'}/5</dd>
          </div>
        </dl>
        <p className="dk-mp-meta">
          {closed} {C.closed[lang]}
        </p>
        {closed === 0 ? <p className="dk-mp-meta">{C.noTrend[lang]}</p> : <LineChart seed={session.seed} title={C.trend[lang]} unit={C.trendUnit[lang]} x={x} series={[{ id: 'sla', label: C.sla[lang], values: sla }]} format={(v) => `${Math.round(v)}%`} yDomain={[0, 100]} target={{ value: 90, label: 'Target 90%' }} height={160} />}
        <h4 className="dk-mp-sc-h">
          {C.open[lang]} <span className="dk-mp-meta">{card.openTickets.length}</span>
        </h4>
        {card.openTickets.length ? (
          <ul className="dk-mp-sc-list">
            {card.openTickets.slice(0, 8).map((t) => {
              const c = complaints.byId[t.complaintId]
              const sl = formatSla(t.slaDueAt - now, lang)
              return (
                <li key={t.id}>
                  <span className="dk-mp-sc-code dk-num">{t.code}</span>
                  <span className="dk-mp-sc-t">
                    {c ? `${CATEGORY_LABEL[c.category][lang]} · ${kecNameFrom(c.kecamatanId)}` : ''}
                  </span>
                  <StatusChip tone={t.status === 'baru' ? 'new' : 'neutral'} label={C.tst[t.status][lang]} />
                  <span className={`dk-mp-sla is-${sl.tone}`}>{sl.text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-mp-meta">{C.noOpen[lang]}</p>
        )}
        <h4 className="dk-mp-sc-h">
          {C.tasks[lang]} <span className="dk-mp-meta">{tasks.length}</span>
        </h4>
        {tasks.length ? (
          <ul className="dk-mp-sc-list">
            {tasks.slice(0, 8).map((a) => {
              const late = a.status !== 'selesai' && a.dueAt < now
              return (
                <li key={a.id}>
                  <span className="dk-mp-sc-t">{a.title[lang]}</span>
                  <StatusChip tone={late ? 'danger' : a.status === 'selesai' ? 'done' : 'neutral'} label={late ? C.late[lang] : C.st[a.status][lang]} />
                  <span className="dk-mp-meta dk-num">
                    {C.due[lang]} {Math.floor(a.dueAt / DAY_MIN) === Math.floor(now / DAY_MIN) ? hhmm(a.dueAt) : dayText(a.dueAt, now, lang)}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-mp-meta">{C.noTasks[lang]}</p>
        )}
      </div>
    </Drawer>
  )
}

function kecNameFrom(id: string) {
  return kecName(world.get(), id)
}
function dayText(at: Minutes, now: Minutes, lang: 'id' | 'en') {
  const d = Math.floor(at / DAY_MIN) - Math.floor(now / DAY_MIN)
  return d < 0 ? (lang === 'id' ? `${-d} hr lalu` : `${-d} d ago`) : lang === 'id' ? `+${d} hr` : `+${d} d`
}
