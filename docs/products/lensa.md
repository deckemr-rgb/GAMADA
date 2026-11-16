# LENSA

Camera gear rental with date-range availability, 15-minute admin stock confirmation during 09.00-21.00 WIB, QRIS/transfer payment plus refundable deposit, COD in Jabodetabek or courier elsewhere, per-unit condition scoring, optional insurance, and a 24-hour claim guarantee.

## Persona
- **Ayu Lestari (24, content creator pemula, Depok)**: Non-technical; first time renting gear; budget-conscious; uses an Oppo A-series phone; prefers COD and QRIS.. Tujuan: Rent a Sony A7 III + 28-70 lens for Saturday-Sunday to shoot a friend's wedding, know the total including deposit upfront, and get the deposit back quickly.
- **Raka Prasetyo (31, videographer freelance, Bandung)**: Power user; rents bundles 3-4 times a month; ships via courier; compares unit condition; wants invoices for clients.. Tujuan: Book a bundle (FX3 + gimbal + 2 lenses) for specific dates weeks ahead, extend the rental from his phone, download invoices, and claim fast if a unit arrives faulty.
- **Mbak Tia (29, ops admin) and Joko (35, COD courier)**: Tia handles confirmations, inspections, deposits and claims on a laptop at the store; Joko delivers and picks up COD orders around Jabodetabek with a phone.. Tujuan: Tia: confirm every request within 15 minutes, keep condition scores honest, settle deposits same day. Joko: see today's route, collect handover photos and signatures, mark delivered/returned.

## Journey pengguna
- Discover: Ayu opens catalog, filters by Kamera Mirrorless, picks dates Sat-Sun; each card shows Rp/hari and badge Tersedia or Sedang Disewa for those dates.
- Detail: sees unit condition score (e.g. 97%) with last inspection photos and date, price breakdown (days x rate, insurance optional, deposit), reviews.
- Login (Masuk): signs up with email or WhatsApp OTP, uploads KTP and selfie once for identity verification reviewed by admin.
- Request: chooses COD (address in Depok detected as Jabodetabek), submits; status MENUNGGU_KONFIRMASI with 15-minute SLA timer shown.
- Confirm: Tia confirms stock in 6 minutes; Ayu gets email/WhatsApp-link notification and pays rental + deposit via QRIS within 60 minutes.
- Receive: Joko delivers, both check unit with checklist and photos, Ayu signs on screen; 24-hour claim window starts.
- Claim: lens has a fungus spot; Ayu submits claim with photos at hour 3; Tia approves replacement or partial refund within SLA.
- Return: Joko picks up; Tia inspects, scores 96%, deposit refunded in full via Midtrans refund or recorded bank transfer; Ayu leaves a 5-star review.
- Raka (outside Jabodetabek): Bandung address forces courier, shipping fee added, AWB number tracked; extends rental by 1 day from order page if no conflicting booking.
- Failure: request at 22:30 -> page states confirmation at 09.00-09.15 WIB next day; Tia rejects because unit failed inspection -> auto-cancel, no charge.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| catalog with price per day and availability badge (Tersedia / Sedang Disewa) | Product -> Unit model; Booking ranges per unit; availability computed per selected date range (any unit free => Tersedia); price per day in IDR with multi-day and weekly rates. | With 2 units of A7 III and both booked 2026-12-05..06, catalog for those dates shows 'Sedang Disewa' and for 2026-12-07 shows 'Tersedia'; price for 3 days equals 3 x dailyRate (or configured tier) in Vitest pricing unit test. |
| admin confirms stock within 15 minutes, 09.00-21.00 | Request state machine with confirmBy deadline computed in WIB business hours; admin queue sorted by deadline with sound/push alert; escalation at 10 min; SLA metrics dashboard. | Request created 2026-12-01 10:00 WIB has confirmBy 10:15; request at 21:30 gets confirmBy next day 09:15; BullMQ job escalates at 10 minutes (fake timers); dashboard shows % confirmed within SLA computed from timestamps. |
| pay via transfer or QRIS plus deposit refunded on intact return | Midtrans Snap with QRIS and bank_transfer (VA); deposit as separate ledger line held until return inspection; refund via Midtrans refund API (QRIS) or recorded manual transfer with proof upload; deductions itemised. | Sandbox payment of rental Rp450.000 + deposit Rp2.000.000 -> ledger shows HELD deposit; inspection marked intact -> refund job calls refund endpoint and deposit status REFUNDED within 60s; damage deduction Rp300.000 yields refund Rp1.700.000 and itemised email. |
| COD in Jabodetabek, courier elsewhere | Geofence of Jabodetabek kota/kabupaten (Jakarta 5 kota + Kep. Seribu, Bogor, Depok, Tangerang, Tangsel, Bekasi) by address region and MapLibre pin-in-polygon; COD option only inside; courier shipping fee table elsewhere with AWB tracking field. | Address in Kota Depok returns deliveryOptions ['COD','COURIER']; address in Kota Bandung returns ['COURIER'] only; forcing COD for Bandung via API returns 422 COD_NOT_AVAILABLE. |
| 95%+ unit condition score | Inspection checklist per category (sensor, body, mount, shutter count, lens glass, accessories) with weighted score; unit listed for rent only if latest score >= 95; score and inspection date shown on detail page. | Unit with latest inspection 93 is excluded from availability and badge; after re-inspection 97 it becomes rentable; every rentable unit in seed has score >= 95 (SQL check). |
| 24-hour claim guarantee | Claim entity opened from order within 24h of RECEIVED timestamp with photo/video upload to MinIO; options replacement, partial refund, full refund; admin response SLA; window closes automatically. | Claim at receivedAt + 23h59m accepted (201); at +24h01m returns 422 CLAIM_WINDOW_CLOSED; approved full-refund claim triggers Midtrans refund and order status CLAIM_RESOLVED. |
| rating 4.9, 2100+ reviews | Review entity (only from completed orders, one per order) with stars and text; aggregate rating and count computed from DB and cached; seed data reproduces the displayed figures, no hardcoded numbers in UI. | Grep finds no literal '4.9' or '2100' in web components; GET /api/stats returns avg rounded to 1 decimal and count from seed (>= 2100, avg 4.9); adding a 1-star review updates avg and count on next request. |
| insurance (Asuransi) and login (Masuk) | Optional insurance add-on priced as % of unit value per day, shown in price breakdown, reducing damage liability cap in deposit deductions; Better Auth login/register/reset with WhatsApp OTP or email. | Toggling Asuransi on a Rp25.000.000 unit for 2 days adds exactly the configured percentage to total; damage on insured order caps deduction at configured excess; 'Masuk' flow completes, reset-password email arrives in Mailpit and new password works. |
| rental steps: pilih unit, bayar & deposit, terima & gas | Order timeline UI mapping states (DRAFT -> MENUNGGU_KONFIRMASI -> MENUNGGU_BAYAR -> DIBAYAR -> DIKIRIM -> DITERIMA -> DIKEMBALIKAN -> SELESAI) to the three advertised steps with current step highlighted. | Playwright walks an order through every state via admin and courier actions; timeline step indicator matches state at each transition and illegal transitions (e.g. DITERIMA -> MENUNGGU_BAYAR) return 409. |

## Fitur MVP
- Catalog with category filters, search, date-range picker, availability badges, price per day, bundles
- Unit detail: condition score, inspection photos, specs, included accessories, reviews
- Cart and booking request with price breakdown (rental, insurance, deposit, shipping) in IDR
- Identity verification (KTP + selfie upload, admin approve) required before first rental
- Admin confirmation queue with 15-minute SLA timer, business-hours logic, escalation alerts
- Midtrans payments (QRIS, VA) with payment deadline, invoice PDF, deposit ledger and refunds
- Delivery: COD scheduling with courier app (route list, handover checklist, photos, signature) or courier with AWB
- Rental extension and early return with recalculated price; late fee per day
- 24-hour claim flow with media upload and resolution options
- Return inspection, condition scoring, deposit settlement with itemised deductions
- Reviews from completed orders, aggregate rating, notifications (email + in-app), order history and invoice download

## Peran
- guest
- customer
- admin_ops (confirm, inspect, settle, claims)
- courier (assigned deliveries/pickups only)
- owner (pricing, units, reports, staff)

## Model data
- Product: id, tenantId, name, category, brand, dailyRateIdr, weeklyRateIdr, depositIdr, unitValueIdr, specs
- Unit: id, productId, serial, status(ACTIVE/MAINTENANCE/RETIRED), latestScore, shutterCount
- Inspection: id, unitId, orderId?, inspectorId, checklist jsonb, score, photos[], at
- Booking: id, unitId, orderId, startDate, endDate (exclusion constraint on daterange per unit)
- Order: id, customerId, status, deliveryMethod(COD/COURIER/PICKUP), address, region, confirmBy, confirmedAt, totalIdr, insurance, receivedAt
- Payment: id, orderId, kind(RENTAL/DEPOSIT/LATE_FEE/SHIPPING), method, amountIdr, midtransId, status
- DepositLedger: id, orderId, heldIdr, deductions jsonb, refundedIdr, refundRef, settledAt
- Claim: id, orderId, reason, media[], openedAt, resolution, resolvedAt
- Delivery: id, orderId, courierId, type(DROP/PICKUP), scheduledAt, awb, handoverPhotos[], signatureUrl, status
- Review: id, orderId, customerId, productId, stars, text, createdAt
- Customer: id, userId, phone, ktpUrl, selfieUrl, verifiedAt

## Integrasi
- Midtrans sandbox Snap (QRIS, VA bank_transfer) with SHA512 webhook verification and refund API
- MinIO private buckets for KTP, inspection, claim and handover media with signed URLs
- MapLibre address pin and Jabodetabek polygon check; region dataset for kota/kabupaten
- SMTP/Mailpit for confirmations, payment links, deposit settlement, claim updates
- BullMQ jobs: SLA escalation, payment expiry, claim window close, late-fee accrual, review reminder
- PDF invoice generation; Expo courier app with camera and signature pad

## Edge case
- Two customers book the last unit for overlapping dates at once -> Postgres exclusion constraint ensures one succeeds, other gets 409 with alternative dates
- Customer pays after payment deadline -> late webhook triggers auto refund if unit no longer held
- Request at 20:58 WIB -> deadline 21:13 handled correctly; request at 21:01 rolls to 09:15 next day
- Return 1 day late -> late fee per day charged from deposit with notification
- Unit fails inspection after a booking is confirmed -> swap to another unit of same product or cancel with full refund
- COD address on Bekasi/Karawang boundary -> polygon check decides; manual admin override logged
- Claim photos upload on slow 3G -> chunked/resumable upload with retry; size limit and compression on device
- Deposit refund to QRIS impossible after provider window -> fallback manual transfer with proof upload
- Timezone: all date ranges stored as dates in WIB; server TZ=UTC must not shift bookings
- Customer deletes account with active rental -> blocked until order SELESAI

## Skenario E2E (Playwright/pytest)
- Ayu: mobile 360x740, select dates, see Tersedia, register, upload KTP, request COD in Depok, admin confirms, pay QRIS sandbox, courier marks delivered, return inspected, full deposit refunded, review posted
- Ayu: request at 22:30 shows next-day 09:15 confirmation deadline; admin rejects -> notified, no payment taken
- Raka: Bandung address offers courier only, bundle booking, extend by 1 day succeeds when free and fails with 409 when next booking exists
- Raka: claim at hour 3 with photos -> partial refund approved -> refund visible in payment history; claim at hour 25 rejected
- Raka: download invoice PDF containing order items, dates, amounts in IDR
- Tia: queue shows 3 requests sorted by deadline, escalation fires at 10 minutes for an unhandled one, SLA dashboard updates
- Tia: inspection score 93 hides unit from catalog; re-inspection 97 restores it
- Joko: courier app lists today's COD jobs, completes handover with 4 photos and signature, order moves to DITERIMA
- Concurrency: 50 parallel booking requests for the last unit and same dates -> exactly 1 Booking row

## Celah dari critic (wajib ditutup)
- **Bundle booking is not atomic across its units, so FX3 can be booked while the gimbal conflicts, giving a half-booked bundle.** → A single DB transaction inserts a Booking for every component unit, relying on the exclusion constraint, and the whole request rolls back on any conflict. Test: one component already booked returns 409 with 0 Booking rows created and alternative dates suggested.
- **There is no turnaround buffer for inspection and courier transit, so back-to-back bookings are accepted even though a Bandung courier delivery is impossible the same day.** → Each product gets a turnaround of inspection hours plus transit days by delivery method (COD 0, COURIER per-region days), applied to the booked range. Test: a Bandung courier order for 12-13 Dec blocks the unit from 10-15 Dec; a COD order adds only the inspection buffer.
- **The unit hold between admin confirmation and the 60-minute payment deadline is undefined. Another customer can grab the unit, or it stays blocked forever.** → A tentative Booking (status HOLD) is created on request, extended on confirm until payDeadline, and released by a BullMQ job. Test: unpaid at deadline+1 s, the hold is deleted and the catalog shows Tersedia.
- **The courier app needs signal for handover photos and the signature, but COD handovers happen in basements and apartment lobbies with no signal.** → The Expo courier app queues photos, signature, and status in expo-sqlite and uploads with retry and idempotency (deliveryId+step). Test: airplane mode, complete the handover with 4 photos, reconnect; the order reaches DITERIMA once and receivedAt is the device timestamp captured offline.
