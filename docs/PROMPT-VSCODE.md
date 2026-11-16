# Prompt untuk VS Code (Copilot / Claude / Cursor agent)

Salin semua di bawah garis ke chat agent di VS Code, dengan folder `gamada` terbuka.

---

Kamu bekerja di proyek **GAMADA** (Vite 8 + React 19 + GSAP + Lenis + OGL, Tailwind 4). Ini situs scrollytelling 3 scene (`hero`, `tranquility`, `biodiversity`) yang disusun dari layer parallax ilustrasi SVG. Ada tiga tujuan: **(A) 60 fps stabil tanpa lag**, **(B) aset dikompres**, **(C) figur karakter digambar ulang supaya lebih bagus**. Kerjakan berurutan A → B → C. Setelah tiap langkah, jalankan `npm run typecheck` dan `npm run build`, lalu ukur ulang.

## Kondisi sekarang (hasil review)

- Ada 32+ layer `<img>` SVG, **semuanya 2560×2304 full-canvas**, termasuk figur kecil seperti traveler, scarf, elder, turtle, dan deer. Layer box-nya 106%×160% viewport (`src/lib/frame.ts`). Akibatnya overdraw dan biaya raster sangat besar: satu scene berarti ±12 permukaan transparen selebar layar yang ditumpuk.
- SVG-nya berat: grass-front 135 KB, hills 131 KB, total `public/scenes` ±2,6 MB, dengan 222 `linearGradient` dan 74 `clipPath`.
- `src/timelines/ambient.ts`:
  - Wind men-skew layer full-size **setiap frame** lewat `gsap.set`.
  - DOF menganimasikan `filter: blur()` pada layer foreground full-size (baris ~86–97). Ini penyebab lag terbesar.
- `will-change: transform` hanya aktif lewat class `.stage.is-moving` (`index.css` ±121, `masterTimeline.ts` ±319). Setiap kali transisi mulai atau selesai, layer di-promote/demote lalu SVG di-raster ulang, sehingga terjadi hitch.
- `mix-blend-mode`: `sun-glow` (screen), `.grade` (soft-light) di atas seluruh stage, dan cursor (difference). Ada juga `backdrop-filter: blur(14px)` di navbar (`ui.css` ±59) di atas konten yang terus bergerak.
- Ada hingga 6 canvas aktif (Particles ×3, Curtain, Waterfall, Birds). Canvas particles berukuran layer box (1336×1536 buffer di viewport 1024×768), jadi ±60% pikselnya di luar layar.
- `warmScene()` (`assets.ts:282`) hanya mem-fetch, belum `img.decode()`. Saat transisi, scene berikutnya sempat kosong (setengah layar gelap).
- Hasil pengukuran saat scroll: p50 ±21 ms/frame, p95 ±180 ms, ada frame >1 detik. Catatan: diukur di panel browser yang tersembunyi, jadi angkanya kasar. Ukur ulang di Chrome biasa.
- Bug visual hero: teks paragraf ("…kuno Gamada. Mengejutkan sekaligus memikat — puncak menjulang…") tampil sebagai kolom sangat sempit di kiri dan menimpa ilustrasi. Bagian atas hero juga sempat berupa gradien datar dengan tepi horizontal keras di ±48% tinggi layar. Periksa `SceneCopy.tsx`, `.copy-layer`, dan intro di `timelines/intro.ts` / `Preloader.tsx`.

## A. Performa: target 60 fps

1. **Pengukuran dulu.** Tambahkan HUD fps (`?debug=fps`) yang menampilkan p50/p95 frame time dan jumlah long frame (>50 ms). Catat baseline di Chrome DevTools → Performance (CPU 4× slowdown) untuk: diam di hero, scroll hero→tranquility, dan scroll tranquility→biodiversity.
2. **Raster + trim layer.** Buat skrip `tools/build-layers.mjs` (pakai `sharp` atau `@resvg/resvg-js`) yang:
   - me-render tiap SVG ke **WebP** (q≈82, alpha) dalam 2 lebar: 1280 dan 2560 (plus 1920 untuk layer besar);
   - meng-**crop area transparan** (trim) dan menyimpan offset bbox dalam koordinat canvas 2560×2304 ke `src/lib/layers.generated.json`.
   
   Ubah `Scene.tsx` dan `assets.ts` supaya `<img>` memakai `srcset/sizes` dan diposisikan di bbox-nya lewat `computeFrame()`/`FrameSpace` yang sudah ada, bukan full-canvas. SVG tetap disimpan sebagai sumber di `docs/assets` atau `src-art/`.
3. **Kompositing permanen.** Hapus toggle `.is-moving`. Beri `will-change: transform` permanen pada `.layer` dan `.layer-wind` hanya untuk scene aktif dan scene berikutnya. Scene lain diberi `content-visibility: hidden` atau `display: none`. Pastikan semua transform GSAP memakai `force3D: true`.
4. **Hapus animasi `filter: blur()` DOF.** Gantinya: buat versi blur yang sudah di-bake di skrip build (`*-blur.webp`), lalu cross-fade opacity antara versi tajam dan blur. Kalau terlalu repot, matikan DOF di tier `mid`/`low`.
5. **Wind/sway.** Ganti `gsap.set` per frame dengan `gsap.quickSetter(el, 'skewX', 'deg')`. Update hanya jika nilainya berubah lebih dari 0,02°. Wind cukup diterapkan pada layer rumput hasil trim (bukan full-canvas).
6. **Blend & blur UI.**
   - `sun-glow` dengan blend `screen`: bake ke `sky` saat build.
   - `.grade` soft-light: ganti dengan gradien alpha biasa (`opacity`, tanpa `mix-blend-mode`) atau bake ke backdrop tiap scene.
   - Navbar: ganti `backdrop-filter` dengan background semi-opaque solid. `backdrop-filter` hanya boleh dipakai pada menu overlay yang statis.
7. **WebGL.**
   - Canvas particles diukur sesuai viewport, bukan layer box.
   - Cap DPR: 1 untuk `mid`/`low` dan 1.25 untuk `high`.
   - Satukan Particles, Curtain, dan Waterfall ke **satu konteks GL bersama** jika memungkinkan, atau minimal pastikan hanya canvas milik scene yang visible yang dirender.
   - Di Birds, kurangi jumlah burung di tier `mid`.
   - `onLowFps` sekarang hanya terpicu sekali. Buat degrade bertahap: DOF off → particles 50% → birds off → waterfall static.
8. **Transisi tanpa layar kosong.** `warmScene()` harus memanggil `await img.decode()` untuk setiap layer scene berikutnya, dan set `visibility: visible` (opacity 0) satu frame sebelum seam masuk.
9. **Satu loop RAF.** Lenis sudah di `gsap.ticker`. Pastikan tidak ada `requestAnimationFrame` lain yang berjalan (perf sampler di `perf.ts` boleh tetap, tapi harus berhenti setelah selesai).

**Kriteria lulus A:** di laptop kelas menengah (DPR 1.25, 1024–1920 px), p95 frame time di bawah 20 ms saat scroll, tidak ada frame >50 ms saat pindah scene, dan memori GPU turun. Tulis tabel before/after di `docs/PERF.md`.

## B. Kompresi

- Jalankan `svgo` (multipass, `convertPathData` precision 1, `mergePaths`, `removeUselessDefs`) pada semua SVG sumber. Gabungkan gradient yang duplikat; saat ini ada 222 gradient, banyak yang identik.
- Output runtime berupa WebP/AVIF dari langkah A2. Target total `public/scenes` di bawah 900 KB untuk desktop dan di bawah 400 KB untuk mobile (1280w).
- Font: hanya muat subset `latin` untuk Fraunces dan Manrope. Hapus cyrillic, greek, dan vietnamese dari bundle.
- Vite: aktifkan `build.cssMinify`, `modulePreload`, dan `<link rel="preload">` hanya untuk aset hero.
- Laporkan ukuran `dist/` before/after (sekarang 3,3 MB).

## C. Figur karakter: gambar ulang

Masalah yang terlihat:

- **Traveler (hero):** terpotong di tepi kanan pada viewport 4:3. Siluetnya kotak (jubah + ransel seperti balok), syal oranye mencuat kaku, tangan/kepala nyaris tak terlihat.
- **Deer (biodiversity):** kaki terlalu kurus dan lurus tanpa sendi (lutut/hock), leher dan kepala berbentuk blob, tanduk seperti ranting tempelan, tidak ada bayangan kontak di tanah.
- **Elder & turtle (tranquility):** elder terlalu kecil dibanding komposisi. Wajah dan tangan tidak terbaca. Kura-kura berupa bentuk sederhana tanpa detail cangkang atau pantulan air.

Arahan gaya (berlaku untuk semua figur):

- Style flat-vector **3-tone cel shading** (base, shadow, highlight) + **rim light** dari arah sumber cahaya utama tiap scene: matahari kanan atas di hero, cahaya gua dan lentera di tranquility, matahari belakang di biodiversity.
- Palet ambil dari layer scene masing-masing (`--grade-a/b`), tanpa warna asing. Tanpa outline hitam; tepi dibentuk oleh kontras warna.
- Proporsi realistis-stylized. Pose tidak kaku: kontrapos, gestur tangan, kepala sedikit menoleh agar terasa hidup.
- Tambahkan bayangan kontak/ambient occlusion di bawah figur dan pantulan di air bila figur dekat air.
- Siluet harus tetap terbaca saat diperkecil ke 25%. Tes dengan isi hitam penuh.
- Figur ditempatkan di **safe zone** horizontal 15–85% untuk aspect 16:9, 4:3, dan 9:16 (cek `focusX`/`focusXMobile` di `assets.ts`). Elder diperbesar sekitar 1,4×.
- Pisahkan bagian yang beranimasi menjadi layer atau grup sendiri: syal traveler, joran dan senar elder, kepala kura-kura, telinga/kepala rusa (pose `rest`/`alert`/`ear`). Animasinya tetap memakai sistem sway/pose yang ada.
- Path harus efisien: di bawah 25 KB per figur setelah svgo. Hindari `clipPath` bertingkat bila cukup dengan path biasa.

Untuk mengecek tiap figur sendirian, pakai `tools/preview.html?scene=<id>&solo=<layer>`. Buat screenshot before/after dengan `node tools/shot.mjs` pada viewport 1440×900, 1024×768, dan 390×844, lalu simpan di `docs/shots/`.

## Aturan kerja

- Jangan ubah alur cerita, teks, atau struktur scene. Fokus pada performa, ukuran, dan kualitas visual.
- Pertahankan flag di `src/lib/motion.ts` dan `?off=` supaya setiap efek bisa di-A/B.
- Satu perubahan, satu ukur ulang. Kalau fps tidak naik, revert.
- Hormati `prefers-reduced-motion`. Pastikan tidak ada error di console.
