# AGY Product Core Report — Bara (Core Lifecycle & Services)

- **Owner**: AGY (Antigravity) — Dispatched Worker
- **Task ID**: `task_0b0f3cb84a9f` (Final integration, build verification, and ownership handoff)
- **Dispatch ID**: `ctx_cbc668ba2717`
- **Date**: 28 October 2026 (Asia/Jakarta)
- **Scope**: Core model lifecycle, native configuration verification, durable build evidence, and documentation ownership:
  - `README.md`
  - `docs/implementation-status.md`
  - `work/product-progress.md`
  - `work/reports/agy-product.md`
  - `artifacts/bara-android.apk` & `artifacts/bara-android.apk.sha256`
- **Contract Fulfillment**: `export const services: ProductServices` at `apps/qvac-spike/src/core/index.ts` implementing the frozen `apps/qvac-spike/src/product-contract.ts` without stubs.

---

## 1. Verification Evidence

- **Typecheck Result**:
  - Command: `npm --prefix apps/qvac-spike run typecheck` (`tsc --noEmit`)
  - Status: **Exit Code 0, zero errors** across all core services, UI bindings, and native worker modules.
- **Verification Boundary**:
  - Source inspection and static compiler verification complete.
  - Per project constraints, native device builds and automated runtime test suites remain deferred to the coordinator's release pipeline.

---

## 2. Core Lifecycle Corrections & Refinements

### 2.1 In-Memory Verified Pair Fingerprint Tracking (`src/core/models.ts`)
- **Fingerprint Structure**: Implemented `PairFingerprint` tracking `{ uri, size, modificationTime }` for both the model and projector files via Expo FileSystem API (`File.modificationTime`).
- **First-Use & Change Verification**: `ensureInstalled` checks the in-memory cache (`verifiedFingerprints`). If a candidate is queried for the first time in the current process, or if the on-disk fingerprint has changed (different `modificationTime`, `size`, or path), both files are automatically re-hashed via streaming chunked SHA-256 before inference proceeds.
- **Explicit `checkModel` Verification**: Always computes SHA-256 for both files every time (bypassing cache), detecting any in-place same-size file corruption, and updates `verifiedFingerprints`.

### 2.2 Strict Warm Reuse & Automatic Invalidation (`src/core/models.ts`)
- **Dual Matching Requirement**: Warm inference reuse is allowed **only** when:
  1. The worker currently holds an instantiated model (`isModelLoaded()`).
  2. The loaded candidate identity matches the requested candidate ID.
  3. The currently loaded pair fingerprint (`loadedPairFingerprint`) exactly matches the current verified on-disk fingerprint (`isFingerprintEqual`).
- **Automatic Reload on Change**: If a candidate's files on disk have changed (e.g., replacement via download or import), `ensureLoaded` detects the fingerprint mismatch, explicitly unloads the outdated model from worker memory, and loads the updated file pair.

### 2.3 Lock Leak Prevention on Invalid IDs (`src/core/models.ts`)
- **Enclosed Setup**: In `downloadModel`, `importModel`, `deleteModel`, and `checkModel`, calls to `getModelCandidate(candidateId)` and subsequent path computations are strictly placed inside `try/finally` blocks immediately following `lifecycle.acquire()`.
- **Guaranteed Release**: If an invalid candidate ID is supplied or path setup fails, the exception bubbles cleanly while the `finally` block guarantees `lifecycle.release()`, preventing deadlocks or permanently held locks.

### 2.4 Sticky Cancellation & Atomic Promotion Summary
- **Stage Boundary Guards**: Sticky cancellation tokens (`isDownloadCancelled`, `activeAbortController`) are checked before and after all async boundaries (downloads, chunked SHA-256 hashing, file moves, and worker loads).
- **Atomic Promotion with Rollback**: Downloads and imports stage files into `.partial` before SHA-256 verification. Promotion backs up existing files to `.backup` during rename and rolls back if an error occurs.
- **Clean Retries**: Interrupted downloads cleanly purge staging files, avoiding unverified byte-range resume claims.

---

## 3. Architecture & Module Summary

1. **`src/core/index.ts`**: Unified frozen `ProductServices` entry point, memoized singleflight `initPromise`, wires cancellation handlers into `sharedLifecycle`.
2. **`src/core/lifecycle.ts`**: Shared exclusion coordinator across AI drafting and model lifecycle, AppState background listeners, and Indonesian busy error handlers.
3. **`src/core/models.ts`**: Model candidate management, in-memory verified pair fingerprint tracking, streaming SHA-256 verification, cancellable downloads, atomic pair promotion, and warm memory loading.
4. **`src/core/hasher.ts`**: Chunked 256KB streaming SHA-256 hasher using Expo `FileHandle` and `@noble/hashes/sha2.js` with cooperative yielding every 2MB and `AbortSignal` support.
5. **`src/core/ai.ts`**: AI draft generator with strict Zod schema validation, provenance validation, sticky cancellation tokens, and candidate-aware inference.
6. **`src/worker.ts`**: Native `@qvac/sdk` wrapper tracking loaded candidate identity (`getLoadedCandidateId`), cold turnaround latency, and native cancellation.
7. **`src/core/database.ts`**: SQLite (`bara.db`) with WAL mode, foreign keys, migrations, and serialized write lock queue (`withWriteLock`).
8. **`src/core/repository.ts`**: Monotonic CAS revision incrementing, suggestion invalidation on input modification, and atomic attachment commits.
9. **`src/core/media.ts`**: ID sanitization, max 3 photos / 20MB, analysis JPEG generation (max 1600px edge), scoped exports, and startup orphan recovery.
10. **`src/core/export.ts`**: Indonesian export preview formatting, EXIF stripping, and OS share sheet invocation.
11. **`src/core/channels.ts` & `src/core/location.ts`**: National emergency directory and `expo-location` GPS coordinates acquisition.

---

## 4. Known Technical Limitations & Runtime Gaps

1. **Native C++ Model Load Interruptibility**: Once `@qvac/sdk` enters native C++/llama.cpp `loadModel`, execution is blocked within the native runtime until loading finishes or fails; cancellation tokens take effect immediately before or after the native invocation.
2. **Android Low Memory Killer (LMK)**: While background transition triggers immediate cancellation to reduce memory and CPU pressure, aggressive OEM memory killers can still terminate background tasks if device memory is critically constrained.
3. **Background Imports/Checks**: Background transition currently cancels long-running inference and network downloads; explicit local SHA-256 hashing runs cooperatively with 2MB event-loop yields and halts via user cancellation.
4. **Physical Device Runtime Deferral**: Physical handset verification (e.g. Xiaomi 14T runtime inference with network disconnected, latency < 10s, camera/GPS hardware capture) remains deferred per user instruction. No model weights downloaded.
5. **iOS Windows Blocker**: Native iOS prebuild requires macOS/Linux and is rejected by Expo CLI on Windows; source and config are maintained for iOS, but no iOS binary exists.

---

## 5. Final Android Build Verification & Evidence

The final Android release APK was built via `scripts/Build-Bara.ps1 -SkipPrebuild` and copied to `artifacts/bara-android.apk`. Detailed inspection was performed using Android SDK build-tools 36.0.0 (`aapt` and `apksigner`):

- **File Path**: `artifacts/bara-android.apk`
- **File Size**: `240,264,749` bytes
- **SHA-256 Digest**: `BB96C3ABDF6152E254327DF016DDD57BC76A71E1F0B9EEE5BA34E1B2E3F84E5F` (recorded in `artifacts/bara-android.apk.sha256`)
- **Package Name**: `com.niragni.bara`
- **Version Code**: `1` (Version Name: `1.0.0`)
- **SDK Targets**: `minSdkVersion="31"`, `targetSdkVersion="36"`, `compileSdkVersion="36"`
- **Target Architecture**: Murni `arm64-v8a` only (60 native shared libraries packaged, including `@qvac/fabric-android-arm64.0.22.0`, `libbare-kit.so`, and GGML CPU/OpenCL/Vulkan runtimes; no 32-bit `armeabi-v7a` or `x86` libraries)
- **Embedded JS Bundle**: `assets/index.android.bundle` (`21,787,348` bytes uncompressed)
- **Security & Privacy Configuration**:
  - `android:allowBackup="false"`
  - `android:fullBackupContent="false"`
  - `android:dataExtractionRules="@xml/bara_data_extraction_rules"`
  - `android:extractNativeLibs="false"`
- **Native Hardware Library**: `libOpenCL.so` marked optional (`<uses-native-library android:name="libOpenCL.so" android:required="false" />`)
- **Intent Queries**: Queries declared for package `com.whatsapp`, and schemes `tel` and `mailto`
- **Signing Verification**:
  - Validated via `apksigner verify --verbose --print-certs`
  - `Verified using v2 scheme (APK Signature Scheme v2): true`
  - Signer #1 DN: `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`
  - Signer #1 certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
  - Signer #1 key: RSA 2048 bits
