/**
 * world/up/coa.ts — the shop's chart of accounts (Pajak Beres "detail akuntansi"). Account strings in the ledger are
 * the `name.id` values; `code` is a simple 4-digit scheme (1 aset, 2 kewajiban, 3 modal, 4 pendapatan, 5–6 beban).
 */
import type { Bi } from '../types'
import { ACCOUNT } from './labels'

export type AccountGroup = 'aset' | 'kewajiban' | 'modal' | 'pendapatan' | 'beban'
export interface CoaRow { code: string; account: string; name: Bi; group: AccountGroup; normal: 'D' | 'C' }

const row = (code: string, account: string, group: AccountGroup): CoaRow => ({ code, account, name: ACCOUNT[account] ?? { id: account, en: account }, group, normal: group === 'aset' || group === 'beban' || account === 'Prive' ? 'D' : 'C' })

export const COA: readonly CoaRow[] = [
  row('1101', 'Kas', 'aset'), row('1102', 'Bank', 'aset'), row('1301', 'Persediaan', 'aset'),
  row('2101', 'Utang Usaha', 'kewajiban'), row('2201', 'Utang PPh 21', 'kewajiban'), row('2202', 'Utang PPh Final', 'kewajiban'),
  row('3101', 'Modal Pemilik', 'modal'), row('3201', 'Prive', 'modal'),
  row('4101', 'Pendapatan Penjualan', 'pendapatan'), row('4201', 'Pendapatan Lain-lain', 'pendapatan'), row('4202', 'Pendapatan Bunga', 'pendapatan'),
  row('5101', 'HPP', 'beban'), row('6101', 'Beban Gaji', 'beban'), row('6102', 'Beban Listrik & Air', 'beban'), row('6103', 'Beban Sewa', 'beban'),
  row('6104', 'Beban Bahan Bakar', 'beban'), row('6105', 'Beban Admin Bank', 'beban'), row('6106', 'Beban Pajak', 'beban'), row('6199', 'Beban Lain-lain', 'beban'),
]
export const coaOf = (account: string): CoaRow => COA.find((c) => c.account === account) ?? row('9999', account, account.startsWith('Beban') ? 'beban' : account.startsWith('Pendapatan') ? 'pendapatan' : 'aset')
