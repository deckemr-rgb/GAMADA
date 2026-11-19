/**
 * Simulated statistics, base prices and terrain for the Kota Padang region pack (owner decision 2026-11-17: the
 * demos are simulations that show what the AI can do; numbers only have to be relevant, not real).
 *
 * "Angka simulasi berskala realistis": populations rounded to 100 (kecamatan) / 1,000 (total), households to
 * 1,000, area to whole km², max altitude to 5 m, sector shares to whole percent (the build adds "Lainnya" so the
 * bar sums to 100), staple prices chosen by GAMADA and rounded to Rp 50/100. NOT official statistics and NOT
 * market prices. Scale only: skala mengacu ke publikasi BPS Kota Padang (dikutip, dibulatkan).
 *
 * Real geography and names (HDX COD-AB boundaries, OSM features, Kemendagri codes) come from the cache built by
 * fetch-padang.mjs. Kecamatan spelling follows HDX.
 */
export const SIM = {
  /** reference year the simulated figures stand for (UI label "Penduduk 2025") */
  year: 2025,
  attribution: 'skala mengacu ke publikasi BPS Kota Padang (dikutip, dibulatkan)',
  label: 'Angka simulasi untuk demo, dibulatkan dari skala data publik; bukan statistik resmi',
}

/** [name, population (simulated, rounded to 100), approx. max altitude m a.s.l. (simulated, rounded to 5 m;
 *  drives the derived landslide index)] */
export const KECAMATAN = [
  ['Bungus Teluk Kabung', 26600, 850],
  ['Koto Tangah', 199800, 900],
  ['Kuranji', 145300, 650],
  ['Lubuk Begalung', 121900, 350],
  ['Lubuk Kilangan', 56500, 1050],
  ['Nanggalo', 58200, 20],
  ['Padang Barat', 43700, 10],
  ['Padang Selatan', 61000, 300],
  ['Padang Timur', 78100, 15],
  ['Padang Utara', 56800, 10],
  ['Pauh', 69700, 1150],
]

/** city totals (simulated): population to 1,000, households = family-card holders to 1,000, land area to km² */
export const TOTALS = { population: 918000, households: 246000, area_km2: 695 }

/**
 * Simulated terrain for the derived flood zone (NOT a DEM): Padang is a narrow coastal plain under the Bukit
 * Barisan. Altitude of a point = `base` m plus a rise that starts `plainKm` km inland from a straight reference
 * shoreline (two points, north → south) and grows with the power `exp`, capped at the kecamatan's max altitude.
 * The build uses it only for the "low-lying" factor of the flood score and labels the result as simulated.
 */
export const TERRAIN = {
  shoreline: [[100.285, -0.765], [100.365, -0.985]],
  base: 3,
  plainKm: 4.5,
  riseMPerKm: 40,
  exp: 1.5,
}

/** economic structure (simulated, whole percent). The build adds "Lainnya" = 100 − Σ. */
export const SECTORS = [
  ['Perdagangan Besar dan Eceran', 'Wholesale and retail trade', 20],
  ['Transportasi dan Pergudangan', 'Transport and warehousing', 13],
  ['Industri Pengolahan', 'Manufacturing', 11],
  ['Konstruksi', 'Construction', 10],
  ['Administrasi Pemerintahan', 'Public administration', 7],
  ['Penyediaan Akomodasi dan Makan Minum', 'Accommodation and food services', 6],
  ['Pertanian, Kehutanan, dan Perikanan', 'Agriculture, forestry and fishing', 6],
  ['Informasi dan Komunikasi', 'Information and communication', 6],
  ['Jasa Pendidikan', 'Education services', 5],
]

/** staple base prices (simulated): plausible consumer prices for a Sumatran provincial capital in 2026, chosen
 *  by GAMADA, rounded to Rp 50/100. The world simulation adds market offsets and daily noise on top. */
export const PRICES = [
  ['beras-medium', 'Beras medium', 'Medium rice', 'kg', 14500],
  ['cabai-merah', 'Cabai merah keriting', 'Curly red chilli', 'kg', 46000],
  ['cabai-rawit', 'Cabai rawit merah', "Red bird's-eye chilli", 'kg', 50000],
  ['bawang-merah', 'Bawang merah', 'Shallot', 'kg', 38000],
  ['ikan-tongkol', 'Ikan tongkol segar', 'Fresh mackerel tuna', 'kg', 34000],
  ['telur-ayam', 'Telur ayam ras', 'Chicken eggs', 'kg', 29000],
  ['daging-ayam', 'Daging ayam ras', 'Broiler chicken meat', 'kg', 37500],
  ['minyak-goreng', 'Minyak goreng kemasan', 'Packaged cooking oil', 'liter', 20500],
  ['gula-pasir', 'Gula pasir', 'Granulated sugar', 'kg', 18500],
  ['kelapa', 'Kelapa tua', 'Mature coconut', 'butir', 9000],
]
