/**
 * world/names.ts — Indonesian name lists + generators (seed and docs samples). Every person produced from these
 * lists is FICTIONAL. Split from catalog.ts / rng.ts so the running world (prng.ts) never downloads them.
 */
import type { NameGroup } from './types'
import type { Rng } from './prng'

/* ================================================================== names */

export interface NameSet {
  m: string[]
  f: string[]
  /** family / second names (shared or per gender) */
  last?: string[]
  lastF?: string[]
  /** probability of a second name */
  pLast: number
}

export const NAMES: Partial<Record<NameGroup, NameSet>> = {
  jawa: {
    m: ['Budi', 'Agus', 'Slamet', 'Sugeng', 'Joko', 'Bambang', 'Wahyu', 'Teguh', 'Hadi', 'Eko', 'Dwi', 'Puji', 'Sutrisno', 'Suparman', 'Darmo', 'Wawan', 'Yanto', 'Heru', 'Rudi', 'Supriyadi', 'Sukirno', 'Bayu', 'Aris', 'Tri', 'Sarwono', 'Mulyono', 'Raka', 'Dimas', 'Galih', 'Fajar'],
    f: ['Siti', 'Sri', 'Endang', 'Wulan', 'Rini', 'Tutik', 'Sulastri', 'Suminah', 'Ratna', 'Dewi', 'Ani', 'Yuni', 'Ningsih', 'Kartini', 'Sumarni', 'Indah', 'Puspita', 'Sumiati', 'Retno', 'Wartini', 'Dian', 'Ayu', 'Nur', 'Lestari'],
    last: ['Santoso', 'Wibowo', 'Susanto', 'Purnomo', 'Hartono', 'Setiawan', 'Nugroho', 'Saputra', 'Pratama', 'Prasetyo', 'Wicaksono', 'Gunawan', 'Utomo', 'Raharjo', 'Sulistyo'],
    lastF: ['Handayani', 'Rahmawati', 'Lestari', 'Utami', 'Wahyuni', 'Rahayu', 'Purwanti', 'Astuti', 'Susilowati', 'Kusumawati'],
    pLast: 0.55,
  },
  sunda: {
    m: ['Asep', 'Ujang', 'Dede', 'Cecep', 'Dadang', 'Ade', 'Iwan', 'Jajang', 'Yayan', 'Engkos', 'Dodi', 'Rahmat'],
    f: ['Euis', 'Neng', 'Yeni', 'Iis', 'Teti', 'Nenden', 'Lilis', 'Cucu', 'Nining', 'Imas'],
    last: ['Suryana', 'Hidayat', 'Permana', 'Sopian', 'Kusnadi', 'Ruhiyat', 'Supriatna', 'Gumilar'],
    lastF: ['Nurhayati', 'Komalasari', 'Rostika', 'Kurniasih', 'Suryani'],
    pLast: 0.7,
  },
  batak: {
    m: ['Togar', 'Parlindungan', 'Hotman', 'Bonar', 'Martua', 'Sahat', 'Jonner', 'Binsar', 'Poltak', 'Daniel'],
    f: ['Rosmawati', 'Lamtiur', 'Tiurma', 'Debora', 'Romauli', 'Hotnida', 'Ruth', 'Sondang'],
    last: ['Siregar', 'Nasution', 'Simanjuntak', 'Hutapea', 'Sitompul', 'Pardede', 'Lubis', 'Harahap', 'Sinaga', 'Manurung', 'Tambunan', 'Panjaitan'],
    pLast: 1,
  },
  minang: {
    m: ['Rizal', 'Zulkifli', 'Hendri', 'Afrizal', 'Yusrizal', 'Fadli', 'Syahrul', 'Irwan', 'Arif', 'Rahmad'],
    f: ['Rahmi', 'Yusnita', 'Elvi', 'Fitri', 'Desi', 'Zulaikha', 'Nurhasanah', 'Rosna'],
    last: ['Chaniago', 'Piliang', 'Sikumbang', 'Tanjung', 'Koto', 'Effendi', 'Syafri'],
    pLast: 0.6,
  },
  bugis: {
    m: ['Muhammad Ilham', 'Nurdin', 'Syarifuddin', 'Haerul', 'Sulfikar', 'Akbar', 'Irfan', 'Ridwan', 'Andi Baso', 'Andi Fikri'],
    f: ['Hasmawati', 'Nurhaedah', 'Jumriah', 'Rahmatia', 'Andi Nurul', 'Sitti Rahma', 'Hasnah', 'Rosmiati'],
    pLast: 0,
  },
  tionghoa: {
    m: ['Hendra', 'Kevin', 'Steven', 'William', 'Yohanes', 'Andreas', 'Felix', 'Hartono', 'Budi', 'Ronald', 'Wilson'],
    f: ['Lina', 'Mei Ling', 'Susan', 'Lily', 'Yuliana', 'Natalia', 'Veronica', 'Melinda', 'Fransiska', 'Shinta'],
    last: ['Wijaya', 'Halim', 'Tanuwijaya', 'Gunawan', 'Setiadi', 'Kusuma', 'Tanjaya', 'Lim', 'Tan', 'Gozali', 'Sutanto', 'Hartanto', 'Liem', 'Oei'],
    pLast: 0.9,
  },
  madura: {
    m: ['Moh. Hasan', 'Fathorrahman', 'Syaiful', 'Ahmad Fauzi', 'Mat Sahri', 'Abdul Rahem', 'Holili', 'Bakri', 'Moh. Rofiq', 'Sukri'],
    f: ['Siti Aisyah', 'Hosniyah', 'Maimunah', 'Juwairiyah', 'Nur Hasanah', 'Fatimah', 'Halimah', 'Sumiyati'],
    pLast: 0,
  },
  bali: {
    m: ['I Wayan Sudarsana', 'I Made Artawan', 'I Nyoman Suardana', 'I Ketut Wirawan', 'I Putu Budiasa', 'I Gede Mahendra', 'I Komang Adi'],
    f: ['Ni Wayan Sukarini', 'Ni Made Ayu Lestari', 'Ni Nyoman Ariani', 'Ni Ketut Sriasih', 'Ni Putu Wahyuni', 'Ni Kadek Dewi'],
    pLast: 0,
  },
  banjar: {
    m: ['Ahmad Rizani', 'Muhammad Yusran', 'Saberan', 'Rusdiansyah', 'Fahrurrazi', 'Taufikurrahman'],
    f: ['Masliana', 'Rusmini', 'Norhayati', 'Mahmudah', 'Rabiatul', 'Hairiyah'],
    pLast: 0,
  },
}

/** regional language code (pack.languages.regional) → name group it boosts */
export const LANG_GROUP: Record<string, NameGroup> = {
  jv: 'jawa', su: 'sunda', min: 'minang', bug: 'bugis', mad: 'madura', bal: 'bali', bat: 'batak', bjn: 'banjar',
}
/** national background mix (Indonesia is diverse everywhere) */
export const BASE_GROUP_WEIGHT: Partial<Record<NameGroup, number>> = {
  jawa: 10, sunda: 6, batak: 4, minang: 4, bugis: 3, tionghoa: 5, madura: 4, bali: 2, banjar: 2,
}
/** weight added to the region's own language groups (split between them) */
export const REGIONAL_BOOST = 140

/* ------------------------------------------------------------------ generators */

/** name-group weights for a region, boosted by its regional languages (pack.languages.regional) */
export function groupWeights(regional: readonly string[]): [NameGroup, number][] {
  const w = new Map<NameGroup, number>()
  for (const [g, v] of Object.entries(BASE_GROUP_WEIGHT) as [NameGroup, number][]) w.set(g, v)
  const groups = regional.map((l) => LANG_GROUP[l]).filter((g): g is NameGroup => !!g)
  for (const g of groups) w.set(g, (w.get(g) ?? 0) + REGIONAL_BOOST / groups.length)
  return [...w.entries()].filter(([g]) => !!NAMES[g])
}

export interface PersonName {
  name: string
  gender: 'L' | 'P'
  group: NameGroup
}

export function personName(rng: Rng, group: NameGroup, gender: 'L' | 'P'): string {
  const set = NAMES[group] ?? NAMES.jawa!
  const first = rng.pick(gender === 'L' ? set.m : set.f)
  if (!set.pLast || !rng.chance(set.pLast)) return first
  const pool = gender === 'P' && set.lastF?.length && rng.chance(0.7) ? set.lastF : set.last
  if (!pool?.length) return first
  const last = rng.pick(pool)
  return last === first ? first : `${first} ${last}`
}

export function makeNamer(rng: Rng, regional: readonly string[]) {
  const weights = groupWeights(regional)
  return (gender?: 'L' | 'P'): PersonName => {
    const g = gender ?? (rng.chance(0.5) ? 'L' : 'P')
    const group = rng.weighted(weights)
    return { name: personName(rng, group, g), gender: g, group }
  }
}
