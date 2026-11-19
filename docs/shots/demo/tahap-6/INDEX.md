# Tahap 6 screenshots

Taken from the production build at http://127.0.0.1:4173 (`?off=preloader`) in installed Chrome at DPR 1, on 2026-11-20.
Saved as palette PNGs, each under 400 KB. Some long full-page shots are downscaled; the width is noted where it changed.

- `home-1440-id.png`: home hero at 1440 (viewport). The capture landed mid-intro: the headline letters "nya" and the "Konsultasi Gratis" button are still fading in, and Proses/FAQ sit about 4 px higher than the other nav items while the nav entrance runs. These are timing effects of the capture, not layout bugs.
- `home-390-id.png`: home hero at 390 (viewport). OK.
- `nav-ekosistem-dropdown-1440-id.png`: Ekosistem dropdown open on /ekosistem. Shows 4 ecosystems with dots, the tour link and "Semua produk & demo". The custom-cursor halo is visible over the chevron. OK.
- `nav-menu-390-id.png`: mobile menu open. Numbered sections, ecosystem sub-links, ID/EN and CTA. OK.
- `ekosistem-1440-id.png`: /ekosistem full page (downscaled to 738 w). Has the constellation hero, 3 eco panels + Inti band, the flow, the tour band, the FAQ and the CTA. DEFECT: "Bagaimana semuanya terhubung" has about 1100 px of empty space under the timeline. This is probably a pinned or scroll-scrubbed section that a full-page capture does not resolve. Check it by scrolling in a real browser.
- `ekosistem-1440-en.png`: /ekosistem in EN (738 w). Same layout, and all copy is translated. It has the same empty gap under "How it all connects".
- `ekosistem-390-id.png`: /ekosistem at 390 (downscaled to 312 w, very long). The layout stacks correctly and there is no horizontal overflow. It is too small to read the details.
- `ekosistem-satu-daerah-1440-id.png`: story, flow diagram (chapters 1-19), 7 product cards, "Manfaat per jenis pembeli", cross-eco links, other ecos, CTA. OK.
- `ekosistem-usaha-pintar-1440-id.png`: same template for Usaha Pintar. OK.
- `ekosistem-pasar-daerah-1440-id.png`: same template, 4 products, flow chapters 8/14/16/17/18. OK.
- `ekosistem-inti-1440-id.png`: Inti variant with 4 modules, a 17-product grid, "Yang didapat setiap produk" and other ecos. OK.
- `produk-sapa-warga-1440-id.png`: full 9-section product template (downscaled to 738 w). Has the hero with the mini-demo, Masalah, Cara kerja, Momen unggulan, Terhubung dengan, Untuk siapa, Keamanan, FAQ, Muncul di tur and the CTA. Minor: "Hubungi kami" wraps onto a second row under the two hero CTAs (same on every product page).
- `produk-juara-jualan-1440-id.png`: Usaha Pintar product (922 w). Same template. OK apart from the CTA wrap.
- `produk-katalog-lokal-1440-id.png`: Pasar Daerah product (922 w). Same template. The hero mini-demo was caught early, so its right panel is mostly empty.
- `produk-toko-autopilot-1440-id.png`: Toko Autopilot full page (738 w). OK apart from the CTA wrap.
- `produk-toko-autopilot-kasir-1440-id.png`: /produk/toko-autopilot#kasir (viewport). The "Modul Kasir, dulu KasirKu" card sits right under the navbar (scrollY 771) and is not hidden behind it. OK.
- `produk-sapa-warga-390-id.png`: Sapa Warga at 390, full page (10.9k px tall). All sections stack, with no horizontal overflow. OK.
- `lab-1440-id.png`: /lab. Has the eco/status/time filters, 20 cards (17 products + Inti + PhoneFarm + ScrapPulse→Radar Isu) and the footer. OK.
- `karya-1440-id.png`: /karya stub in the home style, with the merged cards KasirKu→Toko Autopilot and ScrapPulse→Radar Isu. The "Halaman ini sedang dibangun" note is intentional (the full portfolio page is deferred).
- `footer-1440-id.png`: footer (Layanan / Ekosistem / Portofolio / Kontak) above the mountain band. OK.

Note: the older `docs/shots/demo/tahap6/` folder (no hyphen) holds the builders' own shots. It was left untouched.
