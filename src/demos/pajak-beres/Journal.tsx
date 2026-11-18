/**
 * Journal.tsx (lazy) — the journal. Owner: plain rows ("Uang masuk" / "Uang keluar"), debit/credit behind "Lihat
 * detail akuntansi". Consultant: the "Perlu tinjauan" queue first, every row with CoA codes, lines and confidence,
 * and "Kunci periode Oktober" ⇒ period.locked (rows of a locked period show a lock and cannot be edited).
 * ?focus=<ledger id> scrolls to the row and flashes it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Icon, Segmented, flashNewRow } from '../../demo-kit/ui'
import { emit, hhmm, useWorld, type LedgerEntry, type WorldState } from '../../demo-kit/world'
import { ACCOUNT, coaOf } from '../../demo-kit/world/usaha-pintar'
import Review from './Review'
import { SLUG, dateText, entryAmount, isBalanced, isoOf, lockedOf, monthName, prevPeriodOf, rp, type RoleKey } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: 'Jurnal',
    filters: { semua: 'Semua', sale: 'Penjualan', nota: 'Nota', bank: 'Bank', review: 'Perlu tinjauan' },
    filterLabel: 'Saring jurnal',
    detail: 'Lihat detail akuntansi',
    hideDetail: 'Sembunyikan detail akuntansi',
    more: (n: number) => `Tampilkan ${n} lagi`,
    lock: (m: string) => `Kunci periode ${m}`,
    locked: (m: string) => `Periode ${m} sudah dikunci`,
    lockedWhy: 'Periode yang dikunci tidak bisa diubah lagi.',
    lockNote: 'Hanya Konsultan Pajak yang bisa mengunci periode.',
    moneyIn: 'Uang masuk',
    moneyOut: 'Uang keluar',
    move: 'Pindah dana',
    conf: 'keyakinan',
    count: (n: number, all: number) => `${n} dari ${all} baris`,
    tableLabel: 'Baris jurnal, terbaru di atas',
    unbalanced: 'tidak seimbang',
    src: { sale: 'Penjualan', nota: 'Nota', bank: 'Bank', purchase: 'Pembelian', manual: 'Manual' } as Record<string, string>,
    sim: 'Data simulasi',
  },
  en: {
    title: 'Journal',
    filters: { semua: 'All', sale: 'Sales', nota: 'Invoices', bank: 'Bank', review: 'Needs review' },
    filterLabel: 'Filter the journal',
    detail: 'Show accounting detail',
    hideDetail: 'Hide accounting detail',
    more: (n: number) => `Show ${n} more`,
    lock: (m: string) => `Lock the ${m} period`,
    locked: (m: string) => `${m} period locked`,
    lockedWhy: 'A locked period can no longer be changed.',
    lockNote: 'Only the tax consultant can lock a period.',
    moneyIn: 'Money in',
    moneyOut: 'Money out',
    move: 'Transfer',
    conf: 'confidence',
    count: (n: number, all: number) => `${n} of ${all} rows`,
    tableLabel: 'Journal rows, newest first',
    unbalanced: 'unbalanced',
    src: { sale: 'Sale', nota: 'Invoice', bank: 'Bank', purchase: 'Purchase', manual: 'Manual' } as Record<string, string>,
    sim: 'Simulated data',
  },
}

type Filter = keyof (typeof S)['id']['filters']
const PAGE = 40
const ledgerSel = (s: WorldState) => s.ledger
const ctxSel = (s: WorldState) => s.meta.shopId + '|' + s.day

export default function Journal({ roleKey, focusId, onFocusDone }: { roleKey: RoleKey; focusId: string | null; onFocusDone: () => void }) {
  const { lang } = useT()
  const L = S[lang]
  const ledger = useWorld(ledgerSel)
  const [shop, day] = useWorld(ctxSel).split('|') as [string, string]
  const locked = useWorld(lockedOf)
  const prev = useWorld(prevPeriodOf)
  const [filter, setFilter] = useState<Filter>('semua')
  const [limit, setLimit] = useState(PAGE)
  const [detail, setDetail] = useState(roleKey === 'konsultan')
  useEffect(() => setDetail(roleKey === 'konsultan'), [roleKey])
  const listRef = useRef<HTMLDivElement>(null)

  const all = useMemo(() => {
    const out: LedgerEntry[] = []
    for (const id of ledger.ids) {
      const j = ledger.byId[id]
      if (j && j.businessId === shop) out.push(j)
    }
    return out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
  }, [ledger, shop])
  const rowsF = useMemo(() => all.filter((j) => filter === 'semua' || (filter === 'review' ? j.needsReview : filter === 'bank' ? j.source === 'bank' : j.source === filter)), [all, filter])

  // ?focus=<ledger id>: show it (all rows, page wide enough), scroll, flash
  useEffect(() => {
    if (!focusId) return
    const idx = all.findIndex((j) => j.id === focusId)
    if (idx < 0) return
    setFilter('semua')
    setLimit((l) => Math.max(l, idx + 1))
    const tm = window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-ledger="${CSS.escape(focusId)}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        el.classList.add('is-focus')
        flashNewRow(el)
        el.focus({ preventScroll: true })
      }
      onFocusDone()
    }, 60)
    return () => window.clearTimeout(tm)
  }, [focusId, all, onFocusDone])

  const pm = monthName(prev, lang)
  const isLocked = (j: LedgerEntry) => locked.includes(isoOf({ day } as WorldState, j.at).slice(0, 7))
  const shown = rowsF.slice(0, limit)

  return (
    <div className="dk-pb-journal">
      {roleKey === 'konsultan' && <Review roleKey={roleKey} compact />}
      <div className="dk-pb-jbar">
        <Segmented size="sm" label={L.filterLabel} value={filter} onChange={(v) => { setFilter(v); setLimit(PAGE) }} options={(Object.keys(L.filters) as Filter[]).map((k) => ({ value: k, label: L.filters[k] }))} />
        <div className="dk-pb-jbar-r">
          {roleKey === 'owner' && (
            <Button size="sm" variant="quiet" icon="eye" onClick={() => setDetail((v) => !v)} aria-pressed={detail} data-pb="detail">
              {detail ? L.hideDetail : L.detail}
            </Button>
          )}
          {roleKey === 'konsultan' &&
            (locked.includes(prev) ? (
              <span className="dk-pb-st is-done">
                <Icon name="lock" size={14} /> {L.locked(pm)}
              </span>
            ) : (
              <Button size="sm" variant="secondary" icon="lock" onClick={() => emit('period.locked', { businessId: shop, period: prev }, SLUG)} data-pb="lock">
                {L.lock(pm)}
              </Button>
            ))}
        </div>
      </div>
      {roleKey === 'owner' && <Review roleKey={roleKey} compact />}
      <p className="dk-pb-muted dk-pb-jcount">
        {L.count(shown.length, rowsF.length)} · {L.sim}
      </p>
      <div ref={listRef} className={`dk-pb-jlist${detail ? ' has-detail' : ''}`} role="list" aria-label={L.tableLabel}>
        {shown.map((j) => (
          <JRow key={j.id} j={j} L={L} lang={lang} roleKey={roleKey} detail={detail} locked={isLocked(j)} day={day} />
        ))}
      </div>
      {rowsF.length > limit && (
        <Button size="sm" variant="secondary" icon="plus" onClick={() => setLimit((l) => l + PAGE)}>
          {L.more(Math.min(PAGE, rowsF.length - limit))}
        </Button>
      )}
    </div>
  )
}

function JRow({ j, L, lang, roleKey, detail, locked, day }: { j: LedgerEntry; L: (typeof S)['id']; lang: 'id' | 'en'; roleKey: RoleKey; detail: boolean; locked: boolean; day: string }) {
  const cashIn = j.lines.reduce((a, l) => a + ((l.account === 'Kas' || l.account === 'Bank') ? l.debit - l.credit : 0), 0)
  const plain = cashIn > 0 ? L.moneyIn : cashIn < 0 ? L.moneyOut : L.move
  return (
    <div role="listitem" className={`dk-pb-jrow${j.needsReview ? ' is-review' : ''}`} data-ledger={j.id} tabIndex={-1}>
      <span className="dk-pb-jdate">
        {dateText(isoOf({ day } as WorldState, j.at), lang)}
        <small>{hhmm(j.at)}</small>
      </span>
      <span className="dk-pb-jmemo">
        {locked && <Icon name="lock" size={14} title={L.lockedWhy} />}
        {j.memo[lang]}
        <small>
          {L.src[j.source] ?? j.source} · {j.id}
          {roleKey === 'konsultan' && ` · ${L.conf} ${Math.round(j.confidence * 100)}%`}
          {!isBalanced(j) && ` · ${L.unbalanced}`}
        </small>
      </span>
      <span className={`dk-pb-jamt${cashIn > 0 ? ' is-in' : ''}`}>
        {roleKey === 'owner' && <small>{plain}</small>}
        {rp(roleKey === 'owner' && cashIn ? Math.abs(cashIn) : entryAmount(j), lang)}
      </span>
      {detail && (
        <ul className="dk-pb-jlines">
          {j.lines.map((l, i) => (
            <li key={i} className={l.credit ? 'is-cr' : ''}>
              <span className="dk-pb-code">{coaOf(l.account).code}</span>
              <span>{ACCOUNT[l.account]?.[lang] ?? l.account}</span>
              <span className="is-num">{l.debit ? `D ${rp(l.debit, lang)}` : `${lang === "id" ? "K" : "C"} ${rp(l.credit, lang)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
