/**
 * demos/juara-jualan/Team.tsx — "Tim" (lazy): the industry's leaderboard (teamBoard: avg14, delta 7 days, calls), the
 * selected agent's criteria against the team average (RadarChart; radar = criteria averages) and their 14-day trend
 * (LineChart). Board avg14 = agent view = roleplay baseline (stored at assignment).
 */
import { useEffect, useRef } from 'react'
import { Badge, Button, flashNewRow } from '../../demo-kit/ui'
import { LineChart, RadarChart } from '../../demo-kit/viz'
import { useClock, useWorld, type CriterionKey, type Industry } from '../../demo-kit/world'
import { CRITERIA_KEYS, teamBoard, teamRadar, weakest } from '../../demo-kit/world/usaha-pintar'
import { useT } from './strings'

const S = {
  id: { board: 'Papan tim (14 hari)', rank: 'Peringkat', agent: 'Agen', avg: 'Rata-rata', d7: 'Δ 7 hari', calls: 'Percakapan', radar: (n: string) => `${n} dibanding rata-rata tim`, team: 'Rata-rata tim', trend: (n: string) => `Tren skor harian ${n}`, unit: 'skor 0–100', days: 'hari', noScore: 'belum ada', assign: 'Tugaskan coaching', pick: (n: string) => `Lihat ${n}`, carry: 'Hari tanpa panggilan memakai nilai hari sebelumnya.', newb: 'kasir baru' },
  en: { board: 'Team board (14 days)', rank: 'Rank', agent: 'Agent', avg: 'Average', d7: 'Δ 7 days', calls: 'Calls', radar: (n: string) => `${n} against the team average`, team: 'Team average', trend: (n: string) => `Daily score trend of ${n}`, unit: 'score 0–100', days: 'days', noScore: 'none yet', assign: 'Assign coaching', pick: (n: string) => `View ${n}`, carry: 'Days without calls carry the previous value.', newb: 'new cashier' },
}

/** short axis names (the radar labels sit outside a small plot) */
const SHORT: Record<CriterionKey, { id: string; en: string }> = {
  salam: { id: 'Salam', en: 'Greeting' }, gali: { id: 'Gali', en: 'Discovery' }, keberatan: { id: 'Keberatan', en: 'Objection' },
  penawaran: { id: 'Penawaran', en: 'Offer' }, closing: { id: 'Closing', en: 'Closing' }, kepatuhan: { id: 'Kepatuhan', en: 'Compliance' },
}

export interface TeamProps {
  industry: Industry
  selected: string | null
  onSelect: (id: string) => void
  onAssign: (agentId: string, callId: string | null, keys: CriterionKey[]) => void
  onAssignIntent: () => void
}

export default function Team({ industry, selected, onSelect, onAssign, onAssignIntent }: TeamProps) {
  const { lang } = useT()
  const L = S[lang]
  const now = useClock().minutes
  const board = useWorld((s) => teamBoard(s, now, industry))
  const row = board.find((r) => r.agent.id === selected) ?? board[board.length - 1]
  const team = teamRadar(board)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selected) return
    const el = box.current?.querySelector<HTMLElement>(`[data-agent-row="${selected}"]`)
    if (el) return flashNewRow(el)
  }, [selected])
  if (!row) return null
  let last = row.avg14 ?? 0
  const trend = row.trend.map((v) => (v === null ? last : (last = v)))
  const day = (i: number) => (i === 13 ? (lang === 'id' ? 'hari ini' : 'today') : `-${13 - i}`)
  return (
    <div ref={box} className="dk-jj-team">
      <section className="dk-jj-board" aria-label={L.board}>
        <p className="dk-jj-h4">{L.board}</p>
        <ol className="dk-jj-blist">
          {board.map((r) => (
            <li key={r.agent.id} data-agent-row={r.agent.id} className={r.agent.id === row.agent.id ? 'is-on' : ''}>
              <button type="button" className="dk-jj-brow" aria-current={r.agent.id === row.agent.id ? 'true' : undefined} onClick={() => onSelect(r.agent.id)} aria-label={L.pick(r.agent.name)}>
                <span className="dk-jj-brank dk-num">#{r.rank}</span>
                <span className="dk-jj-row-m">
                  <b>{r.agent.name}</b>
                  <span className="dk-jj-faint">
                    {r.agent.role === 'kasir' && r.agent.joinedDays < 30 ? `${L.newb} · ` : ''}
                    {L.calls} {r.calls14}
                  </span>
                </span>
                <span className="dk-jj-bavg dk-num">{r.avg14 ?? '–'}</span>
                <Badge tone={r.delta7 < 0 ? 'danger' : r.delta7 > 0 ? 'accent' : 'neutral'}>
                  {r.delta7 > 0 ? '+' : r.delta7 < 0 ? '−' : '±'}
                  {Math.abs(r.delta7)}
                </Badge>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="dk-jj-tcharts">
        <div className="dk-jj-tch">
          <RadarChart
            title={L.radar(row.agent.name)}
            unit={L.unit}
            axes={CRITERIA_KEYS.map((k) => SHORT[k][lang])}
            series={[
              { id: 'agent', label: row.agent.name, values: CRITERIA_KEYS.map((k) => row.radar[k]) },
              { id: 'team', label: L.team, values: CRITERIA_KEYS.map((k) => team[k]) },
            ]}
            max={100}
          />
        </div>
        <div className="dk-jj-tch">
          <LineChart title={L.trend(row.agent.name)} unit={L.unit} x={trend.map((_, i) => day(i))} series={[{ id: 'trend', label: row.agent.name, values: trend }]} yDomain={[0, 100]} height={200} />
          <p className="dk-jj-faint">{L.carry}</p>
        </div>
        <Button variant="secondary" icon="users" data-jj="assign" onPointerEnter={onAssignIntent} onFocus={onAssignIntent} onClick={() => onAssign(row.agent.id, null, weakest(row.radar, 3))}>
          {L.assign}
        </Button>
      </section>
    </div>
  )
}
