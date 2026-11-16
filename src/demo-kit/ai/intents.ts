/**
 * ai/intents.ts — in-browser intent matcher for the simulation engine (spec §9.2).
 *
 * Pipeline: normalise (lowercase, strip accents/punctuation) → phrase synonyms (ID, EN, Basa Jawa → one
 * canonical token, e.g. "banyu munggah" / "kebanjiran" / "flooded" → banjir) → word synonyms → light
 * Indonesian/English affix stripping → stop-word removal. Two TF-IDF spaces are built over every intent
 * example: words and character 3-grams. A query scores each example by a weighted cosine; an intent's similarity
 * is its best example blended with its centroid. Similarity alone is diluted by every unknown word of a long
 * message, so it is blended with keyword evidence: for each query term, how many of the intent's examples carry
 * it (support) × how exclusive it is to that intent; the strongest term counts. Below the threshold the match is null (the scenario's fallback
 * answers) but the top-3 candidates are still returned for "maksud Anda…?" chips.
 */
import type { Intent, IntentMatch, Lang } from './types'

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const MATCH = {
  /** default confidence threshold (Scenario.threshold overrides) */
  threshold: 0.32,
  /** cosine weights: word space vs char-3-gram space */
  wordWeight: 0.6,
  charWeight: 0.4,
  /** similarity = best example × bestWeight + centroid × (1 − bestWeight) */
  bestWeight: 0.75,
  /** confidence = similarity × simWeight + keyword evidence × (1 − simWeight) */
  simWeight: 0.5,
  /** candidates returned */
  topK: 3,
  /** minimum stem length kept after affix stripping */
  minStem: 4,
} as const

/** canonical → variants. Variants may be phrases; canonical may contain spaces (stored with "_"). */
export type SynonymMap = Record<string, string[]>

/**
 * Shared synonyms (ID · EN · Basa Jawa). Products add their own through createMatcher(…, synonyms).
 * Phrases are replaced longest-first, so "lampu jalan mati" wins over "lampu".
 */
export const DEFAULT_SYNONYMS: SynonymMap = {
  banjir: [
    'banjir', 'kebanjiran', 'banjir bandang', 'banyu munggah', 'banyune munggah', 'banyu gedhe', 'kebanjiran banyu',
    'kelebon banyu', 'kebak banyu', 'air naik', 'air meluap', 'meluap', 'luapan', 'genangan', 'tergenang', 'tergenang air',
    'kerendem', 'kerendam', 'terendam', 'rob', 'flood', 'floods', 'flooded', 'flooding', 'inundated', 'water rising', 'overflowed', 'overflowing river', 'submerged',
  ],
  'jalan rusak': [
    'jalan rusak', 'jalan berlubang', 'jalan bolong', 'jalanan rusak', 'jalanan berlubang', 'aspal rusak', 'aspal mengelupas',
    'lubang jalan', 'jalan ambles', 'jalan retak', 'dalan rusak', 'dalane rusak', 'dalan bolong', 'dalane bolong',
    'dalane ajur', 'dalan ajur', 'dalane jeglong', 'jeglongan', 'pothole', 'potholes', 'damaged road', 'broken road', 'road damage',
    'road is damaged', 'road is broken', 'cracked road', 'bumpy road',
  ],
  sampah: [
    'sampah', 'uwuh', 'uwuhe', 'sampahe', 'tumpukan sampah', 'rubbish', 'garbage', 'trash', 'waste', 'litter', 'refuse',
  ],
  'lampu mati': [
    'lampu mati', 'lampu jalan mati', 'lampu jalan', 'lampu padam', 'lampu penerangan jalan', 'penerangan jalan', 'pju',
    'pju mati', 'lampu pju', 'lampu dalan', 'lampu dalan mati', 'lampune mati', 'lampune dalan mati', 'streetlight',
    'streetlights', 'street light', 'street lights', 'street lamp', 'street lamps', 'lamp post',
  ],
  ktp: ['ktp', 'e-ktp', 'ektp', 'e ktp', 'kartu tanda penduduk', 'id card', 'identity card', 'national id'],
  kk: ['kartu keluarga', 'family card', 'kk'],
  akta: ['akta kelahiran', 'akte kelahiran', 'akta', 'akte', 'birth certificate'],
  'air bersih': ['pdam', 'air bersih', 'air mati', 'air ledeng', 'banyu mati', 'banyu ledeng', 'water supply', 'tap water', 'no water'],
  syarat: [
    'syarat', 'persyaratan', 'syarate', 'sarat', 'requirement', 'requirements', 'what do i need', 'what documents',
    'dokumen apa', 'berkas apa', 'perlu bawa apa', 'bawa apa', 'butuh apa', 'kudu nggawa apa', 'kudu gawa apa', 'nggawa napa',
  ],
  status: [
    'status', 'progres', 'progress', 'perkembangan', 'tindak lanjut', 'follow up', 'follow-up', 'sampai mana', 'sudah sampai mana',
    'udah sampai mana', 'sampun dugi pundi', 'tekan ngendi', 'piye kabare', 'update', 'track', 'tracking',
  ],
  lapor: [
    'lapor', 'laporan', 'melapor', 'aduan', 'mengadu', 'keluhan', 'komplain', 'complaint', 'report', 'reporting', 'sambat',
    'wadul', 'matur', 'ngadu', 'ngelaporke', 'nglaporke',
  ],
  'jam layanan': [
    'jam layanan', 'jam buka', 'jam operasional', 'jam kerja', 'buka jam berapa', 'bukanya jam berapa', 'tutup jam berapa',
    'opening hours', 'office hours', 'business hours', 'open hours', 'bukak jam pinten',
    'bukak jam piro', 'tutup jam pinten', 'jam pinten',
  ],
  petugas: [
    'petugas', 'operator', 'manusia', 'human', 'agent', 'officer', 'staff', 'pegawai', 'admin', 'customer service',
    'real person', 'live agent',
  ],
  teruskan: ['teruskan', 'sambungkan', 'hubungkan', 'oper', 'transfer', 'connect', 'forward', 'escalate', 'sambungke', 'terusne', 'terusake'],
  mati: ['mati', 'padam', 'tidak menyala', 'tidak nyala', 'ora nyala', 'nggak menyala', 'gak menyala', 'nggak nyala', 'gak nyala', 'ga nyala', 'ora urip', 'ora murup', 'mboten murup', 'not working', 'dead', 'went out', 'is out', 'are out'],
  rusak: ['rusak', 'bolong', 'berlubang', 'lubang', 'ajur', 'remuk', 'damaged', 'broken', 'cracked'],
  angkut: ['angkut', 'diangkut', 'ambil', 'diambil', 'dijupuk', 'dipundhut', 'collected', 'collect', 'pick up', 'picked up', 'pickup'],
  mpp: ['mal pelayanan publik', 'mall pelayanan publik', 'mpp', 'public service mall', 'kantor layanan', 'disdukcapil', 'dukcapil', 'capil'],
  jalan: ['jalan', 'jalanan', 'dalan', 'dalane', 'margi', 'road', 'street'],
  air: ['air', 'banyu', 'toya', 'water'],
  rumah: ['rumah', 'omah', 'griya', 'house', 'home'],
  sekolah: ['sekolah', 'sekolahan', 'school'],
  pasar: ['pasar', 'peken', 'market'],
  belum: ['belum', 'durung', 'dereng', 'not yet', 'still not', 'masih belum'],
  sudah: ['sudah', 'sampun', 'wis', 'uwis', 'already'],
  hari: ['hari', 'dina', 'dinten', 'days', 'day'],
  buat: ['buat', 'bikin', 'membuat', 'gawe', 'damel', 'make', 'apply', 'get', 'ngurus', 'urus', 'mengurus'],
  baru: ['baru', 'anyar', 'enggal', 'new'],
  tanya: ['tanya', 'bertanya', 'nanya', 'takon', 'nyuwun pirsa', 'ask', 'question'],
  tinggi: ['tinggi', 'dhuwur', 'inggil', 'high', 'deep'],
  numpuk: ['numpuk', 'menumpuk', 'bertumpuk', 'tumpuk', 'piling up', 'piled up', 'pile', 'overflowing', 'meluber', 'mambu', 'bau', 'smell', 'smells', 'stink'],
  malam: ['malam', 'wengi', 'dalu', 'night', 'peteng', 'gelap', 'dark'],
}

/** Function words dropped before scoring (ID · EN · Basa Jawa). Question words are kept on purpose. */
const STOP = new Set(
  (
    'yang di ke dari ini itu dan atau saya aku kami kita kamu anda ada untuk dengan pak bu bapak ibu mas mbak kak min ' +
    'tolong mohon minta ya sih dong kok deh nih tuh lho loh kah pun juga sudah lagi akan bisa mau ingin apakah gimana ' +
    'the a an to of in on at is are was were am i my me we our you your please for and or it its this that be been do ' +
    'does did can could would should will there here have has had with about from by as just still also so very ' +
    'kulo kula niki niku iki iku nggih inggih ngge mawon wae sing ing nang neng teng ten ning karo kalih menika punika ' +
    'meh akeh lan utawa sampeyan panjenengan njenengan sliramu awakmu dulur lur rek cak'
  ).split(/\s+/),
)

/* ------------------------------------------------------------------ text processing */

/** lowercase, strip diacritics, fold reduplication, keep letters/digits and spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z]+)-/g, '$1') // reduplication: bolong-bolong → bolong
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ID_PREFIX = ['meng', 'meny', 'mem', 'men', 'me', 'ber', 'di', 'ter', 'peng', 'pem', 'pen']
const ID_SUFFIX_PARTICLE = ['nya', 'lah', 'kah', 'ne']
const ID_SUFFIX = ['kan', 'an']
const EN_SUFFIX = ['ing', 'ed', 'es', 's']

/** Light, language-agnostic stemmer: ID particles/suffixes/prefixes, then EN inflections. Consistent, not exact. */
export function stem(word: string): string {
  if (word.length <= MATCH.minStem || /\d/.test(word) || word.includes('_')) return word
  let w = word
  for (const s of ID_SUFFIX_PARTICLE) if (w.endsWith(s) && w.length - s.length >= MATCH.minStem) { w = w.slice(0, -s.length); break }
  for (const s of ID_SUFFIX) if (w.endsWith(s) && w.length - s.length >= MATCH.minStem) { w = w.slice(0, -s.length); break }
  for (const p of ID_PREFIX) if (w.startsWith(p) && w.length - p.length >= MATCH.minStem) { w = w.slice(p.length); break }
  for (const s of EN_SUFFIX) {
    if (w.endsWith(s) && !w.endsWith('ss') && w.length - s.length >= MATCH.minStem) { w = w.slice(0, -s.length); break }
  }
  return w
}

interface Lexicon {
  /** [variant words[], canonical token], longest variants first */
  phrases: { words: string[]; canon: string }[]
  /** single-word variant → canonical token */
  words: Map<string, string>
}

function buildLexicon(...maps: (SynonymMap | undefined)[]): Lexicon {
  const canonOf = new Map<string, string>()
  for (const m of maps) {
    if (!m) continue
    for (const [canonRaw, variants] of Object.entries(m)) {
      const canon = normalize(canonRaw).replace(/\s+/g, '_')
      for (const v of [canonRaw, ...variants]) {
        const n = normalize(v)
        if (n) canonOf.set(n, canon)
      }
    }
  }
  const phrases: Lexicon['phrases'] = []
  const words = new Map<string, string>()
  for (const [variant, canon] of canonOf) {
    const parts = variant.split(' ')
    if (parts.length > 1) phrases.push({ words: parts, canon })
    else words.set(variant, canon)
  }
  phrases.sort((a, b) => b.words.length - a.words.length)
  return { phrases, words }
}

/** Text → feature words (synonyms canonicalised, stemmed, stop words removed). */
function analyze(text: string, lex: Lexicon): string[] {
  const raw = normalize(text).split(' ').filter(Boolean)
  const out: string[] = []
  let i = 0
  outer: while (i < raw.length) {
    for (const p of lex.phrases) {
      const n = p.words.length
      if (i + n > raw.length) continue
      let ok = true
      for (let k = 0; k < n; k++) if (raw[i + k] !== p.words[k]) { ok = false; break }
      if (ok) {
        out.push(p.canon)
        // "jalan_rusak" also counts as "jalan" + "rusak" (canonicalised), so phrase and split wordings meet
        for (const part of p.canon.split('_')) if (p.canon.includes('_')) out.push(lex.words.get(part) ?? stem(part))
        i += n
        continue outer
      }
    }
    const w = raw[i]!
    i++
    const direct = lex.words.get(w)
    if (direct) { out.push(direct); continue }
    if (STOP.has(w)) continue
    const s = stem(w)
    const viaStem = lex.words.get(s)
    out.push(viaStem ?? s)
  }
  return out
}

function charGrams(features: string[]): string[] {
  const grams: string[] = []
  for (const f of features) {
    const w = ` ${f.replace(/_/g, ' ')} `
    for (let i = 0; i + 3 <= w.length; i++) grams.push(w.slice(i, i + 3))
  }
  return grams
}

/* ------------------------------------------------------------------ TF-IDF */

type Vec = Map<string, number>

function tf(terms: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}

function weigh(counts: Map<string, number>, idf: Map<string, number>, unseenIdf: number): Vec {
  const v: Vec = new Map()
  let norm = 0
  for (const [t, c] of counts) {
    const w = (1 + Math.log(c)) * (idf.get(t) ?? unseenIdf)
    v.set(t, w)
    norm += w * w
  }
  norm = Math.sqrt(norm) || 1
  for (const [t, w] of v) v.set(t, w / norm)
  return v
}

function cosine(a: Vec, b: Vec): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  let s = 0
  for (const [t, w] of small) {
    const o = big.get(t)
    if (o) s += w * o
  }
  return s
}

function centroid(vs: Vec[]): Vec {
  const c: Vec = new Map()
  for (const v of vs) for (const [t, w] of v) c.set(t, (c.get(t) ?? 0) + w)
  let norm = 0
  for (const w of c.values()) norm += w * w
  norm = Math.sqrt(norm) || 1
  for (const [t, w] of c) c.set(t, w / norm)
  return c
}

function idfOf(docs: string[][]): { idf: Map<string, number>; unseen: number } {
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const n = docs.length
  const idf = new Map<string, number>()
  for (const [t, c] of df) idf.set(t, Math.log((1 + n) / (1 + c)) + 1)
  return { idf, unseen: Math.log(1 + n) + 1 }
}

/* ------------------------------------------------------------------ slots */

/** Extract slot values: RegExp → capture group 1 (else the whole match); keyword list → the first keyword found. */
export function extractSlots(text: string, slots: Record<string, RegExp | string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!slots) return out
  const norm = ` ${normalize(text)} `
  for (const [name, spec] of Object.entries(slots)) {
    if (spec instanceof RegExp) {
      const re = new RegExp(spec.source, spec.flags.replace('g', ''))
      const m = re.exec(text)
      const v = m?.[1] ?? m?.[0]
      if (v) out[name] = v.trim()
    } else {
      for (const kw of spec) {
        const k = normalize(kw)
        if (k && norm.includes(` ${k} `)) {
          out[name] = kw
          break
        }
      }
    }
  }
  return out
}

/* ------------------------------------------------------------------ matcher */

export interface Matcher {
  match(text: string, lang?: Lang): IntentMatch
  /** the processed feature words for a text (for inspectors / debugging) */
  features(text: string): string[]
  readonly threshold: number
  readonly intentIds: string[]
}

export interface MatcherOptions {
  threshold?: number
}

type IntentLike = Pick<Intent<never>, 'id' | 'examples' | 'slots'>

/** Build a matcher over intents' examples. `synonyms` extend DEFAULT_SYNONYMS. */
export function createMatcher(intents: readonly IntentLike[], synonyms?: SynonymMap, opts: MatcherOptions = {}): Matcher {
  const lex = buildLexicon(DEFAULT_SYNONYMS, synonyms)
  const threshold = opts.threshold ?? MATCH.threshold

  const exampleWords: string[][] = []
  const exampleChars: string[][] = []
  const owner: number[] = []
  intents.forEach((it, idx) => {
    for (const ex of it.examples) {
      const f = analyze(ex, lex)
      if (!f.length) continue
      exampleWords.push(f)
      exampleChars.push(charGrams(f))
      owner.push(idx)
    }
  })
  const wIdf = idfOf(exampleWords)
  const cIdf = idfOf(exampleChars)
  const wVecs = exampleWords.map((d) => weigh(tf(d), wIdf.idf, wIdf.unseen))
  const cVecs = exampleChars.map((d) => weigh(tf(d), cIdf.idf, cIdf.unseen))
  const wCent = intents.map((_, idx) => centroid(wVecs.filter((_, e) => owner[e] === idx)))
  // keyword evidence: support(t, I) = share of I's examples containing t; evidence = support × exclusivity
  const support = new Map<string, number[]>()
  const perIntent = intents.map((_, idx) => owner.filter((o) => o === idx).length || 1)
  exampleWords.forEach((d, e) => {
    for (const t of new Set(d)) {
      let row = support.get(t)
      if (!row) support.set(t, (row = new Array<number>(intents.length).fill(0)))
      row[owner[e]!]! += 1 / perIntent[owner[e]!]!
    }
  })
  const evidence = new Map<string, number[]>()
  for (const [t, row] of support) {
    const sum = row.reduce((a, b) => a + b, 0) || 1
    evidence.set(t, row.map((s) => s * (s / sum)))
  }
  const cCent = intents.map((_, idx) => centroid(cVecs.filter((_, e) => owner[e] === idx)))

  function match(text: string): IntentMatch {
    const f = analyze(text, lex)
    if (!f.length || !intents.length) return { intentId: null, confidence: 0, slots: {}, candidates: [] }
    const qw = weigh(tf(f), wIdf.idf, wIdf.unseen)
    const qc = weigh(tf(charGrams(f)), cIdf.idf, cIdf.unseen)
    const best = new Array<number>(intents.length).fill(0)
    for (let e = 0; e < owner.length; e++) {
      const s = MATCH.wordWeight * cosine(qw, wVecs[e]!) + MATCH.charWeight * cosine(qc, cVecs[e]!)
      const o = owner[e]!
      if (s > best[o]!) best[o] = s
    }
    const ev = new Array<number>(intents.length).fill(0)
    for (const t of new Set(f)) {
      const row = evidence.get(t)
      if (row) for (let k = 0; k < row.length; k++) if (row[k]! > ev[k]!) ev[k] = row[k]!
    }
    const scored = intents.map((it, idx) => {
      const cent = MATCH.wordWeight * cosine(qw, wCent[idx]!) + MATCH.charWeight * cosine(qc, cCent[idx]!)
      const sim = MATCH.bestWeight * best[idx]! + (1 - MATCH.bestWeight) * cent
      const score = MATCH.simWeight * sim + (1 - MATCH.simWeight) * ev[idx]!
      return { intentId: it.id, confidence: Math.round(Math.min(1, score) * 1000) / 1000 }
    })
    scored.sort((a, b) => b.confidence - a.confidence)
    const candidates = scored.slice(0, MATCH.topK).filter((c) => c.confidence > 0)
    const top = candidates[0]
    if (!top || top.confidence < threshold) {
      return { intentId: null, confidence: top?.confidence ?? 0, slots: {}, candidates }
    }
    const intent = intents.find((i) => i.id === top.intentId)
    return { intentId: top.intentId, confidence: top.confidence, slots: extractSlots(text, intent?.slots), candidates }
  }

  return {
    match: (text) => match(text),
    features: (text) => analyze(text, lex),
    threshold,
    intentIds: intents.map((i) => i.id),
  }
}
