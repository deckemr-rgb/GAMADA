/**
 * AskBox — the always-loaded shell of "Tanya data": heading, input and three example questions. The chat itself
 * (AskData: AI hook, scenario, query engine, charts) is fetched on the first sign of use (focus, hover, a chip, a
 * submit) and takes over with whatever was typed; a question asked before it arrived is sent as soon as it does.
 */
import { lazy, startTransition, Suspense, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { Button, Icon, Input } from '../../demo-kit/ui'
import { useWorld } from '../../demo-kit/world'
import { causeQuestion, risingCategory, useNow } from './data'
import type { InstructionPreset } from './index'
import { tr } from './strings'

const load = () => import('./AskData')
const AskData = lazy(load)

export interface AskProps {
  onFly: (kecamatanId: string, reveal?: boolean) => void
  onInstruct: (p: InstructionPreset) => void
  onAnswered: () => void
  leader: string
}

export function AskBox(props: AskProps) {
  const { lang } = useI18n()
  const [on, setOn] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  // is the stub's input still the place the viewer is typing? (read when the chat takes over, see AskData)
  const focused = useRef(false)
  const now = useNow(60)
  const q1 = causeQuestion(useWorld((s) => risingCategory(s, now)))
  // a transition: the stub (and the input being typed in) stays mounted until the chat chunk has arrived, then AskData
  // takes over with the current draft, focus and caret; a plain update would swap in the Suspense fallback, a NEW
  // stub whose input loses focus and whatever is typed during the load
  const wake = () => {
    if (!on) {
      void load().catch(() => {})
      startTransition(() => setOn(true))
    }
  }
  const ask = (q: string) => {
    if (!q.trim()) return
    setPending(q)
    wake()
  }
  const stub = (
    <section className="dk-mp-panel dk-mp-ask" aria-labelledby="dk-mp-ask-h" onPointerEnter={wake}>
      <header className="dk-mp-ph">
        <h3 id="dk-mp-ask-h">
          <Icon name="spark" size={16} />
          {tr('ask', lang)}
        </h3>
      </header>
      <div className="dk-mp-pb dk-mp-ask-body">
        <p className="dk-mp-meta">{on ? tr('loadingAsk', lang) : tr('askHint', lang)}</p>
        <div className="dk-mp-chips">
          {[q1[lang], tr('askQ2', lang), tr('askQ3', lang)].map((q) => (
            <button key={q} type="button" className="dk-mp-qchip" onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>
      <form
        className="dk-mp-askform"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          ask(draft)
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={() => { focused.current = true; wake() }} onBlur={(e) => { if (e.relatedTarget) focused.current = false }} placeholder={tr('askPh', lang)} aria-label={tr('askLabel', lang)} />
        <Button type="submit" variant="primary" size="sm" icon="send" disabled={!draft.trim()}>
          {tr('askSend', lang)}
        </Button>
      </form>
    </section>
  )
  // one boundary, always mounted with the stub as its content: switching to AskData inside a transition then keeps
  // the stub on screen while the chunk loads (a boundary mounted fresh would show its fallback, i.e. a remount)
  return <Suspense fallback={stub}>{on ? <AskData {...props} draft={draft} pending={pending} onPendingTaken={() => setPending(null)} autoFocus={focused} /> : stub}</Suspense>
}
