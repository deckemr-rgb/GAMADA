/**
 * naskah-pintar/scenario.ts — Simulation scenario (spec §9.2) for Naskah Pintar: 13 intents with ID, EN and Basa
 * Jawa examples. Answers read the context the page sends (ctx.world = NaskahCtx from ctx.ts): the follow-up board,
 * letters, today's meetings, instructions and the task's subject (transcript, letter, follow-up item).
 * Structured kinds match the proxy tools: minutes, classification, disposition, reminder.
 * Loaded lazily by ai.ts (ensureScenario) — never part of the page chunk.
 */
import type { Intent, Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import type { Bi } from '../../demo-kit/world'
import type { CtxItem, NaskahCtx } from './ai'
import { byText } from './strings'
import { dueLabel, isoDateText, parseDue } from './due'
import { placeText } from './model'

type Ctx = SimContext<unknown>

function W(ctx: Ctx): NaskahCtx {
  const w = (ctx.world ?? {}) as Partial<NaskahCtx>
  return {
    task: w.task ?? 'ask',
    now: w.now ?? '07:00',
    day: w.day ?? '',
    region: w.region ?? '',
    lang: w.lang ?? ctx.lang,
    ...w,
  } as NaskahCtx
}
const L = (lang: Lang, b: Bi | undefined): string => (b ? b[lang] : '')
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const num = (lang: Lang, n: number) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')

const JAWA = /\b(sing|durung|wis|uwis|sampun|dereng|piye|pira|pinten|endi|ngendi|apa wae|opo wae|gawekna|gawekake|tulung|nyuwun|iki|niki|kuwi|rapate|surate|tugase|telat|kasep|sesuk|dina iki)\b/gi
const isJawa = (t: string) => (t.match(JAWA) ?? []).length >= 2

/* ------------------------------------------------------------------ minutes from free text (recorder) */

const ACTION_RE = /(siapkan|kirim|pasang|bangun|turunkan|terjunkan|buka|tutup|laporkan|verifikasi|koordinasi|tangani|perbaiki|siarkan|ajukan|susun|cek|periksa|gelar|salurkan|pastikan|lengkapi|selesaikan|tuntaskan|distribusikan|kerahkan|siagakan|evakuasi|antar|dampingi|tinjau|pantau|perbarui|data ulang|tindak lanjut|segera|harus|agar|mohon|tolong|paling lambat|tenggat|prepare|send|report|verify|coordinate|fix|broadcast|request|draft|check|hold|deliver|make sure|complete|finish|distribute|deploy|monitor|review|update|must|please|by tomorrow|gawekna|kirimna|lapuran)/i
const DECISION_RE = /(keputusan|diputuskan|disepakati|sepakat|kesimpulan|decision|decided|agreed|resolved|diputus)/i
const OWNER_RE: [RegExp, Bi][] = [
  [/pupr|pekerjaan umum|public works|tanggul|embankment|jalan rusak/i, { id: 'Dinas PUPR', en: 'Public Works' }],
  [/bpbd|bencana|disaster/i, { id: 'BPBD', en: 'Disaster Agency' }],
  [/dinsos|sosial|social affairs|bansos/i, { id: 'Dinsos', en: 'Social Affairs' }],
  [/dinkes|kesehatan|health|puskesmas/i, { id: 'Dinkes', en: 'Health Office' }],
  [/disperindag|perdagangan|trade|operasi pasar|market operation/i, { id: 'Disperindag', en: 'Trade Office' }],
  [/distan|pertanian|agricultur|gabah|petani|farmer/i, { id: 'Distan', en: 'Agriculture Office' }],
  [/diskominfo|kominfo|komunikasi|communications|siarkan|broadcast/i, { id: 'Diskominfo', en: 'Communications Office' }],
  [/camat|kecamatan|district/i, { id: 'Camat', en: 'District Head' }],
  [/dishub|perhubungan|transport|rambu|lalu lintas|traffic/i, { id: 'Dishub', en: 'Transport Office' }],
  [/dlh|lingkungan hidup|environment|sampah|waste/i, { id: 'DLH', en: 'Environment Office' }],
  [/dpmptsp|perizinan|permit/i, { id: 'DPMPTSP', en: 'One-Stop Permit Office' }],
  [/disdukcapil|kependudukan|civil registry/i, { id: 'Disdukcapil', en: 'Civil Registry' }],
  [/disdik|pendidikan|education|sekolah|school/i, { id: 'Disdik', en: 'Education Office' }],
  [/bappeda|planning/i, { id: 'Bappeda', en: 'Planning Agency' }],
  [/satpol/i, { id: 'Satpol PP', en: 'Civil Service Police' }],
]

/** the deadline a sentence names, as a label the recorder reads back (due.ts): "Besok 10.00", "Kam, 19 Nov 16.00" */
function dueOf(sentence: string, lang: Lang, now: number, day: string): string {
  return dueLabel(parseDue(sentence, now, day), lang, day)
}

/** spoken connectives that are not part of the task ("Kalau begitu Dinas PUPR koordinasikan …") */
const FILLER_RE = /^(?:(?:kalau|kalo) begitu|baik(?:lah)?|jadi|oke|ok|nah|selanjutnya|lalu|kemudian|terus|untuk itu|dengan demikian|so|okay|right|then|in that case|alright)\b[\s,]*/i
/** a label before a colon that says "this is a decision" rather than naming a speaker */
const DECISION_LABEL = /^(keputusan( rapat)?|kesimpulan|diputuskan|disepakati|hasil rapat|decision|decisions|resolution|agreed)$/i

export function extractFromText(text: string, lang: Lang, now = 7 * 60, day = '2026-11-17'): { decisions: string[]; actionItems: { task: string; owner: string; due: string }[] } {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 8)
  const decisions: string[] = []
  const actionItems: { task: string; owner: string; due: string }[] = []
  for (const raw of sentences) {
    /* "Sekda: …" — a speaker label is not part of the instruction; what the chair orders is also a decision */
    const sp0 = /^([A-Z][\w .'/-]{1,28}):\s+(.+)$/.exec(raw)
    /* "Keputusan rapat: …" / "Decision: …" is a decision, not a speaker called "Keputusan rapat" */
    const labelled = !!sp0 && DECISION_LABEL.test((sp0[1] ?? '').trim())
    const sp = labelled ? null : sp0
    const s = sp ? (sp[2] ?? raw) : raw
    const chair = !!sp && /^(sekda|bupati|wali ?kota|ketua|pimpinan|wakil bupati|asisten|chair|regent)/i.test(sp[1] ?? '')
    const clean = s
      .replace(/^(keputusan( rapat)?|kesimpulan|hasil rapat|decisions?|resolution)\s*[:,-]?\s*/i, '')
      .replace(FILLER_RE, '')
      .replace(/[.!?]+$/, '')
    const decided = labelled || DECISION_RE.test(s)
    if (decided || (chair && ACTION_RE.test(s))) decisions.push(clean.charAt(0).toUpperCase() + clean.slice(1))
    let owner: [RegExp, Bi] | undefined
    let at = Infinity
    for (const o of OWNER_RE) {
      const m = o[0].exec(s)
      if (m && m.index < at) {
        at = m.index
        owner = o
      }
    }
    const dated = /(besok|lusa|hari ini|pukul|jam|tomorrow|today|sesuk|paling lambat|tenggat|minggu ini|pekan ini|this week|senin|selasa|rabu|kamis|jumat|sabtu|monday|tuesday|wednesday|thursday|friday|saturday|by\s)/i.test(s)
    /* a decision becomes a task only when it also names a dated job for an agency (not "operasi pasar digelar") */
    if (owner && ACTION_RE.test(s) && (!decided || (dated && !labelled))) actionItems.push({ task: clean.charAt(0).toUpperCase() + clean.slice(1), owner: owner[1][lang], due: dueOf(s, lang, now, day) })
  }
  return { decisions: decisions.slice(0, 12), actionItems: actionItems.slice(0, 15) }
}

/* ------------------------------------------------------------------ answers */

function minutes(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  if (w.minutes && w.meeting?.sample) {
    const d = w.minutes.decisions.map((x) => x[lang])
    const a = w.minutes.actions.map((x) => ({ task: x.task[lang], owner: x.pic, due: x.due }))
    return {
      text: T(
        lang,
        `${placeText('Rapat membahas kenaikan {river} dan rembesan tanggul {desa}', 'id')}. Saya mencatat ${d.length} keputusan dan ${a.length} tindak lanjut; setiap tindak lanjut punya PIC dan tenggat, dan sudah dikirim ke papan OPD.`,
        `${placeText('The meeting covered the rising {river} and the {desa} embankment seepage', 'en')}. I recorded ${d.length} decisions and ${a.length} follow-ups; each has an owner and a deadline and is already on the agency board.`,
      ),
      structured: { kind: 'minutes', data: { decisions: d, actionItems: a } },
      toolCalls: [
        { name: 'baca_transkrip', input: { segmen: 11, pembicara: 5 }, output: { kata: 214 }, ms: 260 },
        { name: 'extract_minutes', input: { keputusan: d.length, tindak_lanjut: a.length }, ms: 520 },
      ],
      followUps: lang === 'id' ? ['Tindak lanjut apa yang jatuh tempo hari ini?', placeText('Siapa PIC tanggul {desa}?', 'id')] : ['What is due today?', placeText('Who owns the {desa} embankment?', 'en')],
    }
  }
  const text = w.meeting?.transcript ?? ''
  const nowMin = (() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(w.now)
    return m ? Number(m[1]) * 60 + Number(m[2]) : 7 * 60
  })()
  const out = extractFromText(text, lang, nowMin, w.day || '2026-11-17')
  return {
    text: out.actionItems.length
      ? T(lang, `Dari transkrip saya menemukan ${out.decisions.length} keputusan dan ${out.actionItems.length} tindak lanjut. Periksa PIC dan tenggatnya sebelum disimpan.`, `From the transcript I found ${out.decisions.length} ${out.decisions.length === 1 ? 'decision' : 'decisions'} and ${out.actionItems.length} ${out.actionItems.length === 1 ? 'follow-up' : 'follow-ups'}. Check the owners and deadlines before saving.`)
      : T(lang, 'Saya belum menemukan tugas yang jelas di transkrip. Sebutkan unit, tugas, dan tenggatnya, misalnya “Dinas PUPR perbaiki tanggul besok pukul 10”.', 'I found no clear task in the transcript yet. Name the agency, the task and the deadline, e.g. “Public Works repairs the embankment tomorrow at 10”.'),
    structured: { kind: 'minutes', data: out },
    toolCalls: [{ name: 'extract_minutes', input: { kalimat: text.split(/[.!?]/).filter(Boolean).length }, ms: 380 }],
  }
}

function classify(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const l = w.letter
  if (!l)
    return {
      text: T(lang, 'Pilih satu surat di kotak masuk, lalu tekan “Baca & susun disposisi”.', 'Pick a letter in the inbox, then press “Read & draft disposition”.'),
    }
  const summary = l.summary.map((x) => x[lang])
  const cls = l.cls === 'nota-dinas' ? 'lainnya' : l.cls
  const CLS: Record<string, Bi> = {
    undangan: { id: 'Undangan', en: 'An invitation' },
    permohonan: { id: 'Permohonan', en: 'A request' },
    laporan: { id: 'Laporan', en: 'A report' },
    edaran: { id: 'Edaran', en: 'A circular' },
    'nota-dinas': { id: 'Nota dinas', en: 'An internal memo' },
  }
  const sifat: Bi = l.sifat === 'segera' ? { id: 'segera', en: 'urgent' } : l.sifat === 'rahasia' ? { id: 'rahasia', en: 'confidential' } : { id: 'biasa', en: 'normal' }
  return {
    text: T(lang, `${L(lang, CLS[l.cls])} dari ${l.from}, sifat ${sifat.id}. Ringkasan tiga baris dan draf disposisi siap diperiksa.`, `${L(lang, CLS[l.cls])} from ${byText(l.from, 'en')}, priority ${sifat.en}. A three-line summary and a disposition draft are ready.`),
    structured: { kind: 'classification', data: { letterClass: cls, nature: l.sifat, summary, sender: l.from, ...(l.due ? { deadline: l.due } : {}) } },
    toolCalls: [
      { name: 'ocr_surat', input: { nomor: l.number }, output: { kolom: 9 }, ms: 200 },
      { name: 'classify_letter', input: { jenis: cls, sifat: l.sifat }, ms: 160 },
      {
        name: 'draft_disposition',
        input: { kepada: l.suggested.to },
        output: { to: l.suggested.to, instruction: l.suggested.instruction[lang], note: l.suggested.note[lang], ...(l.due ? { deadline: l.due } : {}) },
        ms: 220,
      },
    ],
  }
}

function disposition(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const l = w.letter
  if (!l) return classify(ctx)
  return {
    structured: { kind: 'disposition', data: { to: l.suggested.to, instruction: l.suggested.instruction[lang], note: l.suggested.note[lang], ...(l.due ? { deadline: l.due } : {}) } },
    text: T(
      lang,
      `Draf disposisi: kepada ${l.suggested.to.join(', ')}. ${L(lang, l.suggested.instruction)} Catatan: ${L(lang, l.suggested.note)}`,
      `Disposition draft: to ${l.suggested.to.join(', ')}. ${L(lang, l.suggested.instruction)} Note: ${L(lang, l.suggested.note)}`,
    ),
    toolCalls: [{ name: 'draft_disposition', input: { kepada: l.suggested.to }, ms: 320 }],
  }
}

function reminder(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const it = w.item
  if (!it) return { text: T(lang, 'Pilih satu kartu tindak lanjut, lalu tekan “Kirim pengingat”.', 'Pick a follow-up card, then press “Send reminder”.') }
  const title = L(lang, it.title)
  const lateBy = it.nowAt - it.dueAt
  const span = (m: number) => {
    const x = Math.abs(m)
    if (x >= 2 * 1440) return T(lang, `${Math.round(x / 1440)} hari`, `${Math.round(x / 1440)} days`)
    if (x >= 60) return T(lang, `${Math.round(x / 60)} jam`, `${Math.round(x / 60)} h`)
    return T(lang, `${x} menit`, `${x} min`)
  }
  const lateTxt = lateBy > 0 ? T(lang, `sudah lewat ${span(lateBy)}`, `overdue by ${span(lateBy)}`) : T(lang, `tinggal ${span(lateBy)} lagi`, `${span(lateBy)} left`)
  const src = it.source === 'meeting' ? T(lang, 'hasil rapat', 'from the meeting') : it.source === 'instruction' ? T(lang, 'instruksi Kepala Daerah', 'the Regional Head’s instruction') : it.source === 'letter' ? T(lang, 'disposisi surat', 'a letter disposition') : ''
  const message =
    lang === 'id'
      ? `Yth. ${it.pic}, pengingat tindak lanjut ${src}: “${title}”, tenggat ${it.due} (${lateTxt}). Mohon kabari progresnya. ${it.from ?? 'Sekretariat Daerah'}`
      : `Dear ${it.pic}, a reminder: “${title}” ${src}, due ${it.due} (${lateTxt}). Please share an update. ${it.from ?? 'Regional Secretariat'}`
  return {
    text: message,
    structured: { kind: 'reminder', data: { to: it.pic, message, dueText: it.due } },
    toolCalls: [{ name: 'draft_reminder', input: { pic: it.pic, tenggat: it.due }, ms: 260 }],
  }
}

const itemLine = (lang: Lang, x: CtxItem) => `- ${L(lang, x.title)} (${x.opd}, ${x.pic}, ${x.due})`

function lateList(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const b = w.board
  if (!b) return fallback(ctx)
  const jw = isJawa(ctx.text)
  if (!b.late) {
    return jw
      ? { text: 'Saiki ora ana tindak lanjut sing kasep, kabeh isih sesuai tenggat.', translation: 'Terjemahan: Saat ini tidak ada tindak lanjut yang lewat tenggat, semua masih sesuai tenggat.' }
      : { text: T(lang, 'Saat ini tidak ada tindak lanjut yang lewat tenggat. Semua masih tepat waktu.', 'Nothing is overdue right now. Everything is on time.') }
  }
  const shown = b.lateItems.slice(0, 5)
  const more = b.late - shown.length
  const lines = shown.map((x) => itemLine(lang, x)).join('\n') + (more > 0 ? `\n${T(lang, `…dan ${more} lainnya`, `…and ${more} more`)}` : '')
  if (jw)
    return {
      text: `Wonten ${b.late} tindak lanjut sing kasep tenggate:\n${b.lateItems
        .slice(0, 5)
        .map((x) => itemLine('id', x))
        .join('\n')}${more > 0 ? `\n…lan ${more} liyane` : ''}\nSaged dikirimi pangeling-eling saking papan tindak lanjut.`,
      translation: `Terjemahan: Ada ${b.late} tindak lanjut yang lewat tenggat. Pengingat bisa dikirim dari papan tindak lanjut (tab Tindak Lanjut, di HP: Tugas).`,
      followUps: ['Kirim pengingat ke yang paling telat', 'OPD mana paling banyak tugas?'],
    }
  return {
    text: T(lang, `Ada ${b.late} tindak lanjut lewat tenggat:\n${lines}\nKirim pengingat dari papan tindak lanjut (tab Tindak Lanjut, di HP: Tugas).`, `${b.late} ${b.late === 1 ? 'follow-up is' : 'follow-ups are'} overdue:\n${lines}\nSend reminders from the follow-up board (Follow-ups tab, Tasks on a phone).`),
    toolCalls: [{ name: 'query_action_items', input: { status: 'lewat_tenggat' }, output: { jumlah: b.late }, ms: 140 }],
    followUps: lang === 'id' ? ['OPD mana paling banyak tugas?', 'Apa yang jatuh tempo hari ini?'] : ['Which agency has the most tasks?', 'What is due today?'],
  }
}

function dueToday(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const b = w.board
  if (!b) return fallback(ctx)
  if (!b.todayItems.length) return { text: T(lang, `Tidak ada lagi tindak lanjut yang jatuh tempo hari ini setelah pukul ${w.now}.`, `Nothing else is due today after ${w.now}.`) }
  return {
    text:
      T(lang, `${b.dueToday} tindak lanjut jatuh tempo hari ini:\n`, `${b.dueToday} ${b.dueToday === 1 ? 'follow-up is' : 'follow-ups are'} due today:\n`) +
      b.todayItems.slice(0, 5).map((x) => itemLine(lang, x)).join('\n') +
      (b.dueToday > Math.min(5, b.todayItems.length) ? `\n${T(lang, `…dan ${b.dueToday - Math.min(5, b.todayItems.length)} lainnya`, `…and ${b.dueToday - Math.min(5, b.todayItems.length)} more`)}` : ''),
    toolCalls: [{ name: 'query_action_items', input: { tenggat: 'hari_ini' }, output: { jumlah: b.dueToday }, ms: 140 }],
    followUps: lang === 'id' ? ['Tindak lanjut apa yang lewat tenggat?'] : ['Which follow-ups are overdue?'],
  }
}

function byOpd(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const b = w.board
  if (!b || !b.byOpd.length) return { text: T(lang, 'Belum ada tindak lanjut terbuka.', 'There are no open follow-ups.') }
  const top = b.byOpd[0]!
  const rest = b.byOpd
    .slice(1, 4)
    .map((r) => `${r.opd} ${num(lang, r.open)}`)
    .join(', ')
  return {
    text: T(
      lang,
      `${top.opd} memegang tindak lanjut terbuka terbanyak: ${top.open} (${top.late} lewat tenggat). Berikutnya: ${rest}.`,
      `${top.opd} holds the most open follow-ups: ${top.open} (${top.late} overdue). Next: ${rest}.`,
    ),
    toolCalls: [{ name: 'group_by_opd', input: { status: 'terbuka' }, output: { opd: b.byOpd.length }, ms: 160 }],
  }
}

function lateByOpd(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const b = w.board
  if (!b) return fallback(ctx)
  const rows = b.byOpd.filter((r) => r.late > 0).sort((a, c) => c.late - a.late || c.open - a.open)
  if (!rows.length) return { text: T(lang, 'Tidak ada OPD dengan tindak lanjut lewat tenggat saat ini.', 'No agency has an overdue follow-up right now.') }
  const list = rows.map((r) => `- ${r.opd}: ${num(lang, r.late)} ${T(lang, 'lewat tenggat', 'overdue')} ${T(lang, `dari ${num(lang, r.open)} terbuka`, `of ${num(lang, r.open)} open`)}`).join('\n')
  return {
    text: T(lang, `${rows.length} OPD punya tindak lanjut lewat tenggat (total ${b.late}):\n${list}\nKirim pengingat dari papan tindak lanjut (tab Tindak Lanjut, di HP: Tugas).`, `${rows.length} ${rows.length === 1 ? 'agency has' : 'agencies have'} overdue follow-ups (${b.late} in all):\n${list}\nSend reminders from the follow-up board (Follow-ups tab, Tasks on a phone).`),
    toolCalls: [{ name: 'group_by_opd', input: { status: 'lewat_tenggat' }, output: { opd: rows.length }, ms: 160 }],
    followUps: lang === 'id' ? ['Tindak lanjut apa yang lewat tenggat?'] : ['Which follow-ups are overdue?'],
  }
}

function urgentLetters(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const l = w.letters
  if (!l) return fallback(ctx)
  const urgent = l.pendingList.filter((x) => x.sifat === 'segera').sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const list = (urgent.length ? urgent : l.pendingList).slice(0, 4)
  if (!list.length) return { text: T(lang, 'Semua surat masuk sudah didisposisi; tidak ada yang menunggu.', 'Every incoming letter has a disposition; nothing is waiting.') }
  const lines = list
    .map((x) => `- ${L(lang, x.subject)} (${byText(x.from, lang === 'en' ? 'en' : 'id')})${x.due ? T(lang, `, tenggat ${isoDateText(x.due, 'id')}`, `, due ${isoDateText(x.due, 'en')}`) : ''}${x.to?.length ? T(lang, `; disarankan ke ${x.to.join(', ')}`, `; suggested for ${x.to.join(', ')}`) : ''}`)
    .join('\n')
  return {
    text: urgent.length
      ? T(lang, `${urgent.length} surat bersifat segera dan belum didisposisi:\n${lines}\nBuka di tab Surat Masuk lalu “Baca & susun disposisi” untuk memeriksa draf AI sebelum disetujui.`, `${urgent.length} urgent ${urgent.length === 1 ? 'letter still needs' : 'letters still need'} a disposition:\n${lines}\nOpen it in Incoming, then “Read & draft disposition” to check the AI draft before approving.`)
      : T(lang, `Tidak ada surat segera. Yang masih menunggu disposisi:\n${lines}`, `No urgent letter. Still waiting for a disposition:\n${lines}`),
    toolCalls: [{ name: 'query_letters', input: { sifat: 'segera', status: 'masuk' }, output: { jumlah: urgent.length }, ms: 150 }],
    followUps: lang === 'id' ? ['Bagaimana cara mendisposisikan surat?'] : ['How do I disposition a letter?'],
  }
}

function pendingLetters(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const l = w.letters
  if (!l) return fallback(ctx)
  const urgent = l.pendingList.filter((x) => x.sifat === 'segera').length
  if (isJawa(ctx.text))
    return {
      text: `Wonten ${l.pending} serat ingkang dereng didisposisi, ${urgent} sifate segera.`,
      translation: `Terjemahan: Ada ${l.pending} surat yang belum didisposisi, ${urgent} bersifat segera.`,
    }
  const list = l.pendingList
    .slice(0, 4)
    .map((x) => `- ${L(lang, x.subject)} (${byText(x.from, lang === 'en' ? 'en' : 'id')})`)
    .join('\n')
  return {
    text: l.pending
      ? T(lang, `${l.pending} dari ${l.total} surat belum didisposisi (${urgent} segera):\n${list}`, `${l.pending} of ${l.total} letters still need a disposition (${urgent} urgent):\n${list}`)
      : T(lang, 'Semua surat masuk sudah didisposisi.', 'Every incoming letter has a disposition.'),
    followUps: lang === 'id' ? ['Bagaimana cara mendisposisikan surat?'] : ['How do I disposition a letter?'],
  }
}

function meetingDecisions(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const m = w.minutes
  const meet = w.meetings?.find((x) => x.transcribed && /banjir|flood/i.test(x.title.id)) ?? w.meetings?.find((x) => x.transcribed)
  if (!m || !m.decisions.length)
    return {
      text: T(lang, 'Notulen rapat banjir belum ada. Putar rekaman contoh di tab Rapat, keputusan akan tercatat otomatis.', 'There are no flood-meeting minutes yet. Play the sample recording in the Meeting tab and the decisions are recorded automatically.'),
    }
  /* "Keputusan Rapat Koordinasi …" (the title already says "Rapat"): no "rapat Rapat" */
  const title = meet ? L(lang, meet.title) : ''
  const head = title ? T(lang, `Keputusan ${/^rapat\b/i.test(title) ? title : `rapat ${title}`}:\n`, `Decisions of the ${title}:\n`) : T(lang, 'Keputusan rapat:\n', 'Decisions of the meeting:\n')
  const askPic = /\b(pic|pic-nya|siapa|sinten|who|penanggung jawab|in charge)\b/i.test(ctx.text)
  const pics = askPic && m.actions.length ? `\n${T(lang, 'Tindak lanjut dan PIC-nya:', 'Follow-ups and who owns them:')}\n${m.actions.map((a) => `- ${L(lang, a.task)}: ${a.pic}, ${T(lang, 'tenggat', 'due')} ${a.due}`).join('\n')}` : ''
  return {
    text: head + m.decisions.map((d, i) => `${i + 1}. ${L(lang, d)}`).join('\n') + pics,
    followUps: lang === 'id' ? ['Berapa tindak lanjut rapat banjir yang sudah selesai?'] : ['How many flood-meeting follow-ups are done?'],
  }
}

/** how far the flood meeting's follow-ups have got (statuses from the board) */
function meetingProgress(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const acts = w.minutes?.actions ?? []
  if (!acts.length)
    return { text: T(lang, 'Tindak lanjut rapat banjir belum dibuat. Putar rekaman contoh di tab Rapat; keenam tindak lanjut langsung masuk papan OPD.', 'The flood meeting has no follow-ups yet. Play the sample recording in the Meeting tab; all six land on the agency board at once.') }
  const done = acts.filter((a) => a.status === 'selesai')
  const run = acts.filter((a) => a.status === 'proses')
  const rest = acts.length - done.length - run.length
  const ST: Record<string, Bi> = { selesai: { id: 'selesai', en: 'done' }, proses: { id: 'sedang dikerjakan', en: 'in progress' }, baru: { id: 'belum dimulai', en: 'not started' } }
  const list = acts.map((a) => `- ${L(lang, a.task)} (${a.pic}): ${L(lang, ST[a.status ?? 'baru'] ?? ST.baru)}`).join('\n')
  return {
    text: T(
      lang,
      `${done.length} dari ${acts.length} tindak lanjut rapat banjir sudah selesai, ${run.length} sedang dikerjakan, ${rest} belum dimulai (per pukul ${w.now.replace(':', '.')}):\n${list}`,
      `${done.length} of ${acts.length} flood-meeting follow-ups are done, ${run.length} in progress, ${rest} not started (as of ${w.now}):\n${list}`,
    ),
    toolCalls: [{ name: 'query_action_items', input: { sumber: 'rapat_banjir' }, output: { selesai: done.length, berjalan: run.length }, ms: 140 }],
    followUps: lang === 'id' ? ['Tindak lanjut apa yang lewat tenggat?'] : ['Which follow-ups are overdue?'],
  }
}

function meetingSummary(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const ms = w.meetings ?? []
  const done = ms.filter((m) => m.transcribed)
  const list = ms.map((m) => `- ${m.at} ${L(lang, m.title)}: ${m.transcribed ? T(lang, `notulen jadi, ${m.actions} tindak lanjut`, `minutes ready, ${m.actions} follow-ups`) : T(lang, 'belum ada notulen', 'no minutes yet')}`).join('\n')
  return {
    text: T(lang, `Hari ini ada ${ms.length} rapat, ${done.length} sudah bernotulen:\n${list}`, `${ms.length} meetings today, ${done.length} with minutes:\n${list}`),
    followUps: lang === 'id' ? ['Apa keputusan rapat banjir hari ini?'] : ['What did the flood meeting decide today?'],
  }
}

function picLookup(ctx: Ctx, slots: Record<string, string>): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const all = [...(w.board?.lateItems ?? []), ...(w.board?.todayItems ?? [])]
  const fromMinutes = (w.minutes?.actions ?? []).map((a) => ({ title: a.task, pic: a.pic, due: a.due }))
  const words = (slots.topic ?? ctx.text)
    .toLowerCase()
    .split(/[^a-z0-9À-ɏ]+/)
    .filter((x) => x.length > 3 && !['siapa', 'yang', 'untuk', 'who', 'owns', 'owner', 'sinten', 'ingkang', 'tugas', 'with'].includes(x))
  const hit = [...fromMinutes, ...all].find((x) => words.some((wd) => L(lang, x.title).toLowerCase().includes(wd) || L('id', x.title).toLowerCase().includes(wd)))
  if (!hit) return { text: T(lang, 'Saya tidak menemukan tindak lanjut dengan kata itu. Coba sebut kata kuncinya, misalnya “tanggul”, “pompa”, atau “bansos”.', 'I could not find a follow-up with that word. Try a keyword such as “embankment”, “pumps” or “aid”.') }
  return { text: T(lang, `PIC “${L(lang, hit.title)}” adalah ${hit.pic}, tenggat ${hit.due}.`, `The owner of “${L(lang, hit.title)}” is ${hit.pic}, due ${hit.due}.`) }
}

function instructions(ctx: Ctx): SimResponse {
  const w = W(ctx)
  const lang = ctx.lang
  const ins = w.instructions ?? []
  if (!ins.length) return { text: T(lang, 'Belum ada instruksi Kepala Daerah hari ini. Instruksi dari Meja Pimpinan langsung muncul di sini sebagai nota dinas dan tindak lanjut.', 'No instruction from the Regional Head today yet. Instructions from Meja Pimpinan appear here at once as a memo and follow-ups.') }
  return {
    text: T(lang, 'Instruksi terbaru Kepala Daerah:\n', 'Latest instructions from the Regional Head:\n') + ins.map((i) => `- ${i.at} ${L(lang, i.text)} → ${i.opds.join(', ')}`).join('\n'),
  }
}

function help(ctx: Ctx): SimResponse {
  const lang = ctx.lang
  return {
    text: T(
      lang,
      'Saya membantu sekretariat: menulis notulen dan tindak lanjut dari rekaman rapat, meringkas dan mengklasifikasi surat masuk, menyusun draf disposisi, dan mengingatkan PIC yang mendekati tenggat.',
      'I help the secretariat: I write minutes and follow-ups from meeting recordings, summarise and classify incoming letters, draft dispositions and remind owners close to their deadline.',
    ),
    followUps: lang === 'id' ? ['Tindak lanjut apa yang lewat tenggat?', 'Berapa surat yang belum didisposisi?'] : ['Which follow-ups are overdue?', 'How many letters still need a disposition?'],
  }
}

function howDispose(ctx: Ctx): SimResponse {
  const lang = ctx.lang
  return {
    text: T(
      lang,
      'Buka tab Surat Masuk, pilih surat, tekan “Baca & susun disposisi”. AI meluruskan pindaian, meringkas 3 baris, menentukan jenis dan sifat, lalu menyusun draf disposisi. Periksa, ubah bila perlu, lalu tekan Setujui.',
      'Open the Incoming tab, pick a letter and press “Read & draft disposition”. The AI straightens the scan, writes a 3-line summary, sets type and priority and drafts the disposition. Check it, edit if needed, then press Approve.',
    ),
  }
}

function fallback(ctx: Ctx): SimResponse {
  const lang = ctx.lang
  return {
    text: T(lang, 'Maaf, pertanyaan itu di luar data Naskah Pintar. Saya bisa menjawab soal notulen rapat, surat masuk, disposisi, dan tindak lanjut.', 'Sorry, that is outside Naskah Pintar’s data. I can answer about meeting minutes, incoming letters, dispositions and follow-ups.'),
    followUps: lang === 'id' ? ['Tindak lanjut apa yang lewat tenggat?', 'Berapa surat yang belum didisposisi?', 'Apa keputusan rapat banjir hari ini?'] : ['Which follow-ups are overdue?', 'How many letters still need a disposition?', 'What did the flood meeting decide today?'],
  }
}

/* ------------------------------------------------------------------ intents */

const intents: Intent<unknown>[] = [
  {
    id: 'minutes.extract',
    examples: [
      'Buat notulen dan tindak lanjut dari transkrip rapat ini',
      'Susun notulen rapat dari rekaman',
      'catat keputusan dan tindak lanjut rapat',
      'Draft the minutes and action items from this meeting transcript',
      'extract decisions and follow-ups from the transcript',
      'Gawekna notulen rapat iki',
    ],
    respond: (ctx) => minutes(ctx),
  },
  {
    id: 'letter.classify',
    examples: [
      'Klasifikasikan surat masuk ini dan susun draf disposisi',
      'Ringkas surat ini tiga baris dan tentukan sifatnya',
      'baca surat masuk lalu buat disposisi',
      'Classify this incoming letter and draft a disposition',
      'summarise this letter in three lines',
      'Surat iki jenise apa, gawekna disposisine',
    ],
    respond: (ctx) => classify(ctx),
  },
  {
    id: 'letter.disposition',
    examples: ['Susun ulang draf disposisi surat ini', 'disposisi surat ini ke siapa', 'Redraft the disposition for this letter', 'who should this letter go to', 'Surat iki didisposisi menyang sapa'],
    respond: (ctx) => disposition(ctx),
  },
  {
    id: 'reminder.draft',
    examples: ['Buat pesan pengingat WhatsApp untuk PIC tindak lanjut ini', 'ingatkan PIC yang lewat tenggat', 'Draft a WhatsApp reminder to the person in charge', 'remind the owner about the deadline', 'Gawekna pangeling-eling kanggo PIC'],
    respond: (ctx) => reminder(ctx),
  },
  {
    id: 'followups.late',
    examples: ['Tindak lanjut apa yang lewat tenggat?', 'tugas mana yang terlambat', 'Which follow-ups are overdue?', 'what is late', 'Sing durung rampung apa wae?', 'tugas sing telat apa wae'],
    respond: (ctx) => lateList(ctx),
  },
  {
    id: 'followups.today',
    examples: ['Apa yang jatuh tempo hari ini?', 'tenggat hari ini apa saja', 'What is due today?', 'deadlines today', 'Tenggat dina iki apa wae'],
    respond: (ctx) => dueToday(ctx),
  },
  {
    id: 'followups.byOpd',
    examples: ['OPD mana paling banyak tugas?', 'dinas mana yang paling banyak tindak lanjut terbuka', 'Which agency has the most tasks?', 'open follow-ups per agency', 'Dinas endi sing tugase paling akeh'],
    respond: (ctx) => byOpd(ctx),
  },
  {
    id: 'followups.lateByOpd',
    examples: ['Siapa yang paling sering telat?', 'OPD mana yang paling banyak lewat tenggat', 'dinas mana yang terlambat', 'Which agency is most often late?', 'which agencies have overdue tasks', 'Dinas endi sing paling kasep'],
    respond: (ctx) => lateByOpd(ctx),
  },
  {
    id: 'letters.urgent',
    examples: ['Surat mana yang paling mendesak dan siapa yang harus menangani?', 'surat segera mana yang harus didahulukan', 'surat paling mendesak', 'Which letter is most urgent and who should handle it?', 'most urgent letters', 'Surat endi sing paling mendesak'],
    respond: (ctx) => urgentLetters(ctx),
  },
  {
    id: 'letters.pending',
    examples: ['Berapa surat yang belum didisposisi?', 'surat masuk yang menunggu disposisi', 'How many letters still need a disposition?', 'pending letters', 'Surat sing durung didisposisi pira'],
    respond: (ctx) => pendingLetters(ctx),
  },
  {
    id: 'meeting.decisions',
    examples: ['Apa keputusan rapat banjir hari ini?', 'Apa keputusan rapat banjir tadi pagi dan siapa PIC-nya?', 'hasil rapat koordinasi banjir', 'What did the flood meeting decide and who owns each item?', 'What did the flood meeting decide today?', 'meeting decisions', 'Rapate mutusake apa'],
    respond: (ctx) => meetingDecisions(ctx),
  },
  {
    id: 'meeting.progress',
    examples: [
      'Berapa tindak lanjut rapat banjir yang sudah selesai?',
      'progres tindak lanjut rapat banjir',
      'sudah sampai mana pengerjaan tindak lanjut rapat',
      'How many flood-meeting follow-ups are done?',
      'flood meeting follow-up progress',
      'Tindak lanjut rapat banjir wis rampung pira',
    ],
    respond: (ctx) => meetingProgress(ctx),
  },
  {
    id: 'meeting.list',
    examples: ['Rapat apa saja hari ini?', 'jadwal rapat hari ini dan notulennya', 'Which meetings are on today?', 'today meetings and minutes', 'Rapat dina iki apa wae'],
    respond: (ctx) => meetingSummary(ctx),
  },
  {
    id: 'pic.lookup',
    examples: ['Siapa PIC tanggul?', 'siapa penanggung jawab pompa', 'Who owns the embankment task?', 'who is in charge of the pumps', 'Sinten PIC bansos'],
    slots: { topic: /(?:pic|penanggung jawab|in charge of|owns|owner of)\s+(.+)/i },
    respond: (ctx, slots) => picLookup(ctx, slots),
  },
  {
    id: 'instructions.latest',
    examples: ['Instruksi Bupati terbaru apa?', 'instruksi pimpinan hari ini', 'Latest instructions from the Regional Head', 'what did the regent instruct', 'Dhawuhe Bupati apa'],
    respond: (ctx) => instructions(ctx),
  },
  {
    id: 'help',
    examples: ['Apa yang bisa kamu bantu?', 'fitur naskah pintar', 'What can you do?', 'how does this work', 'Iki iso nggo apa'],
    respond: (ctx) => help(ctx),
  },
  {
    id: 'howto.dispose',
    examples: ['Bagaimana cara mendisposisikan surat?', 'cara membuat disposisi', 'How do I disposition a letter?', 'how to approve a disposition', 'Piye carane disposisi surat'],
    respond: (ctx) => howDispose(ctx),
  },
]

const scenario: Scenario<unknown> = { product: 'naskah-pintar', intents, threshold: 0.3, fallback }
export default scenario
