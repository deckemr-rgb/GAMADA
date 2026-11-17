/**
 * demos/sapa-warga/Summary.tsx — the Kepala Daerah view of Sapa Warga (lazy): the same live KPIs, today's complaints
 * by category, agency performance (opdLeaderboard), the most urgent open tickets (read-only detail) and a jump to
 * Meja Pimpinan. No officer actions here: the regional head reads, the officers act.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../../lib/i18n'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Icon, SlaLabel } from '../../demo-kit/ui'
import { demoHref } from '../../demo-kit/shell'
import { CATEGORY_LABEL, DAY_MIN, rows, useClock, useSession, useWorld, type ComplaintCategory } from '../../demo-kit/world'
import { opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { Kpis } from './Console'
import { useT } from './strings'

export default function Summary({ openTicket, sm }: { openTicket: (id: string) => void; sm: boolean }) {
  const { lang } = useI18n()
  const t = useT()
  const { minutes: now } = useClock()
  const session = useSession()
  const navigate = useNavigate()
  const complaints = useWorld((s) => s.complaints)
  const tickets = useWorld((s) => s.tickets)
  const board = useWorld((s) => opdLeaderboard(s, Math.floor(now / 60) * 60))
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
  const goDesk = () => {
    const href = demoHref('meja-pimpinan', session)
    const dev = new URLSearchParams(window.location.search).get('controls') === 'all'
    navigate(dev ? `${href}&controls=all` : href)
  }
  return (
    <BrowserFrame slug="sapa-warga/ringkasan" label={t.sumHead} className="dk-sw-console" dusk={!sm}>
      <div className="dk-sw-con">
        <header className="dk-sw-con-head">
          <div>
            <h2>{t.sumHead}</h2>
            <p className="dk-sw-muted">
              {t.readOnly} · {t.simData}
            </p>
          </div>
          <Button size="sm" variant="secondary" iconEnd="arrowUpRight" onClick={goDesk}>
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
                  <span>{CATEGORY_LABEL[c][lang]}</span>
                  <i aria-hidden="true">
                    <b style={{ transform: `scaleX(${n / max})` }} />
                  </i>
                  <span className="dk-num">{n}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="dk-sw-sumcard">
            <h3 className="dk-sw-h3">{t.opdTable}</h3>
            <table className="dk-sw-opd">
              <thead>
                <tr>
                  <th scope="col">OPD</th>
                  <th scope="col">{t.kSla}</th>
                  <th scope="col">{t.opdOpen}</th>
                  <th scope="col">{t.kRating}</th>
                </tr>
              </thead>
              <tbody>
                {board.slice(0, 7).map((r) => (
                  <tr key={r.opdId}>
                    <th scope="row">{r.short}</th>
                    <td className="dk-num">{r.slaPct === null ? '–' : `${r.slaPct}%`}</td>
                    <td className="dk-num">{r.openTickets}</td>
                    <td className="dk-num">{r.rating === null ? '–' : r.rating.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="dk-sw-sumcard is-wide">
            <h3 className="dk-sw-h3">{t.urgent}</h3>
            <ul className="dk-sw-urgent">
              {urgent.map(({ x, c }) => (
                <li key={x.id}>
                  <button type="button" onClick={() => openTicket(x.id)}>
                    <Icon name="alert" size={14} />
                    <b className="dk-num">{c!.code}</b>
                    <span>{c!.summary[lang]}</span>
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
