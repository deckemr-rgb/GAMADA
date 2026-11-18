/**
 * world/sd/base.ts — shared helpers of the Satu Daerah selectors (names, number formats, the scenario flood alert, topic labels).
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Bi, Complaint, ComplaintCluster, EventMap, Minutes, Procurement, WorldState } from '../types'
import { hhmm } from '../util'

export const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const desaName = (s: WorldState, kec: string, desa: string) => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
export const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
export const idNum = (n: number, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d })
export const enNum = (n: number, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })
export const rpShort = (n: number): Bi => {
  const a = Math.abs(n)
  if (a >= 1e9) return { id: `Rp ${idNum(n / 1e9, 1)} M`, en: `Rp ${enNum(n / 1e9, 1)} bn` }
  if (a >= 1e6) return { id: `Rp ${idNum(n / 1e6, 1)} jt`, en: `Rp ${enNum(n / 1e6, 1)} m` }
  return { id: `Rp ${idNum(n)}`, en: `Rp ${enNum(n)}` }
}
/** deterministic 0..1 from a string (stable per entity id) */
export function unit(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export const n1 = (v: number, l: 'id' | 'en') => (l === 'id' ? idNum(v, 1) : enNum(v, 1))
/** "07.20" in Indonesian, "07:20" in English */
export const hm = (m: Minutes, l: 'id' | 'en') => (l === 'id' ? hhmm(m).replace(':', '.') : hhmm(m))

export const devPct = (p: Procurement) => {
  const hps = p.items.reduce((a, i) => a + i.hpsPrice * i.qty, 0)
  const mkt = p.items.reduce((a, i) => a + i.marketPrice * i.qty, 0)
  return mkt ? ((hps - mkt) / mkt) * 100 : 0
}

/**
 * The scenario flood alert payload (emit with source 'siaga-wilayah'): the pack's flood kecamatan, level 3, the
 * scenario river. Using the same alert keeps every downstream count consistent (Cek Berkas outside-zone = facts).
 */
export function floodScenarioAlert(s: WorldState, now: Minutes, opts: { level?: 1 | 2 | 3 | 4; kecamatanIds?: string[]; desaIds?: string[] } = {}): EventMap['flood.alert'] {
  return { level: opts.level ?? 3, kecamatanIds: opts.kecamatanIds ?? s.region.floodKecamatanIds, desaIds: opts.desaIds ?? [], riverId: s.region.floodRiverId || null, expectedAt: now + 180 }
}

/** Radar Isu topic ids in both languages (briefing, KPI captions, AI answers) */
export const TOPIC_LABEL: Record<string, Bi> = {
  banjir: { id: 'banjir', en: 'flooding' }, bansos: { id: 'bansos', en: 'social aid' }, harga: { id: 'harga', en: 'prices' },
  'hoaks-bendungan': { id: 'hoaks bendungan', en: 'dam hoax' }, jalan: { id: 'jalan', en: 'roads' }, kesehatan: { id: 'kesehatan', en: 'health' },
  kualitas: { id: 'kualitas', en: 'quality' }, layanan: { id: 'layanan', en: 'public services' }, pendidikan: { id: 'pendidikan', en: 'education' },
  pengiriman: { id: 'pengiriman', en: 'delivery' }, sampah: { id: 'sampah', en: 'waste' }, stok: { id: 'stok', en: 'stock' }, umkm: { id: 'UMKM', en: 'small businesses' },
}
export const topicLabel = (topic: string, lang: 'id' | 'en'): string => TOPIC_LABEL[topic]?.[lang] ?? topic

/** cluster + its complaints (Sapa Warga "Klaster aduan", Siaga Wilayah points) */
export function clusterDetail(s: WorldState, clusterId: string): { cluster: ComplaintCluster | undefined; complaints: Complaint[] } {
  const cluster = s.clusters.byId[clusterId]
  return { cluster, complaints: (cluster?.complaintIds ?? []).map((id) => s.complaints.byId[id]).filter((c): c is Complaint => !!c) }
}
