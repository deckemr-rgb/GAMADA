/**
 * demos/inti/strings.ts — the strings of the always-loaded part (frame, rail, Inti Data). Each lazy module keeps its
 * own strings in its file. Templated strings are functions so the numbers stay in one place.
 */
import { useI18n } from '../../lib/i18n'
import type { TabId } from './model'

export type Lang = 'id' | 'en'

const id = {
  product: 'GAMADA Inti',
  railLabel: 'Modul GAMADA Inti',
  tabs: { data: 'Inti Data', id: 'Inti ID', agen: 'Inti Agen', kanal: 'Inti Kanal', audit: 'Audit Log' } as Record<TabId, string>,
  tabSub: { data: 'Jejak data', id: 'Peran & akses', agen: 'Jejak berpikir', kanal: 'Kotak masuk', audit: 'Setiap kejadian' } as Record<TabId, string>,
  loading: 'Memuat…',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
  sim: 'simulasi',
  // KPI
  kpiLabel: 'Ringkasan platform hari ini (simulasi)',
  kpiProducts: 'Produk aktif',
  kpiRoles: 'Peran',
  kpiEvents: 'Kejadian hari ini',
  kpiUnread: 'Pesan belum dibaca',
  kpiAgents: 'Agen berjalan (sesi ini)',
  // pulse
  pulseTitle: 'Denyut platform',
  pulseCount: (n: number) => `Kejadian hari ini: ${n.toLocaleString('id-ID')}`,
  pulseAria: (n: number, top: string) => `Denyut platform: ${n} kejadian hari ini${top ? `; paling aktif ${top}` : ''}.`,
  ecoShort: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah', inti: 'Inti' } as Record<string, string>,
  // trail
  trailTitle: 'Jejak data lintas produk',
  trailLead: 'Pilih satu entitas, lalu lihat perjalanannya melintasi 6 produk. Setiap simpul adalah satu baris Audit Log.',
  rootLabel: 'Pilih entitas awal',
  roots: { siti: 'Aduan Ibu Siti', flood: 'Peringatan banjir', pump: 'Paket pompa darurat', tender: 'Tender karung–terpal', shop: (n: string) => (/^toko /i.test(n) ? n : `Toko ${n}`) },
  rootWhy: {
    siti: 'Belum ada aduan Ibu Siti hari ini',
    flood: 'Belum ada peringatan banjir',
    pump: 'Belum ada paket pompa darurat',
    tender: 'Belum ada tender karung–terpal',
    shop: 'Toko belum ada di dunia ini',
  },
  play: 'Putar jejak aduan Ibu Siti (versi cepat · simulasi)',
  playing: 'Memutar jejak…',
  playNote: 'Mengubah dunia bersama: peringatan banjir, aduan, dan instruksi muncul di semua produk di peramban ini. Tombol Reset di atas membatalkannya.',
  emptyTitle: 'Belum ada jejak hari ini',
  emptyBody: 'Aduan Ibu Siti belum masuk. Putar versi cepatnya: banjir, aduan, klaster, instruksi, surat, pengadaan, dan UMKM lokal menyala berurutan.',
  laneOff: 'belum ada',
  laneHidden: 'tidak tampil',
  laneMore: (n: number) => `+${n} kejadian lain`,
  laneAria: (i: number, name: string, state: string, text: string) => `Langkah ${i}: ${name}. ${state}${text ? `. ${text}` : ''}`,
  laneLit: (name: string, text: string) => `${name} menyala: ${text}`,
  stepsLabel: 'Langkah jejak data',
  complete: (n: number) => `Jejak lengkap: ${n} dari 6 produk menyala`,
  partial: (n: number) => `${n} dari 6 produk menyala`,
  branches: 'Cabang di produk lain',
  scopeNote: 'Data pemda tidak tampil untuk peran ini (contoh pembatasan akses)',
  activity: { id: 'Aktivitas lintas produk', en: 'Cross-product activity' },
  activityEmpty: { id: 'Belum ada kejadian hari ini.', en: 'No events yet today.' },
}
type Strings = { [K in keyof typeof id]: (typeof id)[K] extends (...a: infer A) => string ? (...a: A) => string : (typeof id)[K] }

const en: Strings = {
  product: 'GAMADA Inti',
  railLabel: 'GAMADA Inti modules',
  tabs: { data: 'Inti Data', id: 'Inti ID', agen: 'Inti Agents', kanal: 'Inti Channels', audit: 'Audit Log' },
  tabSub: { data: 'Data trail', id: 'Roles & access', agen: 'Reasoning trace', kanal: 'Inbox', audit: 'Every event' },
  loading: 'Loading…',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
  sim: 'simulated',
  kpiLabel: 'Platform summary today (simulated)',
  kpiProducts: 'Active products',
  kpiRoles: 'Roles',
  kpiEvents: 'Events today',
  kpiUnread: 'Unread messages',
  kpiAgents: 'Agent runs (this session)',
  pulseTitle: 'Platform pulse',
  pulseCount: (n: number) => `Events today: ${n.toLocaleString('en-GB')}`,
  pulseAria: (n: number, top: string) => `Platform pulse: ${n} events today${top ? `; most active ${top}` : ''}.`,
  ecoShort: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah', inti: 'Inti' },
  trailTitle: 'Cross-product data trail',
  trailLead: 'Pick one entity and follow its journey across 6 products. Every node is one Audit Log row.',
  rootLabel: 'Pick the starting entity',
  roots: { siti: 'Ibu Siti’s complaint', flood: 'Flood warning', pump: 'Emergency pump package', tender: 'Sandbag–tarpaulin tender', shop: (n: string) => (/^toko /i.test(n) ? n : `Shop ${n}`) },
  rootWhy: {
    siti: 'No complaint from Ibu Siti today yet',
    flood: 'No flood warning yet',
    pump: 'No emergency pump package yet',
    tender: 'No sandbag–tarpaulin tender yet',
    shop: 'The shop does not exist in this world',
  },
  play: 'Play the trail of Ibu Siti’s complaint (quick version · simulated)',
  playing: 'Playing the trail…',
  playNote: 'Changes the shared world: the flood warning, complaints and instruction appear in every product in this browser. Reset at the top undoes it.',
  emptyTitle: 'No trail today yet',
  emptyBody: 'Ibu Siti’s complaint has not come in. Play the quick version: flood, complaint, cluster, instruction, letter, procurement and local SMEs light up in order.',
  laneOff: 'not yet',
  laneHidden: 'hidden',
  laneMore: (n: number) => `+${n} more events`,
  laneAria: (i: number, name: string, state: string, text: string) => `Step ${i}: ${name}. ${state}${text ? `. ${text}` : ''}`,
  laneLit: (name: string, text: string) => `${name} lit: ${text}`,
  stepsLabel: 'Data trail steps',
  complete: (n: number) => `Trail complete: ${n} of 6 products lit`,
  partial: (n: number) => `${n} of 6 products lit`,
  branches: 'Branches in other products',
  scopeNote: 'Government data is not shown for this role (an example of access limits)',
  activity: { id: 'Aktivitas lintas produk', en: 'Cross-product activity' },
  activityEmpty: { id: 'Belum ada kejadian hari ini.', en: 'No events yet today.' },
}

export const STRINGS: Record<Lang, Strings> = { id, en }
export function useT(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STRINGS[lang], lang }
}
/** "07.05" in Indonesian, "07:05" in English */
export const tm = (hhmm: string, lang: Lang) => (lang === 'id' ? hhmm.replace(':', '.') : hhmm.replace('.', ':'))
