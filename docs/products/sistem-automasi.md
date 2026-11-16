# Sistem Automasi

An Instagram Business/Creator content suite with three queued engines (AI comment replies, 9:16 news-style video editing, and scheduled Reels publishing) connected through the official Instagram Graph API.

## Persona
- **Sari Wulandari (non-technical)**: Owner of a home bakery in Bekasi, 38, runs an IG Business account with 4,200 followers from a mid-range Android phone, posts 3 Reels a week. Tujuan: Have friendly replies drafted for 'harga berapa kak?' comments within minutes, and schedule this week's Reels for 19:00 WIB without staying online
- **Bayu Saputra (power user)**: Freelance social media manager in Depok handling 6 client IG accounts, edits on a laptop, needs bulk work. Tujuan: Turn 10 source clips into 1080x1920 Reels with hooks in one batch, queue them across 6 accounts, and confirm each is actually live with a permalink
- **Gilang (operator/admin)**: GAMADA owner running the Celery workers, Redis and MinIO on a VPS. Tujuan: Watch queue depth, worker health, per-account publishing quota and LLM spend; pause an engine or a tenant instantly when something misbehaves

## Journey pengguna
- Sari signs up, clicks 'Hubungkan Instagram', completes Facebook Login for Business, and sees her account @dapursari connected with its token expiry date
- Sari opens Auto Komen, picks tone 'Ramah', sets mode 'Tinjau dulu', and sees 7 new comments from her latest Reel with AI-drafted replies she approves in one tap
- The LLM API times out; drafts come from her comment bank ('Halo kak, info harga sudah kami DM ya 🙏') marked 'bank lokal'
- Bayu pastes a source link of a clip from his client's own TikTok, gets 3 hook lines, edits line 2, picks intro/outro templates and renders; the preview MP4 is 1080x1920
- Bayu bulk-uploads 10 MP4s (up to 300MB each) and pastes 10 caption lines, so line N maps to file N, then schedules them across 6 accounts at 19:00 WIB
- At 19:00 the scheduler creates the media container, polls until FINISHED, publishes, and the job card shows 'Tayang' with the IG permalink; one fails with a 'video codec' error and shows a 'render ulang' action
- Sari's token nears expiry (7 days left); she gets an email and a banner 'Sambungkan ulang'; after expiry, queued uploads pause instead of failing silently
- Gilang sees 2 workers offline on /admin, restarts them, and jobs resume from the queue without duplicates

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| 3 engines with a job queue (Celery + Redis), POST /api/start-job | POST /api/start-job {engine: comment|edit|upload, accountId, payload} validated by pydantic/zod, returning {jobId} with 202; Celery queues per engine with acks_late, retries with backoff, idempotency key header; GET /api/jobs/:id plus an SSE stream of status queued->running->succeeded|failed with progress % | pytest: invalid engine -> 422; the same Idempotency-Key twice -> same jobId; killing a worker mid-task -> task re-delivered and completes exactly once (1 DB result row); load test 50 concurrent start-job calls all reach a terminal state |
| Auto Komen: AI comments with 3 tone options and a local comment bank fallback (LLM e.g. DeepSeek) | Reads comments and @mentions on the connected account's own media via Graph API (webhook + 5-min poll fallback); LLM generates reply drafts with tone ∈ {ramah, profesional, santai}, ≤150 chars, in the commenter's language; modes 'tinjau dulu' or 'otomatis'; per-tenant comment bank with keyword rules (harga, alamat, ongkir, COD) used when the LLM fails or times out after 8s; replies sent via POST /{comment-id}/replies; already-replied comments never answered twice; moderation actions hide/unhide | pytest with mocked Graph API: 10 new comments -> 10 drafts; tone parameter changes the system prompt; LLM mocked timeout -> draft.source='bank' within 9s; webhook redelivered twice -> exactly 1 reply call per comment; Playwright: approve-all sends 7 replies and the list shows 'Terkirim' |
| Auto Edit Video: paste an IG/TikTok/YouTube link, download (yt-dlp), generate a 3-line news-style hook, render 9:16 1080x1920 single-pass ffmpeg with overlay and intro/outro | Link import via yt-dlp (max 10 min, best ≤1080p) plus direct file upload; source URL stored and an optional source credit line rendered in the outro and appended to the caption; LLM hook generator returning exactly 3 lines ≤42 chars each (editable); one ffmpeg filter_complex call that scales/pads to 1080x1920, burns the hook overlay with Inter font, and concats the intro/outro templates; preview thumbnail + MP4 in MinIO | pytest: fixture 16:9 clip -> ffprobe reports 1080x1920, h264/aac, duration = intro+clip+outro ±0.2s; render log shows exactly one ffmpeg invocation; hook endpoint returns 3 lines each ≤42 chars; an unsupported URL returns 'Tautan tidak didukung' |
| Auto Upload: pick file, caption per line, verify the reel posted, large files via signed URL, 300MB max upload | Browser uploads directly to MinIO via presigned multipart PUT (client rejects >300MB before upload; server re-checks); caption textarea where line N maps to file N with a count mismatch warning; publish flow = create REELS container with video_url (presigned GET 1h) -> poll status_code every 10s up to 10 min -> media_publish -> GET permalink; scheduling via a scheduler at chosen WIB time; checks content_publishing_limit before each publish | Playwright: a 301MB file is rejected client-side with no network PUT; 3 files + 3 caption lines -> 3 jobs with matching captions; pytest with mocked Graph: container IN_PROGRESS x3 then FINISHED -> published with permalink stored; ERROR -> job failed with Graph error message; scheduled job does not run before its time (fake clock) |
| Tools hub cards: Auto Komen & Like (available), Auto Edit Video (available), Auto Upload (coming soon), Edit->Upload->Komen pipeline (coming soon) | Hub /tools rendering cards from a feature registry whose status (available | coming_soon | maintenance) is derived from feature flags and a live engine health check; card labels match actual capability (Graph API exposes reply/hide but no like endpoint, so the first card reads 'Auto Komen & Moderasi'); once Auto Upload and the pipeline ship, their flags flip to available; pipeline = chained jobs edit->upload->auto-komen watch on the new media | Vitest: registry with upload flag off renders 'Segera hadir' and a disabled CTA; with the flag on plus healthy engine renders 'Tersedia'; engine health failing renders 'Pemeliharaan'; pytest: pipeline job creates 3 linked child jobs and the comment watcher is bound to the published media id |
| Live counters: users online, bots running | Users online = distinct sessions with a heartbeat in the last 60s (Redis sorted set, 30s client ping); bots running = count of Celery tasks in state running across engines from the result backend/inspect; pushed to the hub via SSE every 5s; no hard-coded or random numbers | Playwright: open 3 browser contexts -> counter shows 3 within 10s; close 2 -> shows 1 within 70s; start 4 long mocked jobs -> 'bots running' = 4, after completion = 0; grep check: no Math.random in the counter component |

## Fitur MVP
- Better Auth signup/login, password reset email, multi-tenant workspaces with invites
- Instagram connect via Graph API OAuth (Business/Creator), multi-account per workspace, long-lived token refresh and expiry banner
- Job center: list/filter by engine, status and account; retry, cancel and duplicate; detail log per step
- Auto Komen inbox: new comments, AI drafts, approve/edit/skip, comment bank CRUD, quiet hours (e.g. 22:00-06:00 WIB)
- Auto Edit: link or file input, hook editor, template picker (intro/outro, font, color), preview player, download MP4
- Auto Upload: presigned multipart upload, caption-per-line mapper, cover frame pick, schedule in WIB, calendar view of queued Reels
- Pipeline edit->upload->komen as one chained job
- Notifications: in-app and email for publish success/failure, token expiry, quota near limit
- Usage page: renders, publishes and LLM tokens per month per workspace
- Admin: queue depth, worker status, pause engine/tenant, LLM provider key and model setting
- Live counters on the tools hub

## Peran
- owner (billing-free workspace owner, connects accounts)
- editor (create/approve jobs)
- viewer (read job center and analytics)
- admin (platform operator: workers, engines, tenants)

## Model data
- workspace: id, name, ownerId, createdAt
- ig_account: id, workspaceId, igUserId, username, tokenEnc, tokenExpiresAt, status
- job: id, workspaceId, engine, accountId, status, progress, payload jsonb, result jsonb, error, idempotencyKey, parentJobId, scheduledAt
- comment: id, accountId, igCommentId, mediaId, author, text, receivedAt, status(new|drafted|replied|hidden|skipped)
- reply_draft: id, commentId, tone, text, source(llm|bank), approvedBy, sentAt, igReplyId
- comment_bank_item: id, workspaceId, keywords[], text, lang
- video_asset: id, workspaceId, sourceUrl?, sourceCredit?, storageKey, durationSec, width, height, sizeBytes
- render: id, assetId, hookLines[3], templateId, outputKey, ffmpegLog
- publication: id, jobId, accountId, containerId, mediaId, permalink, caption, publishedAt

## Integrasi
- Instagram Graph API (Facebook Login for Business, comments/replies, mentions, webhooks, Reels content publishing, content_publishing_limit)
- LLM API (DeepSeek-compatible chat completions, configurable provider)
- yt-dlp and ffmpeg/ffprobe in the worker image
- MinIO/S3 presigned multipart upload and GET
- Celery + Redis (+ celery beat / scheduler), FastAPI workers, Hono API gateway
- SMTP/Mailpit for notifications, Better Auth

## Edge case
- Token expired or permission revoked mid-queue -> jobs move to 'paused_auth', no retries burn, email sent
- Graph rate limit or publishing quota reached -> job rescheduled to the next window with the reason shown
- Comment deleted before the reply is sent -> draft marked 'komentar hilang', no error loop
- Commenter writes in English or mixed Jaksel slang -> reply matches the detected language
- Upload interrupted on a weak connection -> multipart resumes from the last part; orphaned parts cleaned after 24h
- Source video vertical already, or 4K, or no audio track -> renders correctly (adds silent audio)
- Caption lines fewer than files -> blocked with 'Caption kurang 2 baris' before scheduling
- Schedule set in the past or during quiet hours -> validation error with the nearest valid time suggested
- Duplicate publish risk on worker crash after media_publish -> idempotency check by containerId prevents a second post

## Skenario E2E (Playwright/pytest)
- Sari: signup -> connect IG (mocked OAuth) -> Auto Komen 'tinjau dulu' -> approves 7 drafts -> 7 replies sent (mock Graph receives 7 calls)
- Sari: LLM down -> drafts come from the bank with the 'bank lokal' label; mode 'otomatis' sends at most 1 reply per comment
- Sari: schedules a Reel 19:00 WIB -> fake clock 19:00 -> container FINISHED -> permalink shown, email received in Mailpit
- Bayu: 10 files + 10 caption lines across 6 accounts -> 10 jobs; one Graph ERROR -> 9 published, 1 failed with retry button
- Bayu: pastes link -> hook 3 lines -> edits line 2 -> render -> ffprobe 1080x1920 -> download MP4
- Bayu: pipeline edit->upload->komen -> 3 chained jobs succeed and the new media appears in the Auto Komen inbox
- Gilang: kills a worker during render -> job re-delivered, single output file, status succeeded
- Hub: 3 sessions open -> 'online 3'; 4 running jobs -> 'bots 4'; Auto Upload flag off -> card shows 'Segera hadir'

## Celah dari critic (wajib ditutup)
- **Reels publishing requires a video_url that Meta servers can fetch. A presigned MinIO URL on 127.0.0.1/LAN is unreachable, so every publish fails in the local setup.** → PUBLIC_MEDIA_BASE_URL config served over public HTTPS (MinIO behind the gatraglobal.id domain or a cloudflared tunnel). Startup health check fetches a probe object through the public URL. Test: if the probe fails, the Auto Upload card shows 'Pemeliharaan: media URL tidak publik' and no container is created.
- **There is no check of the rendered video against Instagram Reels container specs before upload, so the 'ERROR' status is discovered only after a 10-minute poll.** → An ffprobe preflight validates H.264 yuv420p, AAC 48 kHz, 23-60 fps, 9:16, duration 3 s-15 min, and size limits, with an auto-remux option. Test: a 2 s clip and a 120 fps clip get 422 with the reason before any Graph call; the remuxed file passes.
- **There is no webhook signature verification, and in auto mode the bot can reply to its own replies (the comment webhook fires for the account's own comments), creating a loop. There is also no per-hour reply cap.** → Verify X-Hub-Signature-256 with the app secret and handle the hub.verify_token GET handshake. Skip comments where from.id == igUserId, and cap auto replies per account per hour (default 60). Test: a bad signature gets 401; the account's own comment event gets 0 replies; the 61st auto reply within an hour is queued.
- **There is no setup flow for the Meta app (Development mode testers, required permissions), and no check of which scopes were actually granted. Connecting can 'succeed' while publishing or comments fail.** → Akun > Koneksi includes a setup checklist (create app, add IG account as tester, permissions instagram_business_basic, instagram_business_manage_comments, instagram_business_content_publish) and a token debug call listing granted scopes per account. Test: mocked token missing content_publish shows 'Izin publikasi belum diberikan' and disables Auto Upload for that account.
