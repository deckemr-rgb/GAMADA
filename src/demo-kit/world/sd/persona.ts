/**
 * world/sd/persona.ts — the Sapa Warga persona texts the kit needs (copied from demos/sapa-warga/model.ts, which will
 * read them from here in integration): Ibu Siti Aminah's flood voice note and the neighbours' flood reports, as
 * `complaint.created` payloads. Fictional characters (s.meta.personas); places are real.
 */
import type { Bi, Citizen, EventMap, LngLat, WorldState } from '../types'
import type { RegionPack } from '../../region/types'
import { DAY_MIN, offsetKm, rows } from '../util'

/** Siti's voice note: the pack's flood template about an embankment (else its first flood template) */
export function sitiVoiceSample(pack: RegionPack | null): { id: string; text: string; lang: string; translation: Bi } | null {
  const speech = pack?.languages.speechCodes[0] ?? 'id-ID'
  const flood = (pack?.languages.samples.complaintTemplates ?? []).filter((t) => t.category === 'banjir')
  const t = flood.find((x) => /tanggul|bocor/i.test(x.id + x.text)) ?? flood[0]
  return t ? { id: `vn-${t.id}`, text: t.text, lang: speech, translation: t.translation } : null
}

/** where a persona's report is pinned: near home, pulled towards the desa centre (keeps reports within the 1 km cluster rule) */
export function personaReportCoord(s: WorldState, c: Citizen, variant: number): LngLat {
  const centre = s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.centroid ?? c.coord
  const mid: LngLat = [(c.coord[0] + centre[0]) / 2, (c.coord[1] + centre[1]) / 2]
  return variant === 0 ? offsetKm(c.coord, 0.04, 0.03) : offsetKm(mid, 0.06 * variant, 0.1)
}

/** Siti Aminah's flood voice complaint (null when the world has no persona) */
export function sitiComplaintPayload(s: WorldState, pack: RegionPack | null): EventMap['complaint.created'] | null {
  const c = s.citizens.byId[s.meta.personas.siti]
  if (!c) return null
  const v = sitiVoiceSample(pack)
  const text = v?.text ?? 'Air sungai sudah masuk rumah, tanggul di dekat rumah bocor.'
  return {
    citizenId: c.id, category: 'banjir', channel: 'voice', text, lang: v ? c.lang : 'id', summary: v?.translation ?? { id: text, en: 'River water has entered homes; the embankment nearby is leaking.' },
    kecamatanId: c.kecamatanId, desaId: c.desaId, coord: personaReportCoord(s, c, 0), urgency: 'tinggi', photo: false,
  }
}

const desaName = (s: WorldState, kec: string, desa: string) => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
/** a neighbour's flood report (fictional citizen of the same desa, not a persona), `n` = how many flood reports exist */
export function neighbourComplaintPayload(s: WorldState, center: LngLat, kecamatanId: string, desaId: string, n: number, now: number): EventMap['complaint.created'] | null {
  const personas = new Set(Object.values(s.meta.personas))
  const pool = rows(s.citizens).filter((c) => !personas.has(c.id) && c.kecamatanId === kecamatanId)
  const sameDesa = pool.filter((c) => c.desaId === desaId)
  const list = sameDesa.length ? sameDesa : pool
  if (!list.length) return null
  const c = list[n % list.length]!
  const desa = desaName(s, kecamatanId, desaId)
  const texts: Bi[] = [
    { id: `Air mulai masuk rumah di ${desa}, sudah sebetis dan terus naik.`, en: `Water is entering homes in ${desa}, calf-deep and still rising.` },
    { id: `Jalan utama ${desa} tergenang, anak sekolah tidak bisa lewat.`, en: `The main road of ${desa} is flooded, school children cannot get through.` },
    { id: `Sawah dan pekarangan di ${desa} tergenang sejak subuh.`, en: `Rice fields and yards in ${desa} have been flooded since dawn.` },
    { id: `Gang di belakang pasar ${desa} sudah tidak bisa dilewati motor, air setinggi lutut.`, en: `The alley behind the ${desa} market is knee-deep, motorbikes cannot pass.` },
    { id: `Saluran depan balai desa ${desa} meluap, air cokelat masuk ke teras warga.`, en: `The drain in front of the ${desa} village hall has overflowed; brown water is reaching porches.` },
    { id: `Kandang ternak di ujung ${desa} kemasukan air, kami pindahkan kambing ke tanggul.`, en: `Water got into the livestock pens at the edge of ${desa}; we are moving the goats up to the embankment.` },
    { id: `Musala di RT 02 ${desa} tergenang sekitar 30 cm, karpet sudah kami angkat.`, en: `The prayer house in RT 02, ${desa} has about 30 cm of water; we have lifted the carpets.` },
    { id: `Air dari sungai merembes lewat tanggul kecil di ${desa}, mohon dicek sebelum makin besar.`, en: `River water is seeping through the small embankment in ${desa}; please check it before it gets worse.` },
  ]
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const used = new Set(rows(s.complaints).filter((x) => x.category === 'banjir' && x.desaId === desaId && x.at >= day).map((x) => x.text))
  const k = texts.findIndex((_, i) => !used.has(texts[(n + i) % texts.length]!.id))
  const t = texts[(n + Math.max(0, k)) % texts.length]!
  return {
    citizenId: c.id, category: 'banjir', channel: n % 2 ? 'web' : 'wa', text: t.id, lang: 'id', summary: t,
    kecamatanId, desaId, coord: offsetKm(center, ((n % 5) - 2) * 0.07, ((n % 3) - 1) * 0.08), urgency: 'tinggi', photo: n % 2 === 0,
  }
}
