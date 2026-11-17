/**
 * demos/awas-belanja/scenario.ts — AI simulation scenario (spec §9.2): 15 intents with ID, EN and Basa Jawa
 * examples; every answer reads the AbContext of the open package (model.ts aiContext), so numbers equal the
 * tables on screen. Registered when the chat surface (Assistant / MemoTab) loads, not with the page.
 */
import type { Intent, Lang, Scenario, SimContext, SimResponse, Structured } from '../../demo-kit/ai/types'
import { registerScenario } from '../../demo-kit/ai/chat'
import type { Bi } from '../../demo-kit/world'
import { DETECTOR_BY_ID, noteText, pct, rpFull, rpShort, type AbContext, type Detector, type Level } from './model'
import { STRINGS } from './strings'

type Ctx = SimContext<AbContext>
const L = (lang: Lang, b: Bi) => b[lang]
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)

const JAWA = /\b(piye|kepiye|niki|iki|sing|opo|napa|pinten|piro|regane|larang|sapa|sopo|wae|mawon|kudu|nopo|paket\s+niki|pundi|endi|ngendi|kok|wis|sampun|dereng|durung|ana|wonten|mboten|ora)\b/gi
const looksJawa = (s: string) => (s.match(JAWA) ?? []).length >= 2

const noPkg = (ctx: Ctx): SimResponse => ({
  text: T(
    ctx.lang,
    'Pertanyaan ini tentang satu paket, dan belum ada paket yang dibuka. Buka satu paket dari daftar (misalnya paket pompa darurat), lalu tanyakan lagi: saya akan menjawab dengan angka paket itu. Pertanyaan tentang seluruh paket bisa langsung dijawab.',
    'This question is about one package, and none is open yet. Open a package from the list (the emergency pump package, for example) and ask again: I will answer with that package’s numbers. Questions about all packages can be answered right away.',
  ),
  followUps: chips(ctx.lang, 'top', 'gap', 'due'),
})

const FLAG_DET: Record<Detector, string> = {
  'hps-kemahalan': 'harga', 'harga-seragam': 'harga', afiliasi: 'afiliasi', 'spesifikasi-merek': 'spesifikasi', 'jadwal-singkat': 'jadwal', 'pemenang-berulang': 'pemenang-berulang', 'pemecahan-paket': 'lainnya',
}
const SEV: Record<Level, string> = { lolos: 'rendah', waspada: 'sedang', tinggi: 'tinggi' }

/** structured 'risk' (same shape as the Live tool assess_procurement) */
function riskStructured(w: AbContext, lang: Lang): Structured | undefined {
  if (!w.analisis) return undefined
  return {
    kind: 'risk',
    data: {
      riskScore: w.analisis.skor,
      flags: w.analisis.temuan.filter((f) => f.tingkat !== 'lolos').map((f) => ({ detector: FLAG_DET[f.detektor], severity: SEV[f.tingkat], note: noteText(f.catatan, lang) })),
      recommendation: correctionLine(w, lang),
    },
  }
}

function correctionLine(w: AbContext, lang: Lang): string {
  const h = w.hpsVsPasar
  if (!h) return ''
  return T(
    lang,
    `Koreksi HPS ke ${rpFull(h.pasar, 'id')} (median pasar), klarifikasi peserta yang terhubung, dan undang UMKM lokal lewat Katalog Lokal sebelum penetapan pemenang.`,
    `Correct the HPS to ${rpFull(h.pasar, 'en')} (market median), clarify the linked bidders, and invite local SMEs through Katalog Lokal before a winner is named.`,
  )
}

const ringNames = (w: AbContext) => [...new Set(w.afiliasi.flatMap((e) => [e.a, e.b]))]

/** the memo summary (also the recommendation note): numbers from the same table as the HPS tab */
export function memoSummary(w: AbContext, lang: Lang): string {
  const p = w.paket
  const h = w.hpsVsPasar
  if (!p || !h) return ''
  const ring = ringNames(w)
  const spec = w.analisis?.temuan.some((f) => f.detektor === 'spesifikasi-merek' && f.tingkat !== 'lolos')
  const sched = w.analisis?.temuan.find((f) => f.detektor === 'jadwal-singkat' && f.tingkat !== 'lolos')
  const score = w.analisis?.skor
  if (lang === 'id')
    return [
      `Paket ${p.nama.id} (${p.kode}) dengan HPS ${rpFull(h.hps, 'id')}${score != null ? ` mendapat skor risiko ${score} dari 100` : ''}.`,
      h.selisih > 0 ? `HPS ${pct(h.deviasiPct, 'id')} di atas median harga pasar, dengan selisih ${rpFull(h.selisih, 'id')}.` : 'HPS sejalan dengan median harga pasar.',
      ring.length ? `${ring.length} dari ${p.jumlahPeserta} peserta terhubung lewat alamat, direktur, atau IP pendaftaran yang sama.` : '',
      spec ? 'Spesifikasi teknis menyebut satu merek tanpa "atau setara".' : '',
      sched ? `Jadwal penawaran ${p.jadwalHari ?? '?'} hari perlu justifikasi tertulis.` : '',
      `Kami merekomendasikan koreksi HPS menjadi ${rpFull(h.pasar, 'id')} dan mengundang UMKM lokal lewat Katalog Lokal sebelum pemenang ditetapkan.`,
    ].filter(Boolean).join(' ')
  return [
    `Package ${p.nama.en} (${p.kode}), HPS ${rpFull(h.hps, 'en')}${score != null ? `, scores ${score} out of 100 for risk` : ''}.`,
    h.selisih > 0 ? `The HPS is ${pct(h.deviasiPct, 'en')} above the market median, a difference of ${rpFull(h.selisih, 'en')}.` : 'The HPS is in line with the market median.',
    ring.length ? `${ring.length} of the ${p.jumlahPeserta} bidders are linked by a shared address, director or registration IP.` : '',
    spec ? 'The technical spec names one brand without "or equivalent".' : '',
    sched ? `The ${p.jadwalHari ?? '?'}-day bidding window needs a written justification.` : '',
    `We recommend correcting the HPS to ${rpFull(h.pasar, 'en')} and inviting local SMEs through Katalog Lokal before a winner is named.`,
  ].filter(Boolean).join(' ')
}

const chips = (lang: Lang, ...ids: string[]): string[] => ids.map((i) => (lang === 'id' ? CHIP[i]![0] : CHIP[i]![1]))
const CHIP: Record<string, [string, string]> = {
  hps: ['Kenapa HPS dianggap kemahalan?', 'Why is the HPS overpriced?'],
  ring: ['Siapa peserta yang terafiliasi?', 'Which bidders are linked?'],
  fix: ['Berapa HPS yang wajar?', 'What should the HPS be?'],
  memo: ['Susun memo audit', 'Draft the audit memo'],
  local: ['Ada UMKM lokal yang bisa memasok?', 'Can local SMEs supply this?'],
  next: ['Apa langkah selanjutnya?', 'What should I do next?'],
  top: ['Paket mana yang paling berisiko?', 'Which package is the riskiest?'],
  sum: ['Ringkas risiko paket ini', "Summarise this package's risk"],
  how: ['Bagaimana cara kerja detektornya?', 'How do the detectors work?'],
  gap: ['Berapa total selisih HPS?', 'What is the total HPS gap?'],
  due: ['Tenggat paket mana yang paling dekat?', 'Which package deadline is closest?'],
}

/** answer for one detector: its finding when analysed, else what it checks */
function detectorAnswer(d: Detector, extra?: (w: AbContext, lang: Lang) => string) {
  return (ctx: Ctx): SimResponse => {
    const w = ctx.world
    if (!w?.paket) return noPkg(ctx)
    const meta = DETECTOR_BY_ID[d]
    const f = w.analisis?.temuan.find((x) => x.detektor === d)
    const lvl = f ? STRINGS[ctx.lang].levels[f.tingkat] : null
    const head = f
      ? T(ctx.lang, `Detektor "${meta.name.id}": **${lvl}**. ${f.catatan.id}.`, `Detector "${meta.name.en}": **${lvl}**. ${noteText(f.catatan, 'en')}.`)
      : T(ctx.lang, `Paket ini belum dianalisis. Detektor "${meta.name.id}": ${meta.checks.id}`, `This package has not been analysed yet. The "${meta.name.en}" detector: ${meta.checks.en}`)
    const more = extra ? ` ${extra(w, ctx.lang)}` : ''
    return {
      text: head + more,
      toolCalls: [{ name: 'run_detector', input: { paket: w.paket.kode, detektor: d }, output: f ? { tingkat: f.tingkat } : { status: 'belum dianalisis' } }],
      followUps: chips(ctx.lang, 'fix', 'memo', 'next'),
    }
  }
}

const INTENTS: Intent<AbContext>[] = [
  {
    id: 'ringkasan',
    examples: [
      'Ringkas risiko paket ini', 'Apa temuan utama paket ini?', 'Seberapa berisiko paket ini', 'Kenapa skor risikonya tinggi?', 'Berapa nilai paket ini?',
      "Summarise this package's risk", 'What are the key findings?', 'How risky is this package', 'Why is the risk score high?', 'How much is this package worth?',
      'Piye risikone paket iki?', 'Paket niki wonten masalah napa?', 'Kok skore dhuwur?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket || !w.hpsVsPasar) return noPkg(ctx)
      const h = w.hpsVsPasar
      const ring = ringNames(w)
      const jw = looksJawa(ctx.text)
      if (!w.analisis) {
        const text = T(
          ctx.lang,
          `${w.paket.nama.id} belum dianalisis lengkap. Pratinjau: HPS ${pct(h.deviasiPct, 'id')} di atas median pasar (selisih ${rpShort(h.selisih, 'id')}), ${w.paket.jumlahPeserta} peserta${ring.length ? `, ${ring.length} di antaranya terhubung` : ''}. Tekan "Jalankan analisis" untuk memindai 7 detektor.`,
          `${w.paket.nama.en} has not been fully analysed. Preview: HPS ${pct(h.deviasiPct, 'en')} above the market median (gap ${rpShort(h.selisih, 'en')}), ${w.paket.jumlahPeserta} bidders${ring.length ? `, ${ring.length} of them linked` : ''}. Press "Run analysis" to scan the 7 detectors.`,
        )
        return { text, followUps: chips(ctx.lang, 'hps', 'ring', 'how') }
      }
      const top = w.analisis.temuan.filter((f) => f.tingkat !== 'lolos').slice(0, 3)
      const body = top.map((f) => `- ${L(ctx.lang, DETECTOR_BY_ID[f.detektor].name)}: ${noteText(f.catatan, ctx.lang)}`).join('\n')
      const text = jw
        ? `Paket menika angsal skor risiko ${w.analisis.skor}. Temuan ingkang paling wigati:\n${top.map((f) => `- ${f.catatan.id}`).join('\n')}`
        : T(ctx.lang, `Skor risiko **${w.analisis.skor}**/100 untuk ${w.paket.nama.id}. Temuan utama:\n${body}`, `Risk score **${w.analisis.skor}**/100 for ${w.paket.nama.en}. Key findings:\n${body}`)
      return {
        text,
        translation: jw ? `Terjemahan: Paket ini mendapat skor risiko ${w.analisis.skor}. Temuan terpenting tercantum di atas.` : undefined,
        structured: riskStructured(w, ctx.lang),
        toolCalls: [
          { name: 'hps_vs_pasar', input: { paket: w.paket.kode }, output: { deviasiPct: h.deviasiPct } },
          { name: 'graf_peserta', input: { paket: w.paket.kode }, output: { terhubung: ring.length } },
        ],
        followUps: chips(ctx.lang, 'fix', 'memo', 'next'),
      }
    },
  },
  {
    id: 'hps',
    examples: [
      'Kenapa HPS dianggap kemahalan?', 'HPS kemahalan berapa persen', 'Item mana yang paling mahal dibanding pasar', 'Kenapa mahal sekali?', 'Apakah harganya wajar?', 'Harganya kemahalan atau tidak?',
      'Why is the HPS overpriced?', 'Which item is most above market', 'How far is the HPS above market price', 'Why is it so expensive?', 'Is this price fair?', 'Is it overpriced?',
      'Regane kok larang banget?', 'HPS-e kemahalen pira?', 'Opo iki regane kemahalen?', 'Regane kemahalen ora?', 'Kok larang temen?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket || !w.hpsVsPasar) return noPkg(ctx)
      const h = w.hpsVsPasar
      const sorted = [...h.items].sort((a, b) => b.deviasiPct - a.deviasiPct)
      const lines = sorted.slice(0, 3).map((i) => `- ${L(ctx.lang, i.nama)}: ${rpFull(i.hps, ctx.lang)} vs ${rpFull(i.pasar, ctx.lang)} (${pct(i.deviasiPct, ctx.lang, true)})`).join('\n')
      return {
        text: T(
          ctx.lang,
          `HPS total ${rpFull(h.hps, 'id')}, median pasar ${rpFull(h.pasar, 'id')}: **${pct(h.deviasiPct, 'id')} lebih tinggi**, selisih ${rpFull(h.selisih, 'id')}. Deviasi terbesar:\n${lines}`,
          `Total HPS ${rpFull(h.hps, 'en')}, market median ${rpFull(h.pasar, 'en')}: **${pct(h.deviasiPct, 'en')} higher**, a gap of ${rpFull(h.selisih, 'en')}. Largest deviations:\n${lines}`,
        ),
        toolCalls: [{ name: 'hps_vs_pasar', input: { paket: w.paket.kode }, output: { item: h.items.length, deviasiPct: h.deviasiPct } }],
        followUps: chips(ctx.lang, 'fix', 'local', 'memo'),
      }
    },
  },
  {
    id: 'afiliasi',
    examples: ['Siapa peserta yang terafiliasi?', 'Peserta mana yang saling terhubung', 'Apakah ada peserta satu pemilik', 'Which bidders are linked?', 'Are any bidders affiliated', 'Do bidders share a director', 'Sing padha alamate sapa wae?', 'Peserta sing sedulur sapa?'],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket) return noPkg(ctx)
      if (!w.afiliasi.length) return { text: T(ctx.lang, 'Tidak ada keterkaitan antarpeserta pada paket ini: alamat, direktur, dan IP pendaftaran semuanya berbeda.', 'No links between the bidders of this package: addresses, directors and registration IPs all differ.'), followUps: chips(ctx.lang, 'hps', 'next') }
      const ring = ringNames(w)
      const ev = w.afiliasi.slice(0, 3).map((e) => `- ${e.a} ↔ ${e.b}: ${e.bukti.map((b) => L(ctx.lang, b)).join('; ')}`).join('\n')
      return {
        text: T(ctx.lang, `${ring.length} dari ${w.paket.jumlahPeserta} peserta terhubung (${ring.join(', ')}). Bukti:\n${ev}\nIni indikasi yang perlu diklarifikasi, bukan kesimpulan.`, `${ring.length} of the ${w.paket.jumlahPeserta} bidders are linked (${ring.join(', ')}). Evidence:\n${ev}\nThis is an indication to clarify, not a conclusion.`),
        toolCalls: [{ name: 'graf_peserta', input: { paket: w.paket.kode }, output: { terhubung: ring.length, garis: w.afiliasi.length } }],
        followUps: chips(ctx.lang, 'memo', 'next', 'hps'),
      }
    },
  },
  {
    id: 'harga-seragam',
    examples: ['Apakah penawarannya seragam?', 'Harga penawaran kok mirip semua', 'Are the bids suspiciously close?', 'Are bid prices uniform', 'Penawarane kok padha kabeh?'],
    respond: detectorAnswer('harga-seragam', (w, lang) => {
      const bids = w.peserta.filter((p) => p.penawaran != null).map((p) => `${p.nama} ${rpShort(p.penawaran!, lang)}`)
      return bids.length ? T(lang, `Penawaran: ${bids.join(', ')}.`, `Bids: ${bids.join(', ')}.`) : ''
    }),
  },
  {
    id: 'pemenang-berulang',
    examples: ['Siapa yang sering menang?', 'Siapa pemenangnya?', 'Apakah pemenangnya itu-itu saja', 'Who keeps winning?', 'Who won?', 'Who is the winner', 'Is there a repeat winner', 'Sing menang kok iku-iku wae?', 'Sapa sing menang?'],
    respond: detectorAnswer('pemenang-berulang'),
  },
  {
    id: 'pemecahan-paket',
    examples: ['Ada indikasi pemecahan paket?', 'Apakah paket ini dipecah', 'Is the package split?', 'Any package splitting under the threshold', 'Pakete dipecah apa ora?'],
    respond: detectorAnswer('pemecahan-paket'),
  },
  {
    id: 'jadwal-singkat',
    examples: ['Jadwalnya terlalu singkat?', 'Berapa hari masa penawaran', 'Is the schedule too short?', 'How long is the bidding window', 'Jadwale kesuwen apa kecepeten?'],
    respond: detectorAnswer('jadwal-singkat', (w, lang) => (w.paket?.jadwalHari != null ? T(lang, `Masa penawaran tercatat ${w.paket.jadwalHari} hari${w.paket.darurat ? ' (status darurat)' : ''}.`, `The recorded bidding window is ${w.paket.jadwalHari} days${w.paket.darurat ? ' (emergency status)' : ''}.`) : '')),
  },
  {
    id: 'spesifikasi-merek',
    examples: ['Apakah spesifikasinya mengunci merek?', 'Spesifikasi menyebut merek tertentu', 'Does the spec lock a brand?', 'Is the specification brand-specific', 'Spesifikasine ngunci merek?'],
    respond: detectorAnswer('spesifikasi-merek', (w, lang) => (w.paket?.spesifikasi ? T(lang, `Teks spesifikasi: "${w.paket.spesifikasi}"`, `Spec text (ID): "${w.paket.spesifikasi}"`) : '')),
  },
  {
    id: 'koreksi',
    examples: [
      'Berapa HPS yang wajar?', 'HPS seharusnya berapa', 'Koreksi HPS jadi berapa', 'Apa itu HPS?', 'What should the HPS be?', 'What is a fair HPS', 'Corrected owner estimate', 'What is HPS?',
      'Pira rega sing pantes?', 'Regane sing bener pinten?', 'HPS e kudune piro?', 'Kudune regane piro?', 'HPS-e sing wajar pinten?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket || !w.hpsVsPasar) return noPkg(ctx)
      const h = w.hpsVsPasar
      return {
        text: T(
          ctx.lang,
          `HPS yang wajar mengikuti median pasar: **${rpFull(h.pasar, 'id')}** (dari ${rpFull(h.hps, 'id')}). Potensi penghematan ${rpFull(h.selisih, 'id')} atau ${pct(h.deviasiPct, 'id')}.${w.rekomendasi ? ' Koreksi ini sudah tercatat di rekomendasi.' : ' Tekan "Rekomendasikan" agar koreksi tercatat dan memo tersusun.'}`,
          `A fair HPS follows the market median: **${rpFull(h.pasar, 'en')}** (from ${rpFull(h.hps, 'en')}). Potential savings ${rpFull(h.selisih, 'en')} or ${pct(h.deviasiPct, 'en')}.${w.rekomendasi ? ' This correction is already recorded in the recommendation.' : ' Press "Recommend" to record the correction and draft the memo.'}`,
        ),
        toolCalls: [{ name: 'koreksi_hps', input: { paket: w.paket.kode }, output: { hpsKoreksi: h.pasar } }],
        followUps: chips(ctx.lang, 'memo', 'local'),
      }
    },
  },
  {
    id: 'umkm',
    examples: ['Ada UMKM lokal yang bisa memasok?', 'Bandingkan dengan harga UMKM lokal', 'Katalog Lokal punya pemasok?', 'Can local SMEs supply this?', 'Local suppliers in Katalog Lokal', 'Ana UMKM lokal sing iso nyedhiyani?'],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket) return noPkg(ctx)
      if (!w.umkmLokal.length) return { text: T(ctx.lang, 'Belum ada UMKM lokal terverifikasi untuk kategori barang paket ini.', 'No verified local SME for the item categories of this package yet.'), followUps: chips(ctx.lang, 'fix', 'memo') }
      const lines = w.umkmLokal.slice(0, 3).map((x) => `- ${L(ctx.lang, x.item)}: ${x.umkm.map((u) => `${u.nama} (${u.kecamatan}) ${rpShort(u.harga, ctx.lang)}`).join(', ')}`).join('\n')
      return {
        text: T(ctx.lang, `UMKM lokal terverifikasi yang bisa memasok (harga penawaran simulasi):\n${lines}\nRekomendasi akan mengirim kebutuhan ini ke Katalog Lokal.`, `Verified local SMEs that can supply (simulated offer prices):\n${lines}\nThe recommendation sends this need to Katalog Lokal.`),
        toolCalls: [{ name: 'katalog_lokal', input: { paket: w.paket.kode }, output: { umkm: w.umkmLokal.reduce((a, x) => a + x.umkm.length, 0) } }],
        followUps: chips(ctx.lang, 'memo', 'fix'),
      }
    },
  },
  {
    id: 'memo',
    examples: ['Susun memo audit', 'Buatkan rekomendasi untuk paket ini', 'Tulis nota dinas reviu HPS', 'Draft the audit memo', 'Write the recommendation', 'Prepare an audit memo for this package', 'Gawekna memo audit', 'Tulung damelaken memo'],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket || !w.hpsVsPasar) return noPkg(ctx)
      const ring = ringNames(w)
      return {
        text: memoSummary(w, ctx.lang),
        structured: {
          kind: 'audit-memo',
          data: {
            title: T(ctx.lang, `Memo audit ${w.paket.nama.id}`, `Audit memo ${w.paket.nama.en}`),
            findings: (w.analisis?.temuan ?? []).filter((f) => f.tingkat !== 'lolos').map((f) => noteText(f.catatan, ctx.lang)),
            hpsCorrected: w.hpsVsPasar.pasar,
            recommendations: [correctionLine(w, ctx.lang)].concat(ring.length ? [T(ctx.lang, `Klarifikasi ${ring.length} peserta yang terhubung.`, `Clarify the ${ring.length} linked bidders.`)] : []),
            inviteLocal: true,
          },
        },
        toolCalls: [
          { name: 'hps_vs_pasar', input: { paket: w.paket.kode }, output: { hpsKoreksi: w.hpsVsPasar.pasar } },
          { name: 'draft_audit_memo', input: { paket: w.paket.kode, peran: ctx.role }, output: { bagian: 4 } },
        ],
        followUps: chips(ctx.lang, 'next', 'local'),
      }
    },
  },
  {
    id: 'paling-berisiko',
    examples: [
      'Paket mana yang paling berisiko?', 'Urutkan paket berdasarkan risiko', 'Berapa paket yang belum dianalisis?', 'Paket apa saja yang dipantau?',
      'Which package is the riskiest?', 'Rank packages by risk', 'How many packages are not analysed?', 'Which packages are watched?',
      'Paket sing paling rawan sing endi?', 'Paket endi sing durung dianalisis?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      const list = w?.daftarPaket ?? []
      if (!list.length) return { text: T(ctx.lang, 'Tidak ada paket aktif saat ini.', 'No open package right now.') }
      const lines = list.slice(0, 4).map((p, i) => `${i + 1}. ${L(ctx.lang, p.nama)} (${p.kode}, ${p.opd}): ${p.skor != null ? T(ctx.lang, `skor ${p.skor}`, `score ${p.skor}`) : T(ctx.lang, 'belum dianalisis', 'not analysed')}, HPS ${pct(p.deviasiPct, ctx.lang, true)} vs pasar`).join('\n')
      return {
        text: T(ctx.lang, `Paket aktif dengan risiko tertinggi (skor analisis, atau deviasi HPS bila belum dianalisis):\n${lines}`, `Open packages with the highest risk (analysis score, or HPS deviation when not analysed yet):\n${lines}`),
        toolCalls: [{ name: 'daftar_paket', input: { urut: 'risiko' }, output: { paket: list.length } }],
        followUps: chips(ctx.lang, 'sum', 'how'),
      }
    },
  },
  {
    id: 'penghematan',
    examples: [
      'Berapa potensi penghematan?', 'Berapa uang yang bisa dihemat', 'Berapa total selisih HPS?', 'Total selisih HPS semua paket',
      'How much could we save?', 'Potential savings', 'What is the total HPS gap?', 'Total gap across packages',
      'Pira sing iso dihemat?', 'Selisihe kabeh pira?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      const total = (w?.daftarPaket ?? []).reduce((a, p) => a + Math.max(0, p.hps - p.hps / (1 + p.deviasiPct / 100)), 0)
      if (!w?.paket || !w.hpsVsPasar) {
        const n = w?.daftarPaket.length ?? 0
        return {
          text: T(
            ctx.lang,
            `Di ${n} paket aktif teratas, selisih HPS terhadap median pasar sekitar **${rpShort(total, 'id')}** (simulasi). Buka satu paket untuk melihat rincian per item.`,
            `Across the top ${n} open packages, the HPS is about **${rpShort(total, 'en')}** above the market median (simulated). Open a package to see the item breakdown.`,
          ),
          toolCalls: [{ name: 'daftar_paket', input: { urut: 'selisih' }, output: { paket: n } }],
          followUps: chips(ctx.lang, 'top', 'due'),
        }
      }
      const h = w.hpsVsPasar
      return {
        text: T(
          ctx.lang,
          `Untuk paket ini, koreksi HPS ke median pasar menghemat ${rpFull(h.selisih, 'id')} (${pct(h.deviasiPct, 'id')}). Di ${w.daftarPaket.length} paket aktif teratas, selisih HPS terhadap pasar sekitar ${rpShort(total, 'id')} (simulasi).`,
          `For this package, correcting the HPS to the market median saves ${rpFull(h.selisih, 'en')} (${pct(h.deviasiPct, 'en')}). Across the top ${w.daftarPaket.length} open packages the HPS gap is about ${rpShort(total, 'en')} (simulated).`,
        ),
        followUps: chips(ctx.lang, 'fix', 'memo'),
      }
    },
  },
  {
    id: 'tenggat',
    examples: [
      'Kapan tenggatnya?', 'Kapan batas akhir penawaran?', 'Sisa berapa hari?', 'Tenggat paket mana yang paling dekat?',
      'When is the deadline?', 'How many days are left?', 'Which package deadline is closest?', 'When do bids close?',
      'Deadline e kapan?', 'Tenggate kapan?', 'Kari pirang dina?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      const days = (n: number) => (n <= 0 ? T(ctx.lang, 'hari ini', 'today') : T(ctx.lang, `${n} hari lagi`, `in ${n} day${n === 1 ? '' : 's'}`))
      if (w?.paket) {
        const p = w.paket
        const text =
          p.sisaHari == null
            ? T(ctx.lang, `${p.nama.id} sudah melewati masa penawaran (tahap ${p.tahap}).`, `${p.nama.en} is past the bidding stage (stage: ${p.tahap}).`)
            : T(
                ctx.lang,
                `Batas penawaran ${p.nama.id}: **${days(p.sisaHari)}**${p.jadwalHari != null ? `, dari masa penawaran ${p.jadwalHari} hari` : ''}${p.darurat ? ' (status darurat)' : ''}.`,
                `${p.nama.en} closes for bids **${days(p.sisaHari)}**${p.jadwalHari != null ? `, out of a ${p.jadwalHari}-day bidding window` : ''}${p.darurat ? ' (emergency status)' : ''}.`,
              )
        return { text, toolCalls: [{ name: 'jadwal_paket', input: { paket: p.kode }, output: { sisaHari: p.sisaHari } }], followUps: chips(ctx.lang, 'sum', 'next') }
      }
      const open = (w?.daftarPaket ?? []).filter((p) => p.sisaHari != null).sort((a, b) => (a.sisaHari ?? 0) - (b.sisaHari ?? 0)).slice(0, 4)
      if (!open.length) return { text: T(ctx.lang, 'Tidak ada paket yang masih menerima penawaran.', 'No package is still taking bids.'), followUps: chips(ctx.lang, 'top') }
      const lines = open.map((p) => `- ${L(ctx.lang, p.nama)} (${p.kode}): ${days(p.sisaHari ?? 0)}`).join('\n')
      return {
        text: T(ctx.lang, `Tenggat penawaran terdekat:\n${lines}`, `Closest bid deadlines:\n${lines}`),
        toolCalls: [{ name: 'daftar_paket', input: { urut: 'tenggat' }, output: { paket: open.length } }],
        followUps: chips(ctx.lang, 'top', 'gap'),
      }
    },
  },
  {
    id: 'langkah',
    examples: ['Apa langkah selanjutnya?', 'Saya harus melakukan apa', 'Tindak lanjut yang disarankan', 'What should I do next?', 'Recommended next steps', 'Sakbanjure kudu piye?'],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket) return noPkg(ctx)
      const insp = ctx.role === 'inspektorat'
      const steps = !w.analisis
        ? [T(ctx.lang, 'Jalankan analisis 7 detektor.', 'Run the 7-detector analysis.'), T(ctx.lang, 'Periksa graf peserta di tab Peserta.', 'Check the bidder graph in the Bidders tab.'), T(ctx.lang, 'Susun rekomendasi dari tab Laporan.', 'Draft the recommendation from the Report tab.')]
        : insp
          ? [T(ctx.lang, 'Terbitkan memo audit ke Bupati dengan tembusan UKPBJ.', 'Issue the audit memo to the Regent, copying UKPBJ.'), T(ctx.lang, 'Minta klarifikasi tertulis dari peserta yang terhubung.', 'Request a written clarification from the linked bidders.'), T(ctx.lang, 'Jadwalkan reviu ulang setelah HPS dikoreksi.', 'Schedule a re-review after the HPS is corrected.')]
          : [T(ctx.lang, 'Kirim nota reviu HPS ke PPK sebelum penetapan pemenang.', 'Send the HPS review memo to the PPK before a winner is named.'), T(ctx.lang, 'Tunda evaluasi sampai spesifikasi direvisi.', 'Hold the evaluation until the spec is revised.'), T(ctx.lang, 'Undang UMKM lokal lewat Katalog Lokal sebagai pembanding.', 'Invite local SMEs through Katalog Lokal as a benchmark.')]
      return { text: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), followUps: chips(ctx.lang, 'memo', 'local') }
    },
  },
  {
    id: 'cara-kerja',
    examples: ['Bagaimana cara kerja detektornya?', 'Apa saja yang diperiksa', 'Metode analisisnya apa', 'How do the detectors work?', 'What does the analysis check', 'Carane mriksa piye?'],
    respond: (ctx) => ({
      text: T(ctx.lang, 'Tujuh detektor membaca data paket, penawaran, dan riwayat OPD:\n', 'Seven detectors read the package, the bids and the agency history:\n') +
        Object.values(DETECTOR_BY_ID).map((d) => `- ${L(ctx.lang, d.name)}: ${L(ctx.lang, d.checks)}`).join('\n') +
        T(ctx.lang, '\nHasilnya indikasi untuk ditinjau manusia, bukan tuduhan.', '\nResults are indications for human review, not accusations.'),
      followUps: chips(ctx.lang, 'sum', 'top'),
    }),
  },
]

export const SCENARIO: Scenario<AbContext> = {
  product: 'awas-belanja',
  intents: INTENTS,
  fallback: (ctx) => ({
    text: T(
      ctx.lang,
      'Maaf, saya belum menangkap maksudnya. Saya membantu pengawasan pengadaan: kewajaran HPS, peserta tender, jadwal, pola risiko, dan memo rekomendasi. Pilih salah satu saran di bawah, atau tulis ulang pertanyaannya.',
      'Sorry, I did not catch that. I help with procurement oversight: HPS fairness, bidders, schedules, risk patterns and recommendation memos. Pick one of the suggestions below, or rephrase the question.',
    ),
    followUps: ctx.world?.paket ? chips(ctx.lang, 'sum', 'hps', 'ring') : chips(ctx.lang, 'top', 'gap', 'due'),
  }),
}

registerScenario(SCENARIO)
