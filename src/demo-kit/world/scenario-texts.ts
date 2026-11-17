/**
 * world/scenario-texts.ts — tahap-2 Satu Daerah scenario texts (the false-narrative burst, phone messages, topics
 * raised by events). Used by the event pipeline (reactions), natural-gen and world/satu-daerah — NOT by the
 * generator, so a first visit does not download them before the visitor acts. All names are FICTIONAL.
 */
import type { Bi, EventMap, Minutes } from './types'

/* ------------------------------------------------------------------ tahap 2: Satu Daerah scenario texts */

/**
 * The false narrative Radar Isu catches (spec P4 step 2). `{dam}` = the real dam landmark of the pack
 * (pack.scenario.damLandmarkId), `{k}` = a flood kecamatan. Accounts and outlets are FICTIONAL.
 */
export const HOAX_SCENARIO = {
  /** = WORLD.hoaxRumor */
  rumor: 'waduk-jebol',
  topic: 'hoaks-bendungan',
  claim: { id: '{dam} jebol, air bah menuju permukiman', en: '{dam} has burst, flood water heading for homes' },
  accounts: ['@kabar.kilat.88', '@info.darurat.jatim', '@warga.siaga.id', '@berita.viral.now'],
  posts: [
    { id: 'BREAKING!! {dam} JEBOL pagi ini, warga {k} segera mengungsi!!!', en: 'BREAKING!! {dam} BURST this morning, residents of {k} evacuate now!!!' },
    { id: 'Katanya {dam} retak dan airnya sudah keluar, benar ga sih? Sebarkan ke keluarga', en: 'They say {dam} cracked and water is coming out, is it true? Share with family' },
    { id: 'Video detik-detik {dam} jebol, air bah sampai {k}', en: 'Video of the moment {dam} burst, flood water reaching {k}' },
    { id: 'Info grup RT: {dam} jebol, sekolah di {k} diliburkan', en: 'Neighbourhood group: {dam} burst, schools in {k} closed' },
    { id: 'Ya Allah {dam} jebol, mohon doanya warga {k}', en: 'Oh God {dam} burst, pray for the people of {k}' },
    { id: 'Siapa yang punya info resmi? Katanya {dam} jebol', en: 'Anyone with official info? They say {dam} burst' },
    { id: 'Air dari {dam} sudah sampai jalan raya {k}, jangan lewat!', en: 'Water from {dam} already on the main road in {k}, avoid it!' },
    { id: 'Teruskan! {dam} jebol, pemerintah diam saja', en: 'Pass it on! {dam} burst and the government says nothing' },
  ] as Bi[],
  evidence: {
    id: 'Tinggi muka air {dam} {level} m, di bawah batas siaga {siaga} m (pos pantau Siaga Wilayah, data simulasi). Tidak ada laporan kerusakan bendungan.',
    en: '{dam} water level {level} m, below the alert level {siaga} m (Siaga Wilayah gauge, simulated data). No dam damage reported.',
  },
  /** positive / neutral mentions after a clarification (sentiment recovery) */
  recovery: [
    { s: 0.55, t: { id: 'Pemkab {r} pastikan {dam} aman, kabar jebol adalah hoaks', en: '{r} government confirms {dam} is safe, the burst story is a hoax' } },
    { s: 0.4, t: { id: 'Alhamdulillah, ternyata {dam} aman. Jangan asal sebar ya', en: 'Thank God, {dam} is safe after all. Do not share blindly' } },
    { s: 0.35, t: { id: 'BPBD {r} rilis data tinggi muka air {dam}: normal', en: '{r} disaster agency releases {dam} water level data: normal' } },
    { s: 0.25, t: { id: 'Klarifikasi resmi soal {dam} sudah keluar, cek akun resmi pemkab', en: 'Official clarification on {dam} is out, check the government account' } },
    { s: 0.45, t: { id: 'Warga {k} kembali tenang setelah klarifikasi {dam}', en: 'Residents of {k} calm again after the {dam} clarification' } },
  ] as { s: number; t: Bi }[],
}

/** phone messages (Sapa Warga "HP Warga") */
export const NOTIFY_TEXT = {
  ticket: {
    id: 'Tiket {code}: status kini "{status}". {opd}',
    en: 'Ticket {code}: status is now "{status}". {opd}',
  },
  alert: {
    id: 'PERINGATAN DINI BANJIR level {level} untuk Kec. {kec}. Amankan dokumen penting, siapkan tas siaga, ikuti arahan petugas. Darurat: 112.',
    en: 'EARLY FLOOD WARNING level {level} for {kec} district. Secure important documents, prepare a go-bag, follow officials. Emergency: 112.',
  },
  booking: {
    id: 'Antrean {code} untuk {service}, pukul {time} di {place}. Tunjukkan QR ini di loket.',
    en: 'Queue {code} for {service}, {time} at {place}. Show this QR at the counter.',
  },
}

/** Radar Isu topics raised by Satu Daerah events (fictional outlets; {k} kecamatan, {d} desa, {r} region) */
export const EVENT_MENTION_TEXT = {
  flood: { s: -0.35, t: { id: 'BPBD {r} keluarkan peringatan banjir untuk Kec. {k}', en: '{r} disaster agency issues a flood warning for {k} district' } },
  floodSocial: { s: -0.55, t: { id: 'Air Bengawan naik terus, warga {k} mulai angkut barang ke tempat tinggi', en: 'The river keeps rising, residents of {k} move belongings to higher ground' } },
  cluster: { s: -0.6, t: { id: 'Warga {d} ramai-ramai lapor banjir ke kanal aduan pemkab', en: 'Residents of {d} flood the government complaint channel with flood reports' } },
}

/** minutes after the start of the burst at which each HOAX_SCENARIO post appears */
export const HOAX_OFFSETS = [0, 6, 11, 15, 18, 21, 23, 25] as const

/** the i-th post of the false-narrative burst as a mention.created payload (burst starting at `start`) */
export function hoaxPost(i: number, start: Minutes, dam: string, kecamatan: string, rumor: string): EventMap['mention.created'] {
  const t = HOAX_SCENARIO.posts[i % HOAX_SCENARIO.posts.length]!
  const author = HOAX_SCENARIO.accounts[i % HOAX_SCENARIO.accounts.length]!
  const f = (x: string) => x.replace(/\{dam\}/g, dam).replace(/\{k\}/g, kecamatan)
  return {
    at: start + (HOAX_OFFSETS[i] ?? 25 + i), outlet: author, kind: i === 3 ? 'forum' : 'sosmed', author, text: { id: f(t.id), en: f(t.en) },
    sentiment: 'negatif', score: Math.round((-0.7 - (i % 3) * 0.08) * 100) / 100, topic: HOAX_SCENARIO.topic, reach: Math.round(1800 * 1.55 ** i), rumor,
  }
}
