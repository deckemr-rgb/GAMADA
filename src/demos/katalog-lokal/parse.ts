/**
 * The need parser (sim AI of "Susun spesifikasi"; lazy). Plain words → items (category via synonyms, qty), the pack
 * kecamatan (normalised token match), delivery days, emergency flag, budget ceiling. Numbers: "2.000", "2,000",
 * "2000", "2rb", "dua ribu", "two thousand", "4 juta". Deterministic; the AI (sim or live) only words the answer.
 */
import type { Bi, WorldState } from '../../demo-kit/world'

export interface ParsedItem { name: Bi; category: string; qty: number; unit: string; spec: Bi }
export interface Parsed { items: ParsedItem[]; kecamatanId: string | null; deliveryDays: number; emergency: boolean; budget: number | null }

const CATS: { cat: string; re: RegExp; name: Bi; unit: string; spec: Bi }[] = [
  { cat: 'karung-pasir', re: /karung(?:\s+pasir)?|sand\s?bags?|sak\s+pasir/, name: { id: 'Karung pasir', en: 'Sandbags' }, unit: 'lembar', spec: { id: 'Karung plastik anyaman 50×80 cm, kuat diisi 25–30 kg pasir', en: 'Woven plastic bag 50×80 cm, holds 25–30 kg of sand' } },
  { cat: 'terpal', re: /terpal|tarp(?:aulin)?s?/, name: { id: 'Terpal', en: 'Tarpaulin' }, unit: 'lembar', spec: { id: 'Terpal plastik 4×6 m, tahan air, mata ayam tiap 1 m', en: 'Plastic tarp 4×6 m, waterproof, eyelets every 1 m' } },
  { cat: 'nasi-kotak', re: /nasi\s+(?:kotak|bungkus)|boxed\s+meals?|meal\s+box(?:es)?|lunch\s+box(?:es)?/, name: { id: 'Nasi kotak', en: 'Boxed meals' }, unit: 'kotak', spec: { id: 'Nasi, lauk hewani, sayur, buah, air mineral 330 ml', en: 'Rice, protein dish, vegetables, fruit, 330 ml water' } },
  { cat: 'air-minum', re: /air\s+(?:minum|mineral)|bottled\s+water|drinking\s+water/, name: { id: 'Air minum kemasan', en: 'Bottled water' }, unit: 'dus', spec: { id: 'Air mineral 600 ml, 24 botol per dus', en: '600 ml mineral water, 24 bottles per carton' } },
  { cat: 'seragam', re: /seragam|uniforms?/, name: { id: 'Seragam', en: 'Uniforms' }, unit: 'stel', spec: { id: 'Kemeja + celana, bordir logo, ukuran S–XXL', en: 'Shirt + trousers, embroidered logo, sizes S–XXL' } },
  { cat: 'spanduk', re: /spanduk|banners?/, name: { id: 'Spanduk', en: 'Banners' }, unit: 'lembar', spec: { id: 'Flexi 280 g, 1×3 m, cetak penuh, tali & cincin', en: 'Flexi 280 g, 1×3 m, full print, ropes & rings' } },
  { cat: 'pompa', re: /pompa|pumps?/, name: { id: 'Pompa air', en: 'Water pump' }, unit: 'unit', spec: { id: 'Pompa bensin 3 inci, debit ≥ 1.000 L/menit', en: '3-inch petrol pump, ≥ 1,000 L/min' } },
  { cat: 'pompa', re: /genset|generators?/, name: { id: 'Genset', en: 'Generator' }, unit: 'unit', spec: { id: 'Genset bensin 5.000 W, starter listrik', en: '5,000 W petrol generator, electric start' } },
  { cat: 'beras', re: /beras|rice(?!\s+meal)/, name: { id: 'Beras', en: 'Rice' }, unit: 'kg', spec: { id: 'Beras medium, kemasan 25 kg', en: 'Medium rice, 25 kg sacks' } },
  { cat: 'atk', re: /\batk\b|alat\s+tulis|office\s+supplies|stationery/, name: { id: 'ATK', en: 'Office supplies' }, unit: 'paket', spec: { id: 'Kertas A4, map, pulpen, spidol per paket posko', en: 'A4 paper, folders, pens, markers per post pack' } },
  { cat: 'mebel', re: /kursi(?:\s+lipat)?|(?:folding\s+)?chairs?/, name: { id: 'Kursi lipat', en: 'Folding chairs' }, unit: 'unit', spec: { id: 'Kursi lipat besi, dudukan busa', en: 'Steel folding chair, foam seat' } },
]

const UNITS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const MUL = new Set(['puluh', 'belas', 'ratus', 'hundred', 'ribu', 'thousand', 'seratus', 'seribu'])

/** "dua ribu" → "2000", "two thousand" → "2000", "lima puluh" → "50" */
export function wordsToDigits(text: string): string {
  const toks = text.split(/(\s+)/)
  const out: string[] = []
  let i = 0
  while (i < toks.length) {
    const w = toks[i]!.toLowerCase()
    if (!(w in UNITS) && w !== 'seratus' && w !== 'seribu') {
      out.push(toks[i]!)
      i++
      continue
    }
    let total = 0
    let cur = 0
    let j = i
    for (; j < toks.length; j++) {
      const x = toks[j]!.toLowerCase()
      if (/^\s+$/.test(x)) continue
      if (x in UNITS) cur += UNITS[x]!
      else if (x === 'puluh') cur = (cur || 1) * 10
      else if (x === 'belas') cur = cur + 10
      else if (x === 'ratus' || x === 'hundred') cur = (cur || 1) * 100
      else if (x === 'seratus') cur += 100
      else if (x === 'ribu' || x === 'thousand') {
        total += (cur || 1) * 1000
        cur = 0
      } else if (x === 'seribu') total += 1000
      else break
      if (!MUL.has(x) && !(x in UNITS)) break
    }
    // trailing whitespace tokens belong to the text after the number
    let end = j
    while (end > i && /^\s+$/.test(toks[end - 1]!)) end--
    out.push(String(total + cur))
    for (let k = end; k < j; k++) out.push(toks[k]!)
    i = j
  }
  return out.join('')
}

interface Num { v: number; at: number; end: number; kind: 'qty' | 'days' | 'budget' }
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

export function parseNeed(raw: string, s: WorldState): Parsed {
  const text = wordsToDigits(raw).toLowerCase()
  const nums: Num[] = []
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(rb|ribu|k|thousand|jt|juta|million)?(?![a-z])/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const s0 = m[1]!
    let v = /^\d{1,3}(?:[.,]\d{3})+$/.test(s0) ? Number(s0.replace(/[.,]/g, '')) : Number(s0.replace(',', '.'))
    const mul = m[2]
    if (mul === 'rb' || mul === 'ribu' || mul === 'k' || mul === 'thousand') v *= 1000
    const big = mul === 'jt' || mul === 'juta' || mul === 'million'
    if (big) v *= 1_000_000
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8)
    const before = text.slice(Math.max(0, m.index - 12), m.index)
    const kind: Num['kind'] = /^\s*(hari|days?)/.test(after) ? 'days' : big || /(pagu|anggaran|budget|rp\.?)\s*$/.test(before) ? 'budget' : 'qty'
    nums.push({ v: Math.round(v), at: m.index, end: m.index + m[0].length, kind })
  }
  const used = new Set<Num>()
  const items: ParsedItem[] = []
  const seen = new Set<string>()
  const hits: { c: (typeof CATS)[number]; at: number; end: number }[] = []
  for (const c of CATS) {
    const m = c.re.exec(text)
    if (m && !seen.has(c.name.en)) {
      seen.add(c.name.en)
      hits.push({ c, at: m.index, end: m.index + m[0].length })
    }
  }
  hits.sort((a, b) => a.at - b.at)
  for (const h of hits) {
    const cands = nums.filter((n) => n.kind === 'qty' && !used.has(n))
    const prev = cands.filter((n) => n.end <= h.at && h.at - n.end <= 24).sort((a, b) => b.end - a.end)[0]
    const next = cands.filter((n) => n.at >= h.end && n.at - h.end <= 24).sort((a, b) => a.at - b.at)[0]
    const pick = prev && (!next || h.at - prev.end <= next.at - h.end) ? prev : next
    if (pick) used.add(pick)
    items.push({ name: h.c.name, category: h.c.cat, qty: Math.max(1, pick?.v ?? 1), unit: h.c.unit, spec: h.c.spec })
  }
  const days = nums.find((n) => n.kind === 'days')?.v ?? (/minggu depan|next week|seminggu|a week/.test(text) ? 7 : /besok|tomorrow/.test(text) ? 1 : 5)
  const budget = nums.find((n) => n.kind === 'budget')?.v ?? null
  const nt = ` ${norm(raw)} `
  let kec: { id: string; len: number } | null = null
  for (const k of s.region.kecamatan) {
    const kn = norm(k.name)
    if (kn && nt.includes(` ${kn} `) && (!kec || kn.length > kec.len)) kec = { id: k.id, len: kn.length }
  }
  const flood = s.alerts.ids.some((id) => {
    const a = s.alerts.byId[id]!
    return a.kind === 'banjir' && a.status === 'aktif'
  })
  return { items, kecamatanId: kec?.id ?? null, deliveryDays: Math.max(1, Math.min(60, days)), emergency: flood || /darurat|banjir|segera|urgent|emergency|flood|asap/.test(text), budget }
}
