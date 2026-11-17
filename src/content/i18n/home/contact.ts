/** Home section copy: contact (ID). The English copy lives in ./contact.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape. */
const id = {
  eyebrow: 'Mulai dari obrolan',
  title: 'Punya ide? Ngobrol dulu, gratis.',
  lead: 'Ceritakan apa yang ingin Anda bangun atau rapikan. Kami bantu memetakan langkah pertamanya, tanpa istilah teknis dan tanpa kewajiban.',
  waCta: 'Chat via WhatsApp',
  waPrefill: 'Halo GAMADA, saya punya ide dan mau ngobrol dulu soal project.',
  emailLabel: 'atau kirim email ke',
  points: {
    free: 'Konsultasi pertama gratis',
    reply: (h: number) => `Kami balas maksimal ${h} jam`,
    estimate: 'Estimasi biaya & jadwal tertulis',
  },
  form: {
    title: 'Atau isi formulir singkat',
    note: 'Formulir ini tidak menyimpan data apa pun. Setelah dikirim, pesan Anda terbuka di WhatsApp dan tinggal ditekan kirim.',
    name: 'Nama',
    namePh: 'Nama Anda',
    need: 'Kebutuhan',
    needPh: 'Pilih salah satu',
    needs: ['Website & Web App', 'Aplikasi Mobile', 'Machine Learning & AI', 'POS & Sistem Bisnis', 'Lainnya'],
    message: 'Pesan',
    messagePh: 'Ceritakan singkat ide atau masalah yang ingin diselesaikan…',
    submit: 'Kirim lewat WhatsApp',
    errors: {
      name: 'Boleh tahu nama Anda? Minimal 2 huruf.',
      need: 'Pilih kebutuhan yang paling mendekati, atau "Lainnya".',
      message: 'Ceritakan sedikit lagi, minimal 10 karakter, supaya kami bisa langsung menyiapkan jawaban.',
    },
    successTitle: 'Tinggal satu langkah lagi.',
    successBody: 'WhatsApp terbuka di tab baru dengan pesan yang sudah terisi otomatis. Tekan kirim di sana, dan kami balas secepatnya. Kalau tab-nya tidak muncul, pakai tombol di bawah.',
    successRetry: 'Buka WhatsApp',
    successAgain: 'Tulis pesan lain',
    newTab: '(tab baru)',
    compose: (name: string, need: string, message: string) =>
      `Halo GAMADA, saya ${name}.\nKebutuhan: ${need}\n\n${message}`,
  },
}

export const contact = id
