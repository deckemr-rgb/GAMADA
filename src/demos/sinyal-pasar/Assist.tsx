/**
 * Assist — "Tanya Sinyal Pasar" drawer (lazy): four task chips (jelaskan anomali, rekomendasi aksi, pesan untuk UMKM,
 * ringkas pasar) and a composer. Sim answers come from scenario.ts over a context built from the same selectors as
 * the screen; Live mode only rewrites wording and falls back to the simulation on an invalid answer or a 10 s timeout.
 */
import { useEffect, useMemo } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { ChatComposer, ChatThread, Drawer, type ChatMessage } from '../../demo-kit/ui'
import { clock, rows, useSession, world } from '../../demo-kit/world'
import { opSimulate, pdKpi, priceBoard, priceOutlook } from '../../demo-kit/world/pasar-daerah'
import { cName, mName } from './model'
import { registerSpScenario, type SpCtx } from './scenario'
import type { Lang } from './strings'
import { ui } from './store'

registerSpScenario()

const S = {
  id: { title: 'Tanya Sinyal Pasar', chips: ['Jelaskan anomali', 'Rekomendasi aksi', 'Pesan untuk UMKM', 'Ringkas pasar'], ph: 'Tanya soal harga, anomali, atau operasi pasar…', label: 'Pertanyaan untuk AI', log: 'Percakapan dengan AI', busy: 'AI sedang menjawab', note: 'Simulasi: angka dari papan harga di layar. Tanpa saran spekulasi atau penimbunan.' },
  en: { title: 'Ask Sinyal Pasar', chips: ['Explain the anomaly', 'Recommend actions', 'Message for UMKM', 'Summarise the market'], ph: 'Ask about prices, anomalies or market operations…', label: 'Question for the AI', log: 'Conversation with the AI', busy: 'The AI is answering', note: 'Simulation: numbers from the price board on screen. No speculation or hoarding advice.' },
}

function context(): SpCtx {
  const s = world.get()
  const now = clock.get().minutes
  const board = priceBoard(s, now)
  const day0 = Math.floor(now / 1440) * 1440
  const warns = rows(s.priceWarnings).filter((w) => w.at >= day0 && w.at <= now).sort((a, b) => b.at - a.at)
  const w0 = warns[0]
  const open = ui.get().detail
  const pick = (open && board.find((r) => r.id === open)) || board.find((r) => r.anomaly) || (w0 ? board.find((r) => r.commodityId === w0.commodityId && w0.marketIds.includes(r.marketId)) : undefined) || board[0]
  let focus: SpCtx['focus'] = null
  if (pick) {
    const o = priceOutlook(s, pick.id, now)
    const shock = rows(s.priceShocks).find((x) => x.commodityId === pick.commodityId)
    const marketIds = shock?.marketIds ?? [pick.marketId]
    const sim = opSimulate(s, { commodityId: pick.commodityId, marketIds, volumeTon: 10, days: 3 }, now)
    const afterPeak = o && sim.forecastAfter.length ? Math.round((Math.max(...sim.forecastAfter) / o.expected - 1) * 1000) / 10 : 0
    focus = {
      commodityId: pick.commodityId, item: cName(s, pick.commodityId), market: mName(s, pick.marketId), marketIds, markets: marketIds.map((m) => mName(s, m)), price: pick.price, deltaPct: pick.deltaPct,
      peakPct: o?.peakPct ?? 0, peakDay: o?.peakDay ?? 0, factors: (o?.factors ?? []).map((f) => ({ label: f.label, pct: f.pct })), effectPct: sim.effectPct, afterPeakPct: afterPeak, costRp: sim.costRp,
    }
  }
  const k = pdKpi(s, now)
  return {
    product: 'sinyal-pasar',
    rows: board.slice(0, 10).map((r) => ({ item: cName(s, r.commodityId), market: mName(s, r.marketId), price: r.price, weekPct: r.weekPct, deltaPct: r.deltaPct, anomaly: r.anomaly })),
    focus,
    warning: w0 ? { commodityId: w0.commodityId, item: cName(s, w0.commodityId), peakPct: w0.peakPct, peakInDays: w0.peakInDays, market: mName(s, w0.marketIds[0] ?? '') } : null,
    anomalies: k.anomalies,
    warnings: k.warnings,
    subscribers: k.subscribers,
    ops: rows(s.marketOps).filter((o) => o.stage !== 'done' && o.stage !== 'dismissed').map((o) => ({ id: o.id, item: cName(s, o.commodityId), stage: { id: o.stage === 'recommended' ? 'diusulkan' : o.stage === 'approved' ? 'disetujui' : 'berjalan', en: o.stage } })),
  }
}

export default function Assist({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, aiMode } = useSession()
  const t = S[lang as Lang]
  const chat = useAiChat('sinyal-pasar', { getContext: () => context(), mode: aiMode })
  const { prepare } = chat
  useEffect(() => prepare(), [prepare])
  const msgs: ChatMessage[] = useMemo(() => chat.messages.map((m) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content })), [chat.messages])
  return (
    <Drawer open={open} onClose={onClose} title={t.title} width={460} className="dk-sp-ov">
      <div className="dk-sp-assist" data-sp="assist">
        <div className="dk-sp-chips">
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
        <small className="dk-sp-muted">{t.note}</small>
      </div>
    </Drawer>
  )
}
