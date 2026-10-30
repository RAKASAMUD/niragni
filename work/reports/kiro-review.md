# Kiro Independent Review — apps/qvac-spike (Task 4)

Reviewer: Kiro. Dispatch `task_c86506837e2e`. Date: 28 October 2026 (Asia/Jakarta).
Scope: independent review of `apps/qvac-spike` against the Bara PRD
(`.context/baca-bara-codex-handoff-json-sebagai/outputs/Bara-PRD.md`) and the
Antigravity brief (`work/briefs/agy-spike.md`). I own only this file; I made **no
edits** to the app or other docs. Per instruction I did **not** re-run the
unchanged test suite — findings come from reading the actual source, the
installed `@qvac/sdk` / `@qvac/inference` type declarations, and `work/reports/agy-spike.md`.

## Verdict

**Changes requested.** The SDK/worker integration is real and type-correct (not
faked), which is the hardest part and is done well. But there is a **critical
scope violation** (the whole app is a food/nutrition analyzer, not Bara's
wildfire report drafter) plus several correctness gaps: integrity hashing is
never actually performed, total latency excludes model load, the "100% OFFLINE"
badge is a hardcoded unverified claim, and the local photo path is passed to the
SDK without a copy-to-app-storage or readability step. The APK was not built (NDK
blocker) — honestly reported.

## Severity summary

| # | Severity | Area | Path |
|---|---|---|---|
| 1 | Critical | Scope violation: food/nutrition, not wildfire reporting | `src/prompt.ts`, `src/App.tsx`, both test files |
| 2 | High | Integrity: SHA256 never computed/verified in the running app | `src/App.tsx` `handleCheckReadiness`, `src/manifest.ts` |
| 3 | High | Total latency excludes model-load time; `<10 s` target mis-measured | `src/worker.ts` `runInference`, `src/App.tsx` metrics |
| 4 | High | "100% OFFLINE" is a static hardcoded badge, not a verified network state | `src/App.tsx` |
| 5 | Medium | Local photo path passed to SDK without copy-to-app-storage / readability check (PRD F02) | `src/App.tsx` `handleRunInference`, `src/worker.ts` |
| 6 | Medium | Output not validated against schema/allowlist; raw model text shown (PRD F04/AI contract) | `src/worker.ts`, `src/App.tsx` |
| 7 | Low | Cancellation leaves phase `cancelling` then surfaces as `error`, not a clean cancelled state | `src/App.tsx` `handleCancel` + `runInference` |
| 8 | Low | `recommendedConfig.device: 'cpu'` is a hardcoded string; SDK backend selection is `backend: [...]` (`vulkan`/`opencl`/…), so GPU is unreachable as written | `src/manifest.ts`, `src/worker.ts` |
| 9 | Info | APK not built — NDK `29.0.14206865` not installed; honestly reported, real blocker | `work/reports/agy-spike.md` §6 |

## SDK API / worker bridge — verified REAL (positive)

I checked the worker against the installed declarations, not just the docs:

- `completion()` returns `CompletionRun` with `requestId: string`, `events:
  AsyncIterable<CompletionEvent>`, `stats: Promise<CompletionStats|undefined>`
  — matches `node_modules/@qvac/inference/dist/api/completion-stream.d.ts` and
  `.../schemas/completion-event.d.ts`. The worker consumes `events`, keys on
  `event.type === 'contentDelta'` / `event.text`, and treats
  `completionDone.stopReason === 'cancelled'` as cancellation — all valid.
- `loadModel({ modelSrc, modelType: 'llamacpp-completion', modelConfig: {
  ctx_size, projectionModelSrc, device, image_no_upscale } })` matches the
  strict zod schema in `.../schemas/load-model.d.ts` (projectionModelSrc,
  image_no_upscale: 'on'|'off', ctx_size all present on the llamacpp-completion
  branch).
- `cancel({ requestId })` and the fallback `cancel({ modelId, kind: 'completion' })`
  both match `.../api/cancel.d.ts` / `.../schemas/cancel.d.ts`.
- `InferenceCancelledError` is a real export from `@qvac/sdk`.

This is genuine integration with no simulated tokens or cloud fallback. Credit
where due.

## Findings (detail)

### 1. CRITICAL — Scope violation: food/nutrition instead of wildfire reporting
Bara is a wildfire/karhutla (forest-fire) observation-report drafter: the AI
contract (PRD §3) takes `userText`, optional observer/incident location, and
local photos, and returns a structured report (`summary`, `observations[] with
provenance`, `missingFields[]`, `questions[0..3]`). The spike instead implements
a **food/nutrition analyzer**:

- `src/prompt.ts` `DEFAULT_BARA_INDONESIAN_PROMPT` = "Identifikasi jenis makanan
  atau hidangan … kandungan gizi/kalori …".
- Empty-prompt error tells users to enter "instruksi analisis makanan".
- `src/App.tsx` section title "3. Foto & Prompt Analisis Makanan", label "URI
  Foto Makanan Lokal", placeholder `file:///sdcard/Pictures/food.jpg`.
- Tests assert the food domain: `prompt.test.ts` ("food nutrition analysis",
  "rendang padang"), `state.test.ts` ("Nasi Goreng", `/sdcard/photos/food.jpg`).

This is off-domain for the entire PRD. It must be re-pointed to wildfire
observation drafting (structured report output, provenance, uncertainty), and
the tests updated to the correct domain. The AGY report §1 even labels this
"Indonesian food analysis prompt templates" — confirming the violation is
intentional, not a stray string.

### 2. HIGH — Integrity hashing is never actually performed
`manifest.ts` `verifyFileIntegrity` supports a SHA256 check, but it only runs
when `stat.sha256` is provided. In the running app, `App.tsx`
`handleCheckReadiness` populates the snapshot from `FileSystem.getInfoAsync`
(`exists` + `size`) only and **never computes a hash**. So `stat.sha256` is
always `undefined`, the hash branch is skipped, and a file that matches size but
not content is reported `valid` ("terverifikasi valid"). The PRD/audit require
hash integrity (`ModelInstallation.artifactHashes`, checksum-fail state). Either
compute SHA256 (streamed/chunked to avoid loading ~437 MB into memory on the
12 GB device) or stop claiming the file is "terverifikasi valid" on size alone.
Note: because no hashing is done, there is currently **no** large-file memory
problem — but that is by omission of a required check, not by design.

### 3. HIGH — Total latency excludes model-load time
`worker.ts` `runInference` measures `totalElapsedMs = Date.now() -
startInference`, i.e. from inference start only. `loadLatencyMs` is tracked
separately and **never added or surfaced**. `App.tsx` shows "Waktu Inferensi:
{totalElapsedMs}". The brief and PRD require **total completion time including
model load** against the `<10 s` target. As written, a cold run's reported time
omits the (likely dominant) load time, so the `<10 s` gate cannot be evaluated
honestly. Report cold total = load + first-run inference, and warm separately.

### 4. HIGH — "100% OFFLINE" badge is a hardcoded claim
`App.tsx` renders a static `100% OFFLINE` badge unconditionally. Nothing checks
airplane mode / connectivity / that no socket was opened. The PRD demands offline
be **verified** (disconnect + confirm no cloud request), not asserted, and warns
"airplane icon alone is not the whole proof". A hardcoded badge is exactly the
kind of false-readiness claim the PRD prohibits. Drive it from an actual network
check or remove the absolute wording.

### 5. MEDIUM — Photo path handed to SDK without copy/readability guarantee
`App.tsx` passes `photoUri` straight into `worker.runInference`, which sends
`attachments: [{ path: photoUri }]`. The SDK multimodal API requires a real
on-disk file path ("the file must exist on disk"). The UI placeholder is a
`file://` URI, and a gallery/picker would yield a `content://` URI — neither is
guaranteed to be a readable native filesystem path. PRD F02 requires copying the
photo into app-private storage before use and handling unreadable/cloud-only
photos. There is no copy step, no existence/readability check, and no handling of
the 50-megapixel decode limit (`image-max-megapixels`).

### 6. MEDIUM — No output validation / provenance
The worker returns raw accumulated model text and `App.tsx` renders it directly.
PRD §3 requires output filtered through a schema/allowlist, with provenance and
uncertainty, and no invented location/time/victims. For a spike this is partially
acceptable, but the report should not imply the AI contract is met; it is not.

### 7. LOW — Cancellation UX race
`handleCancel` sets phase `cancelling` and calls `cancel`. When the stream then
ends with `stopReason: 'cancelled'`, `runInference` returns `success:false` with
a cancelled message and `App.tsx` routes that to `setPhase('error')` — so a
user-initiated cancel is presented as an error rather than a distinct cancelled
state. Inputs are preserved (good), but the state should be `cancelled`, not
`error`. The underlying SDK same-tick cancel race is handled acceptably because
`requestId` is captured synchronously from `completion()`.

### 8. LOW — GPU backend unreachable as written
`manifest.ts` sets `recommendedConfig.device: 'cpu'` and `worker.ts` passes
`device` into `modelConfig`. The real llamacpp-completion schema selects GPU via
`backend: ['vulkan'|'opencl'|…]` (and `device` is a free string). As written the
app can only ever run CPU; that is a safe default for the spike, but the report's
GPU discussion should not imply Vulkan is exercisable without a code change. (Do
not infer Mali support regardless — consistent with `docs/spike/qvac-audit.md`.)

### 9. INFO — APK not built (honest blocker)
`work/reports/agy-spike.md` §6 reports `assembleRelease` blocked on Android NDK
`29.0.14206865` not being installed (~1.2 GB), deferred per coordinator. The
prebuild (42 native addons linked for android-arm64) and the documented build
command are plausible and the gap is stated honestly. No APK artifact exists, so
there is no offline-launch or bundled-JS evidence yet — correctly not claimed.

## Cross-check against AGY report claims

- "Real `@qvac/sdk` APIs (`loadModel` with `projectionModelSrc`, streaming
  `completion`, `cancel({requestId})`, `unloadModel`)" — **confirmed real** against
  installed types.
- "17 unit tests passing / typecheck clean" — not re-run per instruction; the
  tests are real files but **validate the wrong (food) domain**, so passing tests
  do not establish Bara behavior. `tsconfig` uses `skipLibCheck: true`, so a clean
  typecheck does not vet the SDK's own declarations (acceptable), but it does
  compile the worker against them.
- "Indonesian food analysis prompt templates" — this is the scope violation, not
  a feature.

## Recommended fixes (for the application owner, not done here)

1. Re-point prompt, UI copy, placeholders, and tests from food/nutrition to
   wildfire observation drafting with structured output + provenance (Critical).
2. Compute and compare SHA256 (chunked) in `handleCheckReadiness`, or downgrade
   the "valid" wording to "size-only" until hashing exists (High).
3. Make `totalElapsedMs` include model load for cold runs; display cold vs warm
   distinctly; evaluate `<10 s` on the inclusive number (High).
4. Derive the offline indicator from an actual connectivity check or soften the
   claim (High).
5. Copy the photo into app-private storage and verify readability before
   inference; handle content:// URIs and the megapixel limit (Medium).
6. Note explicitly in `work/reports/agy-spike.md` that the AI-output contract
   (schema/provenance) is not yet implemented (Medium).

## Ringkasan (Bahasa Indonesia)

Integrasi SDK/worker QVAC nyata dan sesuai tipe terpasang (bukan palsu) — bagian
tersulit sudah benar. Namun ada **pelanggaran scope kritis**: seluruh aplikasi
menganalisis makanan/gizi, padahal Bara adalah pendrafan laporan dugaan kebakaran
hutan (teks+foto → ringkasan/observasi/provenance/pertanyaan). Selain itu:
verifikasi SHA256 tidak pernah benar-benar dijalankan (hanya ukuran), total
latensi tidak memasukkan waktu muat model sehingga target <10 detik tak terukur
jujur, badge "100% OFFLINE" hanya klaim statis tanpa cek jaringan, dan path foto
lokal dikirim ke SDK tanpa menyalin ke penyimpanan aplikasi atau memeriksa
keterbacaan. APK belum dibangun (NDK belum terpasang) dan itu dilaporkan jujur.
Rekomendasi perbaikan diserahkan ke pemilik aplikasi; saya tidak mengedit kode.
