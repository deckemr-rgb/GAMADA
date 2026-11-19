/**
 * naskah-pintar/model.ts — the sample meeting as a minutes "script" (what the AI writes at which transcript line),
 * time helpers and small world helpers shared by the three tabs. No React.
 *
 * The meeting is the kit clip meetingBanjirFor(floodAnchor(pack)) (+ meetingBanjirNotesFor: decisions and 6 follow-ups
 * with PIC + due), so river, kecamatan and embankment follow the selected region (Tahap 7). setMeetingRegion() rebuilds
 * the live bindings below (CLIP, SCRIPT, SUMMARY ...) when the region changes; index.tsx calls it before the tabs render.
 * Participants, agenda and discussion points below are derived from the same transcript lines.
 */
import type { ActionItem, Bi, Meeting, Minutes, WorldState } from '../../demo-kit/world'
import { DAY_MIN, hhmm, rows } from '../../demo-kit/world/util'
import type { ClipSegment } from '../../demo-kit/media/playback'
import { MEETING_BANJIR, meetingBanjirFor, meetingBanjirNotesFor } from '../../demo-kit/media/samples'
import { floodAnchor, type AnchorSource, type FloodAnchor } from '../../demo-kit/region/anchor'
import type { RoleId } from '../../content/products'
import { STR, opdLabel, picLabel, setHeadTitle } from './strings'

type Lang = 'id' | 'en'

export const NP = {
  /** fast playback factor (silent text timeline) */
  fast: 3,
  /** ghost card flight (s) — the "wow" band */
  fly: 0.9,
  /** follow-up due fallback for letters without a deadline (days) */
  letterDueDays: 2,
  /** OPD the "Kepala OPD" role starts with */
  defaultOpd: 'pupr',
} as const

/** the places of the region's flood story (set by setMeetingRegion; index.tsx sets it before any tab renders) */
let PLACES: FloodAnchor = { river: '', kecamatanId: '', kecamatan: '', desaId: '', desa: '', desaKind: 'desa', floodKecamatan: [], market: '' }
let HEAD: Bi = { id: 'Bupati', en: 'Regent' }
export let CLIP = MEETING_BANJIR
export let SEGS_VOICE: ClipSegment[] = CLIP.segments
export let SEGS_FAST: ClipSegment[] = []

const segIdx = (seg: string) => Math.max(0, CLIP.segments.findIndex((s) => s.id === seg))

/** ISO local time of the notes ("2026-11-17T16:00") → world minutes, day 0 = the first date in the notes */
let BASE_DAY = '2026-11-17'
function dueMinutes(iso: string): Minutes {
  const day = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${BASE_DAY}T00:00:00Z`)) / 86_400_000)
  const [h, m] = iso.slice(11, 16).split(':').map(Number) as [number, number]
  return day * DAY_MIN + h * 60 + m
}

export interface ScriptAction {
  key: string
  seg: number
  opdId: string
  pic: string
  dueAt: Minutes
  text: Bi
}
export interface ScriptLine {
  key: string
  seg: number
  text: Bi
}

const listId = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} dan ${xs[xs.length - 1]}` : (xs[0] ?? ''))
const listEn = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? ''))

/**
 * Region words inside a static string: {kec} the camat's kecamatan, {desa} the embankment desa/kelurahan, {Desa}
 * "Desa X" / "Kelurahan X", {hall} "X village hall" / "X ward hall", {river}, {market}, {head} Bupati / Wali Kota
 * (EN Regent / Mayor).
 */
export function placeText(t: string, lang: Lang): string {
  const p = PLACES
  const kel = p.desaKind === 'kelurahan'
  return t
    .replace(/\{kec\}/g, p.kecamatan)
    .replace(/\{desa\}/g, p.desa)
    .replace(/\{Desa\}/g, `${kel ? 'Kelurahan' : 'Desa'} ${p.desa}`)
    .replace(/\{hall\}/g, `${p.desa} ${kel ? 'ward hall' : 'village hall'}`)
    .replace(/\{river\}/g, p.river || (lang === 'id' ? 'sungai' : 'the river'))
    .replace(/\{market\}/g, p.market || (lang === 'id' ? 'pasar induk' : 'the main market'))
    .replace(/\{head\}/g, HEAD[lang])
}

/** what the minutes contain, keyed by the transcript line that reveals it */
export let SCRIPT: { agenda: ScriptLine[]; topics: ScriptLine[]; decisions: ScriptLine[]; actions: ScriptAction[] } = { agenda: [], topics: [], decisions: [], actions: [] }
/** speakers in order of their first line */
export let SPEAKER_FIRST: { id: string; seg: number }[] = []
export let SUMMARY: Bi = { id: '', en: '' }
/** the conclusion of the official minutes (section IV): impersonal register of a government memo, no AI voice */
export let CONCLUSION: Bi = { id: '', en: '' }

let regionKey = ''
/** Rebuild the sample meeting for a region (no-op when unchanged). No pack → the kit's default clip. */
export function setMeetingRegion(pack: (AnchorSource & { id?: string; type?: string }) | null): void {
  const key = pack ? (pack.id ?? pack.shortName) : '-'
  if (key === regionKey) return
  regionKey = key
  if (pack) {
    PLACES = floodAnchor(pack)
    HEAD = pack.type === 'kota' ? { id: 'Wali Kota', en: 'Mayor' } : { id: 'Bupati', en: 'Regent' }
    setHeadTitle(pack.type === 'kota')
  }
  const P = PLACES
  CLIP = pack ? meetingBanjirFor(P) : MEETING_BANJIR
  const notes = meetingBanjirNotesFor(P)
  SEGS_VOICE = CLIP.segments
  SEGS_FAST = CLIP.segments.map((s) => ({ ...s, start: Math.round((s.start / NP.fast) * 100) / 100, end: Math.round((s.end / NP.fast) * 100) / 100 }))
  BASE_DAY = notes.actions.map((a) => a.due.slice(0, 10)).sort()[0] ?? '2026-11-17'
  const river = P.river || 'sungai'
  const riverEn = P.river || 'river'
  const Desa = placeText('{Desa}', 'id')
  const kel = P.desaKind === 'kelurahan'
  const kecs = P.floodKecamatan.length ? P.floodKecamatan : [P.kecamatan]
  SCRIPT = {
    agenda: [{ key: 'ag1', seg: 0, text: { id: `Kondisi ${river} dan langkah penanganan banjir`, en: `${riverEn} conditions and flood-response steps` } }],
    topics: [
      { key: 't1', seg: 1, text: { id: `Pos pantau Siaga II dan masih naik; genangan di ${listId(kecs)} (312 rumah).`, en: `River gauge at alert level II and rising; flooding in ${listEn(kecs)} (312 homes).` } },
      { key: 't2', seg: 2, text: { id: `Tanggul ${Desa} merembes ±60 m; warga minta karung pasir hari ini.`, en: `The ${P.desa} embankment seeps for ~60 m; residents ask for sandbags today.` } },
      { key: 't3', seg: 3, text: { id: 'Dinas PUPR siap kirim tim dan 1.500 karung pasir; pompa tersedia 6, kurang 4.', en: 'Public Works can send a team and 1,500 sandbags; 6 pumps available, 4 short.' } },
      { key: 't4', seg: 6, text: { id: 'Dapur umum siap di 3 titik; Dinsos butuh data penerima bansos terverifikasi.', en: 'Public kitchens ready at 3 points; Social Affairs needs verified aid-recipient data.' } },
      { key: 't5', seg: 8, text: { id: `BPBD menyiapkan peringatan dini untuk ${kel ? 'kelurahan' : 'desa'} bantaran, siaran pukul 10.00.`, en: `BPBD prepares early warnings for riverside ${kel ? 'wards' : 'villages'}, broadcast at 10:00.` } },
      { key: 't6', seg: 9, text: { id: `Balai ${Desa} disiapkan sebagai titik evakuasi sementara, termasuk untuk lansia.`, en: `${placeText('{hall}', 'en')} becomes a temporary evacuation point, including for the elderly.` } },
    ],
    decisions: [
      ...notes.decisions.map((d, i) => ({ key: `d${i + 1}`, seg: segIdx(d.seg), text: { id: d.text.id, en: d.text.en } })),
      { key: 'd4', seg: segIdx('s11'), text: { id: 'Rapat evaluasi besok pukul 08.00', en: 'Review meeting tomorrow at 08:00' } },
    ],
    actions: notes.actions.map((a, i) => ({ key: `a${i + 1}`, seg: segIdx(a.seg), opdId: a.opdId, pic: a.pic, dueAt: dueMinutes(a.due), text: { id: a.text.id, en: a.text.en } })),
  }
  const seen = new Map<string, number>()
  CLIP.segments.forEach((s, i) => {
    if (!seen.has(s.speaker)) seen.set(s.speaker, i)
  })
  SPEAKER_FIRST = [...seen.entries()].map(([id, seg]) => ({ id, seg }))
  SUMMARY = {
    id: `Rapat koordinasi membahas kenaikan muka air ${river} dan rembesan tanggul ${P.desa}. Diputuskan: PUPR menangani tanggul hari ini, pinjam pakai 4 pompa, Dinsos memverifikasi 50 berkas bansos, BPBD menyiarkan peringatan dini, dan Camat ${P.kecamatan} menyiapkan titik evakuasi.`,
    en: `The coordination meeting covered the rising ${riverEn} and the ${P.desa} embankment seepage. Decided: Public Works fixes the embankment today, 4 pumps are borrowed, Social Affairs verifies 50 aid files, BPBD broadcasts early warnings and the Head of ${P.kecamatan} prepares an evacuation point.`,
  }
  CONCLUSION = {
    id: `Rapat menyimpulkan bahwa penanganan rembesan tanggul ${Desa}, pengadaan pompa tambahan melalui pinjam pakai, verifikasi data penerima bantuan sosial, penyiaran peringatan dini, dan penyiapan titik evakuasi dilaksanakan sesuai tenggat dalam tabel tindak lanjut. Setiap perangkat daerah melaporkan pelaksanaannya kepada Sekretaris Daerah, dan hasilnya dievaluasi dalam rapat berikutnya.`,
    en: `The meeting concluded that the ${P.desa} embankment seepage, the additional pumps on loan, the verification of aid-recipient data, the early-warning broadcast and the evacuation point are to be carried out by the deadlines in the follow-up table. Each agency reports its progress to the Regional Secretary, and the results are reviewed at the next meeting.`,
  }
}
setMeetingRegion(null)

/** the transcript as plain text for the AI ("Sekda: …") */
export function transcriptText(lang: Lang, segments: ClipSegment[] = CLIP.segments, upTo = segments.length - 1): string {
  const name = new Map(CLIP.speakers.map((sp) => [sp.id, sp.label[lang]]))
  return segments
    .slice(0, upTo + 1)
    .map((s) => `${name.get(s.speaker) ?? s.speaker}: ${lang === 'en' && s.en ? s.en : s.text}`)
    .join('\n')
}

/* ------------------------------------------------------------------ the meeting's facts, from the world */

/**
 * The river report in the meeting (transcript line 2 + discussion point 1) is read from the world the moment the
 * meeting is first shown: the river gauge (level vs alert level, rising or not) and the districts of today's flood
 * reports, so the minutes say what Meja Pimpinan and Siaga Wilayah show (all labelled simulated). Frozen per
 * meeting for the session, so a replay or the official minutes never drift from what was "said".
 */
export interface MeetingFacts {
  topic: Bi
  line: { text: string; en: string }
}
const factsCache = new Map<string, MeetingFacts | null>()
const nId = (n: number, d: number) => n.toFixed(d).replace('.', ',')
export function meetingFacts(s: WorldState, meetingId: string | undefined, now: Minutes): MeetingFacts | null {
  const key = `${s.day}:${meetingId ?? '-'}`
  if (factsCache.has(key)) return factsCache.get(key) ?? null
  const river = rows(s.gauges).find((g) => g.kind === 'sungai')
  if (!river) return null // world not loaded yet: keep the recording's own words, do not cache
  const kecName = (id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
  const count = new Map<string, number>()
  for (const c of rows(s.complaints)) if (c.category === 'banjir' && c.at >= 0 && c.at <= now) count.set(c.kecamatanId, (count.get(c.kecamatanId) ?? 0) + 1)
  const kec = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  for (const k of s.region.floodKecamatanIds) if (kec.length < 3 && !kec.includes(k)) kec.push(k)
  const names = kec.slice(0, 4).map(kecName)
  const rising = river.level - (river.history[0] ?? river.level) > 0.05
  const near = river.normal + (river.siaga - river.normal) * 0.6
  const st =
    river.level >= river.awas
      ? { id: 'sudah melewati batas awas', en: 'above the danger level' }
      : river.level >= river.siaga
        ? { id: 'sudah melewati batas siaga', en: 'above the alert level' }
        : river.level >= near
          ? { id: 'mendekati batas siaga', en: 'close to the alert level' }
          : { id: 'masih di bawah batas siaga', en: 'still below the alert level' }
  const lim = river.level >= river.siaga ? river.awas : river.siaga
  const trend = rising ? { id: 'masih naik', en: 'still rising' } : { id: 'mulai stabil', en: 'levelling off' }
  const where = names.length ? { id: listId(names), en: listEn(names) } : null
  const spoken = river.name.replace(/\s*·\s*/g, ' ')
  /* English: "<river> · pos <place>" reads as "the <river> gauge at <place>" (no untranslated "pos") */
  const [rName = river.name, station] = river.name.split(/\s*·\s*/)
  const stationEn = station ? station.replace(/^pos\s+/i, '') : null
  const gaugeEn = stationEn ? `${rName} gauge at ${stationEn}` : `${rName} gauge`
  const facts: MeetingFacts = {
    topic: {
      id: `Muka air ${river.name} ${nId(river.level, 2)} m, ${st.id} (${nId(lim, 1)} m) dan ${trend.id}${where ? `; genangan dilaporkan di ${where.id}` : ''} (data simulasi).`,
      en: `${gaugeEn}: ${river.level.toFixed(2)} m, ${st.en} (${lim.toFixed(1)} m) and ${trend.en}${where ? `; flooding reported in ${where.en}` : ''} (simulated data).`,
    },
    line: {
      text: `Muka air ${spoken} ${nId(river.level, 2)} meter, ${st.id} ${nId(lim, 1)} meter, dan ${trend.id}.${where ? ` Genangan dilaporkan di ${where.id}.` : ''}`,
      en: `The ${gaugeEn} reads ${river.level.toFixed(2)} metres, ${st.en} of ${lim.toFixed(1)} metres, and ${trend.en}.${where ? ` Flooding is reported in ${where.en}.` : ''}`,
    },
  }
  factsCache.set(key, facts)
  return facts
}

/** discussion points with the world's river report in point 1 */
export function topicsWith(facts: MeetingFacts | null): ScriptLine[] {
  return facts ? SCRIPT.topics.map((t) => (t.key === 't1' ? { ...t, text: facts.topic } : t)) : SCRIPT.topics
}

/** the clip's segments with line 2 (the river report) spoken from the world; timing unchanged */
export function segmentsWith(facts: MeetingFacts | null): { voice: ClipSegment[]; fast: ClipSegment[] } {
  if (!facts) return { voice: SEGS_VOICE, fast: SEGS_FAST }
  const swap = (list: ClipSegment[]) => list.map((sg, i) => (i === 1 ? { ...sg, text: facts.line.text, en: facts.line.en } : sg))
  return { voice: swap(SEGS_VOICE), fast: swap(SEGS_FAST) }
}

/* ------------------------------------------------------------------ world helpers */

/** today's sample meeting (the flood coordination meeting), else the first meeting of the day */
export function sampleMeeting(s: WorldState): Meeting | undefined {
  const today = s.meetings.ids.map((id) => s.meetings.byId[id]).filter((m): m is Meeting => !!m && m.at >= 0 && m.at < DAY_MIN).sort((a, b) => a.at - b.at)
  return today.find((m) => m.title.id === CLIP.title.id) ?? today.find((m) => !m.transcribed) ?? today[0]
}

/** other meetings of the day that still have no minutes (targets of "Rekam rapat") */
export function openMeetings(s: WorldState, exceptId: string | undefined): Meeting[] {
  return s.meetings.ids
    .map((id) => s.meetings.byId[id])
    .filter((m): m is Meeting => !!m && m.at >= 0 && m.at < DAY_MIN && !m.transcribed && m.id !== exceptId)
    .sort((a, b) => a.at - b.at)
}

/** action item already created for a script line (idempotent replays / reloads) */
export function existingAction(s: WorldState, meetingId: string, text: Bi): ActionItem | undefined {
  for (const id of s.actionItems.ids) {
    const a = s.actionItems.byId[id]
    if (a && a.source.kind === 'meeting' && a.source.id === meetingId && a.title.id === text.id) return a
  }
  return undefined
}

/** OPD id that exists in the region (falls back to the closest known one) */
export function opdIdIn(s: WorldState, opdId: string): string {
  if (s.region.opd.some((o) => o.id === opdId)) return opdId
  return s.region.opd[0]?.id ?? opdId
}

export function opdName(s: WorldState, opdId: string, lang: Lang, compact = false): string {
  return opdLabel(
    s.region.opd.find((o) => o.id === opdId),
    opdId,
    lang,
    compact,
  )
}

/** Indonesian / English keyword → OPD id (live answers name agencies in prose) */
const OPD_WORDS: [RegExp, string][] = [
  [/pupr|pekerjaan umum|public works|bina marga|tanggul|embankment/i, 'pupr'],
  [/bpbd|bencana|disaster|kalaksa|pusdalops/i, 'bpbd'],
  [/dinsos|sosial|social|bansos|kadinsos/i, 'dinsos'],
  [/dinkes|kesehatan|health|puskesmas/i, 'dinkes'],
  [/disdik|pendidikan|education|sekolah/i, 'disdik'],
  [/camat|kecamatan|district|paten/i, 'kecamatan'],
  [/disperindag|perdagangan|trade|pasar/i, 'disperindag'],
  [/distan|pertanian|agricultur|petani|gabah/i, 'distan'],
  [/diskominfo|kominfo|komunikasi|communication|siar/i, 'diskominfo'],
  [/bappeda|perencanaan|planning/i, 'bappeda'],
  [/inspektorat|inspector/i, 'inspektorat'],
  [/satpol|ketertiban/i, 'satpolpp'],
  [/dpmptsp|perizinan|investasi|permit/i, 'dpmptsp'],
  [/dlh|lingkungan|environment|sampah/i, 'dlh'],
  [/dishub|perhubungan|transport/i, 'dishub'],
  [/koperasi|umkm|sme/i, 'diskopumkm'],
  [/perkim|perumahan|housing/i, 'perkim'],
  [/pbj|pengadaan|procurement/i, 'ukpbj'],
]
export function resolveOpd(s: WorldState, text: string): string | null {
  const t = text.trim()
  const exact = s.region.opd.find((o) => o.id === t.toLowerCase() || o.short.toLowerCase() === t.toLowerCase() || o.name.toLowerCase() === t.toLowerCase())
  if (exact) return exact.id
  for (const [re, id] of OPD_WORDS) if (re.test(t) && s.region.opd.some((o) => o.id === id)) return id
  const loose = s.region.opd.find((o) => t.toLowerCase().includes(o.short.toLowerCase()))
  return loose?.id ?? null
}

/* ------------------------------------------------------------------ time */

/** "Hari ini 16.00" / "Besok 12.00" / "19 Nov 09.00" relative to the demo day */
export function dueText(at: Minutes, lang: Lang, day?: string): string {
  const d = Math.floor(at / DAY_MIN)
  const t = hhmm(at).replace(':', lang === 'id' ? '.' : ':')
  const S = STR[lang]
  if (d === 0) return `${S.today} ${t}`
  if (d === 1) return `${S.tomorrow} ${t}`
  if (d === -1) return `${S.yesterday} ${t}`
  if (day) {
    const date = new Date(Date.parse(`${day}T00:00:00Z`) + d * 86_400_000)
    return `${date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} ${t}`
  }
  return `${S.dayFmt(d)} ${t}`
}

/** the day only: "Hari ini" / "Kemarin" / "4 Nov" (where a follow-up came from: repeated tasks read as recurring) */
export function dayText(at: Minutes, lang: Lang, day?: string): string {
  const d = Math.floor(at / DAY_MIN)
  const S = STR[lang]
  if (d === 0) return S.today
  if (d === -1) return S.yesterday
  if (d === 1) return S.tomorrow
  if (day) return new Date(Date.parse(`${day}T00:00:00Z`) + d * 86_400_000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return S.dayFmt(d)
}

/** "10.42" (ID) / "10:42" (EN) */
export const clockText = (at: Minutes, lang: Lang): string => hhmm(at).replace(':', lang === 'id' ? '.' : ':')

/** product roles (anything else, e.g. a stale ?role, behaves as the default) */
export type NpRole = 'sekretariat' | 'kepala-daerah' | 'kepala-opd'
export function npRole(r: RoleId): NpRole {
  return r === 'kepala-daerah' || r === 'kepala-opd' ? r : 'sekretariat'
}

/** who signs a disposition approved by this role (titles only) */
export function signer(role: NpRole): string {
  return role === 'kepala-daerah' ? HEAD.id : 'Sekda'
}
/** the regional head's title in the current region (Bupati / Wali Kota) */
export const headTitle = (): Bi => HEAD

export { picLabel }

/* ------------------------------------------------------------------ letters ↔ meeting, PIC, official dates */

/**
 * Incoming letters that ask for something the flood meeting already decided (letter number → script follow-up key):
 * the disposition links to that follow-up instead of creating a second task for the same agency.
 */
export const LETTER_LINKS: Readonly<Record<string, string>> = {
  '140/087/412.416.12/2026': 'a1', // the embankment desa: sandbags + embankment = decision 1 (Kadis PUPR, today 16.00)
  '600/1189/412.205/2026': 'a2', // PUPR memo: portable pumps = follow-up 2 (pump loan)
}

/** person in charge of a new follow-up for an agency (titles only; a regency BPBD is run by its Kalaksa) */
export function picFor(opd: { short: string } | undefined, opdId: string): string {
  if (opdId === 'bpbd') return 'Kalaksa BPBD'
  if (opdId === 'kecamatan') return 'Camat'
  return `Kepala ${opd?.short ?? opdId}`
}

/** a date written out for an official document: "17 November 2026 pukul 16.00 WIB" / "17 November 2026, 16:00 WIB" */
export function fullDue(at: Minutes, lang: Lang, day: string): string {
  const d = Math.floor(at / DAY_MIN)
  const date = new Date(Date.parse(`${day}T00:00:00Z`) + d * 86_400_000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const t = clockText(((at % DAY_MIN) + DAY_MIN) % DAY_MIN, lang)
  return lang === 'id' ? `${date} pukul ${t} WIB` : `${date}, ${t} WIB`
}
