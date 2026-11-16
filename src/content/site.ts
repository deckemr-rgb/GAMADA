/**
 * site.ts — the ONE place for contact details, numbers and external URLs.
 *
 * Every value marked `TODO` is a placeholder that still has to be confirmed by GAMADA.
 * Nothing here is invented as fact: empty strings hide or neutralise the matching UI
 * (e.g. an empty WhatsApp number opens WhatsApp's own contact picker with the prefilled text).
 */

export const SITE = {
  name: 'GAMADA',
  /** TODO: nama badan usaha resmi (mis. "PT ..."), dipakai di JSON-LD dan copyright. */
  legalName: 'GAMADA',
  /** TODO: domain produksi (canonical, sitemap, Open Graph). */
  url: 'https://gamada.id',
  /** TODO: email kontak asli. Kosong = baris email disembunyikan. */
  email: '',
  /** TODO: nomor WhatsApp format internasional tanpa "+" / spasi, mis. "62812xxxxxxx". */
  whatsapp: '',
  /** TODO: URL profil GitHub. Kosong = link disembunyikan. */
  github: '',
  location: 'Indonesia',
  /** Baris "bagian dari ekosistem …" di bawah footer. TODO: isi nama + URL induk, kosong = disembunyikan. */
  ecosystem: { name: '', href: '' },
  /** Tahun berdiri untuk copyright (TODO bila perlu rentang). */
  since: 2026,
  /**
   * Angka statistik. Hitungan demo/studi kasus diturunkan dari isi portofolio di repo ini.
   * TODO: konfirmasi `enterpriseProjects` (belum ada data dari GAMADA → sementara = jumlah studi kasus).
   */
  stats: {
    pagesAndDemos: 13,
    mobileApps: 4,
    enterpriseProjects: 3,
    responseHours: 24,
    webDemos: 6,
    caseStudies: 3,
  },
  /** URL backend asli (opsional). Kosong = UI demo memakai fixture lokal. */
  backends: {
    scrappulse: '',
    phonefarm: '',
    tools: '',
  },
} as const

/** wa.me link with prefilled text. Without a number WhatsApp opens its contact picker. */
export function waLink(text: string): string {
  const num = SITE.whatsapp.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}
