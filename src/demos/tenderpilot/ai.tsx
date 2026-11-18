/**
 * ai.tsx (lazy) — the AI surfaces: `AiSummary` (Detail "Ringkas": the streamed summary + key requirements / risks /
 * deadline from the `tenderpilot/tender-summary` structure) and `Assistant` ("Tanya AI" drawer). Sim by default, Live
 * through the proxy with the automatic fallback; numbers come from the context (aiContext).
 */
import { useEffect, useRef } from 'react'
import { useAiChat, type ChatMessage } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, LoadingText, type ChatMessage as Bubble } from '../../demo-kit/ui'
import { clock, useSession, world } from '../../demo-kit/world'
import { aiContext } from './scenario'
import { useDocT } from './strings-doc'
import { useT } from './strings'

function useTpChat(tenderId: string | null) {
  const { lang } = useDocT()
  const session = useSession()
  const idRef = useRef(tenderId)
  idRef.current = tenderId
  return useAiChat('tenderpilot', { mode: session.aiMode, getContext: () => aiContext(world.get(), idRef.current, lang, clock.get().minutes) })
}

interface Summary { summary: string; keyRequirements: string[]; risks: string[]; deadline: string }
const summaryOf = (m: ChatMessage | null): Summary | null => (m?.structured?.find((x) => x.kind === 'tenderpilot/tender-summary' || x.kind === 'tenderpilot/summarize_tender')?.data as Summary | undefined) ?? null

export function AiSummary({ tenderId }: { tenderId: string }) {
  const { d, lang } = useDocT()
  const chat = useTpChat(tenderId)
  useEffect(() => {
    chat.reset()
    void chat.send(lang === 'id' ? 'Ringkas tender ini' : 'Summarise this tender', { maxMs: 1800 })
    return () => chat.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId])
  const last = chat.last
  const sum = last?.status === 'done' ? summaryOf(last) : null
  return (
    <div className="dk-tp-ai-body" aria-live="polite" data-tp="ai-summary" data-done={last?.status === 'done' ? '1' : '0'}>
      {!last?.content ? <LoadingText>{d.aiThinking}</LoadingText> : <p>{last.content}</p>}
      {sum && (
        <div className="dk-tp-ai-cols">
          <div>
            <h4>{d.aiKey}</h4>
            <ul>
              {sum.keyRequirements.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
          {sum.risks.length > 0 && (
            <div>
              <h4>{d.aiRisk}</h4>
              <ul>
                {sum.risks.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4>{d.aiDeadline}</h4>
            <p>{sum.deadline}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function Assistant({ open, onClose, tenderId }: { open: boolean; onClose: () => void; tenderId: string | null }) {
  const { d } = useDocT()
  const { t } = useT()
  const chat = useTpChat(tenderId)
  const mirror = useRef(false)
  mirror.current = !!(tenderId && world.get().tenders.byId[tenderId]?.procurementId)
  useEffect(() => {
    if (open) chat.prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const bubbles: Bubble[] = chat.messages.map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content || '…' }))
  const sugg = chat.messages.length ? chat.followUps : [...d.chatSuggest, ...(mirror.current ? [d.chatClarify] : [])]
  const code = tenderId ? world.get().tenders.byId[tenderId]?.code : null
  return (
    <Drawer open={open} onClose={onClose} title={d.chatTitle} eyebrow={code ?? t.feedTitle} width={460} className="dk-tp-chat-ov">
      <div className="dk-tp-chat">
        {!bubbles.length && <p className="dk-tp-muted">{d.chatEmpty}</p>}
        <ChatThread messages={bubbles} typing={chat.thinking} label={{ id: d.chatTitle, en: d.chatTitle }} />
        {sugg.length > 0 && (
          <div className="dk-tp-chat-chips" role="group" aria-label={d.chatChips}>
            {sugg.map((q) => (
              <button key={q} type="button" className="dk-chip dk-chip--neutral" disabled={chat.busy} onClick={() => void chat.send(q)}>
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}
        <ChatComposer onSend={(q) => void chat.send(q)} placeholder={{ id: d.chatPlaceholder, en: d.chatPlaceholder }} label={{ id: d.chatTitle, en: d.chatTitle }} sendLabel={{ id: d.chatSend, en: d.chatSend }} onFocus={chat.prepare} />
      </div>
    </Drawer>
  )
}
