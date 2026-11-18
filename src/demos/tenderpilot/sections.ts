/**
 * sections.ts (lazy: Composer, Preview, scenario) — the 7 bid-document sections. "Sebelum" = the profile template
 * with [perlu dilengkapi] for everything the tender decides; "Sesudah AI" = the filled text from the world (profile,
 * tender items, the ONE bid total + terbilang, won contracts, stock). Every section has its own wording (no sentence
 * is shared between sections) and names entity fields (code, item, amount, date).
 */
import { terbilang } from '../../demo-kit/i18n/terbilang'
import type { Bi, WorldState } from '../../demo-kit/world'
import { bidHistory, shopStockFor, vendorProfile } from '../../demo-kit/world/usaha-pintar'
import type { SectionId } from './draft'
import { bidLines, bidTotal, dateText, deadlineText, rp, type BidLine, type Lang } from './model'

export const SECTION_TITLE: Record<SectionId, Bi> = {
  surat: { id: 'Surat Penawaran', en: 'Bid Letter' },
  harga: { id: 'Daftar Kuantitas & Harga', en: 'Bill of Quantities & Prices' },
  spek: { id: 'Spesifikasi Teknis & Contoh Barang', en: 'Technical Specification & Samples' },
  jadwal: { id: 'Jadwal & Metode Pengiriman', en: 'Delivery Schedule & Method' },
  pengalaman: { id: 'Pengalaman Pekerjaan Sejenis', en: 'Similar Work Experience' },
  pakta: { id: 'Pakta Integritas & Pernyataan', en: 'Integrity Pact & Declarations' },
  lampiran: { id: 'Lampiran legal NIB/NPWP/KTP pemilik/sertifikat KYB', en: 'Legal annex: NIB/NPWP/owner ID/KYB certificate' },
}

export interface DocCtx {
  biz: string
  city: string
  owner: string
  nib: string
  npwp: string
  address: string
  kbli: string
  staff: number
  years: number
  kyb: string | null
  code: string
  title: Bi
  opd: string
  kec: string
  deadline: Record<Lang, string>
  today: Record<Lang, string>
  lines: BidLine[]
  total: number
  wins: { code: string; title: Bi; price: number; date: Record<Lang, string> }[]
  stock: { name: Bi; onHand: number; need: number; unit: string }[]
  spec: Bi | null
}

/** everything the sections need, from the world + the draft's price (one total) */
export function docCtx(s: WorldState, tenderId: string, target: number, units: Readonly<Record<number, number>>): DocCtx | null {
  const t = s.tenders.byId[tenderId]
  const prof = vendorProfile(s, s.meta.shopId)
  if (!t || !prof) return null
  const lines = bidLines(t, target, units)
  const hist = bidHistory(s, prof.businessId)
  return {
    biz: prof.name, city: s.region.shortName, owner: prof.owner, nib: prof.nib, npwp: prof.npwp, address: prof.address, kbli: prof.kbli.map((k) => k.code).join(', '), staff: prof.staffCount, years: prof.years,
    kyb: prof.kyb ? dateText(s.day, prof.kyb.at, 'id') : null, code: t.code, title: t.title,
    opd: s.region.opd.find((o) => o.id === t.opdId)?.name ?? t.opdId, kec: s.region.kecamatan.find((k) => k.id === t.kecamatanId)?.name ?? t.kecamatanId,
    deadline: { id: deadlineText(s.day, t.deadlineAt, 'id'), en: deadlineText(s.day, t.deadlineAt, 'en') },
    today: { id: dateText(s.day, 0, 'id'), en: dateText(s.day, 0, 'en') },
    lines, total: bidTotal(lines),
    wins: hist.rows.filter((b) => b.status === 'menang' && b.tender).slice(0, 4).map((b) => ({ code: b.tender!.code, title: b.tender!.title, price: b.price, date: { id: dateText(s.day, b.at, 'id'), en: dateText(s.day, b.at, 'en') } })),
    stock: (t.items ?? []).map((it) => ({ name: it.name, onHand: shopStockFor(s, it.category).onHand, need: it.qty, unit: it.unit })),
    spec: t.spec ?? null,
  }
}

const P = { id: '[perlu dilengkapi]', en: '[to be completed]' }
const n = (v: number, lang: Lang) => v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')

/** the section text; ai = false gives the profile template ("Sebelum") */
export function sectionText(id: SectionId, c: DocCtx, lang: Lang, ai: boolean): string {
  const L = lang === 'id'
  const p = P[lang]
  const title = ai ? c.title[lang] : p
  switch (id) {
    case 'surat':
      return L
        ? `Nomor: ${ai ? `SP/${c.code}/XI/2026` : p}\nKepada Yth. Pejabat Pengadaan ${ai ? c.opd : p}\nPerihal: Penawaran ${title}\n\nDengan hormat, ${c.biz} (KBLI ${c.kbli}) yang beralamat di ${c.address} mengajukan penawaran untuk paket ${title} dengan nilai ${ai ? rp(c.total) : p} (${ai ? `${terbilang(c.total, 'id')} rupiah` : p}), sudah termasuk ongkos kirim ke lokasi.\nPenawaran ini berlaku 30 hari kalender sejak batas akhir pemasukan ${ai ? c.deadline.id : p}.\n\n${c.city}, ${c.today.id}\n${c.owner}, pemilik`
        : `No.: ${ai ? `SP/${c.code}/XI/2026` : p}\nTo: the Procurement Officer, ${ai ? c.opd : p}\nRe: Bid for ${title}\n\nDear Sir or Madam, ${c.biz} (KBLI ${c.kbli}), of ${c.address}, submits a bid for the package ${title} at ${ai ? rp(c.total) : p} (${ai ? `${terbilang(c.total, 'en')} rupiah` : p}), delivery to site included.\nThis bid is valid for 30 calendar days after the submission deadline of ${ai ? c.deadline.en : p}.\n\n${c.city}, ${c.today.en}\n${c.owner}, owner`
    case 'harga': {
      const rows = c.lines.map((l, i) => `${i + 1}. ${l.name[lang]} · ${n(l.qty, lang)} ${l.unit} × ${ai ? rp(l.price) : p} = ${ai ? rp(l.total) : p}`).join('\n')
      return L
        ? `Rincian kuantitas dan harga satuan paket ${ai ? c.code : p}:\n${rows}\nJumlah total: ${ai ? rp(c.total) : p}\nTerbilang: ${ai ? `${terbilang(c.total, 'id')} rupiah` : p}\nHarga satuan tetap selama masa kontrak; usaha perorangan non-PKP, tanpa PPN.`
        : `Quantities and unit prices for package ${ai ? c.code : p}:\n${rows}\nGrand total: ${ai ? rp(c.total) : p}\nIn words: ${ai ? `${terbilang(c.total, 'en')} rupiah` : p}\nUnit prices are fixed for the contract term; a non-VAT-registered sole proprietor, no VAT charged.`
    }
    case 'spek': {
      const items = c.lines.map((l) => `- ${l.name[lang]}: ${ai ? (L ? `sesuai spesifikasi panitia, contoh fisik 1 ${l.unit} tersedia di toko untuk diperiksa` : `as specified by the committee, one physical sample per ${l.unit} available at the shop for inspection`) : p}`).join('\n')
      return L
        ? `Spesifikasi yang ditawarkan untuk ${title}:\n${items}\nAcuan panitia: ${ai && c.spec ? c.spec.id : p}\nFoto contoh barang dan lembar data pabrik terlampir pada halaman 3–6 bagian ini.`
        : `Specification offered for ${title}:\n${items}\nCommittee reference: ${ai && c.spec ? c.spec.en : p}\nSample photos and manufacturer data sheets are on pages 3–6 of this section.`
    }
    case 'jadwal': {
      const st = c.stock.map((x) => `${x.name[lang]}: ${ai ? `${n(Math.min(x.onHand, x.need), lang)} ${x.unit} ${L ? 'dari stok gudang' : 'from warehouse stock'}${x.onHand < x.need ? (L ? `, sisa ${n(x.need - x.onHand, lang)} ${x.unit} lewat PO pemasok` : `, the remaining ${n(x.need - x.onHand, lang)} ${x.unit} through a supplier PO`) : ''}` : p}`).join('\n')
      return L
        ? `Pengiriman ke posko Kec. ${ai ? c.kec : p} dalam ${ai ? '2 hari kalender' : p} sejak surat pesanan, memakai armada sendiri (pikap 1,5 ton).\n${st}\nSerah terima bertahap dengan berita acara per pengiriman; jadwal muat pukul 06.00–09.00.`
        : `Delivery to the ${ai ? c.kec : p} district post within ${ai ? '2 calendar days' : p} of the purchase order, by our own fleet (1.5-tonne pickup).\n${st}\nPhased handover with a report for each delivery; loading 06:00–09:00.`
    }
    case 'pengalaman': {
      const w = c.wins.map((x, i) => `${i + 1}. ${x.code} ${x.title[lang]} · ${rp(x.price)} · ${x.date[lang]}`).join('\n')
      return L
        ? `${c.biz} berdiri ${c.years} tahun dengan ${c.staff} karyawan. Pekerjaan sejenis yang diselesaikan:\n${ai ? w || '-' : p}\nReferensi kontrak dan berita acara serah terima terlampir.`
        : `${c.biz} has operated for ${c.years} years with ${c.staff} employees. Similar contracts completed:\n${ai ? w || '-' : p}\nContract references and handover reports are attached.`
    }
    case 'pakta':
      return L
        ? `Saya, ${c.owner}, pemilik ${c.biz}, menyatakan untuk paket ${ai ? c.code : p}:\n1. tidak melakukan persekongkolan dengan peserta lain;\n2. tidak memberi atau menerima imbalan kepada pejabat pengadaan;\n3. bersedia diperiksa bila ada pengaduan.\nDitandatangani secara elektronik (simulasi) pada ${ai ? c.today.id : p}.`
        : `I, ${c.owner}, owner of ${c.biz}, declare for package ${ai ? c.code : p}:\n1. no collusion with other bidders;\n2. no gifts given to or taken from procurement officials;\n3. willingness to be examined if a complaint is filed.\nSigned electronically (simulated) on ${ai ? c.today.en : p}.`
    case 'lampiran':
      return L
        ? `Daftar lampiran legal:\n1. NIB ${c.nib} (SPESIMEN), KBLI ${c.kbli}\n2. NPWP ${c.npwp}\n3. KTP pemilik a.n. ${c.owner} (spesimen, NIK tersamar)\n4. Sertifikat verifikasi usaha Kenal Mitra ${ai ? (c.kyb ? `tanggal ${c.kyb}` : 'menyusul') : p}\n5. Foto gudang dan armada, ${ai ? `${c.stock.length} jenis barang siap kirim` : p}`
        : `Legal annex list:\n1. NIB ${c.nib} (SPECIMEN), KBLI ${c.kbli}\n2. Tax ID ${c.npwp}\n3. Owner ID card of ${c.owner} (specimen, masked NIK)\n4. Kenal Mitra business verification certificate ${ai ? (c.kyb ? `dated ${c.kyb}` : 'to follow') : p}\n5. Warehouse and fleet photos, ${ai ? `${c.stock.length} item types ready to ship` : p}`
  }
}
