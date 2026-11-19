/**
 * media/samples.ts — bundled "recordings": transcripts with speaker labels + timestamps (spoken by TTS or played
 * silently), and sample voice notes for VoiceRecorder's fallback. Officials appear by title only; customers and
 * agents are fictional.
 */
import { peaksForClip, timeline, type ClipMarker, type SpeechClip } from './playback'

/* ------------------------------------------------------------------ meeting (Naskah Pintar) */

/**
 * Tahap 7: the flood meeting is templated from the region (region/anchor.ts floodAnchor), so every pack gets its own
 * river, flood kecamatan, camat and embankment desa/kelurahan: `meetingBanjirFor(floodAnchor(pack))` +
 * `meetingBanjirNotesFor(…)`. MEETING_BANJIR / MEETING_BANJIR_NOTES stay as the default-world clip (same text as before).
 */
export interface MeetingPlaces {
  river: string
  /** flood kecamatan names, in order */
  floodKecamatan: readonly string[]
  /** the camat's kecamatan + the embankment's desa/kelurahan */
  kecamatan: string
  desa: string
  desaKind: 'desa' | 'kelurahan'
}

/** the default world's places (the clip as recorded in Tahap 2) */
const DEFAULT_PLACES: MeetingPlaces = { river: 'Bengawan Solo', floodKecamatan: ['Trucuk', 'Kalitidu', 'Bojonegoro', 'Kanor'], kecamatan: 'Kalitidu', desa: 'Ngujo', desaKind: 'desa' }

const listId = (a: readonly string[]) => (a.length < 2 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')}, dan ${a[a.length - 1]}`)
const listEn = (a: readonly string[]) => (a.length < 2 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

function meetingLines(p: MeetingPlaces) {
  const river = p.river || 'sungai'
  const Kind = p.desaKind === 'kelurahan' ? 'Kelurahan' : 'Desa'
  const kind = Kind.toLowerCase()
  const hallEn = p.desaKind === 'kelurahan' ? 'ward hall' : 'village hall'
  const areasEn = p.desaKind === 'kelurahan' ? 'riverside wards' : 'riverside villages'
  const kecs = p.floodKecamatan.length ? p.floodKecamatan : [p.kecamatan]
  return [
    { speaker: 'sekda', text: `Selamat pagi. Rapat koordinasi penanganan banjir kita mulai. Agenda pertama, kondisi ${river} pagi ini.`, en: `Good morning. Let us open the flood-response coordination meeting. First item: the ${river} this morning.` },
    { speaker: 'bpbd', text: `Pos pantau kota Siaga dua dan masih naik. Genangan ada di ${listId(kecs)}, tiga ratus dua belas rumah terdampak.`, en: `The city gauge is at alert level two and rising. Flooding in ${listEn(kecs)}, three hundred and twelve homes affected.` },
    { speaker: 'camat', text: `Di ${p.kecamatan} tanggul ${Kind} ${p.desa} merembes sekitar enam puluh meter. Warga minta karung pasir hari ini.`, en: `In ${p.kecamatan} the ${p.desa} embankment is seeping for about sixty metres. Residents ask for sandbags today.` },
    { speaker: 'pupr', text: 'Kami bisa kirim tim dan seribu lima ratus karung pasir siang ini. Pompa kami hanya enam unit, kurang empat.', en: 'We can send a team and one thousand five hundred sandbags this afternoon. We only have six pumps, four short.' },
    { speaker: 'sekda', text: `Keputusan pertama: Dinas PUPR menangani tanggul ${p.desa} hari ini, paling lambat pukul enam belas.`, en: `Decision one: Public Works handles the ${p.desa} embankment today, by four p.m. at the latest.` },
    { speaker: 'sekda', text: 'Kedua, ajukan pinjam pakai empat pompa ke balai wilayah sungai, tenggat besok.', en: 'Two: request a loan of four pumps from the river basin office, due tomorrow.' },
    { speaker: 'dinsos', text: 'Dapur umum sudah siap tiga titik. Kami butuh data penerima bansos yang sudah diverifikasi.', en: 'Three public kitchens are ready. We need verified aid-recipient data.' },
    { speaker: 'sekda', text: 'Dinas Sosial verifikasi berkas pendaftar bansos banjir, target lima puluh berkas hari ini, lewat Cek Berkas.', en: 'Social Affairs verifies flood-aid applications, fifty files today, through Cek Berkas.' },
    { speaker: 'bpbd', text: `Kami siapkan peringatan dini untuk ${kind} di bantaran. Siaran lewat kanal resmi jam sepuluh.`, en: `We will prepare early warnings for ${areasEn}, broadcast on official channels at ten.` },
    { speaker: 'camat', text: `Kecamatan siapkan balai ${kind} ${p.desa} sebagai titik evakuasi sementara, termasuk untuk lansia.`, en: `The district will prepare ${p.desa} ${hallEn} as a temporary evacuation point, including for the elderly.` },
    { speaker: 'sekda', text: `Baik. Camat ${p.kecamatan} laporkan kesiapan titik evakuasi sore ini. Rapat evaluasi besok pukul delapan.`, en: `Good. The Head of ${p.kecamatan} reports evacuation readiness this afternoon. Review meeting tomorrow at eight.` },
  ]
}

/** the flood meeting recording for a region's places (same timing shape, speakers and segment ids for every region) */
export function meetingBanjirFor(p: MeetingPlaces): SpeechClip {
  const segments = timeline(meetingLines(p))
  return {
    id: 'rapat-banjir',
    title: { id: 'Rapat Koordinasi Penanganan Banjir', en: 'Flood-response coordination meeting' },
    lang: 'id-ID',
    speakers: [
      { id: 'sekda', label: { id: 'Sekda', en: 'Regional Secretary' } },
      { id: 'pupr', label: { id: 'Kadis PUPR', en: 'Head of Public Works' } },
      { id: 'bpbd', label: { id: 'Kalaksa BPBD', en: 'Head of the Disaster Agency' } },
      { id: 'dinsos', label: { id: 'Kadinsos', en: 'Head of Social Affairs' } },
      { id: 'camat', label: { id: `Camat ${p.kecamatan}`, en: `Head of ${p.kecamatan} District` } },
    ],
    segments,
    peaks: peaksForClip(segments, 140, 11),
  }
}

export const MEETING_BANJIR: SpeechClip = meetingBanjirFor(DEFAULT_PLACES)

/** What the minutes extractor should find in a meeting clip (segment ids → items), for Naskah Pintar. */
export function meetingBanjirNotesFor(p: MeetingPlaces) {
  const Kind = p.desaKind === 'kelurahan' ? 'Kelurahan' : 'Desa'
  const hallEn = p.desaKind === 'kelurahan' ? 'ward hall' : 'village hall'
  const camat = `Camat ${p.kecamatan}`
  return {
    decisions: [
      { seg: 's5', text: { id: `Dinas PUPR menangani tanggul ${p.desa} hari ini`, en: `Public Works repairs the ${p.desa} embankment today` } },
      { seg: 's6', text: { id: 'Ajukan pinjam pakai 4 pompa ke balai wilayah sungai', en: 'Request a loan of 4 pumps from the river basin office' } },
      { seg: 's8', text: { id: 'Verifikasi 50 berkas bansos banjir hari ini', en: 'Verify 50 flood-aid files today' } },
    ],
    actions: [
      { seg: 's5', opdId: 'pupr', pic: 'Kadis PUPR', due: '2026-11-17T16:00', text: { id: `Tangani rembesan tanggul ${Kind} ${p.desa} + kirim 1.500 karung pasir`, en: `Fix the ${p.desa} embankment seepage + send 1,500 sandbags` } },
      { seg: 's6', opdId: 'pupr', pic: 'Kadis PUPR', due: '2026-11-18T12:00', text: { id: 'Ajukan pinjam pakai 4 pompa air portabel', en: 'Request the loan of 4 portable pumps' } },
      { seg: 's8', opdId: 'dinsos', pic: 'Kadinsos', due: '2026-11-17T17:00', text: { id: 'Verifikasi 50 berkas pendaftar bansos banjir', en: 'Verify 50 flood-aid applications' } },
      { seg: 's9', opdId: 'bpbd', pic: 'Kalaksa BPBD', due: '2026-11-17T10:00', text: { id: `Siarkan peringatan dini ${Kind.toLowerCase()} bantaran`, en: `Broadcast early warnings to riverside ${p.desaKind === 'kelurahan' ? 'wards' : 'villages'}` } },
      { seg: 's10', opdId: 'kecamatan', pic: camat, due: '2026-11-17T15:00', text: { id: `Siapkan balai ${Kind} ${p.desa} sebagai titik evakuasi`, en: `Prepare ${p.desa} ${hallEn} as an evacuation point` } },
      { seg: 's11', opdId: 'kecamatan', pic: camat, due: '2026-11-17T16:00', text: { id: 'Laporkan kesiapan titik evakuasi', en: 'Report evacuation-point readiness' } },
    ],
  } as const
}
export const MEETING_BANJIR_NOTES = meetingBanjirNotesFor(DEFAULT_PLACES)

/* ------------------------------------------------------------------ sales call (Juara Jualan) */

const CALL_LINES = [
  { speaker: 'agent', text: 'Selamat siang, dengan Bapak Darmaji? Saya Rina dari Arta Kencana Finance, mau konfirmasi pengajuan kredit motor Bapak.', en: 'Good afternoon, is this Mr Darmaji? This is Rina from Arta Kencana Finance, confirming your motorbike loan application.' },
  { speaker: 'customer', text: 'Iya, betul. Tapi saya masih ragu, cicilannya kok besar ya.', en: 'Yes, that is right. But I am still unsure, the instalment seems high.' },
  { speaker: 'agent', text: 'Untuk tenor dua puluh empat bulan cicilannya satu juta dua ratus ribu per bulan, Pak. Uang mukanya bisa dibayar hari ini.', en: 'For a twenty-four-month tenor it is one million two hundred thousand a month, sir. The down payment can be paid today.' },
  { speaker: 'customer', text: 'Kalau tenornya lebih panjang bisa lebih ringan? Penghasilan saya tidak tetap.', en: 'Can a longer tenor make it lighter? My income is not fixed.' },
  { speaker: 'agent', text: 'Promo bulan ini hanya sampai tanggal tiga puluh, Pak, jadi sebaiknya diputuskan sekarang.', en: 'This month’s promo only runs until the thirtieth, sir, so it is best to decide now.' },
  { speaker: 'customer', text: 'Hmm, saya pikir-pikir dulu, nanti saya kabari.', en: 'Hmm, let me think about it, I will let you know.' },
  { speaker: 'agent', text: 'Baik Pak, terima kasih. Selamat siang.', en: 'All right sir, thank you. Good afternoon.' },
]

export const SALES_CALL: SpeechClip = (() => {
  const segments = timeline(CALL_LINES, { wps: 2.8, gap: 0.5 })
  const at = (id: string) => segments.find((s) => s.id === id)?.start ?? 0
  const markers: ClipMarker[] = [
    { id: 'salam', t: at('s1'), label: { id: 'Salam & identifikasi', en: 'Greeting & identification' }, tone: 'ok' },
    { id: 'keberatan', t: at('s2'), label: { id: 'Keberatan harga', en: 'Price objection' }, tone: 'warn' },
    { id: 'penawaran', t: at('s3'), label: { id: 'Penawaran', en: 'Offer' }, tone: 'neutral' },
    { id: 'tidak-dijawab', t: at('s5'), label: { id: 'Keberatan tidak dijawab', en: 'Objection not answered' }, tone: 'danger' },
    { id: 'closing', t: at('s6'), label: { id: 'Closing gagal', en: 'Closing missed' }, tone: 'warn' },
  ]
  return {
    id: 'call-multifinance-0142',
    title: { id: 'Panggilan · pengajuan kredit motor', en: 'Call · motorbike loan application' },
    lang: 'id-ID',
    speakers: [
      { id: 'agent', label: { id: 'Agen (Rina)', en: 'Agent (Rina)' } },
      { id: 'customer', label: { id: 'Pelanggan', en: 'Customer' } },
    ],
    segments,
    markers,
    peaks: peaksForClip(segments, 120, 23),
  }
})()

/* ------------------------------------------------------------------ voice notes (VoiceRecorder fallback) */

export interface VoiceSample {
  id: string
  /** what the "recording" says (transcript the recogniser would produce) */
  text: string
  /** BCP-47 used for TTS playback */
  lang: string
  title: { id: string; en: string }
  translation?: { id: string; en: string }
}

export const VOICE_NOTES: VoiceSample[] = [
  {
    id: 'vn-tanggul-jv',
    text: 'Tanggule kali nang mburi balai desa bocor, banyune mrembes terus. Yen ora ndang ditambal, sak kampung isa kebanjiran bengi iki.',
    lang: 'jv-ID',
    title: { id: 'Voice note warga · Basa Jawa', en: 'Citizen voice note · Javanese' },
    translation: {
      id: 'Tanggul sungai di belakang balai desa bocor, airnya merembes terus. Kalau tidak segera ditambal, satu kampung bisa kebanjiran malam ini.',
      en: 'The river embankment behind the village hall is leaking and water keeps seeping through. If it is not patched soon, the whole hamlet could flood tonight.',
    },
  },
  {
    id: 'vn-lampu-id',
    text: 'Selamat pagi, lampu jalan di pertigaan Desa Sumbang sudah mati seminggu. Kalau malam gelap sekali, mohon segera diperbaiki.',
    lang: 'id-ID',
    title: { id: 'Voice note warga · Bahasa Indonesia', en: 'Citizen voice note · Indonesian' },
    translation: {
      id: 'Selamat pagi, lampu jalan di pertigaan Desa Sumbang sudah mati seminggu. Kalau malam gelap sekali, mohon segera diperbaiki.',
      en: 'Good morning, the street light at the Sumbang junction has been out for a week. It is very dark at night, please fix it soon.',
    },
  },
]

/** Build a voice-note sample from a region-pack complaint template. */
export function voiceNoteFromTemplate(t: { id: string; text: string; lang: string; translation: { id: string; en: string } }, speechCode = 'jv-ID'): VoiceSample {
  return { id: `vn-${t.id}`, text: t.text, lang: speechCode, title: { id: 'Voice note warga', en: 'Citizen voice note' }, translation: t.translation }
}
