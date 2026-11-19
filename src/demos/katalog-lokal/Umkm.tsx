/**
 * Sisi UMKM (lazy; the landing chunk of ?role=pemilik-toko). 1440: PhoneFrame "HP UMKM" 40 % (order notifications →
 * detail: requested vs available, "Konfirmasi penuh" / "Konfirmasi sebagian" ⇒ order.confirmed, "Tandai dikirim" ⇒
 * order.shipped, payment status) + BrowserFrame "Dasbor mitra" 60 % (Etalase = vendorStorefront + BizBadges, Peluang,
 * Riwayat + total diterima). "Lihat sebagai": the shop + businesses with a match / order (≤ 6). Phones: no device frame.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BizBadges, Button, Select, flashNewRow } from '../../demo-kit/ui'
import { BrowserFrame, PhoneFrame } from '../../demo-kit/frames'
import { emit, formatTime, useClock, useWorld, type Order, type WorldState } from '../../demo-kit/world'
import { badgesOf, listingOf, offerFor, ordersOf, shopOpportunities, umkmInbox, vendorStorefront } from '../../demo-kit/world/pasar-daerah'
import AppLink from '../../components/AppLink'
import { useI18n } from '../../lib/i18n'
import { DEMO_READY } from '../registry'
import { SLUG, kecName, nf, rp } from './model'

const U = {
  id: {
    side: 'Sisi UMKM',
    phone: 'HP UMKM',
    dash: 'Dasbor mitra',
    viewAs: 'Lihat sebagai',
    viewAsNote: 'Demo: akun UMKM lain',
    shop: 'toko contoh',
    partner: 'Mitra Katalog Lokal',
    inbox: 'Pesanan masuk',
    empty: 'Belum ada pesanan. Pesanan dari Pemda muncul di sini.',
    newTag: 'Baru',
    status: { dipesan: 'Perlu konfirmasi', dikonfirmasi: 'Siap dikirim', dikirim: 'Dikirim', dibayar: 'Dibayar' } as Record<Order['status'], string>,
    all: 'Semua pesanan',
    item: 'Barang',
    req: 'Diminta',
    avail: 'Tersedia',
    conf: 'Dikonfirmasi',
    full: 'Konfirmasi penuh',
    fullWhy: 'Stok kurang dari permintaan: pakai "Konfirmasi sebagian".',
    partial: 'Konfirmasi sebagian',
    sendPartial: 'Kirim konfirmasi sebagian',
    zeroWhy: 'Isi minimal satu barang.',
    cancel: 'Batal',
    ship: 'Tandai dikirim',
    waitPay: 'Menunggu Pemda menerima barang · Transfer dari Kas Daerah (simulasi)',
    paid: (t: string) => `Dibayar ${t} · Transfer dari Kas Daerah (simulasi)`,
    eta: (n: number) => `Perkiraan kirim ${n} hari`,
    total: 'Total',
    sim: 'simulasi',
    store: 'Etalase',
    price: 'Harga',
    stock: 'Stok',
    badgesHow: 'Cara dapat lencana ↗',
    opps: 'Peluang',
    noOpps: 'Belum ada kebutuhan terbuka yang cocok.',
    history: 'Riwayat pesanan',
    noHistory: 'Belum ada riwayat pesanan.',
    received: 'Total diterima',
    more: (n: number) => `+${n} produk lain di etalase`,
  },
  en: {
    side: 'SME side',
    phone: 'SME phone',
    dash: 'Partner dashboard',
    viewAs: 'View as',
    viewAsNote: 'Demo: another SME account',
    shop: 'sample shop',
    partner: 'Katalog Lokal partner',
    inbox: 'Incoming orders',
    empty: 'No orders yet. Orders from the government show up here.',
    newTag: 'New',
    status: { dipesan: 'Needs confirmation', dikonfirmasi: 'Ready to ship', dikirim: 'Shipped', dibayar: 'Paid' } as Record<Order['status'], string>,
    all: 'All orders',
    item: 'Item',
    req: 'Requested',
    avail: 'Available',
    conf: 'Confirmed',
    full: 'Confirm in full',
    fullWhy: 'Stock below the request: use "Confirm partly".',
    partial: 'Confirm partly',
    sendPartial: 'Send the partial confirmation',
    zeroWhy: 'Fill in at least one item.',
    cancel: 'Cancel',
    ship: 'Mark as shipped',
    waitPay: 'Waiting for the government to receive the goods · transfer from the regional treasury (simulated)',
    paid: (t: string) => `Paid ${t} · transfer from the regional treasury (simulated)`,
    eta: (n: number) => `Estimated delivery ${n} day${n === 1 ? '' : 's'}`,
    total: 'Total',
    sim: 'simulated',
    store: 'Storefront',
    price: 'Price',
    stock: 'Stock',
    badgesHow: 'How to earn the badges ↗',
    opps: 'Opportunities',
    noOpps: 'No matching open need yet.',
    history: 'Order history',
    noHistory: 'No order history yet.',
    received: 'Total received',
    more: (n: number) => `+${n} more products in the storefront`,
  },
}
type UT = (typeof U)['id']
const whole = (s: WorldState) => s

export interface UmkmProps {
  viewAs: string
  onViewAs: (id: string) => void
  focusOrder: string | null
  onFocusDone: () => void
  active: boolean
  focusKey: number
  sm: boolean
}

export default function Umkm({ viewAs, onViewAs, focusOrder, onFocusDone, sm }: UmkmProps) {
  const { lang } = useI18n()
  const L = U[lang]
  const s = useWorld(whole)
  const now = useClock().minutes
  const shopId = s.meta.shopId
  const biz = s.businesses.byId[viewAs] ?? s.businesses.byId[shopId]!
  const inbox = umkmInbox(s, biz.id)
  const [open, setOpen] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // "Lihat sebagai": the shop + the businesses with an order or a match (newest first, ≤ 6)
  const accounts = useMemo(() => {
    const out: string[] = []
    const add = (id: string) => {
      if (id !== shopId && !out.includes(id) && out.length < 6) out.push(id)
    }
    for (const o of ordersOf(s, {})) add(o.businessId)
    const ms = s.matches.ids.map((id) => s.matches.byId[id]!).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
    for (const m of ms) add(m.businessId)
    if (viewAs !== shopId && s.businesses.byId[viewAs] && !out.includes(viewAs)) out.unshift(viewAs)
    return [shopId, ...out]
  }, [s.orders, s.matches, shopId, viewAs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusOrder) return
    setOpen(focusOrder)
    onFocusDone()
    const tm = window.setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ block: 'center' })
        flashNewRow(detailRef.current)
      }
    }, 200)
    return () => window.clearTimeout(tm)
  }, [focusOrder, onFocusDone])

  const cur = open ? s.orders.byId[open] : undefined
  const phone = (
    <div className="dk-kl-uphone" data-kl="umkm-phone">
      <p className="dk-kl-peek-h">
        <b>{biz.name}</b>
        <span>{L.partner}</span>
      </p>
      {cur && cur.businessId === biz.id ? (
        <div ref={detailRef}>
          <OrderDetail key={cur.id} s={s} order={cur} onBack={() => setOpen(null)} L={L} lang={lang} />
        </div>
      ) : (
        <section aria-label={L.inbox}>
          <h4>{L.inbox}</h4>
          {inbox.length ? (
            <ul className="dk-kl-unotes">
              {inbox.map((o) => (
                <li key={o.id}>
                  <button type="button" className={`dk-kl-note${o.isNew ? ' is-new' : ''}`} onClick={() => setOpen(o.id)} data-kl-note={o.id}>
                    <span className="dk-num">{o.code}</span>
                    <b>{o.isNew ? `${L.newTag} · ` : ''}{L.status[o.status]}</b>
                    <span>{o.need?.title[lang] ?? ''}</span>
                    <span className="dk-num">{rp(o.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dk-kl-muted">{L.empty}</p>
          )}
        </section>
      )}
    </div>
  )
  const store = vendorStorefront(s, biz.id)
  const opps = biz.id === shopId ? shopOpportunities(s).map((o) => o.need) : s.matches.ids.map((id) => s.matches.byId[id]!).filter((m) => m.businessId === biz.id).map((m) => s.catalogNeeds.byId[m.needId]!).filter((n) => n && (n.status === 'baru' || n.status === 'dicocokkan'))
  const hist = ordersOf(s, { bizId: biz.id })
  const received = hist.filter((o) => o.status === 'dibayar').reduce((a, o) => a + o.total, 0)
  const dash = (
    <div className="dk-kl-dash">
      <div className="dk-kl-viewas">
        <label>
          <span>{L.viewAs}</span>
          <Select value={biz.id} onChange={(e) => onViewAs(e.target.value)} options={accounts.map((id) => ({ value: id, label: `${s.businesses.byId[id]?.name ?? id}${id === shopId ? ` (${L.shop})` : ''}` }))} data-kl="view-as" />
        </label>
        <span className="dk-kl-muted">{L.viewAsNote}</span>
      </div>
      <div className="dk-kl-badgerow">
        <BizBadges badges={badgesOf(s, biz.id)} bizId={biz.id} size="md" links />
        {DEMO_READY['kenal-mitra'] && (
          <AppLink className="dk-kl-link" to={`/demo/kenal-mitra?focus=${biz.id}`}>
            {L.badgesHow}
          </AppLink>
        )}
      </div>
      <Block title={L.store}>
        <table className="dk-kl-tbl">
          <thead>
            <tr>
              <th scope="col">{L.item}</th>
              <th scope="col">{L.price}</th>
              <th scope="col">{L.stock}</th>
            </tr>
          </thead>
          <tbody>
            {store.slice(0, 8).map((r) => (
              <tr key={`${r.category}-${r.productId ?? ''}`} data-kl-store={r.productId ?? r.category}>
                <td>{r.name[lang]}</td>
                <td className="dk-num">
                  {rp(r.unitPrice)} <span className="dk-kl-sim">{L.sim}</span>
                </td>
                <td className="dk-num" data-kl="onhand">
                  {nf(lang, r.onHand)} {r.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {store.length > 8 && <p className="dk-kl-muted">{L.more(store.length - 8)}</p>}
      </Block>
      <Block title={L.opps}>
        {opps.length ? (
          <ul className="dk-kl-simple">
            {opps.slice(0, 5).map((n) => (
              <li key={n.id}>
                <span className="dk-kl-code dk-num">{n.code}</span> {n.title[lang]} <span className="dk-kl-muted">· {kecName(s, n.kecamatanId)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-kl-muted">{L.noOpps}</p>
        )}
      </Block>
      <Block title={L.history}>
        {hist.length ? (
          <ul className="dk-kl-simple">
            {hist.slice(0, 6).map((o) => (
              <li key={o.id}>
                <span className="dk-kl-code dk-num">{o.code}</span> {L.status[o.status]} · <span className="dk-num">{rp(o.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-kl-muted">{L.noHistory}</p>
        )}
        <p>
          {L.received}: <b className="dk-num" data-kl="received">{rp(received)}</b> <span className="dk-kl-sim">{L.sim}</span>
        </p>
      </Block>
    </div>
  )
  return (
    <div className="dk-kl-umkm" data-kl="umkm" data-biz={biz.id}>
      <h2 className="dk-kl-h" tabIndex={-1} data-kl-face-h="umkm">
        {L.side} <span className="dk-kl-muted">· {biz.name}</span>
      </h2>
      {sm ? (
        <>
          <div className="dk-kl-uphone-card">{phone}</div>
          {dash}
        </>
      ) : (
        <div className="dk-kl-ustage">
          <PhoneFrame label={L.phone} time={formatTime(now)} tilt={false} width={320}>
            {phone}
          </PhoneFrame>
          <BrowserFrame path={`${SLUG}/mitra`} label={L.dash}>
            {dash}
          </BrowserFrame>
        </div>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dk-kl-block">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function OrderDetail({ s, order: o, onBack, L, lang }: { s: WorldState; order: Order; onBack: () => void; L: UT; lang: 'id' | 'en' }) {
  const offer = o.needId ? offerFor(s, o.needId, o.businessId) : null
  const avail = o.items.map((i) => offer?.lines.find((l) => l.category === i.category)?.qtyAvailable ?? (i.category ? listingOf(s, o.businessId, i.category).qtyAvailable : i.qty))
  const eta = Math.max(1, ...o.items.map((i) => (i.category ? listingOf(s, o.businessId, i.category).leadDays : 1)))
  const [partial, setPartial] = useState(false)
  const [qty, setQty] = useState<number[]>(() => o.items.map((i, k) => Math.min(i.qty, avail[k] ?? i.qty)))
  const sent = useRef<string | null>(null)
  const fullOk = o.items.every((i, k) => (avail[k] ?? 0) >= i.qty)
  const zero = qty.every((q) => q <= 0)
  const act = (type: 'confirm' | 'ship', q?: number[]) => {
    if (sent.current === `${type}:${o.status}`) return
    sent.current = `${type}:${o.status}`
    if (type === 'confirm') emit('order.confirmed', { orderId: o.id, qtyConfirmed: q ?? o.items.map((i) => i.qty), etaDays: eta }, SLUG)
    else emit('order.shipped', { orderId: o.id }, SLUG)
  }
  return (
    <section className="dk-kl-odetail" data-kl-umkm-order={o.id} data-status={o.status} aria-label={o.code}>
      <Button size="sm" variant="ghost" icon="arrowLeft" onClick={onBack}>
        {L.all}
      </Button>
      <p>
        <span className="dk-kl-code dk-num">{o.code}</span> <b>{L.status[o.status]}</b>
      </p>
      {o.needId && <p className="dk-kl-muted">{s.catalogNeeds.byId[o.needId]?.title[lang]}</p>}
      <table className="dk-kl-tbl">
        <thead>
          <tr>
            <th scope="col">{L.item}</th>
            <th scope="col">{L.req}</th>
            <th scope="col">{L.avail}</th>
            {(partial || o.confirmedQty) && <th scope="col">{L.conf}</th>}
          </tr>
        </thead>
        <tbody>
          {o.items.map((i, k) => (
            <tr key={k}>
              <td>{i.name[lang]}</td>
              <td className="dk-num">{nf(lang, i.qty)}</td>
              <td className={`dk-num${(avail[k] ?? 0) < i.qty ? ' is-short' : ''}`}>{nf(lang, avail[k] ?? 0)}</td>
              {partial && o.status === 'dipesan' ? (
                <td>
                  <input
                    type="number"
                    className="dk-input dk-num"
                    min={0}
                    max={Math.min(i.qty, avail[k] ?? 0)}
                    value={qty[k] ?? 0}
                    aria-label={`${L.conf} ${i.name[lang]}`}
                    onChange={(e) => setQty((xs) => xs.map((x, j) => (j === k ? Math.max(0, Math.min(i.qty, avail[k] ?? 0, Math.round(Number(e.target.value)) || 0)) : x)))}
                    data-kl="partial-qty"
                  />
                </td>
              ) : o.confirmedQty ? (
                <td className="dk-num">{nf(lang, o.confirmedQty[k] ?? 0)}</td>
              ) : partial ? (
                <td />
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dk-num">
        {L.total} <b data-kl="umkm-total">{rp(o.total)}</b> <span className="dk-kl-sim">{L.sim}</span> · {L.eta(o.etaDays ?? eta)}
      </p>
      <div className="dk-kl-uact">
        {o.status === 'dipesan' &&
          (partial ? (
            <>
              <Button variant="primary" onClick={() => act('confirm', qty)} disabled={zero} aria-describedby={zero ? 'kl-zero' : undefined} data-kl="umkm-confirm-partial">
                {L.sendPartial}
              </Button>
              <Button variant="ghost" onClick={() => setPartial(false)}>
                {L.cancel}
              </Button>
              {zero && (
                <p id="kl-zero" className="dk-kl-why">
                  {L.zeroWhy}
                </p>
              )}
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => act('confirm')} disabled={!fullOk} aria-describedby={!fullOk ? 'kl-full-why' : undefined} data-kl="umkm-confirm">
                {L.full}
              </Button>
              <Button variant="secondary" onClick={() => setPartial(true)} data-kl="umkm-partial">
                {L.partial}
              </Button>
              {!fullOk && (
                <p id="kl-full-why" className="dk-kl-why">
                  {L.fullWhy}
                </p>
              )}
            </>
          ))}
        {o.status === 'dikonfirmasi' && (
          <Button variant="primary" icon="truck" onClick={() => act('ship')} data-kl="umkm-ship">
            {L.ship}
          </Button>
        )}
        {o.status === 'dikirim' && <p className="dk-kl-muted">{L.waitPay}</p>}
        {o.status === 'dibayar' && <p className="dk-kl-paid">✓ {L.paid(o.paidAt !== undefined ? formatTime(((o.paidAt % 1440) + 1440) % 1440) : '')}</p>}
      </div>
    </section>
  )
}
