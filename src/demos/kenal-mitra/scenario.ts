/**
 * Kenal Mitra simulation scenario ("Tanya alasan"): 11 intents + fallback. Every answer is built from the case on
 * screen (model.ts reasonCtx: the checks that passed / failed, the score, the decision, the CV shortlist with
 * anonymised refs), so no two answers read the same and every number matches the screen. Registered by Reasons.tsx.
 */
import type { Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import type { ReasonCtx } from './model'

type Ctx = SimContext<ReasonCtx>
const L = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const w = (ctx: Ctx): ReasonCtx => (ctx.world && typeof ctx.world === 'object' ? ctx.world : { kind: null })

export const CHIP_IDS = ['why-review', 'why-reject', 'what-checked', 'liveness-how', 'data-stored', 'kyb-docs-needed', 'badge-meaning', 'cv-why-rank', 'cv-blind', 'cv-bias', 'next-step'] as const
export type ChipId = (typeof CHIP_IDS)[number]
const CHIP: Record<ChipId, [string, string]> = {
  'why-review': ['Kenapa perlu ditinjau?', 'Why does it need a review?'],
  'why-reject': ['Kapan pengajuan ditolak?', 'When is an application rejected?'],
  'what-checked': ['Apa saja yang dicek?', 'What was checked?'],
  'liveness-how': ['Bagaimana uji liveness bekerja?', 'How does the liveness test work?'],
  'data-stored': ['Data apa yang disimpan?', 'What data is stored?'],
  'kyb-docs-needed': ['Dokumen KYB apa yang wajib?', 'Which KYB documents are required?'],
  'badge-meaning': ['Apa arti lencana Terverifikasi?', 'What does the Verified badge mean?'],
  'cv-why-rank': ['Kenapa urutan kandidat begini?', 'Why are the candidates in this order?'],
  'cv-blind': ['Apa itu penilaian buta?', 'What is blind screening?'],
  'cv-bias': ['Bagaimana mencegah bias?', 'How is bias prevented?'],
  'next-step': ['Langkah selanjutnya apa?', 'What is the next step?'],
}
const chips = (lang: Lang, ...ids: ChipId[]) => ids.map((i) => CHIP[i][lang === 'id' ? 0 : 1])
const caseName = (c: ReasonCtx, lang: Lang) => (c.code ? `${c.code}${c.subject ? ` (${c.subject})` : ''}` : L(lang, 'kasus ini', 'this case'))
const failed = (c: ReasonCtx) => (c.checks ?? []).filter((x) => !x.ok)
const passed = (c: ReasonCtx) => (c.checks ?? []).filter((x) => x.ok)
const list = (xs: NonNullable<ReasonCtx['checks']>, lang: Lang) => xs.map((x) => `${x.label[lang]}${x.note ? ` (${x.note[lang]})` : ''}`).join('; ')
const DEC: Record<string, [string, string]> = { setujui: ['Setujui', 'Approve'], tinjau: ['Tinjau', 'Review'], tolak: ['Tolak', 'Reject'], lolos: ['Lolos', 'Passed'], 'cek-manual': ['Perlu cek manual', 'Needs manual check'] }
const dec = (d: string | undefined, lang: Lang) => (d ? (DEC[d]?.[lang === 'id' ? 0 : 1] ?? d) : '—')
const noCase = (lang: Lang): SimResponse => ({
  text: L(lang, 'Belum ada kasus yang terbuka. Buka satu permintaan di lajur KYC, KYB atau Kandidat; jawaban saya memakai hasil pemeriksaan kasus itu.', 'No case is open yet. Open a request in the KYC, KYB or Candidates lane; my answers use that case’s checks.'),
  followUps: chips(lang, 'data-stored', 'badge-meaning'),
})
const ex = (id: ChipId, more: string[]) => [CHIP[id][0], CHIP[id][1], ...more]

export const kmScenario: Scenario<ReasonCtx> = {
  product: 'kenal-mitra',
  threshold: 0.3,
  intents: [
    {
      id: 'why-review',
      examples: ex('why-review', ['kenapa harus ditinjau', 'mengapa disarankan tinjau', 'kenapa tidak langsung disetujui', 'why review', 'why not approved right away', 'kenapa perlu cek manual', 'why manual check']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        if (!c.kind) return noCase(lang)
        if (c.kind === 'cv') return { text: L(lang, `Penyaringan ${c.code ?? ''} tidak memakai status tinjau: kandidat yang lolos kriteria diurutkan menurut kecocokan, lalu HR mewawancarai 10 teratas.`, `Screening for ${c.code ?? ''} has no review status: candidates who meet the criteria are ranked by fit, then HR interviews the top 10.`), followUps: chips(lang, 'cv-why-rank', 'cv-bias') }
        const f = failed(c)
        if (!c.checks?.length) return { text: L(lang, `${caseName(c, lang)} belum selesai dibaca. Jalankan pemeriksaannya dulu; alasan muncul dari cek yang gagal.`, `${caseName(c, lang)} has not been read yet. Run the checks first; the reasons come from the checks that fail.`), followUps: chips(lang, 'what-checked') }
        const scoreLine = c.kind === 'kyc' ? L(lang, `skor risiko ${c.score} (simulasi)`, `risk score ${c.score} (simulated)`) : L(lang, `skor KYB ${c.score} (simulasi)`, `KYB score ${c.score} (simulated)`)
        const text = f.length
          ? L(lang, `${caseName(c, lang)} disarankan **${dec(c.decision, lang)}** karena ${f.length} dari ${c.checks.length} cek tidak lolos: ${list(f, lang)}. Hasilnya ${scoreLine}.`, `${caseName(c, lang)} is marked **${dec(c.decision, lang)}** because ${f.length} of ${c.checks.length} checks failed: ${list(f, lang)}. That gives a ${scoreLine}.`)
          : L(lang, `${caseName(c, lang)} tidak perlu ditinjau: ${c.checks.length} cek lolos semua, ${scoreLine}, saran **${dec(c.decision, lang)}**.`, `${caseName(c, lang)} needs no review: all ${c.checks.length} checks passed, ${scoreLine}, suggestion **${dec(c.decision, lang)}**.`)
        return { text: text + L(lang, ' Keputusan akhir tetap di analis.', ' The final decision stays with the analyst.'), followUps: chips(lang, 'what-checked', 'next-step') }
      },
    },
    {
      id: 'why-reject',
      examples: ex('why-reject', ['kapan ditolak', 'aturan penolakan', 'berapa skor untuk tolak', 'when rejected', 'rejection rule', 'kenapa ditolak']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        if (c.kind === 'kyb')
          return { text: L(lang, `KYB tidak pernah menolak otomatis. ${caseName(c, lang)} lolos bila skor ≥ 80 tanpa isian beda; selain itu **perlu cek manual** (kunjungan petugas). Skor sekarang ${c.score ?? '—'} (simulasi).`, `KYB never rejects automatically. ${caseName(c, lang)} passes at a score ≥ 80 with no mismatched field; otherwise it **needs a manual check** (a field visit). The score now is ${c.score ?? '—'} (simulated).`), followUps: chips(lang, 'kyb-docs-needed', 'next-step') }
        const gap = c.score != null ? Math.max(0, 70 - c.score) : null
        return {
          text: L(lang, `Aturan KYC (simulasi): risiko = 10 + 45 bila dokumen diedit + 8 per isian beda + 30 bila liveness gagal + 15 bila alamat > 5 km. Di bawah 30 setujui, 30–69 tinjau, mulai 70 **tolak**. ${c.kind === 'kyc' ? `${caseName(c, lang)} ada di ${c.score}, ${gap ? `${gap} poin di bawah batas tolak` : 'sudah di atas batas tolak'}.` : ''}`, `KYC rule (simulated): risk = 10 + 45 if the document was edited + 8 per mismatched field + 30 if liveness fails + 15 if the address is > 5 km away. Under 30 approve, 30–69 review, from 70 **reject**. ${c.kind === 'kyc' ? `${caseName(c, lang)} is at ${c.score}, ${gap ? `${gap} points under the reject line` : 'already above the reject line'}.` : ''}`).trim(),
          followUps: chips(lang, 'why-review', 'liveness-how'),
        }
      },
    },
    {
      id: 'what-checked',
      examples: ex('what-checked', ['apa yang diperiksa', 'cek apa saja', 'daftar pemeriksaan', 'what checks', 'what did you check', 'which checks ran']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        if (!c.kind) return noCase(lang)
        if (c.kind === 'cv') return { text: L(lang, `Kriteria ${c.code}: ${(c.criteria ?? []).join('; ')}. Corong: ${(c.funnel ?? []).join(' → ')} CV.`, `Criteria for ${c.code}: ${(c.criteria ?? []).join('; ')}. Funnel: ${(c.funnel ?? []).join(' → ')} CVs.`), followUps: chips(lang, 'cv-why-rank', 'cv-blind') }
        if (!c.checks?.length) return { text: L(lang, `${caseName(c, lang)} belum dibaca, jadi belum ada hasil cek.`, `${caseName(c, lang)} has not been read, so there are no check results yet.`), followUps: chips(lang, 'next-step') }
        const p = passed(c)
        const f = failed(c)
        return {
          text: L(lang, `Untuk ${caseName(c, lang)}: lolos ${p.length} (${p.map((x) => x.label.id).join(', ')})${f.length ? `; gagal ${f.length} (${list(f, 'id')})` : ''}.`, `For ${caseName(c, lang)}: ${p.length} passed (${p.map((x) => x.label.en).join(', ')})${f.length ? `; ${f.length} failed (${list(f, 'en')})` : ''}.`),
          followUps: chips(lang, f.length ? 'why-review' : 'next-step', 'data-stored'),
        }
      },
    },
    {
      id: 'liveness-how',
      examples: ex('liveness-how', ['uji liveness itu apa', 'cara kerja liveness', 'kedip dan toleh', 'what is liveness', 'how is liveness detected', 'blink and turn']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const own = c.kind === 'kyc' ? L(lang, ` Untuk ${caseName(c, lang)}: ${c.liveness ? 'lolos (simulasi)' : 'belum dijalankan'}.`, ` For ${caseName(c, lang)}: ${c.liveness ? 'passed (simulated)' : 'not run yet'}.`) : ''
        return { text: L(lang, `Nasabah diminta mengedipkan mata lalu menoleh ke kiri; titik-titik wajah harus bergerak seperti orang sungguhan, bukan foto yang ditempel. Di demo ini ujinya disimulasikan dan wajah tidak pernah dikirim.${own}`, `The customer blinks, then turns their head left; the face landmarks must move like a live person, not a printed photo. In this demo the test is simulated and the face is never sent.${own}`), followUps: chips(lang, 'data-stored', 'why-reject') }
      },
    },
    {
      id: 'data-stored',
      examples: ex('data-stored', ['apa yang disimpan', 'apakah foto dikirim', 'privasi data', 'what is saved', 'is the photo uploaded', 'data privacy', 'kamera dikirim ke mana']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        return { text: L(lang, `Semua dokumen di sini SPESIMEN fiktif. Foto KTP, swafoto dan kamera diproses di browser Anda dan tidak diunggah ke mana pun; yang dicatat dunia demo hanya hasilnya (nomor permintaan, keputusan, skor)${c.code ? `, misalnya untuk ${c.code}` : ''}, dan hanya di peramban ini.`, `Every document here is a fictional SPECIMEN. The ID photo, the selfie and the camera are processed in your browser and never uploaded; the demo world records only the outcome (request number, decision, score)${c.code ? `, e.g. for ${c.code}` : ''}, and only in this browser.`), followUps: chips(lang, 'liveness-how', 'badge-meaning') }
      },
    },
    {
      id: 'kyb-docs-needed',
      examples: ex('kyb-docs-needed', ['dokumen apa untuk kyb', 'syarat verifikasi usaha', 'perlu akta tidak', 'documents for kyb', 'business verification requirements', 'is a deed needed']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const who = c.kind === 'kyb' ? L(lang, ` ${caseName(c, lang)} memakai set ini.`, ` ${caseName(c, lang)} uses this set.`) : ''
        return { text: L(lang, `KYB membaca NIB (dengan KBLI), kartu NPWP, akta pendirian khusus CV/PT, dan foto lokasi usaha dengan GPS. Nama usaha, pemilik, alamat dan KBLI disilangkan antar-dokumen, lalu GPS foto dibandingkan dengan alamat NIB.${who}`, `KYB reads the NIB (with its KBLI), the tax ID card, the deed of establishment for CV/PT only, and a site photo with GPS. Business name, owner, address and KBLI are cross-checked across documents, then the photo GPS is compared with the NIB address.${who}`), followUps: chips(lang, 'badge-meaning', 'why-reject') }
      },
    },
    {
      id: 'badge-meaning',
      examples: ex('badge-meaning', ['arti terverifikasi', 'lencana katalog lokal', 'apa gunanya lencana', 'verified badge', 'what is the badge for', 'katalog lokal badge']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const own = c.kind === 'kyb' && c.decided ? L(lang, ` ${caseName(c, lang)} sudah diputuskan: ${dec(c.decision, lang)}.`, ` ${caseName(c, lang)} is decided: ${dec(c.decision, lang)}.`) : ''
        return { text: L(lang, `Lencana **Terverifikasi** berarti KYB lolos: dokumen saling cocok dan lokasi usaha sesuai. Katalog Lokal menaruh pemasok terverifikasi di urutan atas, TenderPilot mencentang syarat KYB, dan Rapor Usaha menambah faktor KYB (keduanya demo tahap 4).${own}`, `The **Verified** badge means KYB passed: the documents agree and the site matches. Katalog Lokal ranks verified suppliers first, TenderPilot ticks the KYB requirement and Rapor Usaha adds the KYB factor (both stage 4 demos).${own}`), followUps: chips(lang, 'kyb-docs-needed', 'next-step') }
      },
    },
    {
      id: 'cv-why-rank',
      examples: ex('cv-why-rank', ['kenapa kandidat ini teratas', 'urutan shortlist', 'alasan peringkat', 'why this ranking', 'why is this candidate first', 'ranking reasons']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const top = c.top ?? []
        if (c.kind !== 'cv' || !top.length) return { text: L(lang, 'Belum ada shortlist. Buka tab Kandidat, unggah 200 CV contoh, lalu tekan “Saring”.', 'No shortlist yet. Open the Candidates tab, upload the 200 sample CVs, then press “Screen”.'), followUps: chips(lang, 'cv-blind', 'cv-bias') }
        const lines = top.slice(0, 3).map((x, i) => `#${i + 1} ${x.ref} ${x.fit}: ${x.reason[lang]}`).join('; ')
        return { text: L(lang, `Urutan = skor kecocokan (simulasi) dari pendidikan, jurusan, keahlian relevan dan pengalaman; skor sama diurutkan menurut kode. ${lines}.`, `Order = fit score (simulated) from education, major, relevant skills and experience; equal scores are ordered by code. ${lines}.`), followUps: chips(lang, 'cv-blind', 'cv-bias') }
      },
    },
    {
      id: 'cv-blind',
      examples: ex('cv-blind', ['sembunyikan nama', 'mode buta', 'blind mode', 'hide names', 'penilaian tanpa nama']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const st = c.kind === 'cv' ? L(lang, ` Sekarang mode buta ${c.blind ? 'aktif' : 'mati'} untuk ${c.code}.`, ` Blind mode is ${c.blind ? 'on' : 'off'} for ${c.code} now.`) : ''
        return { text: L(lang, `Penilaian buta mengganti nama dan foto dengan kode (misalnya Kandidat K-0147) supaya HR membaca kompetensi dulu. Urutannya tidak berubah karena nama memang tidak pernah dipakai menghitung.${st}`, `Blind screening replaces names and photos with codes (e.g. Candidate K-0147) so HR reads skills first. The order does not change, because the name is never used in the score.${st}`), followUps: chips(lang, 'cv-bias', 'cv-why-rank') }
      },
    },
    {
      id: 'cv-bias',
      examples: ex('cv-bias', ['apakah adil', 'diskriminasi', 'bias gender', 'is it fair', 'discrimination', 'gender bias', 'faktor yang tidak dipakai']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        const crit = c.kind === 'cv' && c.criteria?.length ? L(lang, ` Kriteria yang dipakai: ${c.criteria.join('; ')}.`, ` Criteria used: ${c.criteria.join('; ')}.`) : ''
        return { text: L(lang, `Nama, foto, jenis kelamin, usia, agama, status perkawinan dan nama asal daerah tidak pernah menjadi masukan. Domisili hanya dipakai sebagai jarak ke toko, bukan nama kecamatannya.${crit}`, `Name, photo, gender, age, religion, marital status and the home district name are never inputs. Domicile is used only as distance to the shop, not the district name.${crit}`), followUps: chips(lang, 'cv-blind', 'next-step') }
      },
    },
    {
      id: 'next-step',
      examples: ex('next-step', ['lalu apa', 'apa yang harus saya lakukan', 'langkah berikutnya', 'what now', 'what should I do next', 'next action']),
      respond(ctx) {
        const c = w(ctx)
        const lang = ctx.lang
        if (!c.kind) return noCase(lang)
        let text: string
        if (c.kind === 'cv') text = c.top?.length ? L(lang, `Undang ${c.top.length} kandidat shortlist ${c.code} ke wawancara lewat HR (di luar demo ini) dan simpan alasan tiap kandidat.`, `Invite the ${c.top.length} shortlisted candidates for ${c.code} to interviews through HR (outside this demo) and keep each candidate’s reason.`) : L(lang, 'Unggah 200 CV contoh, atur kriteria, lalu tekan “Saring”.', 'Upload the 200 sample CVs, set the criteria, then press “Screen”.')
        else if (c.decided) text = L(lang, `${caseName(c, lang)} sudah diputuskan (${dec(c.decision, lang)}). Ambil permintaan berikutnya dari Antrian.`, `${caseName(c, lang)} is decided (${dec(c.decision, lang)}). Take the next request from the Queue.`)
        else if (c.kind === 'kyb') text = !c.checks?.length ? L(lang, `Tekan “Mulai verifikasi” untuk ${caseName(c, lang)}, lalu “Cek lokasi”.`, `Press “Start verification” for ${caseName(c, lang)}, then “Check location”.`) : c.distanceKm == null ? L(lang, `Jalankan “Cek lokasi” untuk ${caseName(c, lang)}.`, `Run “Check location” for ${caseName(c, lang)}.`) : L(lang, `Putuskan ${caseName(c, lang)}: ${c.decision === 'lolos' ? 'Setujui' : 'Tandai cek manual'}.`, `Decide ${caseName(c, lang)}: ${c.decision === 'lolos' ? 'Approve' : 'Mark for manual check'}.`)
        else text = !c.checks?.length ? L(lang, `Tunggu nasabah ${c.subject ?? ''} mengirim pengajuan dari HP, lalu baca KTP-nya.`, `Wait for ${c.subject ?? 'the customer'} to send the application from the phone, then read the ID card.`) : L(lang, `Kirim keputusan untuk ${caseName(c, lang)}; saran AI ${dec(c.decision, lang)}.`, `Send the decision for ${caseName(c, lang)}; the AI suggests ${dec(c.decision, lang)}.`)
        return { text, followUps: chips(lang, 'why-review', 'what-checked') }
      },
    },
  ],
  fallback(ctx) {
    const lang = ctx.lang
    const c = w(ctx)
    return { text: L(lang, `Saya hanya menjelaskan hasil verifikasi di layar${c.code ? ` (${c.code})` : ''}. Pilih salah satu pertanyaan di bawah.`, `I only explain the verification results on screen${c.code ? ` (${c.code})` : ''}. Pick one of the questions below.`), followUps: chips(lang, 'what-checked', 'next-step', 'data-stored') }
  },
}
