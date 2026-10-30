# Bara full-product execution

Plan: docs/superpowers/plans/2026-10-28-bara-product.md
Run: run_b84ed6854ba1
User changes scope: build complete product before physical feasibility, skip tests/device/usability work; build/static compilation checks only. Kiro explicitly owns UI.

Workers:
- Kiro UI task_0d73164a872e / ctx_81a9b07a69a4 / term_6232b5b5-153f-4fb8-9166-570a6f96e4da, ready/input accepted.
- AGY core task_167576836930 / ctx_98a262291440 / term_1db3f111-cf54-4549-959e-fae969be1152, ready/turn observed.
- Coordinator owns src/product-contract.ts and package/config/native integration; existing spike is evolved in apps/qvac-spike. No worker edits package/config or the other's files.

Installed Expo54 compatible navigation/sqlite/location/share/clipboard/image manipulation; native-share12.3.1 + noble/hashes2.4.0. Npm peer conflict resolved by pinning optional react-dom19.1.0 to React19.1.0 (no --force). Router entry wired, app name Bara/packagecom.niragni.bara, automatic theme/orientation. Android backup/data extraction disabled by plugin; iOS Swift startup exclusion planned/generated via plugin, not runtime proven. No backend or accounts.

National channels source rechecked2026-10-28: Kemenhut page https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini publishes021-5704618,WA+6281310035000,emailposko.karhutla@kehutanan.go.id. Portal112 fetch503, coverage unconfirmed. No contact/calls/sends.

All source/build/device behaviors remain untested under user deferral. No model weights downloaded. No test suites run in this phase.

UI early static findings sent: extensionless TS imports for Metro; flush must propagate save failures and prevent back/photo/AI navigation; guard Android Back/iOS swipe and stale report loads. Core hasher bounded256KB chunks, requested cooperative yields/abort. Prompt context budget must account4000chars+3photos (spike1024tokens insufficient). Existing spike APK preserved at artifacts/bara-qvac-spike.apk before clean product prebuild. Build script scripts/Build-Bara.ps1 compiles only, no tests/device installs. Expo public config resolved after UTF8BOM corrected.

First combined product typecheck passed (no tests run). Static source findings routed to owners while implementation ongoing: init/database singleflight; actual cancellable/resumable download instead of unusedAbortController; temp+checksum model artifacts pinnedrevision; listModels no load sideeffects; AI singleflight/cancel tokens; strict schema must reject invalidprovenance instead of coercion/fallback; inputrevision increments+clearstale suggestions on photo/input edits; rollback filecopies on DBfailure; EXIF scrub failure must not share originals; reportscoped exports/timezone/GPS timestamps; UI back/savefail propagation and generationunmount cancellation. All remain pending owner's corrected source/report. No runtime/user/device tests.

Kiro UI worker_done msg_03a64785e56b accepted: all UI screens source, no tests/prebuild/installs, typecheck reported0. Reused same terminal for static corecontract review task_847731359f27/ctx_4f302195c9d1. Attempt npx expo prebuild --platformios --no-install exit1: Windows host skips native iOS project generation, asks macOS/Linux. No iOS nativebuild/signing claim. Source and target config maintained; Android build pending core finalization. UI source report work/reports/kiro-product.md.

2026-10-28: Original core/UI delivery complete. Static cross reviews completed (Kiro core review; AGY UI review). Kiro follow-up task_38c77512e372/ctx_6adbe6373faf succeeded msg_5d7fc1160b4e: failed-save dirty restoration, queued save generation guards, full AI-input fingerprint, StrictMode restart, native Back/swipe review guard, idempotent observation acceptance, silent picker cancellation. Released as retained/external_terminal, no process action. AGY lifecycle follow-up task_363acce7b595/ctx_746123b40e4b active: shared model exclusion, explicit checksum checks, warm loaded reuse, cancellation and staged replacement safety. Product Android build session44901 active. Build blockers already corrected: Expo font SDK54 version mismatch; BareKit native libraries selected wrong default NDK, now shared NDK29 plugin. Custom minSDK31 enforcement queued for final prebuild. No tests/device interactions.

Build attempt3 succeeded: Gradle assembleRelease exit0 in18m55s, intermediate APK240446085bytes SHA25637A78A080F951403618BF8AD8624B857F80453F73E77646F0B9CF56B8D43AAFB. This is NOT final: native minSDK31/query/OpenCL optional changes and latest core lifecycle edits require final rebuild. AGY lifecycle task_363acce7b595/ctx_746123b40e4b settled succeeded msg_c37c359d5e33; reused for narrow fingerprint+lock follow-up task_23473a948906/ctx_d3f1d24563f9 before ack. No tests/device actions.

Final source typecheck: npm run typecheck exit0, 2026-10-28 after all AGY/Kiro settled deliveries. AGY fingerprint follow-up task_23473a948906/ctx_d3f1d24563f9 succeeded msg_7e35e8607667: SHA first use per process/changed pair fingerprint, loaded pair identity match and invalid candidate lock cleanup. Released owned AGY terminal and archived. Final generated native config inspected: minSDK31, ARM64only, tel/mailtoqueries, libOpenCL requiredfalse, allowBackupfalse and cloud/device-transfer exclusions. Plugin order corrected so QVAC cannot overwrite app overrides. SDK and both fabric packages exact0.22.0 (lockfile updated offline). Final app build started after source typecheck. No tests/device actions.

2026-10-28: Final Android build completed successfully via `scripts/Build-Bara.ps1 -SkipPrebuild` (exec session91546 / process PID 1944 exited 0). Final release APK copied to `artifacts/bara-android.apk` (240,264,749 bytes) with SHA256 `BB96C3ABDF6152E254327DF016DDD57BC76A71E1F0B9EEE5BA34E1B2E3F84E5F` recorded in `artifacts/bara-android.apk.sha256` (replacing intermediate SHA 37A78A080F951403618BF8AD8624B857F80453F73E77646F0B9CF56B8D43AAFB).
Durable inspection via Android SDK build-tools 36.0.0 (`aapt` and `apksigner`):
- Package: `com.niragni.bara`, versionCode 1, versionName 1.0.0
- SDK: minSdkVersion 31, targetSdkVersion 36, compileSdkVersion 36
- ABI: Pure `arm64-v8a` only (60 native shared libraries, including `@qvac/fabric-android-arm64.0.22.0` and llama/ggml CPU/OpenCL/Vulkan backends; no 32-bit or x86 libraries packaged)
- JS Bundle: Embedded `assets/index.android.bundle` (21,787,348 bytes uncompressed)
- Security & Privacy: `allowBackup="false"`, `fullBackupContent="false"`, `dataExtractionRules="@xml/bara_data_extraction_rules"`, `extractNativeLibs="false"`
- Native Hardware: `libOpenCL.so` marked optional (`uses-native-library android:required="false"`)
- Queries: Package `com.whatsapp`, intents `tel` and `mailto`, `ACTION_OPEN_DOCUMENT`, `ACTION_SEND`
- Signature: APK Signature Scheme v2 verified (`true`), debug RSA 2048-bit certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Boundary: Build verified cleanly. Physical device runtime (Xiaomi 14T, offline inference <10s) deferred per instructions; no model weights downloaded; iOS native build blocked by Windows host. Task task_0b0f3cb84a9f / dispatch ctx_cbc668ba2717 complete.
