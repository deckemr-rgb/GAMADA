/**
 * demos/pantau-merek/Ask.tsx — one-question AI card (lazy; registers scenario.ts): a button that asks the simulated
 * analyst (Live when the shell's AI mode is Live; sim on invalid / timeout) and shows the answer under it. Used by
 * Kompetitor ("Bandingkan dengan AI") and the owner band ("Ringkas hari ini").
 */
import { useEffect, useRef } from 'react'
import { Button, Icon } from '../../demo-kit/ui'
import { useAiChat } from '../../demo-kit/ai/chat'
import { clock, useSession, world } from '../../demo-kit/world'
import { ensureScenario } from './scenario'
import { brandCtx } from './ctx'
import { useStr } from './strings'

ensureScenario()

export default function Ask({ prompt, label, pm, auto }: { prompt: string; label: string; pm: string; auto?: boolean }) {
  const { lang } = useStr()
  const session = useSession()
  const chat = useAiChat('pantau-merek', { mode: session.aiMode, role: session.role, lang, getContext: () => brandCtx(world.get(), clock.get().minutes) })
  const last = chat.last
  const once = useRef(false)
  const { send, stop } = chat
  useEffect(() => {
    if (!auto || once.current) return
    once.current = true
    let finished = false
    void send(prompt, { maxMs: 1500 }).finally(() => (finished = true))
    return () => {
      if (finished) return
      stop()
      once.current = false
    }
  }, [auto, prompt, send, stop])
  return (
    <div className="dk-pm-ask">
      <Button size="sm" variant="secondary" icon="spark" busy={chat.busy} disabled={chat.busy} onFocus={chat.prepare} onPointerEnter={chat.prepare} onClick={() => void chat.send(prompt, { maxMs: 1500 })} data-pm={pm}>
        {label}
      </Button>
      {last && (
        <p className="dk-pm-ai" aria-live="polite" onClick={chat.flush} data-pm={`${pm}-answer`}>
          <Icon name="spark" size={14} />
          {last.content || (lang === 'id' ? 'Menyusun jawaban…' : 'Writing the answer…')}
        </p>
      )}
    </div>
  )
}
