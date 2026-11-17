/**
 * samples/finance.ts — Pajak Beres inputs: a crumpled shop receipt (nota) + an edited variant, a supplier invoice
 * (faktur) and a bank-statement CSV (40 rows) from a FICTIONAL bank. No tax rates appear here on purpose (the
 * invoice is from a non-VAT-registered seller); tax rules live in demos/pajak-beres/rules.ts with sources.
 */
import { runBox } from '../measure'
import { dmy, longDate } from '../nik'
import { hashString, makeRng } from '../../world/prng'
import type { LineItem, MutasiMeta, MutasiRow, ReceiptMeta, SampleDoc } from '../types'
import { DocBuilder, INK, MUTED } from './builder'

export const FICTIONAL_BANK = 'Bank Arta Kencana'
export const BUYER = 'Warung Makan Bu Tini'

/** "1.250.000" */
export const idr = (n: number) => Math.round(n).toLocaleString('id-ID')

/* ------------------------------------------------------------------ nota (thermal receipt) */

const NOTA_ITEMS: LineItem[] = [
  { name: 'Semen 40 kg', qty: 5, unit: 'sak', price: 62000 },
  { name: 'Paku 7 cm (1 kg)', qty: 2, unit: 'kg', price: 18000 },
  { name: 'Cat tembok 5 kg', qty: 1, unit: 'galon', price: 95000 },
  { name: 'Kuas 3 inci', qty: 2, unit: 'pcs', price: 9000 },
]

function makeNota(edit: boolean): SampleDoc {
  const W = 380
  const b = new DocBuilder(W, 900, { font: 'mono', size: 14, fill: '#2a2833' })
  const total = NOTA_ITEMS.reduce((s, i) => s + i.qty * i.price, 0)
  const printed = edit ? total + 60000 : total
  const cash = 500000
  const L = 22
  const R = W - 22
  const rule = (y: number) => b.text(W / 2, y, '-'.repeat(32), { anchor: 'middle', fill: '#6b6878' })

  b.field('merchant', { id: 'Nama toko', en: 'Store name' }, 'TB SUMBER MAKMUR', W / 2, 54, { size: 20, weight: 700, anchor: 'middle' })
  b.text(W / 2, 76, 'Jl. Raya Kapas, Bojonegoro', { anchor: 'middle', size: 12.5 })
  b.text(W / 2, 94, 'toko fiktif · demo GAMADA', { anchor: 'middle', size: 11, fill: '#6b6878' })
  rule(116)
  b.text(L, 140, 'No   :')
  b.field('nomor', { id: 'Nomor nota', en: 'Receipt number' }, '0458/XI/26', L + 72, 140)
  b.text(L, 160, 'Tgl  :')
  b.field('tanggal', { id: 'Tanggal', en: 'Date' }, '2026-11-16 14:21', L + 72, 160, {}, { shown: `${dmy('2026-11-16')} 14:21` })
  b.text(L, 180, 'Kasir: Rina')
  rule(202)
  let y = 228
  NOTA_ITEMS.forEach((it, i) => {
    const n = i + 1
    const a = b.text(L, y, it.name)
    const sub = it.qty * it.price
    const q = b.text(L + 16, y + 20, `${it.qty} x ${idr(it.price)}`)
    const t = b.text(R, y + 20, idr(sub), { anchor: 'end' })
    b.fieldRuns(`item_${n}`, { id: `Item ${n}`, en: `Item ${n}` }, `${it.name} · ${it.qty} × ${idr(it.price)} = ${idr(sub)}`, [a, q, t])
    y += 48
  })
  rule(y - 6)
  y += 18
  b.text(L, y, 'TOTAL', { weight: 700, size: 16 })
  if (edit) b.shape({ t: 'patch', x: R - 92, y: y - 17, w: 96, h: 23, fill: '#f6f4ec' })
  const totalRun = b.field('total', { id: 'Total', en: 'Total' }, String(printed), R, y + (edit ? 1 : 0), { anchor: 'end', weight: 700, size: edit ? 16.8 : 16 }, { shown: idr(printed) })
  y += 22
  const tunai = b.text(L, y, 'TUNAI')
  b.field('bayar', { id: 'Dibayar', en: 'Paid' }, String(cash), R, y, { anchor: 'end' }, { shown: idr(cash) })
  y += 20
  b.text(L, y, 'KEMBALI')
  b.field('kembali', { id: 'Kembalian', en: 'Change' }, String(cash - total), R, y, { anchor: 'end' }, { shown: idr(cash - total) })
  y += 14
  rule(y + 8)
  b.text(W / 2, y + 36, 'Terima kasih atas kunjungan Anda', { anchor: 'middle', size: 12 })
  b.text(W / 2, y + 54, 'Barang yang sudah dibeli', { anchor: 'middle', size: 12 })
  b.text(W / 2, y + 70, 'tidak dapat ditukar', { anchor: 'middle', size: 12 })
  b.fieldBox('metode', { id: 'Metode bayar', en: 'Payment method' }, 'Tunai', runBox(tunai))
  b.h = y + 96
  b.over({ t: 'creases', seed: edit ? 7 : 3, count: 6 })

  if (edit) {
    b.tamper.push({
      box: runBox(totalRun, 0.6),
      score: 0.93,
      field: 'total',
      reason: { id: 'Angka total diganti: tidak sama dengan jumlah item, huruf lebih tebal', en: 'Total replaced: differs from the item sum, heavier glyphs' },
    })
  }

  const meta: ReceiptMeta = {
    kind: 'nota',
    merchant: 'TB Sumber Makmur',
    number: '0458/XI/26',
    date: '2026-11-16',
    items: NOTA_ITEMS,
    total,
    printedTotal: printed,
    journal: {
      debit: 'Beban perbaikan & pemeliharaan',
      credit: 'Kas',
      amount: total,
      memo: { id: 'Bahan renovasi dapur · TB Sumber Makmur', en: 'Kitchen renovation materials · TB Sumber Makmur' },
    },
    edited: edit,
  }
  return b.build({
    id: edit ? 'nota-tb-edit' : 'nota-tb',
    kind: 'nota',
    extractKind: 'invoice',
    title: edit ? { id: 'Nota belanja · total diubah', en: 'Shop receipt · total altered' } : { id: 'Nota belanja toko bangunan', en: 'Hardware-store receipt' },
    caption: edit ? { id: 'Angka total ditimpa', en: 'Total overwritten' } : { id: 'Foto HP · kusut dan miring', en: 'Phone photo · crumpled and tilted' },
    bg: 'thermal',
    scan: { rotate: edit ? 5 : -7, rotX: 20, rotY: edit ? 8 : -10, scale: 0.9, noise: 0.45, shade: 0.55 },
    specimen: false,
    meta,
  })
}

/* ------------------------------------------------------------------ faktur */

const FAKTUR_ITEMS: LineItem[] = [
  { name: 'Beras medium 25 kg', qty: 4, unit: 'karung', price: 340000 },
  { name: 'Minyak goreng 2 L', qty: 6, unit: 'pouch', price: 38000 },
  { name: 'Gula pasir 1 kg', qty: 10, unit: 'kg', price: 18000 },
  { name: 'Telur ayam ras', qty: 5, unit: 'kg', price: 29000 },
]

function makeFaktur(): SampleDoc {
  const W = 840
  const H = 1188
  const b = new DocBuilder(W, H, { font: 'sans', size: 14, fill: INK })
  const sub = FAKTUR_ITEMS.reduce((s, i) => s + i.qty * i.price, 0)
  const ship = 25000
  const total = sub + ship

  b.shape({ t: 'rect', x: 0, y: 0, w: W, h: 10, fill: '#2f5d62' })
  b.field('penjual', { id: 'Penjual', en: 'Seller' }, 'CV Karya Tirta Sentosa', 64, 82, { size: 24, weight: 700 })
  b.text(64, 106, 'Distributor bahan pangan · perusahaan fiktif untuk demo', { size: 12.5, fill: MUTED })
  b.text(64, 124, 'Kawasan Pergudangan Kapas, Bojonegoro', { size: 12.5, fill: MUTED })
  b.text(W - 64, 82, 'FAKTUR', { size: 30, weight: 700, anchor: 'end', ls: 0.08, fill: '#2f5d62' })

  const meta2: [string, string, string, string?][] = [
    ['No. Faktur', 'INV/KTS/2611/0457', 'nomor'],
    ['Tanggal', '2026-11-14', 'tanggal', longDate('2026-11-14')],
    ['Jatuh tempo', '2026-11-28', 'jatuh_tempo', longDate('2026-11-28')],
  ]
  meta2.forEach(([k, v, key, shown], i) => {
    const y = 112 + i * 22
    b.text(W - 250, y, k, { size: 13, fill: MUTED })
    b.field(key, key === 'nomor' ? { id: 'Nomor faktur', en: 'Invoice number' } : key === 'tanggal' ? { id: 'Tanggal', en: 'Date' } : { id: 'Jatuh tempo', en: 'Due date' }, v, W - 64, y, { size: 13, weight: 600, anchor: 'end' }, shown ? { shown } : {})
  })

  b.shape({ t: 'rect', x: 64, y: 196, w: 330, h: 92, fill: '#f0ede4', r: 6 })
  b.text(80, 220, 'Ditagihkan kepada', { size: 12, fill: MUTED })
  b.field('pembeli', { id: 'Pembeli', en: 'Buyer' }, BUYER, 80, 244, { weight: 700, size: 16 })
  b.text(80, 266, 'Ledok Kulon, Bojonegoro', { size: 13 })

  /* table */
  const tx = [64, 440, 540, 640]
  const top = 330
  b.shape({ t: 'rect', x: 64, y: top, w: W - 128, h: 34, fill: '#2f5d62' })
  ;['Barang', 'Qty', 'Harga', 'Jumlah'].forEach((h, i) => {
    const x = i === 0 ? 76 : i === 3 ? W - 76 : (tx[i] ?? 0) + 70
    b.text(x, top + 22, h, { size: 13, weight: 700, fill: '#ffffff', anchor: i === 0 ? 'start' : 'end' })
  })
  let y = top + 34
  FAKTUR_ITEMS.forEach((it, i) => {
    const n = i + 1
    const yy = y + 26
    const a = b.text(76, yy, it.name)
    b.text(510, yy, `${it.qty} ${it.unit}`, { anchor: 'end' })
    b.text(610, yy, idr(it.price), { anchor: 'end' })
    const t = b.text(W - 76, yy, idr(it.qty * it.price), { anchor: 'end' })
    b.fieldRuns(`item_${n}`, { id: `Item ${n}`, en: `Item ${n}` }, `${it.name} · ${it.qty} × ${idr(it.price)} = ${idr(it.qty * it.price)}`, [a, t])
    b.shape({ t: 'line', x1: 64, y1: y + 40, x2: W - 64, y2: y + 40, stroke: '#d8d3c4', sw: 1 })
    y += 40
  })
  y += 30
  const sumRows: [string, number, string?][] = [
    ['Subtotal', sub, 'subtotal'],
    ['Ongkos kirim', ship],
  ]
  for (const [k, v, key] of sumRows) {
    b.text(560, y, k, { fill: MUTED })
    if (key) b.field(key, { id: 'Subtotal', en: 'Subtotal' }, String(v), W - 76, y, { anchor: 'end' }, { shown: idr(v) })
    else b.text(W - 76, y, idr(v), { anchor: 'end' })
    y += 24
  }
  b.shape({ t: 'line', x1: 540, y1: y - 10, x2: W - 64, y2: y - 10, stroke: INK, sw: 1 })
  y += 14
  b.text(560, y, 'TOTAL', { weight: 700, size: 16 })
  b.field('total', { id: 'Total tagihan', en: 'Invoice total' }, String(total), W - 76, y, { anchor: 'end', weight: 700, size: 18 }, { shown: `Rp ${idr(total)}` })
  y += 60
  b.text(64, y, 'Pembayaran melalui transfer ke:', { size: 13, fill: MUTED })
  b.field('rekening', { id: 'Rekening tujuan', en: 'Pay-to account' }, `${FICTIONAL_BANK} 7781004521`, 64, y + 22, { weight: 600 }, { shown: `${FICTIONAL_BANK} (fiktif) · 7781 0045 21 · a.n. CV Karya Tirta Sentosa` })
  b.text(64, y + 52, 'Penjual bukan Pengusaha Kena Pajak: faktur ini tidak memungut PPN.', { size: 12.5, fill: MUTED, italic: true })
  b.text(W - 120, y + 110, 'Hormat kami,', { anchor: 'middle', size: 13 })
  b.shape({ t: 'signature', x: W - 190, y: y + 118, w: 140, h: 56, seed: 57 })
  b.fieldBox('ttd', { id: 'Tanda tangan', en: 'Signature' }, 'ada', { x: W - 200, y: y + 112, w: 160, h: 68 }, { hard: true })
  b.text(W - 120, y + 196, 'Bagian Penjualan', { anchor: 'middle', size: 13, weight: 600 })
  b.text(W / 2, H - 22, 'Dokumen simulasi GAMADA · perusahaan dan bank fiktif', { anchor: 'middle', size: 10, fill: '#8c88a0' })

  const meta: ReceiptMeta = {
    kind: 'faktur',
    merchant: 'CV Karya Tirta Sentosa',
    number: 'INV/KTS/2611/0457',
    date: '2026-11-14',
    items: [...FAKTUR_ITEMS, { name: 'Ongkos kirim', qty: 1, unit: 'kali', price: ship }],
    total,
    printedTotal: total,
    journal: {
      debit: 'Persediaan bahan baku',
      credit: 'Utang usaha',
      amount: total,
      memo: { id: 'Bahan pangan · jatuh tempo 28 Nov', en: 'Food supplies · due 28 Nov' },
    },
    edited: false,
  }
  return b.build({
    id: 'faktur-kts',
    kind: 'faktur',
    extractKind: 'invoice',
    title: { id: 'Faktur pemasok bahan pangan', en: 'Food-supplier invoice' },
    caption: { id: 'CV Karya Tirta Sentosa · PDF digital', en: 'CV Karya Tirta Sentosa · digital PDF' },
    bg: 'paper',
    specimen: false,
    meta,
  })
}

/* ------------------------------------------------------------------ mutasi (bank statement CSV) */

const CATS = {
  sales: 'Penjualan',
  supply: 'Pembelian bahan baku',
  utility: 'Listrik & air',
  gas: 'Bahan bakar & gas',
  salary: 'Gaji karyawan',
  fee: 'Biaya admin bank',
  interest: 'Pendapatan bunga',
  rent: 'Sewa',
  owner: 'Prive pemilik',
  unknown: 'Belum terkategori',
} as const

function makeMutasiRows(): { rows: MutasiRow[]; opening: number } {
  const rng = makeRng(hashString('mutasi|warung-tini|2026-11'))
  const opening = 8450000
  const plan: { day: number; desc: string; amt: number; cat: string; review?: { id: string; en: string } }[] = []
  // daily QRIS settlements (sales) on most days 1..16
  for (let d = 1; d <= 16; d++) {
    if (d % 7 === 0) continue
    plan.push({ day: d, desc: `SETTLEMENT QRIS ${String(d).padStart(2, '0')}/11 WARUNG MAKAN BU TINI`, amt: Math.round(rng.int(9, 17) * 50000 + rng.int(0, 19) * 2500), cat: CATS.sales })
  }
  plan.push({ day: 2, desc: 'TRF KE CV KARYA TIRTA SENTOSA INV0441', amt: -1765000, cat: CATS.supply })
  plan.push({ day: 3, desc: 'PEMBAYARAN TOKEN LISTRIK 5320xxxx', amt: -500000, cat: CATS.utility })
  plan.push({ day: 4, desc: 'TRF KE PANGKALAN ELPIJI SIDO MAKMUR', amt: -462000, cat: CATS.gas })
  plan.push({ day: 5, desc: 'TRF KE UD SAYUR SEGAR LEDOK', amt: -684000, cat: CATS.supply })
  plan.push({ day: 6, desc: 'TARIK TUNAI ATM 0193', amt: -2500000, cat: CATS.unknown, review: { id: 'Tarik tunai besar tanpa keterangan — untuk usaha atau pribadi?', en: 'Large cash withdrawal without a note — business or personal?' } })
  plan.push({ day: 8, desc: 'TRF KE CV KARYA TIRTA SENTOSA INV0449', amt: -1210000, cat: CATS.supply })
  plan.push({ day: 9, desc: 'TAGIHAN AIR PERUMDA 0412xxxx', amt: -187500, cat: CATS.utility })
  plan.push({ day: 10, desc: 'GAJI KARYAWAN NOV-1 (2 ORANG)', amt: -2400000, cat: CATS.salary })
  plan.push({ day: 10, desc: 'TRF DARI HENDRA W', amt: 3000000, cat: CATS.unknown, review: { id: 'Dana masuk perorangan — pinjaman, modal, atau penjualan katering?', en: 'Incoming personal transfer — loan, capital or catering sale?' } })
  plan.push({ day: 11, desc: 'TRF KE UD SAYUR SEGAR LEDOK', amt: -712000, cat: CATS.supply })
  plan.push({ day: 12, desc: 'TRF KE TINI RAHAYU 0812xxxx', amt: -1500000, cat: CATS.owner, review: { id: 'Transfer ke rekening pribadi pemilik — catat sebagai prive?', en: "Transfer to the owner's personal account — record as drawings?" } })
  plan.push({ day: 13, desc: 'SEWA KIOS NOV 2026', amt: -1250000, cat: CATS.rent })
  plan.push({ day: 14, desc: 'TRF KE CV KARYA TIRTA SENTOSA INV0457', amt: -1938000, cat: CATS.supply })
  plan.push({ day: 15, desc: 'TRF KE PANGKALAN ELPIJI SIDO MAKMUR', amt: -396000, cat: CATS.gas })
  plan.push({ day: 15, desc: 'BIAYA ADMINISTRASI BULANAN', amt: -12500, cat: CATS.fee })
  plan.push({ day: 16, desc: 'BUNGA TABUNGAN', amt: 9850, cat: CATS.interest })
  // pad to exactly 40 rows with small supply purchases
  let pad = 0
  while (plan.length < 40) {
    const day = 1 + ((pad * 5 + 3) % 16)
    plan.push({ day, desc: `TRF KE PEDAGANG PASAR KOTA ${String(pad + 1).padStart(2, '0')}`, amt: -rng.int(6, 18) * 25000, cat: CATS.supply })
    pad++
  }
  plan.sort((a, b) => a.day - b.day || b.amt - a.amt)
  let bal = opening
  const rows = plan.slice(0, 40).map((p) => {
    bal += p.amt
    return {
      date: `2026-11-${String(p.day).padStart(2, '0')}`,
      desc: p.desc,
      debit: p.amt < 0 ? -p.amt : 0,
      credit: p.amt > 0 ? p.amt : 0,
      balance: bal,
      category: p.cat,
      review: !!p.review,
      ...(p.review ? { reviewReason: p.review } : {}),
    } satisfies MutasiRow
  })
  return { rows, opening }
}

function toCsv(rows: MutasiRow[]): string {
  const head = 'tanggal,keterangan,debit,kredit,saldo'
  return [head, ...rows.map((r) => `${r.date},"${r.desc}",${r.debit},${r.credit},${r.balance}`)].join('\n')
}

function makeMutasi(): SampleDoc {
  const { rows, opening } = makeMutasiRows()
  const W = 900
  const rowH = 21
  const top = 250
  const H = top + 34 + rows.length * rowH + 110
  const b = new DocBuilder(W, H, { font: 'sans', size: 12.5, fill: INK })
  const closing = rows[rows.length - 1]?.balance ?? opening

  b.shape({ t: 'rect', x: 0, y: 0, w: W, h: 64, fill: '#24325f' })
  b.field('bank', { id: 'Bank', en: 'Bank' }, FICTIONAL_BANK, 40, 42, { size: 22, weight: 700, fill: '#ffffff' })
  b.text(W - 40, 40, 'bank fiktif · demo GAMADA', { size: 12, anchor: 'end', fill: '#c9d2f0' })
  b.text(40, 104, 'MUTASI REKENING', { size: 16, weight: 700, ls: 0.06 })
  const info: [string, string, string, string?][] = [
    ['No. Rekening', '7781 0039 66', 'rekening'],
    ['Nama', 'WARUNG MAKAN BU TINI', 'pemilik'],
    ['Periode', '01/11/2026 – 16/11/2026', 'periode'],
  ]
  info.forEach(([k, v, key], i) => {
    b.text(40, 136 + i * 22, k, { fill: MUTED })
    b.field(key, key === 'rekening' ? { id: 'Nomor rekening', en: 'Account number' } : key === 'pemilik' ? { id: 'Pemilik rekening', en: 'Account holder' } : { id: 'Periode', en: 'Period' }, v, 160, 136 + i * 22, { weight: 600 })
  })
  b.text(560, 136, 'Saldo awal', { fill: MUTED })
  b.field('saldo_awal', { id: 'Saldo awal', en: 'Opening balance' }, String(opening), W - 40, 136, { anchor: 'end', weight: 600, font: 'mono' }, { shown: idr(opening) })
  b.text(560, 158, 'Saldo akhir', { fill: MUTED })
  b.field('saldo_akhir', { id: 'Saldo akhir', en: 'Closing balance' }, String(closing), W - 40, 158, { anchor: 'end', weight: 600, font: 'mono' }, { shown: idr(closing) })

  b.shape({ t: 'rect', x: 32, y: top, w: W - 64, h: 30, fill: '#e3e6f0' })
  const cx = { date: 44, desc: 130, debit: 640, credit: 750, bal: W - 44 }
  b.text(cx.date, top + 20, 'Tanggal', { weight: 700 })
  b.text(cx.desc, top + 20, 'Keterangan', { weight: 700 })
  b.text(cx.debit, top + 20, 'Debit', { weight: 700, anchor: 'end' })
  b.text(cx.credit, top + 20, 'Kredit', { weight: 700, anchor: 'end' })
  b.text(cx.bal, top + 20, 'Saldo', { weight: 700, anchor: 'end' })
  rows.forEach((r, i) => {
    const y = top + 30 + i * rowH + 15
    if (i % 2) b.shape({ t: 'rect', x: 32, y: y - 15, w: W - 64, h: rowH, fill: '#f3f1ea' })
    b.text(cx.date, y, dmy(r.date).slice(0, 5))
    b.text(cx.desc, y, r.desc.length > 52 ? `${r.desc.slice(0, 51)}…` : r.desc, { size: 12 })
    if (r.debit) b.text(cx.debit, y, idr(r.debit), { anchor: 'end', font: 'mono', size: 12 })
    if (r.credit) b.text(cx.credit, y, idr(r.credit), { anchor: 'end', font: 'mono', size: 12 })
    b.text(cx.bal, y, idr(r.balance), { anchor: 'end', font: 'mono', size: 12 })
  })
  const tableBox = { x: 32, y: top, w: W - 64, h: 30 + rows.length * rowH }
  b.fieldBox('transaksi', { id: 'Jumlah transaksi', en: 'Transactions' }, String(rows.length), tableBox)
  b.text(40, H - 60, `Total ${rows.length} transaksi · format CSV: tanggal, keterangan, debit, kredit, saldo`, { size: 11.5, fill: MUTED })
  b.text(40, H - 40, 'Dokumen simulasi GAMADA · bank dan rekening fiktif', { size: 10, fill: '#8c88a0' })

  const meta: MutasiMeta = {
    kind: 'mutasi',
    bank: FICTIONAL_BANK,
    account: '7781003966',
    holder: 'WARUNG MAKAN BU TINI',
    period: '2026-11-01/2026-11-16',
    opening,
    closing,
    rows,
    csv: toCsv(rows),
  }
  return b.build({
    id: 'mutasi-arta-kencana',
    kind: 'mutasi',
    extractKind: 'document',
    title: { id: 'Mutasi rekening (CSV)', en: 'Bank statement (CSV)' },
    caption: { id: '40 transaksi · 1–16 November 2026', en: '40 transactions · 1–16 November 2026' },
    bg: 'sheet',
    specimen: false,
    meta,
  })
}

export const FINANCE: SampleDoc[] = [makeNota(false), makeNota(true), makeFaktur(), makeMutasi()]
