# PhoneFarm (Android device farm control panel)

Local control panel that runs on one PC with up to 20 USB/Wi-Fi Android phones: live H.264 screens, full touch/keyboard control, per-app workspaces and a record-and-replay macro runner that can batch actions across devices, plus a simulated 20-device demo mode for the public /tools/phonefarm page.

## Persona
- **Rina Kusumawati (non-technical)**: 32, owner of a small digital agency in Bekasi; demos client Android apps to customers on a wall of 10 cheap phones (Redmi, Samsung A-series); uses only the mouse.. Tujuan: Plug phones in, see all screens at once, open the client app on every phone with one click and present without touching a terminal.
- **Dimas Pratama (power user)**: 27, QA engineer at a Jakarta ojol/fintech startup; tests their own app releases on 20 devices across Android 9-14 and screen sizes; comfortable with ADB and JSON.. Tujuan: Record a login + checkout regression macro once, replay it on 20 devices in parallel after each APK build, collect per-device pass/fail, screenshots and logcat.
- **Yusuf Hakim (operator/admin)**: 35, runs the device lab PC in a Tangerang office; responsible for cables, USB hubs, device health, panel password and keeping the panel unreachable from the LAN.. Tujuan: Know at a glance which slot is offline, overheating or low battery, reboot/reconnect devices remotely, and trust that nothing (video, ADB keys) leaks off the machine.

## Journey pengguna
- Discovery: Rina opens gatraglobal.id/tools/phonefarm, sees the labelled demo with 20 simulated devices, clicks a simulated phone and taps it; CTA 'Pasang di PC Anda' shows a 3-step install (npx/compose, enable USB debugging, open http://127.0.0.1:7420).
- First run: agent starts, prints a one-time panel password to the terminal; Rina pastes it, sees slots 1-20; plugs in 10 phones via hub; each appears within 5 s with model, Android version, battery; phones showing 'unauthorized' get an inline 'Izinkan USB debugging di ponsel' hint.
- Daily use (Dimas): creates workspace 'App Ojol v3.2' bound to package id, uploads APK, 'Install ke grup' to 20 devices with progress bars, launches app everywhere, opens macro 'Login+Order', clicks 'Jalankan di 20 perangkat' with concurrency 20, watches live grid turn green/red, downloads JSON+HTML report.
- Recording: Dimas clicks Rekam on device 3, performs taps/swipes/typing, adds 'tunggu teks Pesanan dibuat' assertion, saves; replay on a different resolution device maps coordinates proportionally and passes.
- Failure - cable unplugged mid-run: device slot turns 'Terputus' within 5 s, its run step is marked failed with reason 'device disconnected', other 19 continue; reconnect resumes stream automatically without page reload.
- Failure - weak/cheap phone: 2 GB RAM Android 9 phone cannot sustain 1080p/30fps; panel auto-suggests 480p/15fps after encoder errors, operator can set per-device resolution and FPS, setting persists per serial.
- Failure - expired session: agent restarted (new in-memory password) while browser tab open; WS closes with 4401, UI shows 'Sesi berakhir, masukkan kata sandi baru' and keeps unsaved macro draft in localStorage.
- Admin (Yusuf): opens Perangkat tab, sorts by battery/temperature, reboots slot 14, renames slots by physical shelf position, exports device inventory CSV, checks Security page showing bind address 127.0.0.1 and 0 recordings on disk.

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| control 20 Android phones from one computer: live screens | Grid view rendering up to 20 simultaneous live device streams with per-tile status, click-to-focus large view, and adaptive grid layout (1/4/9/16/20). | Playwright with 20 fake devices (fake-adb shim + FFmpeg testsrc H.264 feeders): within 15 s all 20 <canvas> tiles report decodedFrames>0 and each tile's measured fps >= 10 for 30 s at 480p/15fps on the CI runner. |
| auto-scan each device every 5 s, 20-slot serial connection | Device scanner polling `adb devices -l` (and track-devices) every 5 s; stable slot map serial->slot 1..20 persisted; 21st device goes to a 'Antre' list; states online/offline/unauthorized/recovery. | Vitest with fake adb: add device -> appears in /api/devices within 5.5 s; remove -> state offline within 5.5 s; reconnect same serial returns to same slot number; adding 21 devices yields 20 slotted + 1 queued; scanner interval asserted 5000 ms +/-200 ms over 10 ticks. |
| H.264 live streaming with per-device resolution and FPS | scrcpy-server pushed per device, raw H.264 over WebSocket per device, decoded in browser via WebCodecs (FFmpeg-to-fMP4/MSE fallback); per-device settings maxSize {480,720,1080} and maxFps {5..60}, bitrate, applied live by restarting only that stream and persisted per serial. | Playwright: set device 4 to 720/30 -> decoder config codedHeight or codedWidth max side == 720 and measured fps in [25,31] within 5 s; other devices' streams not restarted (stream ids unchanged); setting survives agent restart. |
| full ADB control: tap, swipe, type | Mouse click->tap, drag->swipe with duration, wheel->scroll, keyboard text and keys (Back, Home, Recents, Enter, Backspace, volume, power), clipboard paste, rotation-aware normalized coordinate mapping, via scrcpy control socket with `adb shell input` fallback. | Against an Android emulator running a touch-logger test APK: Playwright clicks at 25%/75% of tile -> logged touch within +/-3 px of expected device coords in both portrait and landscape; typing 'Halo Jakarta 123' yields identical text in EditText; swipe 400 ms logs duration 350-450 ms; input-to-log latency p95 < 300 ms. |
| per-app workspace and automation on devices | Workspace = package id + device group + APK artifacts + macros + launch config; group actions install/uninstall/launch/force-stop/clear data/grant permissions/logcat; macro runner with steps tap, swipe, type, key, wait, launchApp, waitForText/waitForId (uiautomator dump), screenshot, assertText, loop, variables per device (CSV), record & replay, batch run with concurrency limit, stop, retry failed, per-device report. | Playwright: create workspace, upload test APK, install to 5 emulators/fakes -> all report installed version; run 6-step macro on 5 devices concurrency 5 -> report has 5 rows with step timings, 5 screenshots, status pass; Stop during run halts all within 2 s; Retry failed reruns only failed devices. |
| server bound to 127.0.0.1, cookie and origin checks, in-memory panel password, ADB key never sent to the browser | HTTP+WS listen only on 127.0.0.1 (refuse 0.0.0.0 config); random panel password generated at startup, held in memory only, printed to terminal; HttpOnly SameSite=Strict session cookie; Origin/Host allowlist on every HTTP and WS upgrade; CSRF token on mutations; login rate limit; no endpoint exposes ~/.android/adbkey. | Script: `ss/netstat` shows listener only on 127.0.0.1:7420; request from LAN IP refused; WS upgrade with Origin http://evil.test -> 403; no cookie -> 401; 10 wrong passwords -> 429; grep of agent data dir and config shows no password; Playwright HAR of a full session contains zero occurrences of adbkey bytes or 'PRIVATE KEY'. |
| 0 recordings stored | Video frames are relayed in memory only, never written to disk/MinIO; screenshots happen only when a macro step or user explicitly requests them and are listed/deletable; Security page shows live count of stored recordings = 0. | Run 20 streams for 5 min, then script asserts no files with .h264/.mp4/.mkv/.webm anywhere under agent data dir and temp dir, MinIO bucket has 0 video objects, and GET /api/security/status returns recordingsStored: 0. |
| stack: Node.js, React, scrcpy, FFmpeg, WebSocket, ADB | Agent = Node 22 + Hono + ws, bundles scrcpy-server and uses system adb/ffmpeg (versions checked at startup with clear error if missing); panel = Vite + React 19 + TanStack Query; About page lists component versions. | GET /api/system returns node, adb, scrcpy-server and ffmpeg versions non-empty; starting agent with adb missing from PATH exits with code 2 and message 'adb tidak ditemukan'; Vitest snapshot of About page lists all six components. |

## Fitur MVP
- Local agent (npx or docker compose with USB passthrough) bound to 127.0.0.1:7420, one-time in-memory password login
- Device scanner every 5 s, 20 stable slots, queue for extras, Wi-Fi ADB pairing (adb pair/connect) form
- Live grid 1/4/9/16/20 + focused view with nav bar (Back/Home/Recents), rotate, screenshot, clipboard sync
- Per-device stream settings (resolution, FPS, bitrate), auto-downgrade suggestion on decoder/encoder errors
- Device info: model, Android version, battery %, temperature, storage, IP; rename slot, tags, groups
- Group actions: install APK (drag-drop), uninstall, launch, force-stop, clear data, reboot, open URL, push/pull file
- Workspaces per app package with saved macros, launch config and APK history
- Macro editor (step list + JSON), record & replay with proportional coordinate mapping, waitForText via uiautomator, variables from CSV per device
- Batch runner with concurrency limit, live progress, stop, retry failed, per-device HTML/JSON report with screenshots and logcat excerpt
- Run history with search/filter, export CSV, delete; macro import/export JSON; undo for macro edits
- Security page: bind address, origin allowlist, active sessions, recordings stored = 0, logout all
- Public demo mode (/tools/phonefarm) with 20 simulated devices and canned macro run, clearly labelled demo

## Peran
- Owner (holds panel password; full control, security settings)
- Operator (device actions, run macros; can be a second panel session)
- Viewer (read-only grid, no input) via read-only toggle per session
- Demo visitor (public simulated mode, no agent)

## Model data
- Device: serial, slot(1-20|null), model, androidVersion, state, transport(usb|wifi), batteryPct, tempC, lastSeenAt, alias, tags[]
- StreamSetting: serial, maxSize, maxFps, bitrateKbps, codec(h264)
- Group: id, name, deviceSerials[]
- Workspace: id, name, packageId, groupId, launchActivity, apkArtifacts[], createdAt
- ApkArtifact: id, workspaceId, versionName, versionCode, sha256, filePath, uploadedAt
- Macro: id, workspaceId, name, steps(json), baseResolution, version, updatedAt
- MacroRun: id, macroId, deviceSerials[], concurrency, status, startedAt, finishedAt, variablesCsvId
- DeviceRunResult: runId, serial, status, failedStep, error, durationMs, screenshotIds[], logcatExcerpt
- Screenshot: id, serial, runId?, path, createdAt (explicit only)
- PanelSession: id(in memory), createdAt, lastActiveAt, readOnly

## Integrasi
- ADB (platform-tools) via child_process + adb server protocol on 5037
- scrcpy-server (pushed to /data/local/tmp) for H.264 video and control socket
- FFmpeg for MSE fallback remux and CI fake device test pattern feeds
- WebSocket (ws) per device stream + one control/events channel
- Browser WebCodecs VideoDecoder
- Drizzle + Postgres schema 'phonefarm' in compose; SQLite file fallback for standalone npx
- GAMADA /tools hub (link + local agent probe on 127.0.0.1)
- Android uiautomator dump for text/id waits

## Edge case
- Device shows 'unauthorized' or 'offline' repeatedly due to bad USB hub: show reason and reconnect button, backoff
- Two phones with identical/empty serial (cheap clones): fall back to transport_id + usb path, warn in UI
- Screen lock/secure window (FLAG_SECURE) yields black frames: tile shows 'Layar dilindungi aplikasi' instead of freezing
- Device rotates mid-stream: decoder reconfigures, touch mapping follows new orientation
- Encoder not supporting requested resolution on old Android 7-9: auto fallback to nearest supported size and report it
- USB bandwidth saturation with 20 devices at 1080p: global bitrate budget warning and one-click 'Mode hemat' (480/15)
- Agent restart invalidates sessions: WS close 4401, macro draft preserved in localStorage
- Macro recorded on 1080x2400 replayed on 720x1600: proportional mapping; text waits used to avoid fixed timing
- APK install fails (INSTALL_FAILED_VERSION_DOWNGRADE, insufficient storage): per-device error with plain-language hint
- Browser tab in background throttles decoding: pause streams when hidden, resume on focus
- Port 7420 already in use: agent picks next free port and prints URL

## Skenario E2E (Playwright/pytest)
- Rina: login with terminal password -> plug 10 fake devices -> all 10 tiles live within 15 s -> 'Buka aplikasi di semua' -> 10 devices report foreground package == workspace package
- Rina: wrong password 3x -> error message; correct password -> grid; close tab and reopen within session lifetime -> still logged in via cookie
- Dimas: create workspace, upload APK, install to 20 fakes, record macro on emulator, replay on 20 with concurrency 10 -> report with 20 rows, download HTML report
- Dimas: macro with waitForText that never appears -> step fails after configured 10 s timeout with screenshot attached; Retry failed reruns only that device
- Dimas: change device 7 to 480/15 while others at 720/30 -> only device 7 stream restarted, fps measured within target ranges
- Yusuf: unplug 3 devices during a 20-device run -> 3 marked disconnected within 5.5 s, 17 complete, run status 'partial'
- Yusuf: security script from LAN host -> connection refused; WS with foreign Origin -> 403; HAR scan -> no adbkey material; recordingsStored == 0 after 5 min streaming
- Demo visitor: open /tools/phonefarm without agent -> demo badge visible, 20 simulated tiles animate, click tile triggers simulated tap ripple, 'Jalankan demo macro' completes in < 20 s

## Celah dari critic (wajib ditutup)
- **The hub at https://gatraglobal.id probing http://127.0.0.1:7420 is blocked by mixed content and Private Network Access, and the strict origin allowlist rejects it too. The 'open local panel if found' feature cannot work.** → Expose an unauthenticated GET /api/health only, with CORS for https://gatraglobal.id and Access-Control-Allow-Private-Network: true on preflight. The hub uses a fallback of opening the panel URL in a new tab when the probe is blocked. Test: Chromium from a test origin gets 200 health with the PNA header; every other endpoint still returns 403 for that origin.
- **Running 20 scrcpy sessions needs 20 distinct adb forward ports, and port allocation and cleanup are unspecified, so collisions or leaked forwards appear after reconnects.** → Port pool 27183-27202 bound to the slot number, with `adb forward --remove` on disconnect and a startup sweep of stale forwards. Test: 20 fake devices start concurrently with 0 EADDRINUSE; 50 plug/unplug cycles leave `adb forward --list` with at most 20 entries.
- **Batch macros fail on devices whose screen is off or locked, and there is no pre-run device preparation. The viewer role has no way to be issued under a single in-memory password.** → An optional pre-run step for each macro wakes the device (KEYCODE_WAKEUP), unlocks it with a swipe or PIN variable from CSV, and sets `svc power stayon usb`. The Owner can generate a one-time read-only access code. Test: a device with the screen off passes the macro after prep; a read-only session's tap gets 403.
