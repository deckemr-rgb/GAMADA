/**
 * mock.ts — AI_MOCK=1: deterministic fake answers with no API key and no network, used by the
 * site's Playwright tests and for demos without a key. Same wire format as live; `done.mock` = true.
 *
 * Test switches (put the marker anywhere in the LAST user message):
 *   [mock:slow]     first token after 12 s  → exercises the site's 10 s first-token fallback
 *   [mock:error]    a little text, then an SSE `error` event
 *   [mock:invalid]  a tool_call whose structured data fails the schema → client must fall back
 *   [mock:429]      HTTP 429 JSON before streaming (handled in app.ts)
 *   [mock:budget]   HTTP 503 budget_exhausted before streaming (handled in app.ts)
 */
import type { ChatRequest, ExtractKind, Extracted, ProxyEvent, ToolName } from './schemas.js'
import { TOOLS } from './schemas.js'
import { PROMPTS } from '../prompts/index.js'
import { PRODUCT_NAMES } from './products.js'

export const MOCK_MARKERS = ['[mock:slow]', '[mock:error]', '[mock:invalid]', '[mock:429]', '[mock:budget]'] as const

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(signal.reason ?? new Error('aborted'))
      },
      { once: true },
    )
  })
}

/** One valid example per structured tool (the self-test validates every entry against TOOLS). */
export const MOCK_STRUCTURED: Record<ToolName, Record<string, unknown>> = {
  create_ticket: {
    category: 'Banjir/Genangan',
    summary: 'Genangan setinggi lutut di jalan desa sejak pagi, air mulai masuk ke halaman rumah warga.',
    urgency: 'tinggi',
    opd: 'BPBD',
    location: { kecamatan: 'Kecamatan Contoh', desa: 'Desa Contoh' },
    language: 'jv',
    translationId: 'Jalan di desa saya tergenang air setinggi lutut sejak pagi.',
    slaHours: 6,
  },
  service_checklist: {
    service: 'Nomor Induk Berusaha (NIB)',
    requirements: ['KTP-el pemilik usaha', 'NPWP (bila ada)', 'Alamat dan bidang usaha (KBLI)', 'Nomor HP dan e-mail aktif'],
    estimate: '1 hari kerja',
    office: 'Mal Pelayanan Publik',
    fee: 'Gratis',
  },
  query_world: { metric: 'complaints', groupBy: 'kecamatan', range: '7d', chart: 'bar' },
  issue_instruction: { to: 'BPBD', instruction: 'Kerahkan 3 pompa portabel ke desa terdampak genangan dan laporkan progres tiap 2 jam.', deadline: 'Hari ini 14.00 WIB', priority: 'segera' },
  extract_minutes: {
    decisions: ['Pompa portabel dikerahkan ke tiga desa terdampak.', 'Posko terpadu dibuka di kantor kecamatan.'],
    actionItems: [
      { task: 'Mengirim 3 pompa portabel', owner: 'Kepala BPBD', due: 'Hari ini' },
      { task: 'Menyiapkan logistik posko', owner: 'Dinas Sosial', due: 'Besok' },
    ],
  },
  classify_letter: { letterClass: 'undangan', nature: 'segera', summary: ['Undangan rapat koordinasi penanganan banjir.', 'Dihadiri seluruh camat terdampak.', 'Membawa data kerusakan terbaru.'], sender: 'Sekretariat Daerah', deadline: 'Besok 09.00 WIB' },
  draft_disposition: { to: ['Kepala BPBD', 'Kepala Dinas PUPR'], instruction: 'Hadiri dan laporkan hasilnya.', note: 'Bawa data pompa dan titik genangan.', deadline: 'Besok' },
  assess_mention: { sentiment: 'negatif', topic: 'Isu bendungan jebol', hoaxLikelihood: 0.86, reasons: ['Data sensor muka air normal.', 'Tidak ada laporan warga di sekitar bendungan.'], evidenceNeeded: ['Foto terbaru dari petugas lapangan'] },
  draft_clarification: {
    tone: 'menenangkan',
    pressRelease: 'Pemerintah daerah memastikan kondisi bendungan aman. Pemantauan muka air dilakukan setiap jam dan tidak menunjukkan kenaikan yang membahayakan.',
    socialCaption: 'Bendungan dalam kondisi aman. Pantau informasi resmi hanya dari kanal pemerintah daerah.',
    infographicPoints: ['Muka air normal', 'Petugas berjaga 24 jam', 'Laporkan info mencurigakan ke kanal resmi'],
  },
  draft_alert: { level: 'siaga', areas: ['Desa Contoh', 'Desa Contoh Kidul'], message: 'Hujan lebat diperkirakan 2 jam lagi. Warga di bantaran sungai diminta menyiapkan barang penting dan menuju titik kumpul bila air naik.', channels: ['wa', 'sms'] },
  assess_procurement: { riskScore: 72, flags: [{ detector: 'harga', severity: 'tinggi', note: 'HPS 38% di atas median referensi.' }, { detector: 'afiliasi', severity: 'sedang', note: 'Dua peserta berbagi alamat kantor.' }], recommendation: 'Koreksi HPS dan klarifikasi peserta sebelum penetapan pemenang.' },
  check_documents: { status: 'kurang', missing: ['Surat keterangan domisili'], notes: ['Ejaan nama di KK berbeda dengan KTP.'] },
  draft_po: { supplier: 'CV Contoh Makmur', items: [{ name: 'Karung pasir', qty: 500, unit: 'pcs' }, { name: 'Terpal 4x6', qty: 40, unit: 'lembar' }], reason: 'Permintaan naik karena peringatan banjir.', deliverBy: 'Besok' },
  categorize_transaction: { entries: [{ description: 'Pembelian stok gula', account: 'Persediaan', debit: 1250000, credit: 0 }, { description: 'Pembayaran tunai', account: 'Kas', debit: 0, credit: 1250000 }], taxNote: 'Bukan objek PPh final.' },
  score_call: { criteria: [{ id: 'salam', score: 4, evidence: 'Menyapa dengan nama.' }, { id: 'closing', score: 2, evidence: 'Tidak menawarkan langkah berikutnya.' }], total: 64, coaching: ['Tutup dengan ajakan yang jelas.'] },
  kyc_decision: { riskScore: 18, decision: 'setujui', reasons: ['Data dokumen cocok.', 'Lokasi usaha terverifikasi.'] },
  cluster_feedback: { clusters: [{ label: 'Pengiriman terlambat', share: 0.42, sample: 'Pesanan datang dua hari lebih lambat.', suggestedAction: 'Umumkan perkiraan waktu kirim yang baru.' }] },
  draft_reply: { tone: 'empatik', reply: 'Mohon maaf atas keterlambatan pesanan Anda. Kami sudah memeriksa pengirimannya dan akan mengabari Anda hari ini.' },
  estimate_win: { probability: 78, factors: [{ name: 'Kesesuaian KBLI', impact: 'naik', note: 'KBLI sama persis.' }, { name: 'Jumlah pesaing', impact: 'turun', note: '6 pesaing terdaftar.' }], priceRange: { low: 412000000, high: 436000000 } },
  need_spec: { items: [{ name: 'Karung pasir', qty: 2000, unit: 'pcs', spec: 'Karung plastik 50 kg' }, { name: 'Terpal', qty: 50, unit: 'lembar', spec: '4x6 m' }], location: 'Kecamatan Contoh', deliveryDays: 2 },
  explain_score: { score: 712, drivers: [{ name: 'Penjualan stabil', direction: 'naik', note: 'Omzet 6 bulan konsisten.' }, { name: 'Laporan pajak', direction: 'turun', note: '1 bulan terlambat.' }], actions: ['Lapor pajak tepat waktu', 'Catat semua penjualan', 'Lengkapi verifikasi usaha'] },
  econ_insight: { indicator: 'Indeks aktivitas usaha', trend: 'turun', explanation: 'Penurunan berkaitan dengan genangan di kecamatan pertanian bulan ini.', kecamatan: ['Kecamatan Contoh'] },
  price_alert: { commodity: 'Cabai rawit', market: 'Pasar Contoh', changePct: 23.5, horizonDays: 5, cause: 'Pasokan turun setelah banjir.', recommendation: 'Siapkan operasi pasar dan koordinasi pasokan dari daerah tetangga.' },
  plan_agents: { steps: [{ product: 'sapa-warga', action: 'Kumpulkan aduan banjir' }, { product: 'siaga-wilayah', action: 'Kirim peringatan dini' }, { product: 'katalog-lokal', action: 'Pesan karung pasir dari UMKM lokal' }] },
  suggest_followups: { chips: ['Lacak tiket', 'Syarat lain?'] },
}

const FOLLOWUPS = {
  id: ['Lihat detail', 'Pertanyaan lain'],
  en: ['Show details', 'Another question'],
}

function mockText(req: ChatRequest): string {
  const last = req.messages[req.messages.length - 1]?.content ?? ''
  const snippet = last.replace(/\[mock:[a-z0-9]+\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const name = PRODUCT_NAMES[req.product]
  return req.lang === 'en'
    ? `[Test mode] ${name} received your message: "${snippet}". This is a deterministic mock answer; in real Live mode the AI model writes the answer from the demo world context.`
    : `[Mode uji] ${name} menerima pesan Anda: "${snippet}". Ini jawaban tiruan yang deterministik; di mode Live sungguhan, jawaban disusun model AI dari konteks dunia demo.`
}

export async function* mockChat(req: ChatRequest, delayMs: number, signal: AbortSignal): AsyncGenerator<ProxyEvent, void> {
  const last = req.messages[req.messages.length - 1]?.content ?? ''
  if (last.includes('[mock:slow]')) await sleep(12_000, signal)

  const words = mockText(req).match(/\S+\s*/g) ?? []
  const failAt = last.includes('[mock:error]') ? Math.min(6, words.length) : -1
  for (let i = 0; i < words.length; i++) {
    if (i === failAt) {
      yield { type: 'error', code: 'mock_error', message: 'Simulated upstream failure.', retryable: true }
      return
    }
    if (delayMs) await sleep(delayMs, signal)
    yield { type: 'text', text: words[i] ?? '' }
  }

  const first = PROMPTS[req.product].tools[0]
  if (first) {
    const def = TOOLS[first]
    const data = last.includes('[mock:invalid]') ? { invalid: true } : MOCK_STRUCTURED[first]
    yield { type: 'tool_call', call: { id: 'mock_tool_1', name: def.name, input: data }, structured: { kind: def.kind, data } }
  }
  const chips = FOLLOWUPS[req.lang]
  yield {
    type: 'tool_call',
    call: { id: 'mock_tool_2', name: 'suggest_followups', input: { chips } },
    structured: { kind: 'followups', data: { chips } },
  }
  yield {
    type: 'done',
    mode: 'live',
    model: 'mock',
    stopReason: 'end_turn',
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    mock: true,
  }
}

const L = (id: string, en: string) => ({ id, en })

export function mockExtract(kind: ExtractKind): Extracted {
  switch (kind) {
    case 'ktp-specimen':
      return {
        kind,
        fields: [
          { key: 'nik', label: L('NIK', 'ID number'), value: '3522XXXXXXXX0001', confidence: 0.97, box: { x: 22, y: 14, w: 46, h: 6 } },
          { key: 'nama', label: L('Nama', 'Name'), value: 'SPESIMEN CONTOH', confidence: 0.95, box: { x: 22, y: 22, w: 40, h: 5 } },
          { key: 'tempat_tgl_lahir', label: L('Tempat/Tgl Lahir', 'Place/Date of birth'), value: 'KOTA CONTOH, 01-01-1990', confidence: 0.92 },
          { key: 'kecamatan', label: L('Kecamatan', 'District'), value: 'KECAMATAN CONTOH', confidence: 0.9 },
        ],
        checks: [
          { id: 'specimen_mark', label: L('Tanda SPESIMEN ada', 'SPECIMEN mark present'), status: 'ok' },
          { id: 'nik_format', label: L('Format NIK 16 digit', 'NIK has 16 digits'), status: 'ok' },
          { id: 'photo_present', label: L('Pas foto ada', 'Photo present'), status: 'ok' },
        ],
        tamper: [{ x: 60, y: 20, w: 10, h: 8, score: 0.12 }],
        mode: 'live',
      }
    case 'invoice':
      return {
        kind,
        fields: [
          { key: 'penjual', label: L('Penjual', 'Seller'), value: 'TOKO CONTOH JAYA', confidence: 0.94 },
          { key: 'tanggal', label: L('Tanggal', 'Date'), value: '2026-11-17', confidence: 0.9 },
          { key: 'total', label: L('Total', 'Total'), value: 'Rp 1.250.000', confidence: 0.93 },
        ],
        checks: [{ id: 'total_matches', label: L('Subtotal + pajak = total', 'Subtotal + tax = total'), status: 'ok' }],
        mode: 'live',
      }
    case 'cv':
      return {
        kind,
        fields: [
          { key: 'nama_kode', label: L('Kode kandidat', 'Candidate code'), value: 'K-017', confidence: 0.99 },
          { key: 'pendidikan_terakhir', label: L('Pendidikan terakhir', 'Highest education'), value: 'D3 Akuntansi', confidence: 0.91 },
          { key: 'pengalaman_tahun', label: L('Pengalaman (tahun)', 'Experience (years)'), value: '4', confidence: 0.88 },
        ],
        checks: [{ id: 'experience_consistent', label: L('Riwayat kerja konsisten', 'Work history consistent'), status: 'ok' }],
        mode: 'live',
      }
    case 'document':
      return {
        kind,
        fields: [
          { key: 'nomor_surat', label: L('Nomor surat', 'Letter number'), value: '005/123/CONTOH/2026', confidence: 0.93 },
          { key: 'perihal', label: L('Perihal', 'Subject'), value: 'Undangan rapat koordinasi', confidence: 0.95 },
          { key: 'sifat', label: L('Sifat', 'Nature'), value: 'Segera', confidence: 0.86 },
        ],
        checks: [
          { id: 'has_number', label: L('Ada nomor surat', 'Has a letter number'), status: 'ok' },
          { id: 'has_signature_block', label: L('Ada blok tanda tangan', 'Has a signature block'), status: 'warn', note: 'Tanda tangan tidak terbaca' },
        ],
        mode: 'live',
      }
  }
}
