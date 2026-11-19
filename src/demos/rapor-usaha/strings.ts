/**
 * demos/rapor-usaha/strings.ts — strings of the always-loaded part (frame, tabs, roles, mirror panels). Each lazy
 * chunk keeps its own strings in its file. Templated strings are functions so the numbers stay in one place.
 */
import { useI18n } from '../../lib/i18n'
import type { BankTab, Lang, OwnerTab } from './model'

const id = {
  product: 'Rapor Usaha',
  tabsLabel: 'Bagian Rapor Usaha',
  owner: { rapor: 'Skor usaha', modal: 'Modal kerja', berbagi: 'Berbagi data' } as Record<OwnerTab, string>,
  bank: { antrian: 'Antrian pengajuan', riwayat: 'Riwayat' } as Record<BankTab, string>,
  ask: 'Tanya skor',
  loading: 'Memuat…',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
  bankFrame: (lender: string) => `${lender} · analis kredit`,
  mirrorBank: 'Sisi Bank/Koperasi',
  mirrorOwner: 'Sisi Pemilik Usaha',
  mirrorNone: 'Belum ada pengajuan modal dari toko ini.',
  mirrorRead: 'Tampilan baca saja (simulasi)',
  openBank: 'Buka sebagai Koperasi',
  openOwner: 'Buka sebagai Pemilik Usaha',
  step: { diajukan: 'Menunggu tinjauan analis', disetujui: 'Disetujui', ditolak: 'Ditolak' } as Record<string, string>,
  amount: 'Diajukan',
  decided: 'Diputus',
  tenor: (n: number) => `${n} bulan`,
  switched: (who: string) => `Sekarang Anda melihat Rapor Usaha sebagai ${who}.`,
  roleOwner: 'Pemilik Usaha',
  roleBank: 'analis kredit koperasi',
}
const en: typeof id = {
  product: 'Rapor Usaha',
  tabsLabel: 'Rapor Usaha sections',
  owner: { rapor: 'Business score', modal: 'Working capital', berbagi: 'Data sharing' },
  bank: { antrian: 'Application queue', riwayat: 'History' },
  ask: 'Ask about the score',
  loading: 'Loading…',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
  bankFrame: (lender: string) => `${lender} · credit analyst`,
  mirrorBank: 'Bank/cooperative side',
  mirrorOwner: 'Business owner side',
  mirrorNone: 'No working-capital application from this shop yet.',
  mirrorRead: 'Read-only view (simulated)',
  openBank: 'Open as the cooperative',
  openOwner: 'Open as the business owner',
  step: { diajukan: 'Waiting for the analyst', disetujui: 'Approved', ditolak: 'Declined' },
  amount: 'Requested',
  decided: 'Decided',
  tenor: (n: number) => `${n} months`,
  switched: (who: string) => `You now see Rapor Usaha as the ${who}.`,
  roleOwner: 'business owner',
  roleBank: 'cooperative credit analyst',
}
export type Strings = typeof id
export const STR: Record<Lang, Strings> = { id, en }
export function useT(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  const l: Lang = lang === 'en' ? 'en' : 'id'
  return { t: STR[l], lang: l }
}
