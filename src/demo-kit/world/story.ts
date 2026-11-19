/**
 * world/story.ts — the day story of the spine (GAMADA Inti "Putar jejak aduan Ibu Siti", Tahap 5 tour), loaded on
 * click (`import()`): flood → Ibu Siti's voice complaint → 4 neighbours (C1 cluster + flood.confirmed) → Meja
 * Pimpinan's instruction (C7 letter) → Awas Belanja's recommendation with local UMKM (C11 need ⇒ C36 matches).
 * `playDayStory()` emits only the MISSING steps (idempotent by key: twice ⇒ no duplicates), source 'clock' with the
 * step's product as origin, at the current clock. It changes the shared world (every product in this browser sees it);
 * the shell's Reset undoes it.
 */
import type { ProductSlug } from '../../content/products'
import type { Bi, Complaint, WorldState } from './types'
import { clock } from './clock'
import { emit, settled, world } from './store'
import { activeFloodAlert, ensureFloodScenario } from './flood-scenario'
import { neighbourComplaintPayload, sitiComplaintPayload } from './sd/persona'
import { DAY_MIN, WORLD, distanceKm, ref, rows } from './util'

export type StoryKey = 'flood' | 'siti' | 'neighbours' | 'instruction' | 'recommend'
export const DAY_STORY: readonly { key: StoryKey; product: ProductSlug; label: Bi }[] = [
  { key: 'flood', product: 'siaga-wilayah', label: { id: 'Peringatan banjir', en: 'Flood warning' } },
  { key: 'siti', product: 'sapa-warga', label: { id: 'Aduan suara Ibu Siti', en: 'Ibu Siti’s voice complaint' } },
  { key: 'neighbours', product: 'sapa-warga', label: { id: 'Laporan tetangga · klaster', en: 'Neighbour reports · cluster' } },
  { key: 'instruction', product: 'meja-pimpinan', label: { id: 'Instruksi Kepala Daerah', en: 'Regional Head’s instruction' } },
  { key: 'recommend', product: 'awas-belanja', label: { id: 'Rekomendasi pengadaan + UMKM lokal', en: 'Procurement advice + local SMEs' } },
]

const day0 = (now: number) => Math.floor(now / DAY_MIN) * DAY_MIN
/** Ibu Siti's flood complaint of today (null before the story) */
export const sitiComplaint = (s: WorldState, now = clock.get().minutes): Complaint | null =>
  rows(s.complaints).find((c) => c.citizenId === s.meta.personas.siti && c.category === 'banjir' && c.at >= day0(now)) ?? null
const pump = (s: WorldState) => rows(s.procurements).find((p) => p.key === 'pompa-darurat' && p.status !== 'selesai') ?? null

/** which steps already happened in this world */
export function storyDone(s: WorldState, now = clock.get().minutes): Record<StoryKey, boolean> {
  const siti = sitiComplaint(s, now)
  const cl = siti?.clusterId ?? null
  return {
    flood: !!activeFloodAlert(s),
    siti: !!siti,
    neighbours: !!cl,
    instruction: !!cl && rows(s.instructions).some((i) => i.refs.includes(ref('clusters', cl))),
    recommend: !!pump(s)?.recommendation,
  }
}

function runStep(key: StoryKey, s: WorldState, now: number, src: 'clock' | 'tour' = 'clock'): boolean {
  const origin = DAY_STORY.find((x) => x.key === key)!.product
  if (key === 'flood') return !!ensureFloodScenario(s, now)
  if (key === 'siti') {
    const p = sitiComplaintPayload(s, world.pack())
    if (p) emit('complaint.created', p, src, { at: now, origin })
    return !!p
  }
  const siti = sitiComplaint(s, now)
  if (key === 'neighbours') {
    if (!siti) return false
    const near = rows(s.complaints).filter((c) => c.category === 'banjir' && !c.clusterId && c.at >= day0(now) && distanceKm(c.coord, siti.coord) <= WORLD.clusterRadiusKm).length
    const n0 = rows(s.complaints).filter((c) => c.category === 'banjir' && c.kecamatanId === siti.kecamatanId).length
    let ok = false
    for (let i = 0; i < Math.max(0, WORLD.clusterMin - near); i++) {
      const p = neighbourComplaintPayload(s, siti.coord, siti.kecamatanId, siti.desaId, n0 + i, now)
      if (p) {
        emit('complaint.created', p, src, { at: now, origin })
        ok = true
      }
    }
    return ok
  }
  if (key === 'instruction') {
    const cl = siti?.clusterId ? s.clusters.byId[siti.clusterId] : undefined
    const alert = activeFloodAlert(s)
    if (!cl) return false
    const kec = s.region.kecamatan.find((k) => k.id === cl.kecamatanId)?.name ?? cl.kecamatanId
    const opd = (re: RegExp, fb: string) => s.region.opd.find((o) => re.test(`${o.id} ${o.short} ${o.name}`))?.id ?? fb
    emit('instruction.issued', {
      text: { id: `Tangani banjir Kec. ${kec}: evakuasi warga, pasang pompa darurat, salurkan bantuan hari ini`, en: `Handle the ${kec} flood: evacuate residents, deploy emergency pumps, deliver aid today` },
      opdIds: [opd(/bpbd/i, s.region.categoryOpd.banjir), opd(/dinsos|sosial/i, 'dinsos')], dueAt: now + 6 * 60, refs: [ref('clusters', cl.id), ...(alert ? [ref('alerts', alert.id)] : [])],
    }, src, { at: now, origin })
    return true
  }
  const p = pump(s)
  if (!p) return false
  emit('procurement.recommended', {
    procurementId: p.id, hpsCorrected: Math.round((p.hps * 0.88) / 1000) * 1000, inviteLocal: true,
    note: { id: 'Koreksi HPS ke harga pasar dan undang UMKM lokal lewat Katalog Lokal (simulasi)', en: 'Correct the HPS to market prices and invite local SMEs through Katalog Lokal (simulated)' },
  }, src, { at: now, origin })
  return true
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/**
 * Play the missing steps in order (`gapMs` apart; each waits until its events and reactions settled).
 * `onStep(key, 'done' | 'skip' | 'fail')` per step. Resolves with the keys that ran.
 * `until` (Tahap 5 tour): stop after this key (`playDayStory({ until: 'siti' })` = flood + siti). `source` (K5): the
 * events' source, 'clock' (default) or 'tour'; the origin stays the step's product either way.
 */
export async function playDayStory(
  opts: { gapMs?: number; onStep?: (key: StoryKey, r: 'done' | 'skip' | 'fail') => void; source?: 'clock' | 'tour'; until?: StoryKey } = {},
): Promise<StoryKey[]> {
  const ran: StoryKey[] = []
  for (const step of DAY_STORY) {
    if (world.status() !== 'ready') break
    const now = clock.get().minutes
    if (storyDone(world.get(), now)[step.key]) {
      opts.onStep?.(step.key, 'skip')
      if (step.key === opts.until) break
      continue
    }
    const ok = runStep(step.key, world.get(), now, opts.source ?? 'clock')
    // wait until it landed (a chunk may be downloading: the store queues the events meanwhile)
    for (let i = 0; i < 60 && ok && !storyDone(world.get(), now)[step.key]; i++) {
      await settled()
      if (!storyDone(world.get(), now)[step.key]) await sleep(25)
    }
    const done = storyDone(world.get(), now)[step.key]
    opts.onStep?.(step.key, done ? 'done' : 'fail')
    if (done) ran.push(step.key)
    if (step.key === opts.until) break
    if (opts.gapMs ?? 600) await sleep(opts.gapMs ?? 600)
  }
  return ran
}
