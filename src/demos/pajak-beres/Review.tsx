/**
 * Review.tsx (lazy) — the "Perlu tinjauan" queue: each journal row the AI was unsure about (the 3 bank rows of the
 * statement, an altered receipt) with a suggested account, an account picker and "Setujui" ⇒ ledger.reviewed (lines
 * replaced, balanced). Used inline in Jurnal and in the drawer after the bank-statement import. Rows of a locked
 * period show a lock and cannot be edited.
 */
import { useMemo, useState } from 'react'
import { Button, Icon, Select } from '../../demo-kit/ui'
import { emit, useWorld, type LedgerEntry, type LedgerLine, type WorldState } from '../../demo-kit/world'
import { ACCOUNT, COA, coaOf, ledgerRows } from '../../demo-kit/world/usaha-pintar'
import { SLUG, afterPaint, dateText, entryAmount, isoOf, lockedOf, rp, type Lang, type RoleKey } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: (n: number) => `Perlu tinjauan (${n})`,
    empty: 'Semua jurnal sudah rapi. Tidak ada yang perlu ditinjau.',
    suggest: 'Saran AI',
    account: 'Akun',
    approve: 'Setujui',
    approveAll: (n: number) => `Setujui ${n} saran`,
    conf: (p: number) => `keyakinan ${p}%`,
    locked: 'Periode dikunci konsultan: tidak bisa diubah',
    why: {
      tarik: 'Tarik tunai memindahkan uang dari Bank ke Kas, bukan biaya.',
      online: 'Belanja barang dagangan di toko online menambah persediaan.',
      masuk: 'Transfer pelanggan untuk pesanan: pendapatan penjualan.',
      nota: 'Pakai jumlah barang di nota, bukan total yang ditimpa.',
      other: 'Kategori dipertahankan.',
    },
    note: 'Ditinjau di Pajak Beres',
  },
  en: {
    title: (n: number) => `Needs review (${n})`,
    empty: 'Every journal entry is tidy. Nothing to review.',
    suggest: 'AI suggestion',
    account: 'Account',
    approve: 'Approve',
    approveAll: (n: number) => `Approve ${n} suggestions`,
    conf: (p: number) => `confidence ${p}%`,
    locked: 'Period locked by the consultant: cannot be changed',
    why: {
      tarik: 'A cash withdrawal moves money from Bank to Cash; it is not an expense.',
      online: 'Buying stock from an online shop adds to inventory.',
      masuk: 'A customer transfer for an order: sales revenue.',
      nota: 'Use the item sum on the receipt, not the overwritten total.',
      other: 'Category kept.',
    },
    note: 'Reviewed in Pajak Beres',
  },
}

type Why = keyof (typeof S)['id']['why']
const isCash = (a: string) => a === 'Kas' || a === 'Bank'
/** the line the review is about: the first non-cash line (the cash line stays) */
const targetIdx = (j: LedgerEntry) => Math.max(0, j.lines.findIndex((l) => !isCash(l.account)))
export function suggestion(j: LedgerEntry): { account: string; why: Why } {
  const m = j.memo.id.toLowerCase()
  if (m.includes('tarik tunai')) return { account: 'Kas', why: 'tarik' }
  if (m.includes('toko online')) return { account: 'Persediaan', why: 'online' }
  if (m.includes('transfer masuk')) return { account: 'Pendapatan Penjualan', why: 'masuk' }
  if (j.source === 'nota') return { account: j.lines[targetIdx(j)]?.account ?? 'Persediaan', why: 'nota' }
  return { account: j.lines[targetIdx(j)]?.account ?? 'Beban Lain-lain', why: 'other' }
}
export const reviewedLines = (j: LedgerEntry, account: string): LedgerLine[] => {
  const i = targetIdx(j)
  return j.lines.map((l, k) => (k === i ? { ...l, account } : l))
}

const reviewSel = (s: WorldState) => ledgerRows(s, s.meta.shopId, { review: true })
const sameIds = (a: LedgerEntry[], b: LedgerEntry[]) => a.length === b.length && a.every((x, i) => x === b[i])

export default function Review({ roleKey, compact }: { roleKey: RoleKey; compact?: boolean }) {
  const { lang } = useT()
  const L = S[lang]
  const list = useWorld(reviewSel, sameIds)
  const locked = useWorld(lockedOf)
  const day = useWorld((s) => s.day)
  const [pick, setPick] = useState<Record<string, string>>({})
  const options = useMemo(() => COA.map((c) => ({ value: c.account, label: roleKey === 'konsultan' ? `${c.code} · ${c.name[lang]}` : c.name[lang] })), [roleKey, lang])
  const approve = (j: LedgerEntry) => {
    const acc = pick[j.id] ?? suggestion(j).account
    afterPaint(() => emit('ledger.reviewed', { ledgerId: j.id, lines: reviewedLines(j, acc), note: { id: S.id.note, en: S.en.note } }, SLUG))
  }
  const isLocked = (j: LedgerEntry) => locked.includes(isoOf({ day } as WorldState, j.at).slice(0, 7))
  const open = list.filter((j) => !isLocked(j))

  return (
    <section className={`dk-pb-review${compact ? ' is-compact' : ''}`} aria-labelledby="pb-review-h" data-pb="review">
      <div className="dk-pb-review-h">
        <h3 id="pb-review-h">
          <Icon name="alert" size={16} /> {L.title(list.length)}
        </h3>
        {open.length > 1 && (
          <Button size="sm" variant="secondary" icon="check" onClick={() => open.forEach(approve)} data-pb="approve-all">
            {L.approveAll(open.length)}
          </Button>
        )}
      </div>
      {!list.length ? (
        <p className="dk-pb-muted" role="status">
          <Icon name="check" size={14} /> {L.empty}
        </p>
      ) : (
        <ul className="dk-pb-review-list">
          {list.map((j) => {
            const sug = suggestion(j)
            const cur = pick[j.id] ?? sug.account
            const lk = isLocked(j)
            const target = j.lines[targetIdx(j)]?.account ?? ''
            return (
              <li key={j.id} data-ledger={j.id} className="dk-pb-review-row">
                <p className="dk-pb-review-memo">
                  <strong>{j.memo[lang]}</strong>
                  <small>
                    {dateText(isoOf({ day } as WorldState, j.at), lang)} · {rp(entryAmount(j), lang)}
                    {roleKey === 'konsultan' && ` · ${coaOf(target).code} ${ACCOUNT[target]?.[lang] ?? target} · ${L.conf(Math.round(j.confidence * 100))}`}
                  </small>
                </p>
                <p className="dk-pb-review-sug">
                  <Icon name="spark" size={14} /> {L.suggest}: <strong>{ACCOUNT[sug.account]?.[lang] ?? sug.account}</strong> · {L.why[sug.why]}
                </p>
                {lk ? (
                  <p className="dk-pb-lock">
                    <Icon name="lock" size={14} /> {L.locked}
                  </p>
                ) : (
                  <div className="dk-pb-review-act">
                    <label className="dk-pb-review-pick">
                      <span className="dk-sr">{L.account}</span>
                      <Select value={cur} onChange={(e) => setPick((p) => ({ ...p, [j.id]: e.target.value }))} options={options} aria-label={`${L.account}: ${j.memo[lang]}`} />
                    </label>
                    <Button size="sm" variant="primary" icon="check" onClick={() => approve(j)} data-pb="approve">
                      {L.approve}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export type { Lang }
