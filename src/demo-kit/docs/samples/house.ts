/**
 * samples/house.ts — "foto rumah" for the flood-aid (bansos) file: a simple original illustration with a camera
 * geotag strip. Coordinates are the real centroid of Desa Sranak (Trucuk) from the Bojonegoro region pack.
 */
import type { HouseMeta, SampleDoc } from '../types'
import { DocBuilder } from './builder'

const W = 800
const H = 600

interface HouseOpts {
  id: string
  reused?: boolean
}

function makeHouse({ id, reused }: HouseOpts): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'mono', size: 15, fill: '#ffffff' })
  b.shape({ t: 'house', x: 0, y: 0, w: W, h: H, flood: reused ? 0 : 0.42 })
  b.shape({ t: 'rect', x: 0, y: 512, w: W, h: 88, fill: '#0d0b1c', opacity: 0.72 })
  const lng = 111.8716
  const lat = -7.1342
  const taken = reused ? '2024-02-03T16:05' : '2026-11-17T07:42'
  const [d, t] = taken.split('T') as [string, string]
  const [yy, mm, dd] = d.split('-')
  b.field('koordinat', { id: 'Koordinat GPS', en: 'GPS coordinates' }, `${lat}, ${lng}`, 24, 542, {}, { shown: `${lat}, ${lng}  ±6 m` })
  b.field('waktu', { id: 'Waktu foto', en: 'Photo time' }, taken.replace('T', ' '), 24, 570, {}, { shown: `${dd}/${mm}/${yy} ${t} WIB` })
  b.field('lokasi', { id: 'Lokasi', en: 'Location' }, 'Sranak, Trucuk, Bojonegoro', W - 24, 556, { anchor: 'end' })

  /* what the "vision" model reads from the picture (hard fields) */
  b.fieldBox('atap', { id: 'Kondisi atap', en: 'Roof condition' }, 'Seng berkarat, bocor sebagian', { x: 214, y: 92, w: 372, h: 112 }, { hard: true })
  b.fieldBox('dinding', { id: 'Dinding', en: 'Walls' }, 'Bata tanpa plester', { x: 250, y: 208, w: 300, h: 150 }, { hard: true })
  if (!reused) b.fieldBox('genangan', { id: 'Tinggi genangan', en: 'Flood depth' }, '± 40 cm', { x: 120, y: 326, w: 560, h: 64 }, { hard: true })

  if (reused) {
    b.tamper.push({
      box: { x: 12, y: 552, w: 330, h: 30 },
      score: 0.72,
      field: 'waktu',
      reason: { id: 'Foto diambil Februari 2024 — bukan kejadian banjir saat ini', en: 'Photo taken February 2024 — not the current flood' },
    })
  }

  const meta: HouseMeta = { kind: 'house', lngLat: [lng, lat], kecamatanId: 'trucuk', desa: 'Sranak', takenAt: taken, floodCm: reused ? 0 : 40, reused: !!reused }
  return b.build({
    id,
    kind: 'house',
    extractKind: 'document',
    title: reused ? { id: 'Foto rumah · foto lama', en: 'House photo · old photo' } : { id: 'Foto rumah terdampak', en: 'Affected house photo' },
    caption: reused ? { id: 'Waktu foto 2024 · bukan banjir kini', en: 'Taken in 2024 · not this flood' } : { id: 'Sranak, Trucuk · geotag kamera', en: 'Sranak, Trucuk · camera geotag' },
    bg: 'photo',
    specimen: false,
    meta,
  })
}

export const HOUSES: SampleDoc[] = [makeHouse({ id: 'foto-rumah-sranak' }), makeHouse({ id: 'foto-rumah-lama', reused: true })]
