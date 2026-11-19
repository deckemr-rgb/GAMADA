/**
 * Assist — "Tanya ekonom" drawer (lazy): four task chips (jelaskan kecamatan, peringkat, dampak program, susun
 * briefing) and a composer. Sim answers come from scenario.ts over a context of visible cells only (hidden kecamatan
 * listed by name, never with a number); Live mode only rewrites wording and falls back on invalid / 10 s (kit).
 * A ranking answer also shows the local bar list of the kecamatan it names.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, type ChatMessage } from '../../demo-kit/ui'
import { clock, rows, useSession, world } from '../../demo-kit/world'
import { econEvents, econFrame, econSeries, programImpact, programList } from '../../demo-kit/world/pasar-daerah'
import { registerIeScenario, type IeCtx } from './scenario'
import { monthLabel, nf, useT, type Lang } from './strings'
import type { View } from './types'

registerIeScenario()

const S = {
  id: { title: 'Tanya ekonom · Indeks Ekonomi', chips: (k: string) => [`Jelaskan kecamatan ${k}`, 'Peringkat kecamatan', 'Dampak program', 'Susun briefing'], ph: 'Tanya soal kecamatan, peringkat, dampak, atau briefing…', label: 'Pertanyaan untuk AI', log: 'Percakapan dengan AI', busy: 'AI sedang menjawab', note: 'Simulasi: angka dari layar; kecamatan < 10 usaha tidak pernah diberi angka.', rank: 'Peringkat yang disebut' },
  en: { title: 'Ask the economist · Economic Index', chips: (k: string) => [`Explain the district ${k}`, 'Rank the districts', 'Programme impact', 'Draft a briefing'], ph: 'Ask about a district, the ranking, impact or a briefing…', label: 'Question for the AI', log: 'Conversation with the AI', busy: 'The AI is answering', note: 'Simulation: numbers from the screen; districts with < 10 businesses never get a number.', rank: 'Districts named' },
}

function context(view: View, lang: Lang): IeCtx {
  const s = world.get()
  const now = clock.get().minutes
  const ym = view.months[view.months.length - 1]!
  const f = econFrame(s, ym)
  const name = (k: string) => s.region.kecamatan.find((x) => x.id === k)?.name ?? k
  const kab = econSeries(s, null).points
  const cur = kab[kab.length - 1]
  const prev = kab[kab.length - 2]
  const alert = rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif')
  void lang
  return {
    product: 'indeks-ekonomi',
    region: s.region.name,
    month: { id: monthLabel('id', ym), en: monthLabel('en', ym) },
    kab: { index: cur?.index ?? null, delta: cur?.index != null && prev?.index != null ? Math.round((cur.index - prev.index) * 10) / 10 : null, omzet: f.omzetTotal },
    cells: f.rank.map((r) => ({ id: r.kecId, name: name(r.kecId), index: r.index, delta: r.delta })),
    hidden: f.hidden.map((k) => ({ id: k, name: name(k) })),
    selected: view.sel && !f.hidden.includes(view.sel) ? view.sel : null,
    events: econEvents(s, now).filter((e) => !e.hidden).map((e) => ({ kec: name(e.kecId), delta: e.delta, reason: e.reason, kind: e.kind })),
    alert: alert ? { kecamatan: alert.kecamatanIds.map(name) } : null,
    programs: programList(s).map((p) => {
      const im = p.measured ? programImpact(s, p.id, now) : null
      return { id: p.id, title: p.title, kind: p.kind, effectPct: im?.effectPct ?? s.marketOps.byId[p.id]?.effectPct ?? null, didPct: im?.didPct ?? null, measured: p.measured }
    }),
  }
}

export default function Assist({ view, prompt, onClose }: { view: View; prompt?: string; onClose: () => void }) {
  const { lang } = useT()
  const t = S[lang]
  const { aiMode } = useSession()
  const chat = useAiChat('indeks-ekonomi', { getContext: () => context(view, lang), mode: aiMode })
  const { prepare } = chat
  useEffect(() => prepare(), [prepare])
  const sent = useRef(false)
  useEffect(() => {
    if (!prompt || sent.current) return
    sent.current = true
    void chat.send(prompt, { maxMs: 2000 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt])
  const msgs: ChatMessage[] = useMemo(() => chat.messages.map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content })), [chat.messages])
  const s = world.get()
  const f = econFrame(s, view.months[view.months.length - 1]!)
  const low = f.rank[f.rank.length - 1]?.kecId
  const kName = (k: string) => s.region.kecamatan.find((x) => x.id === k)?.name ?? k
  const target = view.sel && !f.hidden.includes(view.sel) ? kName(view.sel) : low ? kName(low) : ''
  // a ranking answer: the local bar list of the kecamatan it names (same numbers as the map)
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant' && m.status !== 'streaming')
  const ranked = last?.intentId === 'peringkat' ? ((last.structured?.find((x) => x.kind === 'insight')?.data.kecamatan as string[] | undefined) ?? []) : []
  const bars = ranked.map((n) => {
    const r = f.rank.find((x) => kName(x.kecId) === n)
    return { n, v: r?.index ?? 0 }
  })
  const max = Math.max(1, ...bars.map((b) => b.v))
  return (
    <Drawer open onClose={onClose} title={t.title} width={460} className="dk-ie-ov">
      <div className="dk-ie-assist" data-ie="assist">
        <div className="dk-ie-chips">
          {t.chips(target).map((c) => (
            <button key={c} type="button" className="dk-chip" disabled={chat.busy} onClick={() => void chat.send(c, { maxMs: 2000 })}>
              {c}
            </button>
          ))}
        </div>
        <ChatThread label={{ id: S.id.log, en: S.en.log }} messages={msgs} typing={chat.thinking} />
        {bars.length > 0 && (
          <figure className="dk-ie-minibars" aria-label={t.rank} data-ie="ai-bars">
            {bars.map((b) => (
              <div key={b.n}>
                <span>{b.n}</span>
                <span className="dk-ie-rbar" aria-hidden="true"><span style={{ transform: `scaleX(${b.v / max})` }} /></span>
                <span className="dk-num">{nf(lang, b.v, 1)}</span>
              </div>
            ))}
          </figure>
        )}
        <ChatComposer
          label={{ id: S.id.label, en: S.en.label }}
          placeholder={{ id: S.id.ph, en: S.en.ph }}
          onSend={(v) => void chat.send(v, { maxMs: 2000 })}
          onFocus={prepare}
          {...(chat.busy ? { disabledReason: { id: S.id.busy, en: S.en.busy } } : {})}
        />
        <small className="dk-ie-muted">{t.note}</small>
      </div>
    </Drawer>
  )
}
