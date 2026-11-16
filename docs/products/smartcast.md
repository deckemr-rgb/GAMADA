# SmartCast (podcast platform)

Podcast streaming platform (Web PWA + Expo iOS/Android) with waveform player, recommendations, offline downloads, short category-relevant pre-roll only, and creator tipping via Midtrans QRIS with a 90/10 ledger split.

## Persona
- **Rina, 27, karyawan Jakarta (non-technical listener)**: Commutes KRL Bogor-Sudirman 2x75 min daily, Android 4GB RAM Rp1.8jt, kuota 15GB/bulan, signal drops between stations, never pays for apps but would tip Rp10.000 via QRIS to a favorite host.. Tujuan: Download 3 episodes on home Wi-Fi, listen offline on the train, resume exactly where she stopped, never hear more than a few seconds of promo.
- **Dimas, 31, podcaster bisnis/teknologi (power user / creator)**: Runs a weekly 60-min Indonesian tech podcast, already has an RSS feed on another host, records in Audacity, checks stats on laptop daily, wants income beyond sponsors.. Tujuan: Import his RSS back-catalog, upload new episodes with chapters and cover, see plays/completion per episode, receive tips and withdraw 90% to his bank account.
- **Sari, 35, admin konten SmartCast (operator)**: Works on desktop in WIB office hours, manages categories, pre-roll inventory, creator verification, tip payouts and takedown reports.. Tujuan: Approve creators, schedule pre-rolls per category with caps, reconcile Midtrans settlements against the tip ledger, and process payout batches every Friday.

## Journey pengguna
- Rina discovers SmartCast via a shared episode link -> web player opens with cover, waveform and Play in <2s on 4G; plays without login (anonymous device id).
- Rina signs up with email/Google, follows 3 shows, toggles 'Unduh otomatis episode baru via Wi-Fi saja', downloads 3 episodes (progress bar, storage used shown in MB).
- On KRL offline: app opens in airplane mode to Library > Unduhan, plays downloaded episode, position saved locally every 5s and synced when back online (last-write-wins by updatedAt).
- Rina plays a new episode: one pre-roll of <=10s relevant to the episode category, skippable after 5s, then content; no mid-roll ever; at most 1 pre-roll per 30 min per listener.
- Rina tips Dimas Rp10.000: Midtrans Snap/QRIS sheet, pays from e-wallet, receipt screen + email; if payment expires (15 min) status shows 'Kedaluwarsa' with retry button and no ledger entry.
- Dimas clicks 'Jadi Kreator', verifies email, creates show, imports RSS (episodes, covers, publish dates), uploads new MP3/WAV up to 500MB with resumable upload, adds chapters and schedules publish at 19.00 WIB.
- Dimas opens Studio dashboard: plays, unique listeners, avg completion %, retention curve per episode, tips received; exports CSV; requests payout of available balance >= Rp50.000.
- Sari reviews creator applications, uploads pre-roll audio, assigns categories, sets daily caps and date range, sees impressions/skips; runs Friday payout batch and marks transfers done with reference numbers.
- Failure paths: upload interrupted at 60% resumes from last chunk; session expired mid-upload refreshes token silently; storage full on phone shows clear error and offers deleting played downloads; Midtrans webhook duplicated is idempotent.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| listen without interruptions: custom player, waveform, episode recommendations | Own audio player (not native <audio> controls) with play/pause, seek on waveform, skip -15/+30s, speed 0.75-2x, sleep timer, persistent mini-player across routes, lock-screen/media-session controls; server-generated waveform peaks JSON per episode; recommendation endpoint combining co-listen and same-category/tag similarity, excluding finished episodes. | Playwright: play episode, navigate to 3 other routes, audio currentTime keeps increasing with no pause event; click waveform at 50% -> currentTime within ±1s of duration/2; waveform JSON has >=800 peaks; GET /recommendations?userId returns >=6 items, 0 already-completed episodes, latency p95 <300ms on seeded DB. |
| no ads, only a short relevant pre-roll | Pre-roll service: max duration 10s enforced on upload, targeted by episode category, frequency cap 1 per listener per 30 min, skip button after 5s, never mid-roll or post-roll, impressions/skips logged; listeners in 'premium creator support' (tipped in last 30 days) get no pre-roll. | Vitest: uploading 11s pre-roll returns 422; Playwright: play 3 episodes within 30 min -> exactly 1 pre-roll event; pre-roll category === episode category; skip button disabled at t=4s, enabled at t=5s; scan of playback events for a 60-min episode shows 0 ad events after content start. |
| offline download | Web: PWA service worker + IndexedDB/Cache Storage storing audio blobs and metadata; mobile: expo-file-system downloads with background resume and expo-sqlite library; download queue, Wi-Fi-only toggle, storage usage, auto-delete after played, offline progress sync queue. | Playwright: download episode, context.setOffline(true), reload app, open Unduhan, play -> audio currentTime > 5 after 6s; offline position saved then setOffline(false) -> server progress updated within 10s; Expo e2e (Maestro) airplane mode playback passes on Android emulator. |
| creator tips with 90% going to the creator | Tips via Midtrans Snap and QRIS (sandbox) with signature-verified webhook; double-entry ledger in integer rupiah: creator_payable = floor(amount*0.9), platform_fee = remainder; creator balance pending until settlement then available; payout requests, admin payout batch, tip receipt email, refund reversal entries. | Vitest: tip Rp10.000 -> ledger lines creator 9.000, platform 1.000, sum = 10.000; Rp15.555 -> 13.999 + 1.556; webhook with bad signature -> 401, no ledger rows; same settlement webhook sent 5x concurrently -> exactly 1 ledger posting; expired transaction -> 0 balance change. |
| trending episodes with category, duration, play count | Trending endpoint scoring plays (counted after >=30s listened, deduped per listener per episode per 24h) over rolling 7 days with time decay, materialized every 10 min by BullMQ job; UI cards show category chip, duration mm:ss, formatted play count (e.g. 12,4 rb); filters by category and duration bucket (<15, 15-45, >45 min). | Vitest: 3 plays of 10s by one user -> 0 counted; 100 listeners x 1 play -> play count 100; Playwright: filter 'Bisnis' + '<15 menit' -> every card category=Bisnis and duration<900s; displayed count equals API value. |
| become a creator CTA | CTA on home/player leads to creator onboarding: email verify, show profile, payout bank info, RSS import or first upload, terms of show (category, language, explicit flag), admin approval queue, creator Studio. | Playwright creator journey: click 'Jadi Kreator' -> complete onboarding -> import RSS fixture with 25 items -> 25 episodes created with correct pubDate; upload 30MB MP3 -> transcoded and published, visible on public show page within 60s. |
| available on iOS, Android, Web | One Expo (expo-router) app with shared API client; Web PWA installable (manifest, icons, SW); Android APK via EAS; iOS build via EAS (simulator build) ; feature parity matrix: player, downloads, library, tips, follow, notifications. | CI: eas build --platform android --profile preview produces APK; eas build --platform ios --profile simulator succeeds; Lighthouse PWA installability passes; same Maestro/Playwright smoke suite (login, play, download, tip) green on web and Android emulator. |
| 128k listeners, 4500+ episodes | Public stats endpoint computing listeners (distinct listener ids with >=1 counted play) and published episodes from DB, cached 5 min; landing counters read this endpoint only (no hardcoded numbers); seed script generating 4,500+ episodes and 128,000+ listener play records for demo environment. | After seed: SELECT count(DISTINCT listener_id) >= 128000 and published episodes >= 4500; Playwright: hero counter text equals formatted /api/stats values; grep of web src finds no literal '128' or '4500' in stats component. |

## Fitur MVP
- Auth (email+password, Google OAuth, magic link, password reset, email verify) with roles listener/creator/admin
- Episode/show catalog with search (title, show, host, transcript keywords) and category browse
- Custom player with waveform, chapters, speed, sleep timer, resume, queue, media session
- Offline downloads (PWA + Expo) with Wi-Fi-only, storage meter, auto-delete
- Follow shows, new-episode push/email notifications, library history
- Recommendations and trending with filters
- Pre-roll manager with targeting, caps, skip, analytics
- Tips via Midtrans Snap + QRIS, ledger, receipts, payouts
- Creator Studio: upload (resumable), RSS import, chapters, scheduling, analytics, CSV export
- Admin: creator approval, categories, reports/takedowns, payouts reconciliation
- Shareable episode links with timestamp (?t=754) and OG cards
- Empty states, offline banner, error retries, skeleton loading

## Peran
- guest (anonymous device id, can stream and see trending)
- listener
- creator (owner of shows, multiple team members per show via tenant)
- creator_editor (upload/edit, no payouts)
- admin_content
- admin_finance

## Model data
- users: id, email, name, avatar, role, locale, createdAt
- shows: id, tenantId, ownerId, title, slug, category, language, explicit, coverUrl, rssSourceUrl, status
- episodes: id, showId, title, description, audioKey, durationSec, waveformKey, chapters jsonb, publishAt, status
- play_events: id, listenerId, episodeId, startedAt, secondsListened, counted bool, device
- progress: listenerId, episodeId, positionSec, completed, updatedAt
- downloads: listenerId, episodeId, device, sizeBytes, createdAt
- prerolls: id, audioKey, durationSec, categories[], startDate, endDate, dailyCap, impressions, skips
- tips: id, listenerId, creatorId, episodeId, amount, midtransOrderId, status, paidAt
- ledger_entries: id, txnId, account (creator_payable|platform_fee|cash), creatorId, amount, direction, createdAt
- payouts: id, creatorId, amount, bankAccount, status, referenceNo, processedAt
- follows: listenerId, showId, notifyNew bool

## Integrasi
- Midtrans sandbox Snap + QRIS (Core API) with SHA512 signature verification on webhook
- MinIO/S3 for audio, covers, waveform JSON (presigned multipart upload)
- FFmpeg worker (BullMQ) for transcode to 128k MP3 + 64k AAC, loudness normalize, waveform peaks
- RSS import/parse (podcast namespace) and public RSS output per show
- SMTP/Mailpit for verification, receipts, new episode emails
- Expo notifications (FCM) + Web Push (VAPID)
- Better Auth (email, Google OAuth) with RBAC + tenant per show team
- Service worker (Workbox) and expo-file-system/expo-sqlite for offline

## Edge case
- Audio upload corrupt or unsupported codec -> clear error, episode stays draft
- Download interrupted at 70% on KRL tunnel -> resumes with HTTP Range, no duplicate file
- Phone storage <100MB -> block download with message and 'hapus yang sudah didengar' action
- Two devices playing same episode -> progress last-write-wins by updatedAt, no regression to 0
- Tip payment expired/denied/cancelled -> no ledger change, retry possible; refund creates reversal entries
- Duplicate/out-of-order Midtrans webhooks -> idempotent by order_id + status transition rules
- Scheduled publish at 19.00 WIB when server runs UTC -> publishes at 12:00 UTC exactly
- Episode deleted while downloaded -> offline copy removed on next sync with notice
- Low-end Android (2GB RAM): list virtualization, waveform rendered in canvas with <=1000 peaks
- No pre-roll available for category -> play content directly, never block

## Skenario E2E (Playwright/pytest)
- Rina: open shared link, play as guest, sign up, follow show, download 3 episodes, go offline, play and resume, back online progress synced
- Rina: play 3 episodes in 30 min -> exactly one <=10s pre-roll, skip at 5s works
- Rina: tip Rp10.000 via QRIS sandbox simulator -> receipt email in Mailpit, creator balance +9.000 after settlement
- Rina: tip expires -> status Kedaluwarsa, retry creates new order, old one never credited
- Dimas: onboarding, RSS import of 25 items, upload 30MB MP3 with chapters, schedule 19.00 WIB, publishes on time (fake clock)
- Dimas: Studio analytics show plays/completion matching seeded events, CSV export row count matches
- Dimas: request payout Rp50.000 -> pending, admin marks paid -> balance reduced, email sent
- Sari: approve creator, create pre-roll for category Bisnis with daily cap 100 -> 101st impression not served
- Sari: reconcile settlements: sum(tips settled) == sum(ledger cash) for the day
- Concurrency: 200 simultaneous play-count posts for one episode -> counted plays exactly equal unique eligible listeners

## Celah dari critic (wajib ditutup)
- **The 90% tip claim ignores the Midtrans QRIS MDR fee, and there is no min/max tip. The claim can be false, or creators get 90% of a net amount.** → Fixed rule: the creator gets floor(gross*0.9) and the platform's 10% absorbs MDR. Tip range is Rp1.000-Rp1.000.000 with presets 5rb/10rb/25rb. Test: Rp10.000 tip with 0.7% MDR still gives a 9.000 creator line; Rp500 returns 422.
- **Payout requests have no concurrency guard, so two parallel requests can withdraw more than the balance.** → Row lock on the creator balance, and the payout request writes a pending debit in the same transaction. Test: balance Rp60.000 with 5 concurrent Rp50.000 requests gives exactly 1 accepted and 4 rejected with 409 INSUFFICIENT_BALANCE.
- **Background and lock-screen playback on the Android/iOS apps is not specified or tested. expo-av alone stops on a locked phone during the KRL commute.** → Use react-native-track-player with a foreground media notification and lock-screen controls. Maestro test: play, lock the screen, wait 60 s; position has advanced by at least 55 s and the notification pause works.
- **Pre-roll behaviour for offline playback is undefined, and so is impression logging for it.** → Downloads bundle the targeted pre-roll audio, and offline impressions and skips go into the sync queue. Frequency cap is checked locally. Test: offline playback of 2 episodes within 30 min gives 1 pre-roll; after reconnect the server shows 1 impression.
