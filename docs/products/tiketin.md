# Tiket.in

Festival ticketing for multi-day events (SENROPAH FEST): live countdown, day-by-day lineup, tiered ticket sales with Midtrans Snap/QRIS, one named e-QR ticket per NIK, and an offline-capable gate scanner that enforces 17+ and 15.00 WIB gate time.

## Persona
- **Rani Puspita (19, mahasiswi, Bekasi)**: Non-technical; Android Rp1,5 juta phone with 2 GB RAM on a patchy Telkomsel connection; pays with QRIS from GoPay/DANA; first festival she has paid for herself.. Tujuan: Buy a regular 3-day ticket fast before it sells out, get the e-ticket on WhatsApp/email, and walk through the gate without problems.
- **Dimas Hartono (27, software engineer, Jakarta Selatan)**: Power user; goes to 6+ festivals a year; uses a desktop at drop time, builds a personal timetable, coordinates a group of 4 friends who each buy their own ticket.. Tujuan: Get VIP 3-day at drop minute, star favourite performers into a personal schedule exported to Google Calendar, and transfer his ticket to a friend if he cannot go.
- **Pak Budi (41, gate supervisor) and Sinta (33, event admin)**: Budi runs 12 gate scanners on cheap Android phones with unstable venue Wi-Fi; Sinta manages tiers, lineup, quotas and sales reports from a laptop.. Tujuan: Budi: scan 1,500 people per hour per gate with zero double entry even when offline. Sinta: change lineup and quotas without a deploy and export sales and attendance per day.

## Journey pengguna
- Discover: Rani opens a shared IG link on mobile, sees hero video (muted autoplay, pause button), countdown ticking, scrolls lineup Day 1-3.
- Account: signs up with email + WhatsApp number, verifies email OTP, fills attendee data (nama sesuai KTP, NIK, tanggal lahir); system checks age >= 17 on day 1 of the event.
- Purchase: picks Regular 3-Day, qty fixed to 1, inventory held 10 minutes with visible timer, pays via Midtrans Snap QRIS; webhook marks order PAID and issues ticket.
- Delivery: e-ticket page with QR (signed token), PDF download, email via SMTP with PDF attached, ticket available offline as PWA cached page.
- Failure: QRIS payment expires after 15 minutes -> hold released, order EXPIRED, Rani gets a retry button that re-checks stock; presale tier shows Sold Out and is unclickable.
- Drop day: Dimas joins virtual waiting room at 10:00 WIB, gets queue position, admitted in batches of N per minute, completes VIP checkout.
- Daily use: Dimas stars 9 performers, sees clash warnings, exports .ics; receives push/email when a starred set time changes.
- Transfer: Dimas transfers ticket to friend by email before H-3; old QR invalidated, friend completes own NIK/age data, new QR issued.
- Gate: Budi's scanner app pre-downloads the ticket manifest, scans offline, rejects scans before 15.00 WIB, flags under-17 for ID check, syncs scans when Wi-Fi returns.
- Admin: Sinta edits Day 2 lineup order, sets VIP quota from 500 to 550, views live sales dashboard, exports CSV of attendees and per-day check-ins.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| live countdown to event | Countdown component driven by event.startsAt (Asia/Jakarta) and server time offset from /api/time; switches to 'Sedang berlangsung' then 'Selesai' states. | Playwright with clock set to 2026-12-01T14:59:58+07:00 and event start 15:00:00 shows 00:00:02, after 3s fake-time advance shows LIVE state; client clock skewed +10 min still shows correct value within 1s of server time. |
| hero video with pause control | Muted autoplay looping hero video with poster image, accessible pause/play button (aria-pressed), respects prefers-reduced-motion (starts paused), not loaded on Save-Data. | Playwright: click pause -> video.paused === true and button aria-pressed='true'; with reducedMotion: 'reduce' video.paused is true on load; Lighthouse LCP element is the poster, not the video. |
| lineup per day (3 days, 40+ performers) | Performer and Set tables (day, stage, start/end WIB) managed in admin; public lineup tabs Day 1/2/3 with filter by stage and search. | Seed has >= 40 performers across 3 days; GET /api/events/senropah/lineup returns 3 day groups whose counts sum >= 40; admin edit of a set time is visible on public page within 5s without redeploy. |
| ticket tiers: presale sold out, regular 3-day, VIP 3-day | TicketTier with price (IDR integer), quota, sold, salesStart/salesEnd, status computed (UPCOMING/ON_SALE/SOLD_OUT/ENDED); presale seeded with sold == quota. | Presale card renders 'Sold Out' with disabled button; POST /api/orders for presale returns 409 TIER_SOLD_OUT; when VIP sold reaches quota via paid orders, status flips to SOLD_OUT within one request. |
| buy ticket buttons | Every on-sale tier button starts checkout: auth gate -> attendee data -> 10-minute inventory hold -> Midtrans Snap (QRIS, VA, e-wallet) -> signature-verified webhook -> ticket issuance. | E2E with Midtrans sandbox: click Beli on Regular, pay QRIS simulator, webhook with valid SHA512 signature sets order PAID and ticket appears in /tiket-saya within 10s; webhook with invalid signature returns 401 and order stays PENDING. |
| e-QR tickets scanned at the gate | Per-ticket QR containing an Ed25519-signed compact token (ticketId, eventId, version); scanner PWA/Expo app verifies signature offline using event public key, records Scan rows, syncs to API. | Scanner in offline mode verifies 1,000 seeded QR tokens in < 150 ms each; tampered token (1 byte changed) is rejected; second scan of same ticket same day shows 'SUDAH MASUK 15:42 Gate B' and is rejected; after reconnect all offline scans sync with no duplicates. |
| one ticket per person | Unique constraint (eventId, attendeeNik) on active tickets, qty locked to 1 per order, NIK checksum/format validation (16 digits, valid date segment), transfer re-binds NIK. | Second order with same NIK returns 409 NIK_ALREADY_HAS_TICKET; 50 concurrent checkout requests with the same NIK produce exactly 1 hold (DB unique index test in Vitest against Postgres). |
| age 17+ with ID | Birthdate required at attendee step; eligibility computed against event day 1 date; ticket stores ageVerified flag; scanner shows name + birth year and requires 'ID dicek' tap for first entry. | Birthdate 2009-12-02 for event 2026-12-01 returns 422 UNDER_AGE; 2009-12-01 accepted; scanner first scan shows ID-check prompt and entry is only recorded after confirm tap. |
| gate opens 15.00 WIB daily | EventDay.gateOpenAt per day in Asia/Jakarta; scanner and API reject entry scans before gateOpenAt; public page shows gate time per day. | Scan at 14:59:59 WIB returns GATE_NOT_OPEN with countdown; scan at 15:00:00 WIB succeeds; test runs with server TZ=UTC and still uses WIB. |

## Fitur MVP
- Event landing: countdown, hero video, lineup tabs, tier cards, FAQ, venue map (MapLibre) with gate locations
- Auth (Better Auth): email+password, email OTP verify, password reset, WhatsApp number field; roles via RBAC
- Checkout: 10-minute hold, Midtrans Snap + QRIS, payment expiry 15 min, idempotent webhook, receipt email with invoice number
- Virtual waiting room for drop times with queue position and batch admission
- My Tickets: QR, PDF download, offline-cached ticket page, add to calendar
- Ticket transfer once per ticket until H-3 with new QR and old QR revoked
- Personal timetable: star sets, clash detection, .ics export, notification on set time change
- Gate scanner app (Expo, offline manifest, haptic/sound result, multi-gate sync, manual search by name/NIK last 4)
- Admin: event/tier/quota/lineup CRUD, live sales and check-in dashboard, refunds on cancellation, CSV export, promo codes
- Audit log of admin actions and scans; email + in-app notifications

## Peran
- guest (browse)
- buyer/attendee
- gate_staff (scan only, assigned gate)
- gate_supervisor (override, manual lookup, gate stats)
- event_admin (tiers, lineup, orders, refunds)
- super_admin (tenants, keys)

## Model data
- Tenant: id, name, slug
- Event: id, tenantId, slug, name, venue, startsAt, endsAt, tz='Asia/Jakarta', publicKey
- EventDay: id, eventId, date, gateOpenAt, gateCloseAt
- Performer: id, eventId, name, genre, imageUrl, socialUrl
- Set: id, performerId, eventDayId, stage, startAt, endAt
- TicketTier: id, eventId, name, priceIdr, quota, sold, held, salesStart, salesEnd, daysCovered[]
- Order: id, userId, tierId, status(PENDING/PAID/EXPIRED/CANCELLED/REFUNDED), amountIdr, holdExpiresAt, midtransOrderId, paidAt
- Ticket: id, orderId, eventId, attendeeName, attendeeNik, birthDate, qrVersion, status(ACTIVE/TRANSFERRED/REVOKED), transferCount
- Scan: id, ticketId, eventDayId, gateId, deviceId, scannedAt, result, syncedAt
- QueueEntry: id, eventId, sessionId, position, admittedAt, expiresAt
- PaymentEvent: id, orderId, rawPayload, signatureValid, receivedAt
- AuditLog: id, actorId, action, entity, before, after, at

## Integrasi
- Midtrans sandbox Snap + QRIS + VA; notification webhook with SHA512 signature verification; refund API
- SMTP via Mailpit for OTP, receipts, PDF ticket attachments
- MinIO for performer images, hero video, generated ticket PDFs
- Redis/BullMQ: hold expiry, email sending, PDF generation, waiting-room admission ticks
- MapLibre venue map with gate/stage markers
- ICS generation for timetable export
- Expo scanner app with expo-camera barcode scanning and expo-sqlite offline manifest

## Edge case
- Webhook arrives twice or out of order (settlement after expire) -> idempotent, late settlement re-checks stock and auto-refunds if sold out
- Hold expires while user is on Midtrans page -> payment success still honoured if stock available, else auto refund and email
- 1,000 concurrent buyers on last 10 VIP tickets -> exactly 10 PAID, no oversell (row lock / atomic decrement)
- Scanner offline across two gates scanning the same ticket -> conflict resolved on sync, second flagged as duplicate for supervisor
- Device clock wrong on scanner -> uses server-synced offset captured at manifest download
- User loses phone -> re-download ticket after login; supervisor manual lookup by name + NIK last 4
- Lineup performer cancels -> admin marks cancelled, starred users notified, set hidden
- Event cancelled/postponed -> bulk refund job with per-order status and report
- Small screen 320px and 2 GB RAM -> hero video skipped on Save-Data, page JS < 200 KB gzip
- Name with apostrophe/long Indonesian names and NIK leading zeros preserved as string

## Skenario E2E (Playwright/pytest)
- Rani: mobile viewport 360x740, signup -> OTP from Mailpit -> buy Regular via QRIS sandbox -> ticket visible offline after setOffline(true)
- Rani: QRIS expires -> order EXPIRED, stock restored, retry purchase succeeds
- Rani: under-17 birthdate blocked with clear Indonesian message
- Dimas: waiting room at drop -> admitted -> VIP purchased; presale button disabled
- Dimas: star 9 sets, clash badge shown, .ics downloaded with 9 VEVENTs in WIB
- Dimas: transfer ticket to friend -> old QR rejected by scanner, new QR accepted
- Budi: scanner downloads manifest, goes offline, 200 scans succeed, duplicate rejected, before-15.00 scan rejected, sync uploads 200 rows
- Sinta: raise VIP quota, edit set time, export attendees CSV with correct counts, issue refund that reaches Midtrans sandbox
- Load test (k6): 1,000 VUs checkout 10 remaining tickets -> sold == quota, zero oversell

## Celah dari critic (wajib ditutup)
- **Admission from the waiting room is not enforced, so a direct POST /api/orders skips the queue.** → Admission issues a signed short-lived token (JWT, 10 min, sessionId-bound) that /api/orders requires during drop windows. Test: no token returns 403 QUEUE_REQUIRED; another session's token returns 403; a valid token gives 201.
- **The 10-minute hold and 15-minute Midtrans expiry do not match, so a payment at minute 12 lands after the stock was released.** → Set Midtrans custom_expiry equal to the hold remaining time, and extend the hold to cover the Snap session. Test: payment at hold+1 s is rejected by the expiry, and no refund path is needed in the normal flow.
- **An offline scanner manifest still accepts a QR that was transferred or revoked after download. Re-entry (exit and come back the same day) is undefined for 3-day tickets.** → Manifest delta sync every 60 s when online keyed by qrVersion; offline scans are accepted with a 'perlu verifikasi' flag when the manifest is older than 10 min. Scan states IN/OUT with a configurable re-entry rule. Test: transfer, then delta sync, then the old QR is rejected; IN, OUT, IN on the same day follows the rule.
- **The Ed25519 signing key has no rotation, and super_admin 'keys' has no screen or procedure.** → The token carries a keyId and the manifest carries all active public keys. The admin key screen can create, activate, and retire keys. Test: after rotation, old-key tickets still verify until retired and new tickets use the new keyId.
