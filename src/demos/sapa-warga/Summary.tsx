/**
 * demos/sapa-warga/Summary.tsx — the Kepala Daerah view of Sapa Warga (lazy): the same live KPIs, today's complaints
 * by category, today's active clusters (with the jump to Meja Pimpinan), agency performance (every agency with tickets,
 * largest backlog first, with the sample size; small samples are dimmed), the most urgent open tickets (read-only
 * detail) and a jump to Meja Pimpinan. No officer actions here: the regional head reads, the officers act.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../../lib/i18n'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Icon, SlaLabel } from '../../demo-kit/ui'
import { demoHref } from '../../demo-kit/shell'
import { CATEGORY_LABEL, DAY_MIN, hhmm, rows, useClock, useSession, useWorld, world, type ComplaintCategory } from '../../demo-kit/world'
import { opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { Kpis } from './Console'
import { desaName, isEmergency, kecName } from './model'
import { fill, useT } from './strings'

export default function Summary({ openTicket, sm }: { openTicket: (id: string) => void; sm: boolean }) {
  const { lang } = useI18n()
  const t = useT()
  const { minutes: now } = useClock()
  const session = useSession()
  const navigate = useNavigate()
  const complaints = useWorld((s) => s.complaints)
  const tickets = useWorld((s) => s.tickets)
  // per world minute (not per hour): the table's "Terbuka" always adds up to the live KPI "Belum selesai"
  const board = useWorld((s) => opdLeaderboard(s, now))
  const bookings = useWorld((s) => s.bookings)
  const clustersT = useWorld((s) => s.clusters)
  const ws = world.get()
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const byCat = useMemo(() => {
    const m = new Map<ComplaintCategory, number>()
    for (const c of rows(complaints)) if (c.at >= day && c.at <= now) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [complaints, day, now])
  const max = Math.max(1, ...byCat.map(([, n]) => n))
  const urgent = useMemo(
    () =>
      rows(tickets)
        .filter((x) => x.status !== 'selesai')
        .map((x) => ({ x, c: complaints.byId[x.complaintId] }))
        .filter((r) => !!r.c)
        .sort((a, b) => a.x.slaDueAt - b.x.slaDueAt)
        .slice(0, 5),
    [tickets, complaints],
  )
  /* every agency with tickets, the largest backlog first (late, then open), so the leadership sees the problems;
     the satisfaction / on-time figures carry their sample size and a small sample is dimmed */
  const opdRows = useMemo(() => {
    const late = new Map<string, number>()
    for (const x of rows(tickets)) if (x.status !== 'selesai' && x.slaDueAt < now) late.set(x.opdId, (late.get(x.opdId) ?? 0) + 1)
    return board
      .filter((r) => r.openTickets > 0 || r.closed30 > 0)
      .map((r) => ({ ...r, late: late.get(r.opdId) ?? 0 }))
      .sort((a, b) => b.late - a.late || b.openTickets - a.openTickets || a.short.localeCompare(b.short))
  }, [board, tickets, now])
  /* simulated impact figures from the same world (the assumption is printed next to each) */
  const eff = useMemo(() => {
    const today = rows(complaints).filter((c) => c.at >= day && c.at <= now)
    const sos = today.filter((c) => isEmergency(c))
    const biz = rows(bookings).filter((b) => b.at >= day && b.at <= now && (b.serviceId === 'nib-oss' || b.serviceId === 'izin-usaha-mikro')).length
    return { hours: Math.round(((today.length * 6) / 60) * 10) / 10, sos: sos.length, biz }
  }, [complaints, bookings, day, now])
  const clusters = useMemo(() => rows(clustersT).filter((c) => c.updatedAt >= day).sort((a, b) => b.complaintIds.length - a.complaintIds.length), [clustersT, day])
  const pct = (v: number) => v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')
  const goDesk = (focus?: string) => {
    const href = demoHref('meja-pimpinan', session, focus)
    const dev = new URLSearchParams(window.location.search).get('controls') === 'all'
    navigate(dev ? `${href}&controls=all` : href)
  }
  return (
    <BrowserFrame slug="sapa-warga/ringkasan" label={t.sumHead} className="dk-sw-console" dusk={!sm}>
      <div className="dk-sw-con">
        <header className="dk-sw-con-head is-sum">
          <div>
            <h2>{t.sumHead}</h2>
            <p className="dk-sw-muted">
              {t.readOnly} · {t.simData}
            </p>
          </div>
          <Button size="sm" variant="secondary" iconEnd="arrowUpRight" onClick={() => goDesk()}>
            {t.openDesk}
          </Button>
        </header>
        <Kpis now={now} />
        <div className="dk-sw-sum">
          <section className="dk-sw-sumcard">
            <h3 className="dk-sw-h3">{t.byCategory}</h3>
            <ul className="dk-sw-bars">
              {byCat.map(([c, n]) => (
                <li key={c}>
                  <span title={CATEGORY_LABEL[c][lang]}>{CATEGORY_LABEL[c][lang]}</span>
                  <i aria-hidden="true">
                    <b style={{ transform: `scaleX(${n / max})` }} />
                  </i>
                  <span className="dk-num">{n}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="dk-sw-sumcard">
            <h3 className="dk-sw-h3">{t.activeClusters}</h3>
            {clusters.length ? (
              <ul className="dk-sw-sumcl">
                {clusters.map((c) => (
                  <li key={c.id}>
                    <span>
                      <Icon name="alert" size={14} />
                      <b>{`${desaName(ws, c.kecamatanId, c.desaId)}, Kec. ${kecName(ws, c.kecamatanId)}`}</b>
                      <span className="dk-sw-muted">{fill(t.clusterOf, { n: c.complaintIds.length, km: c.radiusKm, time: hhmm(c.at).replace(':', '.') })}</span>
                    </span>
                    <Button size="sm" variant="secondary" iconEnd="arrowUpRight" onClick={() => goDesk(c.id)}>
                      {t.seeDesk}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dk-sw-muted">{t.noClusters}</p>
            )}
          </section>
          <section className="dk-sw-sumcard is-wide">
            <h3 className="dk-sw-h3">{t.opdTable}</h3>
            <p className="dk-sw-fine">{t.opdWorstFirst}</p>
            {sm ? (
              <ul className="dk-sw-opdcards">
                {opdRows.map((r) => {
                  const small = r.closed30 < 5
                  return (
                    <li key={r.opdId} className={small ? 'is-small' : undefined}>
                      <b>
                        {r.short}
                        <span className="dk-sw-opdn">
                          {t.opdN} {r.closed30}
                        </span>
                        {small && <span className="dk-sw-tag">{r.closed30 ? t.opdSmall : t.noTickets}</span>}
                      </b>
                      <dl>
                        <div>
                          <dt>{t.opdOpen}</dt>
                          <dd>{r.openTickets}</dd>
                        </div>
                        <div>
                          <dt>{t.opdLate}</dt>
                          <dd className={r.late ? 'is-late' : undefined}>{r.late}</dd>
                        </div>
                        <div>
                          <dt>{t.kSla}</dt>
                          <dd>{r.slaPct === null ? '–' : `${pct(r.slaPct)}%`}</dd>
                        </div>
                        <div>
                          <dt>{t.kRating}</dt>
                          <dd>{r.rating === null ? '–' : pct(r.rating)}</dd>
                        </div>
                      </dl>
                    </li>
                  )
                })}
              </ul>
            ) : (
            <div className="dk-sw-opd-wrap">
              <table className="dk-sw-opd">
                <thead>
                  <tr>
                    <th scope="col">OPD</th>
                    <th scope="col">{t.opdOpen}</th>
                    <th scope="col">{t.opdLate}</th>
                    <th scope="col">{t.kSla}</th>
                    <th scope="col">{t.opdN}</th>
                    <th scope="col">{t.kRating}</th>
                  </tr>
                </thead>
                <tbody>
                  {opdRows.map((r) => {
                    const small = r.closed30 < 5
                    return (
                      <tr key={r.opdId} className={small ? 'is-small' : undefined}>
                        <th scope="row">
                          {r.short}
                          {small && <span className="dk-sw-tag">{r.closed30 ? t.opdSmall : t.noTickets}</span>}
                        </th>
                        <td className="dk-num">{r.openTickets}</td>
                        <td className={`dk-num${r.late ? ' is-late' : ''}`}>{r.late}</td>
                        <td className="dk-num">{r.slaPct === null ? '–' : `${pct(r.slaPct)}%`}</td>
                        <td className="dk-num">{r.closed30}</td>
                        <td className="dk-num">{r.rating === null ? '–' : pct(r.rating)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
            <p className="dk-sw-fine">{t.slaDef}</p>
          </section>
          <section className="dk-sw-sumcard is-wide">
            <h3 className="dk-sw-h3">{t.effHead}</h3>
            <dl className="dk-sw-eff">
              <div>
                <dt>{t.effHours}</dt>
                <dd>{fill(t.hoursUnit, { h: pct(eff.hours) })}</dd>
                <small>{t.effHoursNote}</small>
              </div>
              <div>
                <dt>{t.effEmergency}</dt>
                <dd>{eff.sos}</dd>
              </div>
              <div>
                <dt>{t.effRef}</dt>
                <dd>{eff.biz}</dd>
              </div>
            </dl>
          </section>
          <section className="dk-sw-sumcard is-wide">
            <h3 className="dk-sw-h3">{t.urgent}</h3>
            <ul className="dk-sw-urgent">
              {urgent.map(({ x, c }) => (
                <li key={x.id}>
                  <button type="button" onClick={() => openTicket(x.id)}>
                    <Icon name="alert" size={14} />
                    <b className="dk-num">{c!.code}</b>
                    <span className="dk-sw-urg-text">{c!.summary[lang]}</span>
                    <SlaLabel minutesLeft={x.slaDueAt - now} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </BrowserFrame>
  )
}
