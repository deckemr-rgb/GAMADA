/**
 * Ask.tsx (lazy) — "Tanya skor" drawer for the owner: ChatThread + ChatComposer + suggestion chips. Sim scenario
 * (scenario.ts, registered here) or Live via the proxy with automatic fallback. A `business-score` answer renders the
 * score card from the world's own numbers (a Live answer only supplies wording).
 */
import { useEffect, useMemo } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, Icon, type ChatMessage as Bubble } from '../../demo-kit/ui'
import { clock, useSession, useWorld, world } from '../../demo-kit/world'
import { SUGGEST, ruContext, scoreCard } from './scenario'
import { uiStore } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: 'Tanya skor',
    eyebrow: 'Simulasi · bukan keputusan kredit',
    empty: 'Tanyakan kenapa skor berubah, cara menaikkannya, plafon, cicilan, atau data yang dibagikan. Angka diambil dari Rapor Usaha (simulasi).',
    card: 'Ringkasan skor',
    up: 'menaikkan',
    down: 'menurunkan',
    mode: { sim: 'Mode simulasi', live: 'Mode Live (AI)' },
    fell: 'Live tidak tersedia, memakai simulasi',
    ai: 'Rapor Usaha AI',
  },
  en: {
    title: 'Ask about the score',
    eyebrow: 'Simulation · not a credit decision',
    empty: 'Ask why the score changed, how to raise it, the limit, the instalment or the data you share. Numbers come from Rapor Usaha (simulated).',
    card: 'Score summary',
    up: 'raises',
    down: 'lowers',
    mode: { sim: 'Simulation mode', live: 'Live mode (AI)' },
    fell: 'Live unavailable, using the simulation',
    ai: 'Rapor Usaha AI',
  },
}
const LABEL = { id: 'Percakapan Tanya skor', en: 'Ask about the score conversation' }
const PH = { id: 'Tulis pertanyaan tentang skor atau modal…', en: 'Ask about the score or capital…' }
const SEND = { id: 'Kirim', en: 'Send' }

export default function Ask() {
  const { lang } = useT()
  const L = S[lang]
  const session = useSession()
  const chat = useAiChat('rapor-usaha', { mode: session.aiMode, role: session.role, getContext: () => ruContext(world.get(), clock.get().minutes) })
  useEffect(() => {
    chat.prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const bubbles: Bubble[] = useMemo(
    () => chat.messages.filter((m) => m.role === 'user' || m.content).map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content, author: m.role === 'user' ? undefined : L.ai })),
    [chat.messages, L.ai],
  )
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  const hasCard = !!last && last.status === 'done' && !!last.structured?.some((x) => x.kind === 'business-score')
  const thinking = last?.status === 'thinking' || (chat.busy && !last?.content)
  const chips = (last?.status === 'done' && last.followUps?.length ? last.followUps : chat.messages.length ? [] : SUGGEST(lang)).map((c) => ({ id: c, label: { id: c, en: c } }))
  return (
    <Drawer open onClose={() => uiStore.set({ ask: false })} title={L.title} eyebrow={L.eyebrow} width={480}>
      <div className="dk-ru-ask" data-ru="ask-drawer">
        {!chat.messages.length && <p className="dk-ru-muted">{L.empty}</p>}
        <ChatThread messages={bubbles} typing={thinking ? L.ai : false} quickReplies={chat.busy ? [] : chips} onQuick={(q) => void chat.send(q)} label={LABEL} />
        {hasCard && <ScoreCard L={L} lang={lang} />}
        <ChatComposer onSend={(q) => void chat.send(q)} placeholder={PH} label={LABEL} sendLabel={SEND} onFocus={chat.prepare} disabledReason={chat.busy ? { id: 'Menunggu jawaban…', en: 'Waiting for the answer…' } : undefined} />
        <p className="dk-ru-fine">
          <Icon name={session.aiMode === 'live' ? 'live' : 'spark'} size={14} /> {L.mode[session.aiMode]}
          {chat.fellBack ? ` · ${L.fell}` : ''}
        </p>
      </div>
    </Drawer>
  )
}

function ScoreCard({ L, lang }: { L: (typeof S)['id']; lang: 'id' | 'en' }) {
  const card = useWorld((s) => JSON.stringify(scoreCard(ruContext(s, clock.get().minutes), lang).data))
  const d = JSON.parse(card) as ReturnType<typeof scoreCard>['data']
  return (
    <section className="dk-ru-aicard" aria-label={L.card} data-ru="score-card">
      <h3>
        <Icon name="rapor" size={16} /> {L.card} · <span className="dk-num">{d.score}</span>
      </h3>
      <ul>
        {d.drivers.map((x) => (
          <li key={x.name}>
            <Icon name={x.direction === 'naik' ? 'trendUp' : 'trendDown'} size={14} /> <b>{x.name}</b> {x.direction === 'naik' ? L.up : L.down}: {x.note}
          </li>
        ))}
      </ul>
    </section>
  )
}
