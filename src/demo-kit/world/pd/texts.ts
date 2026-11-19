/**
 * world/pd/texts.ts — Pasar Daerah template pools (ID + EN). Every sentence carries an entity field ({kec}, {qty},
 * {item}, {market}, {pct}, {days} …); pools rotate least-recently-used, so no sentence repeats within a day.
 */
import type { Bi } from '../types'

export const fill = (t: Bi, v: Record<string, string | number>): Bi => ({
  id: t.id.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? '')),
  en: t.en.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? '')),
})

/** the natural (non-emergency) needs of the Katalog Lokal clock: category, unit, qty range, title */
export const NATURAL_NEEDS: { key: string; cat: string; unit: string; q: [number, number]; t: Bi; item: Bi }[] = [
  { key: 'nasi-kotak', cat: 'nasi-kotak', unit: 'kotak', q: [80, 240], t: { id: 'Nasi kotak rapat koordinasi Kec. {kec} ({qty} kotak)', en: 'Boxed meals for the {kec} coordination meeting ({qty} boxes)' }, item: { id: 'Nasi kotak', en: 'Boxed meals' } },
  { key: 'air-minum', cat: 'air-minum', unit: 'dus', q: [40, 160], t: { id: 'Air minum kemasan untuk posko Kec. {kec} ({qty} dus)', en: 'Bottled water for the {kec} post ({qty} cartons)' }, item: { id: 'Air minum kemasan', en: 'Bottled water' } },
  { key: 'seragam', cat: 'seragam', unit: 'stel', q: [30, 90], t: { id: 'Seragam relawan Kec. {kec} ({qty} stel)', en: 'Volunteer uniforms for {kec} ({qty} sets)' }, item: { id: 'Seragam relawan', en: 'Volunteer uniforms' } },
  { key: 'spanduk', cat: 'spanduk', unit: 'lembar', q: [8, 30], t: { id: 'Spanduk layanan publik Kec. {kec} ({qty} lembar)', en: 'Public service banners for {kec} ({qty} pieces)' }, item: { id: 'Spanduk layanan', en: 'Service banners' } },
  { key: 'atk', cat: 'atk', unit: 'paket', q: [10, 40], t: { id: 'ATK posko pelayanan Kec. {kec} ({qty} paket)', en: 'Office supplies for the {kec} service post ({qty} packs)' }, item: { id: 'ATK posko', en: 'Office supplies' } },
  { key: 'kursi', cat: 'mebel', unit: 'unit', q: [40, 120], t: { id: 'Kursi lipat balai Kec. {kec} ({qty} unit)', en: 'Folding chairs for the {kec} hall ({qty} units)' }, item: { id: 'Kursi lipat', en: 'Folding chairs' } },
]

/** words of the derived (fictional) distributor names; legal form in front, never a Tahap 3 name */
export const DIST_WORDS = ['Agro', 'Lumbung', 'Pangan', 'Tirta', 'Sinar', 'Mandala', 'Prima', 'Raya', 'Nusa', 'Gemilang', 'Cipta', 'Wijaya', 'Samudra', 'Panca', 'Karya']
export const DIST_TAIL = ['Distribusi', 'Logistik', 'Niaga', 'Pangan', 'Perkasa', 'Mulia']
