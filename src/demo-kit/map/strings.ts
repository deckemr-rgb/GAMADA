/** map/strings.ts — module-local bilingual strings (shared demo strings live in demo-kit/i18n, owner: shell). */
import type { Lang } from '../../lib/i18n'

const S = {
  mapOf: { id: 'Peta', en: 'Map of' },
  loading: { id: 'Memuat peta…', en: 'Loading map…' },
  failed: { id: 'Peta gagal dimuat. Muat ulang halaman untuk mencoba lagi.', en: 'The map failed to load. Reload the page to try again.' },
  noTiles: { id: 'Peta dasar tidak tersedia (offline atau diblokir) — batas wilayah tetap tampil.', en: 'Basemap unavailable (offline or blocked) — region boundaries still shown.' },
  noWebgl: { id: 'Peramban ini tidak mendukung WebGL — gunakan daftar kecamatan.', en: 'This browser has no WebGL — use the district list.' },
  sources: { id: 'Sumber', en: 'Sources' },
  sourcesTitle: { id: 'Sumber data peta', en: 'Map data sources' },
  basemap: { id: 'Peta dasar', en: 'Basemap' },
  close: { id: 'Tutup', en: 'Close' },
  fullscreen: { id: 'Layar penuh', en: 'Full screen' },
  exitFullscreen: { id: 'Keluar layar penuh', en: 'Exit full screen' },
  zoomIn: { id: 'Perbesar', en: 'Zoom in' },
  zoomOut: { id: 'Perkecil', en: 'Zoom out' },
  resetView: { id: 'Tampilkan seluruh wilayah', en: 'Show the whole region' },
  coopTouch: { id: 'Gunakan dua jari untuk menggeser peta', en: 'Use two fingers to move the map' },
  coopWheel: { id: 'Tahan Ctrl sambil menggulir untuk memperbesar peta', en: 'Hold Ctrl while scrolling to zoom the map' },
  coopWheelMac: { id: 'Tahan ⌘ sambil menggulir untuk memperbesar peta', en: 'Hold ⌘ while scrolling to zoom the map' },
  hidden: { id: 'Data agregat disembunyikan untuk menjaga anonimitas', en: 'Aggregate hidden to protect anonymity' },
  hiddenShort: { id: 'Disembunyikan (ambang anonimitas)', en: 'Hidden (anonymity threshold)' },
  noData: { id: 'Tidak ada data', en: 'No data' },
  kecamatan: { id: 'Kecamatan', en: 'District' },
  desa: { id: 'Desa', en: 'Village' },
  flooded: { id: 'tergenang', en: 'flooded' },
  derivedFlood: { id: 'Prediksi genangan (simulasi), bukan peta resmi BNPB', en: 'Predicted inundation (simulated), not an official BNPB map' },
  layers: { id: 'Lapisan peta', en: 'Map layers' },
  legend: { id: 'Legenda', en: 'Legend' },
  time: { id: 'Waktu prediksi', en: 'Forecast time' },
  play: { id: 'Putar', en: 'Play' },
  pause: { id: 'Jeda', en: 'Pause' },
  now: { id: 'Sekarang', en: 'Now' },
  hoursAhead: { id: 'jam ke depan', en: 'hours ahead' },
  listLabel: { id: 'Daftar kecamatan', en: 'District list' },
  listHint: { id: 'Pilih kecamatan untuk menerbangkan peta ke sana.', en: 'Pick a district to fly the map there.' },
  filter: { id: 'Cari kecamatan', en: 'Find a district' },
  noMatch: { id: 'Tidak ada kecamatan yang cocok.', en: 'No matching district.' },
  selected: { id: 'dipilih', en: 'selected' },
  flyingTo: { id: 'Peta menuju', en: 'Map moving to' },
} as const

/** Plain-text basemap attribution (the HTML version with links is in basemap.ts). */
export const BASEMAP_ATTRIBUTION_TEXT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap'

export type MapStringKey = keyof typeof S

export function ms(key: MapStringKey, lang: Lang): string {
  return S[key][lang]
}

/** Number formatting per UI language (id: "1.234,5", en: "1,234.5"). */
const NF = new Map<string, Intl.NumberFormat>()
export function fmt(n: number, lang: Lang, digits = 0): string {
  // Intl.NumberFormat construction is slow — cache one per (lang, digits); fmt runs per frame in TimeScrubber
  const k = `${lang}|${digits}`
  let f = NF.get(k)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    NF.set(k, f)
  }
  return f.format(n)
}
