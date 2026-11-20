/**
 * Cek Berkas simulation scenario (spec §9.2): 14 intents with ID / EN / Basa Jawa examples. Every answer reads the
 * CekContext the page hands over (the document result on screen, the bansos batch and programme from the world,
 * the session counts), so numbers always match what the officer sees. Registered when the AskAi chunk loads.
 */
import type { Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import type { CekContext } from './model'
import { currentRegion } from '../../demo-kit/world'
import { swapFor, swapText } from './regional'

type Ctx = SimContext<CekContext>

const L = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const num = (n: number, lang: Lang) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')

const JAWA = /\b(kula|kulo|panjenengan|menapa|napa|nopo|kenging|punapa|pinten|piro|sing|endi|ingkang|sampun|dereng|durung|mboten|ora|niki|iki|kalih|wonten|ana|dhateng|marang|kok|kudu|kedah|badhe|arep|diowahi|dipunowahi|kembar|apa|opo)\b/gi
const looksJawa = (text: string) => (text.match(JAWA) ?? []).length >= 2

function w(ctx: Ctx): CekContext {
  const o = (ctx.world ?? {}) as Partial<CekContext>
  return {
    role: o.role === 'dinsos' ? 'dinsos' : 'perizinan',
    mode: o.mode === 'bulk' ? 'bulk' : 'single',
    doc: o.doc ?? null,
    batch: o.batch ?? { total: 0, lolos: 0, kurang: 0, ganda: 0, gandaPairs: 0, luarZona: 0, manual: 0, processed: false, zone: [], warnZone: null },
    program: o.program ?? null,
    session: o.session ?? { verified: 0, manual: 0 },
    region: o.region ?? '',
  }
}

const VERDICT: Record<string, { id: string; en: string }> = {
  lengkap: { id: 'Lengkap', en: 'Complete' },
  kurang: { id: 'Kurang', en: 'Incomplete' },
  'cek-manual': { id: 'Perlu Cek Manual', en: 'Needs manual check' },
}

const MISSING_IDS = new Set(['signature', 'stamp', 'validity', 'required', 'kk-attached', 'recent'])

/** a check label as the officer sees it (no lower-casing: "NIK" stays "NIK"); ID never says "field" */
const lbl = (label: string, lang: Lang) => (lang === 'id' ? label.replace(/\bfield\b/g, 'isian') : label)
/** NIK in an answer: area code and birth-date code readable, the serial masked */
const nikParts = (nik: string) => `${nik.slice(0, 6)} · ${nik.slice(6, 12)} · ••••`

function chips(lang: Lang, ...keys: ('why' | 'missing' | 'edited' | 'nik' | 'dup' | 'zone' | 'quota' | 'msg' | 'next')[]): string[] {
  const c = {
    why: L(lang, 'Kenapa hasilnya begitu?', 'Why this result?'),
    missing: L(lang, 'Apa yang kurang?', 'What is missing?'),
    edited: L(lang, 'Bagian mana yang diedit?', 'Which part was edited?'),
    nik: L(lang, 'Bagaimana NIK dicek?', 'How is the NIK checked?'),
    dup: L(lang, 'Berapa NIK ganda?', 'How many duplicate NIKs?'),
    zone: L(lang, 'Berapa pendaftar di luar zona?', 'How many applicants are outside the zone?'),
    quota: L(lang, 'Berapa kuota bansos banjir?', 'How big is the flood-aid quota?'),
    msg: L(lang, 'Apa yang harus disampaikan ke warga?', 'What should I tell the citizen?'),
    next: L(lang, 'Langkah selanjutnya apa?', 'What is the next step?'),
  }
  return keys.map((k) => c[k])
}

const noDoc = (lang: Lang): SimResponse => ({
  text: L(lang, 'Belum ada berkas yang selesai diperiksa di layar. Pilih spesimen di galeri lalu tekan “Verifikasi berkas”, nanti saya jelaskan hasilnya.', 'No file has finished checking on screen yet. Pick a specimen in the gallery and press “Verify file”, then I will explain the result.'),
  followUps: chips(lang, 'dup', 'quota', 'nik'),
})

function docCheck(c: CekContext): SimResponse['structured'] {
  const d = c.doc
  if (!d || !d.verdict) return undefined
  const edited = d.checks.some((x) => x.id === 'tamper' && x.status === 'fail')
  const status = edited ? 'diedit' : d.verdict === 'lengkap' ? 'lengkap' : 'kurang'
  const missing = d.checks.filter((x) => x.status !== 'ok' && MISSING_IDS.has(x.id)).map((x) => x.note ?? x.label)
  const notes = d.checks.filter((x) => x.status !== 'ok' && !MISSING_IDS.has(x.id)).map((x) => `${x.label}: ${x.note ?? ''}`.trim())
  return { kind: 'doc-check', data: { status, missing: missing.slice(0, 10), notes: (notes.length ? notes : d.reasons).slice(0, 6) } }
}

const step = (name: string, input: Record<string, unknown>, ms: number) => ({ name, input, ms })

/* ------------------------------------------------------------------ intents */

export const cekScenario: Scenario<CekContext> = {
  product: 'cek-berkas',
  threshold: 0.3,
  intents: [
    {
      id: 'explain-verdict',
      examples: [
        'kenapa hasilnya begitu', 'kenapa perlu cek manual', 'kenapa berkas ini ditolak', 'jelaskan hasil verifikasi', 'alasan hasil pemeriksaan', 'kenapa statusnya kurang',
        'why this result', 'why does it need a manual check', 'explain the verification result', 'why was this file flagged',
        'kenging menapa kedah dicek manual', 'napa kok berkas iki ora lolos', 'menapa asilipun mekaten',
      ],
      respond(ctx) {
        const c = w(ctx)
        const d = c.doc
        if (!d?.verdict) return noDoc(ctx.lang)
        const lang = ctx.lang
        const v = VERDICT[d.verdict]![lang]
        const fails = d.checks.filter((x) => x.status !== 'ok')
        const passed = d.checks.filter((x) => x.status === 'ok')
        const all = d.checks.map((x) => lbl(x.label, 'id')).join('; ')
        const allEn = d.checks.map((x) => x.label).join('; ')
        const id =
          d.verdict === 'lengkap'
            ? `${d.title}: hasilnya **${v}**. Semua ${d.checks.length} cek lolos: ${all}.`
            : `${d.title}: hasilnya **${v}** karena ${fails.length} dari ${d.checks.length} cek tidak lolos: ${fails.map((x) => `${lbl(x.label, 'id')}${x.note ? ` (${lbl(x.note, 'id')})` : ''}`).join('; ')}.${passed.length ? ` Yang lolos: ${passed.map((x) => lbl(x.label, 'id')).join('; ')}.` : ''}`
        const en =
          d.verdict === 'lengkap'
            ? `${d.title}: the result is **${v}**. All ${d.checks.length} checks passed: ${allEn}.`
            : `${d.title}: the result is **${v}** because ${fails.length} of ${d.checks.length} check${d.checks.length === 1 ? '' : 's'} failed: ${fails.map((x) => `${x.label}${x.note ? ` (${x.note})` : ''}`).join('; ')}.${passed.length ? ` Passed: ${passed.map((x) => x.label).join('; ')}.` : ''}`
        const base = L(lang, id, en) + L(lang, ' Temuan ini indikasi untuk petugas, bukan keputusan akhir.', ' This is an indication for the officer, not a final decision.')
        const jv = looksJawa(ctx.text)
        const out: SimResponse = {
          text: jv
            ? d.verdict === 'lengkap'
              ? `Berkas ${d.title} sampun lengkap, sedaya pamriksan lolos.`
              : `Berkas ${d.title} kedah dipun-cek malih: ${fails.map((x) => lbl(x.label, 'id')).join(', ')}.`
            : base,
          toolCalls: [step('check_documents', { documentId: d.id }, 340)],
          followUps: d.verdict === 'cek-manual' ? chips(lang, 'edited', 'msg', 'next') : d.verdict === 'kurang' ? chips(lang, 'missing', 'msg') : chips(lang, 'msg', 'dup'),
        }
        if (jv) out.translation = base
        const s = docCheck(c)
        if (s) out.structured = s
        return out
      },
    },
    {
      id: 'what-missing',
      examples: [
        'apa yang kurang', 'lampiran apa yang belum ada', 'dokumen apa yang harus dilengkapi', 'apa saja kekurangannya', 'berkas kurang apa',
        'what is missing', 'which attachment is missing', 'what does the citizen still need to bring',
        'apa sing kurang', 'napa ingkang dereng wonten', 'kurang napa berkase',
      ],
      respond(ctx) {
        const c = w(ctx)
        const d = c.doc
        const lang = ctx.lang
        if (!d?.verdict) return noDoc(lang)
        const miss = d.checks.filter((x) => x.status !== 'ok' && MISSING_IDS.has(x.id))
        const text = miss.length
          ? L(lang, `Yang kurang pada ${d.title}: ${miss.map((x) => x.note ?? x.label).join('; ')}. Minta warga melengkapi lalu periksa ulang.`, `Missing on ${d.title}: ${miss.map((x) => x.note ?? x.label).join('; ')}. Ask the citizen to complete it, then check again.`)
          : d.verdict === 'cek-manual'
            ? L(lang, `Tidak ada lampiran yang kurang pada ${d.title}. Masalahnya integritas data (lihat peta panas), jadi perlu cek manual, bukan dilengkapi.`, `Nothing is missing on ${d.title}. The issue is data integrity (see the heatmap), so it needs a manual check, not more attachments.`)
            : L(lang, `Tidak ada yang kurang: ${d.title} lengkap.`, `Nothing is missing: ${d.title} is complete.`)
        return { text, toolCalls: [step('check_documents', { documentId: d.id }, 260)], followUps: chips(lang, 'msg', 'next'), ...(docCheck(c) ? { structured: docCheck(c)! } : {}) }
      },
    },
    {
      id: 'tamper',
      examples: [
        'bagian mana yang diedit', 'apakah dokumen ini dipalsukan', 'jelaskan peta panas', 'tanda edit digital apa', 'area merah itu apa',
        'which part was edited', 'is this document forged', 'explain the heatmap', 'what are the signs of editing',
        'endi sing diowahi', 'menapa dokumen niki dipunowahi', 'bagian ingkang abang punika napa',
      ],
      respond(ctx) {
        const c = w(ctx)
        const d = c.doc
        const lang = ctx.lang
        if (!d?.verdict) return noDoc(lang)
        const pct = Math.round(d.tamperTop * 100)
        const text = d.tamperReasons.length
          ? L(lang, `Peta panas menandai ${d.tamperReasons.length} area dengan skor tertinggi ${pct}%: ${d.tamperReasons.join('; ')}. Bandingkan dengan dokumen asli di loket sebelum memutuskan.`, `The heatmap marks ${d.tamperReasons.length} area${d.tamperReasons.length === 1 ? '' : 's'}, top score ${pct}%: ${d.tamperReasons.join('; ')}. Compare with the original at the desk before deciding.`)
          : L(lang, `Tidak ada area mencurigakan pada ${d.title}; skor tertinggi peta panas hanya ${pct}% (derau pindaian biasa).`, `No suspicious area on ${d.title}; the heatmap's top score is only ${pct}% (ordinary scan noise).`)
        return { text, toolCalls: [step('tamper_scan', { documentId: d.id }, 410)], followUps: chips(lang, 'why', 'msg') }
      },
    },
    {
      id: 'nik',
      examples: [
        'bagaimana NIK dicek', 'format NIK benar tidak', 'arti angka NIK', 'kenapa tanggal lahir dicocokkan dengan NIK', 'cek NIK',
        'how is the NIK checked', 'is the NIK format valid', 'what do the NIK digits mean', 'birth date in the NIK',
        'NIK niki leres menapa', 'piye carane ngecek NIK',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const nik = c.doc?.fields.find((f) => f.key === 'nik')?.value
        const chk = c.doc?.checks.find((x) => x.id === 'nik-dob')
        const head = L(
          lang,
          'NIK 16 digit dibaca per bagian: 6 digit kode wilayah Kemendagri (provinsi, kabupaten, kecamatan), 6 digit tanggal lahir DDMMYY (perempuan: tanggal + 40), lalu 4 digit nomor urut.',
          'A 16-digit NIK is read in parts: 6 digits of Kemendagri area code (province, regency, district), 6 digits of birth date DDMMYY (women: day + 40), then a 4-digit serial.',
        )
        const tail = nik
          ? L(lang, ` Pada berkas ini: ${nikParts(nik)} (nomor urut disamarkan).${chk ? ` Hasil cek tanggal lahir: ${lbl(chk.note ?? chk.label, 'id')}.` : ''}`, ` On this file: ${nikParts(nik)} (serial masked).${chk ? ` Birth-date check: ${chk.note ?? chk.label}.` : ''}`)
          : ''
        return { text: head + tail + L(lang, ' Semua NIK di demo ini spesimen fiktif (nomor urut 9001–9999).', ' Every NIK in this demo is a fictional specimen (serial 9001–9999).'), followUps: chips(lang, 'dup', 'why') }
      },
    },
    {
      id: 'kk-match',
      examples: [
        'nama cocok dengan KK', 'apakah nama di KTP sama dengan KK', 'cek silang KK dan KTP', 'anggota keluarga siapa saja',
        'does the name match the family card', 'cross-check the family card and ID card', 'is she listed on the family card',
        'asmanipun sami kalih KK menapa', 'jeneng ing KK padha ora',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const chk = c.doc?.checks.find((x) => x.id === 'name-kk' || x.id === 'kk-attached')
        if (!c.doc?.verdict || !chk) return { text: swapText(L(lang, 'Cek silang nama dilakukan pada KTP yang punya KK di berkas yang sama. Verifikasi KTP Siti Nurjanah untuk melihatnya: namanya dicocokkan dengan anggota KK Mojosari.', 'The name cross-check runs on an ID card that has a family card in the same file. Verify Siti Nurjanah’s ID card to see it: her name is matched against the Mojosari family card.'), swapFor(currentRegion())), followUps: chips(lang, 'nik', 'why') }
        return { text: L(lang, `${chk.label}: ${chk.status === 'ok' ? 'cocok' : 'tidak cocok'}${chk.note ? ` (${chk.note})` : ''}.`, `${chk.label}: ${chk.status === 'ok' ? 'match' : 'no match'}${chk.note ? ` (${chk.note})` : ''}.`), toolCalls: [step('match_family_card', { documentId: c.doc.id }, 220)], followUps: chips(lang, 'why', 'msg') }
      },
    },
    {
      id: 'duplicates',
      examples: [
        'berapa NIK ganda', 'ada pendaftar dobel', 'NIK yang sama dipakai dua orang', 'data ganda bansos', 'siapa yang NIK-nya kembar',
        'how many duplicate NIKs', 'are there double applicants', 'same NIK used twice', 'duplicate records in the aid list',
        'pinten NIK ingkang kembar', 'ana NIK kembar ora', 'wonten pendaftar dobel menapa',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const b = c.batch
        const base = b.processed
          ? L(lang, `Dari ${num(b.total, lang)} berkas pendaftar bansos banjir ada **${b.gandaPairs} pasang NIK ganda** (${b.ganda} berkas). Di mode Massal kartunya dihubungkan garis merah.`, `Of ${num(b.total, lang)} flood-aid applicant files there are **${b.gandaPairs} duplicate-NIK pairs** (${b.ganda} files). In Bulk mode their cards are joined by red lines.`)
          : L(lang, `Pemeriksaan massal belum dijalankan. Data pendaftar sudah memuat ${b.gandaPairs} pasang NIK yang sama; jalankan “Proses ${num(b.total, lang)} berkas” di mode Massal untuk melihat kartunya terhubung.`, `The bulk check has not run yet. The applicant data already holds ${b.gandaPairs} NIK-sharing pairs; run “Process ${num(b.total, lang)} files” in Bulk mode to see their cards connected.`)
        const jv = looksJawa(ctx.text)
        const jvText = b.processed
          ? `Saking ${b.total} berkas pendaftar bansos banjir wonten ${b.gandaPairs} pasang NIK kembar (${b.ganda} berkas). Ing mode Massal kertunipun dipungandeng garis abrit.`
          : `Pamriksan massal dereng dipunlampahi. Data pendaftar sampun ngemot ${b.gandaPairs} pasang NIK ingkang sami; lampahaken “Proses ${b.total} berkas” ing mode Massal supados kertunipun ketingal gandheng.`
        const out: SimResponse = { text: jv ? jvText : base, toolCalls: [step('dedupe_nik', { program: 'bansos-banjir', files: b.total }, 380)], followUps: chips(lang, 'zone', 'quota') }
        if (jv) out.translation = base
        return out
      },
    },
    {
      id: 'outside-zone',
      examples: [
        'berapa pendaftar di luar zona', 'alamat di luar zona banjir', 'siapa yang tidak terdampak', 'cek alamat dengan peta bencana', 'zona terdampak mana saja',
        'how many applicants are outside the zone', 'addresses outside the flood zone', 'cross-check with the disaster map', 'which districts are affected',
        'pinten ingkang wonten njawi zona', 'omahe ora kebanjiran',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const b = c.batch
        const zone = b.zone.join(', ')
        const warn = b.warnZone?.join(', ')
        return {
          text: L(lang, `${b.luarZona} dari ${b.total} pendaftar beralamat di luar zona acuan (${zone}). ${warn ? `Zona acuan = kecamatan peringatan Siaga Wilayah (${warn}) ditambah peta rawan banjir skenario.` : 'Belum ada peringatan aktif, jadi acuannya peta rawan banjir skenario.'} Mereka perlu verifikasi lapangan sebelum ditetapkan; kekurangan lampiran mereka tetap tercatat terpisah.`, `${b.luarZona} of ${b.total} applicants live outside the reference zone (${zone}). ${warn ? `Reference zone = the Siaga Wilayah warning districts (${warn}) plus the scenario flood-risk map.` : 'No warning is active, so the reference is the scenario flood-risk map.'} They need a field check before approval; any missing attachment is still recorded separately.`),
          toolCalls: [step('geo_check', { zone: b.zone, files: b.total }, 300)],
          followUps: chips(lang, 'dup', 'quota'),
        }
      },
    },
    {
      id: 'quota',
      examples: [
        'berapa kuota bansos banjir', 'program bansos sudah dibuka', 'kuota masih cukup', 'kapan pendaftaran bansos dibuka',
        'how big is the flood aid quota', 'is the aid programme open', 'is there quota left', 'when did registration open',
        'kuota bansos pinten', 'bansos sampun dibuka dereng',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const p = c.program
        if (!p) return { text: L(lang, 'Program bansos banjir belum dibuka. Kuota dibuka otomatis begitu Siaga Wilayah mengirim peringatan banjir; zona dan kuotanya ikut peringatan itu.', 'The flood-aid programme is not open yet. The quota opens automatically once Siaga Wilayah sends a flood warning; its zone and quota follow that warning.'), followUps: chips(lang, 'dup', 'zone') }
        const lolos = c.batch.processed ? c.batch.lolos : null
        return {
          text: L(lang, `Kuota bansos banjir ${num(p.quota, lang)} KK untuk ${p.kecamatan.join(', ')}, dibuka ${p.openedAt} WIB.${lolos !== null ? ` Saat ini ${lolos} berkas lolos, sisa kuota ${num(Math.max(0, p.quota - lolos), lang)} KK.` : ''} Angka kuota simulasi.`, `The flood-aid quota is ${num(p.quota, lang)} households for ${p.kecamatan.join(', ')}, opened ${p.openedAt} WIB.${lolos !== null ? ` ${lolos} files passed so far, ${num(Math.max(0, p.quota - lolos), lang)} households of quota left.` : ''} Simulated quota figures.`),
          followUps: chips(lang, 'zone', 'dup'),
        }
      },
    },
    {
      id: 'requirements',
      examples: [
        'syarat bansos banjir apa saja', 'dokumen apa yang dibutuhkan untuk bansos', 'persyaratan pendaftaran', 'syarat daftar bantuan banjir',
        'what are the requirements for flood aid', 'which documents are needed', 'registration requirements',
        'syarate bansos napa mawon', 'butuh berkas apa wae',
      ],
      respond(ctx) {
        const lang = ctx.lang
        return {
          text: L(lang, 'Berkas pendaftar bansos banjir di demo ini: KTP-el, Kartu Keluarga, surat keterangan domisili (berlaku 6 bulan) dan foto rumah terdampak bergeotag yang diambil ≤ 7 hari. Alamat harus di dalam zona terdampak dari Siaga Wilayah, dan satu NIK hanya boleh terdaftar sekali.', 'Flood-aid applicant files in this demo: e-ID card, family card, a residence certificate (valid 6 months) and a geotagged photo of the affected house taken ≤ 7 days ago. The address must be inside the Siaga Wilayah affected zone, and one NIK may register only once.'),
          followUps: chips(lang, 'quota', 'dup'),
        }
      },
    },
    {
      id: 'citizen-message',
      examples: [
        'apa yang harus disampaikan ke warga', 'buatkan pesan untuk pemohon', 'kalimat untuk warga', 'tolong tulis balasan ke pemohon',
        'what should I tell the citizen', 'draft a message to the applicant', 'write a reply to the citizen',
        'matur dhateng warga pripun', 'piye ngomong marang warga',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const d = c.doc
        if (!d?.verdict) return noDoc(lang)
        const miss = d.checks.filter((x) => x.status !== 'ok' && MISSING_IDS.has(x.id)).map((x) => x.note ?? x.label)
        const text =
          d.verdict === 'lengkap'
            ? L(lang, `“Bapak/Ibu, berkas ${d.title} sudah lengkap dan lolos pemeriksaan. Permohonan Anda kami teruskan; status bisa dipantau lewat Sapa Warga.”`, `“Sir/Madam, your ${d.title} is complete and passed the check. We are forwarding your application; you can follow its status in Sapa Warga.”`)
            : d.verdict === 'kurang'
              ? L(lang, `“Bapak/Ibu, berkas Anda hampir lengkap. Mohon lengkapi: ${miss.join('; ')}. Setelah itu berkas langsung kami periksa ulang.”`, `“Sir/Madam, your file is almost complete. Please add: ${miss.join('; ')}. We will re-check it right away.”`)
              : L(lang, '“Bapak/Ibu, ada bagian berkas yang perlu kami cocokkan dengan dokumen asli. Mohon membawa dokumen aslinya ke loket; ini pemeriksaan rutin, bukan penolakan.”', '“Sir/Madam, part of your file needs to be matched with the original document. Please bring the original to the desk; this is a routine check, not a rejection.”')
        return { text, followUps: chips(lang, 'why', 'next') }
      },
    },
    {
      id: 'privacy',
      examples: [
        'apakah dokumen disimpan', 'data saya aman tidak', 'unggahan dikirim ke mana', 'apakah ini dokumen asli',
        'is my document stored', 'is the data safe', 'where does the upload go', 'are these real documents',
        'dokumen kula dipunsimpen menapa', 'datane aman ora',
      ],
      respond(ctx) {
        const lang = ctx.lang
        return {
          text: L(lang, 'Semua dokumen di galeri adalah SPESIMEN fiktif bertanda air. Unggahan sendiri hanya ada di mode Live, setelah persetujuan: gambar dikirim lewat proxy GAMADA, dibaca AI, lalu dibuang tanpa disimpan dan isinya tidak dicatat di log.', 'Every gallery document is a watermarked fictional SPECIMEN. Uploading your own exists only in Live mode, after consent: the image goes through the GAMADA proxy, is read by the AI, then discarded without being stored, and its content is not logged.'),
          followUps: chips(lang, 'nik', 'why'),
        }
      },
    },
    {
      id: 'session-stats',
      examples: [
        'berapa berkas sudah diperiksa', 'rekap hari ini', 'berapa yang perlu cek manual', 'statistik verifikasi',
        'how many files have been checked', 'summary of today', 'how many need a manual check',
        'pinten berkas ingkang sampun dipunpriksa',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const b = c.batch
        return {
          text: L(lang, `Sesi ini: ${c.session.verified} berkas tunggal diperiksa, ${c.session.manual} perlu cek manual.${b.processed ? ` Massal: ${b.total} berkas, ${b.lolos} lolos tanpa temuan, ${b.kurang} kurang lampiran, ${b.ganda} NIK ganda, ${b.luarZona} luar zona; ${b.manual} berkas perlu cek manual (NIK ganda atau luar zona). Satu berkas bisa punya lebih dari satu temuan.` : ' Pemeriksaan massal belum dijalankan.'}`, `This session: ${c.session.verified} single files checked, ${c.session.manual} need a manual check.${b.processed ? ` Bulk: ${b.total} files, ${b.lolos} passed with no finding, ${b.kurang} missing an attachment, ${b.ganda} duplicate NIK, ${b.luarZona} outside the zone; ${b.manual} files need a manual check (duplicate NIK or outside the zone). One file can carry more than one finding.` : ' The bulk check has not run yet.'}`),
          followUps: chips(lang, 'dup', 'zone'),
        }
      },
    },
    {
      id: 'confidence',
      examples: [
        'kenapa keyakinan rendah', 'field mana yang perlu dicek', 'apa arti persentase keyakinan', 'OCR kurang yakin',
        'why is the confidence low', 'which fields should I double-check', 'what does the confidence percentage mean',
        'kenging menapa yakinipun asor',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const d = c.doc
        if (!d?.verdict) return noDoc(lang)
        const low = d.fields.filter((f) => f.confidence < 0.85)
        return {
          text: low.length
            ? L(lang, `${low.length} isian di bawah 85%: ${low.map((f) => `${f.label} ${Math.round(f.confidence * 100)}%`).join(', ')}. Penyebabnya pindaian miring, tulisan tangan/cap, atau area yang diedit; cocokkan isian itu dengan dokumen asli.`, `${low.length} field${low.length === 1 ? '' : 's'} under 85%: ${low.map((f) => `${f.label} ${Math.round(f.confidence * 100)}%`).join(', ')}. Causes: a tilted scan, handwriting/stamps, or an edited area; match those fields against the original.`)
            : L(lang, `Semua ${d.fields.length} isian terbaca di atas 85%. Persentase adalah keyakinan OCR per isian; di bawah 85% diberi tanda “periksa”.`, `All ${d.fields.length} fields read above 85%. The percentage is the OCR confidence per field; under 85% gets a “check” tag.`),
          followUps: chips(lang, 'why', 'edited'),
        }
      },
    },
    {
      id: 'next-step',
      examples: [
        'langkah selanjutnya apa', 'lalu saya harus apa', 'bagaimana menindaklanjuti', 'apa yang dilakukan petugas',
        'what is the next step', 'what should I do now', 'how do I follow up',
        'salajengipun kedah menapa', 'banjur kudu piye',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const d = c.doc
        const dinsos = c.role === 'dinsos'
        if (!d?.verdict) {
          return { text: dinsos ? L(lang, 'Jalankan pemeriksaan massal 50 pendaftar, saring yang NIK ganda dan luar zona, lalu ekspor CSV untuk verifikasi lapangan.', 'Run the bulk check of the 50 applicants, filter the duplicate-NIK and outside-zone files, then export the CSV for field checks.') : L(lang, 'Pilih berkas di galeri dan verifikasi; hasilnya menentukan langkah berikutnya.', 'Pick a file in the gallery and verify it; the result decides the next step.'), followUps: chips(lang, 'dup', 'quota') }
        }
        const text =
          d.verdict === 'lengkap'
            ? dinsos ? L(lang, 'Masukkan ke daftar calon penerima dan cocokkan dengan kuota program.', 'Add it to the candidate list and match it against the programme quota.') : L(lang, 'Teruskan permohonan ke proses penerbitan; status otomatis terkirim ke warga.', 'Forward the application for issuing; the status goes to the citizen automatically.')
            : d.verdict === 'kurang'
              ? L(lang, 'Kembalikan ke warga dengan daftar kekurangan, lalu periksa ulang begitu dilengkapi.', 'Return it to the citizen with the list of what is missing, then re-check once complete.')
              : L(lang, 'Tahan berkas, minta dokumen asli, dan catat temuan peta panas di catatan pemeriksaan. Jangan menolak hanya berdasarkan indikasi AI.', 'Hold the file, ask for the original document, and note the heatmap finding. Do not reject on the AI indication alone.')
        return { text, followUps: chips(lang, 'msg', 'why') }
      },
    },
    {
      id: 'dukcapil-scope',
      examples: [
        'apakah NIK terdaftar di Dukcapil', 'apakah NIK ini terdaftar di Dukcapil pusat siapa ibunya', 'cek NIK ke Dukcapil pusat', 'NIK terdaftar di Dukcapil atau tidak', 'cek ke database Dukcapil', 'terhubung ke SIAK Dukcapil', 'siapa ibunya', 'siapa nama ibu kandungnya', 'siapa orang tuanya', 'alamat lengkap pemohon', 'nomor HP pemohon', 'data keluarga lengkap pemohon',
        'is the NIK registered with Dukcapil', 'is this NIK registered in the Dukcapil database who is the mother', 'check the NIK against Dukcapil', 'check against the civil registry', 'who is the mother', 'mother maiden name', 'full address of the applicant', 'family data of the applicant', 'connected to SIAK Dukcapil',
        'NIK niki kadhaftar ing Dukcapil', 'sinten ibunipun',
      ],
      respond(ctx) {
        const lang = ctx.lang
        return {
          text: L(
            lang,
            'Demo ini **tidak terhubung ke Dukcapil/SIAK** dan semua NIK di sini spesimen fiktif, jadi saya tidak bisa memastikan NIK terdaftar. Saya juga tidak membuka data keluarga (nama ibu, orang tua) atau alamat lengkap: asisten hanya membaca hasil pemeriksaan di layar. Di penerapan nyata, cek NIK dilakukan lewat layanan Dukcapil sesuai perjanjian kerja sama, dengan hak akses per petugas dan setiap akses tercatat di log audit.',
            'This demo is **not connected to Dukcapil/SIAK** and every NIK here is a fictional specimen, so I cannot confirm a NIK is registered. I also do not open family data (mother’s name, parents) or full addresses: the assistant only reads the check result on screen. In a real deployment the NIK check runs through the Dukcapil service under a cooperation agreement, with per-officer access rights and every access written to the audit log.',
          ),
          followUps: chips(lang, 'nik', 'why'),
        }
      },
    },
    {
      // data residency + retention: answered before (and instead of) the service-time intent ("berapa lama disimpan")
      id: 'data-handling',
      examples: [
        'data KTP ini disimpan di server mana dan berapa lama', 'disimpan di server mana', 'data disimpan di mana', 'berapa lama data disimpan', 'retensi data berapa lama', 'kapan data dihapus',
        'server dan pusat data di mana', 'apakah data disimpan di cloud', 'dokumen diproses di server mana', 'penyimpanan data warga', 'apakah log akses bisa diekspor', 'data diproses di PDN atau server daerah',
        'where is this ID card data stored and for how long', 'where is the data stored', 'how long is the data kept', 'data retention period', 'which server processes the documents', 'is the data stored in the cloud', 'when is the data deleted', 'can the access log be exported',
        'data dipunsimpen wonten pundi', 'suwene data disimpen',
      ],
      respond(ctx) {
        const lang = ctx.lang
        return {
          text: L(
            lang,
            '**Di demo ini** dokumen galeri adalah spesimen yang dibaca di peramban Anda; tidak ada yang diunggah atau disimpan di server. Log audit demo hanya ada di peramban ini (simulasi). **Di penerapan nyata** (rancangan, ditetapkan bersama Pemda): dokumen diproses di server Pemda atau Pusat Data Nasional sesuai kebijakan daerah, tidak di layanan AI publik; masa simpan mengikuti jadwal retensi arsip daerah; setiap akses petugas tercatat di log audit yang hanya bisa ditambah dan bisa diekspor untuk inspektorat. Saya tidak menyebut angka retensi karena itu keputusan Pemda, bukan bawaan produk.',
            '**In this demo** the gallery documents are specimens read in your browser; nothing is uploaded or stored on a server. The demo audit log exists only in this browser (simulated). **In a real deployment** (a design to be agreed with the local government): documents are processed on the local government’s servers or the National Data Centre (PDN) under its policy, not on a public AI service; retention follows the regional records-retention schedule; every officer access is written to an append-only audit log that can be exported for the inspectorate. I do not quote a retention period because that is the local government’s decision, not a product default.',
          ),
          followUps: chips(lang, 'nik', 'why'),
        }
      },
    },
    {
      id: 'wait-time',
      examples: [
        'berapa lama warga harus menunggu', 'berapa lama proses izinnya', 'kapan izin selesai', 'lama menunggu di loket berapa hari', 'kapan izinnya terbit', 'berapa lama antre layanan',
        'how long does the citizen have to wait', 'how long does the permit take', 'when will the permit be done', 'how many days until the permit',
        'pinten dinten nengga', 'suwene piro',
      ],
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const d = c.doc
        const now = L(lang, 'Pemeriksaan otomatisnya sendiri hanya beberapa detik per berkas (di layar ini ±2 dtk).', 'The automatic check itself takes a few seconds per file (about 2 s on this screen).')
        const next = !d?.verdict
          ? ''
          : d.verdict === 'lengkap'
            ? L(lang, ' Berkas ini lengkap, jadi langsung bisa diteruskan ke proses penerbitan.', ' This file is complete, so it can go straight on to issuing.')
            : d.verdict === 'kurang'
              ? L(lang, ' Berkas ini kurang lampiran: begitu warga melengkapinya, pemeriksaan ulang juga hanya beberapa detik.', ' This file is missing an attachment: once the citizen adds it, the re-check also takes seconds.')
              : L(lang, ' Berkas ini perlu dicocokkan dengan dokumen asli oleh petugas; lamanya tergantung kapan warga membawa aslinya.', ' This file has to be matched with the original by an officer; how long depends on when the citizen brings it.')
        const tail = L(lang, ' Lama layanan setelah itu mengikuti SOP dan standar pelayanan loket; demo ini tidak menetapkan angkanya.', ' Service time after that follows the desk’s SOP and service standard; this demo does not set those figures.')
        return { text: now + next + tail, followUps: chips(lang, 'msg', 'next') }
      },
    },
  ],
  fallback(ctx) {
    const lang = ctx.lang
    return {
      text: L(lang, 'Pertanyaan itu di luar hasil pemeriksaan yang saya baca, jadi saya tidak mau menebak. Saya bisa menjelaskan kelengkapan, NIK, KK, peta panas, NIK ganda, dan zona bansos. Coba salah satu pertanyaan ini:', 'That question is outside the check result I can read, so I will not guess. I can explain completeness, NIK, family card, heatmap, duplicate NIKs and the aid zone. Try one of these:'),
      followUps: chips(lang, 'why', 'dup', 'quota'),
    }
  },
}
