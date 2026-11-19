/**
 * demos/pajak-beres/scenario.ts — Tanya Pajak simulation (spec §9.2): 14 intents with ID, EN and Basa Jawa
 * examples. Every number comes from the PbContext (ctx.ts: world selectors + rules.ts), so the answer equals the
 * screens; every answer ends with "cek ke KPP/konsultan pajak". Registered by the lazy Ask drawer, not the page.
 */
import type { Intent, Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import { registerScenario } from '../../demo-kit/ai/chat'
import type { PbContext } from './ctx'
import { CEILING_WARN, LAPOR_DAY, PPH_FINAL, PPN, PTKP, SETOR_DAY, SOURCES, SPT_OP_DUE, pctText } from './rules'
import { dateText, monthName, rp, rpShort } from './model'

type Ctx = SimContext<PbContext>
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const END = { id: 'Cek ke KPP/konsultan pajak sebelum menyetor.', en: 'Check with the tax office (KPP) or a tax consultant before paying.' }
const end = (lang: Lang, text: string) => `${text}\n\n${END[lang === 'id' ? 'id' : 'en']}`
export const TAX_KINDS = ['pajak-beres/tax-breakdown', 'pajak-beres/explain_tax'] as const

const chips = (lang: Lang, ...keys: (keyof typeof CHIP)[]) => keys.map((k) => CHIP[k][lang === 'id' ? 'id' : 'en'])
const CHIP = {
  naik: { id: 'Kenapa pajak bulan ini naik?', en: 'Why did my tax go up this month?' },
  tenggat: { id: 'Kapan tenggat setor?', en: 'When is the payment deadline?' },
  pph21: { id: 'Berapa PPh 21 karyawan?', en: 'How much PPh 21 for my staff?' },
  untung: { id: 'Berapa untung bulan ini?', en: 'How much profit this month?' },
  batas: { id: 'Apa itu batas Rp 500 juta?', en: 'What is the Rp 500 million line?' },
  ppn: { id: 'Kapan saya harus jadi PKP?', en: 'When do I have to register for VAT?' },
  bank: { id: 'Laporan apa untuk pengajuan ke bank?', en: 'Which report do I need for a bank loan?' },
}

/** the breakdown card data (same shape as the Live explain_tax tool) */
export function breakdown(w: PbContext, lang: Lang) {
  const m = monthName(w.period, lang)
  const p = monthName(w.prevPeriod, lang)
  const f = w.pphFinal
  return {
    period: w.period,
    rows: [
      { label: T(lang, `Omzet ${m} s.d. ${dateText(w.today, 'id')}`, `${m} turnover up to ${dateText(w.today, 'en')}`), amount: f.omzet, rule_ref: SOURCES.pphFinal.ref },
      { label: T(lang, 'Bagian omzet yang kena pajak', 'Turnover subject to tax'), amount: f.taxable, rule_ref: SOURCES.exempt.ref },
      { label: T(lang, `PPh Final ${pctText(PPH_FINAL.rate, 'id')} ${m}`, `${m} final tax ${pctText(PPH_FINAL.rate, 'en')}`), amount: f.amount, rule_ref: PPH_FINAL.ref },
      { label: T(lang, `PPh Final ${p} (bulan penuh)`, `${p} final tax (full month)`), amount: w.pphFinalPrev.amount, rule_ref: PPH_FINAL.ref },
    ],
    total: f.amount,
    delta: f.amount - w.pphFinalPrev.amount,
  }
}

const day = (iso: string) => Number(iso.slice(8, 10))
const daysIn = (period: string) => new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate()

const I = (id: string, examples: string[], respond: (ctx: Ctx, slots: Record<string, string>) => SimResponse): Intent<PbContext> => ({ id, examples, respond })

const INTENTS: Intent<PbContext>[] = [
  I('kenapa-pajak-naik', ['kenapa pajak bulan ini naik', 'kok pajaknya naik', 'pajak naik kenapa', 'why did my tax go up', 'why is my tax higher this month', 'kenging menapa pajek mundhak', 'pajeke kok mundhak', 'rincian pajak bulan ini'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const m = monthName(w.period, L)
    const p = monthName(w.prevPeriod, L)
    const crossed = w.exemptCrossedIn ? monthName(w.exemptCrossedIn, L) : null
    const proj = Math.round((w.pphFinal.amount / Math.max(1, day(w.today))) * daysIn(w.period))
    const text = T(
      L,
      `- PPh Final ${m} sejauh ini ${rp(w.pphFinal.amount, 'id')}: ${pctText(PPH_FINAL.rate, 'id')} × omzet ${rp(w.pphFinal.omzet, 'id')}.\n- Pajak "naik" dibanding awal tahun karena batas bebas pajak ${rpShort(PPH_FINAL.exemptOmzetOP, 'id')} setahun sudah terlewati${crossed ? ` di ${crossed}` : ''}; sejak itu seluruh omzet kena ${pctText(PPH_FINAL.rate, 'id')}.\n- ${p} (bulan penuh) ${rp(w.pphFinalPrev.amount, 'id')}. ${m} belum selesai; dengan laju yang sama perkiraan sebulan penuh ≈ ${rp(proj, 'id')} (perkiraan simulasi).`,
      `- ${m} final tax so far ${rp(w.pphFinal.amount, 'en')}: ${pctText(PPH_FINAL.rate, 'en')} × turnover ${rp(w.pphFinal.omzet, 'en')}.\n- Tax "went up" compared with the start of the year because the yearly tax-free line of ${rpShort(PPH_FINAL.exemptOmzetOP, 'en')} was crossed${crossed ? ` in ${crossed}` : ''}; since then all turnover is taxed at ${pctText(PPH_FINAL.rate, 'en')}.\n- ${p} (full month) ${rp(w.pphFinalPrev.amount, 'en')}. ${m} is not over; at the same pace the full month is ≈ ${rp(proj, 'en')} (simulated estimate).`,
    )
    return { text: end(L, text), structured: { kind: 'pajak-beres/tax-breakdown', data: breakdown(w, L) }, followUps: chips(L, 'tenggat', 'pph21', 'batas') }
  }),
  I('pajak-bulan-ini', ['berapa pajak bulan ini', 'pajak saya berapa', 'how much tax this month', 'what do I owe this month', 'pajeke sasi iki pinten', 'pira pajeke wulan iki'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const m = monthName(w.period, L)
    const st = w.pphFinal.computed ? T(L, 'sudah dihitung', 'computed') : T(L, 'estimasi berjalan', 'running estimate')
    return {
      text: end(L, T(L, `${m}: PPh Final ${rp(w.pphFinal.amount, 'id')} (${st}) dan PPh 21 karyawan ${rp(w.pph21.total, 'id')}. Total ${rp(w.pphFinal.amount + w.pph21.total, 'id')}, disetor paling lambat tanggal ${SETOR_DAY} bulan berikutnya.`, `${m}: final tax ${rp(w.pphFinal.amount, 'en')} (${st}) and employee PPh 21 ${rp(w.pph21.total, 'en')}. Total ${rp(w.pphFinal.amount + w.pph21.total, 'en')}, to pay by the ${SETOR_DAY}th of next month.`)),
      followUps: chips(L, 'naik', 'tenggat'),
    }
  }),
  I('kapan-tenggat', ['kapan tenggat setor', 'kapan harus bayar pajak', 'deadline pajak', 'when is the deadline', 'when do I pay', 'kapan kudu setor pajek', 'tanggal pinten mbayar pajek'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const lines = w.deadlines.map((d) => `- ${dateText(d.date, L)}: ${d.label}${d.amount != null ? ` · ${rp(d.amount, L)}` : ''}`).join('\n')
    return { text: end(L, `${T(L, `Setor tanggal ${SETOR_DAY}, SPT Masa PPh 21 tanggal ${LAPOR_DAY}, SPT Tahunan orang pribadi ${SPT_OP_DUE.day} Maret:`, `Pay by the ${SETOR_DAY}th, PPh 21 return by the ${LAPOR_DAY}th, individual annual return by ${SPT_OP_DUE.day} March:`)}\n${lines}`), followUps: chips(L, 'pph21', 'naik') }
  }),
  I('apa-pph-final', ['apa itu pph final', 'pph final umkm itu apa', 'what is the final tax', 'what is pph final', 'pph final niku napa'], (ctx) => {
    const L = ctx.lang
    return { text: end(L, T(L, `PPh Final UMKM adalah pajak ${pctText(PPH_FINAL.rate, 'id')} dari omzet bruto per bulan, bersifat final (${PPH_FINAL.ref}). Toko ini orang pribadi, jadi boleh memakainya tanpa batas waktu selama omzet di bawah ${rpShort(PPH_FINAL.ceiling, 'id')} setahun.`, `The SME final tax is ${pctText(PPH_FINAL.rate, 'en')} of monthly gross turnover and is final (${PPH_FINAL.ref}). This shop belongs to an individual, so it may use it with no time limit while turnover stays under ${rpShort(PPH_FINAL.ceiling, 'en')} a year.`)), followUps: chips(L, 'batas', 'ppn') }
  }),
  I('batas-500-juta', ['batas 500 juta', 'apa itu batas rp 500 juta', 'omzet bebas pajak', 'tax free 500 million', 'what is the 500 million line', 'wates limangatus yuta'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const crossed = w.exemptCrossedIn ? monthName(w.exemptCrossedIn, L) : null
    return {
      text: end(L, T(L, `Orang pribadi tidak kena PPh Final atas omzet kumulatif s.d. ${rpShort(PPH_FINAL.exemptOmzetOP, 'id')} per tahun (${SOURCES.exempt.ref}). Omzet toko tahun ini ${rpShort(w.omzetYtd, 'id')}${crossed ? `; batas itu terlewati di ${crossed}` : ''}.`, `An individual pays no final tax on cumulative turnover up to ${rpShort(PPH_FINAL.exemptOmzetOP, 'en')} a year (${SOURCES.exempt.ref}). The shop's turnover this year is ${rpShort(w.omzetYtd, 'en')}${crossed ? `; the line was crossed in ${crossed}` : ''}.`)),
      followUps: chips(L, 'naik', 'ppn'),
    }
  }),
  I('perlu-ppn', ['kapan harus jadi pkp', 'batas 4,8 miliar', 'apakah saya perlu ppn', 'do I need to charge vat', 'when must I register for vat', '4.8 billion line', 'kudu dadi pkp'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const pct = Math.round((w.omzetYtd / PPH_FINAL.ceiling) * 100)
    const warn = w.omzetYtd >= PPH_FINAL.ceiling * CEILING_WARN
    return {
      text: end(L, T(L, `Batas PKP dan fasilitas ${pctText(PPH_FINAL.rate, 'id')} adalah ${rpShort(PPH_FINAL.ceiling, 'id')} setahun (${SOURCES.ceiling.ref}). Omzet tahun ini ${rpShort(w.omzetYtd, 'id')} = ${pct}% dari batas${warn ? ', sudah lewat ambang peringatan' : ''}. Toko ini belum PKP; demo tidak mensimulasikan PPN. Bila nanti PKP, PPN ${pctText(PPN.rate, 'id')} × DPP ${PPN.dppNum}/${PPN.dppDen}.`, `The VAT-registration line and the ${pctText(PPH_FINAL.rate, 'en')} facility end at ${rpShort(PPH_FINAL.ceiling, 'en')} a year (${SOURCES.ceiling.ref}). Turnover this year is ${rpShort(w.omzetYtd, 'en')} = ${pct}% of the line${warn ? ', past the warning level' : ''}. The shop is not VAT-registered; this demo does not simulate VAT. If it registers, VAT is ${pctText(PPN.rate, 'en')} × a ${PPN.dppNum}/${PPN.dppDen} base.`)),
      followUps: chips(L, 'naik', 'bank'),
    }
  }),
  I('pph21-karyawan', ['berapa pph 21 karyawan', 'pph 21 karyawan saya', 'potongan pajak gaji', 'pph21 for my staff', 'employee tax', 'pph 21 pegawai pinten'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const q = ctx.text.toLowerCase()
    const one = w.pph21.rows.find((r) => q.includes(r.name.split(' ')[0]!.toLowerCase()))
    if (one)
      return {
        text: end(L, T(L, `${one.name} (${one.ptkp}, kategori ${one.category}): bruto ${rp(one.gross, 'id')} × TER ${pctText(one.rate, 'id')} = ${rp(one.amount, 'id')} sebulan.`, `${one.name} (${one.ptkp}, category ${one.category}): gross ${rp(one.gross, 'en')} × TER ${pctText(one.rate, 'en')} = ${rp(one.amount, 'en')} a month.`)),
        followUps: chips(L, 'pph21', 'tenggat'),
      }
    const lines = w.pph21.rows.map((r) => `- ${r.name}: ${rp(r.amount, L)}`).join('\n')
    return { text: end(L, `${T(L, `PPh 21 ${w.pph21.rows.length} karyawan toko (TER, ${SOURCES.ter.ref}), total ${rp(w.pph21.total, 'id')}:`, `PPh 21 of ${w.pph21.rows.length} shop employees (TER, ${SOURCES.ter.ref}), total ${rp(w.pph21.total, 'en')}:`)}\n${lines}`), followUps: [T(L, 'Kenapa PPh 21 ada yang nol?', 'Why is some PPh 21 zero?'), ...chips(L, 'tenggat')] }
  }),
  I('kenapa-pph21-nol', ['kenapa pph 21 nol', 'kok pph21 0', 'pph 21 ada yang nol', 'why is pph21 zero', 'why do some staff pay no tax', 'kok pph21 ne nol'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const zero = w.pph21.rows.filter((r) => r.amount === 0)
    return { text: end(L, T(L, `${zero.length} karyawan bergaji di baris TER 0% kategorinya (${zero.map((r) => `${r.name} ${rp(r.gross, 'id')}`).join(', ')}), jadi potongannya Rp 0 bulan ini. Desember dihitung ulang setahun dengan PTKP (TK/0 ${rpShort(PTKP.base, 'id')}).`, `${zero.length} employees earn within the 0% TER row of their category (${zero.map((r) => `${r.name} ${rp(r.gross, 'en')}`).join(', ')}), so nothing is withheld this month. December is recalculated for the year with PTKP (TK/0 ${rpShort(PTKP.base, 'en')}).`)), followUps: chips(L, 'pph21') }
  }),
  I('untung-bulan-ini', ['berapa untung bulan ini', 'laba bulan ini', 'untung saya berapa', 'how much profit this month', 'what is my profit', 'bathine sasi iki pira', 'bati pinten'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const m = monthName(w.period, L)
    return { text: end(L, T(L, `Laba ${m} sejauh ini ${rp(w.laba.net, 'id')}: pendapatan ${rp(w.laba.revenue, 'id')} − HPP ${rp(w.laba.cogs, 'id')} − beban ${rp(w.laba.expenses, 'id')} (simulasi). ${monthName(w.prevPeriod, 'id')} sebulan penuh ${rp(w.labaPrev, 'id')}.`, `${m} profit so far ${rp(w.laba.net, 'en')}: revenue ${rp(w.laba.revenue, 'en')} − COGS ${rp(w.laba.cogs, 'en')} − expenses ${rp(w.laba.expenses, 'en')} (simulated). ${monthName(w.prevPeriod, 'en')} full month ${rp(w.labaPrev, 'en')}.`)), followUps: chips(L, 'bank', 'naik') }
  }),
  I('kategori-transaksi', ['beli bensin 150 ribu masuk akun apa', 'catat pembelian semen 2 juta', 'jurnal bayar listrik 1 juta', 'categorize a purchase of 500 thousand', 'how do I book paying electricity', 'tuku solar satus seket ewu'], (ctx) => {
    const L = ctx.lang
    const q = ctx.text.toLowerCase()
    const num = q.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta|million|m\b|rb|ribu|ewu|thousand|k\b)?/)
    const mult = num?.[2] && /^(jt|juta|million|m)$/.test(num[2]) ? 1e6 : num?.[2] ? 1e3 : 1
    const amount = num ? Math.round(Number(num[1]!.replace(',', '.')) * mult) : 150_000
    const acc = /bensin|solar|bbm|fuel|pertalite/.test(q) ? 'Beban Bahan Bakar' : /listrik|pln|air|pdam|electric/.test(q) ? 'Beban Listrik & Air' : /gaji|upah|salary|wage/.test(q) ? 'Beban Gaji' : /semen|stok|kulakan|barang|stock|besi|cat/.test(q) ? 'Persediaan' : /pribadi|prive|keluarga|personal/.test(q) ? 'Prive' : 'Beban Lain-lain'
    const desc = ctx.text.slice(0, 120)
    return {
      text: end(L, T(L, `Saran jurnal: ${acc} di debit ${rp(amount, 'id')}, Kas di kredit ${rp(amount, 'id')}. Seimbang. Simpan notanya di Kotak Dokumen.`, `Suggested entry: debit ${acc} ${rp(amount, 'en')}, credit Cash ${rp(amount, 'en')}. Balanced. Keep the receipt in the document box.`)),
      structured: { kind: 'ledger', data: { entries: [{ description: desc, account: acc, debit: amount, credit: 0 }, { description: desc, account: 'Kas', debit: 0, credit: amount }] } },
      followUps: [T(L, 'Prive atau beban?', 'Drawings or expense?'), ...chips(L, 'untung')],
    }
  }),
  I('prive-vs-beban', ['prive atau beban', 'ambil uang pribadi dicatat apa', 'beda prive dan beban', 'drawings or expense', 'owner takes money out', 'njupuk duwit kanggo pribadi'], (ctx) => {
    const L = ctx.lang
    return { text: end(L, T(L, 'Uang toko yang dipakai untuk keperluan pribadi dicatat sebagai Prive (mengurangi modal), bukan beban, sehingga tidak mengurangi laba. Di mutasi November ada dua baris "tarik/transfer pribadi" yang dijurnal sebagai Prive.', 'Shop money used for personal needs is booked as drawings (Prive, reduces equity), not an expense, so it does not lower profit. The November statement has two "personal withdrawal/transfer" rows booked as drawings.')), followUps: chips(L, 'untung') }
  }),
  I('cara-setor', ['cara setor pajak', 'bagaimana cara bayar pajak', 'kode billing', 'how do I pay the tax', 'how to get a billing code', 'carane mbayar pajek'], (ctx) => {
    const L = ctx.lang
    return { text: end(L, T(L, `Kode billing dibuat di Coretax DJP (tidak disimulasikan di demo ini), lalu dibayar di bank/kantor pos/kanal pembayaran sebelum tanggal ${SETOR_DAY}. Pajak Beres menyiapkan angka dan file ekspornya di tab Ekspor.`, `The billing code is created in DJP Coretax (not simulated in this demo) and paid at a bank, post office or payment channel before the ${SETOR_DAY}th. Pajak Beres prepares the amounts and export files in the Export tab.`)), followUps: chips(L, 'tenggat') }
  }),
  I('laporan-untuk-bank', ['laporan untuk bank', 'laporan untuk pinjaman', 'syarat kredit usaha', 'report for a bank loan', 'which report does the bank need', 'laporan kanggo utang bank'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    return { text: end(L, T(L, `Bank biasanya meminta laba rugi, neraca, dan arus kas 3 bulan terakhir. Tombol "Laporan bulanan" di tab Laporan menyusun ketiganya plus ringkasan pajak dalam satu halaman (laba ${monthName(w.period, 'id')} sejauh ini ${rp(w.laba.net, 'id')}). Status pajak rapi juga dibaca Rapor Usaha.`, `Banks usually ask for the profit and loss, balance sheet and cash flow of the last 3 months. The "Monthly report" button in the Reports tab puts all three plus a tax summary on one page (${monthName(w.period, 'en')} profit so far ${rp(w.laba.net, 'en')}). A tidy tax status is also read by Rapor Usaha.`)), followUps: chips(L, 'untung') }
  }),
]

const scenario: Scenario<PbContext> = {
  product: 'pajak-beres',
  intents: INTENTS,
  fallback: (ctx) => ({
    text: end(ctx.lang, T(ctx.lang, 'Pertanyaan ini di luar data pembukuan dan pajak toko di demo ini. Untuk kasus khusus, tanyakan ke konsultan pajak: tombol di bawah membuka Pajak Beres sebagai Konsultan Pajak.', 'This question is outside the shop books and tax data of this demo. For a special case, ask a tax consultant: the button below opens Pajak Beres as the Tax Consultant.')),
    followUps: chips(ctx.lang, 'naik', 'tenggat', 'untung'),
  }),
}

registerScenario(scenario)
export const SUGGEST = (lang: Lang) => chips(lang, 'naik', 'tenggat', 'pph21', 'untung')
