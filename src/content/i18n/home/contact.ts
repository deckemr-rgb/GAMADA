/** Home section copy: contact (ID + EN). `en` must have exactly the shape of `id`. */
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

const en: typeof id = {
  eyebrow: 'Start with a conversation',
  title: "Got an idea? Let's talk, it's free.",
  lead: "Tell us what you want to build or tidy up. We'll help you map the first step, with no jargon and no commitment.",
  waCta: 'Chat on WhatsApp',
  waPrefill: "Hi GAMADA, I have an idea and I'd like to talk about a project.",
  emailLabel: 'or email us at',
  points: {
    free: 'Free first consultation',
    reply: (h: number) => `We reply within ${h} hours`,
    estimate: 'Written cost & timeline estimate',
  },
  form: {
    title: 'Or fill in a short form',
    note: 'This form stores nothing. When you send it, your message opens in WhatsApp, ready for you to hit send.',
    name: 'Name',
    namePh: 'Your name',
    need: 'What do you need?',
    needPh: 'Choose one',
    needs: ['Website & Web App', 'Mobile App', 'Machine Learning & AI', 'POS & Business Systems', 'Something else'],
    message: 'Message',
    messagePh: 'Briefly describe your idea or the problem you want solved…',
    submit: 'Send via WhatsApp',
    errors: {
      name: 'May we have your name? At least 2 letters.',
      need: 'Pick the closest option, or "Something else".',
      message: 'Tell us a little more, at least 10 characters, so we can prepare a useful reply.',
    },
    successTitle: 'Just one more step.',
    successBody: 'WhatsApp opens in a new tab with your message already filled in. Hit send there and we will reply as soon as we can. If no tab appeared, use the button below.',
    successRetry: 'Open WhatsApp',
    successAgain: 'Write another message',
    newTab: '(new tab)',
    compose: (name: string, need: string, message: string) => `Hi GAMADA, I'm ${name}.\nI need: ${need}\n\n${message}`,
  },
}

export const contact = { id, en }
