/**
 * Reasons (lazy) — "Tanya alasan": no free chat, 11 question chips; the answer is built from the case on screen
 * (scenario.ts, registered here). Live mode goes through the proxy (prompts/kenal-mitra.ts: kyc_decision,
 * kenal-mitra/rank_candidates on the anonymised pre-filtered pool only); an invalid answer or unknown candidate refs
 * fall back to the simulation.
 */
import { Fragment, useLayoutEffect, useRef } from 'react'
import { registerScenario, registerStructuredSchema, useAiChat, type Structured } from '../../demo-kit/ai/chat'
import { Drawer, Icon } from '../../demo-kit/ui'
import { useSession } from '../../demo-kit/world'
import { reasonCtx } from './model'
import { CHIP_IDS, kmScenario } from './scenario'
import { useCaseStr } from './strings-case'

registerScenario(kmScenario)
/** rank_candidates: shape + every ref must be one of the anonymised candidates the context sent (else ⇒ sim) */
registerStructuredSchema('kenal-mitra/rank_candidates', {
  safeParse(v: unknown) {
    const d = v as { ranked?: { ref?: unknown; fit?: unknown; reason?: unknown }[]; criteriaUsed?: unknown[] } | null
    const refs = new Set((reasonCtx.get().pool ?? []).map((x) => x.ref))
    const ok =
      !!d &&
      Array.isArray(d.ranked) &&
      d.ranked.length >= 1 &&
      d.ranked.length <= 10 &&
      d.ranked.every((r) => typeof r.ref === 'string' && refs.has(r.ref) && typeof r.fit === 'number' && r.fit >= 0 && r.fit <= 100 && typeof r.reason === 'string' && r.reason.length <= 200) &&
      Array.isArray(d.criteriaUsed) &&
      d.criteriaUsed.length >= 1 &&
      d.criteriaUsed.length <= 6
    return ok ? { success: true as const, data: d } : { success: false as const }
  },
})

/** **bold** spans of an answer */
function rich(text: string) {
  return text.split('**').map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>))
}
function RankList({ s }: { s: Structured }) {
  if (s.kind !== 'kenal-mitra/rank_candidates') return null
  const d = s.data as { ranked: { ref: string; fit: number; reason: string }[] }
  return (
    <ol className="dk-km-why-rank">
      {d.ranked.map((r) => (
        <li key={r.ref}>
          <b>{r.ref}</b> <span className="dk-num">{r.fit}</span> · {r.reason}
        </li>
      ))}
    </ol>
  )
}

export default function Reasons({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useCaseStr()
  const k = c.why
  const session = useSession()
  const chat = useAiChat('kenal-mitra', { getContext: () => reasonCtx.get(), mode: session.aiMode, role: session.role })
  const log = useRef<HTMLDivElement>(null)
  const last = chat.messages[chat.messages.length - 1]
  useLayoutEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, last?.content.length])
  const ctx = reasonCtx.get()
  const ask = (text: string) => {
    if (chat.busy) chat.stop()
    void chat.send(text, { maxMs: 1600 })
  }
  return (
    <Drawer open={open} onClose={onClose} title={k.title} eyebrow={session.aiMode === 'live' ? k.live : k.sim} width={460} className="dk-km-why-ov">
      <div className="dk-km-why-panel">
        <p className="dk-km-muted">{ctx.kind ? k.sub : k.none}</p>
        <div className="dk-km-why-log" ref={log} role="log" aria-live="polite" aria-label={k.title}>
          {chat.messages.map((m) => (
            <div key={m.id} className={`dk-km-why-msg is-${m.role}`}>
              {m.role === 'user' ? (
                <p>
                  <Icon name="help" size={14} /> {m.content}
                </p>
              ) : (
                <>
                  <p>{m.content ? rich(m.content) : k.thinking}</p>
                  {m.structured?.map((s, i) => <RankList key={i} s={s} />)}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="dk-km-why-chips" role="group" aria-label={k.asked}>
          {CHIP_IDS.map((id) => (
            <button key={id} type="button" className="dk-km-why-chip" onClick={() => ask(k.chips[id] ?? id)} onPointerEnter={chat.prepare} onFocus={chat.prepare} data-intent={id}>
              {k.chips[id]}
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  )
}
