/**
 * demos/_placeholder/strings.ts — module-local copy of the interim preview panel ("Yang akan bisa Anda coba").
 * Lives here, not in demo-kit/i18n, so only placeholder pages download it. Times in running text follow each
 * language's convention (ID "09.15", EN "09:15"); the clock readout keeps the shell's "09:15 WIB".
 */
import type { Lang } from '../../lib/i18n'

const id = {
  kicker: 'Pratinjau',
  title: 'Yang akan bisa Anda coba',
  lead: (n: number) =>
    `Begitu demo ini siap di tahap ${n}, halaman yang sama langsung berisi sandbox-nya, dengan kontrol peran, jam, dan AI di bilah atas. Sampai saat itu kontrol itu sengaja tidak dipasang, karena belum ada yang bisa digerakkan.`,
  rolesTitle: 'Ganti peran',
  rolesBody: (n: number) => (n > 1 ? `Satu akun, ${n} peran. Setiap peran melihat layar dan data yang berbeda.` : 'Demo ini dilihat dari satu peran.'),
  roleFromLink: (r: string) => `Tautan ini membuka peran ${r}.`,
  roleDefault: (r: string) => `Peran awal: ${r}.`,
  roleLater: 'Pemilih peran hadir bersama demo.',
  roleCurrent: 'peran saat ini',
  clockTitle: 'Jam dunia',
  clockBody: (region: string) =>
    `Satu hari simulasi di ${region}. Jam bisa dijalankan ×1, ×10, atau ×60, dijeda, dan dilompatkan ke momen penting. Kejadian di dunia demo mengikuti jam ini.`,
  clockFromLink: (t: string) => `Tautan ini membuka pukul ${t}.`,
  clockDefault: (t: string) => `Hari demo dimulai pukul ${t}.`,
  clockStill: 'Di pratinjau ini jam belum berjalan.',
  clockJumps: (list: string) => `Lompat ke ${list}`,
  clockReadout: (t: string) => `Jam dunia di tautan ini: ${t} WIB`,
  aiTitle: 'Mode AI',
  aiSim: 'Simulasi',
  aiSimWhen: 'sekarang',
  aiSimBody: 'Jawaban AI disusun di browser dari skenario yang sudah disiapkan: cepat, tanpa server, tanpa biaya.',
  aiLive: 'Live',
  aiLiveWhen: 'menyusul',
  aiLiveBody: 'Model AI sungguhan lewat server proxy GAMADA, setelah server AI disiapkan. Jika server tidak menjawab, demo kembali ke Simulasi.',
  aiFromLink: 'Tautan ini meminta Live. Sampai demo siap, semuanya berjalan dengan Simulasi.',
  tourTitle: (region: string) => `Di tur “Satu Hari di ${region}”`,
  statusTitle: 'Status demo',
  statusPill: (n: number) => `Direncanakan · tahap ${n}`,
  stage: (n: number) => `Tahap ${n}`,
  stageDemos: (k: number) => `${k} demo`,
  stageTour: 'Tur sinematik',
  thisDemo: 'demo ini',
  ready: (a: number, b: number) => (a === 0 ? `Belum ada demo tahap ini yang terbit (0 dari ${b}).` : `${a} dari ${b} demo tahap ini sudah bisa dicoba.`),
}

type Dict = { [K in keyof typeof id]: (typeof id)[K] extends (...a: infer A) => string ? (...a: A) => string : string }

const en: Dict = {
  kicker: 'Preview',
  title: 'What you will be able to try',
  lead: (n: number) =>
    `Once this demo is ready in stage ${n}, this same page holds its sandbox, with role, clock and AI controls in the top bar. Until then those controls are left out on purpose, because there is nothing for them to move yet.`,
  rolesTitle: 'Switch roles',
  rolesBody: (n: number) => (n > 1 ? `One account, ${n} roles. Each role sees its own screens and data.` : 'This demo is seen from one role.'),
  roleFromLink: (r: string) => `This link opens as ${r}.`,
  roleDefault: (r: string) => `Starting role: ${r}.`,
  roleLater: 'The role picker arrives with the demo.',
  roleCurrent: 'current role',
  clockTitle: 'World clock',
  clockBody: (region: string) =>
    `One simulated day in ${region}. The clock runs at ×1, ×10 or ×60, pauses, and jumps to key moments. Events in the demo world follow it.`,
  clockFromLink: (t: string) => `This link opens at ${t}.`,
  clockDefault: (t: string) => `The demo day starts at ${t}.`,
  clockStill: 'The clock does not run in this preview.',
  clockJumps: (list: string) => `Jump to ${list}`,
  clockReadout: (t: string) => `World clock in this link: ${t} WIB`,
  aiTitle: 'AI mode',
  aiSim: 'Simulation',
  aiSimWhen: 'now',
  aiSimBody: 'AI answers are built in the browser from prepared scenarios: fast, no server, no cost.',
  aiLive: 'Live',
  aiLiveWhen: 'later',
  aiLiveBody: 'A real AI model through the GAMADA proxy server, once the AI server is set up. If the server does not answer, the demo falls back to Simulation.',
  aiFromLink: 'This link asks for Live. Until the demo is ready, everything runs in Simulation.',
  tourTitle: (region: string) => `In the tour “A Day in ${region}”`,
  statusTitle: 'Demo status',
  statusPill: (n: number) => `Planned · stage ${n}`,
  stage: (n: number) => `Stage ${n}`,
  stageDemos: (k: number) => `${k} demos`,
  stageTour: 'Cinematic tour',
  thisDemo: 'this demo',
  ready: (a: number, b: number) => (a === 0 ? `No demo from this stage is out yet (0 of ${b}).` : `${a} of ${b} demos in this stage can be tried now.`),
}

export const PREVIEW: Record<Lang, Dict> = { id, en }

/** "09:15" → "09.15" in Indonesian running text; unchanged in English. */
export const proseTime = (hhmm: string, lang: Lang): string => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)
