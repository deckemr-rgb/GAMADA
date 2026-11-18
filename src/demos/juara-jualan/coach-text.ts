/**
 * demos/juara-jualan/coach-text.ts — the coaching card pool (lazy: Coaching, AssignDialog, Tanya QA): per criterion one
 * focus title and two example sentences with the agent's own name / organisation. Different wording from the seeded
 * cards, so no sentence repeats on the Coaching board; the variant follows the agent (hash).
 */
import { hashString, type Bi, type CriterionKey, type SalesAgent } from '../../demo-kit/world'

const POOL: Record<CriterionKey, { focus: Bi; ex: [Bi, Bi] }> = {
  salam: {
    focus: { id: 'Sapa, sebut nama dan tempat kerja di kalimat pertama', en: 'Greet and give your name and workplace in the first sentence' },
    ex: [
      { id: '“Selamat siang, saya {agent} dari {org}; boleh saya bantu cek kebutuhannya?”', en: '“Good afternoon, this is {agent} from {org}; may I help check what you need?”' },
      { id: '“Halo, dengan {agent} dari {org}, terima kasih sudah menghubungi kami.”', en: '“Hello, {agent} from {org} speaking, thank you for contacting us.”' },
    ],
  },
  gali: {
    focus: { id: 'Ajukan dua pertanyaan terbuka sebelum menyebut produk', en: 'Ask two open questions before naming a product' },
    ex: [
      { id: '“Untuk keperluan apa, dan kapan paling lambat dibutuhkan?”', en: '“What is it for, and by when do you need it at the latest?”' },
      { id: '“Sebelumnya pernah pakai yang seperti apa, dan apa yang kurang cocok?”', en: '“What have you used before, and what did not suit you?”' },
    ],
  },
  keberatan: {
    focus: { id: 'Akui keberatan, lalu jawab dengan nilai, bukan diskon', en: 'Acknowledge the objection, then answer with value, not a discount' },
    ex: [
      { id: '“Wajar kalau dibandingkan; bedanya, di {org} barang diantar dan bisa ditukar.”', en: '“It is fair to compare; the difference is that at {org} we deliver and you can swap items.”' },
      { id: '“Saya paham soal biayanya; yang Anda dapat: proses cepat dan semua biaya tertulis.”', en: '“I understand the cost concern; what you get is a fast process and every cost in writing.”' },
    ],
  },
  penawaran: {
    focus: { id: 'Sebut satu pilihan lengkap: produk, angka, dan waktu', en: 'Name one complete option: product, figure and timing' },
    ex: [
      { id: '“Saran saya satu paket ini: jumlahnya sekian, harganya sekian, bisa dikirim Kamis.”', en: '“My suggestion is this one package: this quantity, this price, delivered on Thursday.”' },
      { id: '“Yang paling pas untuk Anda: angsuran tetap per bulan, tenor jelas, tanpa biaya tambahan.”', en: '“The best fit for you: a fixed monthly instalment, a clear tenor, no extra charges.”' },
    ],
  },
  closing: {
    focus: { id: 'Tutup dengan satu langkah berikutnya yang pasti', en: 'Close with one definite next step' },
    ex: [
      { id: '“Saya catat pesanannya sekarang dan diantar besok pagi, setuju?”', en: '“I will note the order now and deliver it tomorrow morning, agreed?”' },
      { id: '“Boleh saya jadwalkan Kamis jam 10 untuk tanda tangan?”', en: '“May I book Thursday at 10 for the signing?”' },
    ],
  },
  kepatuhan: {
    focus: { id: 'Jangan menjanjikan hasil; sebut syarat dengan jujur', en: 'Never promise outcomes; state the conditions honestly' },
    ex: [
      { id: '“Keputusannya ada di tim analis; yang bisa saya pastikan, berkasnya lengkap hari ini.”', en: '“The analysts decide; what I can make sure of is that your file is complete today.”' },
      { id: '“Garansinya sesuai ketentuan pabrik; syaratnya saya kirim tertulis.”', en: '“The warranty follows the factory terms; I will send the conditions in writing.”' },
    ],
  },
}

export const focusOf = (k: CriterionKey): Bi => POOL[k].focus
/** the example sentence of a criterion for this agent (variant by agent, slots filled) */
export function exampleOf(k: CriterionKey, agent: Pick<SalesAgent, 'id' | 'name' | 'org'>): Bi {
  const v = POOL[k].ex[hashString(`${agent.id}|${k}`) % 2]!
  const first = agent.name.split(' ')[0] ?? agent.name
  const org = agent.org.split(' · ')[0] ?? agent.org
  const f = (s: string) => s.replace('{agent}', first).replace('{org}', org)
  return { id: f(v.id), en: f(v.en) }
}
