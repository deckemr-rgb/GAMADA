/** Home section copy: security (ID + EN). `en` must have exactly the shape of `id`. */
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

const en: typeof id = {
  eyebrow: 'Security & governance',
  title: 'Locked down from day one, not after a breach.',
  lead: 'Every server we hand over is set up to the same security baseline. You do not need to know Linux to know that every door is firmly shut.',
  vault: {
    kicker: 'Production server status',
    state: 'Locked',
    checks: 'SSH keys · Firewall · SSL · Backups',
  },
  terminalLabel:
    'Terminal illustration. The SSH check shows password login is disabled. The firewall is active and only allows ports 22, 80 and 443. The SSL certificate renewal test succeeds.',
  note: 'An illustration of standard commands, not a recording of a client server.',
  cards: [
    {
      title: 'Key-only SSH login',
      body: 'Password login is switched off. The server only accepts the cryptographic keys of authorised people, so password-guessing bots have nothing to work with.',
      spec: 'PasswordAuthentication no',
    },
    {
      title: 'Firewall: only three doors open',
      body: 'Every port is closed except 22 (SSH), 80 (HTTP) and 443 (HTTPS). Databases and internal services cannot be reached directly from the internet.',
      spec: 'ufw allow 22,80,443/tcp',
    },
    {
      title: 'SSL that renews itself',
      body: 'HTTPS certificates renew automatically before they expire and the renewal is tested regularly. Visitors never get greeted by a “not secure” warning.',
      spec: 'certbot renew --dry-run',
    },
    {
      title: 'Production hardening',
      body: 'Security updates are applied routinely, each service only gets the access it truly needs, and data is backed up on a schedule to a separate location.',
      spec: 'updates · least privilege · backup',
    },
  ],
  cta: 'Ask about server security',
  waText: 'Hi GAMADA, I would like to ask about server security for my business.',
}

export const security = { id, en }
