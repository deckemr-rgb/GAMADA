/**
 * siaga-wilayah/scenario.ts — Geo-AI simulation scenario (spec §9.2): 14 intents with examples in Indonesian, English
 * and Basa Jawa; every answer reads the compact context `geoContext()` builds from the world + the map's flood model
 * (the same object Live mode sends to the proxy, ≤ 6 KB). The draft_alert intent returns the shared structured kind
 * 'alert' (level / areas / message / channels), exactly what the proxy's draft_alert tool returns in Live mode.
 * Registered on import (imported only by the lazy Geo-AI drawer and the broadcast dialog).
 */
import { registerScenario, type Lang, type Scenario, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'
import { clock, currentRegion, getSession, rows, world } from '../../demo-kit/world'
import { regionalLanguageLabel } from '../../demo-kit/i18n'
import { harvestValues } from '../../demo-kit/world/satu-daerah'
import { FC_T0, arrivalAt, arrivals, clockText, confirmedIds, floodAlerts, floodClusterSize, floodReports, gaugeName, gaugeNow, harvestPasca, riverGauge, riverLevelAt, shelterOcc, shelters, warnZone } from './data'
import { KIND_LABEL } from './sites'
import { nf } from './strings'
import { impactAt, ui } from './ui'

/* ------------------------------------------------------------------ context */
export interface GeoCtx {
  region: string
  now: string
  role: string
  rain: { cells: number; peakMmH: number; kecamatan: string[] } | null
  river: { name: string; level: number; siaga: number; awas: number; rise24h: number; state: 'normal' | 'siaga' | 'awas'; trendPerH: number; crest: { level: number; at: string }; awasAt: string | null } | null
  /** world minute of `now` (for arrival clock times) */
  nowMin: number
  dam: { name: string; level: number; siaga: number; awas: number } | null
  /** the +6 h model run anchored at 07.00; `first` / `topDesa` are the earliest villages INSIDE the warning zone */
  forecast6h: { desa: number; people: number; areaKm2: number; kecamatanCount: number; kecamatan: { name: string; desa: number; people: number }[]; first: { desa: string; kecamatan: string; onsetH: number; at: string } | null; topDesa: { name: string; kecamatan: string; onsetH: number; people: number }[]; zone: string[] } | null
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
  // one "where does the water arrive first" answer: the earliest villages of the warning zone (as the warning card)
  const zoneIds = warnZone(s, i6)
  const arr = arrivals(i6, zoneIds)
  const first = arr.inZone[0] ?? null
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
  const nowMin = clock.get().minutes
  const gn = g ? gaugeNow(g, nowMin) : null
  return {
    region: s.region.name,
    now: clockText(nowMin, lang),
    nowMin,
    role: getSession().role,
    rain: cells.length ? { cells: cells.length, peakMmH: Math.max(...cells.map((c) => c.intensity)), kecamatan: s.region.floodKecamatanIds.map(kn) } : null,
    river:
      g && gn
        ? {
            name: gaugeName(g.name, lang), level: gn.level, siaga: g.siaga, awas: g.awas, rise24h: Math.round((gn.level - riverLevelAt(g, nowMin - 24 * 60)) * 100) / 100,
            state: gn.state, trendPerH: gn.trend, crest: { level: gn.peak.level, at: clockText(gn.peak.at, lang) }, awasAt: gn.awasAt !== null ? clockText(gn.awasAt, lang) : null,
          }
        : null,
    dam: dam ? { name: dam.name, level: dam.level, siaga: dam.siaga, awas: dam.awas } : null,
    forecast6h: i6
      ? {
          desa: i6.desa.length, people: Math.round(i6.people / 100) * 100, areaKm2: Math.round(i6.areaKm2 * 10) / 10, kecamatanCount: i6.kecamatanIds.length,
          kecamatan: [...perKec.entries()].sort((a, b) => b[1].people - a[1].people).slice(0, 6).map(([k, v]) => ({ name: kn(k), desa: v.desa, people: Math.round(v.people / 10) * 10 })),
          first: first ? { desa: first.name, kecamatan: kn(first.kecamatanId), onsetH: Math.round(first.onset * 10) / 10, at: clockText(arrivalAt(first.onset), lang) } : null,
          topDesa: arr.inZone.slice(0, 8).map((d) => ({ name: d.name, kecamatan: kn(d.kecamatanId), onsetH: Math.round(d.onset * 10) / 10, people: d.people })),
          zone: zoneIds.map(kn),
        }
      : null,
    alerts: floodAlerts(s).map((a) => ({ id: a.id, level: a.level, kecamatan: a.kecamatanIds.map(kn), broadcast: !!a.broadcast, recipients: a.broadcast?.recipients ?? 0, confirmedBy: a.confirmedBy?.length ?? 0 })),
    reports: { total: reps.length, confirmed: conf.size, largestCluster: floodClusterSize(s), latest: reps.slice(0, 4).map((c) => ({ code: c.code, desa: dn(c.kecamatanId, c.desaId), kecamatan: kn(c.kecamatanId), at: clockText(c.at, lang) })) },
    shelters: shelters(s).slice(0, 8).map((f) => ({ name: f.name, kecamatan: kn(f.kecamatanId), capacity: f.capacity, occupied: shelterOcc(s, f, nowMin) })),
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
const JAWA = /\b(banyu|kali|omah|omahe|dalan|akeh|udan|deres|piye|pira|piro|endi|ngendi|sing|wis|durung|saiki|mengko|kudu|ora|mboten|nggih|kula|kulo|panjenengan|wae|mawon|jebol|waduk|ngungsi|kebanjiran|munggah|dhuwur|pari|panen|neng|ning|kapan|opo|tekan|banjire|apa\s+wae)\b/gi
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
/**
 * The early-warning text. `rich` (the AI draft) adds what the model knows on top of the template: the arrival clock
 * time of the first villages of the chosen area, the shelter with the most places left there, the river reading and a
 * short line in the regional language for WhatsApp.
 */
export function draftAlert(g: GeoCtx, lang: Lang, level: 1 | 2 | 3 | 4 = 3, areas?: string[], onsetH?: number, rich = false): { level: 'waspada' | 'siaga' | 'awas'; areas: string[]; message: string; channels: ('wa' | 'sms' | 'sirine' | 'media-sosial' | 'radio')[] } {
  if (rich) return richDraft(g, lang, level, areas)
  const kec = areas?.length ? areas : (g.forecast6h?.kecamatan.slice(0, 1).map((k) => k.name) ?? g.alerts[0]?.kecamatan ?? [])
  const inArea = g.forecast6h?.topDesa.filter((d) => kec.includes(d.kecamatan)) ?? []
  const desa = inArea.slice(0, 3).map((d) => d.name)
  const shelter = shelterName(g.shelters.find((s) => kec.includes(s.kecamatan))?.name ?? g.shelters[0]?.name, lang)
  // the same numbers as the Situation card and the AI draft: river reading now, first arrival in the area (model run
  // 07.00), the AWAS crossing and the crest
  const onset = onsetH ?? (inArea.length ? Math.min(...inArea.map((d) => d.onsetH)) : (g.forecast6h?.first?.onsetH ?? null))
  const t1 = onset !== null ? arrivalAt(onset) : null
  const lv = LEVEL_NAME[level][lang].toUpperCase()
  const r = g.river
  const river = r ? riverOf(r.name) : L(lang, { id: 'sungai', en: 'the river' })
  const st = r ? (r.state === 'awas' ? (lang === 'id' ? 'AWAS' : 'WARNING') : r.state === 'siaga' ? (lang === 'id' ? 'SIAGA' : 'WATCH') : 'normal') : ''
  const area = `${lang === 'id' ? 'Kec.' : kec.length > 1 ? 'the districts of' : 'District'} ${kec.join(', ')}${desa.length ? ` (${desa.join(', ')})` : ''}`
  const act = {
    1: { id: 'Pantau info resmi dan siapkan tas siaga.', en: 'Follow official updates and prepare a go-bag.' },
    2: { id: 'Siapkan evakuasi lansia, anak, dan disabilitas; amankan dokumen.', en: 'Prepare to evacuate the elderly, children and people with disabilities; secure documents.' },
    3: { id: `Segera menuju ${shelter}. Matikan listrik bila air masuk rumah.`, en: `Go to ${shelter} now. Switch off power if water enters the house.` },
    4: { id: `Evakuasi wajib sekarang ke ${shelter}. Ikuti arahan petugas.`, en: `Mandatory evacuation now to ${shelter}. Follow the officers.` },
  }[level][lang]
  const rising = !!r && r.trendPerH > 0.02
  const crestAhead = !!r && r.crest.level > r.level + 0.02
  const id = [
    `[SIMULASI DEMO] [PERINGATAN DINI BANJIR · LEVEL ${level} ${lv}] BPBD ${g.region}:`,
    r ? ` ${river} ${nf(r.level, 'id', 2)} m (${st})${rising ? ' dan naik' : ''}.` : '',
    t1 !== null ? ` Genangan ${t1 <= g.nowMin ? 'sudah mulai sejak' : 'diperkirakan mulai'} ±${clockText(t1, 'id')} di ${area}.` : ` Diperkirakan meluap di ${area}.`,
    r?.awasAt ? ` Sungai diperkirakan lewat batas awas ±${r.awasAt}${crestAhead ? `, puncak ±${r.crest.at}` : ''}.` : crestAhead && r ? ` Puncak diperkirakan ±${r.crest.at}.` : '',
    ` ${act} Darurat: 112. Info resmi hanya dari BPBD.`,
  ].join('')
  const en = [
    `[DEMO SIMULATION] [FLOOD EARLY WARNING · LEVEL ${level} ${lv}] BPBD ${g.region}:`,
    r ? ` the ${river} is at ${nf(r.level, 'en', 2)} m (${st})${rising ? ' and rising' : ''}.` : '',
    t1 !== null ? ` Flooding ${t1 <= g.nowMin ? 'has been under way since' : 'is expected from'} about ${clockText(t1, 'en')} in ${area}.` : ` Expected to overflow in ${area}.`,
    r?.awasAt ? ` The river is expected to pass the warning level at about ${r.awasAt}${crestAhead ? `, cresting around ${r.crest.at}` : ''}.` : crestAhead && r ? ` Crest expected around ${r.crest.at}.` : '',
    ` ${act} Emergency: 112. Official info only from BPBD.`,
  ].join('')
  const message = lang === 'id' ? id : en
  return { level: level >= 3 ? 'awas' : level === 2 ? 'siaga' : 'waspada', areas: kec, message: message.slice(0, 600), channels: level >= 3 ? ['wa', 'sms', 'sirine'] : ['wa', 'sms'] }
}

/** a shelter as it reads in a message: EN says "the evacuation shelter at <site>" (the seed name is Indonesian) */
function shelterName(name: string | undefined, lang: Lang): string {
  if (!name) return L(lang, { id: 'posko terdekat', en: 'the nearest shelter' })
  return lang === 'en' ? name.replace(/^Posko pengungsian\s+/i, 'the evacuation shelter at ') : name
}

/** shelters of the world with places left, nearest first to a kecamatan (simulated sites & capacity) */
function sheltersNear(kecName: string): { name: string; kecamatan: string; left: number; km: number }[] {
  const s = world.get()
  const ks = s.region.kecamatan
  const k = ks.find((x) => x.name.toLowerCase() === kecName.toLowerCase())
  const kx = 111.32 * Math.cos(((k?.centroid[1] ?? -7) * Math.PI) / 180)
  return shelters(s)
    .map((f) => {
      const fk = ks.find((x) => x.id === f.kecamatanId)
      const c = f.coord ?? fk?.centroid ?? [0, 0]
      const km = k ? Math.hypot((c[0] - k.centroid[0]) * kx, (c[1] - k.centroid[1]) * 110.57) : 0
      return { name: f.name, kecamatan: fk?.name ?? '—', left: Math.max(0, f.capacity - shelterOcc(s, f, clock.get().minutes)), km: Math.round(km * 10) / 10 }
    })
    .sort((a, b) => a.km - b.km)
}

function richDraft(g: GeoCtx, lang: Lang, level: 1 | 2 | 3 | 4, areas?: string[]): ReturnType<typeof draftAlert> {
  const s = world.get()
  const kec = areas?.length ? areas : (g.forecast6h?.kecamatan.slice(0, 1).map((k) => k.name) ?? g.alerts[0]?.kecamatan ?? [])
  const kecIds = new Set(s.region.kecamatan.filter((k) => kec.includes(k.name)).map((k) => k.id))
  const i6 = ui.get().impact6 ?? impactAt(6)
  const first = (i6?.desa ?? []).filter((d) => kecIds.has(d.kecamatanId)).sort((a, b) => a.onset - b.onset).slice(0, 3)
  const at = (h: number) => clockText(arrivalAt(h), lang)
  const times = first.map((d) => `${d.name} ±${at(d.onset)}`).join(', ')
  const best = kec.flatMap((k) => sheltersNear(k).slice(0, 2)).sort((a, b) => b.left - a.left)[0] ?? sheltersNear(kec[0] ?? '')[0]
  const shelter = best ? `${shelterName(best.name, lang)} (${L(lang, { id: `sisa ${nf(best.left, 'id')} tempat`, en: `${nf(best.left, 'en')} places left` })})` : L(lang, { id: 'posko terdekat', en: 'the nearest shelter' })
  const lv = LEVEL_NAME[level][lang].toUpperCase()
  const r = g.river
  const river = r ? riverOf(r.name) : L(lang, { id: 'sungai', en: 'the river' })
  const st = r ? (r.state === 'awas' ? 'AWAS' : r.state === 'siaga' ? (lang === 'id' ? 'SIAGA' : 'WATCH') : 'normal') : ''
  const act = {
    1: { id: 'Pantau info resmi dan siapkan tas siaga.', en: 'Follow official updates and prepare a go-bag.' },
    2: { id: `Siapkan evakuasi lansia, anak, dan disabilitas ke ${shelter}.`, en: `Prepare to move the elderly, children and people with disabilities to ${shelter}.` },
    3: { id: `Segera menuju ${shelter}. Matikan listrik bila air masuk rumah.`, en: `Go to ${shelter} now. Switch off power if water enters the house.` },
    4: { id: `Evakuasi wajib sekarang ke ${shelter}. Ikuti arahan petugas.`, en: `Mandatory evacuation now to ${shelter}. Follow the officers.` },
  }[level][lang]
  // one short line in the region's own language for WhatsApp (Basa Jawa / Sunda / Minang); none for other languages
  const pack = currentRegion()
  const code = pack?.languages.regional[0]
  const rv = r ? riverOf(r.name) : ''
  const local: Record<string, [string, string]> = {
    jv: [`Banyu ${rv || 'kali'} munggah, enggal ngungsi menyang posko.`, 'Banyu kali munggah, siap-siap ngungsi.'],
    su: [`Cai ${rv || 'walungan'} naek, geura ngungsi ka posko.`, 'Cai walungan naek, sasayagian ngungsi.'],
    min: [`Aia ${rv || 'batang'} naiak, capek mangungsi ka posko.`, 'Aia batang naiak, basiap-siap mangungsi.'],
  }
  const jwPair = code ? local[code] : undefined
  const jw = jwPair ? `(${regionalLanguageLabel(pack, lang === 'id' ? 'id' : 'en')}) ${level >= 3 ? jwPair[0] : jwPair[1]}` : ''
  const message =
    lang === 'id'
      ? `[SIMULASI DEMO] [PERINGATAN DINI BANJIR · LEVEL ${level} ${lv}] BPBD ${g.region}: ${r ? `${river} ${nf(r.level, 'id', 2)} m (${st}) dan naik, ` : ''}diperkirakan meluap di Kec. ${kec.join(', ')}.${times ? ` Perkiraan air tiba: ${times}.` : ''} ${act} Darurat: 112. Info resmi hanya dari BPBD.${jw ? ` ${jw}` : ''}`
      : `[DEMO SIMULATION] [FLOOD EARLY WARNING · LEVEL ${level} ${lv}] BPBD ${g.region}: ${r ? `the ${river} is at ${nf(r.level, 'en', 2)} m (${st}) and rising, ` : ''}expected to overflow in ${kec.join(', ')}.${times ? ` Water expected: ${times}.` : ''} ${act} Emergency: 112. Official info only from BPBD.${jw ? ` ${jw}` : ''}`
  return { level: level >= 3 ? 'awas' : level === 2 ? 'siaga' : 'waspada', areas: kec, message: message.slice(0, 600), channels: level >= 3 ? ['wa', 'sms', 'sirine'] : ['wa', 'sms'] }
}

/** kecamatan named in a question (whole word, any case) */
const kecInText = (text: string): string[] => kecSlot().filter((n) => new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, 'iu').test(text))
/** a horizon in hours named in a question ("3 jam", "2 h", "1 jam ke depan"), 1…6 */
const hoursInText = (text: string): number | null => {
  const m = /(\d+(?:[.,]\d+)?)\s*(jam|j|h|hours?|hrs?)\b/i.exec(text)
  if (!m) return null
  const h = Number(m[1]!.replace(',', '.'))
  return h >= 0.5 && h <= 6 ? h : null
}

/* ------------------------------------------------------------------ answers shared by several intents */
/** the district named closest AFTER a topic word ("… posko di <kecamatan>" → that kecamatan), else the first one named */
function kecNear(text: string, topic: RegExp): string | null {
  const names = kecInText(text)
  if (!names.length) return null
  const at = text.search(topic)
  if (at < 0) return names[0]!
  const pos = names.map((n) => ({ n, i: text.toLowerCase().indexOf(n.toLowerCase(), at) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)
  return pos[0]?.n ?? names[names.length - 1]!
}
const hLbl = (h: number, lang: Lang) => nf(h, lang, h % 1 ? 2 : 0)

/** villages flooded within a horizon (optionally in named districts), earliest first, with the warning-zone context */
function answerDesa(ctx: SimContext, _g: GeoCtx): SimResponse {
  const hz = hoursInText(ctx.text)
  const kn = kecInText(ctx.text)
  const s = world.get()
  const kecIds = new Set(s.region.kecamatan.filter((k) => kn.includes(k.name)).map((k) => k.id))
  const kName = (id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
  const hLabel = hz ?? 6
  const imp = hz !== null && hz !== 6 ? impactAt(Math.round(hz * 4) / 4) : (ui.get().impact6 ?? impactAt(6))
  const until = clockText(FC_T0 + hLabel * 60, ctx.lang)
  const scope = kn.length ? L(ctx.lang, { id: ` di Kec. ${kn.join(', ')}`, en: ` in ${kn.join(', ')}` }) : ''
  const rowsAll = (imp?.desa ?? []).filter((d) => !kecIds.size || kecIds.has(d.kecamatanId))
  if (!rowsAll.length)
    return { text: L(ctx.lang, { id: `Model +${hLbl(hLabel, 'id')} jam (s.d. ${until}): belum ada desa tergenang${scope} (simulasi).`, en: `+${hLbl(hLabel, 'en')} h model (to ${until}): no village floods${scope} yet (simulated).` }), toolCalls: [{ name: 'flood_model', input: { hours: hLabel, kecamatan: kn }, output: { desa: 0 }, ms: 180 }] }
  // no district named: the earliest villages INSIDE the warning zone (the same list as the warning card and the AI
  // draft), then an honest line about earlier local flooding outside it
  const zone = warnZone(s, ui.get().impact6 ?? impactAt(6))
  const { inZone, outside } = arrivals({ ...(imp as NonNullable<typeof imp>), desa: rowsAll }, kn.length ? [...kecIds] : zone)
  const top = (inZone.length ? inZone : outside).slice(0, 5)
  const tt = (d: (typeof top)[number], lang: Lang) => clockText(arrivalAt(d.onset), lang)
  const list = top.map((d) => `${d.name} (${kName(d.kecamatanId)}, ±${tt(d, ctx.lang)})`).join('; ')
  const people = rowsAll.reduce((n, d) => n + d.people, 0)
  let note = ''
  if (!kn.length && outside.length && inZone[0] && outside[0]!.onset < inZone[0].onset) {
    const ks = [...new Set(outside.filter((d) => d.onset < inZone[0]!.onset).map((d) => d.kecamatanId))].slice(0, 3)
    const shareTxt = ks.map((k) => {
      const tot = s.region.kecamatan.find((x) => x.id === k)?.desa.length ?? 0
      const n6 = (ui.get().impact6?.desa ?? []).filter((d) => d.kecamatanId === k).length
      return `${kName(k)} ${n6}/${tot}`
    }).join(', ')
    const early = outside.filter((d) => ks.includes(d.kecamatanId)).slice(0, 2).map((d) => `${d.name} ±${tt(d, ctx.lang)}`).join(', ')
    note = L(ctx.lang, {
      id: ` Di luar zona peringatan ada genangan lokal sedikit lebih awal (${early}) di Kec. ${shareTxt} desa tergenang pada +6 j: warga terdampaknya jauh lebih sedikit, jadi model tidak memasukkannya ke 6 kecamatan zona; tambahkan di dialog peringatan bila perlu.`,
      en: ` Outside the warning zone there is slightly earlier local flooding (${early}) in ${shareTxt} villages flooded at +6 h: far fewer people are affected, so the model leaves them out of the 6-district zone; add them in the warning dialog if needed.`,
    })
  }
  const head = kn.length
    ? L(ctx.lang, { id: `Dalam ${hLbl(hLabel, 'id')} jam (s.d. ${until})${scope}, paling cepat tergenang: ${list}.`, en: `Within ${hLbl(hLabel, 'en')} h (to ${until})${scope}, flooding first: ${list}.` })
    : L(ctx.lang, { id: `Dalam ${hLbl(hLabel, 'id')} jam (s.d. ${until}), paling cepat tergenang di zona peringatan (${zone.map(kName).join(', ')}): ${list}.`, en: `Within ${hLbl(hLabel, 'en')} h (to ${until}), flooding first in the warning zone (${zone.map(kName).join(', ')}): ${list}.` })
  const text =
    head +
    L(ctx.lang, { id: ` Total ${nf(rowsAll.length, 'id')} desa${scope}, ±${ppl(people, 'id')} warga (model turunan, simulasi).`, en: ` ${nf(rowsAll.length, 'en')} villages in total${scope}, ±${ppl(people, 'en')} people (derived model, simulated).` }) +
    note
  const jw = isJawa(ctx.text) ? `Nggih. Ing ${hLbl(hLabel, 'id')} jam ngajeng, toya rumiyin dumugi ${top.slice(0, 3).map((d) => `${d.name} (±${tt(d, 'id')})`).join(', ')}. Sedaya wonten ${nf(rowsAll.length, 'id')} desa (simulasi).` : null
  return { text: jw ?? text, translation: jw ? text : undefined, toolCalls: [{ name: 'flood_model', input: { hours: hLabel, ...(kn.length ? { kecamatan: kn } : {}) }, output: { desa: rowsAll.length }, ms: 180 }], followUps: [L(ctx.lang, { id: 'Berapa warga terdampak per kecamatan?', en: 'How many people per district?' }), L(ctx.lang, { id: 'Posko mana yang masih kosong?', en: 'Which shelters have room?' })] }
}

/** people in the flood zone, at the horizon asked ("dalam 3 jam", "2 jam lagi"), with the 6-hour figure beside it */
function answerPeople(ctx: SimContext, g: GeoCtx): SimResponse {
  const f = g.forecast6h!
  const hz = hoursInText(ctx.text)
  const s = world.get()
  const kn = kecInText(ctx.text)
  const kecIds = new Set(s.region.kecamatan.filter((k) => kn.includes(k.name)).map((k) => k.id))
  const kName = (id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
  const imp = hz !== null && hz !== 6 ? impactAt(Math.round(hz * 4) / 4) : (ui.get().impact6 ?? impactAt(6))
  const rowsH = (imp?.desa ?? []).filter((d) => !kecIds.size || kecIds.has(d.kecamatanId))
  const per = new Map<string, { n: number; p: number }>()
  for (const d of rowsH) {
    const a = per.get(d.kecamatanId) ?? { n: 0, p: 0 }
    a.n++
    a.p += d.people
    per.set(d.kecamatanId, a)
  }
  const top = [...per.entries()].sort((a, b) => b[1].p - a[1].p).slice(0, 5).map(([k, v]) => `${kName(k)} ${ppl(v.p, ctx.lang)} (${v.n} ${L(ctx.lang, { id: 'desa', en: 'villages' })})`).join(', ')
  const total = rowsH.reduce((n, d) => n + d.people, 0)
  const scope = kn.length ? L(ctx.lang, { id: ` di Kec. ${kn.join(', ')}`, en: ` in ${kn.join(', ')}` }) : ''
  const hLabel = hz ?? 6
  const until = clockText(FC_T0 + hLabel * 60, ctx.lang)
  const six = hz !== null && hz !== 6 && !kn.length ? L(ctx.lang, { id: ` Bandingkan dalam 6 jam (s.d. ${clockText(FC_T0 + 360, 'id')}): ±${ppl(f.people, 'id')} warga di ${nf(f.desa, 'id')} desa.`, en: ` Compare within 6 h (to ${clockText(FC_T0 + 360, 'en')}): ±${ppl(f.people, 'en')} people in ${nf(f.desa, 'en')} villages.` }) : ''
  return {
    text: rowsH.length
      ? L(ctx.lang, { id: `Dalam ${hLbl(hLabel, 'id')} jam (s.d. ${until})${scope}: ±${ppl(total, 'id')} warga di ${nf(rowsH.length, 'id')} desa. Terbanyak: ${top}.${six} Penduduk desa diturunkan dari penduduk kecamatan di region pack, angka simulasi.`, en: `Within ${hLbl(hLabel, 'en')} h (to ${until})${scope}: ±${ppl(total, 'en')} people in ${nf(rowsH.length, 'en')} villages. Most: ${top}.${six} Village population is derived from district population in the region pack; simulated figures.` })
      : L(ctx.lang, { id: `Dalam ${hLbl(hLabel, 'id')} jam (s.d. ${until})${scope}: belum ada desa tergenang (simulasi).${six}`, en: `Within ${hLbl(hLabel, 'en')} h (to ${until})${scope}: no village floods yet (simulated).${six}` }),
    toolCalls: [{ name: 'flood_model', input: { hours: hLabel, ...(kn.length ? { kecamatan: kn } : {}) }, output: { people: Math.round(total / 100) * 100 }, ms: 160 }],
    followUps: [L(ctx.lang, { id: 'Susun peringatan dini untuk kecamatan terbanyak', en: 'Draft a warning for the top district' })],
  }
}

/** shelters: of a named district (honestly none + the nearest), or the most room left; capacity vs the zone's need */
function answerShelters(ctx: SimContext, g: GeoCtx): SimResponse {
  const places = L(ctx.lang, { id: 'tempat', en: 'places' })
  const k = kecNear(ctx.text, /posko|ngungsi|mengungsi|pengungsian|shelter|evacuat/i)
  if (k) {
    const near = sheltersNear(k)
    const own = near.filter((x) => x.kecamatan.toLowerCase() === k.toLowerCase())
    const others = near.filter((x) => x.kecamatan.toLowerCase() !== k.toLowerCase()).slice(0, 2)
    const fmt = (x: (typeof near)[number]) => `${shelterName(x.name, ctx.lang)} (${x.kecamatan}, ${nf(x.left, ctx.lang)} ${places}${own.includes(x) ? '' : `, ±${nf(x.km, ctx.lang, 1)} km`})`
    const camat = /camat|kepala kecamatan|district head/i.test(ctx.text)
      ? L(ctx.lang, { id: ` Penanggung jawab wilayah: Camat ${k} (jabatan; nomor kontak fiktif ada di daftar penerima peringatan).`, en: ` In charge: the Camat (district head) of ${k} (title only; the fictional contact number is in the warning recipient list).` })
      : ''
    return {
      text: own.length
        ? L(ctx.lang, { id: `Posko di Kec. ${k}: ${own.map(fmt).join('; ')}.${camat} Lokasi & kapasitas posko simulasi.`, en: `Shelters in ${k}: ${own.map(fmt).join('; ')}.${camat} Shelter sites & capacity are simulated.` })
        : L(ctx.lang, { id: `Tidak ada posko simulasi di Kec. ${k}. Terdekat: ${others.map(fmt).join('; ')}.${camat} Lokasi & kapasitas posko simulasi.`, en: `There is no simulated shelter in ${k}. Nearest: ${others.map(fmt).join('; ')}.${camat} Shelter sites & capacity are simulated.` }),
      toolCalls: [{ name: 'shelters', input: { kecamatan: k }, output: { inDistrict: own.length }, ms: 120 }],
      followUps: [L(ctx.lang, { id: `Desa mana di ${k} yang tergenang 3 jam ke depan?`, en: `Which villages in ${k} flood in the next 3 hours?` })],
    }
  }
  const list = [...g.shelters].sort((a, b) => b.capacity - b.occupied - (a.capacity - a.occupied)).slice(0, 4)
  const txt = list.map((x) => `${shelterName(x.name, ctx.lang)} (${x.kecamatan}): ${nf(x.capacity - x.occupied, ctx.lang)} ${places}`).join('; ')
  const cap = g.shelters.reduce((n, x) => n + x.capacity, 0)
  return {
    text: L(ctx.lang, {
      id: `Sisa kapasitas terbesar: ${txt}. Total kapasitas ${nf(cap, 'id')} tempat; dengan asumsi ±5 % warga zona peringatan butuh posko, kapasitas ini kurang dan perlu posko tambahan. Lokasi & kapasitas posko simulasi; posko terisi bertahap setelah peringatan banjir.`,
      en: `Most room left: ${txt}. Total capacity ${nf(cap, 'en')} places; assuming ±5 % of the warning-zone population needs a shelter, that falls short and extra shelters are needed. Shelter sites & capacity are simulated; shelters fill gradually after a flood warning.`,
    }),
    followUps: [L(ctx.lang, { id: 'Rumah sakit terdekat?', en: 'Nearest hospitals?' })],
  }
}

/** the harvest impact (a named district's own change when the post-flood scenario is on) */
function answerHarvest(ctx: SimContext, g: GeoCtx): SimResponse {
  const h = g.harvest
  const s = world.get()
  const k1 = kecNear(ctx.text, /panen|pertanian|harvest|crop|pari/i)
  const kn = k1 ? [k1] : []
  if (h.scenario !== 'pasca-banjir')
    return { text: L(ctx.lang, { id: `Estimasi panen masih skenario normal${kn.length ? ` (termasuk Kec. ${kn.join(', ')})` : ''}. Buka tab Pertanian dan geser ke "Pascabanjir" untuk menghitung penurunan dan potensi kerugian per kecamatan.`, en: `Harvest estimates are on the normal scenario${kn.length ? ` (including ${kn.join(', ')})` : ''}. Open the Agriculture tab and switch to "Post-flood" to compute the drop and the potential loss per district.` }) }
  const rice = harvestValues(s, 'change', 'padi')
  const named = kn.map((n) => {
    const id = s.region.kecamatan.find((k) => k.name === n)?.id ?? ''
    return `${n} ${nf(rice[id] ?? 0, ctx.lang, 1)} %`
  })
  const worst = h.worst.map((w) => `${w.kecamatan} ${nf(w.changePct, ctx.lang, 1)} %`).join(', ')
  return {
    text: L(ctx.lang, {
      id: `Skenario pascabanjir aktif: estimasi panen padi kabupaten ${nf(h.riceChangePct, 'id', 1)} % vs normal${named.length ? `; ${named.join(', ')}` : ''}; terdalam ${worst}. Indeks Ekonomi dan Sinyal Pasar sudah menerima sinyal pasokan (simulasi).`,
      en: `Post-flood scenario active: district rice estimate ${nf(h.riceChangePct, 'en', 1)} % vs normal${named.length ? `; ${named.join(', ')}` : ''}; worst ${worst}. Indeks Ekonomi and Sinyal Pasar already got the supply signal (simulated).`,
    }),
  }
}

/** a question that also asks about another topic gets that part answered too (never silently dropped) */
const TOPICS: { id: 'shelters' | 'desa' | 'harvest' | 'people'; re: RegExp; also?: (t: string) => boolean }[] = [
  { id: 'shelters', re: /posko|ngungsi|mengungsi|pengungsian|shelter|evacuat/i },
  { id: 'desa', re: /banjir|tergenang|kebanjiran|\bflood/i, also: (t) => hoursInText(t) !== null || kecInText(t).length > 0 },
  { id: 'harvest', re: /panen|pertanian|harvest|\bcrop|\bpari\b/i },
  { id: 'people', re: /berapa (warga|jiwa|orang)|how many people|pira wong/i },
]
const ANSWER = { shelters: answerShelters, desa: answerDesa, harvest: answerHarvest, people: answerPeople } as const
function withOthers(ctx: SimContext, g: GeoCtx, own: string, first: SimResponse): SimResponse {
  const more: SimResponse[] = []
  for (const tp of TOPICS) {
    if (tp.id === own || (own === 'people' && tp.id === 'desa') || (own === 'desa' && tp.id === 'people')) continue
    if (!tp.re.test(ctx.text) || (tp.also && !tp.also(ctx.text))) continue
    if ((tp.id === 'desa' || tp.id === 'people') && !g.forecast6h) continue
    more.push(ANSWER[tp.id](ctx, g))
  }
  if (!more.length) return first
  return {
    ...first,
    text: [first.text, ...more.map((m) => m.text)].join('\n\n'),
    translation: first.translation ? [first.translation, ...more.map((m) => m.text)].join('\n\n') : undefined,
    toolCalls: [...(first.toolCalls ?? []), ...more.flatMap((m) => m.toolCalls ?? [])],
  }
}

/* ------------------------------------------------------------------ scenario */
const kecSlot = (): string[] => world.get().region.kecamatan.map((k) => k.name)

export const geoScenario: Scenario<GeoCtx> = {
  product: 'siaga-wilayah',
  threshold: 0.3,
  intents: [
    {
      id: 'status',
      examples: ['Bagaimana situasi banjir sekarang?', 'Ringkas kondisi siaga banjir pagi ini', 'Apa status peringatan hari ini?', "What's the flood situation now?", 'Give me a status summary', 'Piye kahanan banjir saiki?', 'Kahanan kali saiki piye, wis bahaya durung?', 'Kumaha kaayaan banjir ayeuna?', 'Baa kondisi banjia kini?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const f = g.forecast6h
        const al = g.alerts[0]
        const id = `${f ? `Model 6 jam: ${nf(f.desa, 'id')} desa di ${f.kecamatanCount} kecamatan diprediksi tergenang, ±${ppl(f.people, 'id')} warga (simulasi). ` : 'Model genangan belum dijalankan. '}${g.river ? `${g.river.name} ${nf(g.river.level, 'id', 2)} m, status ${g.river.state === 'awas' ? 'AWAS' : g.river.state === 'siaga' ? 'SIAGA' : 'normal'} (siaga ${nf(g.river.siaga, 'id', 1)} m, awas ${nf(g.river.awas, 'id', 1)} m)${g.river.awasAt ? `, proyeksi lewat awas ±${g.river.awasAt}` : ''}. ` : ''}${al ? `Peringatan aktif level ${al.level} untuk ${al.kecamatan.join(', ')}${al.broadcast ? `, sudah disiarkan ke ${nf(al.recipients, 'id')} penerima` : ', belum disiarkan'}.` : 'Belum ada peringatan aktif.'}${g.reports.confirmed ? ` ${g.reports.confirmed} aduan warga mengonfirmasi prediksi.` : ''}`
        const en = `${f ? `6-hour model: ${nf(f.desa, 'en')} villages in ${f.kecamatanCount} districts predicted to flood, ±${ppl(f.people, 'en')} people (simulated). ` : 'The flood model has not been run. '}${g.river ? `${g.river.name} ${nf(g.river.level, 'en', 2)} m, status ${g.river.state === 'awas' ? 'WARNING' : g.river.state === 'siaga' ? 'WATCH' : 'normal'} (watch ${nf(g.river.siaga, 'en', 1)} m, warning ${nf(g.river.awas, 'en', 1)} m)${g.river.awasAt ? `, projected past the warning level at ±${g.river.awasAt}` : ''}. ` : ''}${al ? `Active level-${al.level} warning for ${al.kecamatan.join(', ')}${al.broadcast ? `, broadcast to ${nf(al.recipients, 'en')} recipients` : ', not broadcast yet'}.` : 'No active warning.'}${g.reports.confirmed ? ` ${g.reports.confirmed} citizen reports confirm the forecast.` : ''}`
        const jw = isJawa(ctx.text) ? `Nggih. ${f ? `Ing 6 jam ngajeng, ${nf(f.desa, 'id')} desa saged kebanjiran, kinten-kinten ${ppl(f.people, 'id')} tiyang (simulasi).` : 'Model banjir dereng dipun lampahaken.'} ${al ? `Peringatan level ${al.level} sampun aktif.` : 'Dereng wonten peringatan.'}` : null
        return { text: jw ?? (ctx.lang === 'id' ? id : en), translation: jw ? (ctx.lang === 'id' ? id : en) : undefined, followUps: [L(ctx.lang, { id: 'Desa mana yang paling cepat tergenang?', en: 'Which villages flood first?' }), L(ctx.lang, { id: 'Susun peringatan dini', en: 'Draft an early warning' })] }
      },
    },
    {
      id: 'desa',
      examples: ['Desa mana saja yang terdampak 6 jam ke depan?', 'Daftar desa yang akan tergenang', 'Desa mana yang paling cepat banjir?', 'Desa mana yang paling berisiko 3 jam ke depan?', 'Which villages will be affected?', 'List the villages that will flood first', 'Which villages are most at risk in the next 2 hours?', 'Desa endi wae sing bakal kebanjiran?', 'Kampung endi sing kebanjiran dhisik?', 'Banyu wis tekan ngendi?', 'Banjire wis tekan desa endi?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g || !g.forecast6h) return noForecast(ctx)
        return withOthers(ctx, g, 'desa', answerDesa(ctx, g))
      },
    },
    {
      id: 'people',
      examples: ['Berapa warga terdampak?', 'Berapa warga terdampak dalam 3 jam?', 'Berapa jiwa terdampak 2 jam lagi?', 'Jumlah penduduk di zona banjir per kecamatan', 'Berapa jiwa yang perlu dievakuasi?', 'How many people are affected?', 'How many people are affected in the next 3 hours?', 'Population in the flood zone by district', 'Pira wong sing kena banjir?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g || !g.forecast6h) return noForecast(ctx)
        return withOthers(ctx, g, 'people', answerPeople(ctx, g))
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
            id: `Di zona peringatan, air pertama diperkirakan masuk ${f.first?.desa ?? '—'} (${f.first?.kecamatan ?? '—'}) ±${f.first?.at ?? '—'} (model ${clockText(FC_T0, 'id')}). ${g.river && g.river.crest.level > g.river.level ? `Muka air ${riverOf(g.river.name)} diproyeksikan memuncak ${nf(g.river.crest.level, 'id', 2)} m ±${g.river.crest.at}, lalu surut perlahan sore hingga malam` : 'Muka air sungai sudah melewati puncak dan mulai surut'} (proyeksi simulasi, lihat tab Prediksi).`,
            en: `In the warning zone, first water is expected in ${f.first?.desa ?? '—'} (${f.first?.kecamatan ?? '—'}) at about ${f.first?.at ?? '—'} (model run ${clockText(FC_T0, 'en')}). ${g.river && g.river.crest.level > g.river.level ? `The ${riverOf(g.river.name)} is projected to crest at ${nf(g.river.crest.level, 'en', 2)} m around ${g.river.crest.at}, then recede slowly through the afternoon and night` : 'The river has passed its crest and is receding'} (simulated projection, see the Forecast tab).`,
          }),
          followUps: [L(ctx.lang, { id: 'Berapa tinggi muka air sungai?', en: 'What is the river level?' })],
        }
      },
    },
    {
      id: 'river',
      examples: ['Berapa tinggi muka air sungai utama?', 'Status pos pantau sungai', 'Apakah sungai sudah siaga?', 'What is the river water level?', 'Is the river above the watch level?', 'Banyu kali saiki pira dhuwure?', 'Cai walungan ayeuna sabaraha luhurna?', 'Aia batang kini sabara tinggi?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        const r = g?.river
        if (!g || !r) return noForecast(ctx)
        const rising = r.trendPerH > 0.02
        const st = r.state === 'awas' ? L(ctx.lang, { id: 'di atas batas AWAS', en: 'above the WARNING level' }) : r.state === 'siaga' ? L(ctx.lang, { id: 'di atas batas SIAGA', en: 'above the WATCH level' }) : rising ? L(ctx.lang, { id: 'di bawah batas siaga, tetapi naik', en: 'below the watch level but rising' }) : L(ctx.lang, { id: 'di bawah batas siaga', en: 'below the watch level' })
        const out = r.crest.level > r.level ? L(ctx.lang, { id: ` Proyeksi puncak ${nf(r.crest.level, 'id', 2)} m ±${r.crest.at}${r.awasAt ? `, lewat batas awas ±${r.awasAt}` : ''}.`, en: ` Projected crest ${nf(r.crest.level, 'en', 2)} m at ±${r.crest.at}${r.awasAt ? `, passing the warning level at ±${r.awasAt}` : ''}.` }) : ''
        return {
          text: L(ctx.lang, { id: `${r.name}: ${nf(r.level, 'id', 2)} m pukul ${g.now}, ${st} (siaga ${nf(r.siaga, 'id', 1)} m, awas ${nf(r.awas, 'id', 1)} m). ${r.rise24h >= 0 ? 'Naik' : 'Turun'} ${nf(Math.abs(r.rise24h), 'id', 2)} m dalam 24 jam.${out} Pos pantau nyata, pembacaan & proyeksi simulasi.`, en: `${r.name}: ${nf(r.level, 'en', 2)} m at ${g.now}, ${st} (watch ${nf(r.siaga, 'en', 1)} m, warning ${nf(r.awas, 'en', 1)} m). ${r.rise24h >= 0 ? 'Up' : 'Down'} ${nf(Math.abs(r.rise24h), 'en', 2)} m in 24 h.${out} Real gauge site, simulated readings & projection.` }),
          toolCalls: [{ name: 'read_gauge', input: { gauge: r.name }, output: { level: r.level }, ms: 140 }],
        }
      },
    },
    {
      id: 'dam',
      examples: ['Apakah bendungan aman?', 'Benarkan waduk akan jebol?', 'Ada kabar bendungan jebol', 'Is the dam safe?', 'Is it true the dam will burst?', 'Waduk jebol ta?', 'Krungu kabar waduk arep jebol, bener ora?', 'Leres bendungan bade bedah?', 'Batua bendungan ka jabuah?'],
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
      examples: ['Susun peringatan dini untuk warga', 'Buatkan pesan peringatan banjir', 'Tulis draf peringatan level awas untuk kecamatan bantaran', 'Draft an early warning', 'Write a flood warning message for residents', 'Gawekna pengumuman peringatan banjir', 'Jieun peringatan banjir keur warga', 'Buekan paringatan banjia untuak warga', 'Tulung gawe pesen peringatan kanggo warga'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        const names = kecSlot().filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(ctx.text))
        const lvMatch = /\b(level|lv)\s*([1-4])\b/i.exec(ctx.text)?.[2]
        const level = (lvMatch ? Number(lvMatch) : /darurat|emergency/i.test(ctx.text) ? 4 : /waspada|advisory/i.test(ctx.text) ? 1 : /siaga|watch/i.test(ctx.text) ? 2 : 3) as 1 | 2 | 3 | 4
        const d = draftAlert(g, ctx.lang, level, names.length ? names : undefined, undefined, true)
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
      examples: ['Posko pengungsian mana yang masih kosong?', 'Kapasitas posko di zona banjir', 'Ke mana warga harus mengungsi?', 'Berapa posko yang masih kosong di kecamatan itu dan siapa camatnya?', 'Which shelters still have room?', 'Where should residents evacuate?', 'Ngungsi neng endi?', 'Kudu ngungsi ka mana?', 'Mangungsi ka ma?', 'Posko sing isih kosong neng endi?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        return withOthers(ctx, g, 'shelters', answerShelters(ctx, g))
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
      examples: ['Bagaimana dampak banjir ke panen padi?', 'Berapa estimasi panen yang hilang?', 'Berapa estimasi kerugian panen di satu kecamatan?', 'Dampak ke pertanian?', 'What is the impact on the rice harvest?', 'How much harvest could be lost?', 'Panen pari piye yen kebanjiran?'],
      respond: (ctx) => {
        const g = read(ctx.world)
        if (!g) return noForecast(ctx)
        return withOthers(ctx, g, 'harvest', answerHarvest(ctx, g))
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
    {
      id: 'source',
      examples: ['Dari mana sumber datanya?', 'Apakah data ini terhubung ke AWLR BBWS secara real-time?', 'Apakah terintegrasi dengan BMKG?', 'Data muka air diambil dari mana?', 'Where does the data come from?', 'Is this connected to real-time river gauges?', 'Is it integrated with BMKG?', 'Data e soko ngendi?'],
      respond: (ctx) => ({
        text: L(ctx.lang, {
          id: 'Di demo ini: batas wilayah, sungai dan lokasi pos pantau adalah data publik nyata (region pack); pembacaan muka air, radar hujan, laporan warga dan posko adalah simulasi. Belum ada sambungan langsung ke AWLR balai wilayah sungai (BBWS/BWS) atau BMKG. Rancangan produksi: muka air ditarik dari telemetri AWLR BBWS lewat API (mis. tiap 15 menit), prakiraan cuaca & peringatan dari layanan data BMKG, laporan warga dari Sapa Warga; model genangan dihitung ulang setiap data baru masuk, dan sumber tiap angka tampil di panel "Sumber" peta.',
          en: 'In this demo: boundaries, rivers and gauge sites are real public data (region pack); water readings, rain radar, citizen reports and shelters are simulated. There is no live link to the river basin authority’s (BBWS/BWS) AWLR gauges or BMKG yet. Production design: river levels pulled from the BBWS AWLR telemetry via API (e.g. every 15 minutes), weather forecasts & warnings from BMKG data services, citizen reports from Sapa Warga; the flood model re-runs on every new reading, and each figure keeps its source in the map’s "Sources" panel.',
        }),
        followUps: [L(ctx.lang, { id: 'Siapa yang bisa melihat nomor HP warga penerima?', en: "Who can see recipients' phone numbers?" }), L(ctx.lang, { id: 'Berapa tinggi muka air sungai?', en: 'What is the river level?' })],
      }),
    },
    {
      id: 'privacy',
      examples: ['Siapa yang bisa melihat nomor HP warga penerima?', 'Bagaimana perlindungan data pribadi warga?', 'Apakah nomor telepon warga aman?', 'Siapa yang punya akses daftar penerima?', "Who can see residents' phone numbers?", 'How is personal data protected?', 'Sopo sing iso ndelok nomer HP warga?'],
      respond: (ctx) => ({
        text: L(ctx.lang, {
          id: 'Di demo ini semua nomor fiktif dan tampil tersamar; pejabat wilayah hanya disebut dengan jabatan. Rancangan produksi: akses berbasis peran: operator BPBD melihat jumlah dan wilayah penerima, bukan daftar nomor; nomor lengkap hanya dipakai oleh gerbang pengiriman (WA/SMS); setiap pengiriman dan setiap pembukaan data dicatat di log audit; mengikuti UU Pelindungan Data Pribadi (UU 27/2022).',
          en: 'In this demo every number is fictional and shown masked; local officials appear by title only. Production design: role-based access: BPBD operators see how many recipients and where, not the number list; full numbers are used only by the sending gateway (WA/SMS); every send and every data access is written to an audit log; in line with Indonesia’s Personal Data Protection Law (UU 27/2022).',
        }),
        followUps: [L(ctx.lang, { id: 'Dari mana sumber datanya?', en: 'Where does the data come from?' })],
      }),
    },
  ],
  fallback: (ctx) => ({
    text: L(ctx.lang, {
      id: 'Pertanyaan itu di luar data yang saya baca, jadi saya tidak menebak. Saya Geo-AI Siaga Wilayah: saya membaca hujan, muka air, prediksi genangan per desa, posko, laporan warga, dampak pertanian, serta sumber data dan akses data penerima. Coba salah satu pertanyaan ini.',
      en: 'That question is outside the data I read, so I will not guess. I am the Siaga Wilayah Geo-AI: I read rain, water levels, per-village flood forecasts, shelters, citizen reports, the farm impact, plus the data sources and who can access recipient data. Try one of these questions.',
    }),
    followUps: [
      L(ctx.lang, { id: 'Bagaimana situasi banjir sekarang?', en: "What's the flood situation now?" }),
      L(ctx.lang, { id: 'Desa mana yang paling cepat tergenang?', en: 'Which villages flood first?' }),
      L(ctx.lang, { id: 'Susun peringatan dini', en: 'Draft an early warning' }),
    ],
  }),
}

registerScenario(geoScenario)
