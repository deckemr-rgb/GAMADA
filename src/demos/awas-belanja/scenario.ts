/**
 * demos/awas-belanja/scenario.ts — AI simulation scenario (spec §9.2): 15 intents with ID, EN and Basa Jawa
 * examples; every answer reads the AbContext of the open package (model.ts aiContext), so numbers equal the
 * tables on screen. Registered when the chat surface (Assistant / MemoTab) loads, not with the page.
 */
import type { Intent, Lang, Scenario, SimContext, SimResponse, Structured } from '../../demo-kit/ai/types'
import { registerScenario } from '../../demo-kit/ai/chat'
import type { Bi } from '../../demo-kit/world'
import { DETECTOR_BY_ID, ROUNDING_NOTE, noteText, pct, rpFull, rpShort, type AbContext, type Detector, type Level } from './model'
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
    `Usulkan kepada PPK koreksi HPS ke ${rpFull(h.hpsUsulan, 'id')} (median pasar + margin wajar ${h.marginPct}%, asumsi simulasi; ${ROUNDING_NOTE.id}), klarifikasi peserta yang terhubung, dan undang UMKM lokal lewat Katalog Lokal sebelum penetapan pemenang.`,
    `Propose to the PPK an HPS of ${rpFull(h.hpsUsulan, 'en')} (market median + a fair ${h.marginPct}% margin, simulation assumption; ${ROUNDING_NOTE.en}), clarify the linked bidders, and invite local SMEs through Katalog Lokal before a winner is named.`,
  )
}

const ringNames = (w: AbContext) => [...new Set(w.afiliasi.flatMap((e) => [e.a, e.b]))]
/** number of bids above the proposed HPS when that is every bid, else 0 */
const above = (w: AbContext) => {
  const h = w.hpsVsPasar
  const bids = w.peserta.filter((p) => p.penawaran != null)
  return h && bids.length && bids.every((p) => (p.penawaran ?? 0) > h.hpsUsulan) ? bids.length : 0
}

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
      w.role === 'inspektorat'
        ? `Kami merekomendasikan Bupati memerintahkan PPK/UKPBJ meninjau HPS sebelum pemenang ditetapkan; sebagai acuan, median pasar + margin wajar ${h.marginPct}% = ${rpFull(h.hpsUsulan, 'id')} (${ROUNDING_NOTE.id}).`
        : `Kami mengusulkan kepada PPK koreksi HPS menjadi ${rpFull(h.hpsUsulan, 'id')} (median pasar + margin wajar ${h.marginPct}%, ${ROUNDING_NOTE.id}) dan mengundang UMKM lokal lewat Katalog Lokal sebelum pemenang ditetapkan.`,
      above(w) ? `Seluruh ${above(w)} penawaran berada di atas HPS usulan, sehingga perlu negosiasi harga atau tender ulang.` : '',
    ].filter(Boolean).join(' ')
  return [
    `Package ${p.nama.en} (${p.kode}), HPS ${rpFull(h.hps, 'en')}${score != null ? `, scores ${score} out of 100 for risk` : ''}.`,
    h.selisih > 0 ? `The HPS is ${pct(h.deviasiPct, 'en')} above the market median, a difference of ${rpFull(h.selisih, 'en')}.` : 'The HPS is in line with the market median.',
    ring.length ? `${ring.length} of the ${p.jumlahPeserta} bidders are linked by a shared address, director or registration IP.` : '',
    spec ? 'The technical spec names one brand without "or equivalent".' : '',
    sched ? `The ${p.jadwalHari ?? '?'}-day bidding window needs a written justification.` : '',
    w.role === 'inspektorat'
      ? `We recommend that the Regent instruct the PPK/UKPBJ to review the HPS before a winner is named; as a reference, the market median + a fair ${h.marginPct}% margin = ${rpFull(h.hpsUsulan, 'en')} (${ROUNDING_NOTE.en}).`
      : `We propose to the PPK an HPS of ${rpFull(h.hpsUsulan, 'en')} (market median + a fair ${h.marginPct}% margin, ${ROUNDING_NOTE.en}) and inviting local SMEs through Katalog Lokal before a winner is named.`,
    above(w) ? `All ${above(w)} bids are above the proposed HPS, so the price needs negotiating or the tender re-run.` : '',
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
          `HPS yang wajar: median pasar ${rpFull(h.pasar, 'id')} ditambah margin keuntungan dan biaya umum ${h.marginPct}% (asumsi simulasi; ${ROUNDING_NOTE.id}), yaitu **${rpFull(h.hpsUsulan, 'id')}** (dari ${rpFull(h.hps, 'id')}, turun ${rpFull(h.hps - h.hpsUsulan, 'id')}). Ini usulan: penetapan HPS tetap wewenang PPK.${above(w) ? ` Catatan: seluruh ${above(w)} penawaran berada di atas angka ini, jadi perlu negosiasi atau tender ulang.` : ''}${w.rekomendasi ? ' Usulan ini sudah tercatat dan menunggu persetujuan PPK.' : ' Tekan "Rekomendasikan koreksi" agar usulan tercatat dan memo tersusun.'}`,
          `A fair HPS: the market median ${rpFull(h.pasar, 'en')} plus a ${h.marginPct}% margin for profit and overheads (simulation assumption; ${ROUNDING_NOTE.en}), i.e. **${rpFull(h.hpsUsulan, 'en')}** (from ${rpFull(h.hps, 'en')}, down ${rpFull(h.hps - h.hpsUsulan, 'en')}). This is a proposal: setting the HPS remains the PPK's decision.${above(w) ? ` Note: all ${above(w)} bids are above this figure, so the price needs negotiating or the tender re-run.` : ''}${w.rekomendasi ? ' The proposal is recorded and waits for the PPK.' : ' Press "Recommend a correction" to record it and draft the memo.'}`,
        ),
        toolCalls: [{ name: 'koreksi_hps', input: { paket: w.paket.kode }, output: { hpsUsulan: h.hpsUsulan } }],
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
            hpsCorrected: w.hpsVsPasar.hpsUsulan,
            recommendations: [correctionLine(w, ctx.lang)].concat(ring.length ? [T(ctx.lang, `Klarifikasi ${ring.length} peserta yang terhubung.`, `Clarify the ${ring.length} linked bidders.`)] : []),
            inviteLocal: true,
          },
        },
        toolCalls: [
          { name: 'hps_vs_pasar', input: { paket: w.paket.kode }, output: { hpsUsulan: w.hpsVsPasar.hpsUsulan } },
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
      const open = (w?.daftarPaket ?? []).filter((p) => p.aktif)
      if (!open.length) return { text: T(ctx.lang, 'Tidak ada paket yang masih tender saat ini.', 'No package is still in tender right now.') }
      const scored = open.filter((p) => p.skor != null).sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0))
      const rest = open.filter((p) => p.skor == null).sort((a, b) => b.deviasiPct - a.deviasiPct)
      const line = (p: AbContext['daftarPaket'][number]) => `- ${L(ctx.lang, p.nama)} (${p.kode}, ${p.opd}): ${p.skor != null ? T(ctx.lang, `skor ${p.skor}`, `score ${p.skor}`) + ', ' : ''}HPS ${pct(p.deviasiPct, ctx.lang, true)} vs ${T(ctx.lang, 'pasar', 'market')}`
      const parts = [
        T(ctx.lang, `${open.length} paket masih tender (saringan "Tender").`, `${open.length} packages are still in tender (the "In tender" filter).`),
        scored.length ? T(ctx.lang, `Sudah dianalisis, menurut skor:\n`, `Analysed, by score:\n`) + scored.slice(0, 3).map(line).join('\n') : '',
        rest.length ? T(ctx.lang, `Belum dianalisis, menurut deviasi HPS:\n`, `Not analysed yet, by HPS deviation:\n`) + rest.slice(0, 3).map(line).join('\n') : '',
        w?.ringkasan ? T(ctx.lang, `Paket berkontrak (${w.ringkasan.contract}) tidak masuk daftar ini; lihat saringan "Semua".`, `Contracted packages (${w.ringkasan.contract}) are not in this list; see the "All" filter.`) : '',
      ].filter(Boolean)
      return {
        text: parts.join('\n'),
        toolCalls: [{ name: 'daftar_paket', input: { urut: 'risiko', saringan: 'aktif' }, output: { paket: open.length } }],
        followUps: ctx.world?.paket ? chips(ctx.lang, 'sum', 'how') : chips(ctx.lang, 'gap', 'due', 'how'),
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
      const r = w?.ringkasan
      const top = (w?.daftarPaket ?? []).filter((p) => p.tahap !== 'selesai' && p.selisih > 0).sort((a, b) => b.selisih - a.selisih).slice(0, 3)
      const lines = top.map((p) => `- ${L(ctx.lang, p.nama)} (${p.kode}): ${rpShort(p.selisih, ctx.lang)}`).join('\n')
      const all = r
        ? T(
            ctx.lang,
            `Di ${r.watched} paket aktif dipantau (${r.tender} tender, ${r.contract} berkontrak), HPS melebihi median pasar sebesar **${rpShort(r.gap, 'id')}** (simulasi), sama dengan KPI "Selisih HPS vs pasar"${r.proposed ? `; usulan koreksi ${rpShort(r.proposed, 'id')} sudah tercatat, menunggu PPK, dan belum mengurangi angka ini` : ''}. Penyumbang terbesar:\n${lines}`,
            `Across the ${r.watched} open packages watched (${r.tender} in tender, ${r.contract} under contract), the HPS is **${rpShort(r.gap, 'en')}** above the market median (simulated), the same as the "HPS vs market gap" KPI${r.proposed ? `; proposed corrections of ${rpShort(r.proposed, 'en')} are recorded, await the PPK and are not deducted yet` : ''}. Largest contributors:\n${lines}`,
          )
        : ''
      if (!w?.paket || !w.hpsVsPasar) {
        return {
          text: all + T(ctx.lang, '\nBuka satu paket untuk melihat rincian per item.', '\nOpen a package to see the item breakdown.'),
          toolCalls: [{ name: 'daftar_paket', input: { urut: 'selisih' }, output: { paket: r?.watched ?? 0 } }],
          followUps: chips(ctx.lang, 'top', 'due'),
        }
      }
      const h = w.hpsVsPasar
      return {
        text: T(
          ctx.lang,
          `Untuk paket ini, HPS ${rpFull(h.selisih, 'id')} (${pct(h.deviasiPct, 'id')}) di atas median pasar. Dengan HPS usulan ${rpFull(h.hpsUsulan, 'id')} (median + margin ${h.marginPct}%), HPS turun ${rpFull(h.hps - h.hpsUsulan, 'id')}.\n`,
          `For this package, the HPS is ${rpFull(h.selisih, 'en')} (${pct(h.deviasiPct, 'en')}) above the market median. With the proposed HPS of ${rpFull(h.hpsUsulan, 'en')} (median + ${h.marginPct}% margin) it drops by ${rpFull(h.hps - h.hpsUsulan, 'en')}.\n`,
        ) + all,
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
      const open = (w?.daftarPaket ?? []).filter((p) => p.aktif && p.sisaHari != null).sort((a, b) => (a.sisaHari ?? 0) - (b.sisaHari ?? 0)).slice(0, 4)
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

/* ------------------------------------------------------------------ agencies, vendors, named bidders */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** the agency a question names ("BPBD", "Dinas PUPR", "dinkes"…), from the package list */
function opdIn(w: AbContext, text: string): { opd: string; nama: string } | null {
  const q = ` ${norm(text)} `
  for (const p of w.daftarPaket) if (q.includes(` ${norm(p.opd)} `) || q.includes(` ${norm(p.opdNama)} `)) return { opd: p.opd, nama: p.opdNama }
  return null
}

INTENTS.push(
  {
    id: 'opd',
    examples: [
      'Apakah ada indikasi korupsi di BPBD?', 'Bagaimana pengadaan di Dinas PUPR?', 'Paket BPBD apa saja?', 'Ada kecurangan di dinas ini?', 'Indikasi mark up di OPD mana?',
      'Is there corruption at BPBD?', 'How is procurement at the public works agency?', 'Which agency has the most risk?', 'Any fraud signs at Dinkes?',
      'Ana korupsi neng BPBD ora?', 'Pengadaan neng dinas PUPR piye?',
    ],
    respond: (ctx) => {
      const w = ctx.world
      if (!w) return { text: T(ctx.lang, 'Data paket belum siap.', 'Package data is not ready yet.') }
      const hit = opdIn(w, ctx.text)
      if (!hit) {
        const by = new Map<string, number>()
        for (const p of w.daftarPaket) if (p.tahap !== 'selesai') by.set(p.opd, (by.get(p.opd) ?? 0) + p.selisih)
        const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        return {
          text: T(ctx.lang, 'OPD dengan selisih HPS terhadap pasar terbesar (paket aktif, simulasi):\n', 'Agencies with the largest HPS gap to the market (open packages, simulated):\n') +
            top.map(([o, v]) => `- ${o}: ${rpShort(v, ctx.lang)}`).join('\n') +
            T(ctx.lang, '\nSebut nama OPD-nya (misalnya "BPBD") untuk rincian per paket. Hasilnya indikasi untuk ditinjau, bukan tuduhan.', '\nName the agency (for example "BPBD") for a per-package breakdown. Results are indications to review, not accusations.'),
          followUps: chips(ctx.lang, 'top', 'gap'),
        }
      }
      const ps = w.daftarPaket.filter((p) => p.opd === hit.opd)
      const open = ps.filter((p) => p.tahap !== 'selesai')
      const done = ps.filter((p) => p.tahap === 'selesai')
      const flagged = ps.filter((p) => p.skor != null && p.skor >= 35)
      const winners = [...new Set(done.map((p) => p.pemenang).filter((x): x is string => !!x))]
      const lines = open
        .map((p) => `- ${L(ctx.lang, p.nama)} (${p.kode}): HPS ${pct(p.deviasiPct, ctx.lang, true)} vs ${T(ctx.lang, 'pasar', 'market')}${p.skor != null ? T(ctx.lang, `, skor ${p.skor}`, `, score ${p.skor}`) : T(ctx.lang, ', belum dianalisis', ', not analysed')}`)
        .join('\n')
      return {
        text: T(
          ctx.lang,
          `${hit.nama} (${hit.opd}): ${open.length} paket aktif dan ${done.length} paket selesai di data simulasi.\n${lines}${winners.length ? `\nPaket selesai dimenangkan: ${winners.join(', ')}.` : ''}\n${flagged.length ? `${flagged.length} paket bertanda berisiko.` : 'Belum ada paket yang bertanda berisiko.'} Ini indikasi untuk ditinjau Inspektorat, bukan tuduhan korupsi.`,
          `${hit.nama} (${hit.opd}): ${open.length} open and ${done.length} completed packages in the simulated data.\n${lines}${winners.length ? `\nCompleted packages were won by: ${winners.join(', ')}.` : ''}\n${flagged.length ? `${flagged.length} package(s) flagged as risky.` : 'No package flagged as risky yet.'} These are indications for the Inspectorate to review, not an accusation of corruption.`,
        ),
        toolCalls: [{ name: 'daftar_paket', input: { opd: hit.opd }, output: { paket: ps.length } }],
        followUps: chips(ctx.lang, 'top', 'gap'),
      }
    },
  },
  {
    id: 'pemasok',
    examples: [
      'Apakah toko saya bisa ikut jual pompa ke pemda?', 'Bagaimana UMKM bisa ikut tender?', 'Cara daftar jadi pemasok pemda', 'Usaha saya bisa ikut pengadaan?',
      'Can my shop sell to the local government?', 'How can a small business join a tender?', 'How do I become a government supplier?',
      'Toko kula saged tumut sade?', 'Usahaku iso melu tender?',
    ],
    respond: (ctx) => ({
      text: T(
        ctx.lang,
        'Bisa. Di ekosistem ini, kebutuhan pengadaan diteruskan ke Katalog Lokal: toko dan UMKM yang identitas usahanya sudah diverifikasi (lewat produk Kenal Mitra) diundang sebagai pembanding harga dan calon pemasok, lalu TenderPilot memberi tahu toko bila ada tender yang cocok. Rekomendasi Awas Belanja untuk paket pompa darurat juga mengirim kebutuhan itu ke Katalog Lokal. Demo Katalog Lokal dan TenderPilot menyusul di tahap berikutnya (simulasi).',
        'Yes. In this ecosystem procurement needs go to Katalog Lokal: shops and SMEs whose business identity is verified (through the Kenal Mitra product) are invited as a price benchmark and potential suppliers, and TenderPilot alerts a shop when a matching tender opens. The Awas Belanja recommendation for the emergency pump package also sends that need to Katalog Lokal. The Katalog Lokal and TenderPilot demos follow in a later stage (simulated).',
      ),
      followUps: ctx.world?.paket ? chips(ctx.lang, 'local', 'memo') : chips(ctx.lang, 'top', 'gap'),
    }),
  },
  {
    id: 'peserta',
    examples: ['Siapa pemilik perusahaan ini?', 'Siapa direktur peserta ini?', 'Berapa kali perusahaan ini menang?', 'Profil peserta tender', 'Who owns this company?', 'Who is the director of this bidder?', 'How many times has this company won?', 'Sapa sing nduwe perusahaan iki?'],
    respond: (ctx) => {
      const w = ctx.world
      if (!w?.paket) return noPkg(ctx)
      const lines = w.peserta
        .map((p) => `- ${p.nama}: ${T(ctx.lang, 'direktur', 'director')} ${p.direktur}, ${p.penawaran != null ? rpShort(p.penawaran, ctx.lang) : T(ctx.lang, 'belum menawar', 'no bid')}, ${T(ctx.lang, `menang ${p.menang}×`, `${p.menang} wins`)}`)
        .join('\n')
      return { text: T(ctx.lang, `Peserta ${w.paket.kode} (data simulasi):\n${lines}\nSebut nama perusahaannya untuk profil lengkap.`, `Bidders of ${w.paket.kode} (simulated data):\n${lines}\nName a company for its full profile.`), followUps: chips(ctx.lang, 'ring', 'memo') }
    },
  },
)

/** a question that names a bidder of the open package is answered from that bidder's row, whatever the intent */
function bidderAnswer(ctx: Ctx): SimResponse | null {
  const w = ctx.world
  if (!w?.paket) return null
  const q = ` ${norm(ctx.text)} `
  const b = w.peserta.find((p) => q.includes(` ${norm(p.nama.replace(/^(CV|PT)\s+/, ''))} `))
  if (!b) return null
  const linked = b.terhubungDengan.length
    ? T(ctx.lang, `Terhubung dengan ${b.terhubungDengan.join(', ')} (bukti di tab Peserta).`, `Linked to ${b.terhubungDengan.join(', ')} (evidence in the Bidders tab).`)
    : T(ctx.lang, 'Tidak terhubung dengan peserta lain.', 'Not linked to any other bidder.')
  const bid =
    b.penawaran != null
      ? `${rpFull(b.penawaran, ctx.lang)}${b.diAtasHps ? T(ctx.lang, ' (di atas HPS, gugur dalam evaluasi harga)', ' (above the HPS: fails the price evaluation)') : ''}`
      : T(ctx.lang, 'belum menawar', 'no bid yet')
  return {
    text: T(
      ctx.lang,
      `**${b.nama}** (data simulasi): direktur ${b.direktur}, alamat ${b.alamat}. Penawaran untuk ${w.paket.kode}: ${bid}. Tercatat menang ${b.menang} kali. ${linked}${b.terhubungDengan.length ? ' Ini indikasi untuk ditinjau, bukan tuduhan.' : ''}`,
      `**${b.nama}** (simulated data): director ${b.direktur}, address ${b.alamat}. Bid for ${w.paket.kode}: ${bid}. Recorded wins: ${b.menang}. ${linked}${b.terhubungDengan.length ? ' This is an indication to review, not an accusation.' : ''}`,
    ),
    toolCalls: [{ name: 'graf_peserta', input: { paket: w.paket.kode, peserta: b.nama }, output: { terhubung: b.terhubungDengan.length, menang: b.menang } }],
    followUps: chips(ctx.lang, 'ring', 'memo', 'next'),
  }
}


/* ------------------------------------------------------------------ routed questions (keywords, before the matcher) */

const RX = {
  credit: /\b(kredit|pinjaman|debitur|modal kerja|layak dibiayai|uji tuntas|penjaminan|credit|loan|lend|borrower|due diligence)/i,
  integration: /\b(spse|lpse|sirup|e-?katalog|inaproc|integrasi|terhubung ke|tersambung|sumber data|data asli|data nyata|api|integrat\w*|connected to|data source|real data)\b/i,
  save: /\b(hemat|dihemat|penghematan|selamatkan|diselamatkan|menyelamatkan|save|saved|saving)/i,
  lowest: /\b(terendah|termurah|paling murah|lowest|cheapest)\b/i,
  risky: /\b(berisiko|paling rawan|riskiest|most risky|risk)\b/i,
}

/** a question that names another package (a word only that package's name has, its code, or "paket <OPD>") */
const NAME_STOP = new Set(['pengadaan', 'belanja', 'paket', 'kota', 'daerah', 'untuk', 'procurement', 'purchase', 'package', 'packages', 'district', 'emergency', 'darurat', 'tahap', 'stage', 'layanan', 'services'])
function packageIn(w: AbContext, text: string): AbContext['daftarPaket'][number] | null {
  const q = ` ${norm(text)} `
  const byCode = w.daftarPaket.find((p) => q.includes(` ${norm(p.kode)} `))
  if (byCode) return byCode
  const words = (p: AbContext['daftarPaket'][number]) => new Set(norm(`${p.nama.id} ${p.nama.en}`).split(' ').filter((x) => x.length >= 5 && !NAME_STOP.has(x)))
  const count = new Map<string, number>()
  for (const p of w.daftarPaket) for (const x of words(p)) count.set(x, (count.get(x) ?? 0) + 1)
  const hits = w.daftarPaket.filter((p) => [...words(p)].some((x) => count.get(x) === 1 && q.includes(` ${x}`)))
  return hits.length === 1 ? hits[0]! : null
}

function packageAnswer(ctx: Ctx, p: AbContext['daftarPaket'][number]): SimResponse {
  const lang = ctx.lang
  const head = T(lang, `**${p.nama.id}** (${p.kode}, ${p.opd}), HPS ${rpFull(p.hps, 'id')}, ${pct(p.deviasiPct, 'id', true)} vs median pasar (simulasi).`, `**${p.nama.en}** (${p.kode}, ${p.opd}), HPS ${rpFull(p.hps, 'en')}, ${pct(p.deviasiPct, 'en', true)} vs the market median (simulated).`)
  let body: string
  if (p.dianalisis && p.skor != null) {
    const lines = p.temuan.map((f) => `- ${L(lang, DETECTOR_BY_ID[f.detektor].name)} (${STRINGS[lang].levels[f.tingkat]}, ${T(lang, 'bobot', 'weight')} ${f.bobot}%): ${noteText(f.catatan, lang)}`).join('\n')
    body = p.temuan.length
      ? T(lang, `Skor ${p.skor} berasal dari detektor yang menyala:\n${lines}\nBobot digabung, tidak dijumlah lurus: 100 × (1 − Π(1 − bobot)) = ${p.skor}. Detektor lain lolos.`, `The score ${p.skor} comes from the detectors that fired:\n${lines}\nWeights are combined, not added: 100 × (1 − Π(1 − weight)) = ${p.skor}. The other detectors passed.`)
      : T(lang, 'Ketujuh detektor lolos: tidak ada pola risiko.', 'All 7 detectors passed: no risk pattern.')
    if (p.skorAwal != null && p.skorAwal !== p.skor) body += T(lang, `\nSkor awal penyaringan (${p.skorAwal}) sudah diganti hasil 7 detektor ini.`, `\nThe initial screening score (${p.skorAwal}) has been replaced by this 7-detector result.`)
  } else if (p.skorAwal != null) {
    body = T(lang, `Baru ada skor awal ${p.skorAwal} dari penyaringan otomatis, tanpa rincian detektor. Buka paketnya dan jalankan analisis untuk penjelasan tiap detektor.`, `It only has an initial screening score of ${p.skorAwal}, without detector detail. Open the package and run the analysis for each detector's explanation.`)
  } else body = T(lang, 'Paket ini belum dipindai. Pemindaian otomatis akan mencapainya saat jam dunia berjalan, atau buka paketnya dan jalankan analisis.', 'This package has not been screened yet. The automatic screening reaches it while the world clock runs, or open it and run the analysis.')
  return {
    text: `${head}\n${body}\n${T(lang, 'Ini indikasi untuk ditinjau, bukan tuduhan.', 'This is an indication to review, not an accusation.')}`,
    toolCalls: [{ name: 'daftar_paket', input: { paket: p.kode }, output: { skor: p.skor ?? p.skorAwal ?? null } }],
    followUps: chips(lang, 'top', 'gap'),
  }
}

function integrationAnswer(ctx: Ctx): SimResponse {
  return {
    text: T(
      ctx.lang,
      'Belum. Di demo ini semua data adalah simulasi: paket, peserta, dan harga pasar dibangkitkan untuk daerah contoh, dan tidak tersambung ke sistem pemerintah mana pun. Pada implementasi, data paket dan jadwal ditarik dari SPSE/LPSE dan rencana pengadaan dari SiRUP lewat API resmi atau ekspor berkala sesuai izin LKPP dan pemda; harga pasar dari e-Katalog, survei harga, dan kontrak sebelumnya. Detektornya tetap sama, dan setiap angka tetap bisa ditelusuri ke sumbernya.',
      'Not yet. Everything in this demo is simulated: packages, bidders and market prices are generated for a sample region and are not connected to any government system. In a deployment, packages and schedules come from SPSE/LPSE and procurement plans from SiRUP through the official API or periodic exports, with LKPP and local-government permission; market prices from e-Katalog, price surveys and past contracts. The detectors stay the same, and every number stays traceable to its source.',
    ),
    followUps: chips(ctx.lang, 'how', 'top'),
  }
}

/** the savings question: what the proposals would take off the HPS (upper bound, waiting for the PPK) */
function savingsAnswer(ctx: Ctx): SimResponse {
  const lang = ctx.lang
  const w = ctx.world
  const r = w?.ringkasan
  if (!w || !r) return { text: T(lang, 'Data paket belum siap.', 'Package data is not ready yet.') }
  const watched = w.daftarPaket.filter((p) => p.tahap !== 'selesai')
  const cut = (p: AbContext['daftarPaket'][number]) => Math.max(0, p.hps - (p.usulanTercatat ?? p.hpsUsulan))
  const potential = watched.reduce((a, p) => a + cut(p), 0)
  const top = [...watched].filter((p) => cut(p) > 0).sort((a, b) => cut(b) - cut(a)).slice(0, 3)
  const lines = top.map((p) => `- ${L(lang, p.nama)} (${p.kode}): ${rpShort(cut(p), lang)}${p.usulanTercatat != null ? T(lang, ' · usulan tercatat, menunggu PPK', ' · proposal recorded, awaiting the PPK') : ''}`).join('\n')
  const parts: string[] = []
  if (RX.risky.test(ctx.text)) {
    const open = w.daftarPaket.filter((p) => p.aktif && (p.skor ?? p.skorAwal) != null).sort((a, b) => (b.skor ?? b.skorAwal ?? 0) - (a.skor ?? a.skorAwal ?? 0))[0]
    if (open) parts.push(T(lang, `Paling berisiko saat ini: **${open.nama.id}** (${open.kode}), skor ${open.skor ?? open.skorAwal}${open.skor == null ? ' (skor awal)' : ''}.`, `Riskiest right now: **${open.nama.en}** (${open.kode}), score ${open.skor ?? open.skorAwal}${open.skor == null ? ' (initial score)' : ''}.`))
  }
  parts.push(
    T(
      lang,
      `Di ${r.watched} paket dipantau, HPS di atas median pasar sebesar **${rpShort(r.gap, 'id')}** (simulasi). Bila setiap HPS dikoreksi ke median pasar + margin wajar 10%, plafon anggaran turun sekitar **${rpShort(potential, 'id')}**. Penyumbang terbesar:\n${lines}`,
      `Across the ${r.watched} packages watched, the HPS is **${rpShort(r.gap, 'en')}** above the market median (simulated). If every HPS were corrected to the market median + a fair 10% margin, the budget ceiling would drop by about **${rpShort(potential, 'en')}**. Largest contributors:\n${lines}`,
    ),
  )
  const p = w.paket
  const lowest = w.peserta.filter((x) => x.penawaran != null).sort((a, b) => (a.penawaran ?? 0) - (b.penawaran ?? 0))[0]
  if (p && w.hpsVsPasar && lowest?.penawaran != null)
    parts.push(T(lang, `Untuk ${p.kode}: penawaran terendah ${rpFull(lowest.penawaran, 'id')} (${lowest.nama}) masih ${rpFull(lowest.penawaran - w.hpsVsPasar.hpsUsulan, 'id')} di atas HPS usulan, jadi penghematannya baru terwujud lewat negosiasi atau tender ulang.`, `For ${p.kode}: the lowest bid ${rpFull(lowest.penawaran, 'en')} (${lowest.nama}) is still ${rpFull(lowest.penawaran - w.hpsVsPasar.hpsUsulan, 'en')} above the proposed HPS, so the saving only materialises through negotiation or a re-tender.`))
  parts.push(T(lang, 'Ini batas atas dan bersifat simulasi: uang yang benar-benar terselamatkan bergantung pada keputusan PPK dan harga kontrak akhir.', 'This is an upper bound and simulated: the money actually saved depends on the PPK decision and the final contract price.'))
  return { text: parts.join('\n'), toolCalls: [{ name: 'daftar_paket', input: { urut: 'penghematan' }, output: { paket: watched.length } }], followUps: chips(lang, 'top', 'gap') }
}

/** the open package's lowest bid against the current and the proposed HPS */
function lowestAnswer(ctx: Ctx): SimResponse | null {
  const w = ctx.world
  const lang = ctx.lang
  if (!w?.paket || !w.hpsVsPasar) return null
  const bids = w.peserta.filter((x) => x.penawaran != null).sort((a, b) => (a.penawaran ?? 0) - (b.penawaran ?? 0))
  const lo = bids[0]
  if (!lo || lo.penawaran == null) return { text: T(lang, 'Belum ada penawaran masuk untuk paket ini.', 'No bid has come in for this package yet.'), followUps: chips(lang, 'fix', 'next') }
  const h = w.hpsVsPasar
  const diffNow = h.hps - lo.penawaran
  const diffProp = lo.penawaran - h.hpsUsulan
  return {
    text: T(
      lang,
      `HPS saat ini ${rpFull(h.hps, 'id')}. Penawaran terendah ${rpFull(lo.penawaran, 'id')} (${lo.nama}), ${rpFull(diffNow, 'id')} di bawah HPS. HPS usulan ${rpFull(h.hpsUsulan, 'id')}: penawaran terendah masih ${diffProp > 0 ? `${rpFull(diffProp, 'id')} di atasnya, sehingga perlu negosiasi harga atau tender ulang` : `${rpFull(-diffProp, 'id')} di bawahnya`}. Angka simulasi; keputusan tetap di PPK.`,
      `The current HPS is ${rpFull(h.hps, 'en')}. The lowest bid is ${rpFull(lo.penawaran, 'en')} (${lo.nama}), ${rpFull(diffNow, 'en')} below the HPS. Against the proposed HPS of ${rpFull(h.hpsUsulan, 'en')}, the lowest bid is still ${diffProp > 0 ? `${rpFull(diffProp, 'en')} above it, so the price needs negotiating or the tender re-run` : `${rpFull(-diffProp, 'en')} below it`}. Simulated figures; the decision stays with the PPK.`,
    ),
    toolCalls: [{ name: 'hps_vs_pasar', input: { paket: w.paket.kode }, output: { penawaranTerendah: lo.penawaran } }],
    followUps: chips(lang, 'fix', 'memo'),
  }
}

/** a bank / cooperative asking about a contractor: the procurement signals as one due-diligence input, nothing more */
function creditAnswer(ctx: Ctx): SimResponse | null {
  const w = ctx.world
  const lang = ctx.lang
  if (!w?.paket) return null
  const q = ` ${norm(ctx.text)} `
  const b = w.peserta.find((p) => q.includes(` ${norm(p.nama.replace(/^(CV|PT)\s+/, ''))} `))
  if (!b) return null
  const bids = w.peserta.filter((x) => x.penawaran != null && x.nama !== b.nama).map((x) => x.penawaran ?? 0)
  const uniform = b.penawaran != null && bids.some((x) => Math.abs(x - (b.penawaran ?? 0)) / x < 0.005)
  const sig = [
    T(lang, `menang ${b.menang}× (riwayat simulasi)`, `${b.menang} recorded wins (simulated history)`),
    b.terhubungDengan.length ? T(lang, `terhubung dengan ${b.terhubungDengan.join(', ')}`, `linked to ${b.terhubungDengan.join(', ')}`) : T(lang, 'tidak terhubung dengan peserta lain', 'no link to other bidders'),
    uniform ? T(lang, 'penawaran berselisih < 0,5% dengan peserta lain', 'bid within 0.5% of another bidder') : T(lang, 'penawaran tidak seragam', 'bid not uniform with others'),
    b.diAtasHps ? T(lang, 'penawaran di atas HPS (gugur)', 'bid above the HPS (fails)') : T(lang, 'penawaran di bawah HPS', 'bid below the HPS'),
  ]
  const clean = !b.terhubungDengan.length && !uniform && !b.diAtasHps
  return {
    text: T(
      lang,
      `**Profil risiko kontraktor (simulasi): ${b.nama}**\n${sig.map((x) => `- ${x}`).join('\n')}\n${clean ? 'Dari sisi pengadaan tidak ada sinyal risiko pada paket ini.' : 'Ada sinyal pengadaan yang perlu diklarifikasi lebih dulu.'} Sinyal ini bisa menjadi satu masukan uji tuntas; keputusan kredit tetap di bank atau koperasi berdasarkan analisis kreditnya sendiri (arus kas, agunan, riwayat pembayaran).`,
      `**Contractor risk profile (simulated): ${b.nama}**\n${sig.map((x) => `- ${x}`).join('\n')}\n${clean ? 'On the procurement side there is no risk signal in this package.' : 'There are procurement signals to clarify first.'} These signals can be one due-diligence input; the credit decision stays with the bank or cooperative and its own credit analysis (cash flow, collateral, repayment history).`,
    ),
    toolCalls: [{ name: 'graf_peserta', input: { paket: w.paket.kode, peserta: b.nama }, output: { terhubung: b.terhubungDengan.length, menang: b.menang } }],
    followUps: chips(lang, 'ring', 'next'),
  }
}

/** keyword routes that the TF-IDF matcher would miss or answer with the wrong intent */
function routed(ctx: Ctx): SimResponse | null {
  const t = ctx.text
  if (RX.credit.test(t)) {
    const c = creditAnswer(ctx)
    if (c) return c
  }
  if (RX.integration.test(t)) return integrationAnswer(ctx)
  if (RX.lowest.test(t)) {
    const l = lowestAnswer(ctx)
    if (l) return l
  }
  if (RX.save.test(t)) return savingsAnswer(ctx)
  const w = ctx.world
  if (w) {
    const p = packageIn(w, t)
    if (p && p.id !== w.paket?.id) return packageAnswer(ctx, p)
  }
  return null
}

/** chips that only make sense with a package open */
const PKG_CHIPS = new Set(['hps', 'ring', 'fix', 'memo', 'local', 'next', 'sum'].flatMap((k) => CHIP[k]!))
function finish(ctx: Ctx, r: SimResponse): SimResponse {
  if (ctx.world?.paket || !r.followUps) return r
  const keep = r.followUps.filter((c) => !PKG_CHIPS.has(c))
  return { ...r, followUps: keep.length ? keep : chips(ctx.lang, 'top', 'gap', 'due') }
}
for (const it of INTENTS) {
  const respond = it.respond
  it.respond = (ctx, slots) => finish(ctx, routed(ctx) ?? bidderAnswer(ctx) ?? respond(ctx, slots))
}

export const SCENARIO: Scenario<AbContext> = {
  product: 'awas-belanja',
  intents: INTENTS,
  fallback: (ctx) => routed(ctx) ?? bidderAnswer(ctx) ?? ({
    text: T(
      ctx.lang,
      'Maaf, saya belum menangkap maksudnya. Saya membantu pengawasan pengadaan: kewajaran HPS, peserta tender, jadwal, pola risiko, dan memo rekomendasi. Pilih salah satu saran di bawah, atau tulis ulang pertanyaannya.',
      'Sorry, I did not catch that. I help with procurement oversight: HPS fairness, bidders, schedules, risk patterns and recommendation memos. Pick one of the suggestions below, or rephrase the question.',
    ),
    followUps: ctx.world?.paket ? chips(ctx.lang, 'sum', 'hps', 'ring') : chips(ctx.lang, 'top', 'gap', 'due'),
  }),
}

registerScenario(SCENARIO)
