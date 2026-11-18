/**
 * Mutasi.tsx (lazy) — the November bank statement (40 rows, fictional bank) as the CSV the bank exports: preview,
 * the matching against the journal ("cocok" rows are already in it: they post nothing; "baru" rows post their entry;
 * 3 rows need review), then "Impor 40 baris" ⇒ bank.imported + one ledger.posted per new row, and the review drawer.
 */
import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { mutasiDoc, FICTIONAL_BANK } from '../../demo-kit/docs/samples/finance'
import { DocArt } from '../../demo-kit/docs/DocArt'
import { intentProps } from '../../demo-kit/shell'
import { Button, Drawer, Icon } from '../../demo-kit/ui'
import { emit, useWorld, world, type WorldState } from '../../demo-kit/world'
import { ACCOUNT, mutasiRows, pendingReviews, type MutasiRowW } from '../../demo-kit/world/usaha-pintar'
import { SLUG, afterPaint, dateText, periodOf, rp, type RoleKey } from './model'
import { useT } from './strings'

const loadReview = () => import('./Review')
const Review = lazy(loadReview)

const S = {
  id: {
    title: 'Mutasi rekening November',
    sub: (bank: string, n: number) => `${bank} (bank fiktif) · ${n} baris · CSV dari internet banking`,
    st: { cocok: 'cocok', baru: 'baru', tinjau: 'tinjau' },
    stLong: { cocok: 'Sudah ada di jurnal (setoran penjualan)', baru: 'Belum ada di jurnal: dijurnal saat impor', tinjau: 'Kategori belum jelas: perlu tinjauan' },
    sum: (m: number, p: number, r: number) => `${m} cocok · ${p} baru · ${r} perlu tinjauan`,
    import: (n: number) => `Impor ${n} baris`,
    imported: (m: number, p: number, r: number) => `Diimpor: ${m} baris cocok tidak dijurnal ulang, ${p} baris baru dijurnal, ${r} baris menunggu tinjauan.`,
    review: (n: number) => (n ? `Tinjau ${n} baris` : 'Lihat antrean tinjauan'),
    drawer: 'Tinjau jurnal',
    cols: ['Tanggal', 'Keterangan', 'Jumlah', 'Status'],
    showAll: 'Tampilkan 40 baris',
    showLess: 'Ringkas',
    preview: 'Pratinjau file mutasi',
    tableLabel: 'Baris mutasi rekening',
    account: 'akun',
  },
  en: {
    title: 'November bank statement',
    sub: (bank: string, n: number) => `${bank} (fictional bank) · ${n} rows · CSV from internet banking`,
    st: { cocok: 'matched', baru: 'new', tinjau: 'review' },
    stLong: { cocok: 'Already in the journal (sales settlement)', baru: 'Not in the journal yet: posted on import', tinjau: 'Unclear category: needs review' },
    sum: (m: number, p: number, r: number) => `${m} matched · ${p} new · ${r} need review`,
    import: (n: number) => `Import ${n} rows`,
    imported: (m: number, p: number, r: number) => `Imported: ${m} matched rows not posted again, ${p} new rows posted, ${r} rows waiting for review.`,
    review: (n: number) => (n ? `Review ${n} rows` : 'Open the review queue'),
    drawer: 'Review journal entries',
    cols: ['Date', 'Description', 'Amount', 'Status'],
    showAll: 'Show all 40 rows',
    showLess: 'Show fewer',
    preview: 'Statement file preview',
    tableLabel: 'Bank statement rows',
    account: 'account',
  },
}

const PREVIEW_N = 12
const rowsSel = (s: WorldState) => mutasiRows(s, s.meta.shopId, periodOf(s))
const importSel = (s: WorldState) => s.bankImports.ids.map((id) => s.bankImports.byId[id]).find((b) => b && b.businessId === s.meta.shopId && b.period === periodOf(s)) ?? null
const reviewsSel = (s: WorldState) => pendingReviews(s, s.meta.shopId)

export default function Mutasi({ roleKey, onReview }: { roleKey: RoleKey; onReview?: () => void }) {
  const { lang } = useT()
  const L = S[lang]
  const live = useWorld(rowsSel)
  const done = useWorld(importSel)
  // the statement is a file: once imported, the rows stay as they were read (reviews do not reshuffle them)
  const sig = live.map((r) => `${r.id}:${r.amount}:${r.status}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => live, [sig])
  const frozen = useRef(stable)
  if (!done) frozen.current = stable
  const list = done ? frozen.current : stable
  const reviews = useWorld(reviewsSel)
  const holder = useWorld((s) => s.businesses.byId[s.meta.shopId]?.name ?? '')
  const [all, setAll] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [busy, setBusy] = useState(false)
  const doc = useMemo(() => mutasiDoc(list.map((r) => ({ date: r.date, desc: r.desc, amount: r.amount, balance: r.balance, status: r.status })), { bank: FICTIONAL_BANK, holder, id: 'pb-mutasi' }), [list, holder])
  const n = { cocok: 0, baru: 0, tinjau: 0 }
  for (const r of list) n[r.status]++

  const doImport = () => {
    const s = world.get()
    const fresh = mutasiRows(s, s.meta.shopId, periodOf(s))
    const baru = fresh.filter((r) => r.status === 'baru' && r.lines)
    emit('bank.imported', { businessId: s.meta.shopId, period: periodOf(s), rows: fresh.length, matched: fresh.filter((r) => r.status === 'cocok').length, posted: baru.length, review: fresh.filter((r) => r.status === 'tinjau').length, bank: FICTIONAL_BANK }, SLUG)
    for (const r of baru) emit('ledger.posted', { businessId: s.meta.shopId, memo: { id: r.desc, en: r.desc }, lines: r.lines!, source: 'bank', refId: r.id, needsReview: false, confidence: 0.94 }, SLUG, { at: r.at })
  }
  const openReview = () => {
    setDrawer(true)
    onReview?.()
  }
  const shown = all ? list : list.slice(0, PREVIEW_N)

  return (
    <div className="dk-pb-mutasi">
      <header className="dk-pb-mutasi-h">
        <div>
          <h3>{L.title}</h3>
          <p className="dk-pb-muted">{L.sub(FICTIONAL_BANK, list.length)}</p>
        </div>
        <div className="dk-pb-mutasi-thumb" aria-label={L.preview}>
          <DocArt doc={doc} label={L.preview} />
        </div>
      </header>
      <p className="dk-pb-mutasi-sum">{L.sum(n.cocok, n.baru, n.tinjau)}</p>
      <div className="dk-pb-tbl is-mutasi" role="table" aria-label={L.tableLabel}>
        <div role="row" className="dk-pb-tr is-head">
          {L.cols.map((c) => (
            <span role="columnheader" key={c}>
              {c}
            </span>
          ))}
        </div>
        {shown.map((r) => (
          <MutasiLine key={r.id} r={r} L={L} lang={lang} />
        ))}
      </div>
      <Button size="sm" variant="quiet" icon={all ? 'minus' : 'plus'} onClick={() => setAll((v) => !v)} aria-expanded={all}>
        {all ? L.showLess : L.showAll}
      </Button>
      <div className="dk-pb-mutasi-act">
        {done ? (
          <>
            <p role="status" className="dk-pb-ok-line">
              <Icon name="check" size={16} /> {L.imported(done.matched, done.posted, done.review)}
            </p>
            <Button variant="primary" icon="alert" onClick={openReview} data-pb="review-open" {...intentProps(loadReview)}>
              {L.review(reviews)}
            </Button>
          </>
        ) : (
          <Button variant="primary" icon="upload" onClick={() => { setBusy(true); afterPaint(doImport) }} disabled={busy} data-pb="import" {...intentProps(loadReview)}>
            {L.import(list.length)}
          </Button>
        )}
      </div>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={L.drawer} width={520}>
        <Suspense fallback={null}>
          <Review roleKey={roleKey} />
        </Suspense>
      </Drawer>
    </div>
  )
}

function MutasiLine({ r, L, lang }: { r: MutasiRowW; L: (typeof S)['id']; lang: 'id' | 'en' }) {
  const acc = r.lines?.find((l) => l.account !== 'Bank')?.account
  return (
    <div role="row" className={`dk-pb-tr is-${r.status}`}>
      <span role="cell">{dateText(r.date, lang)}</span>
      <span role="cell">
        {r.desc}
        {acc && r.status === 'baru' && <small> · {L.account} {ACCOUNT[acc]?.[lang] ?? acc}</small>}
      </span>
      <span role="cell" className={`is-num${r.amount > 0 ? ' is-in' : ''}`}>
        {rp(r.amount, lang)}
      </span>
      <span role="cell">
        <span className={`dk-pb-st is-${r.status === 'cocok' ? 'done' : r.status === 'tinjau' ? 'warn' : 'new'}`} title={L.stLong[r.status]}>
          {L.st[r.status]}
        </span>
      </span>
    </div>
  )
}
