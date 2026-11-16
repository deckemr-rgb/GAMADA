# Racunin (food discovery app)

Expo food discovery app for Jabodetabek kuliner: filterable menu cards with rating and Rupiah price, favourites, a MapLibre map with category pins and popups, profile levels, new-food notifications and an extra-spicy mode, backed by a Hono API with offline cache.

## Persona
- **Dinda (non-technical)**: 24, karyawati di Sudirman, Oppo A16 3GB RAM, makan siang budget Rp25.000, sering sinyal lemah di lift/basement. Tujuan: Find something pedes near the office under Rp25k in 30 seconds and save it to favourites
- **Raka (power user)**: 27, food vlogger kecil di Tangerang Selatan, explores 5 tempat per minggu, wants spicy level ratings and map planning. Tujuan: Turn on extra-spicy mode, browse map by category, collect favourites per area, write ratings, climb profile level
- **Mbak Sari (operator/admin)**: 33, curator/content admin for Racunin, manages listings from a web admin panel. Tujuan: Add new food with photos, price, category, coordinates; publish and trigger 'makanan baru' notification to opted-in users; hide closed places

## Journey pengguna
- Discover via GAMADA /karya phone-frame demo; chips and map work in browser with seeded Jakarta data
- Install APK, choose location permission or pick area (Jaksel, Tangsel, Bekasi...) manually, browse feed
- Daily: tap chip Pedes, sort by harga termurah, tap heart on Seblak Rp18.000, card shows filled heart instantly (optimistic)
- Map: open Peta tab, pins coloured per category, tap pin shows popup with name, rating, price, 'Lihat detail' and 'Rute' (opens maps app intent)
- Profile: earns XP for favouriting, rating, visiting detail; level up toast; toggles notifications and extra-spicy mode
- Failure: offline in basement; feed served from cached last sync with banner 'Mode offline', favourites queued and synced later
- Failure: food removed by admin while favourited; favourites shows 'Tidak tersedia lagi' item with remove action
- Failure: location denied; map centers on Monas default and distance sort disabled with explanation

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| category chips Semua/Pedes/Manis/Gurih/Minum | Horizontal chip bar with 5 categories, single-select, filter applied client-side on cached list and server-side via GET /foods?category=, selected chip persisted per session | Playwright with seed 20 foods (6 pedes): tap 'Pedes' shows exactly 6 cards all tagged pedes; tap 'Semua' shows 20 |
| food cards with rating and price | Card: photo (lazy, placeholder blurhash), name, place, rating 0-5 one decimal with count, price formatted 'Rp18.000' via Intl id-ID, distance if location known | Vitest: formatPrice(18000)==='Rp18.000' (nbsp-normalized); Playwright: first card shows rating text matching /\d\.\d/ and price matching /^Rp[\d.]+$/ |
| tap to favourite | Heart toggle with optimistic update, stored in local sqlite + POST/DELETE /me/favorites synced via outbox, idempotent | Playwright: tap heart, aria-pressed=true within 100ms; reload, still true; API GET /me/favorites contains foodId exactly once after 3 rapid taps resolving to favourited state |
| stylized map with category pins | MapLibre GL map with custom style JSON (brand colors), clustered pins coloured by category, chip filter applies to pins too | Playwright: map source 'foods' feature count equals visible list count for selected category (query via exposed map instance in test build) |
| info popup on pin | Tapping pin opens popup/bottom sheet with name, category, rating, price, favourite toggle, detail link, route button | Playwright: click pin for seeded 'Es Teh Solo', popup visible containing 'Es Teh Solo' and 'Rp5.000'; click 'Lihat detail' navigates to /food/:id |
| favourites list with reset | Favourites tab listing saved items newest first, swipe/remove single, 'Reset favorit' with confirm dialog and 5s undo | Playwright: favourite 3, open tab shows 3; reset + confirm shows empty state; tap undo within 5s restores 3 |
| profile level | XP rules (favourite +5, rating +10, first detail view per food +2, daily cap 100), levels Pemula/Penjelajah/Pemburu Racun/Suhu Kuliner with thresholds 0/100/300/700, progress bar | Vitest: applying 20 favourite events yields xp=100 and level 'Penjelajah'; 25 events same day capped at 100 |
| notification for new food | Opt-in toggle; admin publish triggers job that sends Expo push to opted-in users filtered by preferred categories; in-app notification inbox with read state | API integration test: publish food category pedes, BullMQ job sends to 2 of 3 users (1 opted out); inbox GET /me/notifications returns 1 unread item for opted-in user |
| extra spicy mode | Profile toggle that adds spice level (1-5 cabai) filter >=4 to Pedes feed, red theme accent, and shows spice level badge on cards | Playwright with seed spice levels: toggle on, Pedes chip shows only foods with spiceLevel>=4 and badge text '🌶x4' or higher rendered as aria-label 'level pedas 4' |
| empty states | Designed empty states for no favourites, no results for filter/search, offline with no cache, no notifications, each with CTA | Playwright: fresh user favourites tab shows text 'Belum ada favorit' and button 'Jelajahi makanan'; search 'zzzz' shows 'Tidak ada hasil' |

## Fitur MVP
- Feed with chips, search by name/place, sort (rating, harga, jarak), price range filter
- Food detail: photos, description, price, rating breakdown, opening hours WIB, open-now badge, address, route intent
- Ratings & short reviews (1 per user per food, editable)
- Favourites with offline outbox sync and reset/undo
- MapLibre map with clustering, pins, popup, recenter to my location
- Auth: guest mode local, optional email login (Better Auth) to sync across devices, password reset via email
- Profile XP/levels, notification preferences per category, extra-spicy mode
- Admin web panel: CRUD foods, image upload to MinIO, map coordinate picker, publish/hide, notification preview
- Seed dataset 60 Jabodetabek foods for demo/web export

## Peran
- guest (local favourites only)
- user (synced account)
- curator (create/edit draft foods)
- admin (publish, hide, send notifications, manage curators)

## Model data
- food: id, name, placeName, category(pedes|manis|gurih|minum), spiceLevel 0-5, priceIdr int, lat, lng, area, address, openHours json, photoKeys[], status(draft|published|hidden), publishedAt
- rating: id, userId, foodId, stars 1-5, text, createdAt (unique userId+foodId)
- favorite: userId, foodId, createdAt, deletedAt (unique userId+foodId)
- user_profile: userId, xp, level, extraSpicy, notifyNewFood, notifyCategories[], area
- xp_event: id, userId, type, foodId, points, createdAt
- notification: id, userId, type, foodId, title, body, readAt, sentAt
- push_token: userId, token, platform, lastSeenAt
- outbox (client): id, op, payload, attempts, createdAt

## Integrasi
- Hono API + Drizzle schema racunin on Postgres 17
- MapLibre GL (react-native maplibre on native, maplibre-gl on web export) with self-hosted style + OSM tiles
- Expo push notifications via BullMQ worker
- MinIO for food photos with presigned upload and resized thumbnails
- Better Auth email/password + Mailpit for reset emails
- expo-location, Linking intent to Google Maps/Gojek-style route URL

## Edge case
- Offline first launch with no cache: empty state 'Butuh internet untuk pertama kali' + retry
- Favourite toggled offline then food hidden by admin: sync returns 404, item marked unavailable not crashed
- Rapid heart taps: debounced to final state, single server row
- Location denied or GPS inaccurate >500m: distance hidden, sort by jarak disabled
- Map on low-end GPU: fallback to list view toggle; 200+ pins clustered, pan stays >30fps on mid device
- Price 0 or missing photo: show 'Gratis'/placeholder, never broken image
- Push token expired (DeviceNotRegistered): token deleted, no retry storm
- Expired session: refresh token flow; if fails, keep local data and prompt login without losing outbox

## Skenario E2E (Playwright/pytest)
- Dinda: chip Pedes + sort harga termurah, first card price <= second card price, favourite it, appears in Favorit tab
- Dinda: go offline, favourite 2 items, go online, outbox flushes and server has 2 favourites within 5s
- Raka: enable extra-spicy mode, Pedes feed only spiceLevel>=4, open map, pins match filtered list, tap pin popup shows price
- Raka: rate 10 foods, XP=100, level shows 'Penjelajah' with toast once
- Raka: reset favourites, confirm, empty state shown, undo restores all
- Mbak Sari: login as admin, create food with photo upload and map pin, publish, opted-in user inbox gets 1 notification and feed shows new card
- Mbak Sari: hide food, it disappears from feed and map within next fetch; favourited users see 'Tidak tersedia lagi'
- Guest user: no login, favourites persist locally across app restart; after signup, local favourites merged to account without duplicates

## Celah dari critic (wajib ditutup)
- **The map has no offline story and depends on public OSM tiles, so the map tab is blank in the basement even though the feed works offline.** → Self-host Jabodetabek vector tiles as PMTiles with a cached style and glyphs. The service worker / native cache keeps the last viewed area, and pins render from cached foods. Test: view the map online, setOffline, reload; the map renders tiles and pins with count equal to the cached list.
- **Food card ratings may be hardcoded in the seed, and the rating aggregate is not recomputed when ratings arrive at the same time.** → Store ratingAvg/ratingCount on food and update them in the same transaction as the rating upsert, or compute them in a view. Test: grep finds no literal rating in components; 20 concurrent ratings give count +20 and an exact average.
