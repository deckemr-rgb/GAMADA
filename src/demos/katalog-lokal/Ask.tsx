/**
 * "Tanya Katalog" (lazy drawer, preloaded on the button intent): chat over the open need (scenario.ts intents; sim by
 * default, Live through the proxy with the automatic fallback). A `katalog-lokal/compare` answer also shows its
 * ranking as a list.
 */
import { useEffect, useRef } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, type ChatMessage as Bubble } from '../../demo-kit/ui'
import { clock, useSession, world } from '../../demo-kit/world'
import { useI18n } from '../../lib/i18n'
import { aiContext } from './scenario'
import { SLUG, bizName } from './model'

const A = {
  id: {
    title: 'Tanya Katalog',
    empty: 'Tanya soal kebutuhan yang terbuka: urutan UMKM, harga, waktu kirim, pembayaran (simulasi).',
    chips: ['Kenapa urutannya begini?', 'Bandingkan tiga teratas', 'Apakah harganya wajar?', 'Apa arti lencananya?', 'Bagaimana pembayarannya?', 'Siapa yang memutuskan?'],
    chipsLabel: 'Pertanyaan contoh',
    ph: 'Tulis pertanyaan…',
    send: 'Kirim',
    rank: 'Peringkat usulan',
  },
  en: {
    title: 'Ask the Catalog',
    empty: 'Ask about the open need: the SME ranking, prices, delivery, payment (simulated).',
    chips: ['Why this ranking?', 'Compare the top three', 'Is the price fair?', 'What do the badges mean?', 'How is payment made?', 'Who decides?'],
    chipsLabel: 'Sample questions',
    ph: 'Type a question…',
    send: 'Send',
    rank: 'Suggested ranking',
  },
}

export default function Ask({ open, onClose, needId }: { open: boolean; onClose: () => void; needId: string | null }) {
  const { lang } = useI18n()
  const L = A[lang]
  const session = useSession()
  const idRef = useRef(needId)
  idRef.current = needId
  const chat = useAiChat(SLUG, { mode: session.aiMode, getContext: () => aiContext(world.get(), idRef.current, lang, clock.get().minutes) })
  useEffect(() => {
    if (open) chat.prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const bubbles: Bubble[] = chat.messages.map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content || '…' }))
  const sugg = chat.messages.length ? chat.followUps : L.chips
  const cmp = chat.last?.status === 'done' ? (chat.last.structured?.find((x) => x.kind.startsWith('katalog-lokal/compare'))?.data as { ranking?: { businessId: string; reason: string }[] } | undefined) : undefined
  const code = needId ? world.get().catalogNeeds.byId[needId]?.code : null
  return (
    <Drawer open={open} onClose={onClose} title={L.title} eyebrow={code ?? undefined} width={460} className="dk-kl-ask-ov">
      <div className="dk-kl-ask" data-kl="ask-panel">
        {!bubbles.length && <p className="dk-kl-muted">{L.empty}</p>}
        <ChatThread messages={bubbles} typing={chat.thinking} label={{ id: A.id.title, en: A.en.title }} />
        {cmp?.ranking && (
          <ol className="dk-kl-rank" aria-label={L.rank} data-kl="ai-rank">
            {cmp.ranking.map((r) => (
              <li key={r.businessId}>
                <b>{bizName(world.get(), r.businessId)}</b> — {r.reason}
              </li>
            ))}
          </ol>
        )}
        {sugg.length > 0 && (
          <div className="dk-kl-chips" role="group" aria-label={L.chipsLabel}>
            {sugg.map((q) => (
              <button key={q} type="button" className="dk-chip dk-chip--neutral" disabled={chat.busy} onClick={() => void chat.send(q)}>
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}
        <ChatComposer onSend={(q) => void chat.send(q)} placeholder={{ id: A.id.ph, en: A.en.ph }} label={{ id: A.id.title, en: A.en.title }} sendLabel={{ id: A.id.send, en: A.en.send }} onFocus={chat.prepare} />
      </div>
    </Drawer>
  )
}
