# Kopi Senja (coffee shop company profile, Bandung)

SEO-ready brand website for a Bandung coffee shop with editable story, menu and outlets, live open/closed status in WIB, events, ojol delivery deep links with Bandung zone check, Instagram DM and on-site reservation inbox, and a whole-bean shop with Midtrans checkout tied to the Dago roastery schedule.

## Persona
- **Nadia, 22, mahasiswi ITB (non-technical customer)**: Lives near Dago, uses a Rp2jt Android on campus Wi-Fi and limited data, decides where to hang out from Instagram and Google Maps, pays everything with QRIS/GoPay.. Tujuan: Check if the outlet is open now, see the menu with prices, order delivery via GoFood without searching, and know if there is live acoustic this Friday.
- **Pak Hendra, 41, HR officer di Bandung (power user / bulk buyer)**: Orders catering for office events of 30-50 people, buys 2-3 bags of whole beans monthly for home V60, wants invoices and fresh roast dates.. Tujuan: Request catering for a date and headcount, get a quote, and buy 200g whole beans roasted within the last 7 days with shipping and a receipt.
- **Teh Lina, 29, manajer outlet Kopi Senja (operator/admin)**: Manages 3 outlets from her phone between shifts, posts on Instagram, updates sold-out items, handles reservations and roast batches with the roaster in Dago.. Tujuan: Edit menu prices and stock without a developer, confirm reservations/catering from one inbox, set roast batches Tuesday/Friday and fulfil bean orders.

## Journey pengguna
- Nadia searches 'kopi dago bandung' -> lands on prerendered page, sees hero, 'Buka sekarang - tutup 22.00' badge, menu signature with prices in Rupiah, LCP <2.5s on Moto G4 throttled.
- Nadia opens Outlet page: MapLibre map with 3 pins, address, hours, 'Rute' (Google Maps directions link), distance from her location if permission granted.
- Nadia taps 'Pesan Antar': enters address or uses location -> zone check against Bandung delivery polygon -> 'Gratis ongkir' shown with GoFood/GrabFood/ShopeeFood buttons deep-linking to that outlet's merchant page; outside zone shows nearest alternative (beans shipping).
- Nadia opens Events: 'Live Akustik Jumat 19.00' with this Friday's performer, add-to-calendar (.ics), reminder.
- Pak Hendra fills catering form (date, outlet, headcount 40, budget, menu picks) -> saved to inbox, auto email + WhatsApp-ready summary, and 'Lanjut via Instagram DM' button opening ig.me/m/<handle>.
- Pak Hendra buys 2x Whole Beans 200g: chooses grind (whole/V60/espresso), sees next roast date (Tuesday/Friday), checkout with shipping (Bandung courier flat / JNE-style rate table), pays QRIS via Midtrans, receives receipt email and order tracking page.
- Teh Lina logs into admin on phone: toggles 'Habis' on Es Kopi Susu Aren at Dago outlet, updates price, publishes; site reflects change within 60s without redeploy.
- Teh Lina creates roast batch Friday: links pending bean orders, marks 'Roasted' -> customers get email with roast date; marks shipped with tracking number.
- Failure paths: payment expired releases reserved stock; beans out of stock shows 'Pre-order batch Selasa'; holiday closure overrides hours; slow 3G still shows text menu before images.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| warm brand website: brand story, signature menu with prices, outlet locations | CMS-backed pages (story, menu by category with Rupiah prices, per-outlet availability, photos with alt text), outlets with address, coordinates, hours, phone, map; admin can edit all content; responsive 360px-1440px. | Playwright: admin changes price of item to Rp32.000 -> public menu shows 'Rp32.000' within 60s; outlets page renders 3 MapLibre markers matching DB coordinates; no horizontal scroll at 360px width. |
| opening hours 07.00-22.00 WIB, live acoustic every Friday 19.00 | Opening hours stored per outlet per weekday with special-date overrides; open/closed badge computed in Asia/Jakarta regardless of visitor timezone; recurring event rule (weekly Friday 19:00 WIB) generating occurrences with performer, cancellable per date, .ics export, JSON-LD Event. | Vitest with fake clock: 06:59 WIB -> 'Tutup, buka 07.00'; 07:00 -> 'Buka'; 21:59 -> 'Buka, tutup 22.00'; 22:00 -> 'Tutup'; browser TZ set to UTC gives same result; next-occurrence function returns upcoming Friday 19:00+07:00; .ics DTSTART parses to that instant. |
| free delivery in Bandung via ojol apps | Delivery page with address/geolocation input, point-in-polygon check against admin-editable Bandung delivery GeoJSON, nearest outlet selection, deep links to each outlet's GoFood/GrabFood/ShopeeFood merchant URLs configured in admin, 'Gratis ongkir' label only inside zone. | Vitest: coordinate Jl. Dago (-6.885,107.613) -> inside, nearest outlet Dago; Jatinangor (-6.93,107.77) -> outside; Playwright: in-zone shows 3 ojol buttons whose href equals configured URLs; out-of-zone shows 0 ojol buttons and beans-shipping CTA. |
| Instagram DM for reservations, events, catering | Reservation, event and catering forms storing requests in DB with status (baru/dikonfirmasi/ditolak/selesai), admin inbox with filters, email notifications both ways; each confirmation page has 'Lanjut via Instagram DM' button to ig.me/m/<handle> and a copyable summary text; capacity check per outlet time slot. | Playwright: submit reservation 4 orang Jumat 19.00 Dago -> appears in admin inbox status 'baru', Mailpit has 2 emails (customer + admin); IG button href = https://ig.me/m/<configured handle>; when slot capacity 20 is full, 21st seat request returns 'Slot penuh' with alternative times. |
| whole beans 200g for sale | Product catalog (beans variants by origin, grind option, 200g), stock per variant with reservation on checkout, cart, checkout with shipping address and rate table, Midtrans Snap + QRIS sandbox with signature-verified webhook, order status page, receipt email, admin fulfilment (packed/shipped with tracking). | Vitest: 10 concurrent checkouts for last 3 units -> exactly 3 orders reserved, 7 'stok habis'; payment expire after 15 min releases stock; webhook bad signature -> 401; Playwright: buy 2 bags QRIS sandbox -> order 'Dibayar', receipt in Mailpit with total = items + ongkir. |
| roastery in Dago roasting Tuesday and Friday | Roast schedule (weekday rule Tue/Fri, Asia/Jakarta, holiday overrides), roast batches with date and linked orders, product page showing 'Roast berikutnya' and roast date of current stock, freshness rule (ship only beans roasted <=14 days), roastery page with address on map. | Vitest: on Wednesday next roast date = Friday; on Friday 23:00 WIB next = Tuesday; batch older than 14 days cannot be allocated to an order; Playwright: order email after admin marks batch roasted contains roast date dd MMM yyyy. |
| SEO-ready landing page | Prerendered/SSG HTML for every public route, unique title/meta description, canonical, OG/Twitter images, JSON-LD CafeOrCoffeeShop per outlet (geo, openingHoursSpecification, menu, priceRange), Product + Event schema, sitemap.xml, robots.txt, hreflang id/en, image optimization (AVIF/WebP, width/height). | Lighthouse CI mobile: SEO >= 95, Performance >= 90, Accessibility >= 95; curl of / without JS contains menu prices and h1; JSON-LD validates with schema-dts types in Vitest; sitemap lists all outlet, event and product URLs (count = DB count). |

## Fitur MVP
- Headless CMS admin (Better Auth, roles) for story, menu, outlets, hours, events, products, media
- Live open/closed badge and holiday override banner
- Menu with categories, sold-out toggle per outlet, search and dietary tags
- Outlets map (MapLibre) with directions links
- Delivery zone checker + ojol deep links per outlet
- Reservation/event/catering forms with inbox, capacity slots, email, IG DM handoff
- Events calendar with recurring Friday acoustic, .ics, reminders
- Bean shop: cart, checkout, Midtrans Snap/QRIS, order tracking, receipts, admin fulfilment
- Roast schedule and batches linked to orders
- SEO: SSG, JSON-LD, sitemap, OG, ID/EN
- Newsletter/promo signup with double opt-in
- Analytics dashboard: page views, CTA clicks (ojol, IG, WA), orders, revenue

## Peran
- visitor
- customer (account optional, guest checkout allowed)
- outlet_staff (menu availability, reservations for own outlet)
- manager (all content, orders, events)
- roaster (roast batches, fulfilment)
- owner_admin (users, settings, payments config)

## Model data
- outlets: id, name, slug, address, lat, lng, phone, igHandle, gofoodUrl, grabfoodUrl, shopeefoodUrl, capacity
- opening_hours: outletId, weekday, open, close; hour_overrides: outletId, date, closed, open, close, note
- menu_items: id, category, name, description, price, imageKey, tags[], isSignature
- menu_availability: menuItemId, outletId, soldOut, updatedAt
- events: id, title, rrule, startTime, outletId, performer; event_exceptions: eventId, date, cancelled
- requests: id, type (reservation|event|catering), outletId, date, time, pax, name, phone, email, notes, status
- products: id, name, origin, process, weightGram, price; variants: productId, grind, stock, reserved
- roast_batches: id, roastDate, origin, kg, status; orders: id, customer, items jsonb, shipping, total, midtransOrderId, status, batchId, trackingNo
- delivery_zones: id, name, geojson, active
- pages: slug, locale, title, body, seo jsonb

## Integrasi
- Midtrans sandbox Snap + QRIS with webhook signature verification
- MapLibre GL + OSM tiles; Nominatim-compatible geocoding (self-hosted or cached) for address input
- Instagram DM deep link (ig.me/m/handle) and Instagram profile embed via official oEmbed
- GoFood/GrabFood/ShopeeFood merchant deep links (configured URLs)
- SMTP/Mailpit for confirmations, receipts, roast notices
- MinIO/S3 for images with sharp-based resizing worker
- Lighthouse CI + sitemap generator in build
- iCalendar (.ics) generation

## Edge case
- Visitor browser in UTC/WITA -> hours still computed in WIB
- Lebaran/holiday closure override -> badge 'Tutup hari ini' and reservations blocked for that date
- Friday acoustic cancelled for one date -> that occurrence hidden, others unaffected
- Geolocation denied -> manual address input still works
- Address geocoding fails or ambiguous -> ask to pick from list, no false 'gratis ongkir'
- Last bean stock bought concurrently -> no oversell; expired payment releases reservation
- Reservation for past time or beyond 30 days -> validation error
- Menu item sold out at one outlet but available at another -> shown per outlet
- Slow 3G / low-end phone -> text content visible without JS, images lazy and sized
- Admin enters price with dots 'Rp 32.000' -> parsed to integer 32000

## Skenario E2E (Playwright/pytest)
- Nadia: land on home at 21:30 WIB (fake clock) -> 'Buka, tutup 22.00'; menu shows prices; outlets map 3 pins
- Nadia: delivery check with Dago coordinate -> 3 ojol buttons with correct hrefs; Jatinangor -> beans shipping CTA only
- Nadia: events page shows next Friday 19:00 acoustic, downloads valid .ics
- Pak Hendra: catering request 40 pax -> inbox 'baru', emails sent, manager confirms -> customer email 'dikonfirmasi'
- Pak Hendra: buy 2x beans V60 grind, QRIS sandbox paid -> order Dibayar, receipt total correct, stock decremented
- Pak Hendra: payment expires -> order Kedaluwarsa, stock restored
- Teh Lina: mark item sold out at Dago -> public Dago menu shows 'Habis', Braga still available
- Teh Lina: create Friday roast batch, allocate orders, mark shipped with tracking -> customer emails contain roast date and tracking
- Concurrency: 10 parallel checkouts for 3 units -> 3 success, 7 rejected
- SEO: Lighthouse CI on /, /menu, /outlet/dago, /beans meets thresholds; HTML without JS contains h1 and prices

## Celah dari critic (wajib ditutup)
- **Reservation slot capacity has no concurrency test, so two simultaneous 4-pax bookings at 18/20 can overbook.** → Atomic capacity check per outlet+slot using SELECT FOR UPDATE on a slot row. Test: 5 parallel 4-pax requests on a slot with 4 seats left give 1 confirmed and 4 'Slot penuh'.
- **Bean shipping cost has no defined calculation. 'Rate table' has no address-to-zone or weight rule, so the checkout total cannot be tested.** → Rate table by kota/kabupaten zone (Bandung Raya flat, Jawa, luar Jawa) × weight brackets in 200g units, using integer Rupiah. Test: 2×200g to Kota Bandung equals the flat Bandung rate; 3×200g to Surabaya equals the Jawa 1kg bracket; the receipt total equals items plus ongkir.
