/**
 * Review.tsx (lazy) — "Rapikan jurnal" drawer: the shop's review rows (`ledger.needsReview`, same rows as Pajak Beres
 * "Perlu tinjauan") with the AI's suggested account (`reviewSuggestion`, the Pajak Beres rule) → "Setujui N saran" ⇒
 * one `ledger.reviewed` per row (source rapor-usaha, 250 ms apart, lines = `reviewedLines`) ⇒ C19 `score.updated`
 * +10 each (the dial moves 710 → 720 → 730 → 740).
 */
import { useEffect, useRef, useState } from 'react'
import { Button, Drawer, Icon, flashNewRow } from '../../demo-kit/ui'
import { emit, useWorld, type LedgerEntry, type WorldState } from '../../demo-kit/world'
import { reviewSuggestion, reviewedLines } from '../../demo-kit/world/pasar-daerah'
import { SLUG, rp, timeText, uiStore, useUi } from './model'
import { DemoLink } from './DemoLink'
import { useT } from './strings'

const S = {
  id: {
    title: 'Rapikan jurnal',
    eyebrow: 'Saran akun dari AI · data simulasi',
    intro: 'Jurnal ini dicatat otomatis tetapi akunnya belum pasti. Setujui saran AI supaya laporan rapi; skor pajak ikut naik.',
    suggest: 'Saran AI',
    now: 'Sekarang',
    approveAll: (n: number) => `Setujui ${n} saran`,
    working: 'Menyimpan…',
    empty: 'Semua jurnal sudah rapi. Tidak ada yang perlu ditinjau.',
    pb: 'Lihat jurnal di Pajak Beres',
    why: {
      tarik: 'Tarik tunai memindahkan uang dari Bank ke Kas, bukan biaya.',
      online: 'Belanja barang dagangan di toko online menambah persediaan.',
      masuk: 'Transfer pelanggan untuk pesanan: pendapatan penjualan.',
      nota: 'Pakai jumlah barang di nota, bukan total yang ditimpa.',
      other: 'Kategori dipertahankan.',
    } as Record<string, string>,
    note: 'Ditinjau di Rapor Usaha',
  },
  en: {
    title: 'Tidy the journals',
    eyebrow: 'AI account suggestions · simulated data',
    intro: 'These entries were booked automatically but their account is uncertain. Approve the AI suggestions to tidy the books; the tax factor rises with them.',
    suggest: 'AI suggestion',
    now: 'Now',
    approveAll: (n: number) => `Approve ${n} suggestions`,
    working: 'Saving…',
    empty: 'Every journal entry is tidy. Nothing to review.',
    pb: 'See the journal in Pajak Beres',
    why: {
      tarik: 'A cash withdrawal moves money from Bank to Cash; it is not an expense.',
      online: 'Buying stock from an online shop adds to inventory.',
      masuk: 'A customer transfer for an order: sales revenue.',
      nota: 'Use the item sum on the receipt, not the overwritten total.',
      other: 'Category kept.',
    },
    note: 'Reviewed in Rapor Usaha',
  },
}
const ACC_EN: Record<string, string> = {
  Kas: 'Cash',
  Bank: 'Bank',
  Persediaan: 'Inventory',
  'Pendapatan Penjualan': 'Sales revenue',
  'Pendapatan Lain-lain': 'Other income',
  'Beban Lain-lain': 'Other expenses',
  'Utang Usaha': 'Accounts payable',
  Prive: 'Drawings',
}
const isCash = (a: string) => a === 'Kas' || a === 'Bank'
const amountOf = (j: LedgerEntry) => j.lines.reduce((a, l) => a + l.debit, 0)
const listSel = (s: WorldState) => s.ledger.ids.map((id) => s.ledger.byId[id]!).filter((j) => j.businessId === s.meta.shopId && j.needsReview)
const sameIds = (a: LedgerEntry[], b: LedgerEntry[]) => a.length === b.length && a.every((x, i) => x === b[i])

export default function Review() {
  const { lang } = useT()
  const L = S[lang]
  const open = useUi((u) => u.review)
  const list = useWorld(listSel, sameIds)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLUListElement>(null)
  const acc = (a: string) => (lang === 'id' ? a : (ACC_EN[a] ?? a))
  useEffect(() => {
    if (typeof open !== 'string') return
    const el = box.current?.querySelector<HTMLElement>(`[data-ledger="${open}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      flashNewRow(el)
    }
  }, [open, list.length])
  const approveAll = () => {
    const rowsNow = [...list]
    setBusy(true)
    rowsNow.forEach((j, i) => {
      window.setTimeout(() => {
        emit('ledger.reviewed', { ledgerId: j.id, lines: reviewedLines(j, reviewSuggestion(j).account), note: { id: S.id.note, en: S.en.note } }, SLUG)
        if (i === rowsNow.length - 1) setBusy(false)
      }, i * 250)
    })
  }
  return (
    <Drawer open={open !== false} onClose={() => uiStore.set({ review: false })} title={L.title} eyebrow={L.eyebrow} width={480}>
      <div className="dk-ru-review" data-ru="review">
        <p className="dk-ru-muted">{L.intro}</p>
        {list.length ? (
          <ul className="dk-ru-review-list" ref={box}>
            {list.map((j) => {
              const sug = reviewSuggestion(j)
              const target = j.lines.find((l) => !isCash(l.account))?.account ?? j.lines[0]?.account ?? ''
              return (
                <li key={j.id} className="dk-ru-review-row" data-ledger={j.id}>
                  <strong>{j.memo[lang]}</strong>
                  <small className="dk-num">
                    {j.id} · {timeText(j.at, lang)} · {rp(amountOf(j), lang)}
                  </small>
                  <span>
                    {L.now}: {acc(target)} <Icon name="arrowRight" size={12} /> <b>{L.suggest}: {acc(sug.account)}</b>
                  </span>
                  <span className="dk-ru-muted">{L.why[sug.why]}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-ru-ok" role="status">
            <Icon name="checkCircle" size={16} /> {L.empty}
          </p>
        )}
        <div className="dk-ru-row">
          {list.length > 0 && (
            <Button variant="primary" icon="check" onClick={approveAll} disabled={busy} data-ru="approve-reviews">
              {busy ? L.working : L.approveAll(list.length)}
            </Button>
          )}
          <DemoLink slug="pajak-beres" href="/demo/pajak-beres?tab=jurnal" className="dk-ru-actlink">
            {L.pb} <Icon name="arrowUpRight" size={14} />
          </DemoLink>
        </div>
      </div>
    </Drawer>
  )
}
