/**
 * demos/radar-isu/live-feed.ts — what keeps the radar "live" while it is on screen (lazy: loaded after the first paint).
 *
 *  1. Curated monitoring: while the world clock runs, the radar picks up extra simulated mentions on top of the world's
 *     natural events (≈ one every 10–15 real seconds at ×60), with varied texts (no identical sentence from five accounts).
 *  2. Jumps: the clock's "Lompat ke…" skips natural events by design; the radar backfills the skipped window with the
 *     same generator, so the stream reaches the new world time and the 24 h KPIs do not drop for no reason.
 *  3. The 10.00 scenario: if the world time is past 10.00 and the false narrative never started (a jump over it), the
 *     radar starts it itself (the same burst as "Picu skenario").
 * Every mention is deterministic per seed + region + minute and carries source 'clock' (background, no toasts).
 */
import { MEDIA_OUTLETS, SOCIAL_HANDLES } from '../../demo-kit/world/texts'
import { hashString, makeRng } from '../../demo-kit/world/prng'
import { HOUR_RHYTHM, WORLD, clamp, round } from '../../demo-kit/world/util'
import { clock, emit, rows, world, type Bi, type EventMap } from '../../demo-kit/world'

/**
 * extra radar mentions per world minute at rhythm 1.0 (live) and for a backfilled minute. Kept near the seeded
 * history's density (≈ 4–6 curated mentions per busy world hour), so "Mention 24 jam … vs 24 jam sebelumnya" stays
 * plausible while the clock runs; between mentions the stream's crawl line ("dipindai N unggahan") keeps ticking.
 */
const RATE_LIVE = 0.08
const RATE_FILL = 0.08
/** a backfill never covers more than this (world minutes) nor emits more than this many mentions */
const FILL_MAX_MIN = 1440
const FILL_MAX_N = 80

/** varied curated texts per topic; {k} = kecamatan, {r} = region short name */
const BANK: { topic: string; s: number; t: Bi }[] = [
  { topic: 'layanan', s: 0.55, t: { id: 'Perekaman KTP-el jemput bola di Kec. {k} dibuka sampai sore.', en: 'Mobile e-ID registration in {k} stays open until the afternoon.' } },
  {
    topic: 'layanan',
    s: -0.45,
    t: { id: 'Nomor antrean MPP {r} habis sebelum jam 9, warga Kec. {k} pulang lagi.', en: 'The {r} service mall ran out of queue numbers before 9; {k} residents went home.' },
  },
  {
    topic: 'layanan',
    s: 0.35,
    t: { id: 'Aplikasi antrean online pemda kini bisa dipakai dari HP, lumayan memangkas waktu.', en: 'The government queue app now works on phones, which saves a fair bit of time.' },
  },
  {
    topic: 'jalan',
    s: -0.6,
    t: { id: 'Lubang di ruas jalan menuju pasar Kec. {k} makin lebar setelah hujan semalam.', en: 'The potholes on the road to the {k} market got wider after last night’s rain.' },
  },
  { topic: 'jalan', s: 0.4, t: { id: 'Tambal sulam jalan desa di Kec. {k} mulai dikerjakan pagi ini.', en: 'Patching of the village road in {k} started this morning.' } },
  { topic: 'jalan', s: -0.35, t: { id: 'Pengendara diminta hati-hati, marka jalan di Kec. {k} sudah pudar.', en: 'Drivers are warned to take care: the road markings in {k} have faded.' } },
  { topic: 'banjir', s: -0.5, t: { id: 'Saluran di Kec. {k} tersumbat sampah, air meluber ke jalan kampung.', en: 'Drains in {k} are blocked by rubbish and water spills onto the lanes.' } },
  {
    topic: 'banjir',
    s: 0.3,
    t: { id: 'Relawan dan BPBD membersihkan gorong-gorong di Kec. {k} sebelum musim hujan puncak.', en: 'Volunteers and the disaster agency clear culverts in {k} before peak rain.' },
  },
  {
    topic: 'banjir',
    s: -0.3,
    t: { id: 'Warga bantaran di Kec. {k} memindahkan barang ke tempat lebih tinggi, berjaga-jaga.', en: 'Riverbank residents in {k} move their belongings higher, just in case.' },
  },
  { topic: 'harga', s: -0.55, t: { id: 'Pedagang pasar Kec. {k}: harga cabai rawit naik lagi pagi ini.', en: '{k} market traders: bird’s-eye chilli prices rose again this morning.' } },
  { topic: 'harga', s: 0.25, t: { id: 'Operasi pasar beras murah di {r} disambut antusias ibu-ibu.', en: 'The cheap-rice market operation in {r} drew an eager crowd.' } },
  { topic: 'harga', s: -0.3, t: { id: 'Harga bawang merah di Kec. {k} belum turun meski panen sudah mulai.', en: 'Shallot prices in {k} have not dropped even though the harvest has begun.' } },
  { topic: 'umkm', s: 0.6, t: { id: 'Perajin batik Kec. {k} kebanjiran pesanan seragam sekolah.', en: 'Batik makers in {k} are swamped with school-uniform orders.' } },
  { topic: 'umkm', s: 0.45, t: { id: 'Warung kopi di Kec. {k} mulai terima QRIS, transaksi naik.', en: 'Coffee stalls in {k} now take QRIS and sales are up.' } },
  { topic: 'umkm', s: -0.25, t: { id: 'Pelaku UMKM {r} mengeluh ongkos kirim bahan baku naik.', en: '{r} small businesses complain that raw-material shipping costs went up.' } },
  { topic: 'sampah', s: -0.55, t: { id: 'Tumpukan sampah di TPS Kec. {k} belum diangkut tiga hari.', en: 'Rubbish at the {k} collection point has not been picked up for three days.' } },
  { topic: 'sampah', s: 0.4, t: { id: 'Bank sampah warga Kec. {k} sekarang menerima minyak jelantah.', en: 'The {k} community waste bank now accepts used cooking oil.' } },
  { topic: 'kesehatan', s: 0.45, t: { id: 'Posyandu Kec. {k} ramai, imunisasi anak berjalan lancar.', en: 'The {k} health post is busy; child immunisation is going smoothly.' } },
  { topic: 'kesehatan', s: -0.4, t: { id: 'Antrean pasien BPJS di puskesmas Kec. {k} panjang sejak subuh.', en: 'The insured-patient queue at the {k} clinic has been long since dawn.' } },
  { topic: 'pendidikan', s: 0.35, t: { id: 'Sekolah di Kec. {k} mulai program sarapan bergizi, orang tua lega.', en: 'Schools in {k} start a nutritious-breakfast scheme; parents are relieved.' } },
  { topic: 'pendidikan', s: -0.3, t: { id: 'Atap ruang kelas SD di Kec. {k} bocor, siswa belajar di teras.', en: 'A primary classroom roof in {k} leaks; pupils study on the veranda.' } },
  { topic: 'bansos', s: -0.45, t: { id: 'Warga Kec. {k} bertanya kenapa namanya hilang dari daftar penerima bansos.', en: '{k} residents ask why their names vanished from the social-aid list.' } },
  { topic: 'bansos', s: 0.3, t: { id: 'Penyaluran bansos pangan di Kec. {k} tertib, antre per RT.', en: 'Food-aid distribution in {k} is orderly, queued by neighbourhood.' } },
]

type Payload = EventMap['mention.created']

/** the radar's mention for one world minute (deterministic), or null */
function mentionAt(minute: number, rate: number): Payload | null {
  const s = world.get()
  if (!s.regionId || !s.region.kecamatan.length) return null
  const r = makeRng(hashString(`${s.seed}|${s.regionId}|radar-feed|${minute}`))
  const h = Math.floor((((minute % 1440) + 1440) % 1440) / 60)
  if (!r.chance(rate * (HOUR_RHYTHM[h] ?? 0.2))) return null
  const tpl = r.pick(BANK)
  const k = r.pick(s.region.kecamatan)
  const kind = r.weighted([
    ['berita', 35],
    ['sosmed', 55],
    ['forum', 10],
  ] as const)
  const score = clamp(round(tpl.s + r.normal(0, 0.12), 2), -1, 1)
  const fill = (x: string) => x.replace('{k}', k.name).replace('{r}', s.region.shortName)
  const handle = r.pick(SOCIAL_HANDLES)
  return {
    outlet: kind === 'berita' ? r.pick(MEDIA_OUTLETS) : kind === 'sosmed' ? handle : 'Forum Warga',
    kind,
    author: kind === 'berita' ? 'Redaksi' : handle,
    text: { id: fill(tpl.t.id), en: fill(tpl.t.en) },
    sentiment: score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral',
    score,
    topic: tpl.topic,
    reach: Math.round(Math.exp(r.normal(kind === 'berita' ? 7.6 : 6.3, 0.9))),
  }
}

/** mentions already in the world (a jump back and forth, or a reload, must not post the same minute twice) */
const keyOf = (at: number, text: string) => `${at}|${text}`
const existing = (): Set<string> => new Set(rows(world.get().mentions).map((m) => keyOf(m.at, m.text.id)))
const post = (p: Payload, at: number, have: Set<string>) => {
  const k = keyOf(at, p.text.id)
  if (have.has(k)) return false
  have.add(k)
  emit('mention.created', p, 'clock', { at, origin: 'radar-isu' })
  return true
}

/** the false narrative has started (or was raised) in this world */
function rumorStarted(): boolean {
  const s = world.get()
  const rumor = s.meta.facts.hoax.rumor || WORLD.hoaxRumor
  return rows(s.mentions).some((m) => m.rumor === rumor) || rows(s.hoaxAlerts).some((h) => h.rumor === rumor)
}

export interface FeedOptions {
  /** start the false narrative (the same burst as "Picu skenario"), its first post at `start` */
  startHoax: (start: number) => void
}

/** install the feed while the live monitor is mounted; returns the uninstall */
export function startFeed(o: FeedOptions): () => void {
  let last = clock.get().minutes
  let hoaxTimer = 0
  const checkHoax = () => {
    window.clearTimeout(hoaxTimer)
    const now = clock.get().minutes
    if (now < WORLD.hoaxAt || world.status() !== 'ready' || rumorStarted()) return
    // give the world's own 10.00 schedule (natural events) a moment to post first
    hoaxTimer = window.setTimeout(() => {
      const t = clock.get().minutes
      if (t >= WORLD.hoaxAt && world.status() === 'ready' && !rumorStarted()) o.startHoax(t >= WORLD.hoaxAt + 25 ? WORLD.hoaxAt : Math.max(0, t - 25))
    }, 1200)
  }
  const unMinute = clock.onMinute((m) => {
    if (world.status() !== 'ready') return
    const p = mentionAt(m, RATE_LIVE)
    if (p) post(p, m, existing())
  })
  const unSub = clock.subscribe(() => {
    const now = clock.get().minutes
    const from = last
    last = now
    if (now - from > 2 && world.status() === 'ready') {
      // a jump forward: backfill the skipped window (oldest first, capped)
      const start = Math.max(from + 1, now - FILL_MAX_MIN)
      const have = existing()
      let n = 0
      for (let m = start; m <= now && n < FILL_MAX_N; m++) {
        const p = mentionAt(m, RATE_FILL)
        if (p && post(p, m, have)) n++
      }
    }
    if (now !== from) checkHoax()
  })
  checkHoax()
  return () => {
    unMinute()
    unSub()
    window.clearTimeout(hoaxTimer)
  }
}
