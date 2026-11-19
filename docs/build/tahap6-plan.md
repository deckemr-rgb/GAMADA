# Tahap 6 · Halaman situs: build plan

Written 2026-11-19 by the tahap-6 planner, while Tahap 4 is being built in `src/` and before Tahap 5 (tour). **Tahap 6
starts only after Tahap 5 is committed** (it links to `/tur/<n>` and reads `content/tour.ts`). Where the spec and this
file differ on HOW, this file wins; on WHAT, the spec (`docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §4, §13, §14) wins.

Owner wants speed: **step 0 (integrator, ≤ 30 min) → 3 builders in parallel → integration → gate → ONE visual comparison
vs home → fix list (one pass) → screenshots.** No review loops, no wow audit re-scores (deferred to Tahap 7). Every
builder runs the self-check (§0.6) before handing over.

Read first (in this order):
1. Spec §2, §3, §4, §8.1 ("Lapis GAMADA"), §13, §14, §15. Your product in §11 if you write product copy.
2. This file: §0 rules, §1 exists-vs-new, your pages in §2, §3 content, your ownership line in §4, §5 sizes, §6 tests.
3. The home page in a browser (`npm run dev`, `/?off=preloader`), then `/ekosistem`, `/produk/sapa-warga`, `/lab`,
   `/karya` as they are now (Tahap-1 functional versions). The visual bar is the HOME, not the demos.
4. `src/components/PageShell.tsx`, `src/routes/EcoParts.tsx`, `src/components/ui/*` (Section, SectionHeader, Card,
   Button, Tag), `src/lib/reveal.ts` (`useReveal` kit), `src/sections/Ecosystem.tsx` (SVG + GSAP diagram pattern).

---

## 0 · Rules

### 0.1 Product and honesty (unchanged from Tahap 3/4 §0.1)
- All demo data is simulated; any number that could pass for real carries "simulasi" / "simulated". People and
  companies fictional; officials by title only. Testimonials (only on home, already there) stay labelled "ilustrasi".
  **No testimonials on product pages.**
- Product pages say **"Hubungi kami"** (WhatsApp via `waLink`), **no prices, no packages, no "mulai Rp…"**. No
  certification, e-Katalog listing, client count or "dipakai oleh Pemda X" claims anywhere (none are true yet).
  Security copy describes what the product DOES in the demo (role matrix, audit log) and what is POSSIBLE ("dapat
  dipasang di server dalam negeri / on-premise; dibahas saat konsultasi"), never a promise of a certificate.
- ID + EN first-class: every visible string is `{ id, en }` or lives in an `id`/`en` dictionary pair with the same
  shape (type-checked). EN is lazy where the page already does that.
- **No dead links:** every link resolves (route exists, slug valid, chapter exists, anchor id exists). A demo that is not
  `DEMO_READY` keeps the honest Tahap-1 label ("Lihat rencana demo"); by Tahap 6 all 18 should be READY, but code
  must still read the flag, never assume it.
- Names, slugs, eco membership, relations, chapters: ONLY from `content/products.ts`, `content/tour.ts`,
  `demos/registry.ts`. Never retype a product name or count in copy; use `{name}` / `{n}` placeholders + `fill()`.

### 0.2 Look (Lapis GAMADA, spec §8.1)
- Site pages match the HOME: `PageShell` dusk hero + fireflies, Fraunces display headings, Manrope body, the home
  `Section` / `SectionHeader` / `Card` (tilt + spotlight + glow) / `Button` / `Tag` components, `useReveal` kit
  (eyebrow, heading SplitText, cards batch), site tokens from `src/styles/tokens.css` (`--c-*`). Eco accents via
  `[data-eco]` (teal/cyan, peach/gold, plum/lavender, lavender-white for Inti).
- **Not** the demo look: no `--dk-*` tokens, no dense tables, no 12/13 px UI text on site pages. Exception: the
  mini-demo inside its device frame IS the app layer (that is the point: "the real product, playing").
- Spacing rhythm, section padding, max widths, heading sizes: copy them from home sections, do not invent new scales.

### 0.3 Performance and motion
- Home initial JS ≤ **253.6 KB** gzip (PERF.md method). Navbar + Footer are in it: they may NOT import
  `content/products.ts`, `content/tour.ts`, `demos/registry.ts` or anything under `demo-kit/` (except the existing
  icons already eager, check first). They read the tiny `content/ecoNav.ts` (§1.2). The lazy `HomeSections` chunk may
  grow ≤ 4 KB gzip.
- Every new page/section is in a lazy route chunk; per-route budgets in §5. Mini-demos load only when their frame is
  near the viewport (IntersectionObserver, `rootMargin: 200px`), never on idle.
- Animate transform/opacity/stroke-dashoffset only; one RAF (`gsap.ticker`); pause off-screen and on `document.hidden`;
  no `backdrop-filter`, no animated blur, no `mix-blend-mode` on large elements. New motion flag `constellation` in
  `lib/motion.ts` (`?off=constellation`). `prefers-reduced-motion` and `?static=1`: constellation lines drawn, no
  twinkle, no zoom transition; mini-demos show their final frame (static) with a "Putar" button; reveals skip to end.
- Clean up GSAP contexts, observers, timers on unmount (route changes run the curtain; leaks show as double tickers).

### 0.4 Accessibility and mobile
- Phones 360–430 px: no horizontal scroll, 44 px min targets (chips, filter buttons, dropdown items, constellation
  stars get a 44 px hit area even when the dot is 8 px), sticky CTA never covers content or the WA float.
- Keyboard: constellation stars are buttons in a logical order (Inti, then eco by eco), Enter opens the product, focus
  shows the same mini card as hover; dropdown opens on Enter/Space/ArrowDown, `Esc` closes and returns focus; skip
  link works. Every SVG diagram has a text equivalent (visually hidden list or caption). Headings in order (one h1).
- `aria-live="polite"` only where something changes on its own (constellation info card, mini-demo caption is
  `aria-hidden` with a static text summary next to it).

### 0.5 Do not touch
- `src/demos/<slug>/**` except the two new files `copy.ts` and `mini.tsx` (and pure re-exports a mini needs; never
  change a product component's props or behaviour; if a component is not reusable, build the mini from kit atoms).
- `src/demo-kit/**`, `src/demo-kit/tour/**`, `server/**`, `src-art/**`, `tools/**`, scenes/WebGL components,
  `content/products.ts` (read only; if a field is truly missing, ask the integrator), `content/tour.ts`.
- Existing tests: extend in `tests/e2e/tahap6/`, do not rewrite `routes.spec.ts` (integrator adds routes to it).

### 0.6 Self-check (builder; report every line PASS/FAIL with the number)
- [ ] `npm run typecheck` clean; `npm run build` clean; no new console errors/warnings on your routes (ID and EN).
- [ ] Your routes' first-load sizes (budget script, §5) ≤ target; home initial JS unchanged (± 0.2 KB) unless you are B3,
      then ≤ 253.6.
- [ ] 360, 390, 430, 768, 1440 px: no horizontal scroll, no overlap, 44 px targets (list any exception).
- [ ] Reduced motion + `?off=constellation` + `?static=1`: page complete and static; no ticker listeners when idle.
- [ ] Keyboard pass of your pages (Tab order, Enter, Esc); axe: 0 serious/critical.
- [ ] Every link on your pages resolves (your spec in §6.3 passes); no price, no fake claim (grep `Rp`, `harga`,
      `price`, `ISO`, `sertifik`, `klien` in your files: each hit justified).
- [ ] ID and EN screenshots 1440 + 390 of each of your pages in `docs/shots/demo/tahap6/` (`<page>-<w>-<lang>.png`).

---

## 1 · What exists vs what is new

### 1.1 Exists (Tahap 1 functional versions; keep their data wiring, restyle and extend)
| Route / file | State now | Tahap 6 |
|---|---|---|
| `/ekosistem` → `routes/Ekosistem.tsx` | PageShell hero, eco overview nav, one section per eco with `ProductCard`s, tour CTA band, WA band | add constellation hero, 3 eco panels (story + 3 benefits), "Bagaimana semuanya terhubung" flow, eco FAQ; restyle to home look |
| `/ekosistem/:eco` → `routes/EkosistemDetail.tsx` | crumbs, product cards, chapter flow list, outside connections, other ecos, WA | add story block, eco flow diagram (SVG), "Untuk siapa" per buyer type; Inti variant (§2.2) |
| `/produk/:slug` → `routes/Produk.tsx` | hero + CTAs, roles, demo facts/status, `#kasir` / `#analisis` merged notes, related cards, tour chapters, WA band | full 9-section template (§2.3) with `copy.ts` + `mini.tsx` |
| `/lab` → `routes/Lab.tsx` | grid, filters eco/status/minutes, URL sync, portfolio tools (PhoneFarm, ScrapPulse→Radar Isu) | hover/focus mini preview, restyle cards to home `Card` |
| `/karya` → `routes/Karya.tsx` | stub list + "Kini bagian dari …" cards for KasirKu, ScrapPulse | keep merged cards; make the page match home styling minimally (§2.7); full portfolio page stays deferred |
| Redirects in `router.tsx` | `/karya/kasirku`, `/tools`, `/tools/scrappulse` done and tested | verify anchor `#kasir` scrolls under the navbar; add `/produk/inti` (Q3) |
| `routeLoaders.ts` | loaders + preload for all routes | add nothing unless a new route appears |
| `content/i18n/eco.ts` | hub/detail/product/lab/karya strings ID+EN | extended by B1/B2 in their own new files (§4); eco.ts frozen except integrator |
| `Navbar.tsx`, `Footer.tsx` | no Ekosistem item; footer has merged-entry links | add Ekosistem dropdown + mobile menu; footer "Ekosistem" column |
| Home `Services`, `Ecosystem`, `Portfolio`, `Stats`, scene hero CTA (`i18n/home/scenes.ts`) | old studio services, 5-satellite "Panel" diagram, 3 old featured items, `SITE.stats` typed numbers | spec §4 home integration (§2.6) |

### 1.2 New files
| File | Owner | Content |
|---|---|---|
| `src/content/ecoNav.ts` | step 0 | eager-safe: `ECO_NAV = [{ id, name, to, audience: Bi }]` ×4 + tour `{ to: '/tur', title: Bi }` with region name; ≤ 1 KB. A type test in `content/ecoNav.check.ts` (not imported by home) asserts names equal `products.ts`. |
| `src/demos/<slug>/copy.ts` ×18 | B2 | `export const copy: ProductCopy` (type §3.1) |
| `src/demos/<slug>/mini.tsx` ×18 | B2 (P0–P7), B3 (P8–P17) | `export default function Mini(p: MiniProps)` |
| `src/demos/minis.ts` | step 0 | `MINIS: Record<ProductSlug, () => Promise<{ default: ComponentType<MiniProps> }>>`, `MiniProps = { playing: boolean; onCaption?(c: Bi): void }`, `COPIES: Record<ProductSlug, () => Promise<{ copy: ProductCopy }>>` |
| `src/demos/mini-kit.tsx` | step 0 (B2 may extend) | `useMiniScript(frames, playing)`: a tiny frame player on `gsap.ticker` (loop, pause, final-frame under reduced motion), `MiniFrame` (device frame wrapper: browser/phone/tablet, fixed 16:10 or 9:16 box, no layout shift) |
| `src/routes/produk/*.tsx` | B2 | section components of the template (§2.3) |
| `src/routes/eco/Constellation.tsx`, `FlowDiagram.tsx`, `EcoFaq.tsx` | B1 | hub hero, flow diagrams, FAQ accordion (reuse home FAQ pattern) |
| `src/content/ecoPages.ts` (+ `ecoPages.en.ts` lazy) | B1 | eco story, 3 benefits, buyer benefits, flow steps, eco FAQ |
| `src/styles/eco-site.css` | B1 (hub/eco/lab), `src/styles/produk.css` B2 | page styles on site tokens |
| `tests/e2e/tahap6/*.spec.ts` | each builder its own file; integrator `links.spec.ts` | §6 |

### 1.3 Step 0 (integrator, ≤ 30 min, before the builders)
1. Create `ecoNav.ts` + check, `minis.ts`, `mini-kit.tsx`, `ProductCopy` type in `src/demos/copy-types.ts`, a stub
   `copy.ts` (tagline-only, from `products.ts`) and a stub `mini.tsx` (static poster: icon + name) in all 18 folders, so
   every builder compiles from minute one and owns only replacements.
2. Add `constellation` flag to `lib/motion.ts`; add `tests/e2e/tahap6/` folder with the shared helpers (§6).
3. Commit "tahap6: step 0 contracts". Then start B1, B2, B3.

---

## 2 · Page specs

### 2.1 `/ekosistem` (B1)
Order of sections (each a home-style `Section` with `SectionHeader`, reveal kit):
1. **Hero = constellation** (replaces PageShell's plain hero but keeps its h1/eyebrow/lead/actions markup and the
   fireflies): night-dusk sky; Inti star at centre (lavender-white), 3 clusters (teal satu-daerah left/top, peach
   usaha-pintar right, plum pasar-daerah bottom), 17 product stars placed by a fixed table (no physics). Relation
   lines from `PRODUCT.related` (deduped; ≈ 35 lines) draw in on enter (stroke-dashoffset, 1.2 s stagger), eco hulls
   as faint ellipses. Hover/focus a star: mini card (icon, name, tagline, eco badge, "Lihat produk →") positioned
   inside the SVG box, its relation lines brighten, others dim to 0.25. Click/Enter: star scales 1→8 and the sky
   fades (300 ms, transform/opacity), then `navigate('/produk/<slug>')` through the normal curtain. Reduced motion:
   lines drawn, no zoom, plain navigation. Phones: constellation becomes a 4:5 box with clusters stacked; tap = show
   card, second tap or card button = go (no hover). Twinkle: 6 stars at a time, opacity only, `constellation` flag.
   SVG text equivalent: visually hidden `<ul>` of products grouped per eco.
   Actions: **"Mulai tur"** (→ `/tur`, primary) and **"Jelajahi produk"** (→ `#produk`, ghost). LCP = the h1 text.
2. **Tiga ekosistem** (`#produk`): 3 panels (Inti as a slim fourth band under them: "Fondasi bersama"). Each panel:
   audience, name, 2-line story, 3 benefits (check icons), product chips (→ `/produk/:slug`), CTA "Lihat ekosistem"
   (→ `/ekosistem/:eco`). Existing overview nav anchors `#satu-daerah` etc. keep working (ids on the panels).
3. **Bagaimana semuanya terhubung**: scroll-driven `FlowDiagram` of the flood example (spec §13): Siaga Wilayah
   (06.20 peringatan) → Sapa Warga (aduan warga) → Meja Pimpinan (briefing) → Naskah Pintar (disposisi) → Awas
   Belanja (pengadaan darurat) → Katalog Lokal (UMKM lokal) → Sinyal Pasar (harga stabil). 7 nodes, a pulse travels
   with ScrollTrigger scrub (desktop pinned ≤ 150 vh; phones: vertical list with a line that fills, no pin). Each node
   has time (from `tour.ts` chapter times), one sentence, link to the product. Ends with "Lihat langsung di tur, bab 2"
   (→ `/tur/2`). Text order = DOM order (accessible without the drawing).
4. **CTA tur** band (exists; restyle): "Satu Hari di {region}", ±8 menit, "Mulai tur", "Pilih bab" (→ `/tur?bab=list`
   only if Tahap 5 supports it, else `/tur`).
5. **FAQ ekosistem**: 5 items: pengadaan (cara membeli: konsultasi → demo personal → proposal; skema pengadaan
   dibahas sesuai aturan yang berlaku, no claim of e-Katalog), keamanan data (peran, audit log, enkripsi saat transit),
   server dalam negeri / on-premise (possible, discussed), integrasi sistem yang ada (API/ekspor, contoh: SIMDA-like
   generic wording, no brand claims), mulai dari satu produk (bisa, semua berbagi Inti). Home FAQ accordion pattern.
6. **CTA WhatsApp** band (exists).

### 2.2 `/ekosistem/:eco` (B1) for `satu-daerah`, `usaha-pintar`, `pasar-daerah`, `inti`
Hero: PageShell (eyebrow audience, h1 eco name, lead tagline, crumbs) with a small eco glyph (eco's cluster of the
constellation, static SVG, reused component with `cluster=<eco>`), actions "Mulai tur dari bab X" + "Hubungi kami".
Sections:
1. **Cerita** (new): 3 short paragraphs max (situation → what changes → result), from `ecoPages.ts`.
2. **Alur antarproduk** (new diagram, replaces the plain chapter list visually, keeps the list as its text): the eco's
   chapters from `chaptersOfEco(eco)` as a horizontal timeline (desktop) / vertical (phone) with product nodes and
   arrows; each step links to `/tur/<n>` ("Putar bab n") and chips link to products.
3. **Produk** (exists): eco product cards, now home `Card` style, each with "Coba demo" when READY.
4. **Untuk siapa** (new): 3–4 buyer types per eco (e.g. Satu Daerah: Kepala Daerah, Sekda/OPD, Diskominfo, BPBD;
   Usaha Pintar: pemilik toko multi-cabang, manajer sales, bank/koperasi, vendor pengadaan; Pasar Daerah: Dinkop UMKM,
   Disperindag, Bappeda, bank daerah) × one benefit line each and the products that serve them.
5. **Terhubung ke luar ekosistem** (exists), **Ekosistem lain** (exists), CTA band (exists).
**Inti variant:** Cerita = "satu akun, satu data, satu jejak"; the 4 Inti modules (Inti ID, Inti Agen, Inti Kanal,
Inti Data + Audit Log, spec P0) as 4 feature cards with static visuals; "Lihat jejak data" CTA → `/demo/inti` (READY
after Tahap 4) and `/tur/19`; product list = all 17 (exists, `compact`); no "Untuk siapa" (it's the platform: replace with
"Yang didapat setiap produk": SSO/roles, audit, AI agent, channels).

### 2.3 `/produk/:slug` template (B2) for 17 products (+ Inti, see Q3)
One component tree, data from `products.ts` (identity, roles, related, chapters), `copy.ts` (words), `registry.ts`
(READY), `tour.ts` (chapter titles/times). Sections in spec order:
1. **Hero:** crumbs (Ekosistem / eco badge), eyebrow `{eco} · {code}`, h1 full name (Fraunces), tagline, CTAs
   ("Coba demo penuh" primary → `/demo/:slug`, preload on intent; "Lihat di tur" → `/tur/<first chapter>`;
   "Hubungi kami" → WA prefill `Halo GAMADA, saya ingin tahu tentang {name}`). Right side (desktop) / below (phone):
   **mini-demo** in `MiniFrame` (frame kind from `products.ts.frame`), autoplays its loop silently while ≥ 50 %
   visible, pauses when not, static final frame under reduced motion + "Putar" button (44 px), caption line under the
   frame ("Simulasi · {caption}"). Box has fixed aspect ratio, so no CLS. LCP = h1, never the mini.
2. **Masalah:** 3 cards (title + 1–2 sentences) from `copy.problems`.
3. **Cara kerja:** 3 numbered steps from `copy.steps`, a line draws between them (stroke-dashoffset on reveal).
4. **Momen unggulan:** 2–3 features from `copy.highlights`, each = title, 2 sentences, and a visual: either a still
   of the mini at a named frame (`<Mini frame="alert" playing={false}/>`, same chunk, no new code) or an icon card.
   Do NOT import other product components here (size).
5. **Terhubung dengan:** mini graph: this product centre, `related` around (SVG, ≤ 6 nodes, eco-coloured), each node a
   link to `/produk/<slug>`; text list equivalent; one line per relation from `copy.relations[slug]` (optional; fall
   back to the related product's tagline).
6. **Untuk siapa:** `products.ts.roles` (exists) + one benefit line per role from `copy.roles[role]`.
7. **Keamanan & data:** 3 fixed blocks (hak akses per peran: list the product's roles; audit log: "setiap tindakan
   tercatat di Inti Audit" → `/demo/inti?tab=audit` when READY; server dalam negeri: "dapat dipasang …, dibahas saat
   konsultasi") + `copy.dataNote` (which data in the demo is real region data vs simulated).
8. **FAQ produk:** 4–6 items from `copy.faq` (accordion; ID/EN).
9. **CTA band:** "Coba demo penuh", "Lihat di tur (bab n · hh.mm)", "Hubungi kami". Plus **chapter list** (exists,
   restyled) above it when the product has > 1 chapter.
**Merged anchors** (keep, restyle): `#kasir` on Toko Autopilot ("KasirKu kini modul Kasir di Toko Autopilot", with a
"Buka modul Kasir" → `/demo/toko-autopilot?tab=kasir`) and `#analisis` on Radar Isu (ScrapPulse → mesin analisis,
"Buka analisis" → `/demo/radar-isu?tab=analisis`). Anchor targets get `scroll-margin-top` = navbar height; the hash
scroll runs after the lazy section mounts (test).
`<title>` = `{name} · GAMADA`, meta description = tagline. Unknown slug ⇒ NotFound (exists).

**Mini-demo contract (`mini.tsx`, B2/B3):** a real component with a short script (4–6 frames, 8–14 s loop) showing the
product's "momen wow" from spec §11, built from that product's pure-props components (Tahap 2–4 built them for this)
or kit atoms. No world store, no clock, no AI, no MapLibre, no network: data = a small constant fixture inside the
file ("Data simulasi" chip in the corner). Map products (Sapa Warga, Meja Pimpinan, Siaga Wilayah, Kenal Mitra,
Katalog Lokal, Indeks Ekonomi, Sinyal Pasar) draw a stylised SVG (kecamatan dots or a pre-simplified outline ≤ 4 KB
inlined), not tiles. Text inside the mini follows `lang`. Exposes `frame?: string` prop for stills. ≤ 15 KB gzip each
(target 10), measured alone; the mini must NOT import the product's `index.tsx`, its store or any lazy tab. The 18 wow
moments to show (one line each, from spec §11):
P0 jejak data lights across 6 products · P1 voice/WA aduan → tiket + cluster pin · P2 briefing card + "Tanya data"
answer · P3 notulen → disposisi cards · P4 hoax spike → klarifikasi draft · P5 rain cell → alert ring + recipients count
· P6 HPS vs pasar bar → flag · P7 berkas upload → checklist ticks + 1 mismatch · P8 kasir scan → stok turun → PO
draft · P9 nota foto → jurnal rows → status "rapi" · P10 call transcript → score + coaching tip · P11 KTP/NIB → match
% + badges · P12 mention spike → tone reply drafts · P13 tender found → dokumen checklist → skor peluang · P14 kebutuhan
→ 3 UMKM lokal cocok · P15 dial 0 → 710 + loan offer · P16 indikator tiles + kecamatan heat · P17 price shock → alert
→ operasi pasar dampens the line.

### 2.4 `/lab` (B1)
Keep everything (grid, filters, URL sync, portfolio tools, honest status). Changes: cards use home `Card`; on
hover/focus (desktop, pointer fine) a 220 ms-delayed preview loads `MINIS[slug]` into the card's art box and plays;
on leave it pauses (component kept mounted for the session, max 3 mounted, LRU unmount). Touch: no preview, static
icon art. Each card: "Buka demo" → `/demo/:slug`, "Halaman produk" → `/produk/:slug`. Filters ≥ 44 px, `aria-pressed`.
Heading count "{n} demo" from the registry.

### 2.5 Navbar + mobile menu (B3)
- Desktop: new item **"Ekosistem"** BEFORE "Karya" (spec order: Layanan, Ekosistem, Karya, Proses, FAQ, CTA). It is a
  link to `/ekosistem` with a dropdown using the SAME panel component/timings as the Karya dropdown: Satu Daerah,
  Usaha Pintar, Pasar Daerah, GAMADA Inti (each: name + audience line, eco dot colour), separator, "Tur: Satu Hari di
  {region}" (→ `/tur`), footer link "Semua produk & demo" (→ `/lab`). `aria-current` on `/ekosistem*`, `/produk/*`.
- Mobile menu: "Ekosistem" with the same 4 + tour as an expandable group (same pattern as Karya's group), 44 px rows,
  focus trap unchanged.
- Data from `ecoNav.ts` + nav strings in `i18n/id.ts` / `en.ts`. Measure home JS after (budget: +0.6 KB max).

### 2.6 Home integration (B3), spec §4
- **Hero CTA 2** (`i18n/home/scenes.ts` + `.en`): "Lihat demo ekosistem →" → `/ekosistem` (replaces the current second
  CTA; first CTA unchanged).
- **Services** (`#layanan` stays the anchor): becomes **3 ecosystem cards** (Satu Daerah, Usaha Pintar, Pasar
  Daerah) in the same Card + redrawing icon language: audience, name, 2-line pitch, 3 example products (chips),
  "{n} produk" from `ecoNav` counts, link → `/ekosistem/:eco`; a slim line under them "Dibangun di atas GAMADA Inti →".
  The studio services (website/app/automation) move to one sentence + link "Juga: website & aplikasi custom → /karya".
  Keep the WhatsApp strip.
- **Ecosystem section** (`sections/Ecosystem.tsx`): same diagram engine (lines, buttons, pinned panel, pulses), new
  node set = Inti centre + 3 ecos (4 nodes, simpler geometry), panel text per node from `i18n/home/ecosystem.ts`,
  CTA "Jelajahi ekosistem →" `/ekosistem`. Old 5-satellite copy removed.
- **Portfolio section**: 3 featured demos Sapa Warga, Siaga Wilayah, Toko Autopilot (spec), card art = existing
  `Arts.tsx` style SVG (new static art per demo, ≤ 3 KB each; NOT the mini, keep home light), links "Coba demo" →
  `/demo/:slug` and "Detail" → `/produk/:slug`. A text link "Portofolio studio lainnya → /karya".
- **Stats**: numbers computed: products = 17 (`PRODUCT_SLUGS.length - 1`), ecosystems = 3, interactive demos =
  count of READY (needs registry: pass via `ecoNav.ts` constant `DEMO_COUNT` updated by a check test that fails if it
  disagrees with `DEMO_READY`, so home never imports the registry), "Respons 24 jam" stays. `SITE.stats` keeps the
  old keys for /karya only.
- Testimonials stay as they are (already labelled "ilustrasi"; verify both languages).

### 2.7 Footer (B3)
New column **"Ekosistem"** (between Layanan and Portofolio): the 4 eco links + "Tur" + "Semua demo (/lab)". On phones
columns stack; 44 px rows. Existing merged-entry lines (KasirKu → Toko Autopilot, ScrapPulse → Radar Isu) stay.
Footer "Layanan" column links point to `/#layanan` and `/ekosistem` (no studio services that no longer exist on home).

### 2.8 `/karya` merge + redirects (B3)
- Cards "Kini bagian dari Toko Autopilot / Radar Isu" already exist: restyle to home Card, link targets
  `/produk/toko-autopilot#kasir` and `/produk/radar-isu#analisis` (verify anchors land).
- `/karya/kasirku` → `/produk/toko-autopilot#kasir` (exists); `/karya/scrappulse` → **add** redirect to
  `/produk/radar-isu#analisis` (today it renders the old KaryaDetail; the card no longer links there).
- `/tools` → `/lab`, `/tools/scrappulse` → `/demo/radar-isu?tab=analisis` (exist; keep query passthrough).
- `/produk/inti` → `/ekosistem/inti` (Q3 default).
- Navbar Karya dropdown counts use `workMenuTitle` (exists) so merged entries are not counted.
- The "page-building" note on /karya stays (full portfolio page is not Tahap 6 scope, see §8).

---

## 3 · Content plan

### 3.1 `ProductCopy` (per product `copy.ts`, ID + EN in one file, ~120–180 lines each)
```ts
export interface ProductCopy {
  pitch: Bi                       // 1 sentence under the tagline (hero lead 2nd line), ≤ 160 chars
  problems: [Card, Card, Card]    // Card = { title: Bi; body: Bi }, body ≤ 180 chars
  steps: [Card, Card, Card]       // "Cara kerja"
  highlights: Array<Card & { frame?: string }>  // 2–3; frame = mini still
  roles: Partial<Record<RoleId, Bi>>            // 1 benefit line per role in products.ts.roles
  relations?: Partial<Record<ProductSlug, Bi>>  // "Terhubung dengan" one-liners
  dataNote: Bi                    // what is real (region geography) vs simulated in the demo
  faq: Array<{ q: Bi; a: Bi }>    // 4–6
  miniCaption: Bi[]               // one per mini frame
}
```
Type-checked: `roles` keys ⊆ the product's roles, `relations` keys ⊆ `related`, `faq.length` 4–6 (a unit check in
`tests/e2e/tahap6/copy.check.ts` via tsx, or a type-level tuple).

### 3.2 Sources (in this order; nothing invented beyond them)
1. Spec §11 for the product: problem, flow steps, momen wow, roles, "cek lulus" (what the demo proves). This gives
   problems, steps, highlights, miniCaption almost directly.
2. `content/products.ts`: name, tagline, roles, related (relations one-liners).
3. The built sandbox (`src/demos/<slug>/strings.ts`, missions): exact feature names and button labels, so the page
   uses the same words the demo shows ("Proses nota", "Lihat jejak data").
4. `docs/products/kasirku.md` and `scrappulse.md` only for the `#kasir` / `#analisis` merged notes. The other
   `docs/products/*.md` are the OLD portfolio products: not sources for ecosystem copy.
5. Eco pages (`ecoPages.ts`, B1): spec §2, §3, §13 + products' taglines. FAQ ekosistem: honest generic answers (§2.1).
### 3.3 What must be written new
18 × `copy.ts` (B2 writes all 18, ID first then EN in the same pass; ≈ 2 600 words ID total), `ecoPages.ts` (≈ 900
words), home Services/Ecosystem/Portfolio/Stats strings (≈ 400 words), nav/footer labels (≈ 30). Rules: short
sentences, concrete nouns from the demo ("aduan banjir di Kanor", "nota kulakan"), no superlatives ("terbaik",
"revolusioner", "world-class"), no numbers that look like real results ("hemat 40 %") unless marked "simulasi" and
taken from the demo world. EN is a natural translation, not word-for-word; product names are not translated.
Bahasa: formal-friendly "Anda". `sepia`/stop-slop pass is NOT required (speed); the visual comparison reviewer flags
obviously stiff copy only.

---

## 4 · Builder split and ownership (no overlaps)

| Builder | Owns (create/edit) | Must not edit |
|---|---|---|
| **B1 · Ekosistem + Lab** | `routes/Ekosistem.tsx`, `routes/EkosistemDetail.tsx`, `routes/Lab.tsx`, `routes/eco/**`, `content/ecoPages.ts` + `.en.ts`, `styles/eco-site.css`, `tests/e2e/tahap6/ekosistem.spec.ts`, `lab.spec.ts` | EcoParts.tsx (read; additions go in `routes/eco/`), minis (consume via `MINIS`), Produk |
| **B2 · Produk** | `routes/Produk.tsx`, `routes/produk/**`, `demos/*/copy.ts` (all 18), `demos/{inti,sapa-warga,meja-pimpinan,naskah-pintar,radar-isu,siaga-wilayah,awas-belanja,cek-berkas}/mini.tsx`, `demos/mini-kit.tsx` (extend only, keep API), `styles/produk.css`, `tests/e2e/tahap6/produk.spec.ts` | other minis, eco/lab routes, home |
| **B3 · Situs** | `components/Navbar.tsx`, `components/Footer.tsx`, `content/ecoNav.ts` (values), `content/i18n/id.ts` + `en.ts` (nav/footer keys), `content/i18n/home/{services,ecosystem,portfolio,stats,scenes}*.ts`, `sections/{Services,Ecosystem,Portfolio,Stats}.tsx` + their css + `sections/portfolio/Arts.tsx`, `routes/Karya.tsx`, `router.tsx` (2 redirects), `routeLoaders.ts` (redirect preload lines), `demos/{toko-autopilot,pajak-beres,juara-jualan,kenal-mitra,pantau-merek,tenderpilot,katalog-lokal,rapor-usaha,indeks-ekonomi,sinyal-pasar}/mini.tsx`, `tests/e2e/tahap6/site.spec.ts` | scenes/WebGL, Home.tsx layout, products.ts |
| **Integrator** | step 0 files, `content/i18n/eco.ts`, `lib/motion.ts`, `tests/e2e/routes.spec.ts` (route list), `tests/e2e/tahap6/links.spec.ts`, `visual.spec.ts`, PERF.md / CONTRACTS notes, merge fixes | — |

Parallel: B1, B2, B3 start together after step 0. B1's Lab preview works with stub minis from minute one. Expected
time: B1 ≈ 3 h, B2 ≈ 3.5 h (copy is the long pole: 18 files), B3 ≈ 3 h. If B2 is behind at 3 h, the integrator writes
the remaining `copy.ts` EN halves (ID first everywhere).

---

## 5 · Size + perf plan (gzip -9, beyond home, budget script `.shots/t2-prep/budget.mjs`, prod build)

| Load | Contents | Target | Hard |
|---|---|---|---|
| Home initial JS | + nav dropdown, ecoNav, footer column | **≤ 253.6 KB** | 253.6 |
| Home `HomeSections` lazy chunk | new Services/Ecosystem/Portfolio/Stats | ≤ +4 KB vs now | +6 |
| `/ekosistem` first load | route + Constellation + FlowDiagram + FAQ + ecoPages (lang) + products/tour content | ≤ 45 KB | 60 |
| `/ekosistem/:eco` | route + FlowDiagram + ecoPages | ≤ 35 KB | 50 |
| `/produk/:slug` first load | route + template sections + `copy.ts` of that slug (split per slug via `COPIES[slug]()`) | ≤ 40 KB | 55 |
| `/produk/:slug` + mini (in view) | + `mini-kit` + `mini.tsx` | ≤ 55 KB total | 70 |
| `/lab` | route + cards | ≤ 30 KB | 40; each hover preview = that mini (≤ 15) |
| `/karya` | unchanged ± 2 KB | | |

Rules: `copy.ts` and `mini.tsx` are always reached through `import()` (`COPIES` / `MINIS`), never statically, so one
product's words never ship with another. The template must render the hero from `products.ts` while `copy` loads
(skeleton lines for sections 2–8, no layout jump in the hero). Preload on intent: hovering a ProductCard / star /
navbar item preloads the route chunk (AppLink already) AND `COPIES[slug]`. Perf: LCP `/produk/:slug` ≤ 2.5 s on
mobile slow-4G profile (Lighthouse mobile preset, 3 runs median) and `/ekosistem` ≤ 2.5 s; INP of star click / filter
click ≤ 200 ms; `npm run perf` home A/B vs the Tahap 5 commit: no regression (PERF.md method, 4 runs CPU 1× and 2×).
Add rows for `/ekosistem` and `/produk/sapa-warga` to PERF.md.

---

## 6 · Tests (`tests/e2e/tahap6/`, `@playwright/test`, fixtures from `tests/e2e/fixtures.ts`)

### 6.1 Routes (integrator, `routes.spec.ts` list + `tahap6/routes6.spec.ts`)
All 4 `/ekosistem/:eco`, all 18 `/produk/:slug` (loop over `PRODUCT_SLUGS`), `/ekosistem`, `/lab`, `/karya` render: 200,
one h1, no console errors, title not 404; in ID and `?lang=en` (EN: h1 text differs from ID or is a product name).
Unknown `/produk/xyz`, `/ekosistem/xyz` ⇒ 404 page.
### 6.2 Redirects
`/karya/kasirku` → `/produk/toko-autopilot#kasir` and `#kasir` is in viewport below the navbar · `/karya/scrappulse` →
`/produk/radar-isu#analisis` · `/tools` → `/lab` (query kept: `/tools?eco=usaha-pintar` → `/lab?eco=usaha-pintar`) ·
`/tools/scrappulse` → `/demo/radar-isu?tab=analisis` · `/produk/inti` → `/ekosistem/inti`.
### 6.3 Link crawl (integrator, `links.spec.ts`)
Start at `/`, `/ekosistem`, 4 eco pages, 18 product pages, `/lab`, `/karya`, and the open navbar dropdown + mobile menu
+ footer: collect every `a[href]` same-origin; for each unique path+hash: route resolves without 404 title, and if it
has a hash the element id exists after settle. External: only `wa.me` links (check `text=` param present). Fails list
every dead link with its source page.
### 6.4 Behaviour (builders)
- B1: constellation star click → `/produk/<slug>`; keyboard Tab reaches all 18 stars, Enter navigates; hover shows card
  with the right name; reduced motion ⇒ no transform transition; flow diagram nodes link correctly; Lab filters still
  pass the Tahap-1 cases and hover preview mounts a `[data-mini]` (desktop) and pauses on leave.
- B2: per slug: 9 sections present (by `data-sec` attr), FAQ count 4–6, no text matching `/Rp\s?\d|harga|price/i`
  outside "simulasi"-marked demo frames, mini mounts when scrolled into view and its loop stops when scrolled out
  (frame counter stops), "Coba demo penuh" href = `/demo/<slug>`, "Lihat di tur" href = `/tur/<first chapter>`.
- B3: navbar dropdown opens by hover/click/keyboard, `Esc` closes and returns focus, items order; mobile menu group at
  390 px; home hero CTA 2 → `/ekosistem`; Services shows 3 eco cards with counts equal to registry; Stats numbers equal
  registry (`17`, `3`, READY count); footer Ekosistem column links; home initial JS ≤ 253.6 KB (budget script in the
  gate, not in Playwright).
### 6.5 A11y basics (integrator, `a11y.spec.ts`)
`@axe-core/playwright` (already a devDependency? if not, ask before adding; fallback = the manual checklist in §0.6) on
`/ekosistem`, `/ekosistem/satu-daerah`, `/produk/sapa-warga`, `/produk/toko-autopilot#kasir`, `/lab`, `/` (navbar open):
0 serious/critical. Plus: every `button`/`a` in those pages ≥ 44×44 at 390 px (bounding box script, list exceptions).
### 6.6 Visual comparison vs home (one pass, spec §16 row 6)
Method: integrator captures `/` sections (Services, Portfolio, a PageShell page) and every new page at 1440 and 390,
ID, `?off=preloader`, reduced motion OFF but waited until reveals end. One reviewer agent (single pass, no re-score)
compares side by side using a fixed checklist: (1) heading font/size/weight scale matches home, (2) section padding +
max width match, (3) card style (radius, border, glow, hover tilt) is the home Card, (4) colour: dusk gradients and eco
accents only, no `--dk-*` surfaces outside device frames, (5) motion: reveal kit used, nothing snaps, (6) spacing on
phones (gutter 16–20 px), (7) copy obviously stiff or untranslated. Output: a fix list (max 15 items, each with file +
selector); builders' owners fix in one pass; then final screenshots to `docs/shots/demo/tahap6/` (each page 1440 + 390,
ID + EN; product pages: all 18 at 390 ID, 6 at 1440 ID+EN). Optional pixel aid: `tools/shot.mjs` for consistent
captures (no pixel-diff threshold; this is a judgement review).

### 6.7 Gate (integrator)
typecheck · build · `npm run region:validate` · all e2e (old + tahap6) · budget table §5 · home perf A/B · no console
errors · screenshots present · commit "tahap6: halaman situs" (small commits per builder before it). No push/deploy.

---

## 7 · Owner questions: ALL APPROVED by the owner on 2026-11-19 ("oke semua"); use the defaults exactly as written below (FAQ: no claims)

1. **Mini-demo di halaman produk = komponen asli yang diputar, tanpa peta sungguhan.** Setiap halaman produk memutar
   loop 8–14 detik dari komponen produk itu sendiri dengan data contoh kecil. Untuk produk berpeta, wilayah digambar
   sebagai SVG sederhana (titik kecamatan), bukan peta tile, supaya halaman tetap ringan. *Default: ya.*
2. **Section Portofolio di beranda diganti 3 demo unggulan.** Kartu PhoneFarm, Sistem Automasi, dan demo aplikasi
   pindah sepenuhnya ke `/karya`; beranda menampilkan Sapa Warga, Siaga Wilayah, Toko Autopilot plus tautan
   "Portofolio studio lainnya". Section Layanan menjadi 3 kartu ekosistem; jasa website/aplikasi custom tinggal satu
   baris dengan tautan ke `/karya`. *Default: ya.*
3. **GAMADA Inti punya satu halaman: `/ekosistem/inti`.** `/produk/inti` dialihkan ke sana, dan halaman itu memakai
   isi produk (modul Inti, jejak data, keamanan) ditambah daftar 17 produk. *Default: ya.*
4. **Statistik beranda diganti angka ekosistem.** Empat angka: 17 produk, 3 ekosistem, jumlah demo interaktif (dihitung
   dari registry), dan respons 24 jam. Angka lama (13 halaman & demo, 4 aplikasi, 3 proyek) tidak tampil lagi di
   beranda. *Default: ya.*
5. **FAQ ekosistem tanpa klaim yang belum benar.** Jawaban soal pengadaan, keamanan, server dalam negeri, dan integrasi
   ditulis umum dan jujur ("dapat …, dibahas saat konsultasi"), tanpa menyebut e-Katalog, sertifikasi, atau klien. Jika
   Anda punya fakta yang boleh disebut (mis. sudah tayang di e-Katalog), sebutkan. *Default: tanpa klaim.*

---

## 8 · Coverage checklist (§13, §4, §14) and deliberate deferrals

| Spec item | Where | Status |
|---|---|---|
| §4 routes `/ekosistem`, `/ekosistem/:eco` (4), `/produk/:slug`, `/lab`, lazy + loaders | exist; §2.1–2.4 | built/extended |
| §4 `/tools` → `/lab`, `/tools/scrappulse`, `/karya/kasirku` redirects | router | exist + tested §6.2 |
| §4 KasirKu / ScrapPulse cards on /karya → "Kini bagian dari …" | Karya.tsx | exist, restyle + `/karya/scrappulse` redirect added |
| §4 Navbar "Ekosistem" before Karya, dropdown 4 + separator + tour, mobile menu | §2.5 | B3 |
| §4 Home: Layanan 3 eco cards, Ecosystem teaser (3 + Inti), hero CTA 2, Portofolio 3 demos, stats from registry | §2.6 | B3 |
| §4 Footer column "Ekosistem" | §2.7 | B3 |
| §13 /ekosistem constellation (hover card, lines, zoom click, SVG+GSAP), 3 panels, flow, tour CTA, FAQ, WA | §2.1 | B1 |
| §13 /ekosistem/:eco story, flow diagram, cards, "Mulai tur dari bab X", benefits per buyer | §2.2 | B1 |
| §13 /produk 9 sections, `copy.ts`, `mini.tsx` live loop pausing off-screen | §2.3, §3 | B2 (+ B3 minis) |
| §13 /lab grid + filters eco/status/durasi + hover mini preview | §2.4 | B1 |
| §14 mobile 360–430, a11y, LCP ≤ 2.5 s, INP ≤ 200, home perf, reduced motion, `constellation` flag | §0.3–0.4, §5, §6 | all |
| §15 screenshots | §6.6 | integrator |
| §16 row 6 build → visual review vs home → fix | §6.6 | one pass |

**Deferred (on purpose, to Tahap 7 unless the owner says otherwise):**
- Wow audit (4 skeptical-client agents) for site pages; only the single visual comparison runs now.
- Full `/karya` portfolio redesign (spec §2.1 says the old products stay as portfolio; the page keeps its Tahap-1
  structure + restyled merged cards). `KaryaDetail` pages untouched.
- OGL/canvas particle background behind the constellation (SVG + existing Fireflies only; tier-low particles later).
- Pixel-diff visual regression baselines (spec §15 "perbandingan visual dengan baseline di tahap berikutnya" = Tahap 7).
- Region switch on site pages: product pages show `[DAERAH_1]` (Bojonegoro) wording; `[DAERAH_2]/[DAERAH_3]` packs are
  Tahap 7, and copy uses `{region}` placeholders so it will follow.
- SEO extras (sitemap entries for 18 product pages, JSON-LD Product) — small, listed for Tahap 7 polish; canonical +
  title + description are done now.
