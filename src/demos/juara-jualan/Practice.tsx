/**
 * demos/juara-jualan/Practice.tsx — "Latihan" (lazy): roleplay with a simulated customer (persona ragu harga /
 * buru-buru / banyak tanya, per industry). Type a reply or pick one of three suggestion chips; the run ends at turn 8,
 * on "selesai" or when the customer accepts a call to action. From 6 turns on it is scored (callScore) against the
 * baseline stored on the coaching card (else the board avg14) and sent as `roleplay.completed`.
 */
import { useMemo, useRef, useState } from 'react'
import { Badge, Button, ChatComposer, ChatThread, Segmented, Select } from '../../demo-kit/ui'
import { emit, rows, useClock, useWorld, world, type Bi, type Industry, type RoleplayPersona } from '../../demo-kit/world'
import { teamBoard } from '../../demo-kit/world/usaha-pintar'
import { MIN_TURNS, TURN_LIMIT, bullets, chipReply, chipsFor, classify, customerNext, scoreOf, scoreTurns, vocabFor, type Reply, type Turn } from './roleplay'
import { SLUG, useT } from './strings'

const S = {
  id: {
    persona: 'Persona pelanggan',
    p: { 'ragu-harga': 'Ragu harga', 'buru-buru': 'Buru-buru', 'banyak-tanya': 'Banyak tanya' } as Record<RoleplayPersona, string>,
    agent: 'Berlatih sebagai',
    restart: 'Mulai ulang',
    turn: (n: number) => `Giliran ${n}/${TURN_LIMIT}`,
    label: 'Percakapan latihan',
    ph: 'Ketik balasan Anda, atau pilih saran di atas',
    send: 'Kirim',
    done: 'Latihan selesai: mulai ulang untuk mencoba lagi.',
    tooShort: (n: number) => `Baru ${n} giliran: minimal ${MIN_TURNS} giliran supaya bisa dinilai. Lanjutkan atau mulai ulang.`,
    result: 'Hasil latihan',
    score: 'Skor',
    base: 'Baseline',
    delta: 'Selisih',
    coach: (c: string) => `Untuk kartu ${c}`,
    sim: 'Pelanggan simulasi · balasan dinilai di browser',
    hint: 'Ketik “selesai” untuk mengakhiri.',
  },
  en: {
    persona: 'Customer persona',
    p: { 'ragu-harga': 'Price-hesitant', 'buru-buru': 'In a hurry', 'banyak-tanya': 'Many questions' } as Record<RoleplayPersona, string>,
    agent: 'Practise as',
    restart: 'Start over',
    turn: (n: number) => `Turn ${n}/${TURN_LIMIT}`,
    label: 'Practice conversation',
    ph: 'Type your reply, or pick a suggestion above',
    send: 'Send',
    done: 'Practice finished: start over to try again.',
    tooShort: (n: number) => `Only ${n} turns: at least ${MIN_TURNS} turns are needed for a score. Continue or start over.`,
    result: 'Practice result',
    score: 'Score',
    base: 'Baseline',
    delta: 'Difference',
    coach: (c: string) => `For card ${c}`,
    sim: 'Simulated customer · replies scored in the browser',
    hint: 'Type “done” to finish.',
  },
}

interface Msg { id: string; side: 'me' | 'them' | 'system'; text: Bi | string }
interface Result { score: number; baseline: number; bullets: Bi[] }

export interface PracticeProps {
  industry: Industry
  agentId: string | null
  coachingId: string | null
  fixedAgent: boolean
}

export default function Practice({ industry, agentId, coachingId, fixedAgent }: PracticeProps) {
  const { lang } = useT()
  const L = S[lang]
  const now = useClock().minutes
  const board = useWorld((s) => teamBoard(s, now, industry))
  const coachings = useWorld((s) => s.coachings)
  const [pickAgent, setPickAgent] = useState<string | null>(null)
  // default: the agent given (agent role / a coaching card), else the one with an open coaching, else the lowest on the board
  const open = rows(coachings).filter((c) => c.status !== 'selesai' && board.some((r) => r.agent.id === c.agentId)).sort((a, b) => b.at - a.at)[0]
  // the default is fixed once chosen (a finished practice closes the coaching and must not swap the agent)
  const fb = useRef<string | null>(null)
  if (!fb.current || !board.some((r) => r.agent.id === fb.current)) fb.current = open?.agentId ?? board[board.length - 1]?.agent.id ?? null
  const inBoard = (id: string | null) => !!id && board.some((r) => r.agent.id === id)
  const who = (fixedAgent ? agentId : inBoard(pickAgent) ? pickAgent : inBoard(agentId) ? agentId : fb.current) ?? null
  const row = board.find((r) => r.agent.id === who)
  const coach = (coachingId && coachings.byId[coachingId]?.agentId === who ? coachings.byId[coachingId] : undefined) ?? rows(coachings).filter((c) => c.agentId === who && c.status !== 'selesai').sort((a, b) => b.at - a.at)[0]
  const baseline = coach?.baseline ?? row?.avg14 ?? row?.agent.baseline ?? 60
  const [persona, setPersona] = useState<RoleplayPersona>('ragu-harga')
  const vocab = useMemo(() => vocabFor(world.get(), industry, row?.agent.name ?? '', (row?.agent.org ?? '').split(' · ')[0] ?? ''), [industry, row?.agent.name, row?.agent.org])
  const [turns, setTurns] = useState<Turn[]>([])
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 'c0', side: 'them', text: customerNext('ragu-harga', [], vocab, false) }])
  const [ended, setEnded] = useState<'no' | 'short' | 'done'>('no')
  const [result, setResult] = useState<Result | null>(null)
  const [typing, setTyping] = useState(false)
  const timer = useRef(0)

  const restart = (p: RoleplayPersona = persona) => {
    window.clearTimeout(timer.current)
    setTurns([])
    setEnded('no')
    setResult(null)
    setTyping(false)
    setMsgs([{ id: `c0-${Date.now()}`, side: 'them', text: customerNext(p, [], vocab, false) }])
  }
  const key = `${industry}|${who}|${persona}|${vocab.price.id}`
  const lastKey = useRef(key)
  if (lastKey.current !== key) {
    lastKey.current = key
    // a new agent / industry / persona starts a fresh conversation (state reset during render, React-sanctioned)
    setTurns([])
    setEnded('no')
    setResult(null)
    setTyping(false)
    setMsgs([{ id: `c0-${key}`, side: 'them', text: customerNext(persona, [], vocab, false) }])
  }

  const finish = (all: Turn[]) => {
    if (all.length < MIN_TURNS || !row) {
      setEnded('short')
      return
    }
    const criteria = scoreTurns(all)
    const score = scoreOf(criteria)
    emit('roleplay.completed', { agentId: row.agent.id, coachingId: coach?.id ?? null, persona, industry, turns: all.length, score, baseline, criteria }, SLUG)
    setResult({ score, baseline, bullets: bullets(criteria, all) })
    setEnded('done')
  }

  const reply = (text: string, r: Reply) => {
    if (ended === 'done' || typing) return
    const step = turns.length
    const me: Msg = { id: `m${step}-${msgs.length}`, side: 'me', text }
    if (r.end) {
      setMsgs((m) => [...m, me])
      finish(turns)
      return
    }
    const next: Turn[] = [...turns, { step, q: r.q, breach: r.breach, pressure: r.pressure }]
    setTurns(next)
    setMsgs((m) => [...m, me])
    setEnded('no')
    const accepted = r.q === 'good' && r.cta && step >= MIN_TURNS - 1
    if (accepted || next.length >= TURN_LIMIT) {
      setMsgs((m) => [...m, { id: `c${next.length}`, side: 'them', text: customerNext(persona, next, vocab, accepted) }])
      finish(next)
      return
    }
    setTyping(true)
    timer.current = window.setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { id: `c${next.length}`, side: 'them', text: customerNext(persona, next, vocab, false) }])
    }, 650)
  }

  const chips = ended === 'done' ? [] : chipsFor(turns.length, persona, vocab)
  const delta = result ? result.score - result.baseline : 0
  return (
    <div className="dk-jj-practice">
      <div className="dk-jj-ph">
        <Segmented<RoleplayPersona>
          size="sm"
          label={L.persona}
          value={persona}
          onChange={(p) => {
            setPersona(p)
          }}
          options={(['ragu-harga', 'buru-buru', 'banyak-tanya'] as RoleplayPersona[]).map((p) => ({ value: p, label: L.p[p] }))}
        />
        {!fixedAgent && (
          <label className="dk-jj-aslabel">
            <span className="dk-jj-faint">{L.agent}</span>
            <Select value={who ?? ''} onChange={(e) => setPickAgent(e.target.value)} options={board.map((r) => ({ value: r.agent.id, label: r.agent.name }))} aria-label={L.agent} />
          </label>
        )}
        <Badge>{L.turn(Math.min(TURN_LIMIT, turns.length))}</Badge>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => restart()}>
          {L.restart}
        </Button>
      </div>
      <p className="dk-jj-faint">
        {L.sim}
        {coach ? ` · ${L.coach(coach.id)}` : ''} · {L.hint}
      </p>
      {ended === 'short' && <p className="dk-jj-warn">{L.tooShort(turns.length)}</p>}
      {result && (
        <section className="dk-jj-result" aria-live="polite" aria-label={L.result}>
          <p className="dk-jj-h4">{L.result}</p>
          <div className="dk-jj-result-n">
            <span>
              {L.score} <b className="dk-num">{result.score}</b>
            </span>
            <span>
              {L.base} <b className="dk-num">{result.baseline}</b>
            </span>
            <Badge tone={delta >= 0 ? 'accent' : 'danger'}>
              {L.delta} {delta >= 0 ? '+' : '−'}
              {Math.abs(delta)}
            </Badge>
          </div>
          <ul>
            {result.bullets.map((x, i) => (
              <li key={i}>{x[lang]}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="dk-jj-chat">
        <ChatThread
          label={{ id: S.id.label, en: S.en.label }}
          messages={msgs}
          typing={typing}
          quickReplies={chips.map((c) => ({ id: c.id, label: c.label }))}
          onQuick={(id) => {
            const c = chips.find((x) => x.id === id)
            if (c) reply(c.label[lang], chipReply(c.q, c.label[lang], turns.length))
          }}
          {...(typing ? { quickDisabled: { id: 'Pelanggan sedang mengetik…', en: 'The customer is typing…' } } : {})}
        />
        <ChatComposer
          onSend={(text) => reply(text, classify(text, turns.length))}
          placeholder={{ id: S.id.ph, en: S.en.ph }}
          label={{ id: S.id.label, en: S.en.label }}
          sendLabel={{ id: S.id.send, en: S.en.send }}
          {...(ended === 'done' ? { disabledReason: { id: S.id.done, en: S.en.done } } : {})}
          className="dk-jj-composer"
        />
      </div>
    </div>
  )
}
