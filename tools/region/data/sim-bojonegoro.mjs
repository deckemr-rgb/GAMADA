/**
 * Simulated statistics and base prices for the Bojonegoro region pack (owner decision 2026-11-17: everything in
 * the demos is a simulation that shows what the AI can do; numbers do not have to be real, only relevant).
 *
 * These are "angka simulasi berskala realistis": populations rounded to 100 (kecamatan) / 1,000 (total),
 * households to 1,000, area to whole km², max altitude to 5 m, sector shares to whole percent (summing to 100),
 * staple prices chosen by GAMADA and rounded to Rp 50/100. They are NOT official statistics and NOT market
 * prices. Scale only: skala mengacu ke publikasi BPS Kab. Bojonegoro (dikutip, dibulatkan).
 *
 * Real geography and names (HDX COD-AB boundaries, OSM features, Kemendagri codes) are untouched and come from
 * the cache built by fetch-bojonegoro.mjs. Kecamatan spelling follows build-bojonegoro.mjs (KEC_ALIAS).
 */
export const SIM = {
  /** reference year the simulated figures stand for (UI label "Penduduk 2025") */
  year: 2025,
  /** one generic attribution line for the scale of the figures */
  attribution: 'skala mengacu ke publikasi BPS Kab. Bojonegoro (dikutip, dibulatkan)',
  label: 'Angka simulasi untuk demo, dibulatkan dari skala data publik; bukan statistik resmi',
}

/** [name, population (simulated, rounded to 100), approx. max altitude m a.s.l. (rounded to 5 m; drives the
 *  derived flood / landslide factors)] */
export const KECAMATAN = [
  ['Margomulyo', 23400, 175],
  ['Ngraho', 48400, 125],
  ['Tambakrejo', 57000, 240],
  ['Ngambon', 12000, 200],
  ['Sekar', 29000, 740],
  ['Bubulan', 15700, 275],
  ['Gondang', 26800, 900],
  ['Temayang', 38000, 390],
  ['Sugihwaras', 48000, 390],
  ['Kedungadem', 85400, 290],
  ['Kepohbaru', 68300, 40],
  ['Baureno', 85500, 50],
  ['Kanor', 62700, 15],
  ['Sumberrejo', 73800, 40],
  ['Balen', 68900, 25],
  ['Sukosewu', 44700, 40],
  ['Kapas', 58100, 25],
  ['Bojonegoro', 88400, 15],
  ['Trucuk', 40500, 40],
  ['Dander', 88000, 115],
  ['Ngasem', 63100, 115],
  ['Gayam', 34500, 50],
  ['Kalitidu', 52400, 40],
  ['Malo', 32700, 250],
  ['Purwosari', 31100, 75],
  ['Padangan', 45400, 50],
  ['Kasiman', 32500, 75],
  ['Kedewan', 13900, 315],
]

/** kabupaten totals (simulated): population to 1,000 (Σ kecamatan differs by a few hundred, as with any rounding),
 *  households = family-card holders to 1,000, land area to whole km² */
export const TOTALS = { population: 1368000, households: 473000, area_km2: 2307 }

/** economic structure (simulated, whole percent). The build adds "Lainnya" = 100 − Σ, so the bar sums to 100. */
export const SECTORS = [
  ['Pertambangan dan Penggalian', 'Mining and quarrying', 45],
  ['Pertanian, Kehutanan, dan Perikanan', 'Agriculture, forestry and fishing', 13],
  ['Perdagangan Besar dan Eceran', 'Wholesale and retail trade', 9],
  ['Industri Pengolahan', 'Manufacturing', 8],
  ['Konstruksi', 'Construction', 7],
  ['Informasi dan Komunikasi', 'Information and communication', 6],
  ['Administrasi Pemerintahan', 'Public administration', 4],
]

/** staple base prices (simulated): plausible consumer prices for a Javanese regency in 2026, chosen by GAMADA,
 *  rounded to Rp 50/100. The world simulation adds market offsets and daily noise on top. */
export const PRICES = [
  ['beras-medium', 'Beras medium', 'Medium rice', 'kg', 13500],
  ['cabai-rawit', 'Cabai rawit merah', "Red bird's-eye chilli", 'kg', 52000],
  ['cabai-merah', 'Cabai merah keriting', 'Curly red chilli', 'kg', 44000],
  ['bawang-merah', 'Bawang merah', 'Shallot', 'kg', 36500],
  ['bawang-putih', 'Bawang putih bonggol', 'Garlic', 'kg', 37000],
  ['minyak-goreng', 'Minyak goreng kemasan', 'Packaged cooking oil', 'liter', 20500],
  ['gula-pasir', 'Gula pasir', 'Granulated sugar', 'kg', 18000],
  ['telur-ayam', 'Telur ayam ras', 'Chicken eggs', 'kg', 28500],
  ['daging-ayam', 'Daging ayam ras', 'Broiler chicken meat', 'kg', 36500],
]
