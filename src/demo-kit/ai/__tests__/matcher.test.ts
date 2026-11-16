/**
 * Self-test: matcher accuracy on held-out paraphrases (none of these strings is an intent example).
 * Run: npx tsx src/demo-kit/ai/__tests__/matcher.test.ts   (exits non-zero on failure)
 */
import { createMatcher, extractSlots, stem } from '../intents'
import { sampleScenario } from '../__fixtures__/sample-scenario'

type Case = [text: string, expected: string | null, lang: 'id' | 'en']

export const HELD_OUT: Case[] = [
  // lapor-banjir
  ['rumah saya terendam banjir sejak subuh', 'lapor-banjir', 'id'],
  ['air sudah masuk rumah, banjirnya makin tinggi di Trucuk', 'lapor-banjir', 'id'],
  ['the river overflowed and flooded the houses', 'lapor-banjir', 'en'],
  ['flooding in Baureno, water is knee deep', 'lapor-banjir', 'en'],
  ['banyu munggah neng Kanor, omahe kelebon banyu', 'lapor-banjir', 'id'],
  ['desa kula kebanjiran, banyune dhuwur', 'lapor-banjir', 'id'],
  // lapor-jalan-rusak
  ['jalan menuju pasar banyak lubangnya', 'lapor-jalan-rusak', 'id'],
  ['aspal di jalan raya Kapas rusak dan berlubang', 'lapor-jalan-rusak', 'id'],
  ['potholes everywhere on the village road', 'lapor-jalan-rusak', 'en'],
  ['the road to school is broken and dangerous', 'lapor-jalan-rusak', 'en'],
  ['dalane ajur, motor kula meh tiba', 'lapor-jalan-rusak', 'id'],
  ['jeglongan gedhe neng dalan desa', 'lapor-jalan-rusak', 'id'],
  // lampu-pju-mati
  ['PJU di perempatan tidak nyala tiga hari', 'lampu-pju-mati', 'id'],
  ['lampu jalan padam, gelap gulita kalau malam', 'lampu-pju-mati', 'id'],
  ['street lights are not working near the mosque', 'lampu-pju-mati', 'en'],
  ['lampune dalan ora murup wis seminggu', 'lampu-pju-mati', 'id'],
  // sampah-jawa
  ['uwuh neng ngarep omah durung dijupuk', 'sampah-jawa', 'id'],
  ['sampah menumpuk di pinggir jalan dan bau', 'sampah-jawa', 'id'],
  ['the rubbish bins are overflowing and nobody collects them', 'sampah-jawa', 'en'],
  ['uwuhe wis numpuk telung dina', 'sampah-jawa', 'id'],
  ['tolong sampah di TPS desa belum diambil', 'sampah-jawa', 'id'],
  // syarat-ktp
  ['persyaratan membuat ktp elektronik', 'syarat-ktp', 'id'],
  ['ktp saya rusak, bisa ganti baru? bawa apa saja', 'syarat-ktp', 'id'],
  ['requirements for a new identity card', 'syarat-ktp', 'en'],
  ['I lost my ID card, what should I bring?', 'syarat-ktp', 'en'],
  ['ngurus ktp kudu nggawa apa wae?', 'syarat-ktp', 'id'],
  // cek-status
  ['status tiket SW-2416 bagaimana?', 'cek-status', 'id'],
  ['sudah sampai mana laporan jalan saya kemarin', 'cek-status', 'id'],
  ['any update on my complaint?', 'cek-status', 'en'],
  ['check the progress of ticket SW-2417', 'cek-status', 'en'],
  ['laporan kula sampun dugi pundi?', 'cek-status', 'id'],
  // jam-layanan
  ['mal pelayanan publik buka jam berapa ya', 'jam-layanan', 'id'],
  ['jam operasional dukcapil hari jumat', 'jam-layanan', 'id'],
  ['what time does the public service mall open', 'jam-layanan', 'en'],
  ['office hours on friday?', 'jam-layanan', 'en'],
  ['capil tutup jam pinten?', 'jam-layanan', 'id'],
  // teruskan-petugas
  ['tolong hubungkan saya ke petugas', 'teruskan-petugas', 'id'],
  ['bisa bicara langsung dengan admin?', 'teruskan-petugas', 'id'],
  ['I want to speak with a real person', 'teruskan-petugas', 'en'],
  ['forward this to an officer please', 'teruskan-petugas', 'en'],
  ['sambungke kalih petugas mawon', 'teruskan-petugas', 'id'],
  // out of scope → fallback
  ['resep nasi goreng yang enak', null, 'id'],
  ['who won the football match last night', null, 'en'],
  ['harga emas hari ini berapa', null, 'id'],
  ['tell me a joke', null, 'en'],
]

/** Second batch, written after the synonym tuning and never tuned against (honest held-out figure). */
export const HELD_OUT_2: Case[] = [
  ['genangan air setinggi paha di depan balai desa', 'lapor-banjir', 'id'],
  ['water came into our house last night, the whole street is under water', 'lapor-banjir', 'en'],
  ['kali e meluap, sawah lan omah kerendem', 'lapor-banjir', 'id'],
  ['ada jalan ambles di dekat jembatan', 'lapor-jalan-rusak', 'id'],
  ['please fix the damaged road in front of the clinic', 'lapor-jalan-rusak', 'en'],
  ['dalan desa rusak, aspale mengelupas kabeh', 'lapor-jalan-rusak', 'id'],
  ['penerangan jalan umum di dusun kami mati total', 'lampu-pju-mati', 'id'],
  ['the street lamp outside my house went out', 'lampu-pju-mati', 'en'],
  ['lampu pju neng prapatan mati', 'lampu-pju-mati', 'id'],
  ['truk sampah tidak datang sudah dua minggu', 'sampah-jawa', 'id'],
  ['garbage piling up at the market', 'sampah-jawa', 'en'],
  ['uwuh neng kali numpuk, mambu banget', 'sampah-jawa', 'id'],
  ['cara ganti ktp yang hilang', 'syarat-ktp', 'id'],
  ['documents needed for e-KTP', 'syarat-ktp', 'en'],
  ['damel ktp anyar kedah bekta napa?', 'syarat-ktp', 'id'],
  ['aduan saya kemarin sudah ditindaklanjuti belum?', 'cek-status', 'id'],
  ['what happened with ticket SW-2416', 'cek-status', 'en'],
  ['laporanku piye kabare?', 'cek-status', 'id'],
  ['hari minggu MPP buka tidak?', 'jam-layanan', 'id'],
  ['opening hours of the dukcapil office', 'jam-layanan', 'en'],
  ['saya ingin dilayani petugas saja', 'teruskan-petugas', 'id'],
  ['can a staff member help me instead', 'teruskan-petugas', 'en'],
  ['bagaimana cara daftar beasiswa kuliah', null, 'id'],
  ['recommend a good restaurant nearby', null, 'en'],
]

/** Third batch, written before the evidence-scoring change and never used for tuning. */
export const HELD_OUT_3: Case[] = [
  ['sungai bengawan solo naik, kampung kami tergenang', 'lapor-banjir', 'id'],
  ['heavy flooding near the rice fields in Kanor', 'lapor-banjir', 'en'],
  ['omahku kebanjiran maneh', 'lapor-banjir', 'id'],
  ['lubang di jalan desa makin besar setelah hujan', 'lapor-jalan-rusak', 'id'],
  ['there are deep potholes near the bus stop', 'lapor-jalan-rusak', 'en'],
  ['dalane rusak parah neng Malo', 'lapor-jalan-rusak', 'id'],
  ['lampu penerangan di jalan kampung padam semua', 'lampu-pju-mati', 'id'],
  ['streetlights broken on the main road, it is pitch dark', 'lampu-pju-mati', 'en'],
  ['sampah rumah tangga belum diangkut petugas kebersihan', 'sampah-jawa', 'id'],
  ['nobody picked up the trash this week', 'sampah-jawa', 'en'],
  ['syarat perpanjang ktp apa saja', 'syarat-ktp', 'id'],
  ['how to apply for a new identity card', 'syarat-ktp', 'en'],
  ['mau tanya progres aduan saya', 'cek-status', 'id'],
  ['has my report been handled yet?', 'cek-status', 'en'],
  ['jam berapa pelayanan dukcapil tutup', 'jam-layanan', 'id'],
  ['is the office open on sunday?', 'jam-layanan', 'en'],
  ['minta disambungkan ke operator', 'teruskan-petugas', 'id'],
  ['I would like to talk to an agent', 'teruskan-petugas', 'en'],
  ['berapa harga cabai di pasar hari ini', null, 'id'],
  ['what is the capital of france', null, 'en'],
]

function run(m: ReturnType<typeof createMatcher>, cases: Case[], label: string): number {
  let ok = 0
  const misses: string[] = []
  for (const [text, want, lang] of cases) {
    const r = m.match(text, lang)
    if (r.intentId === want) ok++
    else misses.push(`  x "${text}" -> ${r.intentId ?? 'fallback'} (${r.confidence}) want ${want ?? 'fallback'} | top: ${r.candidates.map((c) => `${c.intentId}:${c.confidence}`).join(', ')}`)
  }
  console.log(`${label}: ${ok}/${cases.length} = ${((ok / cases.length) * 100).toFixed(1)}%`)
  if (misses.length) console.log(misses.join('\n'))
  return ok
}

function main() {
  const m = createMatcher(sampleScenario.intents, undefined, { threshold: sampleScenario.threshold ?? 0.32 })
  const a = run(m, HELD_OUT, 'matcher batch 1')
  const b = run(m, HELD_OUT_2, 'matcher batch 2 (untuned)')
  const c = run(m, HELD_OUT_3, 'matcher batch 3 (untuned)')
  const acc = (a + b + c) / (HELD_OUT.length + HELD_OUT_2.length + HELD_OUT_3.length)
  console.log(`matcher overall: ${(acc * 100).toFixed(1)}%`)
  if (acc < 0.9) throw new Error(`matcher accuracy ${(acc * 100).toFixed(1)}% < 90%`)

  // candidates & slots
  const r = m.match('banjir di Kalitidu, banyune munggah', 'id')
  if (r.slots.kecamatan !== 'Kalitidu') throw new Error(`slot kecamatan: ${JSON.stringify(r.slots)}`)
  if (r.candidates.length !== 3) throw new Error('expected 3 candidates')
  const s = m.match('cek status sw2416', 'id')
  if (s.slots.ticket?.toUpperCase() !== 'SW2416') throw new Error(`slot ticket: ${JSON.stringify(s.slots)}`)
  if (extractSlots('x', undefined) && Object.keys(extractSlots('x', undefined)).length) throw new Error('empty slots')
  // stemmer sanity
  const stems: [string, string][] = [['laporannya', 'lapor'], ['jalanan', 'jalan'], ['melaporkan', 'lapor'], ['berlubang', 'lubang']]
  for (const [w, want] of stems) if (stem(w) !== want) throw new Error(`stem(${w}) = ${stem(w)} want ${want}`)
  console.log('matcher: slots, candidates, stemmer OK')
}

main()
