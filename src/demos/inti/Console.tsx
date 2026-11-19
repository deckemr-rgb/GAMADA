/**
 * Console — GAMADA Inti's own orchestrator chat (inside the lazy Inti Agen tab; the AI engine loads on focus /
 * hover / first send). The context is built from the world at send time (≤ 6 KB): role + scope, the pulse, the
 * active alert, the last 15 Audit Log summaries, the trail of Ibu Siti's complaint, the inbox KPI and the role's
 * matrix row. Every finished answer becomes a trace (ai/trace) that the timeline next to it shows.
 */
import { useEffect, useMemo } from 'react'
import { useAiChat, type ChatMessage as AiMsg } from '../../demo-kit/ai/chat'
import { Button, ChatComposer, ChatThread, type ChatMessage } from '../../demo-kit/ui'
import { clock, hhmm, rows, useWorld, world, type WorldState } from '../../demo-kit/world'
import { accessMatrix, auditQuery, dataTrail, inboxKpi, type Scope } from '../../demo-kit/world/inti'
import { badgesOf } from '../../demo-kit/world/pasar-daerah'
import { PRODUCT_BY_SLUG, ROLES, isProductSlug, type RoleId } from '../../content/products'
import { registerIntiScenario, type IntiCtx } from './scenario'
import { PRODUCTS17, day0, productName, pulseOf, rootsOf } from './model'
import { tm, useT, type Lang } from './strings'

const S = {
  id: {
    title: 'Konsol orkestrator Inti',
    lead: 'Satu permintaan, beberapa agen di beberapa produk. Jawaban dan langkahnya muncul di jejak berpikir.',
    chipFlood: (k: string | null) => (k ? `Tangani banjir Kec. ${k} dari aduan sampai pengadaan` : 'Tangani banjir dari aduan sampai pengadaan'),
    chipTrail: 'Tampilkan jejak aduan Ibu Siti',
    chipAccess: 'Siapa yang bisa membuka Rapor Usaha?',
    chipDay: 'Ringkas hari ini',
    placeholder: 'Tulis permintaan lintas produk…',
    label: 'Pesan ke orkestrator Inti',
    send: 'Kirim',
    log: 'Percakapan orkestrator',
    showTrail: 'Tampilkan di Inti Data',
    plan: 'Rencana agen',
    access: (r: string, a: number, d: number) => `${r}: ${a} produk terbuka, ${d} tertutup`,
    busy: 'Tunggu jawaban selesai',
    chips: 'Contoh permintaan',
  },
  en: {
    title: 'Inti orchestrator console',
    lead: 'One request, several agents in several products. The answer and its steps appear in the reasoning trace.',
    chipFlood: (k: string | null) => (k ? `Handle the ${k} flood from complaint to procurement` : 'Handle the flood from complaint to procurement'),
    chipTrail: 'Show the trail of Ibu Siti’s complaint',
    chipAccess: 'Who can open Rapor Usaha?',
    chipDay: 'Summarise today',
    placeholder: 'Write a cross-product request…',
    label: 'Message to the Inti orchestrator',
    send: 'Send',
    log: 'Orchestrator conversation',
    showTrail: 'Show in Inti Data',
    plan: 'Agent plan',
    access: (r: string, a: number, d: number) => `${r}: ${a} products open, ${d} closed`,
    busy: 'Wait for the answer to finish',
    chips: 'Example requests',
  },
}

const M = accessMatrix()
const kecName = (s: WorldState, id: string | null | undefined) => (id ? s.region.kecamatan.find((k) => k.id === id)?.name ?? id : '')

/** the console's world summary (sim ctx.world; live: summarised ≤ 6 KB) */
function buildCtx(role: RoleId, scope: Scope, lang: Lang): IntiCtx {
  const s = world.get()
  const now = clock.get().minutes
  const roots = rootsOf(s, now)
  const pulse = pulseOf(s, now, scope)
  const alert = rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif') ?? null
  const siti = roots.siti ? s.complaints.byId[roots.siti.slice(11)] : undefined
  const cl = siti?.clusterId ? s.clusters.byId[siti.clusterId] : undefined
  const ins = cl ? rows(s.instructions).find((i) => i.refs.includes(`clusters:${cl.id}`)) : undefined
  const pump = roots.pump ? s.procurements.byId[roots.pump.slice(13)] : undefined
  const need = pump ? rows(s.catalogNeeds).find((n) => n.cause === `procurements:${pump.id}`) : undefined
  const trail = roots.siti && scope === 'semua' ? dataTrail(s, roots.siti) : null
  const kpi = inboxKpi(s, now, scope)
  const shop = s.businesses.byId[s.meta.shopId]
  const b = shop ? badgesOf(s, shop.id) : null
  const pd = s.meta.facts.pd
  const audit = auditQuery(s, { scope, from: day0(now), to: now }).slice(0, 15)
  const verifiedLocal = rows(s.businesses).filter((x) => badgesOf(s, x.id).verified).length
  return {
    product: 'inti',
    role,
    roleName: ROLES[role].name,
    scope,
    today: pulse.todayCount,
    top: Object.entries(pulse.perProduct).sort((a, b2) => (b2[1]?.count ?? 0) - (a[1]?.count ?? 0)).slice(0, 3).map(([k, v]) => ({ name: productName(k as never), count: v?.count ?? 0 })),
    alert: alert && scope === 'semua' ? { id: alert.id, kec: kecName(s, alert.kecamatanIds[0]), level: alert.level } : null,
    siti: siti && scope === 'semua' ? { code: siti.code, kec: kecName(s, siti.kecamatanId), cluster: cl ? cl.complaintIds.length : null } : null,
    instruction: ins && scope === 'semua' ? { at: tm(hhmm(ins.at), lang), opds: ins.opdIds.length } : null,
    pump: pump && scope === 'semua' ? { code: pump.code, hps: pump.hps } : null,
    need: need ? { code: need.code, item: need.items[0]?.name ?? { id: '', en: '' }, qty: need.items[0]?.qty ?? 0, unit: need.items[0]?.unit ?? '', matches: rows(s.matches).filter((m) => m.needId === need.id).length } : null,
    verifiedLocal,
    trail: trail
      ? { root: siti?.code ?? roots.siti, products: [...new Set(trail.rows.map((r) => r.product).filter(Boolean))].map((p) => productName(p)), rows: trail.spine.filter((x) => x.auditId).map((x) => ({ t: tm(hhmm(x.at ?? 0), lang), p: productName(x.product), x: s.auditLog.byId[x.auditId!]!.summary })) }
      : { root: null, products: [], rows: [] },
    inbox: { total: kpi.total, unread: kpi.unread, wa: kpi.byChannel.wa, web: kpi.byChannel.web, telepon: kpi.byChannel.telepon, calls: kpi.callsToday },
    access: Object.fromEntries(PRODUCTS17.map((p) => [p.slug, p.roles.map((r) => ROLES[r].name[lang])])),
    mine: { allowed: PRODUCTS17.filter((p) => M.allowed(role, p.slug)).map((p) => p.name), denied: PRODUCTS17.filter((p) => !M.allowed(role, p.slug)).map((p) => p.name) },
    names: Object.fromEntries(PRODUCTS17.map((p) => [p.slug, p.name])),
    audit: audit.map((a) => ({ t: tm(hhmm(a.at), lang), p: productName(a.product), x: a.summary })),
    shop: shop && b ? { name: shop.name, verified: b.verified, taxTidy: b.taxTidy, score: b.score } : null,
    prices: pd
      ? pd.shockCommodityIds.map((cid) => {
          const p = rows(s.prices).find((x) => x.marketId === pd.tickMarketId && x.commodityId === cid)
          const c = s.region.commodities.find((k) => k.id === cid)
          return { name: c?.name ?? { id: cid, en: cid }, market: s.markets.byId[pd.tickMarketId]?.name ?? pd.tickMarketId, price: p?.price ?? 0 }
        }).filter((p) => p.price > 0)
      : [],
    related: PRODUCT_BY_SLUG.inti.related.map((p) => productName(p)),
  }
}

const floodKec = (s: WorldState) => {
  const a = rows(s.alerts).find((x) => x.kind === 'banjir' && x.status === 'aktif')
  return a ? kecName(s, a.kecamatanIds[0]) : null
}

export default function Console({ role, scope, onShowTrail }: { role: RoleId; scope: Scope; onShowTrail: () => void }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const kec = useWorld(floodKec)
  const chat = useAiChat('inti', { getContext: () => buildCtx(role, scope, lang as Lang), role })
  useEffect(() => registerIntiScenario(), [])
  const chips = [L.chipFlood(scope === 'semua' ? kec : null), L.chipTrail, L.chipAccess, L.chipDay]
  const msgs = useMemo<ChatMessage[]>(
    () => chat.messages.filter((m) => m.content || m.role === 'user').map((m: AiMsg) => ({ id: m.id, side: m.role === 'user' ? 'me' : 'them', text: m.content })),
    [chat.messages],
  )
  const last = chat.last?.status === 'done' ? chat.last : null
  const st = last?.structured ?? []
  const planS = st.find((x) => x.kind === 'plan')?.data as { steps?: { product: string; action: string }[] } | undefined
  const trailS = st.find((x) => x.kind === 'inti/trail' || x.kind === 'inti/trace_entity')
  const accS = st.find((x) => x.kind === 'inti/access' || x.kind === 'inti/explain_access')?.data as { role?: string; allowed?: unknown[]; denied?: unknown[] } | undefined
  const send = (t: string) => {
    if (!chat.busy) void chat.send(t)
  }
  return (
    <section className="dk-in-box dk-in-console" aria-labelledby="dk-in-con-h" onPointerEnter={chat.prepare} onFocus={chat.prepare}>
      <h3 id="dk-in-con-h" className="dk-in-h3">
        {L.title}
      </h3>
      <p className="dk-in-muted">{L.lead}</p>
      <div className="dk-in-chips" role="group" aria-label={L.chips}>
        {chips.map((c, i) => (
          <button key={c} type="button" className="dk-in-root" data-in={i === 0 ? 'chip-flood' : `chip-${i}`} disabled={chat.busy} title={chat.busy ? L.busy : undefined} onClick={() => send(c)}>
            <span>{c}</span>
          </button>
        ))}
      </div>
      {msgs.length > 0 && <ChatThread messages={msgs} typing={chat.thinking} label={{ id: S.id.log, en: S.en.log }} className="dk-in-thread" />}
      {planS?.steps && (
        <ol className="dk-in-plan" aria-label={L.plan} data-in="plan">
          {planS.steps.map((p, i) => (
            <li key={i} data-eco={isProductSlug(p.product) ? PRODUCT_BY_SLUG[p.product].eco : undefined}>
              <b>{isProductSlug(p.product) ? productName(p.product) : p.product}</b> · {p.action}
            </li>
          ))}
        </ol>
      )}
      {trailS && (
        <Button variant="secondary" icon="layers" data-in="show-trail" onClick={onShowTrail}>
          {L.showTrail}
        </Button>
      )}
      {accS && Array.isArray(accS.allowed) && (
        <p className="dk-in-muted" data-in="access-answer">
          {L.access(ROLES[(accS.role as RoleId) ?? role]?.name[lang as Lang] ?? String(accS.role), accS.allowed.length, accS.denied?.length ?? 0)}
        </p>
      )}
      <ChatComposer onSend={send} placeholder={{ id: S.id.placeholder, en: S.en.placeholder }} label={{ id: S.id.label, en: S.en.label }} sendLabel={{ id: S.id.send, en: S.en.send }} disabledReason={chat.busy ? { id: S.id.busy, en: S.en.busy } : undefined} onFocus={chat.prepare} />
    </section>
  )
}
