/**
 * siaga-wilayah/AskAi.tsx — "Tanya Geo-AI" drawer (lazy). Simulasi: the scenario in scenario.ts (14 intents, ID / EN /
 * Basa Jawa) answering from geoContext(); Live: the proxy (prompts/siaga-wilayah.ts, tool draft_alert) with the same
 * context, falling back to Simulasi when Live is unavailable. A drafted warning can be opened in the broadcast dialog.
 */
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAiChat, type ChatMessage } from '../../demo-kit/ai/chat'
import { Button, Drawer, Icon, Textarea } from '../../demo-kit/ui'
import { currentRegion, rows, useSession, world } from '../../demo-kit/world'
import { regionalLanguageLabel } from '../../demo-kit/i18n'
import { canSend, draftLevel, swRole } from './data'
import { geoContext } from './scenario'
import { fill, type Bi } from './strings'
import { ui } from './ui'
import './more.css'

const T = {
  title: { id: 'Tanya Geo-AI', en: 'Ask Geo-AI' },
  eyebrow: { id: 'Siaga Wilayah · {m}', en: 'Siaga Wilayah · {m}' },
  sim: { id: 'mode Simulasi', en: 'Simulation mode' },
  live: { id: 'mode Live', en: 'Live mode' },
  hello: { id: 'Tanyakan situasi banjir, desa terdampak, muka air, posko, dampak panen, atau minta saya menyusun peringatan dini.{rl}', en: 'Ask about the flood situation, affected villages, water levels, shelters, the harvest impact, or ask me to draft an early warning.{rl}' },
  placeholder: { id: 'Tulis pertanyaan…', en: 'Type a question…' },
  send: { id: 'Kirim', en: 'Send' },
  stop: { id: 'Hentikan', en: 'Stop' },
  you: { id: 'Anda', en: 'You' },
  ai: { id: 'Geo-AI', en: 'Geo-AI' },
  thinking: { id: 'Geo-AI sedang membaca peta…', en: 'Geo-AI is reading the map…' },
  steps: { id: 'Langkah agent', en: 'Agent steps' },
  draft: { id: 'Draf peringatan', en: 'Warning draft' },
  use: { id: 'Pakai draf ini', en: 'Use this draft' },
  fell: { id: 'AI Live sedang sibuk, beralih ke Simulasi', en: 'Live AI is busy, switched to Simulation' },
  translation: { id: 'Terjemahan', en: 'Translation' },
  q1: { id: 'Bagaimana situasi banjir sekarang?', en: "What's the flood situation now?" },
  q2: { id: 'Desa mana yang paling cepat tergenang?', en: 'Which villages flood first?' },
  q3: { id: 'Susun peringatan dini untuk {k}', en: 'Draft an early warning for {k}' },
  q4: { id: '{d} jebol ta?', en: 'Is {d} about to burst?' },
} satisfies Record<string, Bi>

/** " Bisa juga dalam Basa Sunda." for a region whose language the scenario understands (Jawa / Sunda / Minang) */
function rlHint(lang: 'id' | 'en'): string {
  const p = currentRegion()
  const name = ['jv', 'su', 'min'].includes(p?.languages.regional[0] ?? '') ? regionalLanguageLabel(p, lang) : null
  return name ? (lang === 'id' ? ` Bisa juga dalam ${name}.` : ` ${name} works too.`) : ''
}

export default function AskAi() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const session = useSession()
  const role = swRole(session.role)
  const chat = useAiChat('siaga-wilayah', { mode: session.aiMode, role: session.role, getContext: () => geoContext(lang) })
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.messages])
  const prepare = chat.prepare
  useEffect(() => prepare(), [prepare])

  const ask = (q: string) => {
    if (!q.trim()) return
    setText('')
    void chat.send(q)
  }
  const chips = chat.followUps.length ? chat.followUps : chat.messages.length ? [] : starters(L)
  return (
    <Drawer open onClose={() => ui.set({ aiOpen: false })} title={L('title')} eyebrow={L('eyebrow', { m: session.aiMode === 'live' ? L('live') : L('sim') })} width={440}>
      <div className="dk-sg-ai">
        <div className="dk-sg-ai-log" aria-live="polite">
          <p className="dk-sg-ai-msg is-ai">{L('hello', { rl: rlHint(lang) })}</p>
          {chat.messages.map((m) => (
            <Msg key={m.id} m={m} L={L} canSend={canSend(role)} />
          ))}
          <div ref={endRef} />
        </div>
        {chips.length > 0 && (
          <div className="dk-sg-chips">
            {chips.map((c) => (
              <button key={c} type="button" className="dk-sg-qchip" onClick={() => ask(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          className="dk-sg-ai-form"
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
        >
          <Textarea
            rows={2}
            value={text}
            placeholder={L('placeholder')}
            aria-label={L('placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(text)
              }
            }}
            data-sw="ai-input"
            data-autofocus=""
          />
          {chat.busy ? (
            <Button type="button" variant="secondary" icon="pause" onClick={chat.stop}>
              {L('stop')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon="send" disabled={!text.trim()}>
              {L('send')}
            </Button>
          )}
        </form>
      </div>
    </Drawer>
  )
}

/** starter questions named after this region's flood kecamatan and dam (no hard-coded place names) */
function starters(L: (k: keyof typeof T, v?: Record<string, string | number>) => string): string[] {
  const s = world.get()
  const kec = s.region.kecamatan.find((k) => k.id === s.region.floodKecamatanIds[0])?.name
  const dam = rows(s.gauges).find((g) => g.kind === 'waduk')?.name
  return [L('q1'), L('q2'), ...(kec ? [L('q3', { k: kec })] : []), ...(dam ? [L('q4', { d: dam })] : [])]
}

function Msg({ m, L, canSend: send }: { m: ChatMessage; L: (k: keyof typeof T) => string; canSend: boolean }) {
  if (m.role === 'user') return <p className="dk-sg-ai-msg is-me">{m.content}</p>
  const alert = m.structured?.find((x) => x.kind === 'alert')?.data as { level?: string; areas?: string[]; message?: string; channels?: string[] } | undefined
  return (
    <div className="dk-sg-ai-msg is-ai" aria-busy={m.status === 'thinking' || m.status === 'streaming'}>
      {m.status === 'thinking' ? (
        <span className="dk-sg-dots" aria-label={L('thinking')}>
          <i />
          <i />
          <i />
        </span>
      ) : (
        <p>{m.content}</p>
      )}
      {m.translation && (
        <p className="dk-sg-fine">
          {L('translation')}: {m.translation}
        </p>
      )}
      {!!m.toolCalls?.length && (
        <p className="dk-sg-steps">
          <span className="dk-sg-sr">{L('steps')}: </span>
          {m.toolCalls.map((c) => (
            <span key={c.id} className="dk-sg-step">
              <Icon name="zap" size={12} />
              {c.name}
              {c.ms ? ` · ${c.ms} ms` : ''}
            </span>
          ))}
        </p>
      )}
      {alert?.message && (
        <div className="dk-sg-draft">
          <p className="dk-sg-fslabel">
            {L('draft')} · LEVEL {draftLevel(alert)} · {(alert.areas ?? []).join(', ')}
          </p>
          <p>{alert.message}</p>
          {send && (
            <Button
              size="sm"
              variant="primary"
              icon="send"
              onClick={() =>
                ui.set({
                  draft: { level: draftLevel(alert), message: alert.message ?? '', channels: alert.channels ?? ['wa', 'sms'], areas: alert.areas ?? [] },
                  aiOpen: false,
                  broadcastOpen: true,
                })
              }
            >
              {L('use')}
            </Button>
          )}
        </div>
      )}
      {m.fellBack && <p className="dk-sg-fine">{L('fell')}</p>}
    </div>
  )
}
