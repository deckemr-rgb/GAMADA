# Arah visual lapis aplikasi: keputusan tahap 0

Dokumen ini merangkum penilaian tiga juri atas tiga arah visual untuk **lapis aplikasi** (isi sandbox 17 demo produk, lihat `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` bagian 8). Lapis GAMADA (beranda, `/ekosistem`, `/produk`, `/tur`) tidak berubah dan tetap memakai estetika sinematik senja.

- **A · Presisi editorial**: kode `editorial`, prefix CSS `lde-`
- **B · Sinematik senja**: kode `senja`, prefix CSS `lds-`
- **C · Data-dense tenang**: kode `tenang`, prefix CSS `ldt-`

Juri:
1. **Desainer produk utama**, dengan pengalaman di SaaS dan produk data.
2. **Panel klien**: Bupati, Kepala Diskominfo, direktur bank daerah atau koperasi, dan pemilik toko bahan bangunan dengan 3 cabang.
3. **Insinyur front-end senior** untuk performa dan aksesibilitas.

---

## 1. Rekomendasi

**Bangun di atas C (Data-dense tenang).** Alasannya, C satu-satunya arah yang sudah berbentuk aplikasi. Ia punya breadcrumb, lencana MODE DEMO, strip KPI, tabel padat 32px dengan panel detail dan stepper status, navigasi papan ketik J/K/Enter/N, log alur bercap waktu, dan state yang saling terhubung (tiket baru langsung menaikkan KPI dari 142 ke 143). Kerangka seperti inilah yang dibutuhkan buku besar Pajak Beres, graf Awas Belanja, peta layar penuh Siaga Wilayah, dan layar dinding Meja Pimpinan.

Kelemahan C ada di rasa, bukan di struktur: dingin dan kurang terhubung dengan beranda. Itu kita tambal dengan cangkokan berikut.

**Dari B, diambil untuk rasa dan momen wow:**
- garis tepi atas bergradien 1px dan satu cahaya senja statis, **hanya pada bingkai terluar** (BrowserFrame/DemoShell), tidak pada setiap panel;
- perlakuan peta: label nama plus nilai di setiap poligon dengan halo tipis, ditambah kartu wawasan AI ("Tirtajaya tertinggi di kedua lapisan… kandidat pertama untuk pompa air");
- satu momen "tiket terbang" dari ponsel ke kotak masuk per demo;
- lencana "Langsung" dan umpan "Aktivitas terbaru";
- surat pindaian yang realistis (kop serif, tanda tangan, lencana keyakinan per kotak OCR);
- judul bagian yang menyebut manfaat, bukan nama layar.

**Dari A, diambil untuk disiplin dan suara:**
- API tema `data-eco`: satu atribut mewarnai ulang aksen, warna teks di atas aksen, dan aksen kertas untuk 4 ekosistem;
- satu angka utama Fraunces besar per layar;
- kosakata mikro-visual KPI: sparkline, nilai terhadap target, batang kemarin vs hari ini;
- disiplin warna: chip status netral, warna hanya untuk perhatian (gold) dan bahaya (merah);
- format SLA manusiawi ("20 j lagi", "Lewat 2 j");
- penanda bernomor 1–5 di surat yang cocok dengan baris ekstraksi;
- narasi "Urutan kejadian" yang digabung dengan Log alur milik C;
- jaring pengaman `prefers-reduced-motion` global di CSS.

B tidak dipakai sebagai dasar karena kartu berpendar dan palet status pelanginya tidak akan bertahan di 17 produk. A tidak dipakai karena bentuknya laporan, bukan aplikasi.

---

## 2. Tabel skor

Setiap sel adalah rata-rata dari 3 juri (skala 1–10, satu desimal). Angka **tebal** menandai yang tertinggi di barisnya.

| Kriteria | A · Editorial | B · Senja | C · Tenang |
|---|---:|---:|---:|
| Jelas dalam 30 detik | 5,8 | 5,5 | **7,0** |
| Kesan visual | 6,7 | **7,7** | 6,7 |
| Terasa hidup | 4,3 | **8,2** | 6,7 |
| Selaras dengan beranda | 6,3 | **9,0** | 5,7 |
| Cocok untuk produk padat data | 4,0 | 5,0 | **9,0** |
| Rasa percaya (kepercayaan) | 6,7 | 6,3 | **8,2** |
| Mobile | 5,8 | **7,3** | 7,0 |
| Aksesibilitas | 4,3 | 6,2 | **7,3** |
| Aman untuk performa | 8,3 | 6,0 | **8,5** |
| Bisa diskalakan ke 17 produk | 5,0 | 5,5 | **8,8** |
| **Rata-rata** | **5,7** | **6,7** | **7,5** |
| **Pilihan juri** | 0 dari 3 | 0 dari 3 | **3 dari 3** |

Rata-rata per juri (10 kriteria):

| Juri | A | B | C | Pilihan | Urutan |
|---|---:|---:|---:|---|---|
| Desainer produk | 6,0 | 6,5 | 7,4 | C | C, B, A |
| Panel klien | 5,2 | 6,8 | 7,3 | C | C, B, A |
| Insinyur front-end | 6,0 | 6,7 | 7,8 | C | C, B, A |

Ketiga juri sepakat penuh soal urutan. B unggul di semua kriteria yang menyangkut rasa (kesan, hidup, selaras, mobile). C unggul di semua kriteria yang menyangkut kerja (kejelasan, kepadatan, kepercayaan, aksesibilitas, skala).

---

## 3. Per arah

Tangkapan layar halaman penuh ada di `docs/shots/demo/tahap-0/`. Kode potongan seperti `senja-1440-03` merujuk ke `.shots/labd-crops/<kode>.png`. Folder itu hanya ada di lokal dan tidak masuk git (`.shots/` ada di `.gitignore`).

### A · Presisi editorial

Tangkapan layar: [1440](../shots/demo/tahap-0/editorial-1440.png) · [lipatan pertama 1440](../shots/demo/tahap-0/editorial-1440-fold.png) · [390](../shots/demo/tahap-0/editorial-390.png) · [1440 EN](../shots/demo/tahap-0/editorial-1440-en.png)

**Kekuatan**
1. Tipografinya paling khas. Angka Fraunces besar (142, 87,4 %, 78/100) tampil percaya diri dan mudah dibaca dari seberang meja rapat.
2. Disiplin warnanya paling ketat: satu aksen teal, batang putih untuk kemarin vs hari ini, dan merah hanya untuk "Lewat 2 j". Mikro-visual KPI-nya (sparkline, target, batang kemarin/hari ini) beragam dan ringkas (`editorial-1440-03`).
3. Kode geraknya paling bersih: hanya opacity, transform, dan dashoffset; `gsap.context` dengan revert. Ia juga punya mekanisme tema `data-eco` yang paling bisa diskalakan, dan penanda bernomor di surat yang cocok dengan baris ekstraksi (`editorial-1440-05`).

**Kelemahan**
1. Bentuknya laporan riset, bukan aplikasi. Tidak ada bingkai, panel detail, atau breadcrumb. Konsol layar penuh, layar dinding, dan graf jaringan tidak punya tempat untuk menempel.
2. Terlalu lapang: sekitar 110–150px ruang kosong antarbagian dan baris 40px. Buku besar 40 baris akan melebar ke mana-mana. Di 390px, panjang halamannya 13.233px.
3. Paling tidak hidup dan paling jauh dari suasana senja beranda. Lipatan pertamanya berisi manifesto desain, bukan produk.

**Cacat konkret (sudah dideduplikasi)**
- **Gagal kontras AA pada tombol utama.** "Simulasikan tiket baru" dan "Setujui disposisi" menampilkan teks #F3F0FF di atas teal #3FE0C0, sekitar 1,3–1,5:1. Penyebabnya, `.lde-root button { color: inherit }` (editorial.css:74) menimpa `.lde-btn-primary { color: var(--lde-acc-on) }` (editorial.css:165). Saya cek sendiri di `editorial-1440-03`: teks tombol memang nyaris tak terbaca. Lihat juga `editorial-1440-06`, `editorial-390-04`, `editorial-390-08`.
- Status ditulis sebagai meteran garis putus ("-----"). Tidak ada legenda, dan yang membedakan Baru/Diverifikasi/Diproses hanya jumlah garisnya (`editorial-1440-03`).
- Peta mobile tidak punya label kecamatan sama sekali (`editorial-390-06`). Di desktop, label "TIRTAJAYA" (huruf kapital semua) terpotong garis sungai dan menabrak batas Pantairejo (`editorial-1440-04`).
- Teks kotak OCR di 390px hanya sekitar 7–8px dan tidak terbaca (`editorial-390-07`).
- Mockup ponsel menyisakan sekitar 130px area gelap kosong di atas "Hari ini" (`editorial-1440-03`, `editorial-390-05`). Di mobile, angka ringkasan 142 di samping grafik jadi yatim (`editorial-390-07`).
- Mengklik "Simulasikan tiket baru" untuk kedua kalinya tidak membuat tiket baru, hanya memutar ulang kejadian yang sama.
- Tidak membaca tier performa situs, `?off=`, atau `?degrade` (`lib/perf.ts` tidak diimpor).
- Ada sekitar 600px kanvas kosong setelah catatan kaki (`editorial-1440-06`, `editorial-390-08`).

### B · Sinematik senja

Tangkapan layar: [1440](../shots/demo/tahap-0/senja-1440.png) · [lipatan pertama 1440](../shots/demo/tahap-0/senja-1440-fold.png) · [390](../shots/demo/tahap-0/senja-390.png) · [1440 EN](../shots/demo/tahap-0/senja-1440-en.png)

**Kekuatan**
1. Paling jelas sekeluarga dengan beranda. Gradien plum ke indigo, garis tepi atas bergradien, dan nomor indeks Fraunces miring ("02", "03") sama dengan kartu "Pusat Kendali" di beranda. Judul bagiannya menyebut manfaat: "Dari pesan warga ke tiket, dalam satu tarikan napas" (`senja-1440-03`).
2. Petanya terbaik. Setiap poligon diberi label nama plus nilai, ada panah utara dan panel lapisan, dan kartu wawasan AI mengubah peta jadi keputusan (`senja-1440-04`). Surat pindaiannya juga paling meyakinkan: kop serif, tanda tangan, lencana keyakinan per kotak OCR (`senja-1440-05/06`).
3. Terasa hidup tanpa berisik. Tiket "terbang" dari ponsel ke kotak masuk adalah momen wow yang nyata. Ada lencana "Langsung" dan umpan "Aktivitas terbaru". Di mobile, kartu tiketnya rapi dengan target sentuh besar (`senja-390-04`).

**Kelemahan**
1. Disiplin warnanya runtuh. Chip status memakai lima warna, ada bar "Alur tiket" pelangi, dan CTA peach (aksen Usaha Pintar) muncul di produk Satu Daerah. Identitas satu aksen per ekosistem tidak akan bertahan di 17 produk.
2. Setiap blok berupa kartu berpendar dengan padding besar, dan di mobile ada kartu di dalam kartu. Kepadatannya hilang. Direktur bank bisa membacanya sebagai materi pemasaran, bukan sistem pencatatan.
3. Catatan pengembang tercetak di UI klien ("momen wow · 1,2 s", "stream 25–45 token/dtk", "count-up ≤ 600 ms"). Lipatan pertamanya berupa slogan plus kotak cahaya kosong.

**Cacat konkret (sudah dideduplikasi)**
- **Sel tabel meluap di 1440.** `.lds-td-sla` "Terlambat 2 j" (scrollWidth 159 vs 146) dan `.lds-td-st` "Diteruskan ke OPD" (171 vs 156) terpotong dengan "…" liar. Saya cek sendiri di `senja-1440-03`: elipsis terlihat di kanan kedua chip itu. Data status hilang di kolom yang paling penting.
- Panel kotak masuk direntangkan setinggi ponsel, sehingga ada sekitar 120px ruang mati di bawah 7 baris (`senja-1440-03`).
- Chip mono dev muncul di samping setiap judul (`senja-1440-03/-04/-05`, `senja-390-04/-05/-06`).
- Label peta memakai stroke gelap tebal yang terlihat kasar. "Tirtajaya 12,6" menimpa garis sungai (`senja-1440-04`). Di mobile, labelnya berdesakan dan nilai per kecamatan hilang (`senja-390-05`).
- CTA peach di produk Satu Daerah bertentangan dengan aturan satu aksen (`senja-1440-03`, `senja-1440-06`).
- Ada pelanggaran aturan performa:
  - `@keyframes` kunang-kunang berjalan tak terbatas di luar `gsap.ticker` (sekitar 18 elemen, masing-masing satu lapisan compositor);
  - `filter: drop-shadow` pada poligon aktif (senja.css:1599);
  - transisi `box-shadow` pada kotak OCR (senja.css:1971);
  - latar halaman bertumpuk empat radial-gradient 900px;
  - bundel CSS-nya paling besar (10,0 KB gz).
- Di tengah penerbangan, kartu yang terbang menutupi teks baris pertama kotak masuk.
- Tidak semua KPI punya mikro-visual: "Isu negatif" dan "Tindak lanjut terlambat" hanya berisi teks "Kemarin 6/12".
- Kontrol segmen tingginya 40px di mobile, di bawah standar 44px.
- Klik kedua pada "Simulasikan tiket baru" memutar ulang SW-2026-0142, tidak membuat tiket baru.
- Mengabaikan tier performa, `?off=`, dan `?degrade`.
- Ada sekitar 650px kanvas kosong di akhir halaman (`senja-1440-06`, `senja-390-08`).

### C · Data-dense tenang

Tangkapan layar: [1440](../shots/demo/tahap-0/tenang-1440.png) · [lipatan pertama 1440](../shots/demo/tahap-0/tenang-1440-fold.png) · [390](../shots/demo/tahap-0/tenang-390.png) · [1440 EN](../shots/demo/tahap-0/tenang-1440-en.png)

**Kekuatan**
1. Satu-satunya yang berbentuk cangkang aplikasi. Ada breadcrumb "Ekosistem / Satu Daerah / Sapa Warga", MODE DEMO, strip KPI, grid plus panel detail, stepper "Langkah 4/5", dan tombol "Majukan ke Selesai" (`tenang-1440-02`). Pola ini bisa langsung dipakai untuk buku besar, pengadaan, dan layar dinding.
2. Padat tapi tenang, dan dapat dipercaya. Baris 32px, angka tabular rata kanan, garis 1px. "Data simulasi · seed 42", log alur bercap waktu (+0,95 s AI membaca & mengklasifikasi), metrik token, dan bilah keyakinan per kolom hasil ekstraksi menjadi sinyal audit yang dicari Diskominfo dan auditor bank (`tenang-1440-03`).
3. Aksesibilitas dan performanya paling sehat:
   - grid ARIA sungguhan (`role=grid`, J/K/Enter/N sudah diverifikasi) dan poligon peta dengan aria-label lengkap;
   - nol kegagalan kontras AA pada teks HTML;
   - tidak ada target sentuh di bawah 44px di mobile;
   - JS terkecil (20,0 KB gz);
   - gerak hanya transform/opacity, dan loop dijeda saat tidak terlihat.

**Kelemahan**
1. Ikatan emosionalnya dengan beranda paling lemah: panel tinta datar tanpa gradien atau cahaya senja. Ada risiko terbaca sebagai konsol SaaS generik yang mirip produk terkenal, padahal brief melarang meniru.
2. Momen wow-nya sedikit. Streaming plus log terasa kredibel, tapi tidak ada yang setara dengan penerbangan tiket atau peta B.
3. Bahasanya untuk insinyur. Lipatan pertama berisi "12/13 px teks UI" dan "0 warna dekoratif". Judul bagiannya berupa label ("Strip KPI", "Grafik kecil"), bukan manfaat. Petunjuk papan ketik tampil di perangkat sentuh. Selain itu, `Console.tsx` adalah monolit 25 KB.

**Cacat konkret (sudah dideduplikasi)**
- **SLA ditulis sebagai hitung mundur HH:MM:SS** ("20:00:00", "44:00:00", "−02:00:00"), sehingga terbaca seperti jam dinding, bukan sisa waktu. Saya cek sendiri di `tenang-1440-02`, dan yang sama ada di `tenang-390-03`.
- Peta mobile menyembunyikan semua label: `.ldt-map-labels { display: none }` (tenang.css:2740, `tenang-390-05`). Di 1440, label "Tirtajaya 12,6" berwarna pucat di atas poligon teal paling terang sehingga kontrasnya rendah (`tenang-1440-03`, sudah saya cek).
- Bingkai ponsel direntangkan setinggi kolom, menyisakan sekitar 200px area gelap kosong (`tenang-1440-03`, `tenang-390-04`).
- Sarang ganda di mobile: kartu cangkang luar ditambah panel dalam. Gutter jadi sekitar 32px per sisi, sehingga lebar konten tinggal sekitar 326px (`tenang-390-02` sampai `-06`).
- Ringkasan "1 terlambat" di header kotak masuk berwarna redup, padahal baris "−02:00:00" berwarna merah. Ringkasannya kurang menonjolkan satu-satunya hal yang penting (`tenang-1440-02`).
- Di detail peta, ID tiket terpotong jadi "0139", tidak konsisten dengan "SW-2026-0139" (`tenang-1440-03`).
- Setelah tiket baru masuk, delta "+1" yang melayang menimpa celah antara label dan angka "143".
- "Setujui disposisi" berstatus `disabled={!ready}` sampai OCR selesai (DocBlock.tsx:396). Selama beberapa detik itu tombol mati tanpa penjelasan, padahal bagian 8.5 menulis "tidak boleh ada tombol mati".
- Tidak ada fallback CSS untuk `prefers-reduced-motion`: transisi transform di tombol dan baris (tenang.css:283, :1030) tetap jalan. Ada juga transisi `background-color` pada `.ldt-ocr` (tenang.css:2324).
- Toggle kepadatan hilang di mobile (`tenang-390-03`).
- Klik kedua pada "Simulasikan tiket baru" berubah menjadi "Hapus tiket simulasi". Tiket kedua yang berbeda tidak pernah dibuat.
- Mengabaikan tier performa, `?off=`, dan `?degrade`.
- Ada sekitar satu viewport kosong setelah catatan kaki (`tenang-1440-05`, `tenang-390-07`).

---

## 4. Di mana juri berbeda pendapat, dan keputusannya

| Topik | Perbedaan | Sebab | Keputusan |
|---|---|---|---|
| Kejelasan 30 detik untuk C | Desainer 8, insinyur 8, klien 5 | Desainer dan insinyur menilai konsolnya. Klien menilai apa yang pertama tampil, yaitu lembar token penuh jargon px. | Klien benar soal lipatan pertama. Halaman produk dibuka langsung dengan konsol (breadcrumb, KPI, kotak masuk). Lembar token hanya tampil di `/lab`. |
| Kejelasan dan kesan A | Desainer 7 dan 8, klien 4 dan 6 | Desainer menghargai tipografi dan disiplinnya. Klien merasa halamannya kosong dan berdash ambigu. | Ambil tipografi angka dan disiplin warnanya, tinggalkan tata letaknya. |
| Warna chip status | Desainer: monokrom, warna hanya untuk perhatian dan bahaya. Klien: chip berisi warna yang lebih kuat supaya langsung terlihat. | Desainer menjaga satu aksen per produk. Klien butuh melihat dalam sekejap apa yang perlu ditindak. | Kebutuhan klien sebenarnya adalah melihat yang mendesak, bukan membedakan lima warna. Chip dibuat netral (teks plus titik netral, Selesai pakai centang). Warna hanya dipakai untuk gold (perhatian, SLA < 8 j) dan merah (bahaya, lewat SLA). Hasilnya, yang mendesak justru lebih menonjol. |
| CTA peach | Desainer: melanggar aturan satu aksen. Klien: cocok dengan tombol "Konsultasi Gratis" di beranda. | Klien melihat konsistensi merek, desainer melihat sistem. | Di dalam sandbox, CTA utama memakai aksen ekosistem dengan teks `--dk-acc-on` yang gelap. Peach tetap untuk CTA lapis GAMADA dan produk Usaha Pintar. |
| Petunjuk papan ketik (J/K/N) | Desainer: terasa untuk insinyur dan mirip produk lain. Klien: pengguna mahir akan suka. Insinyur: satu-satunya grid ARIA yang benar. | Penggunanya berbeda: pejabat di tablet vs staf di meja. | Fungsi papan ketik dipertahankan penuh. Petunjuknya hanya tampil pada `@media (hover: hover) and (pointer: fine)`, lalu diringkas di popover "?". |
| Kunang-kunang | Desainer: boleh, tapi hanya di status kosong dan hero bingkai demo lewat `gsap.ticker`. Insinyur: biaya per lapisan nyata. | Rasa hidup vs biaya compositor. | Tidak dipakai di lapis aplikasi. Kunang-kunang tetap milik lapis GAMADA. Di sandbox, rasa hidup datang dari data yang bergerak (count-up, baris baru, penerbangan tiket). |
| Mobile B | Klien 8, desainer dan insinyur 7 | Klien melihat kartu yang rapi. Insinyur melihat kontrol 40px dan nilai peta yang hilang. | Pola kartu mobile B dipakai sebagai acuan di C. Aturan 44px tetap berlaku. |
| Fondasi tema | Insinyur memuji `data-eco` milik A. Juri lain tidak membahasnya. | Hanya insinyur yang membaca kodenya. | `data-eco` menjadi API tema demo-kit. Bug spesifisitas `button { color: inherit }` diperbaiki dengan reset yang memakai `:where()`. |

---

## 5. Yang berubah sebelum tahap 1

### 5.1 Daftar perbaikan pada C

**Wajib (cacat)**
1. Ubah SLA ke format manusiawi lewat satu helper `formatSla()`: "20 j lagi", "45 mnt lagi", "Lewat 2 j", "Tuntas". Hitung mundur detik hanya boleh muncul di panel detail bila sisa waktunya kurang dari 1 jam.
2. Tampilkan label peta di mobile. Hapus `display: none` di tenang.css:2740. Di bawah 640px, tampilkan nama saja dengan ukuran 11px, dan nilai hanya untuk poligon terpilih. Warna label dihitung dari isi poligon: teks gelap di atas isi terang, teks terang di atas isi gelap. Halonya tipis, bukan stroke tebal.
3. Hentikan perentangan panel setinggi saudaranya: bingkai ponsel diberi `align-self: start`, begitu juga panel kotak masuk.
4. Mobile hanya boleh punya satu gutter 16px. Kartu cangkang luar kehilangan padding dan garisnya di bawah 640px.
5. Ringkasan "1 terlambat" memakai warna bahaya. ID tiket ditulis lengkap di mana pun (`SW-2026-0139`).
6. Delta "+1" diberi posisi tetap di samping angka, bukan melayang di celah label.
7. Tidak boleh ada tombol mati. "Setujui disposisi" disembunyikan sampai OCR selesai. Di tempatnya tampil status "Membaca surat… 3/5" dengan progres.
8. "Simulasikan tiket baru" selalu membuat tiket baru berikutnya dari world store (0142, 0143, …). "Hapus tiket simulasi" dipindah ke menu reset.
9. Tambahkan jaring CSS `@media (prefers-reduced-motion: reduce)` global, dan ganti transisi `background-color` OCR dengan overlay opacity.
10. Hapus ruang kosong di akhir halaman (cangkang lab).

**Wajib (struktur dan performa)**

11. Pecah `Console.tsx` menjadi `AppShell`, `KpiStrip`, `DataGrid`, `DetailPanel`, dan `useGridKeyboard` di `src/demo-kit/ui/`.
12. Satukan `motionMode`, `observeOnce`, dan `useVisible` (saat ini disalin tiga kali) ke demo-kit, lalu hubungkan ke `lib/perf.ts` (tier, `?off=`, `?degrade`, flag `demoAnimations`).

**Wajib (bahasa)**

13. Hapus semua jargon dev dan token dari UI yang dilihat klien ("12/13 px teks UI", "0 warna dekoratif", "momen wow · 1,2 s"). Lembar token hanya tampil di `/lab`.
14. Judul bagian menyebut manfaat, gaya B: "Dari pesan warga ke tiket, dalam satu tarikan napas", bukan "Kotak masuk tiket".

**Cangkokan yang dipasang**
- Dari B:
  - garis tepi atas bergradien 1px dan satu cahaya senja statis, hanya pada bingkai terluar;
  - kartu wawasan AI di bawah peringkat peta;
  - penerbangan tiket ponsel → kotak masuk (transform/opacity saja, jalurnya tidak menutupi teks baris, dipicu oleh event world store yang sama dengan count-up KPI);
  - lencana "Langsung" dan umpan "Aktivitas terbaru" sebagai pola rel kanan atau footer standar;
  - surat pindaian realistis dan pemulihan fokus saat kontrol berganti (pola LetterDoc.tsx:77);
  - nomor indeks Fraunces miring di header bagian.
- Dari A:
  - API `data-eco`;
  - satu angka utama Fraunces per layar (sisanya tetap Manrope);
  - mikro-visual KPI di `demo-kit/viz`;
  - chip status netral;
  - penanda bernomor di surat;
  - "Urutan kejadian" bernomor yang digabung dengan Log alur (narasi untuk pengunjung awam, jejak bercap waktu untuk yang teknis);
  - varian tabel bergaris tanpa kartu untuk PaperFrame dan laporan cetak.

### 5.2 Isi `src/demo-kit/ui/tokens.css`

Semua token diturunkan dari `src/styles/tokens.css` (`--c-*`) dan dipasang di `.dk-root`. Prefix-nya `--dk-`.

```css
.dk-root {
  /* permukaan: kanvas → panel → naik/hover */
  --dk-bg: var(--c-ink);            /* #1A1638 */
  --dk-s1: var(--c-ink-2);          /* #231B48 */
  --dk-s2: var(--c-indigo);         /* #2B2152 */
  --dk-chrome: #16122f;             /* bar breadcrumb, header grid */

  /* teks */
  --dk-text: var(--c-text);
  --dk-muted: var(--c-muted);
  --dk-faint: #a29bcc;              /* label 12px, tetap ≥ 4,5:1 di --dk-s1 */

  /* garis */
  --dk-line: rgba(185, 178, 255, 0.12);
  --dk-line-2: rgba(185, 178, 255, 0.22);   /* pemisah kuat */
  --dk-line-act: color-mix(in srgb, var(--dk-acc) 60%, transparent);

  /* aksen ekosistem (bawaan Satu Daerah); diganti lewat [data-eco] */
  --dk-acc: var(--c-teal);
  --dk-acc-2: var(--c-cyan);
  --dk-acc-on: #06231e;             /* teks di atas aksen, wajib ≥ 4,5:1 */
  --dk-acc-12: color-mix(in srgb, var(--dk-acc) 12%, transparent); /* sorot baris baru */
  --dk-acc-paper: #0b6a59;          /* aksen di tema kertas */

  /* semantik tetap, bukan dekorasi */
  --dk-warn: var(--c-gold);         /* perhatian: SLA < 8 j */
  --dk-danger: var(--c-red);        /* isi/titik bahaya */
  --dk-danger-ink: #ff8d82;         /* teks bahaya di latar gelap */
  --dk-pos: #6fe8cf;                /* delta membaik */

  /* spasi grid 4px */
  --dk-1: 4px; --dk-2: 8px; --dk-3: 12px; --dk-4: 16px; --dk-5: 20px;
  --dk-6: 24px; --dk-8: 32px; --dk-10: 40px; --dk-12: 48px; --dk-16: 64px;

  /* radius */
  --dk-r-chip: 6px; --dk-r-input: 10px; --dk-r-card: 14px; --dk-r-panel: 20px;

  /* elevasi: 3 level + sorot dalam 1px; tanpa backdrop-filter */
  --dk-hi: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  --dk-e1: var(--dk-hi), 0 1px 2px rgba(6, 4, 22, 0.45);
  --dk-e2: var(--dk-hi), 0 1px 2px rgba(6, 4, 22, 0.4), 0 8px 20px -8px rgba(6, 4, 22, 0.7);
  --dk-e3: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 6px rgba(6, 4, 22, 0.45),
           0 24px 48px -18px rgba(6, 4, 22, 0.9);

  /* cangkokan senja: HANYA untuk bingkai terluar (DemoShell/BrowserFrame) */
  --dk-edge: linear-gradient(90deg, transparent, var(--c-peach) 30%, var(--c-lavender) 70%, transparent);
  --dk-dusk: radial-gradient(120% 80% at 85% -10%, rgba(141, 90, 154, 0.22), transparent 60%);

  /* tipografi: Manrope ukuran/tinggi baris; Fraunces hanya judul halaman & angka utama */
  --dk-t12: 12px/17px; --dk-t13: 13px/18px; --dk-t14: 14px/20px; --dk-t16: 16px/24px;
  --dk-t20: 20px/28px; --dk-t24: 24px/32px; --dk-t32: 32px/40px;
  --dk-hero-num: 400 56px/1 var(--font-display);  /* satu per layar */

  /* kepadatan */
  --dk-row: 40px;                   /* nyaman */
  --dk-row-dense: 32px;             /* padat (toggle) */
  --dk-target: 44px;                /* target sentuh minimum mobile */

  /* fokus */
  --dk-focus: 0 0 0 2px var(--dk-bg), 0 0 0 4px var(--c-lavender);

  /* tema kertas (PaperFrame, laporan cetak) */
  --dk-paper: #f8f6f0; --dk-paper-ink: #1f1d2b; --dk-paper-muted: #4d4a60;
  --dk-ocr: #0b7565; --dk-ocr-low: #8a5a00;
}
.dk-root[data-eco='usaha'] { --dk-acc: var(--c-peach); --dk-acc-2: var(--c-gold); --dk-acc-on: #2a1204; --dk-acc-paper: #94400f; }
.dk-root[data-eco='pasar'] { --dk-acc: #c08ad0; --dk-acc-2: var(--c-lavender); --dk-acc-on: #24102c; --dk-acc-paper: #6e3a7c; }
.dk-root[data-eco='inti']  { --dk-acc: var(--c-lavender-soft); --dk-acc-2: var(--c-text); --dk-acc-on: var(--c-ink); --dk-acc-paper: #3d3478; }

/* reset tombol tanpa spesifisitas, supaya tidak menimpa varian (pelajaran dari bug A) */
:where(.dk-root) :where(button) { font: inherit; color: inherit; }

@media (prefers-reduced-motion: reduce) {
  .dk-root *, .dk-root *::before, .dk-root *::after {
    transition-duration: 0.01s !important; animation-duration: 0.01s !important;
  }
}
```

Catatan token:
- Aksen Pasar Daerah memakai `#c08ad0`, bukan plum `#8d5a9a`, karena plum terlalu gelap di atas `--dk-s1` untuk teks dan garis aktif. Plum tetap dipakai sebagai isi area.
- Kontras `--dk-acc-on` terhadap `--dk-acc` diuji otomatis untuk keempat ekosistem.
- Konstanta durasi (120/200/320/600/900–1400 ms) masuk ke `src/lib/motion.ts` grup `DEMO`, bukan ke `tokens.css`, sesuai bagian 8.3.

**Pola yang masuk ke `src/demo-kit/ui/`**

| Pola | Asal | Isi |
|---|---|---|
| `AppShell` | C | Breadcrumb ekosistem / produk, lencana MODE DEMO, slot RoleSwitcher. Garis `--dk-edge` dan `--dk-dusk` hanya di sini. |
| `KpiStrip` / `KpiTile` | C + A | Strip bersambung, count-up ≤ 600 ms, mikro-visual (`spark`, `target`, `pair`), satu `hero` Fraunces per layar. |
| `DataGrid` | C | `role=grid`, J/K/Enter/N, 32/40px, berubah menjadi kartu di bawah 640px, baris baru slide-in 8px plus `--dk-acc-12`. Petunjuk papan ketik hanya untuk `pointer: fine`. |
| `DetailPanel` + `StatusStepper` | C | Langkah n/5 dengan aksi berikutnya yang nyata. |
| `StatusChip` | A | Netral (teks plus titik netral). Varian hanya `warn` dan `danger`. Selesai pakai ikon centang. |
| `SlaLabel` | A | Format manusiawi lewat `formatSla()`. |
| `InsightCallout` | B | Kalimat keputusan dari AI dalam bahasa awam, tersedia di semua produk. |
| `EventFeed` + `LiveBadge` | B | "Aktivitas terbaru", tersambung ke EventToast. |
| `FlowLog` | C + A | Log bercap waktu plus mode narasi "Urutan kejadian". |
| `MapPanel` | C + B | Peringkat, detail, label bernilai, label mobile, Flip saat lapisan berganti. |
| `PaperFrame` | B + A | Kop serif, lencana keyakinan per kotak, penanda bernomor ke baris ekstraksi, tema kertas. |
| `SectionHeader` (lapis GAMADA di `/produk`) | B | Indeks Fraunces miring dan judul manfaat. |

---

## Keputusan pemilik proyek (17 November 2026)

Semua usulan tahap 0 disetujui:
- Arah visual: **C (Data-dense tenang)** sebagai dasar, dengan cangkokan dari B dan A seperti di bagian 1.
- Region pack: **[DAERAH_1] Kabupaten Bojonegoro** (Basa Jawa, region utama untuk tur), **[DAERAH_2] Kota Bandung** (Basa Sunda), **[DAERAH_3] Kota Padang** (Baso Minang).
- Peta dasar: OpenFreeMap (data OpenStreetMap, tanpa API key). Citra satelit tetap disembunyikan sampai penyedia dan lisensinya dipastikan (EOX Sentinel-2 2016 dikonfirmasi ke EOX, atau penyedia ber-key).
- AI: mode Simulasi sebagai bawaan. Mode Live diaktifkan setelah API key, anggaran harian, dan hosting tersedia.
- Halaman produk: tanpa harga, cukup CTA "Hubungi kami".
- Nama bank/koperasi mitra dan supplier: fiktif, dibuat oleh agent.
- Prioritas: prompt ekosistem dulu. Fase 3–7 prompt GATRA cukup menjadi halaman studi kasus `/karya` tanpa membangun ulang demonya.
- `PROMPT-VSCODE-PRODUK-E2E.md` **dihapus** dan digantikan oleh ekosistem 17 produk (masih bisa dipulihkan dari commit `99398dc`). Spesifikasi di `docs/products/` disimpan hanya sebagai bahan tulisan studi kasus `/karya`, bukan untuk dibangun.
- Tarif pajak Pajak Beres diriset di tahap 3, lalu sumbernya dikonfirmasi pemilik.

### Tambahan 17 November 2026: kebijakan data

- Kata pemilik: "Semuanya simulasi dan demonstrasi yang menunjukkan kekuatan atau fitur-fitur AI, jadi datanya tidak harus real; simulasi tidak apa-apa, yang penting relevan."
- Harga pangan sepenuhnya simulasi. Panel Harga Pangan tidak dipakai.
- Statistik wilayah (penduduk, rumah tangga, PDRB) dibulatkan dan dilabeli "angka simulasi", bukan statistik resmi. Pertanyaan lisensi BPS dan Panel Harga dianggap selesai.
- Data nyata hanya yang berlisensi terbuka: batas wilayah (HDX, CC BY-IGO), OSM (ODbL), nama tempat, dan kode kecamatan Kemendagri.
- Batas 180 KB per demo menghitung JS dan data JSON.
- Dukungan bahasa Indonesia dan Inggris setara.
- Tampilan sementara untuk demo yang belum dibangun disusun oleh agent: panel "Yang akan bisa Anda coba".
