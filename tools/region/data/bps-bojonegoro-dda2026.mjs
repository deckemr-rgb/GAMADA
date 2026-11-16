/**
 * Figures transcribed by hand from BPS Kabupaten Bojonegoro, "Kabupaten Bojonegoro Dalam Angka 2026"
 * (Katalog 1102001.3522, released 27 Feb 2026). The PDF's glyphs are outlined (no extractable text), so
 * the pages were rendered and read; fetch-bojonegoro.mjs keeps the PDF in .cache for audit and
 * build-bojonegoro.mjs cross-checks area + population against the Wikipedia table that cites the same
 * publication (the build fails on any mismatch).
 *
 * Kecamatan order and spelling follow the BPS tables.
 */
export const DDA = {
  title: 'Kabupaten Bojonegoro Dalam Angka 2026',
  publisher: 'BPS Kabupaten Bojonegoro',
  url: 'https://bojonegorokab.bps.go.id/id/publication/2026/02/27/2c966ce987c74364e80b2bad/kabupaten-bojonegoro-dalam-angka-2026.html',
  year: 2026,
  dataYear: 2025,
}

/** [name, area km² (Tabel 1.1.1), altitude m a.s.l. min, max (Tabel 1.1.2), population thousand 2025 (Tabel 3.1.1),
 *  family-registry (KK) owners 2025 (Tabel 3.1.2, source Disdukcapil)] */
export const KECAMATAN = [
  ['Margomulyo', 139.68, 25, 175, 23.41, 8470],
  ['Ngraho', 71.48, 25, 125, 48.42, 17207],
  ['Tambakrejo', 209.52, 37.5, 237.5, 57.0, 20355],
  ['Ngambon', 48.65, 50, 200, 12.02, 4276],
  ['Sekar', 130.24, 112.5, 737.5, 28.96, 10901],
  ['Bubulan', 84.73, 62.5, 275, 15.66, 5726],
  ['Gondang', 107.01, 112.5, 900, 26.78, 9900],
  ['Temayang', 124.67, 37.5, 387.5, 38.0, 13897],
  ['Sugihwaras', 87.15, 37.5, 387.5, 47.96, 16261],
  ['Kedungadem', 145.15, 25, 287.5, 85.44, 29742],
  ['Kepohbaru', 79.64, 12.5, 37.5, 68.27, 22168],
  ['Baureno', 66.37, 6.25, 50, 85.45, 26939],
  ['Kanor', 59.78, 6.25, 12.5, 62.71, 21302],
  ['Sumberrejo', 76.58, 12.5, 37.5, 73.82, 26210],
  ['Balen', 60.52, 12.5, 25, 68.94, 23925],
  ['Sukosewu', 47.48, 12.5, 37.5, 44.73, 15877],
  ['Kapas', 46.38, 12.5, 25, 58.08, 19724],
  ['Bojonegoro', 25.71, 12.5, 15, 88.35, 29553],
  ['Trucuk', 36.71, 12.5, 37.5, 40.51, 14150],
  ['Dander', 118.36, 12.5, 112.5, 88.03, 29868],
  ['Ngasem', 147.21, 25, 112.5, 63.13, 22981],
  ['Gayam', 50.05, 25, 50, 34.47, 11703],
  ['Kalitidu', 65.95, 12.5, 37.5, 52.38, 18036],
  ['Malo', 65.41, 18.75, 250, 32.68, 11159],
  ['Purwosari', 62.32, 25, 75, 31.11, 10539],
  ['Padangan', 42.0, 25, 50, 45.36, 15560],
  ['Kasiman', 51.8, 25, 75, 32.46, 11266],
  ['Kedewan', 56.51, 50, 312.5, 13.89, 4806],
]

export const TOTALS = { area_km2: 2307.06, population_thousand: 1367.98, kk: 472501 }

/** Tabel 12.3 — distribution of GRDP at current prices by industry, 2025 (angka sangat sementara), percent.
 *  Sectors below 3 % are summed into "Lainnya" by the build. */
export const PDRB_2025 = [
  ['A', 'Pertanian, Kehutanan, dan Perikanan', 'Agriculture, forestry and fishing', 12.87],
  ['B', 'Pertambangan dan Penggalian', 'Mining and quarrying', 44.77],
  ['C', 'Industri Pengolahan', 'Manufacturing', 7.43],
  ['D', 'Pengadaan Listrik dan Gas', 'Electricity and gas', 0.03],
  ['E', 'Pengadaan Air, Pengelolaan Sampah', 'Water supply and waste management', 0.03],
  ['F', 'Konstruksi', 'Construction', 7.43],
  ['G', 'Perdagangan Besar dan Eceran', 'Wholesale and retail trade', 9.28],
  ['H', 'Transportasi dan Pergudangan', 'Transportation and storage', 1.73],
  ['I', 'Penyediaan Akomodasi dan Makan Minum', 'Accommodation and food services', 1.19],
  ['J', 'Informasi dan Komunikasi', 'Information and communication', 6.4],
  ['K', 'Jasa Keuangan dan Asuransi', 'Financial and insurance', 1.42],
  ['L', 'Real Estat', 'Real estate', 1.19],
  ['MN', 'Jasa Perusahaan', 'Business services', 0.16],
  ['O', 'Administrasi Pemerintahan', 'Public administration', 3.69],
  ['P', 'Jasa Pendidikan', 'Education', 1.04],
  ['Q', 'Jasa Kesehatan dan Kegiatan Sosial', 'Health and social work', 0.46],
  ['RSTU', 'Jasa Lainnya', 'Other services', 0.89],
]
