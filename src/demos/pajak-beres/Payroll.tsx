/**
 * Payroll.tsx (lazy) — PPh 21 of the 5 toko employees for the month (TER, rules.ts): category from PTKP, the TER
 * row the gross falls in, amount; a 0-band employee shows Rp 0 with the reason. Consultant sees the formula, the TER
 * row range and the source chip. "Hitung semua" ⇒ tax.computed kind pph21. Wages here = the journal's Beban Gaji.
 */
import { useMemo } from 'react'
import { Button, Icon } from '../../demo-kit/ui'
import { useWorld, world, type WorldState } from '../../demo-kit/world'
import { STAFF_JOB, staffOf } from '../../demo-kit/world/usaha-pintar'
import { computePph21 } from './actions'
import { grossTotal, pph21Rows, pph21Total } from './pph21'
import { SOURCES, TER_ROWS, pctText } from './rules'
import { monthName, periodOf, rp, rpShort, taxItemOf, type RoleKey } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: (m: string) => `PPh 21 karyawan · ${m}`,
    lead: (n: number) => `${n} karyawan toko dipotong PPh 21 tiap bulan dengan tarif efektif rata-rata (TER). Gaji simulasi.`,
    cols: ['Karyawan', 'Status', 'Kategori', 'Bruto sebulan', 'Baris TER', 'Tarif', 'PPh 21'],
    zero: (cat: string, to: string) => `Rp 0: bruto di bawah ${to}, baris 0% kategori ${cat}`,
    formula: (g: string, r: string, a: string) => `${g} × ${r} = ${a}`,
    total: 'Total PPh 21',
    gross: 'Bruto 5 karyawan toko',
    wages: (n: number) => `Beban Gaji di jurnal (${n} karyawan, semua gerai)`,
    computeAll: 'Hitung semua',
    computed: (a: string) => `Sudah dihitung: ${a}. Masuk ke Kalender dan Ekspor.`,
    recompute: 'Hitung ulang',
    source: 'Sumber',
    ter: 'Baris TER yang dipakai (salinan lampiran PP 58/2023)',
    terCols: ['Kategori', 'Bruto dari', 'sampai', 'Tarif'],
    dec: 'Desember dihitung ulang dengan tarif Pasal 17 (tidak disimulasikan di sini).',
    tableLabel: 'PPh 21 per karyawan',
    newbie: 'baru',
  },
  en: {
    title: (m: string) => `Employee PPh 21 · ${m}`,
    lead: (n: number) => `${n} shop employees have PPh 21 withheld every month at the average effective rate (TER). Simulated wages.`,
    cols: ['Employee', 'Status', 'Category', 'Monthly gross', 'TER row', 'Rate', 'PPh 21'],
    zero: (cat: string, to: string) => `Rp 0: gross below ${to}, the 0% row of category ${cat}`,
    formula: (g: string, r: string, a: string) => `${g} × ${r} = ${a}`,
    total: 'Total PPh 21',
    gross: 'Gross of the 5 shop employees',
    wages: (n: number) => `Wage expense in the journal (${n} employees, all outlets)`,
    computeAll: 'Compute all',
    computed: (a: string) => `Computed: ${a}. Sent to the Calendar and Export.`,
    recompute: 'Compute again',
    source: 'Source',
    ter: 'TER rows used (copied from the PP 58/2023 annex)',
    terCols: ['Category', 'Gross from', 'to', 'Rate'],
    dec: 'December is recalculated with the Article 17 rates (not simulated here).',
    tableLabel: 'PPh 21 per employee',
    newbie: 'new',
  },
}

const itemSel = (s: WorldState) => taxItemOf(s, 'pph21', periodOf(s)) ?? null
const staffSel = (s: WorldState) => s.staff

export default function Payroll({ roleKey }: { roleKey: RoleKey }) {
  const { lang } = useT()
  const L = S[lang]
  const staffT = useWorld(staffSel)
  const period = useWorld(periodOf)
  const item = useWorld(itemSel)
  const list = useMemo(() => pph21Rows(worldLike(staffT)), [staffT])
  const all = useWorld((s) => staffOf(s, s.meta.shopId).reduce((a, x) => a + x.gross, 0))
  const nAll = useWorld((s) => staffOf(s, s.meta.shopId).length)
  const total = pph21Total(list)
  const k = roleKey === 'konsultan'

  return (
    <div className="dk-pb-payroll">
      <header className="dk-pb-pay-h">
        <div>
          <h3>{L.title(monthName(period, lang))}</h3>
          <p className="dk-pb-muted">{L.lead(list.length)}</p>
        </div>
        <div className="dk-pb-pay-act">
          {item?.amount != null && (
            <p className="dk-pb-ok-line" role="status">
              <Icon name="check" size={14} /> {L.computed(rp(item.amount, lang))}
            </p>
          )}
          <Button variant={item?.amount != null ? 'secondary' : 'primary'} icon="spark" onClick={() => computePph21()} data-pb="pph21" data-hotspot="pb-pph21">
            {item?.amount != null ? L.recompute : L.computeAll}
          </Button>
        </div>
      </header>
      <div className={`dk-pb-tbl is-pay${k ? ' is-k' : ''}`} role="table" aria-label={L.tableLabel}>
        <div role="row" className="dk-pb-tr is-head">
          {L.cols.filter((_, i) => k || (i !== 4 && i !== 2)).map((c) => (
            <span role="columnheader" key={c}>
              {c}
            </span>
          ))}
        </div>
        {list.map((r) => (
          <div role="row" className="dk-pb-tr" key={r.staff.id} data-staff={r.staff.id}>
            <span role="cell">
              <strong>{r.staff.name}</strong>
              <small>
                {STAFF_JOB[r.staff.job][lang]}
                {r.staff.isNew ? ` · ${L.newbie}` : ''}
              </small>
            </span>
            <span role="cell">{r.staff.ptkp}</span>
            {k && <span role="cell">{r.category}</span>}
            <span role="cell" className="is-num">
              {rp(r.staff.gross, lang)}
            </span>
            {k && (
              <span role="cell" className="is-num">
                {r.row ? `${r.row.id} · ${rpShort(r.row.from, lang)}–${rpShort(r.row.to, lang)}` : '—'}
              </span>
            )}
            <span role="cell" className="is-num">
              {pctText(r.rate, lang)}
            </span>
            <span role="cell" className="is-num" data-pb="pph21-amt">
              <strong>{rp(r.amount, lang)}</strong>
              <small>{r.amount === 0 && r.row ? L.zero(r.category, rpShort(r.row.to, lang)) : k ? L.formula(rp(r.staff.gross, lang), pctText(r.rate, lang), rp(r.amount, lang)) : ''}</small>
            </span>
          </div>
        ))}
        <div role="row" className="dk-pb-tr is-total">
          <span role="cell">{L.total}</span>
          <span role="cell" className="is-num" data-pb="pph21-total">
            {rp(total, lang)}
          </span>
        </div>
      </div>
      <dl className="dk-pb-dl is-pay">
        <dt>{L.gross}</dt>
        <dd>{rp(grossTotal(list), lang)}</dd>
        <dt>{L.wages(nAll)}</dt>
        <dd data-pb="wages">{rp(all, lang)}</dd>
      </dl>
      {k && (
        <details className="dk-pb-ter">
          <summary>{L.ter}</summary>
          <div className="dk-pb-tbl is-ter" role="table" aria-label={L.ter}>
            <div role="row" className="dk-pb-tr is-head">
              {L.terCols.map((c) => (
                <span role="columnheader" key={c}>
                  {c}
                </span>
              ))}
            </div>
            {TER_ROWS.map((r) => (
              <div role="row" className="dk-pb-tr" key={r.id}>
                <span role="cell">{r.category}</span>
                <span role="cell" className="is-num">{rp(r.from, lang)}</span>
                <span role="cell" className="is-num">{rp(r.to, lang)}</span>
                <span role="cell" className="is-num">{pctText(r.rate, lang)}</span>
              </div>
            ))}
          </div>
          <p className="dk-pb-muted">{L.dec}</p>
        </details>
      )}
      <p className="dk-pb-muted">
        {L.source}:{' '}
        <a className="dk-pb-cite" href={SOURCES.ter.url} target="_blank" rel="noreferrer">
          {SOURCES.ter.ref}
        </a>{' '}
        ·{' '}
        <a className="dk-pb-cite" href={SOURCES.ptkp.url} target="_blank" rel="noreferrer">
          {SOURCES.ptkp.ref}
        </a>
      </p>
    </div>
  )
}

/** pph21Rows reads s.meta / s.staff only: re-run it when the staff table changes */
const worldLike = (_staff: WorldState['staff']): WorldState => world.get()
