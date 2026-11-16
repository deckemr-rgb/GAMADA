/**
 * faq.ts — the shared FAQ entries (home preview + the /faq page), ID + EN.
 * Ids are stable (deep links: /faq#biaya). Answers are plain strings so /faq search can highlight
 * them; paragraphs are separate strings. No prices or durations are invented here: estimates are
 * written after the free consultation, numbers come from SITE.
 */
import type { Lang } from '../lib/i18n'
import { SITE } from './site'

export type FaqId = 'beda' | 'biaya' | 'teknis' | 'purnajual' | 'keamanan-data'

export interface FaqEntry {
  id: FaqId
  q: string
  /** One string per paragraph. */
  a: string[]
}

const H = SITE.stats.responseHours

const FAQ: Record<Lang, FaqEntry[]> = {
  id: [
    {
      id: 'beda',
      q: 'Bedanya dengan agensi lain?',
      a: [
        'Kami studio kecil yang menulis kodenya sendiri. Orang yang Anda ajak ngobrol di awal adalah orang yang ikut membangun produknya, jadi tidak ada pesan yang hilang di tengah jalan.',
        'Setiap minggu Anda bisa mencoba versi terbarunya langsung di browser atau di HP, bukan sekadar membaca laporan. Banyak contoh karya kami juga bisa dicoba sekarang di halaman Karya.',
      ],
    },
    {
      id: 'biaya',
      q: 'Berapa biaya & berapa lama?',
      a: [
        'Tergantung lingkup: landing page sederhana jelas berbeda dengan sistem kasir yang terhubung ke gudang. Karena itu kami tidak memasang harga paket.',
        'Setelah konsultasi gratis, Anda menerima estimasi biaya dan jadwal secara tertulis, lengkap dengan rincian fitur dan tahapan pembayarannya. Kalau anggaran terbatas, kami bantu memilah fitur mana yang perlu ada di versi pertama.',
      ],
    },
    {
      id: 'teknis',
      q: 'Aku nggak ngerti teknis, gimana?',
      a: [
        'Tidak masalah, justru itu tugas kami. Ceritakan saja cara bisnis Anda berjalan hari ini dan bagian mana yang paling merepotkan; kami yang menerjemahkannya jadi fitur.',
        'Selama pengerjaan kami memakai bahasa sehari-hari, menunjukkan demo yang bisa diklik, dan menyiapkan panduan singkat serta pendampingan saat sistem mulai dipakai tim Anda.',
      ],
    },
    {
      id: 'purnajual',
      q: 'Setelah launching masih dibantuin?',
      a: [
        'Masih. Ada garansi perbaikan bug setelah launch; durasinya dituliskan di penawaran supaya jelas sejak awal.',
        `Setelah masa garansi, Anda bisa lanjut dengan paket perawatan (pembaruan, pemantauan, fitur kecil) atau memanggil kami per kebutuhan. Pertanyaan lewat WhatsApp kami balas paling lambat ${H} jam.`,
      ],
    },
    {
      id: 'keamanan-data',
      q: 'Data & akses aman nggak?',
      a: [
        'Data dan akun tetap milik Anda. Kode sumber, domain, dan akses server diserahkan ke Anda di akhir proyek, dan kami hanya meminta akses yang memang diperlukan selama pengerjaan.',
        'Kami menerapkan praktik dasar yang wajib: koneksi HTTPS, kata sandi yang di-hash, pembagian hak akses per peran, serta cadangan data rutin. Kebutuhan khusus seperti audit atau perjanjian kerahasiaan (NDA) bisa dibahas saat konsultasi.',
      ],
    },
  ],
  en: [
    {
      id: 'beda',
      q: 'How are you different from other agencies?',
      a: [
        'We are a small studio that writes its own code. The people you talk to on day one are the people who build your product, so nothing gets lost between a sales team and a dev team.',
        'Every week you can try the latest version in your browser or on your phone instead of just reading a report. Plenty of our work can already be tried on the Work page.',
      ],
    },
    {
      id: 'biaya',
      q: 'How much does it cost, and how long does it take?',
      a: [
        'It depends on the scope: a simple landing page is a very different job from a point-of-sale system wired to a warehouse. That is why we do not publish package prices.',
        'After the free consultation you get a written estimate of cost and timeline, with the feature list and payment milestones spelled out. If the budget is tight, we help you decide what belongs in the first version.',
      ],
    },
    {
      id: 'teknis',
      q: "I'm not technical. Is that a problem?",
      a: [
        'Not at all, that part is our job. Tell us how your business runs today and what slows you down; we turn that into features.',
        'Throughout the project we speak plain language, show clickable demos, and prepare a short guide plus hands-on help when your team starts using the system.',
      ],
    },
    {
      id: 'purnajual',
      q: 'Do you still help after launch?',
      a: [
        'Yes. Every project comes with a bug-fix warranty after launch; its length is written into the proposal so it is clear from the start.',
        `After the warranty you can continue with a maintenance plan (updates, monitoring, small features) or call us in when you need us. We answer WhatsApp messages within ${H} hours at the latest.`,
      ],
    },
    {
      id: 'keamanan-data',
      q: 'Are my data and accounts safe?',
      a: [
        'Your data and accounts stay yours. Source code, domain and server access are handed over to you at the end of the project, and we only ask for the access we actually need while we work.',
        'We apply the essential practices: HTTPS everywhere, hashed passwords, role-based permissions and regular backups. Special requirements such as an audit or a non-disclosure agreement can be discussed in the consultation.',
      ],
    },
  ],
}

/** All FAQ entries in one language, in display order. */
export function faqFor(lang: Lang): FaqEntry[] {
  return FAQ[lang]
}

/** One entry by id. */
export function faqEntry(lang: Lang, id: FaqId): FaqEntry | undefined {
  return FAQ[lang].find((e) => e.id === id)
}
