# Fokusin (Pomodoro focus app)

Local-first Expo Pomodoro app: accurate 25/50/15 timers, task list tied to sessions, honest stats with daily chart and records, and alarm/vibrate/auto-start settings that work offline on cheap Android phones.

## Persona
- **Rina (non-technical)**: 21, mahasiswi Ilmu Komunikasi di Depok, Redmi 9A 2GB RAM, kuota terbatas, belajar di KRL dan kos. Tujuan: Tap one button, focus 25 minutes for skripsi, hear a clear sound when done, see she studied 4 sessions today
- **Bayu (power user)**: 29, backend developer remote di Bandung, Pixel + web export in browser, tracks deep work weekly. Tujuan: Run 50-minute deep-work blocks with auto-start breaks, attach sessions to tasks, review weekly minutes and beat his record, export CSV
- **Pak Hendra (operator/admin)**: 38, guru BK SMA di Bekasi, runs a shared tablet for a study club of 15 siswa. Tujuan: Create named profiles per student on one device, reset a student's data, see who focused most this week

## Journey pengguna
- Discover via GAMADA /karya phone-frame demo, tap Start, timer counts from 25:00 inside the embedded web export
- Install APK, first launch shows 3-screen onboarding, asks notification permission once, no account required
- Daily: pick preset 25, add task 'Bab 2 skripsi', start, lock phone, get end sound + notification at 00:00 even if app killed
- Break 5:00 auto-starts if enabled; after 4 focus sessions long break 15:00 suggested
- Evening: open Stats, see sessions today=4, focus minutes=100, weekly bar chart, record day highlighted
- Failure: phone dies mid-session; on reopen app restores remaining time from stored endAt timestamp or marks session interrupted
- Failure: user changes system clock / timezone WIB to WITA; durations still correct because computed from monotonic elapsed + stored start
- Failure: storage full; write fails, toast 'Penyimpanan penuh, sesi tidak tersimpan' and in-memory state kept until retry

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| 25:00 timer with presets 25/50/15 | Preset selector with 3 presets (Fokus 25, Fokus 50, Istirahat 15) plus short break 5; timer display mm:ss computed from endAt - now, not decrement counter | Vitest with fake timers: select preset 50 shows '50:00'; advance 60s shows '49:00'; Playwright on web export: after 3s real time display within ±1s of '24:57' |
| start/pause/reset | Start sets startedAt/endAt; Pause stores remainingMs; Resume recomputes endAt; Reset returns to preset duration and logs session as 'abandoned' only if >60s elapsed | Vitest: start, advance 10s, pause, advance 30s, display unchanged at 24:50; resume, advance 10s shows 24:40; reset shows 25:00 and session count unchanged |
| session counter | Counter of completed focus sessions today (resets at 00:00 WIB local midnight), shown as dots/number, long break suggestion every 4 | Vitest: complete 4 focus sessions with fake timers, counter=4 and next suggested mode=long break; set clock to next day 00:01, counter=0 |
| tasks: add and cross off | Task list in expo-sqlite: add (trim, max 120 chars, reject empty), toggle done with strikethrough, delete with undo snackbar 5s, optional estimate pomodoros, active task linked to running session | Playwright: add 'Baca jurnal', toggle done shows line-through and persists after reload; add '   ' shows validation error and list length unchanged |
| statistics: sessions today, focus minutes, sessions this week | Stats screen computed by SQL over sessions table (completed focus only), week = Monday-Sunday local | Vitest seed 3 sessions today (25,25,50) + 2 on Monday: today sessions=3, minutes=100, week sessions=5 |
| daily chart | 7-bar chart (Sen-Min) of focus minutes per day with accessible labels and value tooltip, empty days at 0 | Playwright: seeded data renders 7 bars, bar for today has aria-label containing '100 menit' |
| record | Personal record = max focus minutes in a single day and longest streak of consecutive days with >=1 session, badge when broken | Vitest: seed days 50,100,75 then complete 125 today: record=125 and 'Rekor baru' event fired once |
| end-of-session sound | Choice of 3 bundled sounds + volume + preview, played via expo-av and via scheduled local notification sound when app backgrounded | Vitest mock audio: on timer completion play() called once with selected sound id; notification scheduled with trigger at endAt when session starts, cancelled on pause |
| auto-start next session | Toggle: when focus ends, break starts automatically (and vice versa if 'auto-start fokus' enabled) with 3s cancel countdown | Vitest fake timers: autoStart on, finish focus, after 3s mode=break and running=true; autoStart off, mode=break and running=false |
| vibrate in the last 5 minutes | Toggle: haptic pulse at 05:00 remaining and once per minute until 00:00 (5 pulses), skipped on web export with visual flash instead | Vitest mock expo-haptics: 25-min session with toggle on triggers exactly 5 haptics at remaining 300,240,180,120,60s; toggle off triggers 0 |

## Fitur MVP
- Timer engine using absolute endAt timestamps, survives backgrounding and app kill
- Presets 25/5/15/50 plus custom duration 1-120 minutes
- Foreground notification with remaining time and scheduled end notification
- Task list with estimates, active task, undo delete, reorder
- Stats: today, week, 7-day chart, record day, streak, per-task totals
- Export sessions CSV and JSON backup/restore file
- Settings: sound, volume, auto-start, vibrate last 5 min, keep screen awake, dark mode, ID/EN
- Multiple local profiles with PIN-less switch for shared devices
- Empty states for no tasks and no stats
- Web export embeddable in GAMADA phone frame using localStorage adapter

## Peran
- user (single device owner)
- profile member (shared device student)
- device admin (creates/resets profiles)

## Model data
- profile: id, name, color, createdAt
- task: id, profileId, title, estimate, doneAt, order, deletedAt
- session: id, profileId, taskId, mode(focus|short|long), plannedSec, actualSec, startedAt, endedAt, status(completed|abandoned|interrupted)
- settings: profileId, soundId, volume, autoStartBreak, autoStartFocus, vibrateLast5, keepAwake, theme, locale
- record: profileId, bestDayMinutes, bestDayDate, longestStreak

## Integrasi
- expo-sqlite (native) / localStorage adapter (web export)
- expo-notifications local scheduled notifications
- expo-av sounds, expo-haptics, expo-keep-awake
- expo-file-system + expo-sharing for CSV/JSON export
- EAS build APK

## Edge case
- App killed mid-session: restore from endAt; if endAt passed, mark completed with actualSec=plannedSec and show summary
- Notification permission denied: in-app banner explains sound only plays while app open
- Midnight crossing during session: credited to day of endedAt
- Clock/timezone change: elapsed computed from stored timestamps, never negative
- Double tap Start: idempotent, one session row
- Battery saver kills scheduled notification: on resume detect missed end and log completion
- Corrupt backup import: validate with zod, reject with message, no partial write
- 2GB RAM device: cold start under 2.5s, no chart library over 60KB

## Skenario E2E (Playwright/pytest)
- Rina: start 25 preset, lock (background) app 25 min simulated, notification fired and session counter=1
- Rina: add task, cross off, reload, still crossed
- Bayu: preset 50 with auto-start on, completes focus, break auto-starts after 3s cancel window
- Bayu: 7 days seeded, chart shows 7 bars, record badge appears when today exceeds best
- Bayu: export CSV contains header and one row per session with ISO times in +07:00
- Pak Hendra: create 3 profiles, sessions isolated per profile, reset one profile clears only its rows
- Offline: airplane mode, full flow works with zero network requests
- Kill app at 10:00 remaining, reopen after 4 min, display shows 06:00 ±1s

## Celah dari critic (wajib ditutup)
- **The end-of-session sound and notification on cheap Android phones (Doze, battery saver) can fire minutes late. The Vitest mock test does not prove the advertised alarm.** → Use an exact alarm (SCHEDULE_EXACT_ALARM / notifee trigger with alarmManager allowWhileIdle) plus an ongoing foreground notification while running. Maestro on the emulator: start a 1-min custom session, `adb shell dumpsys deviceidle force-idle`, and the notification fires within 5 s of endAt.
