/**
 * Tiny RegionPack fixture for the world self-tests and as a fallback in the /lab/_kit showcase while the
 * real Bojonegoro pack (region builder) is not there yet. Place names are real Bojonegoro kecamatan /
 * kelurahan / markets, but coordinates, populations and risk values are APPROXIMATE test values — the
 * real pack (src/demo-kit/region/packs/bojonegoro) is the source of truth.
 */
import { RegionPack } from '../../region/types'

const raw = {
  id: 'bojonegoro',
  name: 'Kabupaten Bojonegoro',
  shortName: 'Bojonegoro',
  type: 'kabupaten',
  province: 'Jawa Timur',
  slogan: null,
  center: [111.88, -7.16],
  zoom: 10,
  bbox: [111.4, -7.45, 112.1, -6.95],
  stats: { population: 1_340_000, households: 410_000, area_km2: 2307, year: 2024, source: 'fixture (approximate)' },
  kecamatan: [
    {
      id: 'bojonegoro', name: 'Bojonegoro', population: 92_000, centroid: [111.882, -7.152], riskFlood: 0.82, riskLandslide: 0.05, mainSector: 'perdagangan',
      desa: [
        { id: 'ledok-kulon', name: 'Ledok Kulon', kind: 'kelurahan', centroid: [111.873, -7.146] },
        { id: 'ledok-wetan', name: 'Ledok Wetan', kind: 'kelurahan', centroid: [111.889, -7.143] },
        { id: 'kadipaten', name: 'Kadipaten', kind: 'kelurahan', centroid: [111.882, -7.155] },
        { id: 'banjarejo', name: 'Banjarejo', kind: 'desa', centroid: [111.897, -7.165] },
        { id: 'jetak', name: 'Jetak', kind: 'kelurahan', centroid: [111.893, -7.153] },
        { id: 'klangon', name: 'Klangon', kind: 'kelurahan', centroid: [111.871, -7.158] },
      ],
    },
    {
      id: 'trucuk', name: 'Trucuk', population: 41_000, centroid: [111.835, -7.118], riskFlood: 0.74, riskLandslide: 0.04, mainSector: 'pertanian',
      desa: [
        { id: 'trucuk', name: 'Trucuk', kind: 'desa', centroid: [111.836, -7.12] },
        { id: 'padang', name: 'Padang', kind: 'desa', centroid: [111.85, -7.128] },
        { id: 'guyangan', name: 'Guyangan', kind: 'desa', centroid: [111.82, -7.112] },
      ],
    },
    {
      id: 'kanor', name: 'Kanor', population: 58_000, centroid: [112.04, -7.1], riskFlood: 0.88, riskLandslide: 0.02, mainSector: 'pertanian',
      desa: [
        { id: 'kanor', name: 'Kanor', kind: 'desa', centroid: [112.04, -7.1] },
        { id: 'sarangan', name: 'Sarangan', kind: 'desa', centroid: [112.03, -7.09] },
      ],
    },
    {
      id: 'kalitidu', name: 'Kalitidu', population: 68_000, centroid: [111.7, -7.15], riskFlood: 0.6, riskLandslide: 0.08, mainSector: 'pertanian',
      desa: [
        { id: 'kalitidu', name: 'Kalitidu', kind: 'desa', centroid: [111.7, -7.15] },
        { id: 'leran', name: 'Leran', kind: 'desa', centroid: [111.69, -7.14] },
      ],
    },
    {
      id: 'dander', name: 'Dander', population: 65_000, centroid: [111.84, -7.25], riskFlood: 0.2, riskLandslide: 0.25, mainSector: 'pertanian',
      desa: [
        { id: 'dander', name: 'Dander', kind: 'desa', centroid: [111.84, -7.25] },
        { id: 'ngumpakdalem', name: 'Ngumpakdalem', kind: 'desa', centroid: [111.85, -7.235] },
      ],
    },
  ],
  rivers: [{ id: 'bengawan-solo', name: 'Bengawan Solo' }],
  landmarks: [{ id: 'mpp', name: 'Mal Pelayanan Publik', kind: 'mpp', coord: [111.884, -7.151], kecamatanId: 'bojonegoro' }],
  markets: [
    { id: 'pasar-kota', name: 'Pasar Kota Bojonegoro', coord: [111.886, -7.149], kecamatanId: 'bojonegoro' },
    { id: 'pasar-banjarejo', name: 'Pasar Banjarejo', coord: [111.898, -7.166], kecamatanId: 'bojonegoro' },
    { id: 'pasar-kalitidu', name: 'Pasar Kalitidu', coord: [111.701, -7.151], kecamatanId: 'kalitidu' },
  ],
  economy: {
    sectors: [
      { name: { id: 'Pertambangan & penggalian', en: 'Mining & quarrying' }, share: 0.4 },
      { name: { id: 'Pertanian', en: 'Agriculture' }, share: 0.18 },
      { name: { id: 'Perdagangan', en: 'Trade' }, share: 0.12 },
    ],
    commodities: [
      { id: 'beras', name: { id: 'Beras medium', en: 'Medium rice' }, unit: 'kg', basePrice: 13_500 },
      { id: 'cabai-rawit', name: { id: 'Cabai rawit', en: "Bird's-eye chilli" }, unit: 'kg', basePrice: 45_000 },
      { id: 'bawang-merah', name: { id: 'Bawang merah', en: 'Shallot' }, unit: 'kg', basePrice: 36_000 },
      { id: 'gula', name: { id: 'Gula pasir', en: 'Sugar' }, unit: 'kg', basePrice: 17_500 },
      { id: 'minyak', name: { id: 'Minyak goreng', en: 'Cooking oil' }, unit: 'L', basePrice: 18_000 },
      { id: 'telur', name: { id: 'Telur ayam', en: 'Chicken eggs' }, unit: 'kg', basePrice: 28_000 },
    ],
    umkmCount: 60_000,
    source: 'fixture (approximate)',
  },
  opd: [
    { id: 'pupr', name: 'Dinas Pekerjaan Umum dan Penataan Ruang', short: 'Dinas PUPR' },
    { id: 'bpbd', name: 'Badan Penanggulangan Bencana Daerah', short: 'BPBD' },
    { id: 'dlh', name: 'Dinas Lingkungan Hidup', short: 'DLH' },
    { id: 'dishub', name: 'Dinas Perhubungan', short: 'Dishub' },
    { id: 'dukcapil', name: 'Dinas Kependudukan dan Pencatatan Sipil', short: 'Disdukcapil' },
    { id: 'dinsos', name: 'Dinas Sosial', short: 'Dinsos' },
    { id: 'dinkes', name: 'Dinas Kesehatan', short: 'Dinkes' },
    { id: 'disdik', name: 'Dinas Pendidikan', short: 'Disdik' },
    { id: 'inspektorat', name: 'Inspektorat Daerah', short: 'Inspektorat' },
    { id: 'disperindag', name: 'Dinas Perdagangan', short: 'Disperindag' },
    { id: 'pertanian', name: 'Dinas Pertanian dan Ketahanan Pangan', short: 'Dinas Pertanian' },
    { id: 'kominfo', name: 'Dinas Komunikasi dan Informatika', short: 'Diskominfo' },
  ],
  services: [
    {
      id: 'ktp-el', name: { id: 'KTP-el (penggantian)', en: 'e-ID card (replacement)' }, slaDays: 1, channel: 'mpp', opdId: 'dukcapil',
      requirements: [{ id: 'Fotokopi KK', en: 'Copy of family card' }, { id: 'KTP-el rusak', en: 'Damaged e-ID card' }], fee: { id: 'Gratis', en: 'Free' },
    },
    {
      id: 'nib', name: { id: 'NIB (Nomor Induk Berusaha)', en: 'Business ID number (NIB)' }, slaDays: 1, channel: 'online', opdId: 'disperindag',
      requirements: [{ id: 'NIK', en: 'National ID number' }, { id: 'Alamat usaha', en: 'Business address' }], fee: { id: 'Gratis', en: 'Free' },
    },
  ],
  languages: {
    primary: 'id',
    regional: ['jv'],
    speechCodes: ['jv-ID', 'id-ID'],
    samples: {
      greetings: [{ lang: 'jv', text: 'Sugeng enjang', id: 'Selamat pagi', en: 'Good morning' }],
      complaintTemplates: [
        { id: 'jv-banjir-1', lang: 'jv', category: 'banjir', urgency: 'tinggi', text: 'Banyune wis mlebu omah, wis sak dhengkul. Tulung dikirimi pompa.', translation: { id: 'Airnya sudah masuk rumah, sudah selutut. Tolong dikirimi pompa.', en: 'The water is inside the house, knee-deep already. Please send a pump.' } },
        { id: 'jv-banjir-2', lang: 'jv', category: 'banjir', urgency: 'tinggi', text: 'Dalan gedhe kebanjiran, motor ora iso liwat.', translation: { id: 'Jalan besar kebanjiran, motor tidak bisa lewat.', en: 'The main road is flooded, motorbikes cannot get through.' } },
        { id: 'jv-jalan-1', lang: 'jv', category: 'jalan-rusak', urgency: 'sedang', text: 'Dalane bolong-bolong gedhe, wis ana sing tiba.', translation: { id: 'Jalannya berlubang besar, sudah ada yang jatuh.', en: 'The road has big potholes, someone has already fallen.' } },
        { id: 'jv-sampah-1', lang: 'jv', category: 'sampah', urgency: 'sedang', text: 'Sampah ing TPS durung diangkut telung dina.', translation: { id: 'Sampah di TPS belum diangkut tiga hari.', en: 'The rubbish at the collection point has not been taken for three days.' } },
        { id: 'jv-pju-1', lang: 'jv', category: 'pju', urgency: 'rendah', text: 'Lampu dalan mati wis seminggu, peteng banget.', translation: { id: 'Lampu jalan mati sudah seminggu, gelap sekali.', en: 'The street light has been out for a week, it is very dark.' } },
        { id: 'jv-ktp-1', lang: 'jv', category: 'adminduk', urgency: 'rendah', text: 'KTP-ku rusak, kepiye carane ganti?', translation: { id: 'KTP saya rusak, bagaimana cara menggantinya?', en: 'My ID card is damaged, how do I replace it?' } },
      ],
    },
  },
  weather: {},
  branding: { emblem: 'generic', primaryHue: 262 },
  scenario: { floodRiverId: 'bengawan-solo', floodKecamatanIds: ['bojonegoro', 'trucuk', 'kanor'], shopMarketId: 'pasar-kota' },
  sources: [{ layer: 'fixture', name: 'GAMADA test fixture (approximate values)', url: 'about:blank', license: 'n/a' }],
}

export const MINI_PACK: RegionPack = RegionPack.parse(raw)
