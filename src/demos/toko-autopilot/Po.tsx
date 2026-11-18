/**
 * PO — poSuggestions grouped per supplier (each line shows the shortfall formula; drafts from the flood / price
 * reactions carry their poId so "Setujui & kirim" patches the draft), then the sent POs with status chips. Sending
 * opens PoChat (typing 1.6 s, none under reduced motion) with the reaction's supplier.replied; "Terima barang" on a
 * replied PO emits po.received (stock up, no journal).
 */
import { useEffect, useReducer, useRef } from 'react'
import { Button, Drawer, Icon, flashNewRow, motionMode } from '../../demo-kit/ui'
import { emit, hhmm, rows, useClock, useWorld, world, type PurchaseOrder, type WorldState } from '../../demo-kit/world'
import { PO_STATUS, poSuggestions, type PoSuggestion } from '../../demo-kit/world/usaha-pintar'
import { SLUG, nf, rp, tm, useT, whenL, type Lang } from './strings'
import { ui, useUi } from './store'
import PoChat from './PoChat'
import type { TabProps } from './types'

const S = {
  id: {
    sug: 'Saran PO per supplier', none: 'Tidak ada barang yang perlu dipesan sekarang.', draft: 'Draf otomatis', lead: (d: number) => `kirim ${d} hari`, total: 'Total (simulasi)',
    send: 'Setujui & kirim', sent: 'PO terkirim', noSent: 'Belum ada PO yang dikirim hari ini.', chat: 'Buka chat', receive: 'Terima barang', received: 'Barang diterima, stok bertambah',
    qty: (q: string, u: string) => `${q} ${u}`, at: (h: string) => `pukul ${h}`, chatT: (c: string) => `Chat ${c}`, recvWhy: 'Bisa diterima setelah supplier membalas',
  },
  en: {
    sug: 'PO suggestions per supplier', none: 'Nothing needs ordering right now.', draft: 'Auto draft', lead: (d: number) => `ships in ${d} days`, total: 'Total (simulated)',
    send: 'Approve & send', sent: 'Sent POs', noSent: 'No PO sent today yet.', chat: 'Open chat', receive: 'Receive goods', received: 'Goods received, stock updated',
    qty: (q: string, u: string) => `${q} ${u}`, at: (h: string) => `at ${h}`, chatT: (c: string) => `${c} chat`, recvWhy: 'Can be received once the supplier replies',
  },
}
const typingMs = () => (motionMode() === 'full' ? 1600 : 0)

export function sendPo(sg: PoSuggestion): string | null {
  const s = world.get()
  const e = emit('po.sent', { ...(sg.poId ? { id: sg.poId } : {}), ...(sg.code ? { code: sg.code } : {}), businessId: s.meta.shopId, supplierId: sg.supplierId, items: sg.items.map(({ productId, qty, cost }) => ({ productId, qty, cost })) }, SLUG)
  const id = e.payload.id ?? sg.poId
  if (id) ui.set({ chat: id, typingUntil: { ...ui.get().typingUntil, [id]: Date.now() + typingMs() } })
  return id ?? null
}

const sentSel = (s: WorldState) =>
  rows(s.purchaseOrders)
    .filter((p) => p.businessId === s.meta.shopId && p.status !== 'draf')
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
const sameList = (a: PurchaseOrder[], b: PurchaseOrder[]) => a.length === b.length && a.every((x, i) => x === b[i])

export default function Po({ sel }: TabProps) {
  const { lang, t: T } = useT()
  const t = S[lang]
  const now = useClock().minutes
  const sug = useWorld((s) => poSuggestions(s, now))
  const sent = useWorld(sentSel, sameList)
  const sups = useWorld((s) => s.suppliers)
  const chat = useUi((s) => s.chat)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (sel?.kind !== 'po') return
    const el = ref.current?.querySelector<HTMLElement>(`[data-po="${CSS.escape(sel.id)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    return flashNewRow(el)
  }, [sel])
  return (
    <div className="dk-ta-grid" ref={ref}>
      <section className="dk-ta-card" aria-labelledby="dk-ta-sug-h">
        <header className="dk-ta-ch">
          <h3 id="dk-ta-sug-h">{t.sug}</h3>
          <span className="dk-ta-sim">{T.sim}</span>
        </header>
        {sug.length ? (
          <div className="dk-ta-sugs">
            {sug.map((g, i) => (
              <article key={g.poId ?? g.supplierId} className="dk-ta-sug" data-po={g.poId ?? undefined} data-supplier={g.supplierId}>
                <header>
                  <b>{g.supplierName}</b>
                  <span className="dk-ta-muted">
                    {g.code ? `${g.code} · ${t.draft} · ` : ''}
                    {t.lead(g.leadDays)}
                  </span>
                </header>
                {g.reason && <p className="dk-ta-reason">{g.reason[lang]}</p>}
                <ul className="dk-ta-lines2">
                  {g.items.map((it) => (
                    <li key={it.productId} data-pid={it.productId}>
                      <span className="dk-ta-main">
                        <b>{it.name}</b>
                        <small className="dk-num">{it.why[lang]}</small>
                      </span>
                      <span className="dk-num dk-ta-q" data-qty={it.qty}>{t.qty(nf(it.qty, lang), it.unit)}</span>
                    </li>
                  ))}
                </ul>
                <footer>
                  <span className="dk-num">
                    {t.total}: <b>{rp(g.total)}</b>
                  </span>
                  <Button variant="primary" size="sm" icon="send" onClick={() => sendPo(g)} {...(i === 0 ? { 'data-tour': 'po-approve' } : {})} data-ta="po-send">
                    {t.send}
                  </Button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p className="dk-ta-muted">{t.none}</p>
        )}
      </section>
      <section className="dk-ta-card" aria-labelledby="dk-ta-sent-h">
        <header className="dk-ta-ch">
          <h3 id="dk-ta-sent-h">{t.sent}</h3>
        </header>
        {sent.length ? (
          <ul className="dk-ta-sent">
            {sent.map((p) => (
              <li key={p.id} data-po={p.id}>
                <span className="dk-ta-main">
                  <b>
                    {p.code} · {sups.byId[p.supplierId]?.name}
                  </b>
                  <small className="dk-num">
                    {whenL(p.at, lang)} · {rp(p.total)}
                  </small>
                </span>
                <span className={`dk-ta-st is-${p.status}`} data-status={p.status}>
                  {PO_STATUS[p.status]?.[lang] ?? p.status}
                </span>
                <Button size="sm" variant="ghost" icon="chat" onClick={() => ui.set({ chat: p.id })}>
                  {t.chat}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-ta-muted">{t.noSent}</p>
        )}
      </section>
      <ChatDrawer id={chat} lang={lang} />
    </div>
  )
}

export function ChatDrawer({ id, lang }: { id: string | null; lang: Lang }) {
  const t = S[lang]
  const po = useWorld((s) => (id ? s.purchaseOrders.byId[id] : undefined))
  const names = useWorld((s) => `${s.businesses.byId[s.meta.shopId]?.name ?? ''}|${po ? (s.suppliers.byId[po.supplierId]?.name ?? '') : ''}`)
  const products = useWorld((s) => s.products)
  const until = useUi((s) => (id ? (s.typingUntil[id] ?? 0) : 0))
  const [, force] = useStateTick()
  useEffect(() => {
    const ms = until - Date.now()
    if (ms <= 0) return
    const tm = window.setTimeout(force, ms + 20)
    return () => window.clearTimeout(tm)
  }, [until, force])
  const [shop = '', supplier = ''] = names.split('|')
  const typing = !!po && po.status !== 'draf' && (!po.reply || Date.now() < until)
  return (
    <Drawer open={!!po} onClose={() => ui.set({ chat: null })} title={t.chatT(po?.code ?? '')} width={440} className="dk-ta-ov">
      {po && (
        <div className="dk-ta-chatbox">
          <PoChat
            code={po.code}
            shop={shop}
            supplier={supplier}
            items={po.items.map((i) => ({ name: products.byId[i.productId]?.name ?? i.productId, qty: i.qty, unit: products.byId[i.productId]?.unit ?? '' }))}
            total={po.total}
            sentAt={po.at}
            reply={po.reply ? { message: po.reply.message, at: po.reply.at, eta: po.reply.eta != null ? etaTxt(po.reply.eta, lang) : null } : null}
            typing={typing}
            lang={lang}
          />
          {po.status === 'diterima' ? (
            <p className="dk-ta-ok" role="status">
              <Icon name="check" size={16} /> {t.received}
            </p>
          ) : (
            <>
              <Button variant="primary" icon="package" disabled={po.status !== 'dibalas' || typing} onClick={() => emit('po.received', { poId: po.id }, SLUG)} data-ta="po-receive">
                {t.receive}
              </Button>
              {(po.status !== 'dibalas' || typing) && <small className="dk-ta-muted">{t.recvWhy}</small>}
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}

function useStateTick(): [number, () => void] {
  return useReducer((n: number) => n + 1, 0) as unknown as [number, () => void]
}
/** world minute → "besok 07.00" / "Kam 07.00" style ETA */
export function etaTxt(m: number, lang: Lang): string {
  const d = Math.floor(m / 1440)
  const day = d === 0 ? (lang === 'id' ? 'hari ini' : 'today') : d === 1 ? (lang === 'id' ? 'besok' : 'tomorrow') : lang === 'id' ? `${d} hari lagi` : `in ${d} days`
  return `${day} ${tm(hhmm(m), lang)}`
}
