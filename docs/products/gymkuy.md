# GymKuy (workout companion app)

Local-first Expo workout companion that runs today's planned session with set checklists and rest timer, tracks streaks, kcal and personal records, and awards six rule-based badges.

## Persona
- **Fajar, 24, staf admin Tangerang**: Beginner, non-technical, Android Rp2jt, gym membership Rp250rb/bulan, trains 06:00 before commuting. Tujuan: Open the app and know exactly what to do today, tick sets, keep the streak alive
- **Nadia, 30, software engineer Jakarta Selatan**: Power user, PPL 6x/week, tracks weight per set, wants 1RM, PRs, volume, CSV export. Tujuan: Custom routines, progressive overload visibility, accurate history across phone and web
- **Coach Bima, 35, personal trainer Bekasi**: Operator managing 15 clients, assigns programs, checks compliance weekly. Tujuan: Assign a 6-day program to clients and see who completed sessions and their streaks

## Journey pengguna
- Discover: tries embedded web export on /karya/gymkuy with seeded 12-day streak demo, then installs APK
- Onboarding (<90s): goal (otot/turun berat/kebugaran), body weight kg, experience, training days, preferred time; app generates 6-day PPL schedule Mon–Sat, Sunday rest
- Daily: Beranda shows 'Push Day' with exercises (Bench Press 4x8 60kg ...), tap each set to check, rest timer 90s auto-starts with vibration at end
- Finish session: summary with duration, volume (kg), kcal estimate, new PRs highlighted, streak +1, badge toast if unlocked
- Busy day: on Jadwal tab taps the day to quick-complete without set details; undo within 5s; skip day marks as missed
- Interruptions: app killed mid-session, relaunch resumes exact set state and timer elapsed; offline at basement gym works fully
- Progress: weekly comparison this vs last week (sessions/kcal/minutes), 4/8/12-week calories chart, PR list per exercise with date
- Coach: assigns program to client, client receives it on next sync, coach dashboard shows weekly completion %

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| today's session (e.g. Push Day) with exercise checklist | Active program maps weekday (WIB) to a workout template; Beranda renders today's template name and exercises with sets×reps×weight; each set is a checkbox editable for actual reps/weight; Mulai/Selesai creates a workout_session row with set logs; rest timer per exercise | Playwright with clock Monday 2026-11-16 06:00 WIB: heading 'Push Day', 5 exercises listed; check 4 sets of Bench Press → DB set_log count 4 with completedAt; finish → session status 'completed', duration within ±2s of fake clock delta |
| kcal estimate and 12-day streak, weekly day strip | kcal = MET(exercise type, default 5,0 strength) × bodyWeightKg × activeHours, rounded; streak = consecutive scheduled training days completed, rest days neither break nor increment, missed scheduled day resets to 0; weekly strip Mon–Sun showing done/missed/rest/today | Vitest: 70kg, 60 min, MET 5 → 350 kcal; seed 12 consecutive completed scheduled days with 2 Sundays in between → streak 12; skip one scheduled Wednesday → streak 0; strip renders 7 cells with states matching seed |
| weekly 6-day schedule tap to complete | Jadwal tab lists 6 training days (Push/Pull/Legs ×2) + rest day; tapping a day toggles quick-complete creating a session with template default sets and kcal; undo snackbar 5s; editable day mapping | Playwright: tap 'Rabu · Legs' → state 'Selesai', weekly sessions counter +1, streak recomputed; tap Undo within 5s → session row deleted and counter restored; reorder days persists after reload |
| progress: weekly comparison sessions/kcal/minutes, calories chart, personal records | This-week vs last-week (Mon–Sun WIB) totals with delta %; daily kcal bar chart for selectable 1/4/12 weeks; PRs per exercise = heaviest weight × reps and estimated 1RM (Epley w×(1+r/30)) with date, recomputed on edit/delete | Vitest: last week 4 sessions/1.200 kcal/240 min, this week 5/1.500/300 → '+25%' on all three; Bench 80kg×5 → e1RM 93,3; deleting that set reverts PR to previous best; chart series equals SQL daily sums |
| 6 badges (Streak 12 Hari, Push Master, 100 Ton Club, Morning Warrior, Meal Plan 7 Hari, Consistency King) | Rule engine evaluated on every session/meal change: Streak 12 Hari = streak≥12; Push Master = 20 completed Push sessions; 100 Ton Club = cumulative volume Σ(weight×reps) ≥100.000 kg; Morning Warrior = 10 sessions started before 07:00 WIB; Meal Plan 7 Hari = 7 consecutive days with all daily meal plan items checked (Meal tab exists with per-day meals and kcal/protein targets); Consistency King = 4 consecutive weeks hitting planned session count; locked badges show progress x/y; unlock timestamp stored once | Vitest per badge with boundary seeds (11 vs 12 streak, 99.999 vs 100.000 kg, session at 06:59 vs 07:00, 6 vs 7 meal days, 3 vs 4 weeks); Playwright: completing the qualifying session shows unlock toast exactly once and badge card shows date; badge not revoked when streak later breaks |

## Fitur MVP
- Program builder: templates, exercises, target sets/reps/weight, weekday mapping, PPL/Upper-Lower/Full Body presets
- Exercise library (≥80 entries, Indonesian + English names, muscle group, equipment) with search and custom exercises
- Live session: set checklist with actual reps/weight edit, rest timer with vibration/sound and background notification, add/skip exercise, notes
- Session resume after app kill; edit/delete past sessions with stats and PR recompute
- Streak, weekly strip, quick-complete with undo, missed-day handling
- Progress: weekly comparison, kcal chart, volume per muscle group, PR list, body weight log with chart
- Meal plan tab: daily meals checklist, kcal and protein targets, presets (nasi, telur, dada ayam, tempe)
- Badges with progress and unlock history
- Reminders at preferred training time and streak-at-risk at 20:00 WIB if today's session not done
- CSV export of sessions/sets and JSON backup/restore
- Optional account with sync, password reset, coach-client linking
- Empty states, onboarding, kg units, demo mode with reset for the gamada embed

## Peran
- guest (local-only)
- member (signed-in, own data, sync)
- coach (assigns programs to linked clients, read-only view of client sessions/streaks)
- admin (operator: manage exercise library, seed/reset demo, sync health)

## Model data
- user: id, email, name, tz='Asia/Jakarta', bodyWeightKg, goal, preferredTime
- exercise: id, name, nameId, muscleGroup, equipment, met, isCustom, ownerId
- program: id, ownerId, name, assignedBy, active, startDate
- workout_template: id, programId, weekday(1-7), name('Push Day'), kind(push|pull|legs|rest)
- template_exercise: id, templateId, exerciseId, order, sets, reps, weightKg, restSec
- workout_session: id, userId, templateId, date, startedAt, endedAt, status(in_progress|completed|quick|missed), kcal, volumeKg
- set_log: id, sessionId, exerciseId, setNo, reps, weightKg, completedAt
- personal_record: id, userId, exerciseId, weightKg, reps, e1rm, achievedAt, setLogId
- meal_plan_item: id, userId, date, meal, kcal, proteinG, checked
- badge_award: id, userId, badgeCode, unlockedAt; coach_link: coachId, clientId, status

## Integrasi
- expo-sqlite local DB; Postgres schema 'gymkuy' via Drizzle; Hono /sync push/pull with Better Auth
- expo-notifications for rest timer end, training reminder, streak-at-risk
- expo-haptics / expo-av for timer vibration and beep; expo-keep-awake during session
- BullMQ job for coach weekly digest email via SMTP/Mailpit (Monday 07:00 WIB)
- react-native-svg charts; expo-sharing/file-system for CSV/JSON
- EAS APK build; Expo web export embedded in gamada /karya/gymkuy phone frame

## Edge case
- Session spanning midnight counts on start date (WIB)
- Rest day completion attempt: allowed as bonus session, does not alter streak rules
- Weekday mapping changed mid-week: past days keep original schedule for streak calculation
- Body weight not set: kcal shows prompt instead of 0; MET missing defaults to 5,0
- Input validation: reps 1–100, weight 0–500 kg step 0,25; bodyweight exercises allow 0 kg
- Device clock changed backward: sessions keep server/clientTs ordering, streak not inflated
- Offline whole week then sync: badges evaluated once server-side, no duplicate unlocks
- Low-end phone: timer accurate within ±1s after 10 min backgrounded (timestamp-based, not interval-based)
- Coach unlinks client: client data retained, coach access revoked immediately
- Expired session during sync: local data intact, retry after re-login

## Skenario E2E (Playwright/pytest)
- Fajar: onboarding 70kg, Mon–Sat 06:00 → Monday Push Day shown → check all sets → finish → kcal shown, streak 1, Morning Warrior progress 1/10
- Fajar: kill app mid-session after 3 sets, relaunch, 3 sets still checked and timer resumes from stored timestamp
- Seeded 11-day streak: complete today's session → streak 12, 'Streak 12 Hari' toast once, badge dated today
- Nadia: build custom Upper/Lower program, log Squat 100kg×5 → PR card shows e1RM 116,7; edit set to 95kg → PR recomputes
- Nadia: weekly comparison with seeded two weeks shows exact deltas; export CSV row count equals set_log count
- Quick-complete Wednesday on Jadwal, undo within 5s, verify no session row; skip Thursday → streak resets to 0 next day
- Meal plan: check all meals 7 consecutive days via fake clock → 'Meal Plan 7 Hari' unlocked
- Coach Bima: assign PPL program to client (second browser context), client sees it after sync ≤10s, coach dashboard shows completion 1/6 after client finishes a session
- Crawler: every tab/button in web export produces a state change, 0 console errors

## Celah dari critic (wajib ditutup)
- **The rest-timer end alert while the app is backgrounded or the screen is locked is only tested in logic, and session resume after kill is not tested on a device.** → Rest timer schedules an exact local notification at endAt and cancels it on skip. Maestro: start a 90 s rest, lock the screen; the notification and vibration arrive at 90±3 s. Kill the app mid-session, relaunch, and set checkmarks and the timer are restored.
