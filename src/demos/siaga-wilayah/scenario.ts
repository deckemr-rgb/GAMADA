/**
 * siaga-wilayah/scenario.ts — Geo-AI simulation scenario (spec §9.2): 14 intents with examples in Indonesian, English
 * and Basa Jawa; every answer reads the compact context `geoContext()` builds from the world + the map's flood model
 * (the same object Live mode sends to the proxy, ≤ 6 KB). The draft_alert intent returns the shared structured kind
 * 'alert' (level / areas / message / channels), exactly what the proxy's draft_alert tool returns in Live mode.
 * Registered on import (imported only by the lazy Geo-AI drawer and the broadcast dialog).
 */
import { registerScenario, type Lang, type Scenario, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'
import { clock, getSession, rows, world } from '../../demo-kit/world'
import { harvestValues } from '../../demo-kit/world/satu-daerah'
import { clockText, confirmedIds, floodAlerts, floodClusterSize, floodReports, harvestPasca, riverGauge, shelters } from './data'
import { KIND_LABEL } from './sites'
import { nf } from './strings'
import { impactAt, ui } from './ui'

/* ------------------------------------------------------------------ context */
export interface GeoCtx {
  region: string
  now: string
  role: string
  rain: { cells: number; peakMmH: number; kecamatan: string[] } | null
  river: { name: string; level: number; siaga: number; awas: number; rise24h: number } | null
  dam: { name: string; level: number; siaga: number; awas: number } | null
  forecast6h: { desa: number; people: number; areaKm2: number; kecamatanCount: number; kecamatan: { name: string; desa: number; people: number }[]; first: { desa: string; kecamatan: string; onsetH: number } | null; topDesa: { name: string; kecamatan: string; onsetH: number; people: number }[] } | null
  alerts: { id: string; level: number; kecamatan: string[]; broadcast: boolean; recipients: number; confirmedBy: number }[]
  reports: { total: number; confirmed: number; largestCluster: number; latest: { code: string; desa: string; kecamatan: string; at: string }[] }
  shelters: { name: string; kecamatan: string; capacity: number; occupied: number }[]
  hospitals: { name: string; kecamatan: string }[]
  harvest: { scenario: 'normal' | 'pasca-banjir'; riceChangePct: number; worst: { kecamatan: string; changePct: number }[] }
  landUse: { change: string; kecamatan: string; areaHa: number }[]
  note: string
}

export function geoContext(lang: Lang = 'id'): GeoCtx {
  const s = world.get()
  const u = ui.get()
  const kn = (id: string | null | undefined) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id ?? '—'
  const dn = (k: string, d: string) => s.region.kecamatan.find((x) => x.id === k)?.desa.find((x) => x.id === d)?.name ?? d
  const cells = rows(s.rainCells)
  const g = riverGauge(s)
  const dam = rows(s.gauges).find((x) => x.kind === 'waduk') ?? null
  const i6 = u.impact6 ?? impactAt(6)
  const perKec = new Map<string, { desa: number; people: number }>()
  for (const d of i6?.desa ?? []) {
    const a = perKec.get(d.kecamatanId) ?? { desa: 0, people: 0 }
    a.desa++
    a.people += d.people
    perKec.set(d.kecamatanId, a)
  }
  const first = i6?.desa.length ? i6.desa.reduce((a, d) => (d.onset < a.onset ? d : a), i6.desa[0]!) : null
  const reps = floodReports(s)
  const conf = confirmedIds(s)
  const rice = harvestValues(s, 'change', 'padi')
  const ricePct = (() => {
    let b = 0
    let n = 0
    for (const h of rows(s.harvests)) if (h.crop === 'padi') {
      b += h.baselineTon
      n += h.estimateTon
    }
    return b ? Math.round(((n - b) / b) * 1000) / 10 : 0
  })()
  return {
    region: s.region.name,
    now: clockText(clock.get().minutes, lang),
    role: getSession().role,
    rain: cells.length ? { cells: cells.length, peakMmH: Math.max(...cells.map((c) => c.intensity)), kecamatan: s.region.floodKecamatanIds.map(kn) } : null,
    river: g ? { name: g.name, level: g.level, siaga: g.siaga, awas: g.awas, rise24h: Math.round((g.level - (g.history[0] ?? g.level)) * 100) / 100 } : null,
    dam: dam ? { name: dam.name, level: dam.level, siaga: dam.siaga, awas: dam.awas } : null,
    forecast6h: i6
      ? {
          desa: i6.desa.length, people: Math.round(i6.people / 100) * 100, areaKm2: Math.round(i6.areaKm2 * 10) / 10, kecamatanCount: i6.kecamatanIds.length,
          kecamatan: [...perKec.entries()].sort((a, b) => b[1].people - a[1].people).slice(0, 6).map(([k, v]) => ({ name: kn(k), desa: v.desa, people: Math.round(v.people / 10) * 10 })),
          first: first ? { desa: first.name, kecamatan: kn(first.kecamatanId), onsetH: Math.round(first.onset * 10) / 10 } : null,
          topDesa: i6.desa.slice(0, 8).map((d) => ({ name: d.name, kecamatan: kn(d.kecamatanId), onsetH: Math.round(d.onset * 10) / 10, people: d.people })),
        }
      : null,
    alerts: floodAlerts(s).map((a) => ({ id: a.id, level: a.level, kecamatan: a.kecamatanIds.map(kn), broadcast: !!a.broadcast, recipients: a.broadcast?.recipients ?? 0, confirmedBy: a.confirmedBy?.length ?? 0 })),
    reports: { total: reps.length, confirmed: conf.size, largestCluster: floodClusterSize(s), latest: reps.slice(0, 4).map((c) => ({ code: c.code, desa: dn(c.kecamatanId, c.desaId), kecamatan: kn(c.kecamatanId), at: clockText(c.at, lang) })) },
    shelters: shelters(s).slice(0, 8).map((f) => ({ name: f.name, kecamatan: kn(f.kecamatanId), capacity: f.capacity, occupied: f.occupied })),
    hospitals: rows(s.facilities).filter((f) => f.kind === 'rs').slice(0, 5).map((f) => ({ name: f.name, kecamatan: kn(f.kecamatanId) })),
    harvest: {
      scenario: harvestPasca(s) ? 'pasca-banjir' : 'normal',
      riceChangePct: ricePct,
      worst: Object.entries(rice).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => ({ kecamatan: kn(k), changePct: v })),
    },
    landUse: u.sites.map((x) => ({ change: `${x.from.id} → ${x.to.id}`, kecamatan: x.kecamatanName, areaHa: x.areaHa })),
    note: 'Semua angka simulasi (dunia demo GAMADA); lokasi wilayah nyata. Bukan peringatan resmi BMKG/BPBD.',
  }
}

/* ------------------------------------------------------------------ helpers */
const L = <T,>(lang: Lang, v: { id: T; en: T }): T => v[lang]
const read = (w: unknown): GeoCtx | null => (w && typeof w === 'object' && 'alerts' in w ? (w as GeoCtx) : null)
const JAWA = /\b(banyu|kali|omah|omahe|dalan|akeh|udan|deres|piye|pira|piro|endi|ngendi|sing|wis|durung|saiki|mengko|kudu|ora|mboten|nggih|kula|kulo|panjenengan|wae|mawon|jebol|waduk|ngungsi|kebanjiran|munggah|dhuwur|pari|panen|neng|ning|kapan|opo|apa\s+wae)\b/gi
const isJawa = (t: string) => (t.match(JAWA) ?? []).length >= 2
/** the river's name from the gauge name ("<river> · pos <region>") */
export const riverOf = (gaugeName: string): string => gaugeName.split(' · ')[0] ?? gaugeName
const ppl = (n: number, lang: Lang) => nf(Math.round(n / 100) * 100, lang)
const LEVEL_NAME = { 1: { id: 'Waspada', en: 'Advisory' }, 2: { id: 'Siaga', en: 'Watch' }, 3: { id: 'Awas', en: 'Warning' }, 4: { id: 'Darurat', en: 'Emergency' } } as const

function noForecast(ctx: SimContext): SimResponse {
  return {
    text: L(ctx.lang, {
      id: 'Model genangan belum dijalankan pagi ini. Tekan "Jalankan prediksi 6 jam" di bawah peta, lalu tanyakan lagi; saya akan membaca desa terdampak dan perkiraan warganya.',
      en: 'The flood model has not been run this morning. Press "Run 6-hour forecast" under the map and ask again; I will read the affected villages and people.',
    }),
    followUps: [L(ctx.lang, { id: 'Bagaimana prakiraan hujan hari ini?', en: "What's today's rain forecast?" }), L(ctx.lang, { id: 'Berapa tinggi muka air sungai?', en: 'What is the river level?' })],
  }
}

/** the AI-drafted early warning (structured kind 'alert', same shape as the proxy's draft_alert tool) */
export function draftAlert(g: GeoCtx, lang: Lang, level: 1 | 2 | 3 | 4 = 3, areas?: string[], onsetH?: number): { level: 'waspada' | 'siaga' | 'awas'; areas: string[]; message: string; channels: ('wa' | 'sms' | 'sirine' | 'media-sosial' | 'radio')[] } {
  const kec = areas?.length ? areas : (g.forecast6h?.kecamatan.slice(0, 1).map((k) => k.name) ?? g.alerts[0]?.kecamatan ?? [])
  const inArea = g.forecast6h?.topDesa.filter((d) => kec.includes(d.kecamatan)) ?? []
  const desa = inArea.slice(0, 3).map((d) => d.name)
  const shelter = g.shelters.find((s) => kec.includes(s.kecamatan))?.name ?? g.shelters[0]?.name ?? (lang === 'id' ? 'posko terdekat' : 'the nearest shelter')
  const onset = onsetH ?? (inArea.length ? Math.min(...inArea.map((d) => d.onsetH)) : (g.forecast6h?.first?.onsetH ?? 2))
  const when = onset < 1 ? L(lang, { id: 'dalam 1 jam ke depan', en: 'within the next hour' }) : L(lang, { id: `dalam ±${nf(Math.round(onset), 'id')} jam`, en: `within about ${nf(Math.round(onset), 'en')} h` })
  const lv = LEVEL_NAME[level][lang].toUpperCase()
  const river = g.river ? riverOf(g.river.name) : L(lang, { id: 'sungai', en: 'the river' })
  const area = `${lang === 'id' ? 'Kec.' : 'District'} ${kec.join(', ')}${desa.length ? ` (${desa.join(', ')})` : ''}`
  const act = {
    1: { id: 'Pantau info resmi dan siapkan tas siaga.', en: 'Follow official updates and prepare a go-bag.' },
    2: { id: 'Siapkan evakuasi lansia, anak, dan disabilitas; amankan dokumen.', en: 'Prepare to evacuate the elderly, children and people with disabilities; secure documents.' },
    3: { id: `Segera menuju ${shelter}. Matikan listrik bila air masuk rumah.`, en: `Go to ${shelter} now. Switch off power if water enters the house.` },
    4: { id: `Evakuasi wajib sekarang ke ${shelter}. Ikuti arahan petugas.`, en: `Mandatory evacuation now to ${shelter}. Follow the officers.` },
  }[level][lang]
  const message =
    lang === 'id'
      ? `[SIMULASI DEMO] [PERINGATAN DINI BANJIR · LEVEL ${level} ${lv}] BPBD ${g.region}: air ${river} diperkirakan meluap ${when} di ${area}. ${act} Darurat: 112. Info resmi hanya dari BPBD.`
      : `[DEMO SIMULATION] [FLOOD EARLY WARNING · LEVEL ${level} ${lv}] BPBD ${g.region}: ${g.river ? `the ${river}` : river} is expected to overflow ${when} in ${area}. ${act} Emergency: 112. Official info only from BPBD.`
  return { level: level >= 3 ? 'awas' : level === 2 ? 'siaga' : 'waspada', areas: kec, message: message.slice(0, 600), channels: level >= 3 ? ['wa', 'sms', 'sirine'] : ['wa', 'sms'] }
}

/* ------------------------------------------------------------------ scenario */
const kecSlot = (): string[] => world.get().region.kecamatan.map((k) => k.name)

export const geoScenario: Scenario<GeoCtx> = {
  product: 'siaga-wilayah',
  threshold: 0.3,
  intents: [
    {
      id: 'status',
      examples: ['Bagaimana situasi banjir sekarang?', 'Ringkas kondisi siaga banjir pagi ini', 'Apa status peringatan hari ini?', "What's the flood situation now?", 'Give me a status summary', 'Piye kahanan banjir saiki?', 'Kahanan kali saiki piye, wis bahaya durung?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const f = g.forecast6h
        const al = g.alerts[0]
        const id = `${f ? `Model 6 jam: ${nf(f.desa, 'id')} desa di ${f.kecamatanCount} kecamatan diprediksi tergenang, ±${ppl(f.people, 'id')} warga (simulasi). ` : 'Model genangan belum dijalankan. '}${g.river ? `${g.river.name} ${nf(g.river.level, 'id', 2)} m (siaga ${nf(g.river.siaga, 'id', 1)} m). ` : ''}${al ? `Peringatan aktif level ${al.level} untuk ${al.kecamatan.join(', ')}${al.broadcast ? `, sudah disiarkan ke ${nf(al.recipients, 'id')} penerima` : ', belum disiarkan'}.` : 'Belum ada peringatan aktif.'}${g.reports.confirmed ? ` ${g.reports.confirmed} aduan warga mengonfirmasi prediksi.` : ''}`
        const en = `${f ? `6-hour model: ${nf(f.desa, 'en')} villages in ${f.kecamatanCount} districts predicted to flood, ±${ppl(f.people, 'en')} people (simulated). ` : 'The flood model has not been run. '}${g.river ? `${g.river.name} ${nf(g.river.level, 'en', 2)} m (watch ${nf(g.river.siaga, 'en', 1)} m). ` : ''}${al ? `Active level-${al.level} warning for ${al.kecamatan.join(', ')}${al.broadcast ? `, broadcast to ${nf(al.recipients, 'en')} recipients` : ', not broadcast yet'}.` : 'No active warning.'}${g.reports.confirmed ? ` ${g.reports.confirmed} citizen reports confirm the forecast.` : ''}`
        const jw = isJawa(ctx.text) ? `Nggih. ${f ? `Ing 6 jam ngajeng, ${nf(f.desa, 'id')} desa saged kebanjiran, kinten-kinten ${ppl(f.people, 'id')} tiyang (simulasi).` : 'Model banjir dereng dipun lampahaken.'} ${al ? `Peringatan level ${al.level} sampun aktif.` : 'Dereng wonten peringatan.'}` : null
        return { text: jw ?? (ctx.lang === 'id' ? id : en), translation: jw ? (ctx.lang === 'id' ? id : en) : undefined, followUps: [L(ctx.lang, { id: 'Desa mana yang paling cepat tergenang?', en: 'Which villages flood first?' }), L(ctx.lang, { id: 'Susun peringatan dini', en: 'Draft an early warning' })] }
      },
    },
    {
      id: 'desa',
      examples: ['Desa mana saja yang terdampak 6 jam ke depan?', 'Daftar desa yang akan tergenang', 'Desa mana yang paling cepat banjir?', 'Which villages will be affected?', 'List the villages that will flood first', 'Desa endi wae sing bakal kebanjiran?', 'Kampung endi sing kebanjiran dhisik?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const f = g?.forecast6h
        if (!g || !f) return noForecast(ctx)
        const list = f.topDesa.slice(0, 5).map((d) => `${d.name} (${d.kecamatan}, ±${nf(d.onsetH, ctx.lang, 1)} ${L(ctx.lang, { id: 'j', en: 'h' })})`).join('; ')
        const text = L(ctx.lang, { id: `Paling cepat tergenang: ${list}. Total ${nf(f.desa, 'id')} desa, ±${ppl(f.people, 'id')} warga dalam 6 jam (model turunan, simulasi).`, en: `Flooding first: ${list}. ${nf(f.desa, 'en')} villages in total, ±${ppl(f.people, 'en')} people within 6 hours (derived model, simulated).` })
        const jw = isJawa(ctx.text) ? `Desa ingkang rumiyin kebanjiran: ${f.topDesa.slice(0, 3).map((d) => d.name).join(', ')}. Sedaya wonten ${nf(f.desa, 'id')} desa.` : null
        return { text: jw ?? text, translation: jw ? text : undefined, toolCalls: [{ name: 'flood_model', input: { hours: 6 }, output: { desa: f.desa }, ms: 180 }], followUps: [L(ctx.lang, { id: 'Berapa warga terdampak per kecamatan?', en: 'How many people per district?' }), L(ctx.lang, { id: 'Posko mana yang masih kosong?', en: 'Which shelters have room?' })] }
      },
    },
    {
      id: 'people',
      examples: ['Berapa warga terdampak?', 'Jumlah penduduk di zona banjir per kecamatan', 'Berapa jiwa yang perlu dievakuasi?', 'How many people are affected?', 'Population in the flood zone by district', 'Pira wong sing kena banjir?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const f = g?.forecast6h
        if (!g || !f) return noForecast(ctx)
        const rows_ = f.kecamatan.map((k) => `${k.name} ${ppl(k.people, ctx.lang)} (${k.desa} ${L(ctx.lang, { id: 'desa', en: 'villages' })})`).join(', ')
        return {
          text: L(ctx.lang, { id: `Perkiraan ±${ppl(f.people, 'id')} warga di zona 6 jam. Terbanyak: ${rows_}. Penduduk desa diturunkan dari penduduk kecamatan di region pack, angka simulasi.`, en: `About ${ppl(f.people, 'en')} people in the 6-hour zone. Most: ${rows_}. Village population is derived from district population in the region pack; simulated figures.` }),
          followUps: [L(ctx.lang, { id: 'Susun peringatan dini untuk kecamatan terbanyak', en: 'Draft a warning for the top district' })],
        }
      },
    },
    {
      id: 'peak',
      examples: ['Kapan puncak banjir?', 'Jam berapa air paling tinggi?', 'Kapan air sampai ke permukiman?', 'When does the flood peak?', 'When will the water reach homes?', 'Kapan banyune paling dhuwur?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const f = g?.forecast6h
        if (!g || !f) return noForecast(ctx)
        return {
          text: L(ctx.lang, {
            id: `Air pertama diperkirakan masuk ${f.first?.desa ?? '—'} (${f.first?.kecamatan ?? '—'}) ±${nf(f.first?.onsetH ?? 0, 'id', 1)} jam lagi. Muka air sungai diproyeksikan memuncak ±18 jam dari sekarang, lalu surut perlahan dalam 72 jam (proyeksi simulasi, lihat tab Prediksi).`,
            en: `First water is expected in ${f.first?.desa ?? '—'} (${f.first?.kecamatan ?? '—'}) in about ${nf(f.first?.onsetH ?? 0, 'en', 1)} h. The river is projected to crest about 18 h from now and recede slowly within 72 h (simulated projection, see the Forecast tab).`,
          }),
          followUps: [L(ctx.lang, { id: 'Berapa tinggi muka air sungai?', en: 'What is the river level?' })],
        }
      },
    },
    {
      id: 'river',
      examples: ['Berapa tinggi muka air Bengawan Solo?', 'Status pos pantau sungai', 'Apakah sungai sudah siaga?', 'What is the river water level?', 'Is the river above the watch level?', 'Banyu kali saiki pira dhuwure?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const r = g?.river
        if (!g || !r) return noForecast(ctx)
        const st = r.level >= r.awas ? L(ctx.lang, { id: 'di atas batas AWAS', en: 'above the WARNING level' }) : r.level >= r.siaga ? L(ctx.lang, { id: 'di atas batas SIAGA', en: 'above the WATCH level' }) : L(ctx.lang, { id: 'di bawah batas siaga, tetapi naik', en: 'below the watch level but rising' })
        return {
          text: L(ctx.lang, { id: `${r.name}: ${nf(r.level, 'id', 2)} m, ${st} (siaga ${nf(r.siaga, 'id', 1)} m, awas ${nf(r.awas, 'id', 1)} m). Naik ${nf(r.rise24h, 'id', 2)} m dalam 24 jam. Pos pantau nyata, pembacaan simulasi.`, en: `${r.name}: ${nf(r.level, 'en', 2)} m, ${st} (watch ${nf(r.siaga, 'en', 1)} m, warning ${nf(r.awas, 'en', 1)} m). Up ${nf(r.rise24h, 'en', 2)} m in 24 h. Real gauge site, simulated readings.` }),
          toolCalls: [{ name: 'read_gauge', input: { gauge: r.name }, output: { level: r.level }, ms: 140 }],
        }
      },
    },
    {
      id: 'dam',
      examples: ['Apakah bendungan aman?', 'Benarkan waduk akan jebol?', 'Ada kabar bendungan Pacal jebol', 'Is the dam safe?', 'Is it true the dam will burst?', 'Waduk Pacal jebol ta?', 'Krungu kabar waduk arep jebol, bener ora?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const d = g?.dam
        if (!g || !d) return { text: L(ctx.lang, { id: 'Data pos pantau waduk tidak tersedia di wilayah ini.', en: 'No reservoir gauge data in this region.' }) }
        const text = L(ctx.lang, {
          id: `${d.name}: muka air ${nf(d.level, 'id', 2)} m, di bawah batas siaga ${nf(d.siaga, 'id', 1)} m (pembacaan simulasi). Tidak ada indikasi jebol; kabar itu sedang ditangani Radar Isu sebagai dugaan hoaks. Banjir hari ini berasal dari luapan ${g.river ? riverOf(g.river.name) : 'sungai'}, bukan bendungan.`,
          en: `${d.name}: water level ${nf(d.level, 'en', 2)} m, below the watch level of ${nf(d.siaga, 'en', 1)} m (simulated readings). No sign of a breach; Radar Isu is handling that story as a suspected hoax. Today's flooding comes from ${g.river ? `the ${riverOf(g.river.name)}` : 'the river'} overflowing, not the dam.`,
        })
        const jw = isJawa(ctx.text) ? `Mboten leres. ${d.name} taksih aman, toya ${nf(d.level, 'id', 2)} m, ngandhap wates siaga.` : null
        return { text: jw ?? text, translation: jw ? text : undefined, followUps: [L(ctx.lang, { id: 'Bagaimana situasi banjir sekarang?', en: "What's the flood situation now?" })] }
      },
    },
    {
      id: 'draft',
      examples: ['Susun peringatan dini untuk warga', 'Buatkan pesan peringatan banjir', 'Tulis draf peringatan level awas untuk Trucuk', 'Draft an early warning', 'Write a flood warning message for residents', 'Gawekna pengumuman peringatan banjir', 'Tulung gawe pesen peringatan kanggo warga'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const names = kecSlot().filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(ctx.text))
        const lvMatch = /\b(level|lv)\s*([1-4])\b/i.exec(ctx.text)?.[2]
        const level = (lvMatch ? Number(lvMatch) : /darurat|emergency/i.test(ctx.text) ? 4 : /waspada|advisory/i.test(ctx.text) ? 1 : /siaga|watch/i.test(ctx.text) ? 2 : 3) as 1 | 2 | 3 | 4
        const d = draftAlert(g, ctx.lang, level, names.length ? names : undefined)
        return {
          text: L(ctx.lang, { id: `Draf peringatan level ${level} untuk ${d.areas.join(', ')} siap (${d.message.length}/600 karakter). Periksa, lalu tekan "Pakai draf ini" untuk membuka pratinjau WA dan penerimanya.`, en: `A level-${level} warning draft for ${d.areas.join(', ')} is ready (${d.message.length}/600 characters). Review it, then press "Use this draft" to open the WA preview and recipients.` }),
          structured: { kind: 'alert', data: d },
          toolCalls: [{ name: 'draft_alert', input: { level: d.level, areas: d.areas }, output: { chars: d.message.length }, ms: 420 }],
          followUps: [L(ctx.lang, { id: 'Ubah ke level siaga', en: 'Change to watch level' }), L(ctx.lang, { id: 'Posko mana yang masih kosong?', en: 'Which shelters have room?' })],
        }
      },
    },
    {
      id: 'shelters',
      examples: ['Posko pengungsian mana yang masih kosong?', 'Kapasitas posko di zona banjir', 'Ke mana warga harus mengungsi?', 'Which shelters still have room?', 'Where should residents evacuate?', 'Ngungsi neng endi?', 'Posko sing isih kosong neng endi?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const list = [...g.shelters].sort((a, b) => b.capacity - b.occupied - (a.capacity - a.occupied)).slice(0, 4)
        const txt = list.map((s) => `${s.name} (${s.kecamatan}): ${nf(s.capacity - s.occupied, ctx.lang)} ${L(ctx.lang, { id: 'tempat', en: 'places' })}`).join('; ')
        return {
          text: L(ctx.lang, { id: `Sisa kapasitas terbesar: ${txt}. Lokasi & kapasitas posko adalah simulasi; posko terisi otomatis setelah peringatan banjir.`, en: `Most room left: ${txt}. Shelter sites & capacity are simulated; shelters fill automatically after a flood warning.` }),
          followUps: [L(ctx.lang, { id: 'Rumah sakit terdekat?', en: 'Nearest hospitals?' })],
        }
      },
    },
    {
      id: 'hospitals',
      examples: ['Rumah sakit terdekat dari zona banjir', 'Fasilitas kesehatan yang siaga', 'Puskesmas mana yang perlu disiapkan?', 'Nearest hospitals to the flood zone', 'Which health facilities should be on standby?', 'Rumah sakit sing cedhak neng endi?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        return {
          text: L(ctx.lang, { id: `Rumah sakit di peta: ${g.hospitals.map((h) => `${h.name} (${h.kecamatan})`).join('; ')}. Nyalakan lapisan "Fasilitas penting" untuk melihat lokasinya bersama zona genangan.`, en: `Hospitals on the map: ${g.hospitals.map((h) => `${h.name} (${h.kecamatan})`).join('; ')}. Turn on the "Key facilities" layer to see them with the flood zone.` }),
        }
      },
    },
    {
      id: 'rain',
      examples: ['Bagaimana prakiraan hujan hari ini?', 'Jam berapa hujan deras?', 'Seberapa lebat hujannya?', "What's today's rain forecast?", 'How heavy will the rain be?', 'Udan deres jam pira?', 'Mengko udan deres ora?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const r = g?.rain
        if (!g || !r) return { text: L(ctx.lang, { id: 'Radar menunjukkan sel hujan di barat wilayah. Jalankan prediksi untuk memuat prakiraan rinci (simulasi).', en: 'Radar shows rain cells west of the region. Run the forecast to load the detailed outlook (simulated).' }), followUps: [L(ctx.lang, { id: 'Bagaimana situasi banjir sekarang?', en: "What's the flood situation now?" })] }
        return {
          text: L(ctx.lang, { id: `${r.cells} sel hujan bergerak ke timur dengan puncak ${nf(r.peakMmH, 'id')} mm/jam, melintasi ${r.kecamatan.join(', ')} dalam 6 jam ke depan (radar simulasi, bukan data BMKG).`, en: `${r.cells} rain cells moving east, peaking at ${nf(r.peakMmH, 'en')} mm/h, crossing ${r.kecamatan.join(', ')} over the next 6 hours (simulated radar, not BMKG data).` }),
        }
      },
    },
    {
      id: 'reports',
      examples: ['Ada laporan warga yang mengonfirmasi?', 'Berapa aduan banjir dari Sapa Warga?', 'Apakah prediksi sudah terbukti di lapangan?', 'Any citizen reports confirming the forecast?', 'How many flood reports came in?', 'Wis ana laporan warga durung?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const latest = g.reports.latest.map((r) => `${r.code} ${r.desa} ${r.at}`).join('; ')
        return {
          text: L(ctx.lang, {
            id: `${g.reports.total} aduan banjir masuk sejak semalam (${latest}). ${g.reports.confirmed ? `${g.reports.confirmed} di antaranya membentuk klaster yang mengonfirmasi prediksi (badge "Terkonfirmasi warga").` : g.reports.largestCluster ? '' : 'Belum ada klaster ≥ 5 aduan dalam 1 km; konfirmasi muncul otomatis saat klaster terbentuk.'}`,
            en: `${g.reports.total} flood reports since last night (${latest}). ${g.reports.confirmed ? `${g.reports.confirmed} of them form a cluster that confirms the forecast ("Confirmed by citizens" badge).` : g.reports.largestCluster ? '' : 'No cluster of ≥ 5 reports within 1 km yet; confirmation appears automatically when one forms.'}`,
          }),
        }
      },
    },
    {
      id: 'harvest',
      examples: ['Bagaimana dampak banjir ke panen padi?', 'Berapa estimasi panen yang hilang?', 'Dampak ke pertanian?', 'What is the impact on the rice harvest?', 'How much harvest could be lost?', 'Panen pari piye yen kebanjiran?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const h = g.harvest
        const worst = h.worst.map((w) => `${w.kecamatan} ${nf(w.changePct, ctx.lang, 1)} %`).join(', ')
        return {
          text:
            h.scenario === 'pasca-banjir'
              ? L(ctx.lang, { id: `Skenario pascabanjir aktif: estimasi panen padi kabupaten ${nf(h.riceChangePct, 'id', 1)} % vs normal; terdalam ${worst}. Indeks Ekonomi dan Sinyal Pasar sudah menerima sinyal pasokan (simulasi).`, en: `Post-flood scenario active: district rice estimate ${nf(h.riceChangePct, 'en', 1)} % vs normal; worst ${worst}. Indeks Ekonomi and Sinyal Pasar already got the supply signal (simulated).` })
              : L(ctx.lang, { id: 'Estimasi panen masih skenario normal. Buka tab Pertanian dan geser ke "Pascabanjir" untuk menghitung penurunan di kecamatan terdampak.', en: 'Harvest estimates are on the normal scenario. Open the Agriculture tab and switch to "Post-flood" to compute the drop in the affected districts.' }),
        }
      },
    },
    {
      id: 'actions',
      examples: ['Apa yang harus dilakukan BPBD sekarang?', 'Rekomendasi langkah berikutnya', 'Prioritas tindakan pagi ini', 'What should we do now?', 'Recommend next steps', 'Saiki kudu piye?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const steps: string[] = []
        if (!g.forecast6h) steps.push(L(ctx.lang, { id: 'Jalankan prediksi 6 jam', en: 'Run the 6-hour forecast' }))
        if (!g.alerts.length) steps.push(L(ctx.lang, { id: `Kirim peringatan dini ke ${g.forecast6h?.kecamatan[0]?.name ?? 'kecamatan terdampak'}`, en: `Send an early warning to ${g.forecast6h?.kecamatan[0]?.name ?? 'the affected district'}` }))
        else if (g.alerts.some((a) => !a.broadcast)) steps.push(L(ctx.lang, { id: 'Siarkan peringatan yang belum terkirim', en: 'Broadcast the warning that has not been sent' }))
        steps.push(L(ctx.lang, { id: 'Siagakan posko & rumah sakit di zona', en: 'Put shelters & hospitals in the zone on standby' }))
        if (g.harvest.scenario === 'normal') steps.push(L(ctx.lang, { id: 'Hitung dampak pertanian pascabanjir', en: 'Compute the post-flood farm impact' }))
        return { text: steps.map((x, i) => `${i + 1}. ${x}`).join('\n'), followUps: [L(ctx.lang, { id: 'Susun peringatan dini', en: 'Draft an early warning' })] }
      },
    },
    {
      id: 'landuse',
      examples: ['Perubahan lahan apa yang terdeteksi?', 'Ada alih fungsi lahan di bantaran sungai?', 'Deteksi pembukaan hutan', 'What land-use changes were detected?', 'Any forest clearing?', 'Lahan sing owah neng endi wae?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        if (!g.landUse.length) return { text: L(ctx.lang, { id: 'Buka tab Lingkungan agar model membandingkan citra 2019 dan 2026 (simulasi).', en: 'Open the Environment tab so the model compares the 2019 and 2026 imagery (simulated).' }) }
        const ids = ui.get().sites
        return {
          text: L(ctx.lang, {
            id: `${g.landUse.length} perubahan terdeteksi (simulasi): ${ids.map((x) => `${KIND_LABEL[x.kind].id} di ${x.kecamatanName} ${nf(x.areaHa, 'id')} ha`).join('; ')}. Galian di bantaran memperbesar risiko luapan.`,
            en: `${g.landUse.length} changes detected (simulated): ${ids.map((x) => `${KIND_LABEL[x.kind].en} in ${x.kecamatanName} ${nf(x.areaHa, 'en')} ha`).join('; ')}. Riverbank digging raises the overflow risk.`,
          }),
        }
      },
    },
  ],
  fallback: (ctx) => ({
    text: L(ctx.lang, {
      id: 'Saya Geo-AI Siaga Wilayah: saya membaca hujan, muka air, prediksi genangan per desa, laporan warga, dan dampak pertanian. Coba salah satu pertanyaan ini.',
      en: 'I am the Siaga Wilayah Geo-AI: I read rain, water levels, per-village flood forecasts, citizen reports and the farm impact. Try one of these questions.',
    }),
    followUps: [
      L(ctx.lang, { id: 'Bagaimana situasi banjir sekarang?', en: "What's the flood situation now?" }),
      L(ctx.lang, { id: 'Desa mana yang paling cepat tergenang?', en: 'Which villages flood first?' }),
      L(ctx.lang, { id: 'Susun peringatan dini', en: 'Draft an early warning' }),
    ],
  }),
}

registerScenario(geoScenario)
