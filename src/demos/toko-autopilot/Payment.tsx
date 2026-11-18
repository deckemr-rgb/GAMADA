/**
 * Payment — the payment drawer (tunai with change, QRIS dummy + "Simulasikan pembayaran", transfer, split tunai +
 * QRIS) and the shift-close dialog. Paying emits ONE sale.created (salePayload; a second tap is ignored), clears the
 * outlet's cart and shows the receipt. Lazy: loaded on intent of "Bayar" / "Tutup shift".
 */
import { startTransition, useMemo, useRef, useState } from 'react'
import { Button, Drawer, Modal, MoneyInput, Segmented } from '../../demo-kit/ui'
import { clock, emit, rows, useClock, useWorld, world } from '../../demo-kit/world'
import { cashierShift, salePayload } from '../../demo-kit/world/usaha-pintar'
import { SLUG, hhmmL, rp, useT, type Lang } from './strings'
import { EMPTY_CART, grossOf, setCart, useUi } from './store'
import { QR_N, qrPath } from './qr'
import Receipt from './Receipt'

type Method = 'tunai' | 'qris' | 'transfer' | 'split'
const S = {
  id: {
    title: 'Pembayaran', method: 'Metode bayar', m: { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer', split: 'Tunai + QRIS' } as Record<Method, string>,
    total: 'Total tagihan', given: 'Uang diterima', exact: 'Uang pas', change: 'Kembalian', short: (v: string) => `Kurang ${v}`, cash: (v: string) => `Terima tunai · kembali ${v}`,
    qrCap: 'QR contoh, tidak dapat dibayar', simulate: 'Simulasikan pembayaran', tf: 'Transfer ke rekening toko (contoh fiktif) · berita: kode transaksi', tfSim: 'Simulasikan transfer masuk',
    splitCash: 'Bagian tunai', rest: (v: string) => `Sisa lewat QRIS: ${v}`, splitWhy: 'Isi bagian tunai (kurang dari total) untuk membagi pembayaran', done: 'Pembayaran berhasil', next: 'Transaksi baru',
    paid: (v: string, m: string) => `Pembayaran ${v} lewat ${m} diterima`,
    shiftT: 'Tutup shift', since: (a: string) => `Shift dimulai ${a}`, tx: 'Transaksi', cashSales: 'Penjualan tunai', float: 'Modal awal laci', expected: 'Uang tunai seharusnya', counted: 'Uang dihitung',
    variance: 'Selisih', closeBtn: 'Tutup shift', closed: (v: string) => `Shift ditutup. Selisih ${v}.`, cancel: 'Batal', ok: 'Selesai', countWhy: 'Isi jumlah uang yang dihitung', sim: 'simulasi',
  },
  en: {
    title: 'Payment', method: 'Payment method', m: { tunai: 'Cash', qris: 'QRIS', transfer: 'Transfer', split: 'Cash + QRIS' } as Record<Method, string>,
    total: 'Amount due', given: 'Cash received', exact: 'Exact amount', change: 'Change', short: (v: string) => `Short by ${v}`, cash: (v: string) => `Take cash · change ${v}`,
    qrCap: 'Sample QR, cannot be paid', simulate: 'Simulate payment', tf: 'Transfer to the shop account (fictional sample) · reference: transaction code', tfSim: 'Simulate incoming transfer',
    splitCash: 'Cash part', rest: (v: string) => `Rest via QRIS: ${v}`, splitWhy: 'Enter a cash part (less than the total) to split the payment', done: 'Payment received', next: 'New transaction',
    paid: (v: string, m: string) => `Payment of ${v} by ${m} received`,
    shiftT: 'Close shift', since: (a: string) => `Shift started ${a}`, tx: 'Transactions', cashSales: 'Cash sales', float: 'Opening float', expected: 'Expected cash', counted: 'Counted cash',
    variance: 'Variance', closeBtn: 'Close shift', closed: (v: string) => `Shift closed. Variance ${v}.`, cancel: 'Cancel', ok: 'Done', countWhy: 'Enter the counted cash', sim: 'simulated',
  },
}
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rp(Math.abs(n))}`
const cashierOf = (outletId: string) => {
  const s = world.get()
  const kasir = rows(s.staff).filter((x) => x.outletId === outletId && x.job === 'kasir')
  return (kasir.find((x) => x.isNew) ?? kasir[0] ?? rows(s.staff).find((x) => x.outletId === outletId))?.id
}

export default function Payment({ open, outletId, onClose }: { open: boolean; outletId: string; role: string; onClose: () => void }) {
  const { lang } = useT()
  const t = S[lang]
  const cart = useUi((s) => s.carts[outletId] ?? EMPTY_CART)
  const total = grossOf(cart) - cart.discount
  const [m, setM] = useState<Method>('tunai')
  const [given, setGiven] = useState<number | null>(null)
  const [part, setPart] = useState<number | null>(null)
  const [saleId, setSaleId] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)
  const ref = useMemo(() => `${outletId}|${clock.get().minutes}|${total}|${cart.lines.length}`, [outletId, total, cart.lines.length])
  const qr = useMemo(() => qrPath(ref), [ref])

  const pay = (payments: { method: 'tunai' | 'qris' | 'transfer'; amount: number }[], cashGiven?: number) => {
    if (sent.current || !cart.lines.length) return
    sent.current = true
    setBusy(true)
    const payload = salePayload({ outletId, lines: cart.lines, discount: cart.discount, payments, staffId: cashierOf(outletId), ...(cashGiven != null ? { cashGiven } : {}) })
    // the click paints first (busy button); the sale, the stock and the chains run in the next task (INP)
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        const e = emit('sale.created', payload, SLUG)
        setCart(outletId, EMPTY_CART)
        startTransition(() => {
          setSaleId(e.payload.id ?? null)
          setSaid(t.paid(rp(total), payments.map((p) => t.m[p.method]).join(' + ')))
        })
      }, 0),
    )
  }
  const change = (given ?? 0) - total
  const rest = total - (part ?? 0)
  const splitOk = part != null && part > 0 && part < total
  const quick = [total, Math.ceil(total / 50_000) * 50_000, Math.ceil(total / 100_000) * 100_000].filter((v, i, a) => v >= total && a.indexOf(v) === i)

  return (
    <Drawer open={open} onClose={onClose} title={saleId ? t.done : t.title} width={460} className="dk-ta-ov">
      <p className="dk-sr" role="status" aria-live="assertive">{said}</p>
      {saleId ? (
        <div className="dk-ta-paydone">
          <Receipt saleId={saleId} lang={lang} />
          <Button variant="primary" icon="plus" onClick={onClose} data-ta="new-sale">
            {t.next}
          </Button>
        </div>
      ) : (
        <div className="dk-ta-pay" data-ta="payment">
          <p className="dk-ta-due">
            <span>{t.total}</span>
            <b className="dk-num">{rp(total)}</b>
          </p>
          <Segmented label={t.method} value={m} onChange={setM} options={(['tunai', 'qris', 'transfer', 'split'] as Method[]).map((k) => ({ value: k, label: t.m[k] }))} />
          {m === 'tunai' && (
            <div className="dk-ta-paybox">
              <label className="dk-ta-lab">
                {t.given}
                <MoneyInput value={given} onChange={setGiven} data-ta="cash-given" />
              </label>
              <div className="dk-ta-chips">
                {quick.map((v, i) => (
                  <button key={v} type="button" className="dk-chip" aria-pressed={given === v} onClick={() => setGiven(v)}>
                    {i === 0 ? t.exact : rp(v)}
                  </button>
                ))}
              </div>
              <p className="dk-ta-change" aria-live="polite">
                {given == null ? '' : change >= 0 ? `${t.change}: ${rp(change)}` : t.short(rp(-change))}
              </p>
              <Button variant="primary" busy={busy} disabled={given == null || change < 0} onClick={() => pay([{ method: 'tunai', amount: total }], given ?? total)} data-ta="pay-cash">
                {t.cash(rp(Math.max(0, change)))}
              </Button>
            </div>
          )}
          {(m === 'qris' || m === 'split') && (
            <div className="dk-ta-paybox">
              {m === 'split' && (
                <>
                  <label className="dk-ta-lab">
                    {t.splitCash}
                    <MoneyInput value={part} onChange={setPart} max={Math.max(0, total - 1)} data-ta="split-cash" />
                  </label>
                  <p className="dk-ta-change">{splitOk ? t.rest(rp(rest)) : t.splitWhy}</p>
                </>
              )}
              <Qr path={qr} cap={t.qrCap} amount={rp(m === 'split' ? rest : total)} />
              <Button
                variant="primary"
                icon="check"
                busy={busy}
                disabled={m === 'split' && !splitOk}
                data-ta="qris-pay"
                onClick={() => (m === 'split' ? pay([{ method: 'tunai', amount: part ?? 0 }, { method: 'qris', amount: rest }], part ?? 0) : pay([{ method: 'qris', amount: total }]))}
              >
                {t.simulate}
              </Button>
            </div>
          )}
          {m === 'transfer' && (
            <div className="dk-ta-paybox">
              <p className="dk-ta-muted">{t.tf}</p>
              <Button variant="primary" icon="check" busy={busy} onClick={() => pay([{ method: 'transfer', amount: total }])} data-ta="tf-pay">
                {t.tfSim}
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Qr({ path, cap, amount }: { path: string; cap: string; amount: string }) {
  return (
    <figure className="dk-ta-qr" data-ta="qr">
      <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} role="img" aria-label={cap} shapeRendering="crispEdges">
        <rect x={-2} y={-2} width={QR_N + 4} height={QR_N + 4} fill="#fff" />
        <path d={path} fill="#111" />
      </svg>
      <figcaption>
        <b>QRIS</b> <span className="dk-num">{amount}</span>
        <small>{cap}</small>
      </figcaption>
    </figure>
  )
}

/** "Tutup shift": expected = float + cash sales since the shift start (cashierShift); variance = counted − expected */
export function CloseShift({ open, outletId, onClose }: { open: boolean; outletId: string; onClose: () => void }) {
  const { lang } = useT()
  const t = S[lang]
  const now = useClock().minutes
  const staffId = useMemo(() => cashierOf(outletId) ?? '', [outletId])
  const sh = useWorld((s) => (staffId ? cashierShift(s, staffId, now) : null), (a, b) => a?.expectedCash === b?.expectedCash && a?.tx === b?.tx)
  const [counted, setCounted] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const sent = useRef(false)
  if (!sh) return null
  const variance = (counted ?? 0) - sh.expectedCash
  const close = () => {
    if (sent.current || counted == null) return
    sent.current = true
    emit('shift.closed', { staffId, outletId, expectedCash: sh.expectedCash, countedCash: counted, variance, tx: sh.tx }, SLUG)
    setDone(t.closed(signed(variance)))
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.shiftT}
      description={t.since(hhmmL(sh.start, lang as Lang))}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            {t.ok}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button variant="primary" onClick={close} disabled={counted == null} data-ta="close-shift-confirm">
              {t.closeBtn}
            </Button>
          </>
        )
      }
    >
      <dl className="dk-ta-sum" data-ta="shift-sum">
        <div><dt>{t.tx}</dt><dd className="dk-num">{sh.tx}</dd></div>
        <div><dt>{t.float}</dt><dd className="dk-num">{rp(sh.expectedCash - sh.cashSales)}</dd></div>
        <div><dt>{t.cashSales}</dt><dd className="dk-num">{rp(sh.cashSales)}</dd></div>
        <div className="is-total"><dt>{t.expected}</dt><dd className="dk-num" data-ta="expected-cash">{rp(sh.expectedCash)}</dd></div>
      </dl>
      {!done && (
        <label className="dk-ta-lab">
          {t.counted}
          <MoneyInput value={counted} onChange={setCounted} data-ta="counted-cash" />
        </label>
      )}
      <p className="dk-ta-change" aria-live="polite" data-ta="variance">
        {done ?? (counted == null ? t.countWhy : `${t.variance}: ${signed(variance)} (${t.sim})`)}
      </p>
    </Modal>
  )
}
