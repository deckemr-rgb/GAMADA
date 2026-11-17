/** Home section copy: security (ID). The English copy lives in ./security.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape. */
const id = {
  eyebrow: 'Keamanan & tata kelola',
  title: 'Dikunci sejak hari pertama, bukan setelah kebobolan.',
  lead: 'Setiap server yang kami serahkan dipasang dengan standar keamanan yang sama. Anda tidak perlu paham Linux untuk tahu bahwa semua pintunya tertutup rapat.',
  vault: {
    kicker: 'Status server produksi',
    state: 'Terkunci',
    checks: 'SSH kunci · Firewall · SSL · Backup',
  },
  terminalLabel:
    'Ilustrasi terminal. Pemeriksaan SSH menunjukkan login dengan kata sandi dimatikan. Firewall aktif dan hanya mengizinkan port 22, 80, dan 443. Uji perpanjangan sertifikat SSL berhasil.',
  note: 'Ilustrasi perintah standar, bukan rekaman server klien.',
  cards: [
    {
      title: 'Login SSH hanya dengan kunci',
      body: 'Login memakai kata sandi dimatikan. Server hanya bisa diakses dengan kunci kriptografi milik orang yang berwenang, jadi robot penebak kata sandi tidak punya celah.',
      spec: 'PasswordAuthentication no',
    },
    {
      title: 'Firewall: hanya tiga pintu terbuka',
      body: 'Semua port ditutup kecuali 22 (SSH), 80 (HTTP), dan 443 (HTTPS). Database dan layanan internal tidak bisa disentuh langsung dari internet.',
      spec: 'ufw allow 22,80,443/tcp',
    },
    {
      title: 'SSL yang memperpanjang diri',
      body: 'Sertifikat HTTPS diperbarui otomatis sebelum kedaluwarsa dan diuji secara berkala. Pengunjung tidak akan pernah disambut peringatan “situs tidak aman”.',
      spec: 'certbot renew --dry-run',
    },
    {
      title: 'Hardening untuk produksi',
      body: 'Pembaruan keamanan dipasang rutin, setiap layanan hanya mendapat hak akses yang benar-benar ia butuhkan, dan data dicadangkan terjadwal ke lokasi terpisah.',
      spec: 'updates · least privilege · backup',
    },
  ],
  cta: 'Tanya soal keamanan server',
  waText: 'Halo GAMADA, saya ingin bertanya soal keamanan server untuk usaha saya.',
}

export const security = id
