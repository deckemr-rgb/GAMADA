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
  CATEGORY_LABEL, DAY_MIN, WORLD, distanceKm, emit, formatId, hhmm, rows,
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
  /** delay before the mobile layout switches to the console tab after a ticket is created (ms) */
  tabSwitchMs: 650,
} as const

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
export function voiceSampleFor(key: PersonaKey, pack: RegionPack | null): VoiceSampleLite {
  const regional = pack?.languages.regional[0]
  const speech = pack?.languages.speechCodes[0] ?? 'id-ID'
  const tpls = pack?.languages.samples.complaintTemplates ?? []
  if (key === 'siti') {
    const flood = tpls.filter((t) => t.category === 'banjir')
    const t = flood.find((x) => /tanggul|bocor/i.test(x.id + x.text)) ?? flood[0]
    if (t) return { id: `vn-${t.id}`, text: t.text, lang: speech, title: { id: 'Voice note Ibu Siti', en: "Ibu Siti's voice note" }, translation: t.translation }
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

export type PhotoId = 'genangan' | 'air-rumah' | 'lampu' | 'lubang' | 'sesudah'
export const PHOTO_META: Record<PhotoId, { category: ComplaintCategory | null; caption: Bi; title: Bi }> = {
  genangan: { category: 'banjir', title: { id: 'Genangan jalan desa', en: 'Flooded village road' }, caption: { id: 'Jalan depan SD sudah tergenang setinggi lutut, motor tidak bisa lewat.', en: 'The road in front of the primary school is knee-deep in water, motorbikes cannot pass.' } },
  'air-rumah': { category: 'banjir', title: { id: 'Air masuk halaman', en: 'Water in the yard' }, caption: { id: 'Air sudah masuk halaman rumah dan terus naik.', en: 'Water has entered the yard and keeps rising.' } },
  lampu: { category: 'pju', title: { id: 'Lampu jalan padam', en: 'Street light out' }, caption: { id: 'Lampu jalan di pertigaan ini mati, malam gelap sekali.', en: 'The street light at this junction is out, it is pitch dark at night.' } },
  lubang: { category: 'jalan-rusak', title: { id: 'Jalan berlubang', en: 'Pothole' }, caption: { id: 'Lubang besar di tengah jalan, sudah ada pengendara jatuh.', en: 'A big pothole in the middle of the road, a rider has already fallen.' } },
  sesudah: { category: null, title: { id: 'Sesudah ditangani', en: 'After the fix' }, caption: { id: 'Kondisi sesudah ditangani petugas.', en: 'Condition after the crew fixed it.' } },
}
export const PERSONA_PHOTOS: Record<PersonaKey, PhotoId[]> = {
  siti: ['genangan', 'air-rumah', 'lubang'],
  raka: ['lampu', 'lubang', 'genangan'],
  darmo: ['lubang', 'lampu', 'genangan'],
}

/* ------------------------------------------------------------------ language detection (ID · EN · Basa Jawa) */

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
/** answer language: Basa Jawa when the citizen writes it, English when they write English, else the UI language */
export function replyLang(text: string, ui: Lang): 'jv' | Lang {
  if (looksJawa(text)) return 'jv'
  if (looksEnglish(text)) return 'en'
  if ((text.match(ID) ?? []).length >= 1) return 'id'
  return ui
}

/* ------------------------------------------------------------------ classification (reports) */

const REPORT_RULES: [ComplaintCategory, RegExp][] = [
  ['banjir', /banjir|genang|kebanjiran|banyu(ne)? munggah|toya minggah|tanggul|mrembes|meluap|luap|flood|waterlog|air (sudah )?masuk|sepinggang|selutut/i],
  ['pohon-tumbang', /pohon tumbang|tumbang|wit .{0,12}ambruk|fallen tree|tree (has )?fallen/i],
  ['pju', /lampu (jalan|dalan|penerangan)|\bpju\b|penerangan jalan|street ?light|lampu .{0,20}mati|peteng/i],
  ['jalan-rusak', /jalan (rusak|berlubang)|berlubang|lubang|bolong|aspal|pothole|road (is )?(damaged|broken)|dalan(e)? (rusak|bolong)|margi .{0,10}rusak|ambles/i],
  ['sampah', /sampah|uwuh|garbage|rubbish|trash|\btps\b/i],
  ['air-bersih', /air bersih|pdam|air (mati|keruh|tidak mengalir)|banyu (pdam|resik)|water (supply|is off)|clean water|no water|sumur/i],
  ['pungli', /pungli|pungutan liar|dimintai uang|dipunsuwuni arta|suap|bribe|illegal (fee|levy)/i],
  ['kesehatan', /puskesmas|demam berdarah|\bdbd\b|fogging|jentik|health (centre|center)|dengue/i],
  ['sekolah', /atap (kelas|sekolah)|sekolah .{0,20}(rusak|bocor)|classroom|school roof/i],
]
/** detect a report category in a free text (null = probably a question, not a complaint) */
export function classifyReport(text: string): ComplaintCategory | null {
  for (const [cat, re] of REPORT_RULES) if (re.test(text)) return cat
  return null
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
  ]
  const t = texts[n % texts.length]!
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
  today: { complaints: number; byCategory: Partial<Record<ComplaintCategory, number>>; open: number; mppBookings: number; queueAhead: number }
  myTickets: SwTicketRef[]
  nextCode: string
  /** set when the phone already created the ticket (voice note / photo report) before asking the AI to answer */
  justCreated: { code: string; category: ComplaintCategory; opd: string; slaHours: number; channel: ComplaintChannel; place: string; translation: Bi | null } | null
  alertHere: { level: number; kecamatan: string } | null
  clusterHere: { complaints: number; desa: string } | null
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
    today: { complaints: today.length, byCategory, open, mppBookings: mpp.length, queueAhead: mpp.filter((b) => b.slotAt <= now + 60).length + 3 },
    myTickets,
    nextCode: nextComplaintCode(s),
    justCreated,
    alertHere: alert ? { level: alert.level, kecamatan: alert.kecamatanIds.map((k) => kecName(s, k)).join(', ') } : null,
    clusterHere: cl ? { complaints: cl.complaintIds.length, desa: desaName(s, cl.kecamatanId, cl.desaId) } : null,
  }
}

/* ------------------------------------------------------------------ small formatting */

export const L = <T,>(lang: Lang, v: { id: T; en: T }): T => v[lang]
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
