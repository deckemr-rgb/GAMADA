# Jajan.in (mobile expense tracker)

Local-first Expo expense tracker for daily jajan in Rupiah: 2-tap quick-add, 7-day chart, per-category stats with insights, monthly target, and scheduled reminders, with optional account sync.

## Persona
- **Rina, 21, mahasiswi Depok**: Non-technical, Android Rp1,5jt (Redmi 3GB RAM), uang saku Rp2,5jt/bulan, often low signal on KRL. Tujuan: Know in 3 seconds how much she can still spend this month without typing much
- **Dimas, 28, karyawan SCBD**: Power user, pays via GoPay/OVO/BCA/cash, wants data out to a spreadsheet, uses Jajan.in on phone and laptop browser. Tujuan: Separate wallets, custom categories, CSV export, weekly report every Sunday, and search for 'kopi' last month
- **Bu Sari, 45, ibu rumah tangga Bekasi**: Uses app via son's setup, large-font needs, forgets to log; son Andi acts as account admin and restores backups. Tujuan: Get a daily 20:00 reminder, log market spending fast, never lose data when changing phones

## Journey pengguna
- Discover: opens /karya/jajanin on gamada site, uses embedded web export in phone frame with seeded demo data, then installs APK
- Onboarding (<60s): pick monthly income/budget (e.g. Rp2.500.000), pick target preset 2jt/2,5jt/3jt or custom, choose reminder time, skip account
- Daily: tap Kopi chip, amount sheet prefilled with last Kopi amount (Rp18.000), tap Simpan; balance, spent, today list and 7-day bar update instantly
- Typing amount: accepts '25rb', '25.000', '1,5jt', '25k'; rejects 0, negative, letters, > Rp100.000.000 with inline error
- Mid-month: Statistik tab shows per-category donut, average per day, and insight 'Ojol naik 32% dari minggu lalu'; Target tab shows 78% with warning color at 80%
- Mistake: swipe-delete wrong transaction, Undo snackbar 5s restores it; edit amount/category/date via long-press
- Offline on KRL: all adds work from SQLite; sync queue drains within 10s of reconnect when signed in; no duplicates
- Change phone: export JSON backup or sign in; restore yields identical totals; session expired shows re-login without data loss
- End of month: at 00:00 WIB on the 1st, Spent resets, last month archived in Riwayat, weekly report Sunday 19:00 WIB

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| monthly balance and spent amount | Balance = monthly budget/income + income transactions in current WIB month − expenses in current WIB month; Spent = sum of expenses in current WIB month; values formatted id-ID 'Rp4.935.000'; computed from SQLite, not hardcoded | Vitest: budget 5.000.000, add expenses 25.000 and 40.000 → spent 65.000, balance 4.935.000; Playwright: header text equals 'Rp65.000' and 'Rp4.935.000'; fake clock 2026-12-01 00:00 WIB → spent 'Rp0', November in Riwayat totals 65.000 |
| quick-add chips Kopi, Makan, Ojol, Snack | Four default chips mapped to categories, opening an amount sheet prefilled with last-used amount per chip (defaults 18.000/25.000/15.000/10.000); save in 2 taps; chips reorderable, editable, addable (max 8) | Playwright: tap 'Ojol' then 'Simpan' → today list top row 'Ojol Rp15.000' within 300ms and DB row category=ojol; second tap of 'Ojol' prefills last saved amount; rename chip persists after reload |
| 7-day chart and today's list | Bar chart of last 7 WIB days inclusive of today, each bar = sum of that day's expenses, tap bar filters list to that day; today list sorted newest first with time, category icon, note | Seed expenses on 7 distinct days; Vitest asserts chart series equals SQL GROUP BY date(WIB) sums; Playwright: tap bar for D-2 → list shows exactly that day's rows; expense at 23:59 WIB counts in that day, 00:00 in next |
| statistics per category, average per day, insight text | Per-category totals and % for selected month; average per day = month spent / elapsed days (full days for past months); deterministic insight engine (week-over-week change ≥20%, top category, days over daily allowance, under-budget streak) | Vitest: spent 600.000 on day 10 → avg 'Rp60.000/hari'; ojol 100.000 last week vs 132.000 this week → insight contains 'Ojol naik 32%'; percentages sum to 100 ±0,1; empty month shows empty state not NaN |
| monthly target with presets 2jt/2.5jt/3jt and progress | Target per month; presets set 2.000.000/2.500.000/3.000.000; custom input; progress = spent/target capped display with over amount; color states <80% green, 80–99% amber, ≥100% red; daily allowance = (target − spent)/remaining days | Playwright: tap '2,5jt' → target 2.500.000 stored; spent 2.000.000 → '80%' with amber class; spent 2.600.000 → '104%' and 'Lewat Rp100.000'; day 20 of 30 with remaining 500.000 → allowance 'Rp50.000/hari' |
| toggles: daily notification, weekly report, night saving mode | Daily notification scheduled via expo-notifications at chosen time (default 20:00 WIB) with today's spent in body; weekly report Sunday 19:00 WIB with week total, top category, vs last week (also in-app Laporan screen, optional email via SMTP when signed in); night saving mode = dark theme auto 18:00–06:00 plus confirm sheet for non-essential categories (Snack, Kopi) after 22:00; all persisted | Vitest with mocked expo-notifications: enabling daily schedules exactly 1 trigger {hour:20,minute:0}, disabling cancels it (0 scheduled); weekly report content snapshot for seeded week; Mailpit receives 1 email on Sunday job run; Playwright with clock 22:30 + night mode adding Snack shows confirm sheet, at 21:00 does not; toggles survive reload |
| all tabs and buttons really work | Every tab (Beranda, Statistik, Target, Riwayat, Pengaturan) and every button is wired to navigation, state change, sheet, or system action; no placeholder handlers | Playwright crawler enumerates all role=button/tab elements on every screen of the web export, clicks each, asserts a DOM/URL/DB change or opened dialog, and asserts 0 console errors and 0 unhandled rejections |

## Fitur MVP
- Transactions CRUD (expense + income) with category, wallet, note, date-time, optional receipt photo
- Quick-add chips with smart amount parsing ('25rb', '1,5jt') and last-amount memory
- Undo snackbar (5s) for delete and edit; Riwayat with month switcher
- Search and filter by text, category, wallet, date range, amount range
- Custom categories (icon, color) and wallets (Tunai, GoPay, OVO, DANA, BCA) with transfer between wallets
- Monthly target with presets, daily allowance, per-category limits
- Recurring transactions (kos, pulsa, Spotify) auto-posted on due date
- CSV export and JSON backup/restore via expo-sharing; import from CSV with preview
- Daily reminder, weekly report, night saving mode, dark/light/system theme, large font option
- Optional account (email + password, reset via email) with multi-device sync and conflict resolution (last-write-wins per field with updatedAt)
- App PIN/biometric lock with auto-lock after 1 min background
- Empty states, onboarding, seeded demo mode for the gamada web embed with reset button

## Peran
- guest (local-only, no account)
- user (signed-in owner of own ledger, sync enabled)
- household member (shared wallet read/write via invite)
- admin (operator: seed/reset demo data, view sync health, no ledger content access beyond support export)

## Model data
- user: id, email, name, tz='Asia/Jakarta', currency='IDR', createdAt
- wallet: id, userId, name, type(cash|ewallet|bank), openingBalance, archived
- category: id, userId, name, icon, color, kind(expense|income), isEssential, sortOrder
- transaction: id, userId, walletId, categoryId, amount(int rupiah), kind, note, occurredAt, receiptKey, recurringId, updatedAt, deletedAt
- budget: id, userId, month(YYYY-MM), income, target, perCategoryLimits(json)
- quick_chip: id, userId, label, categoryId, lastAmount, sortOrder
- recurring_rule: id, userId, template(json), rrule, nextRunAt
- settings: userId, dailyReminderAt, weeklyReport, nightMode, theme, pinHash, locale
- sync_op: id, entity, entityId, op, payload, clientTs, ackedAt
- notification_log: id, userId, kind, scheduledFor, sentAt

## Integrasi
- expo-sqlite local DB with migrations; drizzle schema mirrored server-side in Postgres schema 'jajanin'
- expo-notifications (local scheduled) and Web Notification API in web export
- Hono API /sync push/pull with zod validation and Better Auth sessions
- MinIO bucket for receipt photos via presigned PUT, client-side compression to ≤300KB
- SMTP/Mailpit for password reset and weekly report email (BullMQ cron Sunday 19:00 WIB)
- expo-sharing + expo-file-system for CSV/JSON export, expo-document-picker for import
- Victory Native / react-native-svg charts
- EAS build for APK; Expo web export embedded in gamada /karya/jajanin phone frame

## Edge case
- Offline for days: 500 queued ops sync in one batch without duplicates (idempotent by op id)
- Same transaction edited on two devices: field-level last-write-wins by updatedAt, no lost amount
- Timezone: device set to WITA/UTC still buckets by Asia/Jakarta
- Month boundary and 31-day vs 28-day months; leap year 29 Feb
- Amount parsing ambiguity '1.500' vs '1,5' (id-ID: dot thousands, comma decimal); max Rp100.000.000
- Notification permission denied: toggle shows reason and deep-links to settings; reminder falls back to in-app banner
- Low-end phone 2–3GB RAM: 5.000 transactions list scroll at ≥50fps (FlashList), cold start <2,5s
- Session expired during sync: ops stay queued, re-login resumes; restore of corrupted backup file rejected with message
- Delete category in use: requires reassign to another category
- Storage full while saving receipt: transaction still saves without photo

## Skenario E2E (Playwright/pytest)
- Rina: onboarding with 2,5jt preset → 3 quick-adds (Kopi, Ojol, Makan) → home shows spent Rp58.000 and progress 2,3% → 7-day bar today = 58.000
- Rina offline: set network offline, add 5 expenses, kill and relaunch app, all 5 present; go online signed-in, server has exactly 5 rows
- Dimas: create wallets GoPay and BCA, transfer Rp200.000, search 'kopi' in last month, export CSV and assert row count and header 'tanggal,kategori,dompet,jumlah,catatan'
- Dimas multi-device: add on device A, appears on device B (second browser context) within 10s; edit conflict resolves to latest updatedAt
- Bu Sari: enable daily reminder 20:00, assert scheduled trigger; enable large font, verify computed font-size ≥18px; PIN lock appears after 60s background
- Andi admin: export JSON backup from old device, restore on new device, totals per month identical
- Night mode: clock 22:30, add Snack → confirm sheet → cancel → no row saved; at 07:00 no sheet
- Crawler: click every button/tab in web export, 0 dead controls, 0 console errors; Lighthouse PWA perf ≥85 on web export

## Celah dari critic (wajib ditutup)
- **The household member role has no screens: no invite, shared wallet view, or permission UI.** → Add Pengaturan > Dompet Bersama with an invite by email/link, member list, and remove. Shared wallet transactions show the author avatar. Test: user A invites B, B adds Rp20.000 in a second context, and A sees it within 10 s with B's name.
- **Wallet transfers and wallet opening balances have no rule for whether they count as spent or change the monthly balance, so the headline numbers become wrong.** → Transfers are a separate kind that never enters spent or income. Opening balances affect wallet balances only. Test: transfer Rp200.000 GoPay→BCA leaves spent and monthly balance unchanged and both wallet balances adjust by ±200.000.
- **Recurring transactions are not posted when the app was not opened on the due date (local-first, no server cron for guests).** → Catch-up on app start posts every occurrence since nextRunAt, idempotent by ruleId+dueDate. Test: rule 'kos Rp1.500.000 tiap tgl 1', clock jumps 3 months, open the app; exactly 3 rows posted, and reopening adds 0.
