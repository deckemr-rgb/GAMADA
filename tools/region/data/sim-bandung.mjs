/**
 * Simulated statistics and base prices for the Kota Bandung region pack (owner decision 2026-11-17: everything in
 * the demos is a simulation that shows what the AI can do; numbers do not have to be real, only relevant).
 *
 * These are "angka simulasi berskala realistis": populations rounded to 100 (kecamatan) / 1,000 (total),
 * households to 1,000, area to whole km², max altitude to 5 m, sector shares to whole percent, staple prices chosen
 * by GAMADA and rounded to Rp 50/100. They are NOT official statistics and NOT market prices. Scale only: skala
 * mengacu ke publikasi BPS Kota Bandung (dikutip, dibulatkan).
 *
 * Real geography and names (HDX COD-AB boundaries, OSM features, Kemendagri codes) come from the cache built by
 * fetch-bandung.mjs. Kecamatan spelling follows build-bandung.mjs (KEC_ALIAS).
 */
export const SIM = {
  /** reference year the simulated figures stand for (UI label "Penduduk 2025") */
  year: 2025,
  attribution: 'skala mengacu ke publikasi BPS Kota Bandung (dikutip, dibulatkan)',
  label: 'Angka simulasi untuk demo, dibulatkan dari skala data publik; bukan statistik resmi',
}

/** [name, population (simulated, rounded to 100), approx. max altitude m a.s.l. (simulated, rounded to 5 m; drives
 *  the derived flood / landslide factors: the north of the city sits on the slopes, the south-east is the low
 *  basin floor)] */
export const KECAMATAN = [
  ['Andir', 97600, 715],
  ['Antapani', 79700, 700],
  ['Arcamanik', 82400, 705],
  ['Astanaanyar', 66300, 690],
  ['Babakan Ciparay', 147400, 685],
  ['Bandung Kidul', 60100, 675],
  ['Bandung Kulon', 141300, 690],
  ['Bandung Wetan', 29400, 770],
  ['Batununggal', 120200, 685],
  ['Bojongloa Kaler', 120000, 690],
  ['Bojongloa Kidul', 87800, 680],
  ['Buahbatu', 96600, 675],
  ['Cibeunying Kaler', 69900, 830],
  ['Cibeunying Kidul', 106600, 735],
  ['Cibiru', 72600, 765],
  ['Cicendo', 96800, 765],
  ['Cidadap', 58000, 1050],
  ['Cinambo', 24600, 690],
  ['Coblong', 111900, 905],
  ['Gedebage', 39700, 670],
  ['Kiaracondong', 129300, 685],
  ['Lengkong', 70000, 705],
  ['Mandalajati', 63800, 790],
  ['Panyileukan', 39000, 680],
  ['Rancasari', 77000, 670],
  ['Regol', 79600, 690],
  ['Sukajadi', 104700, 855],
  ['Sukasari', 79300, 950],
  ['Sumur Bandung', 35000, 730],
  ['Ujungberung', 82400, 805],
]

/** kota totals (simulated): population to 1,000, households = family-card holders to 1,000, land area to km² */
export const TOTALS = { population: 2469000, households: 791000, area_km2: 168 }

/** economic structure (simulated, whole percent). The build adds "Lainnya" = 100 − Σ, so the bar sums to 100. */
export const SECTORS = [
  ['Perdagangan Besar dan Eceran', 'Wholesale and retail trade', 26],
  ['Industri Pengolahan (garmen dan tekstil)', 'Manufacturing (garments and textiles)', 18],
  ['Informasi dan Komunikasi', 'Information and communication', 13],
  ['Konstruksi', 'Construction', 9],
  ['Penyediaan Akomodasi dan Makan Minum', 'Accommodation and food services', 7],
  ['Jasa Pendidikan dan Jasa Lainnya', 'Education and other services', 7],
  ['Transportasi dan Pergudangan', 'Transport and warehousing', 5],
]

/** staple base prices (simulated): plausible consumer prices for a large West Java city in 2026, chosen by GAMADA,
 *  rounded to Rp 50/100. The world simulation adds market offsets and daily noise on top. */
export const PRICES = [
  ['beras-medium', 'Beras medium', 'Medium rice', 'kg', 14000],
  ['cabai-merah', 'Cabai merah keriting', 'Curly red chilli', 'kg', 46000],
  ['cabai-rawit', 'Cabai rawit merah', "Red bird's-eye chilli", 'kg', 54000],
  ['bawang-merah', 'Bawang merah', 'Shallot', 'kg', 38000],
  ['bawang-putih', 'Bawang putih bonggol', 'Garlic', 'kg', 38500],
  ['tomat', 'Tomat', 'Tomatoes', 'kg', 14500],
  ['telur-ayam', 'Telur ayam ras', 'Chicken eggs', 'kg', 29500],
  ['daging-ayam', 'Daging ayam ras', 'Broiler chicken meat', 'kg', 38000],
  ['minyak-goreng', 'Minyak goreng kemasan', 'Packaged cooking oil', 'liter', 20500],
  ['gula-pasir', 'Gula pasir', 'Granulated sugar', 'kg', 18500],
]
