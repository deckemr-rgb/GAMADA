/**
 * world/pd/config.ts — Pasar Daerah constants (Katalog Lokal, Rapor Usaha, Indeks Ekonomi, Sinyal Pasar). All money,
 * prices, scores and effects are SIMULATED; label them "simulasi" in the UI.
 */
export const PD = {
  id: 'pasar-daerah' as const,
  version: 1,
  /** anonymity: an aggregate of fewer businesses is hidden (Indeks Ekonomi, Dinkop cards) */
  anonMin: 10,
  /** price anomaly band: seasonal expectation ± this many standard deviations */
  anomalyBandSd: 1.5,
  /** the early warning names the peak this many days ahead (C31) */
  earlyWarnDays: 5,
  forecastDays: 14,
  /** C36 / C27: a verified business is matched to a need when matchScore ≥ this */
  matchMin: 0.45,
  /** a market operation runs this many world minutes ("3 hari, dipercepat untuk demo") */
  opHours: 90,
  /** a Disperindag recommendation without approval after this many world minutes is approved by the demo world */
  autoApproveMin: 4,
  /** C30 shock size per shocked commodity (index in facts.pd.shockCommodityIds): cabai +22 %, beras +9 % (simulasi) */
  shockPct: [22, 9] as readonly number[],
  /** at most this many natural anomalies a day (one per shock) */
  anomaliesPerDay: 3,
  /** natural open needs: at most this many at once */
  maxOpenNeeds: 6,
}

/**
 * Reference unit prices per catalog category (Rp, simulasi): `listingOf` derives each business's listing from them.
 * karung-pasir / terpal = the emergency tender's HPS (world/up/config EMERGENCY_TENDER).
 */
export const CATEGORY_REF: Record<string, { price: number; unit: string; perStaff: number; name: { id: string; en: string } }> = {
  'karung-pasir': { price: 15_500, unit: 'lembar', perStaff: 220, name: { id: 'Karung pasir', en: 'Sandbags' } },
  terpal: { price: 135_000, unit: 'lembar', perStaff: 9, name: { id: 'Terpal', en: 'Tarpaulin' } },
  semen: { price: 68_000, unit: 'sak', perStaff: 40, name: { id: 'Semen', en: 'Cement' } },
  pompa: { price: 2_650_000, unit: 'unit', perStaff: 1, name: { id: 'Pompa air', en: 'Water pump' } },
  'alat-kerja': { price: 85_000, unit: 'set', perStaff: 12, name: { id: 'Alat kerja', en: 'Work tools' } },
  'nasi-kotak': { price: 25_000, unit: 'kotak', perStaff: 45, name: { id: 'Nasi kotak', en: 'Boxed meals' } },
  konsumsi: { price: 22_000, unit: 'porsi', perStaff: 40, name: { id: 'Konsumsi', en: 'Catering' } },
  'air-minum': { price: 48_000, unit: 'dus', perStaff: 30, name: { id: 'Air minum kemasan', en: 'Bottled water' } },
  sembako: { price: 95_000, unit: 'paket', perStaff: 25, name: { id: 'Paket sembako', en: 'Staple food parcel' } },
  seragam: { price: 165_000, unit: 'stel', perStaff: 9, name: { id: 'Seragam', en: 'Uniforms' } },
  kaos: { price: 60_000, unit: 'lembar', perStaff: 20, name: { id: 'Kaos', en: 'T-shirts' } },
  spanduk: { price: 90_000, unit: 'lembar', perStaff: 8, name: { id: 'Spanduk', en: 'Banners' } },
  atk: { price: 55_000, unit: 'paket', perStaff: 14, name: { id: 'ATK', en: 'Office supplies' } },
  mebel: { price: 145_000, unit: 'unit', perStaff: 6, name: { id: 'Kursi lipat', en: 'Folding chairs' } },
  suvenir: { price: 40_000, unit: 'buah', perStaff: 15, name: { id: 'Suvenir', en: 'Souvenirs' } },
  beras: { price: 14_000, unit: 'kg', perStaff: 300, name: { id: 'Beras', en: 'Rice' } },
  sayur: { price: 12_000, unit: 'kg', perStaff: 60, name: { id: 'Sayur', en: 'Vegetables' } },
  'servis-mesin': { price: 350_000, unit: 'kali', perStaff: 2, name: { id: 'Servis mesin', en: 'Engine service' } },
  angkutan: { price: 450_000, unit: 'rit', perStaff: 2, name: { id: 'Angkutan', en: 'Transport' } },
  'makanan-ringan': { price: 15_000, unit: 'paket', perStaff: 50, name: { id: 'Makanan ringan', en: 'Snacks' } },
}

/** loan maths (Rapor Usaha, §6 P2, simulasi): plafon multiplier and flat monthly rate per score band */
export const LOAN = {
  /** band index (SCORE_BANDS) → plafon multiplier of the Sep–Oct average net profit */
  multiplier: [0, 1, 2, 3, 4] as readonly number[],
  /** band index → the cooperative's maximum limit (Rp): the scenario shop gets Rp 150 jt at "Sangat baik" on every seed */
  cap: [0, 50_000_000, 100_000_000, 150_000_000, 250_000_000] as readonly number[],
  /** band index → flat rate % per month */
  ratePct: [0, 1.25, 1.0, 0.85, 0.75] as readonly number[],
  tenors: [6, 12, 18, 24] as const,
  /** installment / average monthly net profit */
  dsrMax: 0.35,
  /** plafon floor step */
  step: 5_000_000,
}

/** fictional lenders (= world/catalog LENDERS); LENDERS[0] is THE partner cooperative of Kenal Mitra + Rapor Usaha */
export const LENDERS = ['Koperasi Mitra Usaha Sejahtera', 'KSP Arunika Bersama', 'Bank Pelita Arta Daerah', 'BPR Sinar Lumbung Karya'] as const
