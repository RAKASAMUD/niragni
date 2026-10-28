# Kiro Scoped Re-Review — apps/qvac-spike fixes (Task 5 follow-up)

Reviewer: Kiro. Dispatch `task_c26939e7780f`. Date: 28 October 2026 (Asia/Jakarta).
Scope: verify the fixes in `apps/qvac-spike` against my prior findings in
`work/reports/kiro-review.md`. I own only this file and made **no** source edits.
Per instruction I did **not** re-run the unchanged tests (AGY reports 20
tests + typecheck clean, source stable while the APK builds); I inspected the
actual current source and the worker runtime configuration, not just SDK shape.

## Verdict

**All prior blocking findings addressed.** The scope violation is fully
corrected to Bara's karhutla (wildfire) observation-drafting domain, and the
honesty gaps (integrity, latency, offline badge, photo handling, raw-output
labeling, cancel state) are fixed in actual code with honest, explicit
disclosure of the remaining spike gaps. No remaining blocker from my review. The
only open items are the pre-existing, honestly-disclosed physical-device /
build gates, not regressions.

## Finding-by-finding status

| # | Prior severity | Status | Evidence (current code) |
|---|---|---|---|
| 1 | Critical — food/nutrition scope | **Addressed** | `prompt.ts` `DEFAULT_BARA_INDONESIAN_PROMPT` is karhutla observation drafting; `App.tsx` title "Bara — Karhutla Spike", inputs for notes/location/time, "Susun Draf Laporan"; tests rewritten to fire domain |
| 2 | High — hash never verified, size-only marked valid | **Addressed** | `types.ts` adds `unverified` status; `manifest.ts` returns `unverified` when `sha256` absent and NEVER `valid`; `isReady` requires `valid` (size+hash); UI shows the unverified note honestly |
| 3 | High — total latency excluded load | **Addressed** | `worker.ts` computes `totalColdTurnaroundMs = loadDurationMs + generationDurationMs` for cold runs; `App.tsx` metrics show load, first-chunk, generation, and highlighted total cold turnaround |
| 4 | High — false "100% OFFLINE" badge | **Addressed** | Static badge removed; replaced by a dynamic phase-driven status badge (idle/ready/inferring/cancelled/error) that makes no connectivity claim |
| 5 | Medium — photo path not copied/readable | **Addressed** | `copyToAppPrivateStorage` copies picked model/projector/photo into `documentDirectory` (scoped storage); `handleRunInference` checks photo `getInfoAsync().exists` and readability before inference |
| 6 | Medium — raw output presented without validation | **Addressed (honest experimental)** | `App.tsx` shows an explicit disclaimer that schema/allowlist/provenance/anti-hallucination per PRD F04 is NOT implemented at the spike stage; output labeled "Draf Model Mentah" |
| 7 | Low — cancel surfaced as error | **Addressed** | `worker.ts` returns `cancelled: true`; `types.ts` adds `cancelled` phase; `App.tsx` routes to a `cancelled` state + badge and annotates output "[Draf Dibatalkan oleh Pengguna]", not an error |
| 8 | Low — GPU unreachable (device string) | **Partially addressed / acceptable** | Still passes `modelConfig.device` (CPU default). GPU selection via `backend:[...]` is not wired, so runtime is CPU-only. Honestly commented ("CPU default until GPU Vulkan is physically tested on Mali-G615") — acceptable spike limitation, not a blocker |
| 9 | Info — APK not built (NDK) | **Unchanged / in progress** | AGY reports the APK is building now; no APK artifact to verify in this re-review. Remains the real gate |

## Worker runtime configuration (inspected, not just API shape)

- `loadModel` passes `modelType: 'llamacpp-completion'`, `modelConfig.{ctx_size,
  projectionModelSrc, device, image_no_upscale}` — matches the installed strict
  zod schema. `ctx_size: 1024` is small (keeps KV-cache/memory low for the spike;
  the multimodal doc example uses 8192 for two images). Fine for a single-photo
  spike; note it may truncate longer notes + image tokens — a tuning item, not a
  correctness bug.
- `device` is passed as a plain string; GPU acceleration (Vulkan/OpenCL) is NOT
  selected (that needs `backend: ['vulkan', ...]`). So the app runs CPU-only as
  configured. Consistent with "do not infer Mali support"; GPU remains a device-
  test item.
- Latency honesty improved beyond the fix: the worker no longer calls stream
  chunks "tokens" — it reports `deltaChunksCount`, `charactersGenerated`,
  `charactersPerSecond`, and surfaces the SDK's official `tokensPerSecond` only
  when `run.stats` provides it. Good.
- `qvac.config.js` uses ESM `export default` with `plugins:[PLUGIN_LLM]` /
  `includeAudioDecoder:false`. This is the **build-time** tree-shaking bundler
  config (run under Node tooling at prebuild), not the Expo runtime config, so
  the docs' "Expo runtime needs qvac.config.json, not .js" caveat does not apply
  here. Info only — worth a one-line confirmation on device that the bundled
  worker loads.

## Integrity gap handling — matches the allowed spike gap

The brief explicitly allows "actual hash still pending" as a spike gap provided
absent hashes are never marked verified and the size-only state is honestly
explicit. The code meets this precisely:
- `verifyFileIntegrity` returns `unverified` (not `valid`) when `sha256` is
  absent, with the message "SHA-256 belum dihitung. Verifikasi hash diperlukan".
- Loading is gated on `canLoadModel`, which is either a fully `valid` (size+hash)
  pair OR an explicit, clearly-labeled `bypassHashForSpikeDev` opt-in ("Bypass
  SHA-256 ... Eksperimen Spike Saja") shown only when status is `unverified`.
- `expo-crypto` is now a dependency (intent to add streaming hashing), and the UI
  note explains hashing is deferred to avoid OOM on ~437 MB files. The deferral
  is disclosed, not hidden. Acceptable.

## Tests (inspected, not re-run)

Test files were re-pointed to the karhutla domain and now assert the new honest
behaviors:
- `manifest.test.ts`: "treats files with matching size but missing SHA-256 as
  unverified (NEVER valid)"; mixed valid/unverified pair → `isReady=false`.
- `prompt.test.ts`: asserts the fire prompt contains `karhutla`, `belum
  diketahui`, `DILARANG merekayasa`, `korban`, `luas lahan`, `penyebab kebakaran`;
  notes-only and photo+location paths.
- `state.test.ts`: karhutla mock deltas; worker lifecycle.
No food/nutrition strings remain. I did not execute the suite (per instruction);
on inspection the assertions match the shipped code, so AGY's "20 passing" is
consistent with the source.

## Remaining open items (non-blocking, pre-existing gates)

1. APK build completion + hash/path (NDK) — in progress per AGY; verify at the build gate.
2. Streaming SHA-256 hashing not yet implemented — disclosed; `expo-crypto` present for future wiring.
3. AI output contract (schema/provenance/anti-hallucination, PRD F04) — disclosed as not implemented at spike stage.
4. GPU/Vulkan on Mali-G615, Indonesian quality, 10/10 offline, peak RAM, cold/warm <10 s — all physical-device gates from `docs/spike/qvac-audit.md` / `offline-test-protocol.md`.

## Ringkasan (Bahasa Indonesia)

Semua temuan blocking dari review sebelumnya sudah ditangani di kode nyata.
Pelanggaran scope makanan telah diperbaiki menjadi domain Bara karhutla
(pendrafan observasi kebakaran dengan provenance dan larangan rekayasa);
verifikasi integritas kini memakai status `unverified` sehingga berkas tanpa
SHA-256 tidak pernah ditandai valid dan hanya bisa dimuat lewat opt-in bypass
yang diberi label eksperimen spike; total latensi cold kini mencakup waktu muat
model; badge "100% OFFLINE" palsu dihapus; foto disalin ke penyimpanan privat
aplikasi dan dicek keterbacaannya; output mentah diberi peringatan eksperimental
bahwa skema/provenance F04 belum diterapkan; dan pembatalan punya state tersendiri,
bukan error. Konfigurasi runtime worker masih CPU-only (device string, bukan
backend Vulkan) — batasan spike yang jujur, bukan blocker. Tidak ada blocker
tersisa dari review; sisanya adalah gate perangkat fisik dan penyelesaian build
APK yang memang sudah diketahui.
