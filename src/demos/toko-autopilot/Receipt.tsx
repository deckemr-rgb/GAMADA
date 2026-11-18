/**
 * Receipt — 58 mm receipt of one sale (PaperFrame + printPaper). Standalone: reads the sale from the world. The
 * newest Kasir notice (Pantau Merek announcement, C29) prints at the bottom. "Data simulasi", not a tax receipt.
 */
import { useRef } from 'react'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { Button } from '../../demo-kit/ui'
import { hhmm, rows, useWorld } from '../../demo-kit/world'
import { rp, tm, type Lang } from './strings'

const S = {
  id: { print: 'Cetak struk', disc: 'Diskon', total: 'Total', cash: 'Tunai diterima', change: 'Kembali', cashier: 'Kasir', foot: 'Data simulasi · bukan bukti pajak', label: 'Struk', pay: { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' } as Record<string, string> },
  en: { print: 'Print receipt', disc: 'Discount', total: 'Total', cash: 'Cash received', change: 'Change', cashier: 'Cashier', foot: 'Simulated data · not a tax document', label: 'Receipt', pay: { tunai: 'Cash', qris: 'QRIS', transfer: 'Transfer' } as Record<string, string> },
}

export default function Receipt({ saleId, lang }: { saleId: string; lang: Lang }) {
  const t = S[lang]
  const sale = useWorld((s) => s.sales.byId[saleId])
  const ctx = useWorld((s) => {
    const x = s.sales.byId[saleId]
    return x ? `${s.businesses.byId[x.businessId]?.name ?? ''}|${s.outlets.byId[x.outletId]?.name ?? ''}|${s.staff.byId[x.staffId ?? '']?.name ?? ''}` : '||'
  })
  const notice = useWorld((s) => rows(s.posNotices).filter((n) => sale && n.outletIds.includes(sale.outletId)).sort((a, b) => b.at - a.at)[0])
  const products = useWorld((s) => s.products)
  const ref = useRef<HTMLDivElement>(null)
  if (!sale) return null
  const [biz, outlet, staff] = ctx.split('|')
  const payments = sale.payments ?? [{ method: sale.payment, amount: sale.total }]
  return (
    <div className="dk-ta-rc">
      <div ref={ref}>
        <PaperFrame label={`${t.label} ${sale.code}`} size="auto" className="dk-ta-paper">
          <div className="dk-ta-rcp" data-ta="receipt">
            <b>{biz}</b>
            <span>{outlet}</span>
            <span className="dk-num">
              {sale.code} · {tm(hhmm(sale.at), lang)}
            </span>
            <hr />
            {sale.items.map((it) => (
              <div key={it.productId} className="dk-ta-rcl">
                <span>{products.byId[it.productId]?.name ?? it.productId}</span>
                <span className="dk-num">
                  {it.qty} × {rp(it.price)}
                </span>
                <span className="dk-num">{rp(it.qty * it.price)}</span>
              </div>
            ))}
            <hr />
            {!!sale.discount && <Row k={t.disc} v={`−${rp(sale.discount)}`} />}
            <Row k={t.total} v={rp(sale.total)} strong />
            {payments.map((p) => (
              <Row key={p.method} k={t.pay[p.method] ?? p.method} v={rp(p.amount)} />
            ))}
            {sale.cash && <Row k={t.cash} v={rp(sale.cash.given)} />}
            {sale.cash && <Row k={t.change} v={rp(sale.cash.change)} />}
            {staff && <Row k={t.cashier} v={staff} />}
            {notice && <p className="dk-ta-rcn">{notice.text[lang]}</p>}
            <small>{t.foot}</small>
          </div>
        </PaperFrame>
      </div>
      <Button size="sm" variant="secondary" icon="print" onClick={() => ref.current && printPaper(ref.current.querySelector('.dk-paper') ?? ref.current)}>
        {t.print}
      </Button>
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`dk-ta-rcr${strong ? ' is-b' : ''}`}>
      <span>{k}</span>
      <span className="dk-num">{v}</span>
    </div>
  )
}
