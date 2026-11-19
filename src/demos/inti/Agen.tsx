/**
 * Inti Agen (lazy) — the last 10 agent runs of ANY product in this session (ai/trace ring; an answer given in Sapa
 * Warga is here after navigating), the selected run as a TraceTimeline, and Inti's own orchestrator console. No
 * seeded traces: an empty ring is an honest empty state (the console's chip starts one).
 */
import { useEffect, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { useAiTraces } from '../../demo-kit/ai/trace'
import type { Scope } from '../../demo-kit/world/inti'
import { PRODUCT_BY_SLUG, ROLES, type RoleId } from '../../content/products'
import { TraceTimeline, traceSteps } from './TraceTimeline'
import Console from './Console'
import { useT, type Lang } from './strings'

const S = {
  id: {
    list: 'Permintaan terakhir (maks. 10, sesi ini)',
    from: (p: string, t: string) => `dari ${p} ${t}`,
    as: (r: string) => `sebagai ${r}`,
    emptyT: 'Belum ada agen yang berjalan di sesi ini',
    emptyB: 'Tanyakan sesuatu di produk mana pun (mis. Sapa Warga), atau pakai contoh permintaan di konsol di bawah. Jejak berpikirnya muncul di sini.',
    trace: 'Jejak berpikir',
  },
  en: {
    list: 'Latest requests (max 10, this session)',
    from: (p: string, t: string) => `from ${p} ${t}`,
    as: (r: string) => `as ${r}`,
    emptyT: 'No agent has run in this session yet',
    emptyB: 'Ask something in any product (e.g. Sapa Warga), or use an example request in the console below. Its reasoning trace appears here.',
    trace: 'Reasoning trace',
  },
}
const hm = (hh: number, mm: number, lang: Lang) => {
  const h = String(hh).padStart(2, '0')
  const m = String(mm).padStart(2, '0')
  return lang === 'id' ? `${h}.${m}` : `${h}:${m}`
}
/** the world clock of the answer (a trace saved before it carried one: its wall-clock time) */
const when = (t: { at: number; worldAt?: number }, lang: Lang) => {
  if (t.worldAt != null) return hm(Math.floor(t.worldAt / 60) % 24, Math.floor(t.worldAt) % 60, lang)
  const d = new Date(t.at)
  return hm(d.getHours(), d.getMinutes(), lang)
}

export default function Agen({ role, scope, onShowTrail }: { role: RoleId; scope: Scope; onShowTrail: () => void }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const traces = useAiTraces()
  const { markMission } = useShell()
  const [sel, setSel] = useState<string | null>(null)
  const cur = traces.find((t) => t.id === sel) ?? traces[0] ?? null
  const steps = cur ? traceSteps(cur) : 0
  useEffect(() => {
    if (cur && steps >= 4) markMission('agen')
  }, [cur, steps, markMission])
  return (
    <div className="dk-in-agen" data-tour="in-agent">
      {cur ? (
        <div className="dk-in-agen-grid">
          <section className="dk-in-box" aria-labelledby="dk-in-tr-h">
            <h2 id="dk-in-tr-h" className="dk-in-h3">
              {L.list}
            </h2>
            <ul className="dk-in-trlist">
              {traces.map((t) => (
                <li key={t.id}>
                  <button type="button" className={`dk-in-tr${t.id === cur.id ? ' is-on' : ''}`} aria-pressed={t.id === cur.id} data-eco={PRODUCT_BY_SLUG[t.product]?.eco} onClick={() => setSel(t.id)}>
                    <span className="dk-in-tr-from">{L.from(PRODUCT_BY_SLUG[t.product]?.name ?? t.product, when(t, lang as Lang))}</span>
                    <span className="dk-in-tr-q">{t.prompt}</span>
                    <span className="dk-in-muted">
                      {L.as(ROLES[t.role]?.name[lang as Lang] ?? t.role)} · {t.mode === 'live' ? 'Live' : 'Sim'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="dk-in-box" aria-labelledby="dk-in-tl-h">
            <h2 id="dk-in-tl-h" className="dk-in-h3">
              {L.trace} · {PRODUCT_BY_SLUG[cur.product]?.name}
            </h2>
            <p className="dk-in-tr-q">“{cur.prompt}”</p>
            <TraceTimeline trace={cur} lang={lang as Lang} />
          </section>
        </div>
      ) : (
        <div className="dk-in-box dk-in-empty" data-in="agen-empty">
          <p className="dk-in-empty-t">{L.emptyT}</p>
          <p className="dk-in-muted">{L.emptyB}</p>
        </div>
      )}
      <Console role={role} scope={scope} onShowTrail={onShowTrail} />
    </div>
  )
}
