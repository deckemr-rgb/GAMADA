/**
 * Reports.tsx (lazy) — Laporan: profit per month (Sep, Oct, Nov so far; pnlMonthly), the balance sheet (Aset =
 * Kewajiban + Modal incl. the running profit), the November cash flow, a drill-down per account, and "Laporan
 * bulanan" = P&L + balance sheet + cash flow + tax summary on one printable paper ("Cetak / PDF").
 */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { Button, Drawer, Icon, Modal } from '../../demo-kit/ui'
import { BarChart } from '../../demo-kit/viz'
import { useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { ACCOUNT, balanceSheet, cashFlow, coaOf, ledgerRows, pnlMonthly, vendorProfile } from '../../demo-kit/world/usaha-pintar'
import { dateText, isoOf, monthName, periodOf, rp, rpShort, taxAmountOf, taxItemOf, type RoleKey } from './model'
import { useT } from './strings'

const S = {
  id: {
    chart: 'Laba per bulan',
    chartUnit: 'Rp · laba bersih',
    soFar: 'berjalan',
    pnl: (m: string) => `Laba rugi ${m}`,
    revenue: 'Pendapatan (penjualan + lain-lain)',
    cogs: 'Harga pokok penjualan',
    expenses: 'Beban usaha',
    net: 'Laba bersih',
    bs: 'Neraca',
    assets: 'Aset',
    liab: 'Kewajiban',
    equity: 'Modal',
    running: 'Laba berjalan',
    totalA: 'Total aset',
    totalLE: 'Kewajiban + modal',
    balanced: 'Seimbang: aset = kewajiban + modal',
    cf: (m: string) => `Arus kas ${m}`,
    opening: 'Saldo awal kas & bank',
    inflow: 'Uang masuk',
    outflow: 'Uang keluar',
    closing: 'Saldo akhir',
    monthly: 'Laporan bulanan',
    monthlyTitle: (m: string) => `Laporan bulanan ${m} (simulasi)`,
    print: 'Cetak / PDF',
    official: 'SIMULASI · bukan dokumen resmi',
    tax: 'Ringkasan pajak',
    pphFinal: 'PPh Final UMKM',
    pph21: 'PPh 21 karyawan',
    est: 'estimasi',
    computed: 'dihitung',
    drill: (a: string) => `Rincian akun ${a}`,
    drillHint: 'Ketuk akun untuk melihat rinciannya',
    drillEmpty: 'Belum ada transaksi bulan ini.',
    npwp: 'NPWP',
    owner: 'Pemilik',
    summary: (m: string, v: string) => `Laba bersih tertinggi di ${m}: ${v}.`,
  },
  en: {
    chart: 'Profit per month',
    chartUnit: 'Rp · net profit',
    soFar: 'so far',
    pnl: (m: string) => `${m} profit and loss`,
    revenue: 'Revenue (sales + other)',
    cogs: 'Cost of goods sold',
    expenses: 'Operating expenses',
    net: 'Net profit',
    bs: 'Balance sheet',
    assets: 'Assets',
    liab: 'Liabilities',
    equity: 'Equity',
    running: 'Running profit',
    totalA: 'Total assets',
    totalLE: 'Liabilities + equity',
    balanced: 'Balanced: assets = liabilities + equity',
    cf: (m: string) => `${m} cash flow`,
    opening: 'Opening cash & bank',
    inflow: 'Money in',
    outflow: 'Money out',
    closing: 'Closing balance',
    monthly: 'Monthly report',
    monthlyTitle: (m: string) => `${m} monthly report (simulated)`,
    print: 'Print / PDF',
    official: 'SIMULATION · not an official document',
    tax: 'Tax summary',
    pphFinal: 'Final income tax (MSME)',
    pph21: 'Employee PPh 21',
    est: 'estimate',
    computed: 'computed',
    drill: (a: string) => `${a} account detail`,
    drillHint: 'Tap an account to see its entries',
    drillEmpty: 'No entries this month yet.',
    npwp: 'Tax ID (NPWP)',
    owner: 'Owner',
    summary: (m: string, v: string) => `Highest net profit in ${m}: ${v}.`,
  },
}

const pnlSel = (s: WorldState) => pnlMonthly(s, s.meta.shopId)

export default function Reports({ roleKey }: { roleKey: RoleKey }) {
  const { lang } = useT()
  const L = S[lang]
  const now = useClock().minutes
  const pnl = useWorld(pnlSel)
  const period = useWorld(periodOf)
  const seed = useWorld((s) => s.seed)
  const ledger = useWorld((s) => s.ledger)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bs = useMemo(() => balanceSheetNow(now), [now, ledger])
  const cf = useWorld((s) => cashFlow(s, s.meta.shopId, periodOf(s)), (a, b) => a.closing === b.closing && a.inflow === b.inflow && a.outflow === b.outflow)
  const [drill, setDrill] = useState<string | null>(null)
  const [paper, setPaper] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)
  const cur = pnl[pnl.length - 1]
  const m = monthName(period, lang)
  const best = pnl.reduce((a, b) => (b.net > a.net ? b : a), pnl[0]!)
  const data = pnl.map((p) => ({ id: p.month, label: `${monthName(p.month, lang, true)}${p.partial ? ` (${L.soFar})` : ''}`, value: p.net, tone: p.partial ? ('accent' as const) : undefined }))

  const acc = (a: string) => (
    <button type="button" className="dk-pb-acc" onClick={() => setDrill(a)} data-pb="drill">
      {roleKey === 'konsultan' && <span className="dk-pb-code">{coaOf(a).code}</span>} {ACCOUNT[a]?.[lang] ?? (a === 'Laba berjalan' ? L.running : a)}
    </button>
  )

  return (
    <div className="dk-pb-reports">
      <div className="dk-pb-rep-top">
        <BarChart title={L.chart} unit={L.chartUnit} data={data} format={(v) => rpShort(v, lang)} axisFormat={(v) => rpShort(v, lang)} height={220} seed={seed} summary={L.summary(monthName(best.month, lang), rp(best.net, lang))} />
        <Button variant="primary" icon="doc" onClick={() => setPaper(true)} data-pb="monthly">
          {L.monthly}
        </Button>
      </div>
      <p className="dk-pb-muted">{L.drillHint}</p>
      <div className="dk-pb-cards">
        {cur && (
          <section className="dk-pb-card" aria-labelledby="pb-pnl-h">
            <h3 id="pb-pnl-h">{L.pnl(m)}</h3>
            <dl className="dk-pb-dl">
              <dt>{L.revenue}</dt>
              <dd>{rp(cur.revenue, lang)}</dd>
              <dt>{acc('HPP')}</dt>
              <dd>−{rp(cur.cogs, lang)}</dd>
              <dt>{L.expenses}</dt>
              <dd>−{rp(cur.expenses, lang)}</dd>
              <dt className="is-total">{L.net}</dt>
              <dd className="is-total" data-pb="laba">
                {rp(cur.net, lang)}
              </dd>
            </dl>
          </section>
        )}
        <section className="dk-pb-card" aria-labelledby="pb-bs-h">
          <h3 id="pb-bs-h">{L.bs}</h3>
          <dl className="dk-pb-dl">
            {bs.assets.map((a) => (
              <BsRow key={a.account} k={acc(a.account)} v={rp(a.amount, lang)} />
            ))}
            <dt className="is-total">{L.totalA}</dt>
            <dd className="is-total">{rp(bs.totalAssets, lang)}</dd>
            {[...bs.liabilities, ...bs.equity].map((a) => (
              <BsRow key={a.account} k={a.account === 'Laba berjalan' ? L.running : acc(a.account)} v={rp(a.amount, lang)} />
            ))}
            <dt className="is-total">{L.totalLE}</dt>
            <dd className="is-total">{rp(bs.totalLiabEquity, lang)}</dd>
          </dl>
          {bs.balanced && (
            <p className="dk-pb-ok-line">
              <Icon name="check" size={14} /> {L.balanced}
            </p>
          )}
        </section>
        <section className="dk-pb-card" aria-labelledby="pb-cf-h">
          <h3 id="pb-cf-h">{L.cf(m)}</h3>
          <dl className="dk-pb-dl">
            <dt>{L.opening}</dt>
            <dd>{rp(cf.opening, lang)}</dd>
            <dt>{L.inflow}</dt>
            <dd>+{rp(cf.inflow, lang)}</dd>
            <dt>{L.outflow}</dt>
            <dd>−{rp(cf.outflow, lang)}</dd>
            <dt className="is-total">{L.closing}</dt>
            <dd className="is-total">{rp(cf.closing, lang)}</dd>
          </dl>
        </section>
      </div>
      <Drawer open={!!drill} onClose={() => setDrill(null)} title={drill ? L.drill(ACCOUNT[drill]?.[lang] ?? drill) : ''} width={460}>
        {drill && <Drill account={drill} lang={lang} empty={L.drillEmpty} />}
      </Drawer>
      <Modal open={paper} onClose={() => setPaper(false)} title={L.monthlyTitle(m)} size="lg" footer={<Button variant="primary" icon="print" onClick={() => paperRef.current && printPaper(paperRef.current)} data-pb="print">{L.print}</Button>}>
        <div ref={paperRef}>{paper && <MonthlyPaper L={L} lang={lang} />}</div>
      </Modal>
    </div>
  )
}

function BsRow({ k, v }: { k: ReactNode; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  )
}

function balanceSheetNow(at: number) {
  const s = world.get()
  return balanceSheet(s, s.meta.shopId, at)
}

function Drill({ account, lang, empty }: { account: string; lang: 'id' | 'en'; empty: string }) {
  const list = useWorld((s) => {
    const from = -Number(s.day.slice(8, 10)) * 1440 + 1440
    return ledgerRows(s, s.meta.shopId, { from }).filter((j) => j.lines.some((l) => l.account === account)).slice(0, 60)
  }, (a, b) => a.length === b.length && a.every((x, i) => x === b[i]))
  const day = useWorld((s) => s.day)
  if (!list.length) return <p className="dk-pb-muted">{empty}</p>
  return (
    <ul className="dk-pb-drill">
      {list.map((j) => {
        const l = j.lines.find((x) => x.account === account)!
        return (
          <li key={j.id}>
            <span>
              {j.memo[lang]}
              <small>{dateText(isoOf({ day } as WorldState, j.at), lang)} · {j.id}</small>
            </span>
            <span className="is-num">{l.debit ? `D ${rp(l.debit, lang)}` : `${lang === 'id' ? 'K' : 'C'} ${rp(l.credit, lang)}`}</span>
          </li>
        )
      })}
    </ul>
  )
}

function MonthlyPaper({ L, lang }: { L: (typeof S)['id']; lang: 'id' | 'en' }) {
  const s = useWorld((x) => x)
  const shop = s.meta.shopId
  const period = periodOf(s)
  const pnl = pnlMonthly(s, shop)
  const cur = pnl[pnl.length - 1]!
  const bs = balanceSheet(s, shop, Infinity)
  const cf = cashFlow(s, shop, period)
  const vp = vendorProfile(s, shop)
  const items = (['pph-final-umkm', 'pph21'] as const).map((k) => {
    const it = taxItemOf(s, k, period)
    return it ? { k, ...taxAmountOf(s, it) } : null
  })
  return (
    <PaperFrame label={L.monthlyTitle(monthName(period, lang))} size="auto" className="dk-pb-paper">
      <p className="dk-pb-paper-sim">{L.official}</p>
      <h2>{vp?.name ?? ''}</h2>
      <p className="dk-pb-paper-meta">
        {L.owner}: {vp?.owner ?? ''} · {L.npwp} {vp?.npwp ?? ''} · {monthName(period, lang)} {period.slice(0, 4)}
      </p>
      <h3>{L.pnl(monthName(period, lang))}</h3>
      <table className="dk-pb-ptable">
        <tbody>
          <tr><td>{L.revenue}</td><td>{rp(cur.revenue, lang)}</td></tr>
          <tr><td>{L.cogs}</td><td>−{rp(cur.cogs, lang)}</td></tr>
          <tr><td>{L.expenses}</td><td>−{rp(cur.expenses, lang)}</td></tr>
          <tr className="is-total"><td>{L.net}</td><td data-pb="paper-laba">{rp(cur.net, lang)}</td></tr>
        </tbody>
      </table>
      <h3>{L.bs}</h3>
      <table className="dk-pb-ptable">
        <tbody>
          {bs.assets.map((a) => <tr key={a.account}><td>{ACCOUNT[a.account]?.[lang] ?? a.account}</td><td>{rp(a.amount, lang)}</td></tr>)}
          <tr className="is-total"><td>{L.totalA}</td><td>{rp(bs.totalAssets, lang)}</td></tr>
          {[...bs.liabilities, ...bs.equity].map((a) => <tr key={a.account}><td>{a.account === 'Laba berjalan' ? L.running : (ACCOUNT[a.account]?.[lang] ?? a.account)}</td><td>{rp(a.amount, lang)}</td></tr>)}
          <tr className="is-total"><td>{L.totalLE}</td><td>{rp(bs.totalLiabEquity, lang)}</td></tr>
        </tbody>
      </table>
      <h3>{L.cf(monthName(period, lang))}</h3>
      <table className="dk-pb-ptable">
        <tbody>
          <tr><td>{L.opening}</td><td>{rp(cf.opening, lang)}</td></tr>
          <tr><td>{L.inflow}</td><td>+{rp(cf.inflow, lang)}</td></tr>
          <tr><td>{L.outflow}</td><td>−{rp(cf.outflow, lang)}</td></tr>
          <tr className="is-total"><td>{L.closing}</td><td>{rp(cf.closing, lang)}</td></tr>
        </tbody>
      </table>
      <h3>{L.tax}</h3>
      <table className="dk-pb-ptable">
        <tbody>
          {items.map((it) => it && (
            <tr key={it.k}><td>{it.k === 'pph21' ? L.pph21 : L.pphFinal} ({it.computed ? L.computed : L.est})</td><td>{rp(it.amount, lang)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="dk-pb-paper-sim">{L.official}</p>
    </PaperFrame>
  )
}
