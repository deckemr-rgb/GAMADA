/**
 * demos/indeks-ekonomi/scenario.ts — the simulated regional economist (registered by the lazy Assist drawer). Every
 * number comes from the context the drawer builds out of world/pasar-daerah econ selectors (visible cells only;
 * hidden kecamatan are listed by name without a number), so the answer agrees with the screen.
 * Intents: jelaskan_kecamatan → 'insight', peringkat → 'insight' (+ the drawer's bar list), dampak_program →
 * 'indeks-ekonomi/econ_impact', susun_briefing → 'indeks-ekonomi/econ_brief'. A hidden kecamatan ⇒ the fixed
 * anonymity answer. Wording rotates per intent (least recently used); each sentence names a kecamatan, a month,
 * a programme or a number.
 */
import { registerScenario, registerStructuredSchema, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'

type Bi = { id: string; en: string }
export interface IeCtx {
  product: 'indeks-ekonomi'
  region: string
  month: Bi
  kab: { index: number | null; delta: number | null; omzet: number }
  cells: { id: string; name: string; index: number; delta: number }[]
  hidden: { id: string; name: string }[]
  selected: string | null
  events: { kec: string; delta: number; reason: Bi; kind: string | null }[]
  alert: { kecamatan: string[] } | null
  programs: { id: string; title: Bi; kind: 'operasi-pasar' | 'modal'; effectPct: number | null; didPct: number | null; measured: boolean }[]
}
type L = 'id' | 'en'
type C = SimContext<IeCtx>
const n1 = (n: number, l: L) => n.toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const sg = (n: number, l: L) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${n1(Math.abs(n), l)}`
const used = new Map<string, number>()
const pick = <T,>(key: string, list: T[]): T => {
  const i = used.get(key) ?? 0
  used.set(key, i + 1)
  return list[i % list.length]!
}
const x = (c: C): IeCtx | null => (c.world && (c.world as IeCtx).product === 'indeks-ekonomi' ? (c.world as IeCtx) : null)
const none = (l: L): SimResponse => ({ text: l === 'id' ? 'Data ekonomi belum termuat. Coba lagi sebentar lagi.' : 'The economic data has not loaded yet. Try again in a moment.' })
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/** the kecamatan named in the question (longest name first), else null */
const named = (w: IeCtx, text: string): { id: string; name: string; hidden: boolean } | null => {
  const t = norm(text)
  const all = [...w.cells.map((k) => ({ id: k.id, name: k.name, hidden: false })), ...w.hidden.map((k) => ({ ...k, hidden: true }))].sort((a, b) => b.name.length - a.name.length)
  return all.find((k) => t.includes(norm(k.name))) ?? null
}
const anonymity = (l: L, name: string): SimResponse => ({
  text: l === 'id'
    ? `Kec. ${name} memiliki kurang dari 10 usaha terdaftar, jadi indeks, omzet, dan sektornya disembunyikan untuk menjaga anonimitas. Angkanya tetap dihitung dalam total kabupaten.`
    : `${name} district has fewer than 10 registered businesses, so its index, turnover and sectors are hidden to protect anonymity. Its figures still count in the regency totals.`,
})

function explain(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const k = named(w, c.text)
  if (k?.hidden) return anonymity(l, k.name)
  const cell = (k && w.cells.find((z) => z.id === k.id)) ?? w.cells.find((z) => z.id === w.selected) ?? [...w.cells].sort((a, b) => a.delta - b.delta)[0]
  if (!cell) return none(l)
  const ev = w.events.find((e) => e.kec === cell.name)
  const trend = cell.delta > 0.2 ? 'naik' : cell.delta < -0.2 ? 'turun' : 'stabil'
  const why = ev
    ? (l === 'id' ? ` Kejadian hari ini: ${ev.reason.id} (${sg(ev.delta, l)}).` : ` Today’s event: ${ev.reason.en} (${sg(ev.delta, l)}).`)
    : w.alert && w.alert.kecamatan.includes(cell.name)
      ? (l === 'id' ? ' Kecamatan ini masuk wilayah peringatan banjir aktif; aktivitas usaha kemungkinan tertahan.' : ' The district is inside the active flood warning; business activity is likely held back.')
      : (l === 'id' ? ' Perubahannya kemungkinan berkaitan dengan pola musiman panen dan belanja rumah tangga.' : ' The change is likely related to the seasonal harvest and household spending pattern.')
  const lead = pick('ex', l === 'id'
    ? [`Indeks ekonomi Kec. ${cell.name} ${w.month.id} ${n1(cell.index, l)} (${sg(cell.delta, l)} poin dari bulan lalu).`, `Kec. ${cell.name}: indeks ${n1(cell.index, l)} pada ${w.month.id}, berubah ${sg(cell.delta, l)} poin.`]
    : [`${cell.name} district’s economic index for ${w.month.en} is ${n1(cell.index, l)} (${sg(cell.delta, l)} points from last month).`, `${cell.name} district: index ${n1(cell.index, l)} in ${w.month.en}, a change of ${sg(cell.delta, l)} points.`])
  const text = `${lead}${why} ${l === 'id' ? '(simulasi)' : '(simulated)'}`
  return { text, structured: { kind: 'insight', data: { indicator: l === 'id' ? `Indeks ekonomi Kec. ${cell.name}` : `${cell.name} economic index`, trend, explanation: text.slice(0, 600), kecamatan: [cell.name] } } }
}

function ranking(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w || !w.cells.length) return none(l)
  const top = [...w.cells].sort((a, b) => b.index - a.index).slice(0, 3)
  const low = [...w.cells].sort((a, b) => a.index - b.index).slice(0, 3)
  const line = (z: IeCtx['cells'][number]) => `${z.name} ${n1(z.index, l)}`
  const head = pick('rk', l === 'id'
    ? [`Peringkat ${w.month.id}: tertinggi ${top.map(line).join(', ')}; terendah ${low.map(line).join(', ')}.`, `${w.month.id}: tiga teratas ${top.map(line).join(', ')}, tiga terbawah ${low.map(line).join(', ')}.`]
    : [`Ranking for ${w.month.en}: highest ${top.map(line).join(', ')}; lowest ${low.map(line).join(', ')}.`, `${w.month.en}: top three ${top.map(line).join(', ')}, bottom three ${low.map(line).join(', ')}.`])
  const hid = w.hidden.length ? (l === 'id' ? ` ${w.hidden.length} kecamatan (${w.hidden.map((h) => h.name).join(', ')}) tidak diperingkat karena < 10 usaha.` : ` ${w.hidden.length} districts (${w.hidden.map((h) => h.name).join(', ')}) are not ranked: < 10 businesses.`) : ''
  const text = `${head}${hid} ${l === 'id' ? '(simulasi)' : '(simulated)'}`
  return { text, structured: { kind: 'insight', data: { indicator: l === 'id' ? 'Peringkat indeks kecamatan' : 'District index ranking', trend: (w.kab.delta ?? 0) > 0.2 ? 'naik' : (w.kab.delta ?? 0) < -0.2 ? 'turun' : 'stabil', explanation: text.slice(0, 600), kecamatan: [...top, ...low].map((z) => z.name) } } }
}

function impact(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const t = norm(c.text)
  const p = w.programs.find((z) => t.includes(norm(z.id)) || (z.kind === 'modal' && /modal|pinjam|loan|capital/.test(t))) ?? w.programs.find((z) => z.kind === 'operasi-pasar' && z.measured) ?? w.programs[0]
  if (!p) return { text: l === 'id' ? 'Belum ada program yang bisa diukur.' : 'No programme to measure yet.' }
  const eff = p.effectPct ?? 0
  const conf = p.measured && p.didPct != null ? 'sedang' : 'rendah'
  const note = p.measured
    ? (l === 'id' ? `Selisih-ganda terukur ${p.didPct != null ? sg(p.didPct, l) + '%' : '–'} terhadap pembanding.` : `Measured difference-in-differences ${p.didPct != null ? sg(p.didPct, l) + '%' : '–'} against the comparison group.`)
    : (l === 'id' ? 'Program belum selesai: angka ini proyeksi.' : 'The programme has not finished: this is a projection.')
  const text = pick('im', l === 'id'
    ? [`${p.title.id}: efek ${sg(eff, l)}% (metode selisih-ganda, simulasi). ${note}`, `Dampak ${p.title.id} diperkirakan ${sg(eff, l)}% dengan selisih-ganda (simulasi). ${note}`]
    : [`${p.title.en}: effect ${sg(eff, l)}% (difference-in-differences, simulated). ${note}`, `The impact of ${p.title.en} is estimated at ${sg(eff, l)}% by difference-in-differences (simulated). ${note}`])
  return { text, structured: { kind: 'indeks-ekonomi/econ_impact', data: { programId: p.id, effectPct: eff, measured: p.measured, method: 'selisih-ganda', confidence: conf, note } } }
}

function brief(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w || !w.cells.length) return none(l)
  const low = [...w.cells].sort((a, b) => a.index - b.index)[0]!
  const high = [...w.cells].sort((a, b) => b.index - a.index)[0]!
  const p = w.programs.find((z) => z.measured)
  const headline = (l === 'id' ? `Ekonomi ${w.region} ${w.month.id}: indeks ${w.kab.index != null ? n1(w.kab.index, l) : '–'}, terendah Kec. ${low.name}` : `${w.region} economy, ${w.month.en}: index ${w.kab.index != null ? n1(w.kab.index, l) : '–'}, lowest ${low.name}`).slice(0, 120)
  const points = [
    { text: l === 'id' ? `Indeks kabupaten ${w.kab.index != null ? n1(w.kab.index, l) : '–'} (${sg(w.kab.delta ?? 0, l)} poin dari bulan lalu).` : `Regency index ${w.kab.index != null ? n1(w.kab.index, l) : '–'} (${sg(w.kab.delta ?? 0, l)} points from last month).`, refs: ['kabupaten'] },
    { text: l === 'id' ? `Tertinggi Kec. ${high.name} (${n1(high.index, l)}), terendah Kec. ${low.name} (${n1(low.index, l)}).` : `Highest ${high.name} (${n1(high.index, l)}), lowest ${low.name} (${n1(low.index, l)}).`, refs: [high.id, low.id] },
    ...(w.events[0] ? [{ text: `${w.events[0].reason[l]} (${sg(w.events[0].delta, l)}).`, refs: [w.events[0].kec] }] : []),
    ...(p ? [{ text: l === 'id' ? `${p.title.id}: efek ${sg(p.effectPct ?? 0, l)}% (selisih-ganda, simulasi).` : `${p.title.en}: effect ${sg(p.effectPct ?? 0, l)}% (diff-in-diff, simulated).`, refs: [p.id] }] : []),
  ].slice(0, 5)
  const recommendations = l === 'id'
    ? [`Prioritaskan modal kerja UMKM di Kec. ${low.name}.`, 'Siapkan operasi pasar bila harga bahan pokok naik di atas pola musiman.', 'Pantau indeks kecamatan terdampak setiap minggu selama sebulan.']
    : [`Prioritise MSME working capital in ${low.name} district.`, 'Prepare a market operation if staple prices rise above the seasonal pattern.', 'Track the affected districts’ index weekly for a month.']
  const caveat = l === 'id' ? `Semua angka simulasi; ${w.hidden.length} kecamatan dengan < 10 usaha disembunyikan.` : `All figures simulated; ${w.hidden.length} districts with < 10 businesses are hidden.`
  const text = `${headline}.\n${points.map((z) => `- ${z.text}`).join('\n')}\n${l === 'id' ? 'Rekomendasi' : 'Recommendations'}: ${recommendations.join(' ')}\n${caveat}`
  return { text, structured: { kind: 'indeks-ekonomi/econ_brief', data: { headline, points, recommendations, caveat } } }
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
let done = false
export function registerIeScenario(): void {
  if (done) return
  done = true
  registerStructuredSchema('indeks-ekonomi/econ_impact', { safeParse: (v) => (obj(v) && typeof v.programId === 'string' && typeof v.effectPct === 'number' && v.method === 'selisih-ganda' ? { success: true, data: v } : { success: false }) })
  registerStructuredSchema('indeks-ekonomi/econ_brief', { safeParse: (v) => (obj(v) && typeof v.headline === 'string' && Array.isArray(v.points) && v.points.length >= 3 && v.points.length <= 5 && Array.isArray(v.recommendations) ? { success: true, data: v } : { success: false }) })
  registerScenario<IeCtx>({
    product: 'indeks-ekonomi',
    intents: [
      { id: 'jelaskan_kecamatan', examples: ['jelaskan kecamatan', 'kenapa indeks kecamatan turun', 'apa yang terjadi di kecamatan ini', 'explain the district', 'why did the district index drop', 'piye ekonomi kecamatan'], respond: explain },
      { id: 'peringkat', examples: ['peringkat kecamatan', 'kecamatan tertinggi dan terendah', 'ranking indeks', 'rank the districts', 'which district is highest', 'urutan kecamatan'], respond: ranking },
      { id: 'dampak_program', examples: ['dampak program', 'ukur dampak operasi pasar', 'efek modal kerja', 'measure the programme impact', 'what did the market operation do', 'hasil program'], respond: impact },
      { id: 'susun_briefing', examples: ['susun briefing', 'buat ringkasan kebijakan', 'briefing untuk kepala daerah', 'draft a policy briefing', 'summarise for the regional head', 'ringkasan ekonomi bulan ini'], respond: brief },
    ],
    fallback: (c) => ({
      text: c.lang === 'id'
        ? 'Saya bisa menjelaskan satu kecamatan, memberi peringkat, mengukur dampak program, atau menyusun briefing. Pilih salah satu tombol di atas.'
        : 'I can explain a district, rank the districts, measure a programme or draft a briefing. Pick one of the buttons above.',
    }),
  })
}
