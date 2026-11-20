/**
 * Kasir — POS: product grid (posCatalog, stock badge = stock.onHand), search ("/" focuses), barcode input (typed or a
 * scanner wedge; camera only where BarcodeDetector exists), cart per outlet (store.ts: survives role / language
 * switches), discount % or Rp (cap 10 % for the Kasir role), Bayar → lazy payment drawer (one sale.created). The
 * newest Kasir notice (C29, s.posNotices) shows as a banner. "Tutup shift" opens the lazy shift-close dialog.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Drawer, Icon, IconButton, Input, MoneyInput, Segmented, flashNewRow } from '../../demo-kit/ui'
import { rows, useClock, useWorld, world } from '../../demo-kit/world'
import { findByBarcode, posCatalog, type PosItem } from '../../demo-kit/world/usaha-pintar'
import { STRINGS, rp, tm, useT, type Lang } from './strings'
import { EMPTY_CART, addToCart, grossOf, pressThen, reprice, setCart, useUi, type Cart } from './store'
import type { TabProps } from './types'

const loadPay = () => import('./Payment')
const Payment = lazy(loadPay)
const CloseShift = lazy(() => loadPay().then((m) => ({ default: m.CloseShift })))
const Scan = lazy(() => import('./Scan'))

const S = {
  id: {
    search: 'Cari barang', searchPh: 'Cari nama atau SKU  ( / )', barcode: 'Kode batang', barcodePh: 'Ketik / pindai kode batang', add: 'Tambah', scan: 'Pindai dengan kamera',
    noCode: (c: string) => `Kode ${c} tidak dikenal`, added: (n: string) => `${n} masuk keranjang`, all: 'Semua', cats: 'Kategori',
    more: (n: number) => `${n} barang lain: ketik di kolom cari untuk mempersempit`, stock: (n: number) => `stok ${n}`, out: 'habis',
    cart: 'Keranjang', empty: 'Keranjang kosong. Ketuk barang untuk menambah.', inc: (n: string) => `Tambah ${n}`, dec: (n: string) => `Kurangi ${n}`, del: (n: string) => `Hapus ${n}`,
    disc: 'Diskon', discMode: 'Jenis diskon', cap: (p: number) => `Maks. ${p}% untuk peran ini`, sub: 'Subtotal', total: 'Total', pay: 'Bayar', payWhy: 'Isi keranjang dulu untuk membayar',
    bar: (n: number, v: string) => `Keranjang (${n}) · ${v}`, close: 'Tutup shift', promo: (p: number) => `promo −${p}%`, notice: 'Info untuk pelanggan',
  },
  en: {
    search: 'Search items', searchPh: 'Search name or SKU  ( / )', barcode: 'Barcode', barcodePh: 'Type / scan a barcode', add: 'Add', scan: 'Scan with camera',
    noCode: (c: string) => `Unknown code ${c}`, added: (n: string) => `${n} added to cart`, all: 'All', cats: 'Category',
    more: (n: number) => `${n} more items: type in search to narrow down`, stock: (n: number) => `stock ${n}`, out: 'out',
    cart: 'Cart', empty: 'The cart is empty. Tap an item to add it.', inc: (n: string) => `Add one ${n}`, dec: (n: string) => `Remove one ${n}`, del: (n: string) => `Remove ${n}`,
    disc: 'Discount', discMode: 'Discount type', cap: (p: number) => `Max ${p}% for this role`, sub: 'Subtotal', total: 'Total', pay: 'Pay', payWhy: 'Fill the cart first to pay',
    bar: (n: number, v: string) => `Cart (${n}) · ${v}`, close: 'Close shift', promo: (p: number) => `promo −${p}%`, notice: 'Note for customers',
  },
}
const MAX = 48
const priceOf = (p: PosItem) => (p.promoPct ? Math.round((p.price * (100 - p.promoPct)) / 100) : p.price)

export default function Kasir({ outletId, role, sel }: TabProps) {
  const { lang } = useT()
  const t = S[lang]
  const shell = useShell()
  const sm = shell.size === 'sm'
  const cap = role === 'kasir' ? 10 : 50
  const items = useWorld((s) => posCatalog(s, outletId))
  const cart = useUi((s) => s.carts[outletId] ?? EMPTY_CART)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [pay, setPay] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [scan, setScan] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const notice = useWorld((s) => rows(s.posNotices).filter((n) => n.outletIds.includes(outletId)).sort((a, b) => b.at - a.at)[0])
  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.defaultPrevented) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  useEffect(() => {
    if (sel?.kind === 'notice' && noticeRef.current) {
      noticeRef.current.scrollIntoView({ block: 'nearest' })
      return flashNewRow(noticeRef.current)
    }
  }, [sel, notice])

  const cats = useMemo(() => [...new Set(items.map((p) => p.category))], [items])
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return items.filter((p) => (!cat || p.category === cat) && (!k || p.name.toLowerCase().includes(k) || p.sku.toLowerCase().includes(k) || p.barcode.includes(k)))
  }, [items, q, cat])
  const add = (p: PosItem) => {
    addToCart(outletId, p.productId, priceOf(p))
    setMsg(t.added(p.name))
  }
  const onCode = (raw: string) => {
    const id = findByBarcode(world.get(), raw)
    const p = id ? items.find((x) => x.productId === id) : undefined
    if (p) add(p)
    else setMsg(t.noCode(raw))
  }
  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    onCode(code.trim())
    setCode('')
  }
  const n = cart.lines.reduce((a, l) => a + l.qty, 0)
  const total = grossOf(cart) - cart.discount

  const cartPanel = <CartPanel cart={cart} outletId={outletId} cap={cap} lang={lang} onPay={() => setPay(true)} items={items} />
  return (
    <div className="dk-ta-kasir" data-role={role}>
      <p className="dk-sr" role="status" aria-live="polite">{msg}</p>
      {notice && (
        <div ref={noticeRef} className="dk-ta-notice" data-ta="pos-notice" role="note">
          <Icon name="bell" size={18} />
          <p>
            <b>{t.notice}</b> {notice.text[lang]}
          </p>
        </div>
      )}
      <ShiftLine role={role} outletId={outletId} lang={lang} onClose={() => setClosing(true)} label={t.close} />
      <div className="dk-ta-pos">
        <div className="dk-ta-cat">
          <div className="dk-ta-find">
            <Input ref={searchRef} type="search" icon="search" aria-label={t.search} placeholder={t.searchPh} value={q} onChange={(e) => setQ(e.target.value)} data-ta="pos-search" />
            <form className="dk-ta-code" onSubmit={submitCode}>
              <Input aria-label={t.barcode} placeholder={t.barcodePh} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} data-ta="pos-barcode" />
              <Button type="submit" size="sm" variant="secondary" disabled={!code.trim()}>
                {t.add}
              </Button>
              {hasDetector && <IconButton icon="camera" label={t.scan} onClick={() => setScan(true)} data-ta="pos-camera" />}
            </form>
          </div>
          <div className="dk-ta-chips" role="group" aria-label={t.cats}>
            <button type="button" className="dk-chip" aria-pressed={!cat} onClick={() => setCat('')}>
              {t.all}
            </button>
            {cats.map((c) => (
              <button key={c} type="button" className="dk-chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>
                {c.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          <ul className="dk-ta-items">
            {list.slice(0, MAX).map((p) => {
              const inCart = cart.lines.find((l) => l.productId === p.productId)?.qty ?? 0
              return (
                <li key={p.productId}>
                  <button type="button" className="dk-ta-item" data-pid={p.productId} onClick={() => add(p)} disabled={p.onHand - inCart <= 0}>
                    <span className="dk-ta-iname">{p.name}</span>
                    <span className="dk-ta-iprice dk-num">{rp(priceOf(p))}</span>
                    <span className={`dk-ta-stock dk-num${p.onHand <= 5 ? ' is-low' : ''}`} data-stock={p.onHand}>
                      {p.onHand > 0 ? t.stock(p.onHand) : t.out}
                      {p.promoPct ? ` · ${t.promo(p.promoPct)}` : ''}
                    </span>
                    {inCart > 0 && <span className="dk-ta-incart dk-num">{inCart}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          {list.length > MAX && <p className="dk-ta-muted">{t.more(list.length - MAX)}</p>}
        </div>
        {!sm && cartPanel}
      </div>
      {sm && (
        <div className="dk-ta-sticky">
          <Button variant="primary" icon="cart" onClick={(e) => pressThen(e.currentTarget, () => setCartOpen(true))} data-ta="cart-bar">
            {t.bar(n, rp(total))} · {t.pay}
          </Button>
        </div>
      )}
      {sm && (
        <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title={t.cart}>
          {cartPanel}
        </Drawer>
      )}
      {pay && (
        <Suspense fallback={null}>
          <Payment
            open={pay}
            outletId={outletId}
            role={role}
            onClose={() => {
              setPay(false)
              setCartOpen(false)
            }}
          />
        </Suspense>
      )}
      {closing && (
        <Suspense fallback={null}>
          <CloseShift open={closing} outletId={outletId} onClose={() => setClosing(false)} />
        </Suspense>
      )}
      {scan && (
        <Suspense fallback={null}>
          <Scan open={scan} onClose={() => setScan(false)} onCode={onCode} />
        </Suspense>
      )}
    </div>
  )
}

function CartPanel({ cart, outletId, cap, lang, onPay, items }: { cart: Cart; outletId: string; cap: number; lang: Lang; onPay: () => void; items: PosItem[] }) {
  const t = S[lang]
  const gross = grossOf(cart)
  const total = gross - cart.discount
  const name = (id: string) => items.find((p) => p.productId === id)?.name ?? id
  const onHand = (id: string) => items.find((p) => p.productId === id)?.onHand ?? 0
  const set = (c: Cart) => setCart(outletId, reprice(c))
  const empty = !cart.lines.length
  return (
    <section className="dk-ta-cart" aria-label={t.cart} data-ta="cart">
      <h3>{t.cart}</h3>
      {empty ? (
        <p className="dk-ta-muted">{t.empty}</p>
      ) : (
        <ul className="dk-ta-lines">
          {cart.lines.map((l) => (
            <li key={l.productId}>
              <span className="dk-ta-lname">{name(l.productId)}</span>
              <span className="dk-ta-qty">
                <IconButton size="sm" icon="minus" label={t.dec(name(l.productId))} onClick={() => addToCart(outletId, l.productId, l.price, -1)} />
                <span className="dk-num" aria-live="polite">{l.qty}</span>
                <IconButton size="sm" icon="plus" label={t.inc(name(l.productId))} onClick={() => addToCart(outletId, l.productId, l.price, 1)} disabled={l.qty >= onHand(l.productId)} />
              </span>
              <span className="dk-num dk-ta-lsum">{rp(l.qty * l.price)}</span>
              <IconButton size="sm" icon="trash" label={t.del(name(l.productId))} onClick={() => set({ ...cart, lines: cart.lines.filter((x) => x !== l) })} />
            </li>
          ))}
        </ul>
      )}
      <div className="dk-ta-disc">
        <span>{t.disc}</span>
        <Segmented
          size="sm"
          label={t.discMode}
          value={cart.mode}
          onChange={(m) => set({ ...cart, mode: m, pct: 0, discount: 0 })}
          options={[
            { value: 'pct', label: '%' },
            { value: 'rp', label: 'Rp' },
          ]}
        />
        {cart.mode === 'pct' ? (
          <Input
            aria-label={`${t.disc} %`}
            inputMode="numeric"
            value={cart.pct ? String(cart.pct) : ''}
            placeholder="0"
            suffix="%"
            onChange={(e) => set({ ...cart, pct: Math.min(cap, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0)) })}
            data-ta="disc-pct"
          />
        ) : (
          <MoneyInput aria-label={`${t.disc} Rp`} value={cart.discount || null} max={Math.floor((gross * cap) / 100)} onChange={(v) => set({ ...cart, discount: v ?? 0 })} data-ta="disc-rp" />
        )}
        <small className="dk-ta-muted">{t.cap(cap)}</small>
      </div>
      <dl className="dk-ta-sum">
        <div>
          <dt>{t.sub}</dt>
          <dd className="dk-num">{rp(gross)}</dd>
        </div>
        {cart.discount > 0 && (
          <div>
            <dt>{t.disc}</dt>
            <dd className="dk-num">−{rp(cart.discount)}</dd>
          </div>
        )}
        <div className="is-total">
          <dt>{t.total}</dt>
          <dd className="dk-num" data-ta="cart-total">{rp(total)}</dd>
        </div>
      </dl>
      <Button variant="primary" icon="wallet" onClick={onPay} disabled={empty} aria-describedby={empty ? 'dk-ta-paywhy' : undefined} onPointerEnter={() => void loadPay()} onFocus={() => void loadPay()} data-ta="pay">
        {t.pay} {empty ? '' : rp(total)}
      </Button>
      {empty && (
        <small id="dk-ta-paywhy" className="dk-ta-muted">
          {t.payWhy}
        </small>
      )}
    </section>
  )
}

function ShiftLine({ role, outletId, lang, onClose, label }: { role: string; outletId: string; lang: Lang; onClose: () => void; label: string }) {
  const T = STRINGS[lang]
  useClock()
  const line = useWorld((s) => {
    const staff = rows(s.staff).find((x) => x.outletId === outletId && x.job === 'kasir') ?? rows(s.staff).find((x) => x.outletId === outletId)
    if (!staff) return null
    const dow = (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7
    const sh = rows(s.shifts).find((x) => x.staffId === staff.id && x.day === dow)
    return `${staff.name}|${sh ? sh.start : ''}|${sh ? sh.end : ''}|${dow}`
  })
  if (!line) return null
  const [name, a, b, d] = line.split('|')
  const h = (m: string) => tm(`${String(Math.floor(Number(m) / 60)).padStart(2, '0')}:${String(Number(m) % 60).padStart(2, '0')}`, lang)
  return (
    <div className="dk-ta-shiftline">
      <Icon name="user" size={18} />
      <span>
        <b>{name}</b>
        {a && role === 'kasir' ? ` · ${T.kasirShift(T.days[Number(d)]!, h(a), h(b!))}` : ''}
      </span>
      <Button size="sm" variant="secondary" icon="lock" onClick={onClose} onPointerEnter={() => void loadPay()} data-ta="close-shift">
        {label}
      </Button>
    </div>
  )
}
