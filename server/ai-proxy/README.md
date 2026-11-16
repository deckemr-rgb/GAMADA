# GAMADA AI proxy (`server/ai-proxy`)

Server kecil (Hono + TypeScript) yang menjadi satu-satunya jalan dari situs GAMADA ke Claude API
untuk **mode Live** Demo Kit (spec §9.3 dan §10). Server menyimpan system prompt per produk,
memvalidasi semua input dan output dengan zod, membatasi biaya dan laju permintaan, serta tidak
pernah me-log isi pesan atau dokumen.

Situs tetap berjalan penuh tanpa proxy ini, karena mode Simulasi adalah bawaannya. Bila proxy
mati, kunci API tidak ada, anggaran habis, atau terjadi 429/5xx, klien otomatis kembali ke simulasi.

```
site (Vite)  ──POST /api/ai/chat (SSE)──▶  ai-proxy (Hono)  ──@anthropic-ai/sdk──▶  Claude API
             ──POST /api/ai/extract──────▶   zod · CORS · rate limit · token budget · prompts/<slug>.ts
             ──GET  /api/ai/health───────▶
```

## Cara menjalankan

Butuh Node 22. Semua perintah dijalankan dari `server/ai-proxy/`.

```bash
npm install                 # hanya di folder ini (paket terpisah dari situs)

npm run dev:mock            # mode tiruan: tanpa kunci, tanpa jaringan → http://127.0.0.1:8787
npm run dev                 # mode sungguhan: isi .env dulu (cp .env.example .env → ANTHROPIC_API_KEY)

npm run typecheck           # tsc --noEmit
npm test                    # self-test (69 cek, tanpa jaringan; termasuk server Claude palsu lokal)
npm run build && npm start  # build ke dist/ lalu jalankan dengan Node
```

Dari root situs ada pintasan: `npm run ai:install`, `npm run ai:mock` (proxy tiruan di 8787),
`npm run ai:dev` (proxy sungguhan, `.env` di folder ini), dan `npm run ai:test` (self-test proxy +
semua tes `src/demo-kit/ai/__tests__`, termasuk tes integrasi yang menyalakan proxy tiruan sungguhan).

**Menghubungkan situs** (`.env.local` di root situs, lihat `.env.example` di root):

- `VITE_AI_PROXY_URL=` (kosong) → same origin `/api/ai/*`. Saat `npm run dev`, `vite.config.ts`
  meneruskan `/api/ai` ke `http://127.0.0.1:8787`, jadi cukup jalankan `npm run ai:mock` di terminal lain.
- `VITE_AI_PROXY_URL=https://ai.domainanda.id` → proxy yang sudah di-deploy. `ALLOWED_ORIGINS` harus
  memuat origin situs (bawaannya sudah mengizinkan `localhost`/`127.0.0.1` port 5173 dan 4173).
- Variabel tidak ada → Live mati dan tidak ada permintaan sama sekali (situs tetap di Simulasi).

Uji cepat dengan curl:

```bash
curl http://127.0.0.1:8787/api/ai/health
curl -N -X POST http://127.0.0.1:8787/api/ai/chat -H "content-type: application/json" \
  -d '{"product":"sapa-warga","role":"warga","lang":"id","messages":[{"role":"user","content":"Dalan ing desa kula kebanjiran"}]}'
curl -X POST http://127.0.0.1:8787/api/ai/extract -F product=cek-berkas -F kind=ktp-specimen -F image=@spesimen.png
```

## Protokol SSE

Satu-satunya dokumentasi protokol kabel antara situs dan proxy (ketiga endpoint). Pengurainya di sisi
situs adalah `src/demo-kit/ai/live.ts`, dan provider + fallback-nya ada di `src/demo-kit/ai/provider.ts`.
Bila protokol berubah, ubah kedua sisi bersamaan lalu jalankan `npm run ai:test` dari root situs.

| Method | Path | Isi |
|---|---|---|
| GET | `/api/ai/health` | JSON health (di bawah). Tidak dihitung rate limit. |
| POST | `/api/ai/chat` | Body JSON ≤ 64 KB: `{ product, role?, lang?, messages, context? }` → **SSE** |
| POST | `/api/ai/extract` | `multipart/form-data` (`product`, `kind`, `lang?`, `image` ≤ 8 MB **atau** `text`) atau JSON `{ product, kind, text }` → JSON `Extracted` |

`product` wajib salah satu dari 18 slug terdaftar (`src/products.ts`, harus sama dengan
`src/content/products.ts`; `npm test` gagal bila keduanya berbeda). Slug lain menghasilkan 400.

### Health

```jsonc
{ "ok": true, "live": true, "mock": false,
  "models": { "fast": "claude-haiku-5-5", "smart": "claude-sonnet-5-5", "extract": "claude-sonnet-5-5" },
  "reason": "no_api_key" }            // hanya bila live:false: "no_api_key" | "budget_exhausted"
```

Klien (`checkHealth()`) memberi timeout 3 detik, menyimpan hasil 60 detik bila `live` dan 15 detik
bila tidak, dan mengembalikan bentuk yang sama: `{ ok, live, mock, models | null, reason? }`. Bila proxy
tidak terjangkau, klien mengisi `ok:false, live:false, reason:"unreachable"`, dan bila
`VITE_AI_PROXY_URL` tidak disetel, `reason:"not_configured"`. Toggle Live hanya ditawarkan bila `live:true`.

### Chat request

```jsonc
{
  "product": "sapa-warga",
  "role": "warga",                     // RoleId situs (opsional)
  "lang": "id",                        // bahasa antarmuka: id | en (bawaan id)
  "messages": [{ "role": "user", "content": "…" }],   // 1–40 pesan, ≤ 4000 karakter, terakhir = user
  "context": {
    "region": { /* cuplikan region pack: stabil → di-cache (≤ 40 KB) */ },
    "world":  { /* ringkasan state dunia ±6 KB (≤ 12 KB) */ }
  }
}
```

`context` tanpa kunci `region`/`world` diperlakukan seluruhnya sebagai `world`. Klien tidak mengirim
`tools`: alat ditentukan oleh server per produk. Klien memangkas riwayat sebelum mengirim (pesan
kosong dibuang, ≤ 4000 karakter per pesan, maksimal 40 pesan terbaru dalam ±48 KB) dan meringkas
`context` menjadi ±6 KB, sehingga permintaan normal tidak pernah kena 400/413.

### Event stream (`text/event-stream`)

Setiap event berisi baris `event: <nama>`, `data: <JSON satu baris>`, dan `id: <n>`, lalu baris kosong.
Nama event sama dengan `data.type`. Kecuali `error`, setiap `data` adalah `AiChunk` dari
`src/demo-kit/ai/types.ts` (`done` membawa beberapa field tambahan). Klien memakai nama event, dan
event yang tidak dikenal serta baris komentar `:` diabaikan, sehingga event baru bisa ditambahkan
tanpa merusak klien lama.

| event | data | arti |
|---|---|---|
| `text` | `{ "type": "text", "text": "…" }` | potongan token jawaban, ditampilkan saat tiba |
| `tool_call` | `{ "type": "tool_call", "call": { "id", "name", "input" } }` | langkah agen yang terlihat (chip "langkah agent", Inti Agen) |
| `structured` | `{ "type": "structured", "value": { "kind", "data" } }` | hasil terstruktur, selalu tepat setelah `tool_call` miliknya |
| `followups` | `{ "type": "followups", "chips": ["…"] }` | 1–3 chip pertanyaan lanjutan (dari alat `suggest_followups`, tanpa `tool_call`) |
| `done` | `{ "type": "done", "mode": "live", "model", "stopReason", "usage": { input, output, cacheRead, cacheWrite }, "mock"?, "budgetExhausted"? }` | akhir jawaban; klien hanya memakai `mode` (+ `intentId`/`confidence` bila ada) |
| `error` | `{ "type": "error", "code", "message", "retryable" }` | kegagalan di tengah stream, lalu stream ditutup |

Urutan khas: `text`… `tool_call` `structured` `text`… `followups` `done`. Setelah `done` klien berhenti
membaca.

Keluaran terstruktur (tiket, klasifikasi, disposisi, skor, dll.) dikirim lewat **tool use**. Proxy
memvalidasi input setiap alat dengan zod (`src/schemas.ts`). Input yang tidak valid tidak pernah
diteruskan ke browser; input itu dikembalikan ke model sebagai `is_error` untuk diperbaiki
(maksimal `AI_MAX_TOOL_ROUNDS` putaran). Klien tetap memvalidasi ulang (spec §9.3) dengan
`STRUCTURED_SCHEMAS` di `live.ts`, cermin field-demi-field dari skema alat di sini. Tes
`src/demo-kit/ai/__tests__/structured-parity.test.ts` gagal bila kedua daftar berbeda (jenis, field,
batas, enum), jadi ubah keduanya bersamaan. Produk boleh mendaftarkan skema yang lebih ketat dengan
`registerStructuredSchema(kind, …)`, tetapi skema itu harus tetap menerima bentuk dari proxy.

**Perilaku klien saat gagal** (`createLiveProvider`, otomatis):

- Tidak ada event pertama dalam 10 detik (`DEMO.liveFirstTokenTimeoutMs`), HTTP ≥ 400 (termasuk error JSON
  di bawah), jaringan putus, respons 200 yang bukan `text/event-stream`, data SSE rusak, atau event
  `error` → simulasi melanjutkan giliran itu dan toast "AI Live sedang sibuk, beralih ke Simulasi" muncul.
- Bila teks live sudah tampil, teks itu dibiarkan dan hanya bagian non-teks simulasi (langkah,
  structured, chip) yang ditambahkan. `structured` yang tidak lolos validasi diganti structured simulasi.
- Keputusan pemilik: **setiap** fallback, termasuk yang terjadi di tengah jawaban live, diakhiri dengan
  `done = { mode: "sim", fellBack: true }`, sehingga lencana tidak pernah menyebut "Live" untuk jawaban
  yang diselesaikan simulasi.
- Pembatalan oleh pengguna (reset/navigasi) menghentikan stream tanpa fallback dan tanpa toast.
- *Reduced motion* tetap menampilkan teks secara streaming karena ini konten, bukan animasi. Yang
  dimatikan hanya animasinya.

### Extract

Respons 200 berisi tepat `Extracted` dari `src/demo-kit/ai/types.ts`, divalidasi ulang oleh klien
(`ExtractedSchema` di `live.ts`, ikut dicek tes parity):

```jsonc
{ "kind": "ktp-specimen",
  "fields": [{ "key": "nik", "label": { "id": "NIK", "en": "ID number" }, "value": "…", "confidence": 0.97,
               "box": { "x": 22, "y": 14, "w": 46, "h": 6 } }],      // box dalam % halaman (0–100), opsional
  "checks": [{ "id": "specimen_mark", "label": { "id": "…", "en": "…" }, "status": "ok", "note": "…" }],
  "tamper": [{ "x": 60, "y": 20, "w": 10, "h": 8, "score": 0.12 }],  // opsional, skor 0..1
  "mode": "live" }
```

Klien mengirim `multipart/form-data` dengan `product`, `kind`, `text?`, dan `image?` (≤ 8 MB, dicek
sebelum dikirim). Model bawaannya `AI_MODEL_EXTRACT`, yaitu `AI_MODEL_SMART` (keputusan pemilik). Bila
gagal, klien memakai ekstraksi simulasi produk itu. Mode tiruan menandai respons dengan header
`X-AI-Mock: 1`; badannya tetap `Extracted` murni.

| `structured.kind` | alat | produk |
|---|---|---|
| `ticket`, `checklist` | create_ticket, service_checklist | sapa-warga |
| `query`, `instruction` | query_world, issue_instruction | meja-pimpinan (`query` juga indeks-ekonomi) |
| `minutes`, `classification`, `disposition` | extract_minutes, classify_letter, draft_disposition | naskah-pintar |
| `sentiment`, `clarification` | assess_mention, draft_clarification | radar-isu |
| `alert` | draft_alert | siaga-wilayah |
| `risk` | assess_procurement | awas-belanja |
| `doc-check` | check_documents | cek-berkas |
| `po` | draft_po | toko-autopilot |
| `ledger` | categorize_transaction | pajak-beres |
| `score` | score_call | juara-jualan |
| `kyc` | kyc_decision | kenal-mitra |
| `clusters`, `reply` | cluster_feedback, draft_reply | pantau-merek |
| `win-score` | estimate_win | tenderpilot |
| `need-spec` | need_spec | katalog-lokal |
| `business-score` | explain_score | rapor-usaha |
| `insight` | econ_insight | indeks-ekonomi |
| `price-alert` | price_alert | sinyal-pasar |
| `plan` | plan_agents | inti |
| `followups` | suggest_followups (semua produk) | → chip `followups` di klien |

`query_world` tidak dieksekusi di server. Proxy hanya meneruskan spesifikasi kueri yang sudah
di-whitelist; layar situs yang menghitung dan menggambar grafiknya.

### Error JSON

Kesalahan yang terjadi sebelum stream dimulai dikembalikan sebagai JSON
`{ "error": { "code", "message", "retryable", "issues"? } }`:

| status | code | arti untuk klien |
|---|---|---|
| 400 | `invalid_request`, `invalid_json`, `invalid_body` | bug klien; klien tetap jatuh ke simulasi |
| 403 | `origin_not_allowed` | origin tidak ada di `ALLOWED_ORIGINS` |
| 413 | `payload_too_large` | chat > 64 KB, unggahan > 8 MB |
| 415 | `unsupported_media_type` | bukan JPEG/PNG/WebP/GIF/PDF (dicek dari magic bytes) |
| 429 | `rate_limited`, `upstream_rate_limited` | → simulasi (`Retry-After` diisi) |
| 502 | `invalid_output`, `upstream_bad_request`, `upstream_model_not_found` | → simulasi |
| 503 | `not_configured`, `budget_exhausted`, `upstream_unavailable`, `upstream_auth`, `upstream_unreachable` | → simulasi |
| 504 | `upstream_timeout` | → simulasi |

Klien memperlakukan setiap status ≥ 400 sebagai alasan untuk jatuh ke simulasi (`FallbackInfo.reason = "http"`,
`status`). `code` dibaca ke `LiveError.code` untuk keperluan log.

Bila Claude gagal sebelum token pertama, proxy menahan respons agar klien menerima status HTTP
yang sebenarnya, bukan SSE 200 yang kosong.

## Model, prompt, dan caching

- `prompts/<slug>.ts` (18 file) + `prompts/_shared.ts` berisi peran AI di produk, cakupan topik,
  format keluaran (alat mana untuk apa), gaya bahasa (sopan, ringkas, Bahasa Indonesia baku-ramah,
  mengikuti bahasa pengguna termasuk bahasa daerah dengan baris "Terjemahan:", EN bila pengguna
  menulis EN), aturan data (semua entitas fiktif, angka hanya dari konteks, pejabat disebut dengan
  jabatan), dan batasan. Prompt ekstraksi ada di `prompts/index.ts` (`EXTRACT_SYSTEM`).
- **Tier:** `fast` = `AI_MODEL_FAST` (chat). `smart` = `AI_MODEL_SMART` untuk meja-pimpinan,
  naskah-pintar, radar-isu, awas-belanja, juara-jualan, tenderpilot, rapor-usaha, dan indeks-ekonomi.
- **Prompt caching:** `tools` + system prompt produk (breakpoint 1) + blok `<konteks_region>`
  (breakpoint 2) membentuk prefix yang byte-stabil (kunci JSON diurutkan). Ringkasan dunia dan blok
  sesi diletakkan di pesan user terakhir, setelah semua breakpoint, sehingga perubahan dunia tidak
  membatalkan cache. Prefix di bawah ukuran minimum yang bisa di-cache untuk model tersebut tidak
  di-cache (`cacheRead: 0`); hal ini aman. Periksa `usage.cacheRead` di event `done`.
- Thinking adaptif bawaan model dibiarkan aktif. Kedalamannya diatur dengan `output_config.effort`
  (`AI_EFFORT_*`, bawaan `low`) agar token pertama tetap jauh di bawah batas fallback 10 detik di klien.

## Variabel lingkungan

| Variabel | Bawaan | Keterangan |
|---|---|---|
| `ANTHROPIC_API_KEY` | (kosong) | Tanpa kunci: `live:false`, chat/extract 503 `not_configured` |
| `ANTHROPIC_BASE_URL` | SDK | Gateway opsional (juga dipakai self-test) |
| `AI_MODEL_FAST` | `claude-haiku-5-5` | Model chat |
| `AI_MODEL_SMART` | `claude-sonnet-5-5` | Briefing, notulen, analisis |
| `AI_MODEL_EXTRACT` | = `AI_MODEL_SMART` | Model vision `/extract` (keputusan pemilik: model smart) |
| `AI_EFFORT_FAST` / `AI_EFFORT_SMART` | `low` / `low` | `low` \| `medium` \| `high` |
| `AI_MAX_OUTPUT_TOKENS` | `2048` | Per giliran model, termasuk thinking |
| `AI_MAX_TOOL_ROUNDS` | `3` | Giliran model per jawaban chat |
| `AI_DAILY_TOKEN_BUDGET` | `2000000` | Token per hari, reset 00:00 WIB; `0` = tanpa batas |
| `RATE_LIMIT_PER_IP` | `20` (`1000` saat mock) | Per jendela, hanya chat + extract |
| `RATE_LIMIT_WINDOW_SEC` | `600` | Jendela 10 menit |
| `ALLOWED_ORIGINS` | localhost:5173/4173 | Daftar origin persis, dipisah koma; `*` = semua (jangan di produksi) |
| `TRUST_PROXY` | node: `0`; Vercel/Netlify/Workers: `1` | Ambil IP klien dari header proxy |
| `REDIS_URL` / `REDIS_TOKEN` | (kosong) | Upstash-compatible REST, lihat di bawah |
| `AI_MOCK` | `0` | `1` = jawaban tiruan deterministik |
| `AI_MOCK_DELAY_MS` | `15` | Jeda per kata di mode tiruan |
| `LOG_LEVEL` | `info` | `silent` mematikan log permintaan |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | Adapter Node |

## Rate limit, anggaran, dan Redis

- **Rate limit:** jendela tetap per IP (IP di-hash FNV-1a dan tidak pernah disimpan mentah), header
  `RateLimit-*` dan `Retry-After`. Endpoint health tidak dihitung.
- **Anggaran harian:** token yang dihitung = input + cache write + output + cache read / 10. Bila
  habis: health `live:false`, chat/extract 503 `budget_exhausted` (klien jatuh ke simulasi). Jawaban
  yang sedang berjalan menyelesaikan giliran modelnya lalu berhenti dengan `done.budgetExhausted`.
- **Penyimpanan penghitung:** bawaannya di memori, cukup untuk satu kontainer VPS. Untuk serverless
  (Vercel, Netlify, Workers), memori hanya berlaku per instance, jadi pakai `REDIS_URL`:
  - format: URL REST **Upstash-compatible** `https://<db>.upstash.io`, token di `REDIS_TOKEN`
    (atau `UPSTASH_REDIS_REST_TOKEN`, atau sebagai password di URL `https://default:<token>@host`);
  - dipanggil dengan `fetch` biasa (`/pipeline` dengan `INCRBY` + `EXPIRE … NX`, serta `GET`), tanpa
    dependensi klien redis, sehingga jalan di semua runtime;
  - `redis://` / `rediss://` (TCP) **tidak didukung**: proxy mencatat peringatan dan memakai memori;
  - bila Redis gagal (timeout 1,5 detik), permintaan tetap jalan dengan penghitung memori dan satu
    peringatan dicatat di log.

## Mode tiruan (`AI_MOCK=1`)

Tanpa kunci dan tanpa jaringan. Mode ini memakai format kabel yang sama (`done.mock: true`, model
`"mock"`) dan hasilnya deterministik. Health melaporkan `live:true` agar toggle Live bisa diuji.
Penanda berikut bisa diletakkan di pesan user terakhir untuk pengujian Playwright:

| penanda | perilaku |
|---|---|
| `[mock:slow]` | token pertama setelah 12 detik (menguji fallback 10 detik) |
| `[mock:error]` | beberapa token, lalu event `error` |
| `[mock:invalid]` | `tool_call` + `structured` dengan data yang tidak lolos skema (menguji fallback validasi klien) |
| `[mock:429]` | HTTP 429 sebelum stream |
| `[mock:budget]` | HTTP 503 `budget_exhausted` |

`/extract` di mode tiruan mengembalikan `Extracted` tetap per `kind`, dengan header `X-AI-Mock: 1`.

## Deploy

### 1. VPS: Docker + Caddy (disarankan)

```bash
cd server/ai-proxy
cp .env.example .env      # isi ANTHROPIC_API_KEY, ALLOWED_ORIGINS, AI_DOMAIN=ai.domainanda.id
docker compose up -d --build
curl https://ai.domainanda.id/api/ai/health
```

Image `node:22-alpine` dibangun multi-stage dan berjalan sebagai user `node` (uid 1000). Kode
dimiliki root, sehingga aplikasi hanya bisa membacanya. Kontainer berjalan dengan `read_only`,
`cap_drop: ALL`, `no-new-privileges`, batas memori 256 MB, dan healthcheck. Caddy mengurus TLS
otomatis, `flush_interval -1` untuk SSE, batas body 9 MB, dan hanya meneruskan `/api/ai/*`. Port
8787 tidak dibuka ke luar. Compose menyetel `TRUST_PROXY=1` karena Caddy menimpa `X-Forwarded-For`.

### 2. Vercel

Root Directory proyek = `server/ai-proxy`. `api/[...route].ts` menangkap `/api/ai/*` dan meneruskan
ke `src/vercel.ts` (handler Web `GET`/`POST`/`OPTIONS`); `maxDuration` 60 detik ada di
`vercel.json`. Isi env di Project Settings, dan setel `REDIS_URL` agar rate limit/anggaran berlaku
global. IP klien dibaca dari `X-Real-IP`.

### 3. Netlify

Base directory = `server/ai-proxy`. `netlify.toml` memakai `netlify/functions/ai-proxy.ts` (Functions
v2, path `/api/ai/*`, mendukung streaming). Folder publish `netlify/public` sengaja hampir kosong agar
kode sumber dan prompt tidak ikut tersaji. IP klien dibaca dari `X-Nf-Client-Connection-Ip`.

### 4. Cloudflare Workers

```bash
cd server/ai-proxy
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy        # main = src/worker.ts (lihat wrangler.toml)
```

`wrangler` tidak dimasukkan sebagai dependensi; jalankan dengan `npx`. Env diambil dari binding
`[vars]` dan secret. Pakai `REDIS_URL` karena memori hanya berlaku per isolate. IP klien dibaca dari
`CF-Connecting-IP`.

Di setiap target, pastikan `ALLOWED_ORIGINS` berisi origin situs produksi, lalu setel
`VITE_AI_PROXY_URL` situs ke URL proxy.

## Catatan keamanan

- **Validasi zod** untuk semua body, ukuran konteks, dan setiap keluaran alat model. Slug yang tidak
  terdaftar ditolak.
- **Batas ukuran:** chat 64 KB, unggahan 8 MB (+ overhead multipart), pesan ≤ 4000 karakter dan ≤ 40
  pesan. Tipe file dicek dari magic bytes, bukan dari `Content-Type` yang dikirim klien.
- **CORS allowlist** (`ALLOWED_ORIGINS`). POST dari origin asing ditolak 403, bukan sekadar tidak
  bisa dibaca.
- **Header keamanan:** `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `nosniff`,
  HSTS, `Referrer-Policy: no-referrer`, `X-Frame-Options`, COOP, dan `Cache-Control: no-store`.
- **Log hanya metadata:** satu baris JSON per permintaan berisi route, status, durasi, produk, jenis,
  model, jumlah token (input/output/cache), jumlah tool call, ukuran byte, MIME, request id, dan hash
  IP. Isi pesan, konteks, teks dokumen, dan gambar **tidak pernah** di-log.
- Prompt hanya ada di server. Konteks dan isi dokumen dari klien ditandai sebagai DATA di prompt,
  dan instruksi di dalamnya diabaikan (mitigasi prompt injection). Alat model hanya mengembalikan
  data dan tidak menjalankan aksi apa pun di server.
- `ANTHROPIC_API_KEY` hanya dibaca dari env/secret dan tidak pernah dikirim ke klien. `.env` sudah
  di-gitignore.
- Anggaran token harian dan rate limit membatasi biaya bila URL proxy tersebar.

## Struktur

```
src/app.ts        Hono app factory (middleware, 3 endpoint)
src/claude.ts     panggilan Claude: stream + loop alat, vision extract, pemetaan error
src/schemas.ts    zod: request, 25 alat (24 structured kind + followups), Extracted, event SSE, toolEvents()
src/mock.ts       AI_MOCK
src/budget.ts     anggaran token harian (WIB)
src/ratelimit.ts  rate limit per IP
src/kv.ts         penghitung memori / Upstash REST
src/config.ts     pembacaan env
src/log.ts        log metadata + hash IP
src/products.ts   salinan slug/peran/nama produk
src/node.ts · src/vercel.ts · src/netlify.ts · src/worker.ts   adapter
api/[...route].ts · netlify/functions/ai-proxy.ts               entry Vercel / Netlify
prompts/<slug>.ts (18) · prompts/_shared.ts · prompts/index.ts
test/selftest.ts  npm test
```
