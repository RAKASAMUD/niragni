# Kiro Static Integration Review — Bara core

Reviewer: Kiro. Dispatch `task_847731359f27`. Date: 28 October 2026 (Asia/Jakarta).
Scope: static review of `apps/qvac-spike/src/core/**`, `worker.ts`, `manifest.ts`,
`prompt.ts`, `types.ts` against the PRD and the frozen `product-contract.ts`,
cross-checked against prior findings in `work/product-progress.md`. I own only
this file; no source edits, no tests, no device work, no installs. All files were
re-read in their current state immediately before this report.

## Verdict

**All prior findings appear addressed in the current source.** The core is a
genuine local-first implementation (real SQLite, real DownloadResumable, real
streamed hashing, strict Zod AI validation, honest share events) with no fake
services, invented delivery proof, or EXIF-leaking fallback. `npx tsc --noEmit`
passes with **exit 0** across the whole app (core + UI), so the frozen API and
the UI integrate cleanly, including the suggestion-invalidation semantics. No
blocking issue found. A few low-severity alignment notes and
device-only-verifiable gaps remain.

## Prior findings → current status (with paths)

| Prior finding | Status | Evidence |
|---|---|---|
| init/database singleflight | **Addressed** | `database.ts` memoized `dbPromise` + serialized `writeQueue`; `index.ts` `init()` memoized `initPromise` resets on failure |
| Real cancellable/resumable download (not unused AbortController) | **Addressed** | `models.ts` uses `createDownloadResumable` + `cancelAsync()`; `.partial` staging → SHA256 verify → atomic `move`; `cancelModelDownload()` cancels task + aborts hash |
| Pinned revision + temp+checksum artifacts | **Addressed** | `models.ts` `UPSTREAM_URLS` use `/resolve/<commit>/…` pinned commits matching the audit; verify-before-promote |
| listModels no load side-effects | **Addressed** | `models.ts` `listModels()` only reads metadata + file existence/size + cached DB row; no hashing/load |
| Streamed SHA-256 + cooperative yield + abort | **Addressed** | `hasher.ts` 256KB chunks via `@noble/hashes`, yield every 2MB, honors `AbortSignal`; no fabricated `expo-crypto.digestFileAsync` |
| installed only after size; ready only after real local load + timestamp | **Addressed** | `models.ts` `checkModel()` size → SHA256 → real `worker.loadModel`/`unloadModel` → `ready` + `lastLocalCheck`; failure → `incompatible` |
| AI singleflight + cancel tokens | **Addressed** | `ai.ts` sets `isInferring` + `currentGenerationToken` before first await; cancel checks at each stage |
| Strict schema rejects invalid provenance (no coercion/fallback) | **Addressed** | `ai.ts` Zod `.strict()` (extra keys/bad types/>3 questions rejected) + deep provenance checks; throws, never fabricates a fallback suggestion |
| inputRevision increments + clear stale suggestion on photo/input edits | **Addressed** | `repository.ts` `saveReport` invalidates suggestion when rawText/observationTime/timezone/incidentLocationText/observerLocation changed; `addPhoto`/`removePhoto` bump revision and set suggestion NULL |
| Rollback file copies on DB failure | **Addressed** | `repository.ts` `addPhoto` try/catch → `deleteAttachmentFiles` on failure; `media.ts` rollback on processing error |
| EXIF scrub failure must not share originals | **Addressed** | `export.ts` `shareReport` re-encodes each photo; on failure **throws** with a privacy message and never shares the original |
| Report-scoped exports / timezone / GPS timestamps | **Addressed** | `media.ts` `getReportExportsDir(<reportId>)`; `export.ts` preview includes explicit `(timezone)` and `[Waktu GPS: …]` |
| Honest share events | **Addressed** | `export.ts` records `share_sheet_opened` / `cancelled` / `unknown` only; no delivery proof; preview says "tanpa pengiriman otomatis" |
| ctx budget (spike 1024 insufficient for 4000 chars + 3 photos) | **Addressed** | `manifest.ts` `ctx_size: 8192` for both candidates |

## Runtime API compatibility (worker ↔ @qvac/sdk)

`worker.ts` usage matches the installed SDK types (verified against
`@qvac/inference` declarations in earlier review, unchanged shape):
`loadModel({ modelSrc, modelType: 'llamacpp-completion', modelConfig: {
ctx_size, projectionModelSrc, device, image_no_upscale } })`; `completion({…})`
consumed via `run.events` on `contentDelta`/`completionDone(stopReason:'cancelled')`;
`run.stats` for optional tokens/s; `cancel({ requestId })` and the
`cancel({ modelId, kind:'completion' })` fallback; `InferenceCancelledError`.
`runInference` now accepts `string | string[]` for multi-photo, and `ai.ts`
passes the analysis-copy paths array — consistent with the SDK `attachments` array.
No simulated tokens or cloud fallback.

## DB persistence / revisions / attachments / orphans

- `database.ts`: WAL, FK `ON DELETE CASCADE`, migration guard via `schema_version`.
- `repository.ts`: monotonic revision; stale-write rejected by revision check AND
  a strict CAS `WHERE id=? AND revision=?` with `changes !== 1` verification;
  attachment `selectedForShare` updates scoped `… AND reportId=?` (no cross-report
  bleed). `deleteReport` removes rows (and FK cascade) then media + exports.
- Orphan handling: `repository.init()` collects active URIs and calls
  `recoverAndCleanOrphans`, which also purges the exports cache at startup
  (`media.ts`). Matches "clean temp exports at next startup".

## Model download / cancel / hash / pinned URLs

Covered above: pinned-commit `/resolve/<hash>/` URLs, disk-space precheck with
25% margin, `.partial` → verify → atomic move, real cancel, chunked hashing with
abort, `isOperating` singleflight guarding download/import/delete against
inference races, and `deleteModel` unloads the worker and removes only the model
dir (drafts untouched).

## AI strict schema / provenance / cancel / snapshot

`ai.ts`: input budgets (4000 chars / 3 photos) rejected with explanation; strict
Zod; provenance rules — `ai_visual` requires a real attached photo ID, `user`
requires non-empty text, `metadata` requires the referenced field to exist;
returns `AiResult` with `inputRevision = report.revision` and never mutates the
DB (UI persists via `saveReport`). Cancellation via token + `worker.cancelInference`.

## Frozen API / UI compatibility (incl. suggestion invalidation)

- `index.ts` implements the exact `ProductServices` surface; `tsc` clean.
- Suggestion-invalidation semantics are consistent end to end: the store clears
  `suggestion` only when an AI **input** field changes (or on photo add/remove),
  not on `reviewedText`/share-toggle saves — which is exactly what the UI relies
  on (UI treats a non-null `report.suggestion` as current and does not recompute
  staleness from the revision number). Accepting an observation edits
  `reviewedText` only, so remaining suggestions survive. Compatible.

## Low-severity notes / open items (non-blocking)

1. **Low — metadata sourceRef vocabulary mismatch.** `ai.ts` `buildPrompt` tells
   the model to use `catatan_pengguna | waktu_pengamatan | <ID_FOTO>`, but the
   validator's `validMetadataRefs` also lists `posisi_pelapor`, `lokasi_kejadian`,
   `arah_kejadian`, `metadata`. Harmless (validator is a superset), but the two
   lists should be reconciled so a valid model output is never rejected for using
   a ref the prompt implied. `ai.ts` `buildPrompt` / `parseAndValidateOutput`.
2. **Low — UI vs core "input field" set for invalidation.** Core treats
   `timezone` and `observerLocation` as suggestion-invalidating inputs;
   `app/report/[id]/generate.tsx` `inputsEqual` only compares rawText/
   observationTime/incidentLocationText. Net effect is safe (core is the
   authority and will clear the suggestion), but the UI's own stale guard is
   slightly narrower than core's. Note for UI owner, not a core bug.
3. **Low — DownloadResumable progress `totalBytes`.** Progress reports summed
   `totalBytesWritten`; the UI shows percent against manifest `totalBytes`, which
   is fine, but per-file server `Content-Length` is not separately surfaced. Cosmetic.
4. **Info — device-only gaps (cannot be statically verified, correctly not claimed):**
   actual Vulkan/Mali load success, real inference/latency, that `ctx_size: 8192`
   truly fits 3 photos + 4000 chars on-device, HEIC handling by the manipulator,
   and that `react-native-share` dismissal strings map to `cancelled` across OS
   versions. These remain physical-device gates per the plan.
5. **Info — `media.ts` width/height** come from the picker asset (`asset.width`
   fallback 1600) rather than re-measured from the decoded file; acceptable for a
   spike, slightly approximate for exotic assets.

## Ringkasan (Bahasa Indonesia)

Semua temuan sebelumnya pada core sudah ditangani di sumber saat ini. Core adalah
implementasi lokal yang nyata: SQLite dengan WAL + proteksi tulis basi (revisi +
CAS), unduhan model benar-benar dapat dibatalkan dengan staging `.partial` →
verifikasi SHA-256 streaming (chunk 256KB, yield, abort) → pindah atomik dan URL
ter-pin pada commit, `listModels` ringan tanpa efek samping, `checkModel`
menandai `ready` hanya setelah muat lokal nyata, AI memakai Zod ketat dengan
validasi provenance dan tanpa fallback palsu, ekspor menghapus EXIF dan TIDAK
pernah jatuh ke foto asli bila gagal, serta event berbagi jujur tanpa klaim
diterima. Typecheck `tsc --noEmit` lolos (exit 0) untuk core + UI sehingga API
beku dan semantik invalidasi saran kompatibel. Tidak ada blocker; sisanya catatan
ringan (kecocokan daftar sourceRef metadata, cakupan field invalidasi di UI yang
lebih sempit dari core) dan gate perangkat fisik yang memang tidak bisa
diverifikasi statis.
