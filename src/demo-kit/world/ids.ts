/**
 * world/ids.ts — readable, sequential ids per table (deterministic per world).
 * The counters live in `WorldState.meta.seq` so ids keep counting after reload / import.
 */
import type { TableKey } from './types'
import { pad } from './util'

export const ID_PREFIX: Record<TableKey, string> = {
  citizens: 'WG', complaints: 'SW', tickets: 'TK', clusters: 'KL', bookings: 'AN', briefings: 'BR', instructions: 'IN',
  letters: 'SR', meetings: 'RP', actionItems: 'TL', mentions: 'MN', hoaxAlerts: 'HX', alerts: 'PW', rainCells: 'HJ',
  programs: 'PG', procurements: 'PK', bidders: 'PS', documents: 'DK', verifications: 'VF', businesses: 'UM', outlets: 'OT',
  products: 'SKU', sales: 'TR', salesDaily: 'SD', stock: 'ST', purchaseOrders: 'PO', suppliers: 'SP', ledger: 'JR',
  taxItems: 'PJ', calls: 'CL', chats: 'CH', agentsSales: 'AG', coachings: 'CO', candidates: 'KD', brandMentions: 'BM',
  tenders: 'TD', bids: 'BD', catalogNeeds: 'KB', matches: 'MC', orders: 'OR', bizScores: 'RU', loanApps: 'LN',
  econIndex: 'EI', prices: 'HG', markets: 'PSR', marketOps: 'OP', auditLog: 'AU',
}

export type Seq = Record<string, number>

/** next id for a table, advancing the counter (mutates `seq`) */
export function nextId(seq: Seq, table: TableKey, year?: string): string {
  const n = (seq[table] ?? 0) + 1
  seq[table] = n
  return formatId(table, n, year)
}

export function formatId(table: TableKey, n: number, year?: string): string {
  const p = ID_PREFIX[table]
  // complaints follow the spec's ticket number format SW-YYYY-####
  if (table === 'complaints') return `${p}-${year ?? '0000'}-${pad(n, 4)}`
  return `${p}-${pad(n, 4)}`
}

/** next event id E000001 … (mutates `seq`) */
export function nextEventId(seq: Seq): string {
  const n = (seq.event ?? 0) + 1
  seq.event = n
  return `E${pad(n, 6)}`
}
