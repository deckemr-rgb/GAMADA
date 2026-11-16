# GoKantin (campus canteen ordering)

Campus canteen pre-order platform: browse daily menus across canteens, pay with QRIS, get a live ETA (~10 min), and pick up from a numbered rack with a rack code; tenants run a kitchen display and payouts dashboard.

## Persona
- **Nadia (non-technical student)**: 19, mahasiswi semester 2 in Depok, cheap Android, campus Wi-Fi drops often, 15-minute break between classes. Tujuan: Order lunch before class ends and pick it up without queueing
- **Bima (power user student)**: 23, final-year student, orders 2x daily, likes favorites, reorder, group orders for his lab. Tujuan: Reorder in two taps, order for 5 friends, track spending
- **Bu Yati (tenant/Mitra Kantin)**: 45, runs a nasi ayam stall, one tablet at the counter, busy at 12:00 rush. Tujuan: See incoming paid orders in sequence, mark ready, toggle sold-out items, get daily payout clarity
- **Pak Hendra (canteen manager/admin)**: Campus canteen coordinator overseeing 12 canteens and 40+ tenants. Tujuan: Onboard tenants via Mitra program, manage racks, monitor wait times and ratings, reconcile settlements

## Journey pengguna
- Discovery: Nadia opens web/PWA, picks campus and canteen, sees today's menu with price, stock, and estimated ready time
- Order: adds items to cart (counter badge updates), adds note 'tanpa sambal', chooses pickup slot 'secepatnya' or time slot, pays via Midtrans QRIS
- Wait: order status Dibayar -> Diproses -> Siap with live ETA countdown and push/web notification when Siap
- Pickup: app shows rack code (e.g. K3-R07) and order PIN; tenant placed food in that rack slot; Nadia confirms Diambil
- Tenant flow: Bu Yati's kitchen display beeps on new paid order, she accepts, marks Siap, system assigns free rack slot and prints/labels the code
- Sold out: Bu Yati toggles item habis; carts containing it are notified before payment; paid orders for unavailable items get rejected with automatic refund
- Review: after pickup Nadia rates 1-5 and comments; tenant rating aggregates update
- Mitra program: new tenant applies via form, admin approves, tenant sets up menu and payout account, goes live
- Failures: QRIS payment fails/expires -> order stays Menunggu Pembayaran then auto-cancels after 15 min; not picked up within 60 min -> marked Tidak Diambil and rack slot freed

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| order canteen food without queueing | Pre-order with paid-before-cook flow and scheduled pickup slots; tenant queue managed in kitchen display so students only come at Siap | Playwright: student places and pays order without any tenant interaction; tenant KDS context receives it within 2 s; student receives Siap notification before going to pickup |
| daily menu, cart with counter, pay with QRIS | Per-tenant daily menu with availability window and daily stock; persistent cart (localStorage + server) with badge counter; Midtrans QRIS charge and signed webhook | Playwright: add 3 items -> badge shows 3; reload page -> badge still 3; Midtrans sandbox webhook with valid signature sets order Dibayar, invalid signature returns 401 with no change; menu item outside its time window is not orderable |
| ready in about 10 minutes | ETA engine: per-item prep time + tenant queue length; actual ready durations recorded; dashboard shows median paid->Siap time | Vitest: ETA for empty queue with 8-min item = 8 min; with 3 queued orders ETA grows; seeded simulation of 200 orders reports median paid->Siap <=10 min and API /stats/prep-time returns the computed median from DB |
| pick up at a rack using a rack code | Rack and slot model per canteen; atomic slot assignment on Siap; code + PIN shown to student; slot freed on pickup or timeout | Vitest: 30 concurrent Siap events on canteen with 24 slots assign 24 unique slots and queue 6 with status Menunggu Rak; pickup frees slot and next queued order gets it within 1 s; no two active orders share a slot |
| 12 canteens, 40+ tenants | Multi-canteen, multi-tenant schema with seed of 12 canteens and 40+ tenants; public counters computed from DB | Seed creates 12 canteens and 42 active tenants; GET /public/stats returns canteens=12, tenants>=40; landing page counter equals API value |
| rating 4.9 from 2k+ reviews | Review system tied to picked-up orders only (one per order), aggregate rating and count computed from reviews table; seed data of 2,000+ reviews | Vitest: review on non-picked-up order returns 403; second review same order returns 409; seeded 2,100 reviews averaging 4.9 -> /public/stats rating=4.9 count=2100 rounded to 1 decimal |
| Mitra Kantin (tenant partner) program | Mitra application form, admin approval workflow, tenant onboarding (menu, hours, payout bank info), tenant dashboard with sales and settlement | Playwright: applicant submits form -> admin sees Pending -> approves -> applicant receives invite email in Mailpit -> logs in, adds 3 menu items, toggles Buka -> menu visible to students |
| steps: pilih menu, bayar QRIS, ambil di rak | Complete three-step flow with status timeline visible to student | Playwright single test covers choose menu -> QRIS webhook -> tenant Siap -> rack code displayed -> student Diambil, asserting status timeline has 5 timestamped entries |

## Fitur MVP
- Student app (web PWA + Expo app): campus/canteen/tenant browse, search menu, filters (harga, halal, pedas), favorites, reorder
- Cart with counter, notes per item, single-tenant or multi-tenant orders split into tenant sub-orders with one payment
- Midtrans QRIS/Snap sandbox payment, auto-cancel unpaid after 15 min, automatic refund record on tenant rejection
- Order tracking: status timeline, ETA countdown, web push/expo notifications on Siap, rack code + PIN
- Tenant KDS: new order sound, accept/reject, mark Siap, sold-out toggle, open/close stall, daily stock limits
- Rack management: racks and slots per canteen, auto assignment, timeout release, Tidak Diambil handling
- Reviews and ratings after pickup, tenant replies
- Mitra Kantin: application, approval, onboarding, settlement report per day (gross, fee, net) exportable CSV
- Admin: canteens, tenants, racks, live operations board (orders per status, median prep time), user management
- Account: email/OTP via email login, password reset, order history with receipts, spending summary per month

## Peran
- Student (customer)
- Tenant Owner (Mitra)
- Tenant Staff (KDS only)
- Canteen Manager (per canteen: racks, tenants)
- Platform Admin

## Model data
- campus: id, name, city
- canteen: id, campusId, name, openHours, rackCount
- tenant: id, canteenId, name, status(pending|active|suspended), isOpen, payoutBank, feePct
- menu_item: id, tenantId, name, price, prepMinutes, dailyStock, soldToday, availableFrom, availableTo, tags[], imageKey
- order: id, studentId, canteenId, total, status(menunggu_bayar|dibayar|dibatalkan|selesai), pickupSlotAt, createdAt
- sub_order: id, orderId, tenantId, status(dibayar|diproses|siap|diambil|tidak_diambil|ditolak), etaAt, readyAt, pickedAt
- order_item: id, subOrderId, menuItemId, qty, unitPrice, note
- rack_slot: id, canteenId, code, orderId nullable, assignedAt
- payment: id, orderId, midtransOrderId, method=QRIS, amount, status, paidAt, refundStatus
- review: id, subOrderId unique, studentId, tenantId, rating 1-5, comment, tenantReply
- mitra_application: id, applicantEmail, stallName, canteenId, status, reviewedBy
- settlement: id, tenantId, date, gross, fee, net, exportedAt

## Integrasi
- Midtrans sandbox QRIS/Snap with webhook signature verify and refund
- SMTP/Mailpit for login OTP, receipts, Mitra invites, settlement reports
- Web Push (VAPID) and Expo push notifications
- MinIO/S3 for menu photos
- BullMQ/Redis for auto-cancel, pickup timeout, ETA recompute, daily settlement
- SSE/WebSocket for KDS and order tracking realtime updates

## Edge case
- Item sells out while in a student's cart: blocked at checkout with clear message and cart auto-updated
- Item sold out after payment: tenant rejects sub-order, auto refund recorded, other tenants' sub-orders continue
- QRIS paid after auto-cancel window: payment reconciled and refund issued, order not resurrected silently
- All rack slots full: Siap orders queue as Menunggu Rak and student sees wait message
- Student never picks up: after 60 min Tidak Diambil, slot freed, tenant notified
- Tenant closes stall with open orders: must finish or reject existing orders first
- Duplicate webhook or double tap Bayar: one payment, one order
- Weak campus Wi-Fi: tracking page reconnects SSE and falls back to 10 s polling; rack code cached offline
- Canteen closed hours or holiday: menu viewable but ordering disabled with next-open time in WIB
- Cheap phone 360 px: full order flow usable, menu images lazy-loaded and compressed

## Skenario E2E (Playwright/pytest)
- Nadia: 360x740 viewport, register via email OTP, order 2 items, pay QRIS (sandbox webhook), receive Siap notification, see rack code, confirm pickup, rate 5
- Nadia failure: let QRIS expire -> order auto-cancelled after 15 min (fake clock) and cart restorable
- Bima: reorder last order in 2 taps, group order across 2 tenants with one payment, both sub-orders tracked separately
- Bima: item sold out mid-checkout shows error and cart updates without crash
- Bu Yati: KDS receives order within 2 s, marks Siap, rack slot assigned, toggles item habis, sees daily settlement
- Rush test: 100 orders in 5 minutes across 5 tenants; all get unique rack slots or queue, no slot collisions
- Pak Hendra: approve Mitra application, new tenant goes live, public stats increment tenants count
- Pickup timeout: order not picked for 60 min (fake clock) -> Tidak Diambil, slot freed, tenant notified

## Celah dari critic (wajib ditutup)
- **There is no concurrency test for daily stock (dailyStock/soldToday), even though many orders for the last portions arrive at the same time during the 12:00 rush.** → Reserve stock atomically at checkout (UPDATE … WHERE soldToday+qty<=dailyStock) and release it on payment expiry. Test: 20 concurrent paid checkouts on dailyStock 5 give exactly 5 Dibayar and 15 rejected before payment; an expired order restores stock.
- **Pickup is self-confirmed by the student. Nothing at the rack checks the PIN, so a wrong pickup or someone else taking the order goes undetected.** → The rack slot shows a QR or the tenant enters the student's PIN to release the order, and the status moves to Diambil only after the PIN matches. 5 wrong PINs lock the slot for 2 min and alert the tenant. Test: wrong PIN returns 403 with no state change; correct PIN gives Diambil and frees the slot.
- **Scheduled pickup slots have no capacity, so 80 students can choose 12:00 for one stall and the 10-minute promise breaks.** → Set per-tenant capacity for each 10-minute slot, derived from prep times. Full slots are greyed out and the next free slot is suggested. Test: capacity 8, and the 9th order for 12:00 is offered 12:10.
- **The KDS realtime feed has no catch-up after canteen Wi-Fi drops, so paid orders can be missed silently.** → SSE with Last-Event-ID replay plus a 10 s polling fallback, and a red 'Terputus' banner with an audible alert. Test: disconnect the KDS for 30 s while 3 orders are paid; on reconnect, all 3 appear within 2 s, in order, with no duplicates.
- **A multi-tenant order paid in one QRIS charge has no test for a partial refund when only one sub-order is rejected, and no test for settlement fee rounding.** → Refund ledger per sub-order, using the Midtrans refund API with amount equal to the sub-order total. Settlement uses integer Rupiah with fee=round(gross*feePct) and net=gross-fee, bucketed by WIB day. Test: 2-tenant order with 1 rejection refunds exactly that sub-order total; settlement for 23:59 vs 00:01 WIB lands in the correct day.
