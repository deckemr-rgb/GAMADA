/**
 * siaga-wilayah/strings.ts — bilingual strings of the EAGER part (frame, panel shell, map stage, bottom bar,
 * Peringatan tab). Lazy tabs and dialogs keep their own strings in their file, so the first screen pays only for this.
 */
import { useCallback } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'

export type Bi = { id: string; en: string }

export const S = {
  frame: { id: 'Siaga Wilayah · Geo-AI peringatan dini', en: 'Siaga Wilayah · Geo-AI early warning' },
  panel: { id: 'Panel kendali', en: 'Control panel' },
  collapse: { id: 'Ciutkan panel', en: 'Collapse panel' },
  expand: { id: 'Buka panel', en: 'Expand panel' },
  tabs: { id: 'Bagian panel', en: 'Panel sections' },
  tabAlerts: { id: 'Peringatan', en: 'Warnings' },
  tabForecast: { id: 'Prediksi', en: 'Forecast' },
  tabAgri: { id: 'Pertanian', en: 'Agriculture' },
  tabEnv: { id: 'Lingkungan', en: 'Environment' },
  tabEnvShort: { id: 'Lingkungan', en: 'Env.' },
  loading: { id: 'Memuat…', en: 'Loading…' },
  sim: { id: 'simulasi', en: 'simulated' },
  askAi: { id: 'Tanya Geo-AI', en: 'Ask Geo-AI' },

  /* flow steps */
  flow: { id: 'Alur pagi ini', en: "This morning's flow" },
  step1: { id: 'Prediksi genangan', en: 'Predict flooding' },
  step2: { id: 'Kirim peringatan', en: 'Send warning' },
  step3: { id: 'Konfirmasi warga', en: 'Citizens confirm' },
  step4: { id: 'Dampak pertanian', en: 'Farm impact' },
  stepDone: { id: 'selesai', en: 'done' },

  /* bottom bar */
  ctaRun: { id: 'Jalankan prediksi 6 jam', en: 'Run 6-hour forecast' },
  ctaRunAgain: { id: 'Putar ulang prediksi', en: 'Replay forecast' },
  ctaSend: { id: 'Kirim peringatan dini', en: 'Send early warning' },
  ctaSendKd: { id: 'Setujui & kirim peringatan', en: 'Approve & send warning' },
  ctaAgri: { id: 'Lihat dampak pertanian', en: 'See farm impact' },
  ctaEnv: { id: 'Bandingkan citra sebelum/sesudah', en: 'Compare before/after imagery' },
  ctaPasca: { id: 'Hitung dampak pascabanjir', en: 'Compute the post-flood impact' },
  ctaAsk: { id: 'Tanya Geo-AI soal dampaknya', en: 'Ask Geo-AI about the impact' },
  scrub: { id: 'Prediksi genangan', en: 'Flood forecast' },
  hudDesa: { id: 'desa terdampak', en: 'villages affected' },
  hudPeople: { id: 'perkiraan warga terdampak', en: 'est. people affected' },
  hudArea: { id: 'km² tergenang', en: 'km² flooded' },
  hudDry: { id: 'Belum ada genangan. Jalankan prediksi untuk melihat air naik.', en: 'No flooding yet. Run the forecast to watch the water rise.' },
  hudLoading: { id: 'Memuat batas desa…', en: 'Loading village boundaries…' },
  hudNote: { id: 'Model turunan, angka simulasi', en: 'Derived model, simulated figures' },
  hudDone: { id: 'Prediksi +{h} j: {p} warga di {d} desa, {a} km² tergenang (simulasi).', en: 'Forecast +{h} h: {p} people in {d} villages, {a} km² flooded (simulated).' },


  /* map */
  map: { id: 'Peta Siaga Wilayah', en: 'Siaga Wilayah map' },
  layers: { id: 'Lapisan', en: 'Layers' },
  layersTitle: { id: 'Lapisan peta', en: 'Map layers' },
  lKec: { id: 'Batas kecamatan', en: 'District boundaries' },
  lDesa: { id: 'Batas desa/kelurahan', en: 'Village boundaries' },
  lDesaHint: { id: 'nama desa tampil saat diperbesar', en: 'village names appear when zoomed in' },
  lRivers: { id: 'Sungai & waduk', en: 'Rivers & reservoirs' },
  lHazard: { id: 'Zona risiko banjir', en: 'Flood-risk zones' },
  lHazardHint: { id: 'turunan dari data rawan bencana publik', en: 'derived from public hazard data' },
  lRain: { id: 'Curah hujan (radar simulasi)', en: 'Rainfall (simulated radar)' },
  lFlood: { id: 'Prediksi genangan', en: 'Predicted inundation' },
  lReports: { id: 'Aduan banjir warga', en: 'Citizen flood reports' },
  lReportsHint: { id: 'dari Sapa Warga', en: 'from Sapa Warga' },
  lFacilities: { id: 'Fasilitas penting & pengungsian', en: 'Key facilities & shelters' },
  lFacilitiesHint: { id: 'RS, puskesmas, sekolah, posko (posko = simulasi)', en: 'hospitals, clinics, schools, shelters (shelters simulated)' },
  lZones: { id: 'Zona peringatan aktif', en: 'Active warning zones' },
  lImagery: { id: 'Citra satelit Sentinel-2 (2016)', en: 'Sentinel-2 satellite imagery (2016)' },
  lImageryHint: { id: 'mosaik bebas awan EOX 2016, CC BY 4.0 · bukan kondisi hari ini', en: 'EOX cloudless 2016 mosaic, CC BY 4.0 · not today’s conditions' },
  lHarvest: { id: 'Lahan pertanian: estimasi panen', en: 'Farmland: harvest estimate' },
  lLandslide: { id: 'Risiko longsor per kecamatan', en: 'Landslide risk by district' },
  lChanges: { id: 'Alih fungsi lahan (simulasi)', en: 'Land-use change (simulated)' },
  imageryBadge: { id: 'Citra Sentinel-2 bebas awan 2016 (EOX) · bukan kondisi hari ini', en: 'Sentinel-2 cloudless 2016 (EOX) · not today’s conditions' },
  confirmed: { id: 'Terkonfirmasi warga', en: 'Confirmed by citizens' },
  report: { id: 'Aduan banjir', en: 'Flood report' },
  shelter: { id: 'Posko pengungsian', en: 'Shelter' },
  close: { id: 'Tutup', en: 'Close' },
  fold: { id: 'Ciutkan', en: 'Fold' },
  insightChip: { id: 'Wawasan Geo-AI · {n} desa', en: 'Geo-AI insight · {n} villages' },
  seeMap: { id: 'Lihat di peta', en: 'See on the map' },
  openSapa: { id: 'Buka di Sapa Warga', en: 'Open in Sapa Warga' },
  insight: { id: 'Wawasan Geo-AI', en: 'Geo-AI insight' },
  insightRun: {
    id: '{desa} desa di {kec} kecamatan diprediksi tergenang dalam 6 jam. Paling cepat: {first} (±{onset} j). {conf}',
    en: '{desa} villages in {kec} districts are predicted to flood within 6 hours. Earliest: {first} (±{onset} h). {conf}',
  },
  insightConf: { id: '{n} aduan warga berada di zona prediksi — prediksi terkonfirmasi di lapangan.', en: '{n} citizen reports fall inside the predicted zone — confirmed on the ground.' },
  insightReports: { id: '{n} aduan banjir warga sudah masuk di area ini.', en: '{n} citizen flood reports already came in from this area.' },
  legend: { id: 'Legenda', en: 'Legend' },
  harvestUnit: { id: 'penurunan estimasi panen vs normal (%, simulasi)', en: 'harvest drop vs normal (%, simulated)' },
  harvestTon: { id: 'estimasi panen (ton, simulasi)', en: 'harvest estimate (tonnes, simulated)' },
  ndviUnit: { id: 'indeks kesehatan vegetasi 0–1 (simulasi)', en: 'vegetation health index 0–1 (simulated)' },
  landslideUnit: { id: 'indeks risiko longsor 0–1 (turunan region pack)', en: 'landslide risk index 0–1 (derived, region pack)' },

  /* Peringatan tab */
  exec: { id: 'Ringkasan untuk pimpinan', en: 'Summary for the regional head' },
  execAlerts: { id: 'peringatan aktif', en: 'active warnings' },
  execPeople: { id: 'warga di zona prediksi', en: 'people in the forecast zone' },
  execShelter: { id: 'terisi di posko', en: 'in shelters' },
  execPhones: { id: 'HP warga menerima pesan', en: 'citizen phones reached' },
  situation: { id: 'Situasi pagi ini', en: 'This morning' },
  rainNone: { id: 'Radar menunjukkan awan hujan di barat. Prakiraan rinci dimuat saat prediksi dijalankan.', en: 'Radar shows rain clouds to the west. The detailed forecast loads when you run the prediction.' },
  rainOn: { id: '{n} sel hujan bergerak ke timur, puncak {peak} mm/jam, melintasi {kec}.', en: '{n} rain cells moving east, peak {peak} mm/h, crossing {kec}.' },
  gauge: { id: 'Tinggi muka air', en: 'Water level' },
  gaugeOf: { id: '{v} m · siaga {s} m · awas {a} m', en: '{v} m · watch {s} m · warning {a} m' },
  gaugeSim: { id: 'Pos pantau nyata, pembacaan simulasi', en: 'Real gauge site, simulated readings' },
  alerts: { id: 'Peringatan aktif', en: 'Active warnings' },
  noAlerts: { id: 'Belum ada peringatan aktif hari ini.', en: 'No active warnings today.' },
  noAlertsHint: { id: 'Jalankan prediksi, lalu kirim peringatan dini ke kecamatan yang terdampak.', en: 'Run the forecast, then send an early warning to the affected districts.' },
  readOnly: { id: 'Peringatan dini dikirim oleh BPBD. Peran Dinas Pertanian melihat status dan dampaknya.', en: 'Early warnings are sent by BPBD. The Agriculture Office role sees their status and impact.' },
  level: { id: 'Level', en: 'Level' },
  lv1: { id: 'Waspada', en: 'Advisory' },
  lv2: { id: 'Siaga', en: 'Watch' },
  lv3: { id: 'Awas', en: 'Warning' },
  lv4: { id: 'Darurat', en: 'Emergency' },
  sentTo: { id: 'Terkirim ke {n} penerima · {ch}', en: 'Sent to {n} recipients · {ch}' },
  notSent: { id: 'Belum disiarkan', en: 'Not broadcast yet' },
  sendNow: { id: 'Siarkan', en: 'Broadcast' },
  expected: { id: 'Air diperkirakan tiba {t}', en: 'Water expected at {t}' },
  issued: { id: 'Ditetapkan {t}', en: 'Issued {t}' },
  reports: { id: 'Laporan banjir dari warga', en: 'Flood reports from citizens' },
  reportsNone: { id: 'Belum ada laporan banjir hari ini.', en: 'No flood reports today.' },
  reportsSim: { id: 'Simulasikan 2 laporan warga masuk', en: 'Simulate 2 incoming citizen reports' },
  reportsSimHint: { id: 'seperti dikirim lewat Sapa Warga · uji alur', en: 'as if sent via Sapa Warga · flow test' },
  reportsCluster: { id: 'Klaster {n} aduan dalam radius 1 km mengonfirmasi prediksi.', en: 'A cluster of {n} reports within 1 km confirms the forecast.' },
  shelters: { id: 'Posko pengungsian', en: 'Evacuation shelters' },
  sheltersOf: { id: '{o} dari {c} jiwa · {n} posko (lokasi & kapasitas simulasi)', en: '{o} of {c} people · {n} shelters (simulated sites & capacity)' },
  sheltersIdle: { id: '{n} posko siap · terisi setelah peringatan banjir', en: '{n} shelters ready · fill after a flood warning' },
  showOnMap: { id: 'Tampilkan di peta', en: 'Show on map' },
  hideOnMap: { id: 'Sembunyikan dari peta', en: 'Hide from map' },
  now: { id: 'baru saja', en: 'just now' },
} satisfies Record<string, Bi>

export type SKey = keyof typeof S

export const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

const NF = new Map<string, Intl.NumberFormat>()
export function nf(n: number, lang: Lang, d = 0): string {
  const k = `${lang}${d}`
  let f = NF.get(k)
  if (!f) NF.set(k, (f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })))
  return f.format(n)
}

/** t(key, vars?) for the eager strings */
export function useT(): { lang: Lang; t: (k: SKey, v?: Record<string, string | number>) => string } {
  const { lang } = useI18n()
  const t = useCallback((k: SKey, v?: Record<string, string | number>) => (v ? fill(S[k][lang], v) : S[k][lang]), [lang])
  return { lang, t }
}

export const LEVELS = [1, 2, 3, 4] as const
export type Level = (typeof LEVELS)[number]
export const levelKey = (l: number): SKey => (l >= 4 ? 'lv4' : l === 3 ? 'lv3' : l === 2 ? 'lv2' : 'lv1')
