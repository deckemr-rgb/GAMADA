/**
 * Self-test for the recorder's rule-based minutes (no framework): `npx tsx src/demos/naskah-pintar/__tests__/recorder.selftest.ts`
 * 1. The product's own "Isi contoh" transcripts (ID + EN) → 1 decision + 3 follow-ups.
 * 2. Everyday wording: "paling lambat Kamis" on Tuesday 17 Nov 2026 → Thursday 19 Nov; "minggu ini" → Friday 16.00;
 *    a leading "kalau begitu" is not part of the task; "Dinsos lengkapi …" is a task.
 * 3. parseDue reads every label dueLabel writes.
 */
import { extractFromText } from '../scenario'
import { dueLabel, parseDue } from '../due'

const SAMPLE_ID =
  'Selamat siang, rapat pengendalian inflasi kita mulai. Harga beras naik tiga persen minggu ini. Keputusan rapat: operasi pasar beras digelar di Pasar Kota. Disperindag siapkan operasi pasar besok pukul sepuluh. Dinas Pertanian laporkan stok gabah petani paling lambat lusa. Diskominfo siarkan jadwal operasi pasar hari ini.'
const SAMPLE_EN =
  'Good afternoon, let us open the inflation control meeting. Rice prices rose three percent this week. Decision: a rice market operation is held at the city market. Trade prepares the market operation tomorrow at ten. Agriculture reports farmers’ grain stocks within two days. Communications broadcasts the market operation schedule today.'
const PASTE =
  'Kadis PUPR: pompa kami tinggal enam. Sekda: kalau begitu Dinas PUPR koordinasikan dengan BPBD untuk distribusi pompa ke Trucuk paling lambat Kamis. Kadinsos: data bansos belum lengkap. Sekda: Dinsos lengkapi data bansos minggu ini.'

const DAY = '2026-11-17' // Tuesday
const NOW = 7 * 60
let fails = 0
const ok = (cond: boolean, msg: string) => {
  if (!cond) fails++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`)
}

const id = extractFromText(SAMPLE_ID, 'id', NOW, DAY)
ok(id.decisions.length === 1 && /operasi pasar/i.test(id.decisions[0] ?? ''), `ID sample: 1 decision (${JSON.stringify(id.decisions)})`)
ok(id.actionItems.length === 3, `ID sample: 3 follow-ups (${id.actionItems.map((a) => `${a.owner}: ${a.task} @ ${a.due}`).join(' | ')})`)
ok(id.actionItems[0]?.due === 'Besok 10.00', `ID sample: Disperindag due "Besok 10.00" (${id.actionItems[0]?.due})`)

const en = extractFromText(SAMPLE_EN, 'en', NOW, DAY)
ok(en.decisions.length === 1, `EN sample: 1 decision (${JSON.stringify(en.decisions)})`)
ok(en.actionItems.length === 3, `EN sample: 3 follow-ups (${en.actionItems.map((a) => `${a.owner}: ${a.task} @ ${a.due}`).join(' | ')})`)

const p = extractFromText(PASTE, 'id', NOW, DAY)
const pupr = p.actionItems.find((a) => a.owner === 'Dinas PUPR')
const dinsos = p.actionItems.find((a) => a.owner === 'Dinsos')
ok(!!pupr && pupr.due.includes('19 Nov'), `"paling lambat Kamis" → 19 Nov (${pupr?.due})`)
ok(!!pupr && /^Dinas PUPR koordinasikan/.test(pupr.task), `filler "kalau begitu" stripped (${pupr?.task})`)
ok(!!dinsos && dinsos.due.includes('20 Nov') && dinsos.due.endsWith('16.00'), `"Dinsos lengkapi … minggu ini" → Fri 20 Nov 16.00 (${dinsos?.due})`)

for (const at of [NOW + 30, 16 * 60, 1440 + 12 * 60, 2 * 1440 + 16 * 60, 3 * 1440 + 9 * 60]) {
  for (const lang of ['id', 'en'] as const) {
    const label = dueLabel(at, lang, DAY)
    ok(parseDue(label, NOW, DAY) === at, `round trip ${lang} ${label}`)
  }
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exit(fails ? 1 : 0)
