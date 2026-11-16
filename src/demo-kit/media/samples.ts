/**
 * media/samples.ts — bundled "recordings": transcripts with speaker labels + timestamps (spoken by TTS or played
 * silently), and sample voice notes for VoiceRecorder's fallback. Officials appear by title only; customers and
 * agents are fictional.
 */
import { peaksForClip, timeline, type ClipMarker, type SpeechClip } from './playback'

/* ------------------------------------------------------------------ meeting (Naskah Pintar) */

const MEETING_LINES = [
  { speaker: 'sekda', text: 'Selamat pagi. Rapat koordinasi penanganan banjir kita mulai. Agenda pertama, kondisi Bengawan Solo pagi ini.', en: 'Good morning. Let us open the flood-response coordination meeting. First item: the Bengawan Solo this morning.' },
  { speaker: 'bpbd', text: 'Pos pantau kota Siaga dua dan masih naik. Genangan ada di Trucuk, Kalitidu, Bojonegoro, dan Kanor, tiga ratus dua belas rumah terdampak.', en: 'The city gauge is at alert level two and rising. Flooding in Trucuk, Kalitidu, Bojonegoro and Kanor, three hundred and twelve homes affected.' },
  { speaker: 'camat', text: 'Di Kalitidu tanggul Desa Ngujo merembes sekitar enam puluh meter. Warga minta karung pasir hari ini.', en: 'In Kalitidu the Ngujo embankment is seeping for about sixty metres. Residents ask for sandbags today.' },
  { speaker: 'pupr', text: 'Kami bisa kirim tim dan seribu lima ratus karung pasir siang ini. Pompa kami hanya enam unit, kurang empat.', en: 'We can send a team and one thousand five hundred sandbags this afternoon. We only have six pumps, four short.' },
  { speaker: 'sekda', text: 'Keputusan pertama: Dinas PUPR menangani tanggul Ngujo hari ini, paling lambat pukul enam belas.', en: 'Decision one: Public Works handles the Ngujo embankment today, by four p.m. at the latest.' },
  { speaker: 'sekda', text: 'Kedua, ajukan pinjam pakai empat pompa ke balai wilayah sungai, tenggat besok.', en: 'Two: request a loan of four pumps from the river basin office, due tomorrow.' },
  { speaker: 'dinsos', text: 'Dapur umum sudah siap tiga titik. Kami butuh data penerima bansos yang sudah diverifikasi.', en: 'Three public kitchens are ready. We need verified aid-recipient data.' },
  { speaker: 'sekda', text: 'Dinas Sosial verifikasi berkas pendaftar bansos banjir, target lima puluh berkas hari ini, lewat Cek Berkas.', en: 'Social Affairs verifies flood-aid applications, fifty files today, through Cek Berkas.' },
  { speaker: 'bpbd', text: 'Kami siapkan peringatan dini untuk desa di bantaran. Siaran lewat kanal resmi jam sepuluh.', en: 'We will prepare early warnings for riverside villages, broadcast on official channels at ten.' },
  { speaker: 'camat', text: 'Kecamatan siapkan balai desa Ngujo sebagai titik evakuasi sementara, termasuk untuk lansia.', en: 'The district will prepare Ngujo village hall as a temporary evacuation point, including for the elderly.' },
  { speaker: 'sekda', text: 'Baik. Camat Kalitidu laporkan kesiapan titik evakuasi sore ini. Rapat evaluasi besok pukul delapan.', en: 'Good. The Head of Kalitidu reports evacuation readiness this afternoon. Review meeting tomorrow at eight.' },
]

export const MEETING_BANJIR: SpeechClip = (() => {
  const segments = timeline(MEETING_LINES)
  return {
    id: 'rapat-banjir',
    title: { id: 'Rapat Koordinasi Penanganan Banjir', en: 'Flood-response coordination meeting' },
    lang: 'id-ID',
    speakers: [
      { id: 'sekda', label: { id: 'Sekda', en: 'Regional Secretary' } },
      { id: 'pupr', label: { id: 'Kadis PUPR', en: 'Head of Public Works' } },
      { id: 'bpbd', label: { id: 'Kalaksa BPBD', en: 'Head of Disaster Agency' } },
      { id: 'dinsos', label: { id: 'Kadinsos', en: 'Head of Social Affairs' } },
      { id: 'camat', label: { id: 'Camat Kalitidu', en: 'Head of Kalitidu District' } },
    ],
    segments,
    peaks: peaksForClip(segments, 140, 11),
  }
})()

/** What the minutes extractor should find in MEETING_BANJIR (segment ids → items), for Naskah Pintar. */
export const MEETING_BANJIR_NOTES = {
  decisions: [
    { seg: 's5', text: { id: 'Dinas PUPR menangani tanggul Ngujo hari ini', en: 'Public Works repairs the Ngujo embankment today' } },
    { seg: 's6', text: { id: 'Ajukan pinjam pakai 4 pompa ke balai wilayah sungai', en: 'Request a loan of 4 pumps from the river basin office' } },
    { seg: 's8', text: { id: 'Verifikasi 50 berkas bansos banjir hari ini', en: 'Verify 50 flood-aid files today' } },
  ],
  actions: [
    { seg: 's5', opdId: 'pupr', pic: 'Kadis PUPR', due: '2026-11-17T16:00', text: { id: 'Tangani rembesan tanggul Desa Ngujo + kirim 1.500 karung pasir', en: 'Fix the Ngujo embankment seepage + send 1,500 sandbags' } },
    { seg: 's6', opdId: 'pupr', pic: 'Kadis PUPR', due: '2026-11-18T12:00', text: { id: 'Ajukan pinjam pakai 4 pompa air portabel', en: 'Request the loan of 4 portable pumps' } },
    { seg: 's8', opdId: 'dinsos', pic: 'Kadinsos', due: '2026-11-17T17:00', text: { id: 'Verifikasi 50 berkas pendaftar bansos banjir', en: 'Verify 50 flood-aid applications' } },
    { seg: 's9', opdId: 'bpbd', pic: 'Kalaksa BPBD', due: '2026-11-17T10:00', text: { id: 'Siarkan peringatan dini desa bantaran', en: 'Broadcast early warnings to riverside villages' } },
    { seg: 's10', opdId: 'kecamatan', pic: 'Camat Kalitidu', due: '2026-11-17T15:00', text: { id: 'Siapkan balai Desa Ngujo sebagai titik evakuasi', en: 'Prepare Ngujo village hall as an evacuation point' } },
    { seg: 's11', opdId: 'kecamatan', pic: 'Camat Kalitidu', due: '2026-11-17T16:00', text: { id: 'Laporkan kesiapan titik evakuasi', en: 'Report evacuation-point readiness' } },
  ],
} as const

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
