/**
 * demos/juara-jualan/AgentHome.tsx — "Coaching Saya" (lazy, Agen Sales): the signed-in agent's coaching cards, newest
 * first (a card assigned in this session flashes in and ticks mission 4), their own rank only, avg14 (= board =
 * roleplay baseline) and their practice results.
 */
import { useEffect, useRef } from 'react'
import { Badge, Button, EmptyState, flashNewRow } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { useClock, useWorld } from '../../demo-kit/world'
import { agentProfile } from '../../demo-kit/world/usaha-pintar'
import { useT } from './strings'

const S = {
  id: {
    hi: (n: string) => `Halo, ${n}`,
    stats: (r: number, of: number, a: number | null) => `Peringkat Anda #${r} dari ${of} · rata-rata 14 hari ${a ?? '–'}`,
    cards: 'Kartu coaching Anda',
    none: 'Belum ada kartu coaching. Supervisor mengirimnya dari tab Coaching.',
    status: { baru: 'Baru', latihan: 'Sedang latihan', selesai: 'Selesai' } as Record<string, string>,
    practice: 'Mulai latihan',
    calls: 'Lihat percakapan saya',
    base: (b: number) => `Target: lampaui baseline ${b}`,
    rps: 'Hasil latihan',
    rp: (s: number, b: number) => `${s} (baseline ${b}, ${s - b >= 0 ? '+' : '−'}${Math.abs(s - b)})`,
    persona: { 'ragu-harga': 'ragu harga', 'buru-buru': 'buru-buru', 'banyak-tanya': 'banyak tanya' } as Record<string, string>,
  },
  en: {
    hi: (n: string) => `Hello, ${n}`,
    stats: (r: number, of: number, a: number | null) => `Your rank #${r} of ${of} · 14-day average ${a ?? '–'}`,
    cards: 'Your coaching cards',
    none: 'No coaching cards yet. Your supervisor sends them from the Coaching tab.',
    status: { baru: 'New', latihan: 'Practising', selesai: 'Done' } as Record<string, string>,
    practice: 'Start practice',
    calls: 'See my conversations',
    base: (b: number) => `Goal: beat your baseline of ${b}`,
    rps: 'Practice results',
    rp: (s: number, b: number) => `${s} (baseline ${b}, ${s - b >= 0 ? '+' : '−'}${Math.abs(s - b)})`,
    persona: { 'ragu-harga': 'price-hesitant', 'buru-buru': 'in a hurry', 'banyak-tanya': 'many questions' } as Record<string, string>,
  },
}

export interface AgentHomeProps {
  agentId: string
  onPractice: (agentId: string, coachingId: string | null) => void
  onCalls: () => void
}

export default function AgentHome({ agentId, onPractice, onCalls }: AgentHomeProps) {
  const { lang } = useT()
  const L = S[lang]
  const shell = useShell()
  const now = useClock().minutes
  // agentProfile builds a new object per call: equal while the board row and the card / practice lists are unchanged
  const p = useWorld(
    (s) => agentProfile(s, now, agentId),
    (a, b) => a === b || (!!a && !!b && a.row === b.row && a.coachings.length === b.coachings.length && a.roleplays.length === b.roleplays.length && a.coachings.every((c, i) => c === b.coachings[i])),
  )
  const ref = useRef<HTMLDivElement>(null)
  const newest = p?.coachings[0]
  useEffect(() => {
    if (!newest) return
    const el = ref.current?.querySelector<HTMLElement>(`[data-coaching="${newest.id}"]`)
    if (!el) return
    if (newest.status === 'baru') shell.markMission('agen')
    return flashNewRow(el)
  }, [newest?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null
  const first = p.row.agent.name.split(' ')[0] ?? p.row.agent.name
  return (
    <div ref={ref} className="dk-jj-agent">
      <div className="dk-jj-agent-h">
        <p className="dk-jj-h3">{L.hi(first)}</p>
        <p className="dk-jj-muted">{L.stats(p.row.rank, p.of, p.row.avg14)}</p>
        <Button size="sm" variant="ghost" icon="list" onClick={onCalls}>
          {L.calls}
        </Button>
      </div>
      <p className="dk-jj-h4">{L.cards}</p>
      {p.coachings.length === 0 ? (
        <EmptyState title={L.none} />
      ) : (
        <ul className="dk-jj-cards">
          {p.coachings.map((c) => (
            <li key={c.id} className="dk-jj-card" data-coaching={c.id}>
              <div className="dk-jj-card-h">
                <b>{c.id}</b>
                <Badge tone={c.status === 'baru' ? 'accent' : c.status === 'selesai' ? 'neutral' : 'warn'}>{L.status[c.status]}</Badge>
              </div>
              <ol className="dk-jj-focus">
                {c.focus.map((f, i) => (
                  <li key={i}>
                    <b>{f[lang]}</b>
                    {c.examples[i] && <span className="dk-jj-muted">{c.examples[i]![lang]}</span>}
                  </li>
                ))}
              </ol>
              <p className="dk-jj-faint">{L.base(c.baseline)}</p>
              {c.status !== 'selesai' && (
                <div className="dk-jj-card-a">
                  <Button size="sm" variant="primary" icon="mic" onClick={() => onPractice(agentId, c.id)}>
                    {L.practice}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {p.roleplays.length > 0 && (
        <>
          <p className="dk-jj-h4">{L.rps}</p>
          <ul className="dk-jj-rps">
            {[...p.roleplays].sort((a, b) => b.at - a.at).map((r) => (
              <li key={r.id}>
                <span>{L.persona[r.persona]}</span> <b className="dk-num">{L.rp(r.score, r.baseline)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
