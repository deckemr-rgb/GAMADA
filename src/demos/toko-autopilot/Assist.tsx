/**
 * Assist — "Tanya AI" drawer (lazy): four task chips (jelaskan prediksi, susun PO, saran harga, atur shift) and a
 * composer. Sim answers come from scenario.ts over a context built from the same selectors as the screen; Live mode
 * only rewrites wording and falls back to the simulation on an invalid answer or a 10 s timeout (kit).
 */
import { useEffect, useMemo } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, type ChatMessage } from '../../demo-kit/ui'
import { clock, hhmm, useSession, world } from '../../demo-kit/world'
import { activeFloodAlert, demandForecast, floodBanner, poSuggestions, priceSuggestions, shiftPlan, stockRisk } from '../../demo-kit/world/usaha-pintar'
import { STRINGS, tm, useT } from './strings'
import { registerTokoScenario, type TokoCtx } from './scenario'
import type { TabId } from './strings'

registerTokoScenario()

const S = {
  id: { title: 'Tanya AI · Toko Autopilot', chips: ['Jelaskan prediksi stok', 'Susun PO', 'Saran harga', 'Atur shift'], ph: 'Tanya soal stok, PO, harga, atau shift…', label: 'Pertanyaan untuk AI', log: 'Percakapan dengan AI', busy: 'AI sedang menjawab', note: 'Simulasi: angka dari data toko di layar.' },
  en: { title: 'Ask AI · Toko Autopilot', chips: ['Explain the stock forecast', 'Draft a PO', 'Price suggestion', 'Plan shifts'], ph: 'Ask about stock, POs, prices or shifts…', label: 'Question for the AI', log: 'Conversation with the AI', busy: 'The AI is answering', note: 'Simulation: numbers from the shop data on screen.' },
}

function context(outletId: string, lang: 'id' | 'en'): TokoCtx {
  const s = world.get()
  const now = clock.get().minutes
  const risk = stockRisk(s, outletId || 'semua', now).slice(0, 10).map((r) => {
    const f = demandForecast(s, r.productId, now)
    return { name: r.name, onHand: r.onHand, daysLeft: r.daysLeft, unit: s.products.byId[r.productId]?.unit ?? '', factors: (f?.factors ?? []).map((k) => ({ label: k.label, pct: k.pct })) }
  })
  const g = poSuggestions(s, now)[0]
  const fb = floodBanner(s)
  const plan = shiftPlan(s, outletId, now).extra[0]
  const st = plan?.staffId ? s.staff.byId[plan.staffId] : undefined
  const T = STRINGS[lang]
  return {
    product: 'toko-autopilot',
    outletId,
    outlet: s.outlets.byId[outletId]?.name ?? '',
    flood: fb ? { pct: fb.pct, text: fb.text } : activeFloodAlert(s) ? { pct: 0, text: activeFloodAlert(s)!.title } : null,
    risk,
    po: g ? { supplier: g.supplierName, code: g.code, total: g.total, lead: g.leadDays, items: g.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, why: i.why })) } : null,
    price: priceSuggestions(s, outletId).map((p) => ({ productId: p.productId, name: p.name, from: p.from, to: p.to, marginDelta: p.marginDelta, locked: p.locked ?? null })),
    shift: plan && st ? { day: T.days[plan.day]!, start: tm(hhmm(plan.start), lang), end: tm(hhmm(plan.end), lang), staff: st.name, reason: plan.reason } : null,
  }
}

export default function Assist({ open, onClose, outletId }: { open: boolean; onClose: () => void; tab: TabId; outletId: string }) {
  const { lang } = useT()
  const t = S[lang]
  const { aiMode } = useSession()
  const chat = useAiChat('toko-autopilot', { getContext: () => context(outletId, lang), mode: aiMode })
  const { prepare } = chat
  useEffect(() => prepare(), [prepare])
  const msgs: ChatMessage[] = useMemo(() => chat.messages.map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content })), [chat.messages])
  return (
    <Drawer open={open} onClose={onClose} title={t.title} width={460} className="dk-ta-ov">
      <div className="dk-ta-assist" data-ta="assist">
        <div className="dk-ta-chips">
          {t.chips.map((c) => (
            <button key={c} type="button" className="dk-chip" disabled={chat.busy} onClick={() => void chat.send(c, { maxMs: 2000 })}>
              {c}
            </button>
          ))}
        </div>
        <ChatThread label={{ id: S.id.log, en: S.en.log }} messages={msgs} typing={chat.thinking} />
        <ChatComposer
          label={{ id: S.id.label, en: S.en.label }}
          placeholder={{ id: S.id.ph, en: S.en.ph }}
          onSend={(v) => void chat.send(v, { maxMs: 2000 })}
          onFocus={prepare}
          {...(chat.busy ? { disabledReason: { id: S.id.busy, en: S.en.busy } } : {})}
        />
        <small className="dk-ta-muted">{t.note}</small>
      </div>
    </Drawer>
  )
}
