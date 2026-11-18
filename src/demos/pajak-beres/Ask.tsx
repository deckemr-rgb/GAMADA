/**
 * Ask.tsx (lazy) — "Tanya Pajak" drawer: ChatThread + ChatComposer + suggestion chips. Sim scenario (scenario.ts,
 * registered here) or Live via the proxy with automatic fallback. The "Kenapa pajak bulan ini naik?" answer renders
 * the tax-breakdown card from the world's own numbers (a Live answer only supplies wording) and ticks the mission.
 * The owner can hand the question to the consultant (role switch).
 */
import { useEffect, useMemo } from 'react'
import { registerStructuredSchema, useAiChat, type ChatMessage } from '../../demo-kit/ai/chat'
import { useShell } from '../../demo-kit/shell'
import { Button, ChatComposer, ChatThread, Drawer, Icon, type ChatMessage as Bubble } from '../../demo-kit/ui'
import { setSession, useSession, useWorld, world } from '../../demo-kit/world'
import { pbContext } from './ctx'
import { SUGGEST, TAX_KINDS, breakdown } from './scenario'
import { rp, type RoleKey } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: 'Tanya Pajak',
    eyebrow: 'Simulasi · bukan nasihat pajak',
    label: { id: 'Percakapan Tanya Pajak', en: 'Ask Tax conversation' },
    ph: { id: 'Tulis pertanyaan pajak atau pembukuan…', en: 'Ask about tax or bookkeeping…' },
    send: { id: 'Kirim', en: 'Send' },
    empty: 'Tanyakan pajak bulan ini, tenggat, PPh 21 karyawan, atau laba. Angka diambil dari buku toko (simulasi).',
    card: 'Rincian pajak',
    delta: (v: string, up: boolean) => `${up ? 'Naik' : 'Turun'} ${v} dibanding bulan lalu (bulan ini belum selesai)`,
    toKonsultan: 'Tanyakan ke konsultan',
    sentTitle: 'Pertanyaan diteruskan ke Konsultan Pajak',
    sentBody: 'Sekarang Anda melihat Pajak Beres sebagai konsultan.',
    mode: { sim: 'Mode simulasi', live: 'Mode Live (AI)' },
    fell: 'Live tidak tersedia, memakai simulasi',
    ai: 'Pajak Beres AI',
  },
  en: {
    title: 'Ask Tax',
    eyebrow: 'Simulation · not tax advice',
    label: { id: 'Percakapan Tanya Pajak', en: 'Ask Tax conversation' },
    ph: { id: 'Tulis pertanyaan pajak atau pembukuan…', en: 'Ask about tax or bookkeeping…' },
    send: { id: 'Kirim', en: 'Send' },
    empty: "Ask about this month's tax, deadlines, employee PPh 21 or profit. Numbers come from the shop's books (simulated).",
    card: 'Tax breakdown',
    delta: (v: string, up: boolean) => `${up ? 'Up' : 'Down'} ${v} vs last month (this month is not over)`,
    toKonsultan: 'Ask the consultant',
    sentTitle: 'Question sent to the tax consultant',
    sentBody: 'You now see Pajak Beres as the consultant.',
    mode: { sim: 'Simulation mode', live: 'Live mode (AI)' },
    fell: 'Live unavailable, using the simulation',
    ai: 'Pajak Beres AI',
  },
}

// the Live tool's shape (prompts/pajak-beres.ts explain_tax); the card always shows the world's own numbers
registerStructuredSchema('pajak-beres/explain_tax', {
  safeParse: (v: unknown) => {
    const o = v as { period?: unknown; rows?: unknown; total?: unknown; delta?: unknown } | null
    const ok = !!o && typeof o.period === 'string' && Array.isArray(o.rows) && o.rows.length > 0 && typeof o.total === 'number' && typeof o.delta === 'number'
    return ok ? { success: true as const, data: v } : { success: false as const }
  },
})

export default function Ask({ open, onClose, roleKey, onCard, initial }: { open: boolean; onClose: () => void; roleKey: RoleKey; onCard: () => void; initial?: string | null }) {
  const { lang } = useT()
  const L = S[lang]
  const session = useSession()
  const { toast } = useShell()
  const chat = useAiChat('pajak-beres', { mode: session.aiMode, role: session.role, getContext: () => pbContext(world.get(), lang, roleKey) })

  useEffect(() => {
    chat.prepare()
    if (initial) void chat.send(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bubbles: Bubble[] = useMemo(
    () => chat.messages.filter((m) => m.role === 'user' || m.content).map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content, author: m.role === 'user' ? undefined : L.ai })),
    [chat.messages, L.ai],
  )
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  const hasCard = chat.messages.some((m) => m.role === 'assistant' && m.status === 'done' && m.structured?.some((x) => (TAX_KINDS as readonly string[]).includes(x.kind)))
  const thinking = last?.status === 'thinking' || (chat.busy && !last?.content)
  const chips = (last?.status === 'done' && last.followUps?.length ? last.followUps : chat.messages.length ? [] : SUGGEST(lang)).map((c) => ({ id: c, label: { id: c, en: c } }))

  return (
    <Drawer open={open} onClose={onClose} title={L.title} eyebrow={L.eyebrow} width={480} className="dk-pb-ask-ov">
      <div className="dk-pb-ask">
        {!chat.messages.length && <p className="dk-pb-muted">{L.empty}</p>}
        <ChatThread messages={bubbles} typing={thinking ? L.ai : false} quickReplies={chat.busy ? [] : chips} onQuick={(q) => void chat.send(q)} label={L.label} />
        {hasCard && <TaxCard onShown={onCard} />}
        <ChatComposer onSend={(q) => void chat.send(q)} placeholder={L.ph} label={L.label} sendLabel={L.send} onFocus={chat.prepare} disabledReason={chat.busy ? { id: 'Menunggu jawaban…', en: 'Waiting for the answer…' } : undefined} />
        <p className="dk-pb-ask-foot">
          <span>
            <Icon name={session.aiMode === 'live' ? 'live' : 'spark'} size={14} /> {L.mode[session.aiMode]}
            {chat.fellBack ? ` · ${L.fell}` : ''}
          </span>
          {roleKey === 'owner' && (
            <Button
              size="sm"
              variant="quiet"
              icon="user"
              onClick={() => {
                onClose()
                setSession({ role: 'konsultan-pajak' })
                toast({ title: L.sentTitle, body: L.sentBody, tone: 'accent', icon: 'user' })
              }}
              data-pb="ask-konsultan"
            >
              {L.toKonsultan}
            </Button>
          )}
        </p>
      </div>
    </Drawer>
  )
}

function TaxCard({ onShown }: { onShown: () => void }) {
  const { lang } = useT()
  const L = S[lang]
  const data = useWorld((s) => breakdown(pbContext(s, lang, 'owner'), lang), (a, b) => a.total === b.total && a.delta === b.delta && a.rows[0]?.amount === b.rows[0]?.amount && a.rows[0]?.label === b.rows[0]?.label)
  useEffect(() => {
    onShown()
  }, [onShown])
  return (
    <section className="dk-pb-taxcard" aria-label={L.card} data-pb="tax-card">
      <h3>
        <Icon name="pajak" size={16} /> {L.card}
      </h3>
      <dl className="dk-pb-dl">
        {data.rows.map((r) => (
          <div key={r.label} className="dk-pb-taxrow">
            <dt>
              {r.label}
              <small>{r.rule_ref}</small>
            </dt>
            <dd>{rp(r.amount, lang)}</dd>
          </div>
        ))}
      </dl>
      <p className="dk-pb-taxcard-d">{L.delta(rp(Math.abs(data.delta), lang), data.delta > 0)}</p>
      <p className="dk-pb-taxcard-tot" data-pb="tax-total">
        {rp(data.total, lang)}
      </p>
    </section>
  )
}

export type { ChatMessage }
