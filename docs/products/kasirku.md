# KasirKu (POS warung & kafe)

Multi-tenant POS for warung and kafe: fast offline-capable cashier, live stock sync across devices and outlets, QRIS/Tunai/Debit payments, and automatic daily closing reports in Rupiah/WIB.

## Persona
- **Bu Sari (non-technical)**: 48, owns a warung sembako in Bekasi, uses a Rp1,5 juta Android phone, low data quota, unstable signal. Tujuan: Ring up sales quickly, know what is running out, and close the day without a notebook
- **Raka (power user)**: 29, owns 3 kafe outlets in Jakarta Selatan, laptop + tablet per outlet, checks numbers daily from his phone. Tujuan: Compare outlets, see per-product margin, export reports for his accountant, keep stock consistent between outlets
- **Dewi (kasir/operator)**: 22, shift cashier at Raka's kafe, handles lunch rush of 60+ orders/hour, uses tablet with barcode scanner and thermal printer. Tujuan: Checkout in seconds, split payment, handle voids correctly, close her shift with exact cash count
- **Admin GAMADA (platform operator)**: Studio admin managing 40+ tenant shops. Tujuan: Onboard tenants, monitor sync health, reset access, see platform-wide usage

## Journey pengguna
- Discovery: Bu Sari sees /karya demo, opens live demo with seeded warung, rings a sale in under 30 s without login (demo tenant reset nightly)
- Onboarding: owner signs up, creates outlet, imports products via CSV (name, SKU, barcode, price, cost, stock, unit), invites kasir by email/link with role Kasir
- Daily sale: kasir scans barcode or taps grid, adjusts qty, applies discount, chooses QRIS/Tunai/Debit, prints/shares receipt via WhatsApp link
- QRIS flow: Midtrans Snap QRIS displayed on customer-facing screen, webhook marks Lunas, receipt auto-issued; on timeout kasir can retry or switch to Tunai
- Offline: signal drops mid-shift, sales continue locally (IndexedDB queue), stock decremented locally, auto-sync on reconnect with conflict resolution
- Out of stock: product hits 0, cart blocks or warns per setting; low-stock alert appears on Stok tab and as email/push to owner
- Closing: kasir ends shift, enters counted cash, system shows expected vs counted variance; owner gets automatic daily report at 22:00 WIB (email + dashboard)
- Power use: Raka compares outlets in Laporan, exports XLSX/CSV/PDF for date range, transfers stock between outlets, reviews void/refund audit log
- Failure: expired session mid-transaction keeps cart in local storage and resumes after re-login; double-tap on Bayar never creates two transactions (idempotency key)

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| Dashboard POS for 40+ retail shops | Real multi-tenant schema (tenant_id on every row, Better Auth org per shop) with seed of 40+ distinct shops; platform admin counter computed from DB, not hardcoded | Seed script creates 42 tenants; GET /admin/stats returns tenants>=40; Vitest RLS test: tenant A token querying tenant B product id returns 404 for all 12 resource endpoints |
| fast cashier | Keyboard/scan-first checkout: barcode input focus, product search with prefix index, numeric hotkeys, one-tap Tunai pas, optimistic UI | Playwright: 5-item sale via barcode scans + Tunai completes in <=8 s wall time and <=7 interactions; product search over 5,000 SKUs returns results in <150 ms p95 (Vitest bench) |
| stock sync | Stock ledger (movements table) as source of truth; realtime push (SSE/WebSocket) to all devices of the outlet; offline queue with server-side ordering and negative-stock conflict flag | Playwright with 2 browser contexts on same outlet: sale on device A updates stock on device B within 2 s; 50 concurrent checkouts of a product with stock 30 yield exactly 30 successful decrements + 20 rejections or flagged oversells, final stock 0 never negative unless allowNegative=true |
| automatic daily reports | BullMQ repeatable job at 22:00 Asia/Jakarta per outlet generating report snapshot (omzet, transaksi, item, per-payment-method, top products, void list, cash variance) stored + emailed via SMTP as PDF | Vitest with fake clock at 22:00 WIB: job creates daily_report row per active outlet and Mailpit API shows 1 email per owner with PDF attachment whose totals equal SQL sum of that day's Lunas transactions |
| closing the books takes only 5 minutes | Guided shift/day close wizard: auto-calculated expected cash, denomination counter, variance note, one-click lock of the day, report preview | Playwright persona script for Dewi completes close (count cash, confirm, lock) in <=10 interactions and <60 s; after lock, editing a transaction of that day returns 409 |
| KPI cards: omzet, transaction count, items sold, average receipt, each with day-over-day delta | /dashboard/kpi endpoint computing today vs yesterday (WIB day boundary) with delta %, handling yesterday=0 | Vitest: seeded today omzet Rp1.200.000/24 trx and yesterday Rp1.000.000/20 trx returns omzet delta +20.0%, avg receipt Rp50.000 vs Rp50.000 delta 0%; yesterday=0 returns delta null rendered as 'baru'; sale at 23:59 WIB counts today, 00:01 counts next day |
| 7-day sales chart, top 5 products, last transactions table with status Lunas | Chart from aggregated daily sales (zero-filled gaps), top-5 by qty and by omzet toggle, transactions table with statuses Lunas/Menunggu/Batal/Refund and pagination | Playwright: chart has exactly 7 points including zero day; top-5 list matches SQL ORDER BY qty DESC LIMIT 5; new QRIS sale shows Menunggu then Lunas within 3 s after simulated Midtrans webhook |
| payments QRIS / Tunai / Debit | Midtrans sandbox Snap/QRIS charge with webhook SHA512 signature verification and idempotent status update; Tunai with change calculation and quick-cash buttons; Debit recorded with EDC reference; split payment | Vitest: webhook with wrong signature_key returns 401 and no state change; same settlement webhook sent 3 times yields 1 Lunas update; Tunai Rp100.000 for Rp73.500 shows kembalian Rp26.500; split Rp50.000 Tunai + rest QRIS sums exactly |
| tabs Dashboard, Transaksi, Produk, Stok, Laporan, Pengaturan | Six routed, functional screens with CRUD and role-gated access (Kasir sees only kasir + own transactions) | Playwright visits each of 6 routes as Owner: no 404/empty placeholder, each performs one write (e.g. add product, stock opname, change receipt footer); as Kasir, Laporan and Pengaturan return 403 page |

## Fitur MVP
- Kasir screen: barcode/search/grid, qty, discount per item and per bill, hold/park bill, split payment, receipt print (ESC/POS via WebUSB/Bluetooth) and WhatsApp/email digital receipt
- Payments: Midtrans QRIS/Snap sandbox, Tunai with change, Debit with reference, refund/void with reason and PIN supervisor
- Produk: CRUD, variants (size/temperature), modifiers (extra shot), categories, cost price, CSV import/export, barcode label print
- Stok: ledger, stock in (purchase), opname with variance, transfer between outlets, low-stock threshold alerts
- Laporan: daily/range sales, per payment method, per kasir, per outlet, gross margin, export CSV/XLSX/PDF, automatic 22:00 WIB daily report email
- Shift management: open with modal awal, close with cash count and variance, day lock
- Offline-first kasir PWA: IndexedDB queue, local receipt numbering per device, sync status indicator
- Multi-outlet + RBAC: Owner, Manager, Kasir; invites, PIN quick-switch between kasir on shared tablet
- Pengaturan: outlet profile, tax/PB1 and service charge toggles, receipt header/footer, printer setup, password reset via email
- Audit log of voids, refunds, price changes, stock adjustments; global search over transactions by number/amount

## Peran
- Platform Admin (GAMADA): manage tenants, impersonate for support, platform stats
- Owner: all outlets, reports, settings, billing
- Manager: one or more outlets, products, stock, approve voids/refunds
- Kasir: checkout, own shift, view own transactions
- Customer (anonymous): sees QRIS and digital receipt link

## Model data
- tenant: id, name, plan, createdAt
- outlet: id, tenantId, name, address, timezone=Asia/Jakarta, taxRate, serviceRate
- user/member: id, tenantId, role, outletIds[], pinHash
- product: id, tenantId, sku, barcode, name, categoryId, price, cost, trackStock, lowStockThreshold, active
- product_variant/modifier: id, productId, name, priceDelta
- stock_movement: id, outletId, productId, qtyDelta, type(sale|purchase|opname|transfer|refund), refId, deviceId, createdAt
- transaction: id, outletId, number, shiftId, kasirId, subtotal, discount, tax, service, total, status(Menunggu|Lunas|Batal|Refund), clientUuid(idempotency), createdAt
- transaction_item: id, transactionId, productId, variantId, qty, unitPrice, discount
- payment: id, transactionId, method(QRIS|Tunai|Debit), amount, midtransOrderId, status, reference, paidAt
- shift: id, outletId, kasirId, openingCash, expectedCash, countedCash, variance, openedAt, closedAt
- daily_report: id, outletId, date, totals jsonb, pdfKey, emailedAt
- audit_log: id, tenantId, actorId, action, entity, before, after, createdAt

## Integrasi
- Midtrans sandbox Snap + QRIS with webhook signature verification
- SMTP via Mailpit for reports, invites, password reset
- MinIO/S3 for report PDFs, product images, CSV imports
- BullMQ/Redis for daily reports, low-stock alerts, sync processing
- ESC/POS thermal printer via WebUSB/Web Bluetooth with browser print fallback
- WhatsApp click-to-chat link for digital receipt (wa.me with receipt URL)

## Edge case
- Offline for 4 hours with 200 queued sales syncs without duplicates or lost items
- Two devices sell last unit simultaneously while one is offline: oversell flagged in Stok for manager resolution
- QRIS paid but webhook delayed or arrives after kasir switched to Tunai: auto-detect double payment and prompt refund
- Midtrans expire/deny status: transaction returns to editable cart
- Price changed mid-shift: open carts keep old price until refreshed; receipts show price at sale time
- Sale across midnight WIB and device with wrong clock: server time used for day bucketing
- Cheap phone 2 GB RAM, 360 px width: kasir screen usable, bundle <200 KB gzip for kasir route
- Expired session during checkout: cart persisted and restored after login
- Rounding: Rupiah integers only, no floating point; discounts never produce negative totals
- CSV import with bad rows: partial import with downloadable error report

## Skenario E2E (Playwright/pytest)
- Bu Sari: sign up, add 10 products by CSV, sell 3 items Tunai on 360x740 viewport, see KPI update, receive 22:00 WIB report email in Mailpit
- Bu Sari offline: set browser offline, make 5 sales, go online, verify 5 transactions on server and stock correct
- Dewi: open shift Rp200.000, 20 mixed-method sales including split and one void with manager PIN, close shift with variance 0
- Dewi QRIS: generate QRIS, simulate Midtrans settlement webhook, status Lunas within 3 s, receipt link opens
- Dewi failure: QRIS expire webhook returns cart; double-click Bayar creates exactly 1 transaction
- Raka: two outlets, transfer 10 units between them, compare outlets in Laporan, export XLSX whose totals equal dashboard
- Raka concurrency: 50 parallel API checkouts on stock 30 product; final stock and transaction counts consistent
- Admin: seed 42 tenants, verify stats >=40 and cross-tenant access denied on every endpoint

## Celah dari critic (wajib ditutup)
- **Offline mode has no QRIS path. Dynamic Midtrans QRIS needs network, so a cashier offline mid-rush has no defined QRIS flow.** → When offline, the dynamic QRIS button is disabled and a static merchant QRIS image is shown. The cashier marks the sale 'QRIS statis – perlu cek' and it syncs with status Menunggu Verifikasi into a reconciliation list on the Transaksi tab. Test: setOffline, QRIS sale goes to the reconciliation list after reconnect, and it is excluded from omzet Lunas until confirmed.
- **Offline sync and per-device receipt numbering are listed as edge cases but have no acceptance test proving there are no duplicates or number collisions across devices.** → Receipt format is OUTLET-DEVICE-YYYYMMDD-seq with a unique index. Test: 3 browser contexts offline, 50 sales each, reconnect with an injected network drop mid-batch and the batch replayed twice. Result: exactly 150 server transactions, 150 unique numbers, stock ledger sum correct.
- **Shift close does not account for unsynced offline sales, so expected cash and variance are wrong when the queue has not drained.** → Close wizard blocks while the device sync queue is above 0 (shows 'n transaksi belum tersinkron' with a Sync button), or it computes expected cash from server plus local queue. Test: 3 queued offline Tunai sales, close is blocked; after sync, expected cash includes them.
