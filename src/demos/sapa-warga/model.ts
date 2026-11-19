/**
 * demos/sapa-warga/model.ts — pure helpers shared by the phone, the console and the AI scenario: personas,
 * message classification, complaint / booking payloads (always emitted with source 'sapa-warga'), the AI context
 * and small formatting helpers. No React here.
 *
 * Every number shown from these helpers is SIMULATED (seeded world). Officials appear by title only.
 */
import type { Lang } from '../../lib/i18n'
import type { RegionPack } from '../../demo-kit/region/types'
import {
  CATEGORY_LABEL, DAY_MIN, WORLD, clock, currentRegion, distanceKm, emit, formatId, hhmm, rows,
  type Bi, type Citizen, type ComplaintCategory, type ComplaintChannel, type EventMap, type LngLat, type Urgency, type WorldState,
} from '../../demo-kit/world'

export const SLUG = 'sapa-warga' as const

/* ------------------------------------------------------------------ constants (module-local) */
export const SW = {
  /** SLA days per category — mirrors world/texts CATEGORY_SLA_DAYS (the reducer sets slaDueAt from it) */
  slaDays: { banjir: 1, 'jalan-rusak': 7, sampah: 2, pju: 3, 'air-bersih': 2, 'pohon-tumbang': 1, pungli: 5, kesehatan: 3, sekolah: 7, adminduk: 3, bansos: 5, lainnya: 5 } as Record<ComplaintCategory, number>,
  /** duplicate search radius (km) for "Gabungkan duplikat" */
  dupKm: 0.5,
  /** MPP opening hours (world minutes) and slot length */
  mppOpen: 8 * 60,
  mppClose: 15 * 60,
  slotMin: 30,
  slotCap: 6,
  /** slots offered in the picker */
  slotCount: 6,
  /** ticket flight phone → console (s), spec ≤ 900 ms */
  flightS: 0.85,
} as const

/* ------------------------------------------------------------------ simulated work time per officer step */

/**
 * How long each step takes in the simulated day (world minutes). An officer action moves the world clock on by
 * this much, so a ticket's history reads like a working morning ("dilaporkan 07.02, selesai 08.58") instead of
 * five steps in the same minute. The drawer says so next to the action ("jam simulasi maju +18 mnt").
 */
const STEP_MIN = { diverifikasi: 4, diteruskan: 7, diproses: 18 } as const
const FIX_MIN: Partial<Record<ComplaintCategory, number>> = { banjir: 95, 'pohon-tumbang': 80, pju: 150, 'jalan-rusak': 180, sampah: 110, 'air-bersih': 140 }
export function stepMinutes(status: string, category: ComplaintCategory): number {
  if (status === 'selesai') return FIX_MIN[category] ?? 120
  return STEP_MIN[status as keyof typeof STEP_MIN] ?? 0
}
/** move the shared world clock on by `min` (never past the end of the demo day); returns the minutes really added */
export function advanceClock(min: number): number {
  if (min <= 0) return 0
  const now = clock.get().minutes
  const to = Math.min(DAY_MIN - 2, now + min)
  if (to <= now) return 0
  clock.setTime(to)
  return to - now
}
/** "1 j 35 m" / "1 h 35 m" / "18 mnt" / "18 min" */
export function durText(min: number, lang: Lang): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return lang === 'id' ? `${r} mnt` : `${r} min`
  if (!r) return lang === 'id' ? `${h} jam` : `${h} h`
  return lang === 'id' ? `${h} j ${r} m` : `${h} h ${r} m`
}

/* ------------------------------------------------------------------ personas */

export type PersonaKey = 'siti' | 'raka' | 'darmo'
export const PERSONA_KEYS: readonly PersonaKey[] = ['siti', 'raka', 'darmo']

/** the persona citizen from the world (seeded fictional characters) */
export function personaCitizen(s: WorldState, key: PersonaKey): Citizen | undefined {
  return s.citizens.byId[s.meta.personas[key]]
}
export function personaKeyOf(s: WorldState, citizenId: string | null | undefined): PersonaKey | null {
  if (!citizenId) return null
  for (const k of PERSONA_KEYS) if (s.meta.personas[k] === citizenId) return k
  return null
}

/** voice note sample per persona (shape of media VoiceSample, built here so the media chunk stays lazy) */
export interface VoiceSampleLite {
  id: string
  text: string
  lang: string
  title: Bi
  translation: Bi
}
/** BCP-47 code of a regional language for Web Speech / the voice label: the pack's own code, else "<lang>-ID" */
function speechFor(pack: RegionPack | null, lang: string): string {
  if (lang === 'id') return 'id-ID'
  return pack?.languages.speechCodes.find((c) => c.split('-')[0] === lang) ?? `${lang}-ID`
}
/** Pak Darmo's voice note in Basa Sunda / Baso Minang (sample texts, "contoh"; Basa Jawa below keeps its own id) */
const DARMO_RL: Record<string, string> = {
  su: 'Punten. KTP-el abdi ruksak, retak di tengah sareng teu tiasa kabaca ku mesin. Abdi tos sepuh, kumaha carana ngurus nu enggal?',
  min: 'Mohon maaf. KTP-el ambo rusak, retak di tangah jo indak bisa dibaco mesin. Ambo alah gaek, baa caronyo mangurus nan baru?',
}
const DARMO_TR: Bi = {
  id: 'Permisi. KTP-el saya rusak, retak di tengah dan tidak bisa dibaca mesin. Saya sudah tua, bagaimana cara mengurus yang baru?',
  en: 'Excuse me. My e-ID card is damaged, cracked in the middle and the reader cannot read it. I am elderly, how do I get a new one?',
}
export function voiceSampleFor(key: PersonaKey, pack: RegionPack | null): VoiceSampleLite {
  const regional = pack?.languages.regional[0]
  const speech = pack?.languages.speechCodes[0] ?? 'id-ID'
  const tpls = pack?.languages.samples.complaintTemplates ?? []
  if (key === 'siti') {
    const flood = tpls.filter((t) => t.category === 'banjir')
    const t = flood.find((x) => /tanggul|bocor/i.test(x.id + x.text)) ?? flood[0]
    if (t) return { id: `vn-${t.id}`, text: t.text, lang: speechFor(pack, t.lang), title: { id: 'Voice note Ibu Siti', en: "Ibu Siti's voice note" }, translation: t.translation }
  }
  const darmoRl = regional ? DARMO_RL[regional] : undefined
  if (key === 'darmo' && darmoRl) {
    return { id: `vn-darmo-ktp-${regional}`, lang: speechFor(pack, regional!), title: { id: 'Voice note Pak Darmo', en: "Pak Darmo's voice note" }, text: darmoRl, translation: DARMO_TR }
  }
  if (key === 'darmo' && regional === 'jv') {
    return {
      id: 'vn-darmo-ktp', lang: speech, title: { id: 'Voice note Pak Darmo', en: "Pak Darmo's voice note" },
      text: 'Kulanuwun. KTP-el kula rusak, retak tengah lan mboten saged kawaos mesin. Kula sampun sepuh, pripun carane ngurus ingkang enggal?',
      translation: {
        id: 'Permisi. KTP-el saya rusak, retak di tengah dan tidak bisa dibaca mesin. Saya sudah tua, bagaimana cara mengurus yang baru?',
        en: 'Excuse me. My e-ID card is damaged, cracked in the middle and the reader cannot read it. I am elderly, how do I get a new one?',
      },
    }
  }
  if (key === 'darmo') {
    return {
      id: 'vn-darmo-ktp-id', lang: 'id-ID', title: { id: 'Voice note Pak Darmo', en: "Pak Darmo's voice note" },
      text: 'Permisi, KTP-el saya rusak, retak dan tidak bisa dibaca mesin. Saya sudah tua, bagaimana cara mengurus yang baru?',
      translation: {
        id: 'Permisi, KTP-el saya rusak, retak dan tidak bisa dibaca mesin. Saya sudah tua, bagaimana cara mengurus yang baru?',
        en: 'Excuse me, my e-ID card is damaged and the reader cannot read it. I am elderly, how do I get a new one?',
      },
    }
  }
  const pju = tpls.find((t) => t.category === 'pju')
  const raka = 'Selamat pagi, lampu jalan di pertigaan dekat rumah saya sudah mati seminggu. Kalau malam gelap sekali, mohon segera diperbaiki.'
  return {
    id: 'vn-raka-pju', lang: 'id-ID', title: { id: 'Voice note Raka', en: "Raka's voice note" }, text: raka,
    translation: { id: raka, en: pju ? 'Good morning, the street light at the junction near my house has been out for a week. It is very dark at night, please fix it soon.' : 'Good morning, the street light near my house has been out for a week. Please fix it soon.' },
  }
}

/* ------------------------------------------------------------------ sample photos (inline SVG scenes in photos.tsx) */

export type PhotoId = 'genangan' | 'air-rumah' | 'lampu' | 'lubang' | 'sesudah' | 'surut'
export const PHOTO_META: Record<PhotoId, { category: ComplaintCategory | null; caption: Bi; title: Bi }> = {
  genangan: { category: 'banjir', title: { id: 'Genangan jalan desa', en: 'Flooded village road' }, caption: { id: 'Jalan depan SD sudah tergenang setinggi lutut, motor tidak bisa lewat.', en: 'The road in front of the primary school is knee-deep in water, motorbikes cannot pass.' } },
  'air-rumah': { category: 'banjir', title: { id: 'Air masuk halaman', en: 'Water in the yard' }, caption: { id: 'Air sudah masuk halaman rumah dan terus naik.', en: 'Water has entered the yard and keeps rising.' } },
  lampu: { category: 'pju', title: { id: 'Lampu jalan padam', en: 'Street light out' }, caption: { id: 'Lampu jalan di pertigaan ini mati, malam gelap sekali.', en: 'The street light at this junction is out, it is pitch dark at night.' } },
  lubang: { category: 'jalan-rusak', title: { id: 'Jalan berlubang', en: 'Pothole' }, caption: { id: 'Lubang besar di tengah jalan, sudah ada pengendara jatuh.', en: 'A big pothole in the middle of the road, a rider has already fallen.' } },
  surut: { category: null, title: { id: 'Sesudah ditangani: air surut', en: 'After the fix: water receded' }, caption: { id: 'Jalan depan SD yang sama, air sudah surut.', en: 'The same road in front of the school, the water has receded.' } },
  sesudah: { category: null, title: { id: 'Sesudah ditangani', en: 'After the fix' }, caption: { id: 'Kondisi sesudah ditangani petugas.', en: 'Condition after the crew fixed it.' } },
}
export const PERSONA_PHOTOS: Record<PersonaKey, PhotoId[]> = {
  siti: ['genangan', 'air-rumah', 'lubang'],
  raka: ['lampu', 'lubang', 'genangan'],
  darmo: ['lubang', 'lampu', 'genangan'],
}

/* ------------------------------------------------------------------ language detection (ID · EN · Jawa / Sunda / Minang) */

const JAWA = /\b(banyu|banyune|munggah|minggah|omah|omahe|omahku|griya|kelebon|dalan|dalane|margi|akeh|tiba|peteng|wengi|bengi|banget|sanget|sing|ingkang|ngarep|yen|menawi|maneh|kudu|wae|mawon|kalih|kula|kulo|dereng|durung|sampun|wis|uwis|uwuh|nyuwun|tulung|mboten|ora|niki|iki|neng|nang|ning|ing|lan|kaliyan|kebak|wingi|matur|badhe|tekan|ngendi|pripun|piye|kepripun|tanggule|mrembes|bocor|ndang|isa|saged|dipundhut|kapan|sakmenika|kawaos|enggal|sepuh|toya|jawah|sabin|lur|kulanuwun|sugeng|matur|nuwun|carane|ngurus|rusak|retak)\b/gi
const JAWA_STRONG = /\b(kula|kulo|banyune|munggah|minggah|mboten|ora|nyuwun|tulung|sampun|wis|dereng|durung|pripun|piye|nang|toya|griya|kulanuwun|sugeng|matur|nuwun|ndang|isa|saged|kawaos|tanggule|mrembes|lur)\b/gi
/** rough Basa Jawa detector: ≥ 2 Jawa words, at least one of them unambiguous */
export function looksJawa(text: string): boolean {
  return (text.match(JAWA) ?? []).length >= 2 && (text.match(JAWA_STRONG) ?? []).length >= 1
}
const EN = /\b(the|is|are|my|our|how|what|where|when|please|i|you|need|want|street|road|flood|flooded|apply|can|do|does|there|this|it|get|of|to|for|in|from|status|ticket|queue|book|requirements?)\b/gi
const ID = /\b(yang|dan|di|ke|dari|saya|kami|mau|apa|bagaimana|gimana|syarat|bikin|buat|tolong|mohon|sudah|belum|tidak|ada|jalan|rumah|lapor|banjir|antrean|kapan|berapa)\b/gi
export function looksEnglish(text: string): boolean {
  return (text.match(EN) ?? []).length >= 2 && (text.match(EN) ?? []).length > (text.match(ID) ?? []).length
}
const SUNDA = /\b(cai|imah|geus|naek|teu|henteu|abdi|kuring|punten|nyuhunkeun|tulung|lembur|kumaha|naon|ayeuna|caah|cileuncang|kakeueum|barudak|kolot|jeung|nu|ieu|eta|sareng|parantos|tos|mangga|hatur|nuhun|sabaraha|walungan|runtah|pareum|poek|ruksak|bolong|sakola|ngungsi|diungsikeun|beresih|kiruh|sabeuteung|tiasa|carana|enggal|sepuh|kabaca|gorong|mampet|tangkal|rubuh)\b/gi
const SUNDA_STRONG = /\b(geus|teu|henteu|abdi|kuring|punten|nyuhunkeun|kumaha|naon|ayeuna|caah|cileuncang|kakeueum|barudak|jeung|parantos|hatur|nuhun|sabaraha|walungan|runtah|pareum|ruksak|diungsikeun|kiruh|imah|sabeuteung|tiasa|mampet|rubuh)\b/gi
const MINANG = /\b(aia|alah|naiak|indak|ambo|awak|kampuang|baa|apo|banjia|tagenang|gaek|jo|nan|iko|sadonyo|batang|masuak|mangungsi|diungsian|barasiah|karuah|paralu|lutuik|sapinggang|tanggua|alun|suruik|sumua|caronyo|mangurus|tolong|parahu|dibaco|sumbek|banda|labek|tumbang|kayu|sakolah|dima)\b/gi
const MINANG_STRONG = /\b(aia|alah|naiak|indak|ambo|kampuang|baa|banjia|tagenang|gaek|sadonyo|masuak|mangungsi|diungsian|barasiah|karuah|paralu|lutuik|sapinggang|tanggua|alun|suruik|sumua|caronyo|mangurus|dibaco|sumbek|labek)\b/gi
const looks = (text: string, all: RegExp, strong: RegExp) => (text.match(all) ?? []).length >= 2 && (text.match(strong) ?? []).length >= 1
/** a regional language the citizen writes in: Basa Jawa anywhere; Basa Sunda / Baso Minang only where the running
 *  region speaks it (they share many words with Indonesian). `code` defaults to the region's first language. */
export function looksRegional(text: string, code: string | undefined = currentRegion()?.languages.regional[0]): 'jv' | 'su' | 'min' | null {
  if (code === 'su' && looks(text, SUNDA, SUNDA_STRONG)) return 'su'
  if (code === 'min' && looks(text, MINANG, MINANG_STRONG)) return 'min'
  return looksJawa(text) ? 'jv' : null
}
/** answer language: the regional language when the citizen writes it, English when they write English, else the UI language */
export function replyLang(text: string, ui: Lang): 'jv' | 'su' | 'min' | Lang {
  const rl = looksRegional(text)
  if (rl) return rl
  if (looksEnglish(text)) return 'en'
  if ((text.match(ID) ?? []).length >= 1) return 'id'
  return ui
}

/* ------------------------------------------------------------------ classification (reports) */

const REPORT_RULES: [ComplaintCategory, RegExp][] = [
  ['banjir', /banjir|banjia|caah|cileuncang|kakeueum|tagenang|tanggua|marembeh|kabanjiran|genang|kebanjiran|banyu(ne)? munggah|toya minggah|tanggul|mrembes|meluap|luap|flood|waterlog|air (sudah )?masuk|sepinggang|selutut/i],
  ['pohon-tumbang', /pohon tumbang|tumbang|tangkal .{0,12}rubuh|wit .{0,12}ambruk|fallen tree|tree (has )?fallen/i],
  ['pju', /lampu (jalan|dalan|penerangan)|\bpju\b|penerangan jalan|street ?light|lampu .{0,20}(mati|pareum)|peteng|poek/i],
  ['jalan-rusak', /jalan (rusak|ruksak|berlubang)|berlubang|lubang|bolong|aspal|pothole|road (is )?(damaged|broken)|dalan(e)? (rusak|bolong)|margi .{0,10}rusak|ambles/i],
  ['sampah', /sampah|uwuh|runtah|garbage|rubbish|trash|\btps\b/i],
  ['air-bersih', /air bersih|cai beresih|aia barasiah|pdam|air (mati|keruh|tidak mengalir)|banyu (pdam|resik)|water (supply|is off)|clean water|no water|sumur/i],
  ['pungli', /pungli|pungutan liar|dimintai uang|dipunsuwuni arta|suap|bribe|illegal (fee|levy)/i],
  ['kesehatan', /puskesmas|demam berdarah|\bdbd\b|fogging|jentik|health (centre|center)|dengue/i],
  ['sekolah', /atap (kelas|sekolah)|sekolah .{0,20}(rusak|bocor)|classroom|school roof/i],
]
/** detect a report category in a free text (null = probably a question, not a complaint) */
export function classifyReport(text: string): ComplaintCategory | null {
  for (const [cat, re] of REPORT_RULES) if (re.test(text)) return cat
  return null
}
/* ------------------------------------------------------------------ life safety (triase darurat) */

/**
 * Life-safety words (ID · Basa Jawa · EN): someone needs evacuating or rescuing. Such a complaint is not a public-works
 * job with a 24-hour SLA: the AI triage labels it Darurat and routes it straight to BPBD (Pusdalops), with the category's
 * own agency copied in (see triage.ts).
 */
const EMERGENCY = /evakuasi|dievakuasi|diungsikeun|diungsian|parahu karet|sabeuteung|sapinggang|perahu karet|kirim perahu|terjebak|terperangkap|sepinggang|sedada|terseret arus|tulung .{0,20}(ngungsi|dievakuasi)|evacuat|trapped|rescue|rubber boat|waist-deep|chest-deep/i
/** response target for a life-safety complaint (world minutes) */
export const EMERGENCY_RESPONSE_MIN = 60
export function isEmergency(c: { text: string; summary?: Bi; category: ComplaintCategory }): boolean {
  if (c.category !== 'banjir' && c.category !== 'pohon-tumbang' && c.category !== 'kesehatan' && c.category !== 'lainnya') return false
  return EMERGENCY.test(c.text) || EMERGENCY.test(c.summary?.id ?? '') || EMERGENCY.test(c.summary?.en ?? '')
}
/**
 * What the reporter actually needs, for "Gabungkan duplikat": only the same need may be merged (an evacuation request
 * never disappears into a drainage ticket, a contaminated well is a clean-water need, not a flood duplicate).
 */
export function needKey(c: { text: string; summary?: Bi; category: ComplaintCategory }): string {
  if (isEmergency(c)) return 'darurat'
  const t = `${c.text} ${c.summary?.id ?? ''}`
  if (/sumur|air bersih|clean water|\bwells?\b/i.test(t)) return 'air-bersih'
  if (c.category === 'banjir' && /posko|ngungsi|mengungsi|shelter/i.test(t)) return 'posko'
  return c.category
}

const URGENT = /sepinggang|evakuasi|terus naik|masuk rumah|mlebu omah|kabel .{0,10}(putus|pedhot)|bengi iki|malam ini|darurat|keselamatan|rising|emergency|waist|tumbang|ambruk|jatuh|tiba/i
export function urgencyOf(cat: ComplaintCategory, text: string): Urgency {
  if (URGENT.test(text) || cat === 'banjir' || cat === 'pohon-tumbang') return 'tinggi'
  if (cat === 'pungli' || cat === 'kesehatan' || cat === 'air-bersih' || cat === 'jalan-rusak') return 'sedang'
  return 'rendah'
}

/** Live structured `ticket.category` (free text) → world category */
export function categoryFromLabel(label: string): ComplaintCategory {
  const l = label.toLowerCase()
  for (const k of Object.keys(CATEGORY_LABEL) as ComplaintCategory[]) if (l === k || l === CATEGORY_LABEL[k].id.toLowerCase() || l === CATEGORY_LABEL[k].en.toLowerCase()) return k
  return classifyReport(l) ?? (/admin|ktp|akta|kk\b/.test(l) ? 'adminduk' : /bansos|aid/.test(l) ? 'bansos' : 'lainnya')
}

/* ------------------------------------------------------------------ world lookups */

export const kecName = (s: WorldState, id: string): string => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const desaName = (s: WorldState, kec: string, desa: string): string => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
export const opdShort = (s: WorldState, id: string): string => s.region.opd.find((o) => o.id === id)?.short ?? id
export const opdForCategory = (s: WorldState, c: ComplaintCategory): string => s.region.categoryOpd[c]
export const placeOf = (s: WorldState, kec: string, desa: string): string => `${desaName(s, kec, desa)}, Kec. ${kecName(s, kec)}`

/** the predicted next complaint code (SW-YYYY-####); the world may assign another if something else lands first */
export function nextComplaintCode(s: WorldState): string {
  return formatId('complaints', (s.meta.seq.complaints ?? 0) + 1, s.day.slice(0, 4))
}

/** offset a coordinate by km (east, north) */
export function offsetKm(c: LngLat, eastKm: number, northKm: number): LngLat {
  const lat = c[1] + northKm / 110.574
  const lng = c[0] + eastKm / (111.32 * Math.cos((c[1] * Math.PI) / 180))
  return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]
}

/** where a persona's report is pinned: near home, pulled towards the desa centre (keeps scenario reports within the 1 km cluster rule) */
export function reportCoord(s: WorldState, c: Citizen, variant: number): LngLat {
  const centre = s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.centroid ?? c.coord
  const mid: LngLat = [(c.coord[0] + centre[0]) / 2, (c.coord[1] + centre[1]) / 2]
  return variant === 0 ? offsetKm(c.coord, 0.04, 0.03) : offsetKm(mid, 0.06 * variant, 0.1)
}

/* ------------------------------------------------------------------ emitting */

export interface ReportInput {
  citizen: Citizen
  category: ComplaintCategory
  channel: ComplaintChannel
  text: string
  lang: Citizen['lang']
  summary: Bi
  coord?: LngLat
  kecamatanId?: string
  desaId?: string
  urgency?: Urgency
  photo?: boolean
  templateId?: string
}
export interface Created {
  complaintId: string
  ticketId: string
  code: string
}
/** emit complaint.created (source sapa-warga); ids come back synchronously */
export function createComplaint(s: WorldState, r: ReportInput, variant = 0): Created {
  const payload: EventMap['complaint.created'] = {
    citizenId: r.citizen.id, category: r.category, channel: r.channel, text: r.text, lang: r.lang, summary: r.summary,
    kecamatanId: r.kecamatanId ?? r.citizen.kecamatanId, desaId: r.desaId ?? r.citizen.desaId, coord: r.coord ?? reportCoord(s, r.citizen, variant),
    urgency: r.urgency ?? urgencyOf(r.category, r.text), photo: !!r.photo,
  }
  if (r.templateId) payload.templateId = r.templateId
  const e = emit('complaint.created', payload, SLUG)
  return { complaintId: e.payload.id ?? '', ticketId: e.payload.ticketId ?? '', code: e.payload.code ?? e.payload.id ?? '' }
}

/** summary (ID + EN) of a typed / spoken report */
export function summaryOf(s: WorldState, cat: ComplaintCategory, text: string, kec: string, desa: string, translation?: Bi | null): Bi {
  if (translation) return translation
  const place = placeOf(s, kec, desa)
  if (looksEnglish(text)) return { id: `Laporan ${CATEGORY_LABEL[cat].id.toLowerCase()} di ${place}: ${text}`, en: text }
  return { id: text, en: `${CATEGORY_LABEL[cat].en} report in ${desaName(s, kec, desa)}, ${kecName(s, kec)} district` }
}

/* ------------------------------------------------------------------ MPP booking */

export interface Slot {
  at: number
  left: number
}
/** the next bookable 30-minute slots (simulated occupancy: real bookings + a deterministic base load) */
export function bookingSlots(s: WorldState, serviceId: string, now: number): Slot[] {
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  let t = Math.max(day + SW.mppOpen, Math.ceil((now + 20) / SW.slotMin) * SW.slotMin)
  if (t >= day + SW.mppClose) t = day + DAY_MIN + SW.mppOpen
  const out: Slot[] = []
  const booked = rows(s.bookings)
  while (out.length < SW.slotCount) {
    const tod = t - Math.floor(t / DAY_MIN) * DAY_MIN
    if (tod >= SW.mppClose) {
      t = Math.floor(t / DAY_MIN) * DAY_MIN + DAY_MIN + SW.mppOpen
      continue
    }
    let h = 0
    for (const ch of `${serviceId}|${t}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const base = h % 7
    const real = booked.filter((b) => b.slotAt === t).length
    out.push({ at: t, left: Math.max(0, SW.slotCap - base - real) })
    t += SW.slotMin
  }
  return out
}
export const slotLabel = (at: number): string => hhmm(at).replace(':', '.')

export function bookQueue(citizenId: string, serviceId: string, slotAt: number): string {
  const e = emit('service.booked', { serviceId, citizenId, slotAt, channel: 'mpp' }, SLUG)
  return e.payload.code ?? e.payload.id ?? ''
}

/* ------------------------------------------------------------------ forming cluster (Klaster view) */

/** the densest group of today's unclustered flood complaints within the cluster radius */
export function formingCluster(s: WorldState, now: number): { ids: string[]; kecamatanId: string; desaId: string; center: LngLat } | null {
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const flood = rows(s.complaints).filter((c) => c.category === 'banjir' && !c.clusterId && c.at >= day && c.at <= now)
  let best: typeof flood = []
  let anchor = flood[0]
  for (const c of flood) {
    const near = flood.filter((x) => distanceKm(x.coord, c.coord) <= WORLD.clusterRadiusKm)
    if (near.length > best.length) {
      best = near
      anchor = c
    }
  }
  if (!anchor || best.length < 2) return null
  return { ids: best.map((c) => c.id), kecamatanId: anchor.kecamatanId, desaId: anchor.desaId, center: anchor.coord }
}

/** a neighbour (fictional citizen of the same desa, not a persona) reports the flood too */
export function neighbourReport(s: WorldState, center: LngLat, kecamatanId: string, desaId: string): Created | null {
  const personas = new Set(Object.values(s.meta.personas))
  const pool = rows(s.citizens).filter((c) => !personas.has(c.id) && c.kecamatanId === kecamatanId)
  const sameDesa = pool.filter((c) => c.desaId === desaId)
  const list = sameDesa.length ? sameDesa : pool
  if (!list.length) return null
  const n = rows(s.complaints).filter((c) => c.category === 'banjir' && c.kecamatanId === kecamatanId).length
  const c = list[n % list.length]!
  const desa = desaName(s, kecamatanId, desaId)
  const texts: Bi[] = [
    { id: `Air mulai masuk rumah di ${desa}, sudah sebetis dan terus naik.`, en: `Water is entering homes in ${desa}, calf-deep and still rising.` },
    { id: `Jalan utama ${desa} tergenang, anak sekolah tidak bisa lewat.`, en: `The main road of ${desa} is flooded, school children cannot get through.` },
    { id: `Sawah dan pekarangan di ${desa} tergenang sejak subuh.`, en: `Rice fields and yards in ${desa} have been flooded since dawn.` },
    { id: `Gang di belakang pasar ${desa} sudah tidak bisa dilewati motor, air setinggi lutut.`, en: `The alley behind the ${desa} market is knee-deep, motorbikes cannot pass.` },
    { id: `Saluran depan balai desa ${desa} meluap, air cokelat masuk ke teras warga.`, en: `The drain in front of the ${desa} village hall has overflowed; brown water is reaching porches.` },
    { id: `Kandang ternak di ujung ${desa} kemasukan air, kami pindahkan kambing ke tanggul.`, en: `Water got into the livestock pens at the edge of ${desa}; we are moving the goats up to the embankment.` },
    { id: `Musala di RT 02 ${desa} tergenang sekitar 30 cm, karpet sudah kami angkat.`, en: `The prayer house in RT 02, ${desa} has about 30 cm of water; we have lifted the carpets.` },
    { id: `Air dari sungai merembes lewat tanggul kecil di ${desa}, mohon dicek sebelum makin besar.`, en: `River water is seeping through the small embankment in ${desa}; please check it before it gets worse.` },
  ]
  const day = Math.floor(clock.get().minutes / DAY_MIN) * DAY_MIN
  const used = new Set(rows(s.complaints).filter((x) => x.category === 'banjir' && x.desaId === desaId && x.at >= day).map((x) => x.text))
  const k = texts.findIndex((_, i) => !used.has(texts[(n + i) % texts.length]!.id))
  const t = texts[(n + Math.max(0, k)) % texts.length]!
  const coord = offsetKm(center, ((n % 5) - 2) * 0.07, ((n % 3) - 1) * 0.08)
  return createComplaint(s, { citizen: c, category: 'banjir', channel: n % 2 ? 'web' : 'wa', text: t.id, lang: 'id', summary: t, coord, kecamatanId, desaId, urgency: 'tinggi', photo: n % 2 === 0 })
}

/* ------------------------------------------------------------------ AI context (sim reads it as ctx.world; live sends ≤ 6 KB) */

export interface SwService {
  id: string
  name: Bi
  requirements: Bi[]
  slaDays: number
  channel: 'mpp' | 'online' | 'kecamatan' | 'dinas'
  opd: string
  fee: Bi
}
export interface SwTicketRef {
  code: string
  ticketId: string
  status: string
  category: ComplaintCategory
  opd: string
  slaLeftMin: number
  rating: number | null
}
export interface SwContext {
  region: string
  now: string
  persona: { key: PersonaKey; name: string; gender: 'L' | 'P'; age: number; lang: string; kecamatanId: string; kecamatan: string; desaId: string; desa: string; address: string } | null
  services: SwService[]
  kecamatan: { id: string; name: string }[]
  categoryOpd: Record<string, string>
  /** queueAhead: today's MPP bookings whose slot starts within the next 60 minutes */
  today: { complaints: number; byCategory: Partial<Record<ComplaintCategory, number>>; open: number; mppBookings: number; queueAhead: number }
  myTickets: SwTicketRef[]
  nextCode: string
  /** set when the phone already created the ticket (voice note / photo report) before asking the AI to answer */
  justCreated: { code: string; category: ComplaintCategory; opd: string; slaHours: number; channel: ComplaintChannel; place: string; translation: Bi | null } | null
  /** posko: the shelter named in the warning this citizen received (the bot repeats the same place) */
  alertHere: { level: number; kecamatan: string; posko: string | null } | null
  clusterHere: { complaints: number; desa: string } | null
}

/** the shelter named in the newest early warning on this citizen's phone ("Posko pengungsian Balai Desa Temu") */
function poskoFor(s: WorldState, citizenId: string): string | null {
  let best: { at: number; text: string } | null = null
  for (const id of s.messages.ids) {
    const m = s.messages.byId[id]
    if (!m || m.kind !== 'peringatan' || !m.to.includes(citizenId)) continue
    if (!best || m.at >= best.at) best = { at: m.at, text: m.text.id }
  }
  const hit = best ? /posko(?: pengungsian)? (?:di )?([A-Z][^.,;:\n]*)/i.exec(best.text) : null
  return hit?.[1]?.trim() ?? null
}

export function buildContext(s: WorldState, pack: RegionPack | null, key: PersonaKey, now: number, justCreated: SwContext['justCreated']): SwContext {
  const c = personaCitizen(s, key)
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const today = rows(s.complaints).filter((x) => x.at >= day && x.at <= now)
  const byCategory: Partial<Record<ComplaintCategory, number>> = {}
  for (const x of today) byCategory[x.category] = (byCategory[x.category] ?? 0) + 1
  const open = rows(s.tickets).filter((t) => t.status !== 'selesai').length
  const mpp = rows(s.bookings).filter((b) => b.slotAt >= day && b.slotAt < day + DAY_MIN)
  const services: SwService[] = (pack?.services ?? []).map((v) => ({ id: v.id, name: v.name, requirements: v.requirements, slaDays: v.slaDays, channel: v.channel, opd: opdShort(s, v.opdId), fee: v.fee }))
  const myTickets: SwTicketRef[] = c
    ? rows(s.complaints).filter((x) => x.citizenId === c.id).map((x) => {
      const t = s.tickets.byId[x.ticketId]
      return { code: x.code, ticketId: x.ticketId, status: t?.status ?? 'baru', category: x.category, opd: opdShort(s, t?.opdId ?? opdForCategory(s, x.category)), slaLeftMin: t ? t.slaDueAt - now : 0, rating: t?.rating ?? null }
    })
    : []
  const alert = c ? rows(s.alerts).find((a) => a.status === 'aktif' && a.kecamatanIds.includes(c.kecamatanId)) : undefined
  const cl = c ? rows(s.clusters).find((k) => k.kecamatanId === c.kecamatanId && k.updatedAt >= day) : undefined
  const categoryOpd: Record<string, string> = {}
  for (const k of Object.keys(s.region.categoryOpd) as ComplaintCategory[]) categoryOpd[k] = opdShort(s, s.region.categoryOpd[k])
  return {
    region: s.region.shortName,
    now: hhmm(now),
    persona: c ? { key, name: c.name, gender: c.gender, age: c.age, lang: c.lang, kecamatanId: c.kecamatanId, kecamatan: kecName(s, c.kecamatanId), desaId: c.desaId, desa: desaName(s, c.kecamatanId, c.desaId), address: c.address } : null,
    services,
    kecamatan: s.region.kecamatan.map((k) => ({ id: k.id, name: k.name })),
    categoryOpd,
    today: { complaints: today.length, byCategory, open, mppBookings: mpp.length, queueAhead: mpp.filter((b) => b.slotAt >= now && b.slotAt < now + 60).length },
    myTickets,
    nextCode: nextComplaintCode(s),
    justCreated,
    alertHere: alert ? { level: alert.level, kecamatan: alert.kecamatanIds.map((k) => kecName(s, k)).join(', '), posko: poskoFor(s, c?.id ?? '') } : null,
    clusterHere: cl ? { complaints: cl.complaintIds.length, desa: desaName(s, cl.kecamatanId, cl.desaId) } : null,
  }
}

/**
 * The Live request body: the same facts in one language and short strings, so the whole service list fits the 6 KB
 * context budget (summarize() would otherwise halve the arrays and drop services such as NIB). The full context rides
 * along as a non-enumerable `full` property: summarize()/JSON skip it, while the Simulasi fallback (which receives
 * the same object) reads it.
 */
export const LIVE_CONTEXT_BYTES = 5600
export function liveContext(x: SwContext): object {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
  const size = (v: unknown) => (enc ? enc.encode(JSON.stringify(v)).length : JSON.stringify(v).length)
  const cut = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)
  const build = (reqChars: number) => ({
    region: x.region,
    now: x.now,
    persona: x.persona ? { nama: x.persona.name, gender: x.persona.gender, umur: x.persona.age, bahasa: x.persona.lang, desa: x.persona.desa, kecamatan: x.persona.kecamatan } : null,
    services: x.services.map((v) => ({ id: v.id, nama: v.name.id, syarat: cut(v.requirements.map((r) => r.id).join('; '), reqChars), slaHari: v.slaDays, kanal: v.channel, opd: v.opd, biaya: v.fee.id })),
    kecamatan: x.kecamatan.map((k) => k.name).join(', '),
    categoryOpd: x.categoryOpd,
    today: x.today,
    myTickets: x.myTickets.slice(-6).map((t) => ({ code: t.code, status: t.status, kategori: t.category, opd: t.opd, sisaSlaMenit: t.slaLeftMin, rating: t.rating })),
    nextCode: x.nextCode,
    justCreated: x.justCreated ? { code: x.justCreated.code, kategori: x.justCreated.category, opd: x.justCreated.opd, slaJam: x.justCreated.slaHours, kanal: x.justCreated.channel, tempat: x.justCreated.place, terjemahan: x.justCreated.translation?.id ?? null } : null,
    alertHere: x.alertHere,
    clusterHere: x.clusterHere,
    catatan: 'Data simulasi demo; jam layanan MPP 08.00–15.00 adalah contoh.',
  })
  let out = build(220)
  for (const n of [160, 110, 70, 40]) {
    if (size(out) <= LIVE_CONTEXT_BYTES) break
    out = build(n)
  }
  Object.defineProperty(out, 'full', { value: x, enumerable: false })
  return out
}

/** a place named by the Live AI (create_ticket.location: names, not ids) → the region's kecamatan / desa ids */
export function resolvePlace(s: WorldState, loc: unknown, fallback: { kecamatanId: string; desaId: string }): { kecamatanId: string; desaId: string } {
  const l = (loc && typeof loc === 'object' ? loc : {}) as { kecamatan?: unknown; desa?: unknown; detail?: unknown }
  const norm = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/\b(kecamatan|kec\.?|desa|kelurahan|kel\.?|ds\.?)\s*/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() : '')
  const kq = norm(l.kecamatan)
  const dq = norm(l.desa)
  const detail = norm(l.detail)
  const kecs = s.region.kecamatan
  let kec = kq ? kecs.find((k) => norm(k.name) === kq) ?? kecs.find((k) => kq.includes(norm(k.name)) || norm(k.name).includes(kq)) : undefined
  // a desa named without its kecamatan: search the whole region (the persona's kecamatan first)
  if (!kec && dq) {
    const order = [...kecs].sort((a, b) => Number(b.id === fallback.kecamatanId) - Number(a.id === fallback.kecamatanId))
    kec = order.find((k) => k.desa.some((d) => norm(d.name) === dq))
  }
  if (!kec && detail) kec = kecs.find((k) => detail.includes(norm(k.name)))
  if (!kec) return fallback
  const desa = (dq && kec.desa.find((d) => norm(d.name) === dq)) || (detail && kec.desa.find((d) => detail.includes(norm(d.name)))) || null
  if (desa) return { kecamatanId: kec.id, desaId: desa.id }
  return kec.id === fallback.kecamatanId ? fallback : { kecamatanId: kec.id, desaId: kec.desa[0]?.id ?? fallback.desaId }
}

/* ------------------------------------------------------------------ small formatting */

/** a category label that may break after its slash ("Flood/Waterlogging") instead of mid-word */
export const slashBreak = (v: string): string => v.replace(/\//g, '/​')

export const L = <T,>(lang: Lang, v: { id: T; en: T }): T => v[lang]
/**
 * Run `fn` right after the next paint (rAF → task). A tap paints its own feedback first (selected tab, cleared
 * composer) and the heavy re-render follows, so the interaction's next paint stays fast (INP ≤ 200 ms).
 * Returns a cancel function.
 */
export function afterPaint(fn: () => void): () => void {
  let t: ReturnType<typeof setTimeout> | null = null
  const r = requestAnimationFrame(() => {
    t = setTimeout(fn, 0)
  })
  return () => {
    cancelAnimationFrame(r)
    if (t !== null) clearTimeout(t)
  }
}
export function slaText(hours: number, lang: Lang): string {
  if (hours < 48) return lang === 'id' ? `${hours} jam` : `${hours} hours`
  const d = Math.round(hours / 24)
  return lang === 'id' ? `${d} hari` : `${d} days`
}
/** deterministic pseudo-random 0..1 from a string */
export function unit(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}
