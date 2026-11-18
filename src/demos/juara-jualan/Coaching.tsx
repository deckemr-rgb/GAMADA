/**
 * demos/juara-jualan/Coaching.tsx — "Coaching" (lazy, supervisor): this week's card per agent of the industry (newest
 * coaching: 3 focus areas + one example sentence each, status, baseline, the practice result against it), or an empty
 * card with "Tugaskan coaching" prefilled from the agent's weakest criteria on the team board.
 */
import { useEffect, useRef } from 'react'
import { Badge, Button, Icon, flashNewRow } from '../../demo-kit/ui'
import { hhmm, rows, useClock, useWorld, type CriterionKey, type Industry } from '../../demo-kit/world'
import { teamBoard, weakest } from '../../demo-kit/world/usaha-pintar'
import { clockText, useT } from './strings'

export const CS = {
  id: {
    title: 'Kartu coaching minggu ini',
    none: 'Belum ada coaching minggu ini.',
    status: { baru: 'Baru', latihan: 'Sedang latihan', selesai: 'Selesai' } as Record<string, string>,
    base: 'Baseline',
    rp: (s: number, b: number) => `Latihan terakhir ${s} (baseline ${b})`,
    practice: 'Latih sekarang',
    asAgent: 'Lihat sebagai agen',
    when: (d: number, t: string) => (d === 0 ? `hari ini ${t}` : `${d} hari lalu`),
    avg: (n: number | null) => (n === null ? 'belum ada skor' : `rata-rata 14 hari ${n}`),
    assign: 'Tugaskan coaching',
  },
  en: {
    title: "This week's coaching cards",
    none: 'No coaching this week yet.',
    status: { baru: 'New', latihan: 'Practising', selesai: 'Done' } as Record<string, string>,
    base: 'Baseline',
    rp: (s: number, b: number) => `Last practice ${s} (baseline ${b})`,
    practice: 'Practise now',
    asAgent: 'View as the agent',
    when: (d: number, t: string) => (d === 0 ? `today ${t}` : `${d} days ago`),
    avg: (n: number | null) => (n === null ? 'no score yet' : `14-day average ${n}`),
    assign: 'Assign coaching',
  },
}

export interface CoachingProps {
  industry: Industry
  highlight: string | null
  onAssign: (agentId: string, callId: string | null, keys: CriterionKey[]) => void
  onAssignIntent: () => void
  onPractice: (agentId: string, coachingId: string | null) => void
  onAsAgent: (agentId: string) => void
}

export default function Coaching({ industry, highlight, onAssign, onAssignIntent, onPractice, onAsAgent }: CoachingProps) {
  const { lang } = useT()
  const L = CS[lang]
  const now = useClock().minutes
  const board = useWorld((s) => teamBoard(s, now, industry))
  const coachings = useWorld((s) => s.coachings)
  const roleplays = useWorld((s) => s.roleplays)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlight) return
    const el = ref.current?.querySelector<HTMLElement>(`[data-coaching="${highlight}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    return flashNewRow(el)
  }, [highlight])
  return (
    <div ref={ref} className="dk-jj-coach">
      <p className="dk-jj-h4">{L.title}</p>
      <ul className="dk-jj-cards">
        {board.map((r) => {
          const c = rows(coachings)
            .filter((x) => x.agentId === r.agent.id)
            .sort((a, b) => b.at - a.at)[0]
          const rp = c ? rows(roleplays).filter((x) => x.coachingId === c.id).sort((a, b) => b.at - a.at)[0] : undefined
          const days = c ? Math.max(0, Math.floor(now / 1440) - Math.floor(c.at / 1440)) : 0
          return (
            <li key={r.agent.id} className="dk-jj-card" data-coaching={c?.id} data-agent={r.agent.id}>
              <div className="dk-jj-card-h">
                <b>{r.agent.name}</b>
                <span className="dk-jj-faint">{L.avg(r.avg14)}</span>
                {c && <Badge tone={c.status === 'baru' ? 'accent' : c.status === 'selesai' ? 'neutral' : 'warn'}>{L.status[c.status]}</Badge>}
              </div>
              {c ? (
                <>
                  <ol className="dk-jj-focus">
                    {c.focus.map((f, i) => (
                      <li key={i}>
                        <b>{f[lang]}</b>
                        {c.examples[i] && <span className="dk-jj-muted">{c.examples[i]![lang]}</span>}
                      </li>
                    ))}
                  </ol>
                  <p className="dk-jj-faint">
                    {L.base} <span className="dk-num">{c.baseline}</span> · {L.when(days, clockText(hhmm(c.at), lang))}
                    {rp && ` · ${L.rp(rp.score, rp.baseline)}`}
                  </p>
                  <div className="dk-jj-card-a">
                    {c.status !== 'selesai' && (
                      <Button size="sm" variant="secondary" icon="mic" onClick={() => onPractice(r.agent.id, c.id)}>
                        {L.practice}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon="user" onClick={() => onAsAgent(r.agent.id)}>
                      {L.asAgent}
                    </Button>
                    {c.status === 'selesai' && (
                      <Button size="sm" variant="ghost" icon="plus" onPointerEnter={onAssignIntent} onFocus={onAssignIntent} onClick={() => onAssign(r.agent.id, null, weakest(r.radar, 3))}>
                        {L.assign}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="dk-jj-faint">{L.none}</p>
                  <div className="dk-jj-card-a">
                    <Button size="sm" variant="primary" icon="plus" data-jj="assign" onPointerEnter={onAssignIntent} onFocus={onAssignIntent} onClick={() => onAssign(r.agent.id, null, weakest(r.radar, 3))}>
                      {L.assign}
                    </Button>
                  </div>
                </>
              )}
              <Icon name="star" size={14} className="dk-jj-card-ic" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
