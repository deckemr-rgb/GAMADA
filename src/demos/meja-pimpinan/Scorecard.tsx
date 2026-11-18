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
import { opdScorecard } from '../../demo-kit/world/satu-daerah'
import { OPD_MIN_SAMPLE, kecName, mpLeaderboard, rankedCount, useNow, withControls } from './data'

const C = {
  eyebrow: { id: 'Scorecard OPD · 30 hari', en: 'Agency scorecard · 30 days' },
  score: { id: 'Skor', en: 'Score' },
  rank: { id: 'Peringkat', en: 'Rank' },
  sla: { id: 'SLA tepat waktu', en: 'SLA on time' },
  rating: { id: 'Kepuasan', en: 'Satisfaction' },
  closed: { id: 'tiket selesai 30 hari', en: 'tickets closed in 30 days' },
  pastSla: { id: 'tiket terbuka lewat SLA', en: 'open tickets past SLA' },
  rule: { id: 'SLA = tepat waktu ÷ (selesai + terbuka lewat SLA). Kurang dari {n} tiket: data belum cukup, tanpa skor dan peringkat.', en: 'SLA = on time ÷ (closed + open past SLA). Fewer than {n} tickets: not enough data, no score or rank.' },
  src: { id: 'Data simulasi', en: 'Simulated data' },
  trend: { id: 'SLA tepat waktu (30 hari bergulir) per hari', en: 'On-time SLA (rolling 30 days) per day' },
  noTrend: { id: 'Belum ada tiket selesai dalam 30 hari, jadi tren SLA belum bisa digambar.', en: 'No tickets closed in 30 days yet, so there is no SLA trend to draw.' },
  trendUnit: { id: '% tepat waktu dengan rumus yang sama seperti angka di atas, dihitung di akhir tiap hari', en: '% on time by the same rule as the number above, taken at the end of each day' },
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

export default function Scorecard({ open, onClose, opdId, onInstruct }: { open: boolean; onClose: () => void; opdId: string; onInstruct?: (opdIds: string[]) => void }) {
  const { lang } = useI18n()
  const now = useNow(5)
  const session = useSession()
  const lb = useWorld((s) => mpLeaderboard(s, now))
  const tickets = useWorld((s) => s.tickets)
  const actions = useWorld((s) => s.actionItems)
  // opdScorecard reads tickets + actionItems: recompute when they change
  const card = useMemo(() => opdScorecard(world.get(), opdId, now), [tickets, actions, opdId, now])
  const day = useWorld((s) => s.day)
  const row = lb.find((r) => r.opdId === opdId)
  const name = useWorld((s) => s.region.opd.find((o) => o.id === opdId)?.name ?? opdId)
  const complaints = useWorld((s) => s.complaints)
  // the headline rule at the end of every day (30 days rolling: on time ÷ (closed + open past SLA)), so the last point
  // IS the headline number; days without enough tickets carry the nearest value
  const sla = useMemo(() => {
    const mine = Object.values(tickets.byId).filter((t) => t.opdId === opdId)
    const pts = card.trend.map((d, i) => {
      const end = i === card.trend.length - 1 ? now : Math.min(now, (d.day + 1) * DAY_MIN - 1)
      let n = 0
      let ok = 0
      for (const t of mine) {
        if (t.createdAt > end) continue
        if (t.closedAt !== null && t.closedAt <= end) {
          if (t.closedAt > end - 30 * DAY_MIN) {
            n++
            if (t.closedAt <= t.slaDueAt) ok++
          }
        } else if (t.slaDueAt < end) n++
      }
      return n ? Math.round((ok / n) * 100) : null
    })
    let last = pts.find((v) => v !== null) ?? 0
    return pts.map((v) => (v === null ? last : (last = v)))
  }, [tickets, opdId, card, now])
  const x = card.trend.map((d) => {
    const dt = new Date(`${day}T00:00:00`)
    dt.setDate(dt.getDate() + d.day)
    return dt.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' })
  })
  const closed = card.trend.reduce((a, d) => a + d.closed, 0)
  // the agency's most urgent open ticket, so Sapa Warga opens on this agency's work (not its default view)
  const firstOpen = [...card.openTickets].sort((a, b) => a.slaDueAt - b.slaDueAt)[0]?.complaintId ?? null
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
          <AppLink className="dk-mp-linkbtn" to={withControls(demoHref('sapa-warga', session, firstOpen))}>
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
            <dd className="dk-num">{row?.rank != null ? `${row.rank}/${rankedCount(lb)}` : '–'}</dd>
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
          {closed} {C.closed[lang]} · {row?.lateTickets ?? 0} {C.pastSla[lang]}
          <br />
          {C.rule[lang].replace('{n}', String(OPD_MIN_SAMPLE))}
        </p>
        {closed === 0 ? <p className="dk-mp-meta">{C.noTrend[lang]}</p> : <LineChart seed={session.seed} title={C.trend[lang]} unit={C.trendUnit[lang]} x={x} series={[{ id: 'sla', label: C.sla[lang], values: sla }]} format={(v) => `${Math.round(v)}%`} yDomain={[0, 100]} target={{ value: 90, label: 'Target 90%' }} height={160} source={C.src[lang]} />}
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
  return d < 0 ? (lang === 'id' ? `${-d} hari lalu` : `${-d} days ago`) : lang === 'id' ? `${d} hari lagi` : `in ${d} days`
}
