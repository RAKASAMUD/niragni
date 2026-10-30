# Kiro — Local testing + desktop web-preview feasibility

Dispatch `task_225fc95bfce0`. Date: 29 October 2026 (Asia/Jakarta). Read-only
assessment + evidence; latest user instruction ("diskusi dulu") supersedes the
earlier emulator/phone test priority — all phone/emulator/network/download/build
work is HELD pending discussion. No implementation or mutation performed for the
web-preview question.

## A. What was actually done before the hold (real evidence)

### System inventory (read-only)
- Host: Intel i5-1235U (x86_64, 10C/12T), RAM 7.7 GB total with only ~0.6–0.9 GB
  free under the running agent stack, C: 97.6 GB free. Virtualization:
  `HypervisorPresent=True`, emulator `-accel-check` => "WHPX is installed and
  usable".
- Android SDK: emulator 36.3.10; NO cmdline-tools (sdkmanager/avdmanager absent).
  Existing image: `android-36.1/google_apis_playstore/x86_64`. Existing AVD
  `Medium_Phone_API_36.1` (untouched).

### Emulator attempt (now cancelled by user steering)
- Created a NEW isolated AVD `Niragni_Test_API36_x86_64` from the existing image
  (did not touch the existing AVD). It BOOTED (sdk 36, abilist
  `x86_64,arm64-v8a` → ARM64 translation advertised).
- Installing the 240 MB ARM64 release APK **OOM-crashed the emulator twice**
  (streamed and `--no-streaming` at 2048 MB guest) due to host RAM pressure —
  a real resource blocker, not an ABI rejection. The emulator process exited.
- User then switched to physical-device-only and cancelled emulator work; my
  task-owned emulator had already exited (nothing to stop); existing AVD intact.

### Physical Xiaomi 14T (authorized, exact serial; real evidence)
- Read-only inventory: Android 16 / SDK 36, HyperOS OS3.0 (MIUI V816), security
  patch 2026-07-01, ABI pure `arm64-v8a`, physical RAM MemTotal ~11.05 GiB
  (RAM-expansion/zram is SwapTotal ~12 GiB, EXCLUDED), /data free 164 GB. No
  pre-existing `com.niragni.bara` and no legacy Bara package → clean install, no
  cert conflict, no uninstall/data risk.
- Installed `artifacts/niragni-android.apk` (Success), v1.0.0, primaryCpuAbi
  `arm64-v8a`. Launched `com.niragni.bara/.MainActivity`: foreground, process
  stable, **0 FATAL / 0 AndroidRuntime crashes / 0 RN-bundle errors** in
  sanitized logcat → real install+launch smoke PASS (NOT inference proof).
- SmolVLM2 pinned pair downloaded on the LAPTOP, SHA-256 VERIFIED against the
  manifest (model `6f67b80…438bc` 436,808,704 B; projector `921dc7e…ef520b`
  108,785,184 B; commit `ccd7aae`, Apache-2.0) and `adb push`ed to phone
  `/sdcard/Download`. The user then (per coordinator) selected both files via the
  app's Impor berkas picker — but the user paused for discussion BEFORE I captured
  the import/checkModel load result, so **no inference was run and none is claimed**.
- adb UI automation empirically WORKS on this HyperOS device while the user holds
  Niragni foreground (verified `topResumedActivity` before each tap; stopped
  immediately when a personal app was foreground; accidental personal-content UI
  dumps were deleted and never tracked/reproduced). No OEM input block observed.

## B. Desktop browser (Expo web) preview — read-only feasibility

Question: can the Niragni UI be previewed in a desktop browser inside Orca?

### Current state (facts)
- `react-dom@19.1.0` is present, but **`react-native-web` is NOT installed**
  (not even transitively) and **`@expo/metro-runtime` is NOT installed**. Both
  are REQUIRED for `expo start --web` to render a React Native UI in a browser.
  `node_modules/.bin/expo` exists; `app.json` does not declare a `web` platform.
- So: `expo start --web` would NOT work as-is. Enabling it is an IMPLEMENTATION
  step (add `react-native-web` + `@expo/metro-runtime`, declare web platform) —
  NOT done (held per instruction; also package changes are coordinator-owned).

### Native boundaries (what can NOT run in a browser preview)
The product core is native-only; a web preview cannot exercise these for real:
- **QVAC inference**: `src/worker.ts` imports `@qvac/sdk`; it drives a Bare
  worker via `react-native-bare-kit` + `@qvac/fabric-android-arm64` (ARM64
  `.so`). No web backend → AI drafting is **native-unavailable on web**. Any
  web "inference" would be a fake and must not be shown.
- **Local DB**: `src/core/database.ts` imports `expo-sqlite`
  (`openDatabaseAsync`, `withExclusiveTransactionAsync`). expo-sqlite has a
  limited web shim, but the repository's transactional/CAS usage is not
  guaranteed on web → report persistence/revision flows are **unreliable/native**.
- **Media**: `src/core/media.ts` imports `expo-image-picker` +
  `expo-image-manipulator`. Library pick + resize have partial web support
  (file input); camera capture and the EXIF-scrub/analysis-copy path are not
  equivalent on web.
- **Models**: `src/core/models.ts` imports `expo-file-system`
  (`File/Directory/Paths`) + `DocumentPicker` + the streamed hasher — these are
  filesystem/native; model download/import/check is **native-unavailable on web**.
- **Share/dialer**: `react-native-share` + `expo-linking` → native share sheet /
  `tel:`/`mailto:`; web would fall back to Web Share API / links, not equivalent.

### What a web preview COULD honestly show (pure UI, no services)
The presentation layer (Expo Router screens, `src/ui/**` components, theme,
navigation, form layout, dark/light, review-screen provenance/accept UI, channel
directory list rendering from the static typed data) is largely plain RN and
would render under react-native-web. It would be a **visual/navigation preview
only**: any screen that calls `services.*` (reports list, save/autosave, photos,
model readiness, AI draft, share) would error or need a clearly-labeled
non-functional stub — which, per the no-fake-inference rule, must be presented as
"native-only, not functional in web preview", never as working.

### Concrete minimal preview approach (for later, on approval — NOT done)
1. Add dev deps (coordinator-owned): `npx expo install react-native-web
   react-dom @expo/metro-runtime`; declare `"web"` in app.json platforms.
2. `npx expo start --web` (from `apps/qvac-spike`) serves a localhost dev server;
   open in the Orca desktop browser.
3. Gate every `services.*` call behind `Platform.OS === 'web'` to render an
   explicit "fitur ini hanya di perangkat (native QVAC/SQLite)" placeholder —
   so the preview is honest UI-only, with zero fake inference/ready/test-pass.
4. Alternatively, a zero-code-change option: a static screenshot/flow review of
   the existing screens, which needs no web build at all.

### Honest verdict
A desktop browser preview is feasible ONLY as a **UI/navigation visual review**
and only after adding `react-native-web`+`@expo/metro-runtime` (implementation,
currently held). It can NOT run the real product: QVAC inference, model
download/import, SQLite persistence, camera, and native share are all
native-only. The real text+photo offline QVAC flow remains a physical-device
activity (the Xiaomi 14T, where install+launch already passed), not a browser one.

## C. Held / pending (per latest user instruction)
- All phone/emulator/network-toggle/model-download/build/mutation work is PAUSED
  for the user's discussion. No inference run; no `<10 s` claim.
- Signing backup helper (`scripts/Backup-NiragniSigning.ps1`) is written and its
  DryRun passes (roundtrip + wrong-pass + tamper + truncate + bad-iter-header +
  no-overwrite all behave correctly); outstanding review point to apply before
  final: `Set-PrivateAcl` should THROW (not warn) on the Restore path so restore
  fails closed if the private ACL cannot be set. Human passphrase + backup
  destination remain unchosen (not invented). Not yet committed.
- User contact scope is narrowing to karhutla + local Damkar (AGY research
  proposal); do not integrate yet.
