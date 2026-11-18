/**
 * Supplier role — "Pesanan masuk" on a phone: the shop's POs to the sandbag / tarp supplier, a WA-style thread per PO
 * and three quick replies, each emitting supplier.replied with its own ETA (C18 sends the nota to Pajak Beres once).
 */
import { useEffect, useState } from 'react'
import { Button, EmptyState } from '../../demo-kit/ui'
import { clock, emit, hhmm, rows, useWorld, type Bi, type WorldState } from '../../demo-kit/world'
import { FLOOD_TAGS, PO_STATUS } from '../../demo-kit/world/usaha-pintar'
import { SLUG, rp, tm, useT, whenL, type Lang } from './strings'
import PoChat from './PoChat'
import { etaTxt } from './Po'

const S = {
  id: { title: 'Pesanan masuk', none: 'Belum ada pesanan dari toko. PO darurat muncul setelah pemilik toko menyetujui saran PO.', back: 'Kembali ke daftar', from: (s: string) => `dari ${s}`, done: 'PO sudah diterima toko: tidak perlu balasan lagi' },
  en: { title: 'Incoming orders', none: 'No orders from the shop yet. Emergency POs appear once the owner approves a PO suggestion.', back: 'Back to the list', from: (s: string) => `from ${s}`, done: 'The shop already received this PO: no reply needed' },
}
const QUICK: { id: 'besok' | 'sebagian' | 'sore'; label: Bi }[] = [
  { id: 'besok', label: { id: 'Siap, kirim besok pagi', en: 'Ready, shipping tomorrow morning' } },
  { id: 'sebagian', label: { id: 'Stok terbatas, kirim sebagian lusa', en: 'Limited stock, partial delivery the day after tomorrow' } },
  { id: 'sore', label: { id: 'Bisa kirim hari ini sore', en: 'Can deliver this afternoon' } },
]
const day0700 = (now: number, d: number) => (Math.floor(now / 1440) + d) * 1440 + 7 * 60
function reply(kind: (typeof QUICK)[number]['id'], code: string, item: string, now: number): { message: Bi; eta: number } {
  if (kind === 'besok') return { eta: day0700(now, 1), message: { id: `Siap, ${code} kami kirim besok pagi pukul 07.00, ${item} sudah disiapkan.`, en: `Ready, we ship ${code} tomorrow at 07:00; the ${item} is being prepared.` } }
  if (kind === 'sebagian') return { eta: day0700(now, 2), message: { id: `Stok ${item} terbatas: ${code} kami kirim sebagian lusa pagi, sisanya menyusul.`, en: `${item} stock is limited: we ship part of ${code} the day after tomorrow, the rest follows.` } }
  const eta = now < 16 * 60 ? Math.floor(now / 1440) * 1440 + 16 * 60 : now + 60
  return { eta, message: { id: `Bisa, ${code} kami antar hari ini sore; ${item} ikut armada pukul ${tm(hhmm(eta), 'id')}.`, en: `Yes, we deliver ${code} this afternoon; the ${item} goes with the ${hhmm(eta)} truck.` } }
}

const supplierSel = (s: WorldState) => {
  for (const id of s.products.ids) {
    const p = s.products.byId[id]
    if (p && p.businessId === s.meta.shopId && p.supplierId && p.tags.some((t) => FLOOD_TAGS.includes(t) && t !== 'pump')) return p.supplierId
  }
  return ''
}

export default function Supplier({ focusPo }: { focusPo: string | null }) {
  const { lang } = useT()
  const t = S[lang]
  const supId = useWorld(supplierSel)
  const sup = useWorld((s) => s.suppliers.byId[supId])
  const pos = useWorld(
    (s) => rows(s.purchaseOrders).filter((p) => p.supplierId === supId && p.businessId === s.meta.shopId && p.status !== 'draf').sort((a, b) => b.at - a.at),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  )
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (focusPo) setOpen(focusPo)
  }, [focusPo])
  const po = pos.find((p) => p.id === open)
  return (
    <div className="dk-ta-sup" data-ta="supplier">
      <header className="dk-ta-suph">
        <b>{t.title}</b>
        <small>{sup?.name}</small>
      </header>
      {po ? (
        <Thread poId={po.id} lang={lang} onBack={() => setOpen(null)} />
      ) : pos.length ? (
        <ul className="dk-ta-suplist">
          {pos.map((p) => (
            <li key={p.id}>
              <button type="button" className="dk-ta-row" onClick={() => setOpen(p.id)} data-po={p.id}>
                <span className="dk-ta-main">
                  <b>{p.code}</b>
                  <small className="dk-num">
                    {whenL(p.at, lang)} · {rp(p.total)}
                  </small>
                </span>
                <span className={`dk-ta-st is-${p.status}`}>{PO_STATUS[p.status]?.[lang] ?? p.status}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t.none} />
      )}
    </div>
  )
}

function Thread({ poId, lang, onBack }: { poId: string; lang: Lang; onBack: () => void }) {
  const t = S[lang]
  const po = useWorld((s) => s.purchaseOrders.byId[poId])
  const products = useWorld((s) => s.products)
  const names = useWorld((s) => `${s.businesses.byId[s.meta.shopId]?.name ?? ''}|${po ? (s.suppliers.byId[po.supplierId]?.name ?? '') : ''}`)
  if (!po) return null
  const [shop = '', supplier = ''] = names.split('|')
  const item = products.byId[po.items[0]?.productId ?? '']?.name ?? ''
  return (
    <div className="dk-ta-supthread">
      <Button size="sm" variant="ghost" icon="forward" className="dk-ta-back" onClick={onBack}>
        {t.back}
      </Button>
      <PoChat
        side="supplier"
        code={po.code}
        shop={shop}
        supplier={supplier}
        items={po.items.map((i) => ({ name: products.byId[i.productId]?.name ?? i.productId, qty: i.qty, unit: products.byId[i.productId]?.unit ?? '' }))}
        total={po.total}
        sentAt={po.at}
        reply={po.reply ? { message: po.reply.message, at: po.reply.at, eta: po.reply.eta != null ? etaTxt(po.reply.eta, lang) : null } : null}
        lang={lang}
        quickReplies={QUICK}
        quickDisabled={po.status === 'diterima' ? { id: S.id.done, en: S.en.done } : undefined}
        onQuick={(id) => {
          if (po.status === 'diterima') return
          const r = reply(id as (typeof QUICK)[number]['id'], po.code, item, clock.get().minutes)
          emit('supplier.replied', { poId: po.id, supplierId: po.supplierId, message: r.message, eta: r.eta }, SLUG)
        }}
      />
    </div>
  )
}
