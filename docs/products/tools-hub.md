# GAMADA /tools hub (one account for all tools)

Single entry page and account system for every GAMADA tool: catalog with honest Tersedia/Coming Soon status, live users-online and jobs-running counters, Cara Pakai guides, one login (Masuk) that carries into ScrapPulse, the Sistem Automasi engines (Instagram Reels scheduler, comment inbox, video editor) and the PhoneFarm panel, plus a unified job history and quota.

## Persona
- **Sari Wulandari (non-technical)**: 24, UMKM batik seller in Solo, runs an Instagram Business account from a Rp1.5 juta Android phone on 4G; reads Indonesian only.. Tujuan: Find the right tool quickly, register once, learn how to schedule Reels and reply to comments from a short Cara Pakai guide without asking anyone.
- **Andre Saputra (power user)**: 30, social-media freelancer in Depok handling 6 client accounts; uses ScrapPulse for keyword research and automation engines daily on a laptop.. Tujuan: One login across tools, see all running/finished jobs in one place, switch between client workspaces (tenants), get notified when long jobs finish, top up quota via QRIS.
- **Fajar Nugroho (operator/admin)**: 33, GAMADA studio owner/admin maintaining the tools platform.. Tujuan: Change a tool's status (Tersedia/Coming Soon/Maintenance) without deploying, watch real counters and queue health, manage users/roles, publish Cara Pakai articles.

## Journey pengguna
- Discovery: Sari lands on gatraglobal.id/tools from Instagram bio link on mobile; sees tool cards with status badges, live 'X pengguna online · Y job berjalan', and filters 'Kreator', 'Riset', 'Perangkat'.
- Learn: taps 'Cara Pakai' on Penjadwal Reels; reads a 5-step guide with screenshots and a 60-second video; searches 'cara balas komentar' and lands on the right article.
- Sign-up: taps Masuk -> Daftar with email/password or Google; verification email (Mailpit in dev) -> verified -> onboarding asks 'Untuk apa Anda memakai GAMADA?' and creates a personal workspace.
- Connect: from Akun > Koneksi, connects Instagram Business/Creator account through Instagram Graph API OAuth once; connection becomes available to every automation tool in that workspace.
- Daily use (Andre): switches workspace 'Klien Kopi Kenangan Depok', opens ScrapPulse from hub already logged in (shared session), starts a keyword job; hub 'Job Saya' shows it running with progress; email + in-app notification on completion; exports CSV.
- Quota: Andre hits monthly quota; hub shows remaining credits, 'Isi kuota' -> Midtrans Snap sandbox QRIS -> webhook verified -> credits added and receipt PDF emailed.
- Failure - session expired: Andre returns after 8 days; clicking a tool redirects to Masuk with ?next= back to the same tool after login; in-progress form draft restored.
- Admin (Fajar): toggles 'Editor Video' from Coming Soon to Tersedia in admin; card updates for all visitors within 10 s via SSE without redeploy; audit log records who changed it.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| single place listing all tools with status Tersedia / Coming Soon | Tool registry table driving the catalog (name, slug, category, status Tersedia|Coming Soon|Maintenance, description ID/EN, icon, url, requiresLogin); filters, search, sort; Coming Soon cards show 'Kabari saya' waitlist button instead of a dead link; admin can edit status. | Playwright: seed 6 tools (4 Tersedia, 2 Coming Soon) -> /tools renders 6 cards, badge text matches DB; Coming Soon card has no clickable launch link and 'Kabari saya' stores a waitlist row; admin status change visible to an open anonymous tab within 10 s. |
| live counters users online and jobs running | Users online = distinct authenticated + anonymous presence ids with heartbeat in last 60 s (Redis sorted set, heartbeat every 25 s, paused when tab hidden); jobs running = sum of BullMQ active jobs + Celery active tasks across tool queues; pushed via SSE every 5 s; counters never fabricated (show '—' if source unavailable). | Scripted check: open 7 Playwright contexts -> counter shows 7 within 30 s; close 3 -> shows 4 within 90 s; enqueue 5 BullMQ test jobs held active -> jobs counter shows 5 within 6 s, completes -> 0 within 6 s; stop Redis -> counters render '—' not stale numbers. |
| Cara Pakai help, login (Masuk) | Per-tool help articles (MDX, ID/EN) with steps, screenshots, FAQ, searchable (client-side index); Masuk/Daftar with Better Auth: email+password, email verification, forgot/reset password, Google OAuth, rate limiting, ?next redirect, logout everywhere. | Playwright: search 'reset' returns the reset article in < 300 ms; register -> verification mail in Mailpit -> click link -> logged in; forgot password -> Mailpit link -> new password works, old fails; 6 wrong logins in 1 min -> 429; visiting /tools/scrappulse logged out -> redirected to /masuk?next=/tools/scrappulse and back after login. |
| links into ScrapPulse, Sistem Automasi engines, PhoneFarm panel | Hub launch buttons that open each tool with the shared session (same-site cookie on parent domain); automation engines (Instagram Reels publishing with scheduling via Graph API, comment/mention inbox with replies, video editor) reachable from hub; PhoneFarm card probes http://127.0.0.1:7420/api/health and opens the local panel if found, else the demo with install guide. | Playwright: logged-in user clicks ScrapPulse and each automation engine card -> lands on tool with user email shown, no second login; with mocked local agent health 200 -> PhoneFarm button href is http://127.0.0.1:7420; with probe failing -> href is /tools/phonefarm?demo=1 and install steps visible. |
| one account for all tools | Single Better Auth user + organization (workspace) model with RBAC shared by all tool APIs; unified 'Job Saya' list aggregating jobs from all tools; shared connections (Instagram Graph API OAuth tokens encrypted at rest, refreshed before expiry); shared quota ledger. | Vitest API: token from hub login accepted by ScrapPulse API and automation API (200), rejected after logout (401); job created in ScrapPulse appears in GET /api/hub/jobs within 2 s; member role cannot change workspace billing (403). |

## Fitur MVP
- Tool catalog with status badges, category filters, search, ID/EN toggle, mobile-first layout for cheap phones
- Live counters via SSE (users online, jobs running) with graceful '—' fallback
- Masuk/Daftar, email verification, forgot/reset password, Google OAuth, session list + logout all devices
- Workspaces (multi-tenant) with roles owner/admin/member/viewer and email invites
- Akun > Koneksi: Instagram Business/Creator OAuth via Graph API, token health and reconnect prompt
- Job Saya: unified job history across tools with status, progress, cancel, retry, result download, search and filter
- Notifications: in-app bell + email on job finish/fail, token expiring, quota low; per-type opt-out
- Quota & billing: credit ledger in Rupiah, Midtrans Snap sandbox top-up (QRIS, VA, e-wallet), signature-verified webhook, PDF receipts
- Cara Pakai: per-tool MDX guides with search, 'Apakah ini membantu?' feedback
- Coming Soon waitlist ('Kabari saya') with email when tool becomes Tersedia
- Admin console: tool registry editor, user/role management, queue health, audit log, announcement banner
- Empty states and skeletons everywhere; offline banner with retry

## Peran
- Anonymous visitor (catalog, counters, Cara Pakai, demo)
- Member (use tools within workspace quota)
- Workspace admin (invite, connections, billing)
- Workspace owner (delete workspace, transfer)
- Platform admin (tool registry, users, audit)

## Model data
- User: id, email, name, emailVerified, locale(id|en), timezone(Asia/Jakarta), createdAt
- Organization: id, name, slug, planId, creditBalanceIdr
- Membership: orgId, userId, role
- Tool: slug, nameId, nameEn, category, status(available|coming_soon|maintenance), url, requiresLogin, sortOrder
- Job: id, orgId, userId, toolSlug, queue, externalJobId, status, progressPct, resultUrl, error, createdAt, finishedAt
- Connection: id, orgId, provider(instagram_graph), igUserId, username, accessTokenEnc, expiresAt, scopes[], status
- Payment: id, orgId, midtransOrderId, amountIdr, method, status, paidAt, receiptUrl
- CreditLedger: id, orgId, deltaIdr, reason, jobId?, paymentId?, createdAt
- Notification: id, userId, type, payload, readAt, createdAt
- HelpArticle: slug, toolSlug, locale, title, bodyMdx, updatedAt
- WaitlistEntry: toolSlug, email, notifiedAt
- AuditLog: id, actorId, action, target, before, after, createdAt

## Integrasi
- Better Auth (email/password, Google OAuth, organizations, RBAC)
- Redis (presence sorted set, BullMQ queues) + Celery inspect API for Python jobs
- Server-Sent Events from Hono for counters and job updates
- Instagram Graph API via OAuth (content publishing for Reels with scheduling, comments and mentions read/reply)
- Midtrans sandbox Snap + QRIS with SHA512 signature-verified webhook
- SMTP via Mailpit (dev) for verification, reset, notifications, receipts
- MinIO/S3 for job results and receipt PDFs
- ScrapPulse, Sistem Automasi engines, PhoneFarm local agent (health probe)

## Edge case
- Redis down: counters show '—', catalog still renders from cached registry
- Midtrans webhook arrives twice or before redirect: idempotent on order_id, credit added once
- Payment expired/cancelled QRIS: order marked expired, no credit, user can retry with new order id
- Instagram token expired/revoked: connection status 'Perlu dihubungkan ulang', scheduled jobs paused with notification instead of silent failure
- Session expired mid-form: redirect to Masuk with next param, draft restored from localStorage
- Tool switched to Maintenance while user inside it: banner and new jobs blocked with clear message, running jobs continue
- User in multiple workspaces: jobs and quota strictly scoped; switching workspace never leaks jobs
- Slow 3G on cheap phone: initial /tools payload < 120 KB gzip, counters lazy-loaded
- Email unverified user tries to start job: prompt to verify with resend button (rate limited 1/min)
- Clock/timezone: all times shown in WIB, stored UTC

## Skenario E2E (Playwright/pytest)
- Sari (mobile 360x740, slow 3G): open /tools -> LCP < 3 s, filter 'Kreator', open Cara Pakai, search 'jadwal reels' -> article found
- Sari: Daftar -> verify via Mailpit -> connect Instagram (mocked Graph API OAuth) -> connection shows username and status active
- Andre: login once -> open ScrapPulse and 2 automation engines without re-login -> start job -> appears in Job Saya running -> completes -> bell notification + email -> download CSV
- Andre: quota 0 -> start job blocked with 'Isi kuota' -> Midtrans sandbox QRIS paid -> webhook (valid signature) -> balance increased exactly once, receipt PDF in email; invalid signature webhook -> 401 and no credit
- Andre: switch workspace -> Job Saya shows only that workspace's jobs; viewer role cannot start jobs (button disabled, API 403)
- Fajar: set tool to Tersedia in admin -> anonymous tab updates within 10 s -> waitlist emails sent once each -> audit log row created
- Fajar: 7 browser contexts online + 5 active test jobs -> counters 7 and 5; kill workers -> jobs counter drops to 0 within 6 s
- Expired session: set cookie expiry past -> click tool -> /masuk?next=... -> after login returns to tool with draft restored

## Celah dari critic (wajib ditutup)
- **'One account for all tools' spans a Hono/Better Auth gateway and Python FastAPI services (ScrapPulse, Sistem Automasi), but session validation in Python is unspecified.** → Use the Better Auth JWT plugin with a JWKS endpoint, and FastAPI verifies the JWT (cache JWKS for 5 min, check orgId and role claims). Test: hub login token gets 200 on FastAPI; after logout and revocation it gets 401 within 60 s; a token for org A on an org B job gets 403.
- **The shared quota ledger has no reserve/capture idempotency, so parallel job starts double-spend credits. ScrapPulse's separate '3 reports/day' quota contradicts the unified ledger.** → Reserve credits in a locked transaction at job start, capture on success, and release on failure or cancel. Idempotency key is jobId. ScrapPulse members consume the hub ledger, and anonymous users keep an IP limit. Test: balance for 3 jobs with 10 parallel starts gives 3 running and 7 'Isi kuota'; a failed job refunds exactly once.
