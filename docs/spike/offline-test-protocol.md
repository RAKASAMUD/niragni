# Bara QVAC Spike — Offline Test Protocol

Status: **plan, not results.** No device has been connected and no run has been
executed by this audit. This protocol defines the actual on-device procedure to
run once the Antigravity worker produces a standalone APK (bundled JavaScript,
no Metro) with a preloaded model + matching projector. It distinguishes
**documented** support from **tested** support: nothing here is a compatibility
or success claim.

Access date of referenced sources: 28 October 2026 (Asia/Jakarta).

## 0. Scope and non-goals

- In scope now: define 10 cold-start text+photo offline runs, warm-latency runs,
  the <10 s total-completion target, network verification, input/photo
  sensitivity, memory, cancellation and error evidence.
- Deferred: real photos of hazardous scenes, reviewer scoring, user/usability
  testing, iOS (no iPhone / Apple Developer account available), agency contact.
- No device required to author this protocol. Execution requires a physical
  Xiaomi 14T (emulators are unsupported by QVAC/llamacpp per the SDK docs).

## 1. Preconditions (documented, verify on device)

| Item | Documented requirement | How to verify (tested) |
|---|---|---|
| OS | Android 12+ ARM64 (SDK docs); example plugin uses `minSdkVersion: 29` | `scripts/device/Get-DeviceInventory.ps1` → `os.androidRelease`, `os.sdkInt`, `hardware.primaryAbi` |
| Physical RAM | SDK worker needs ≥2 GB, <4 GB most LLMs fail to load | `scripts/device/Get-DeviceInventory.ps1` → `memory.kernelUsableRamMiB` (MemTotal = kernel-usable RAM, not marketed capacity; swap/zram reported separately and excluded from budget) |
| Free storage | SDK doctor wants ≥5 GB free working dir; this spike pair ≈0.55 GB | `storage.dataPartitionDf` |
| GPU backend | Android backends: Vulkan, or OpenCL only on Adreno 700+ | Xiaomi 14T is Mali-G615 (not Adreno) → OpenCL path N/A; **must test the Vulkan path on device**, do not infer |
| Model present | Q8_0 weights + matching mmproj bundled locally | Confirm file hashes match `docs/spike/qvac-audit.md` before first run |

The GPU line is the critical honesty gate: documented Android support is not
proof this Mali device runs the QVAC Vulkan backend. Record actual backend
selection from app/worker logs during run 1.

## 2. Network isolation and verification (every run)

Do this before each cold-start run and keep it in effect for the whole run:

1. Enable Airplane mode AND separately confirm Wi-Fi off and mobile data off.
   The airplane icon alone is not sufficient evidence.
2. Verify no connectivity from the device shell (read-only):
   - `adb -s <serial> shell dumpsys connectivity | <inspect active networks>`
   - `adb -s <serial> shell ping -c 1 -W 2 8.8.8.8` must fail (no route / 100% loss).
3. Capture evidence that the app issued no network request during inference:
   - Prefer on-device packet/connection observation or the app's own network log.
   - A passing step 2 plus airplane mode is the minimum; note the exact method used.

Record for each run: network method, ping result, and whether any socket
attempt was observed.

## 3. Cold-start text+photo runs (10 runs)

A "cold start" = app process fully killed, then launched, model+projector loaded
from local files, one text+photo inference completed. Kill between every run:
`adb -s <serial> shell am force-stop <package>` (read/really a control command on
the test app only; it touches no user data).

For each of 10 runs record:

| Field | Source |
|---|---|
| Run # (1–10) | — |
| Network verified offline | §2 result |
| Input text (Indonesian) | the prompt used |
| Photo used | local test image id (non-hazardous, permitted) |
| Model load time (s) | app/worker log timestamp: load start → ready |
| Time-to-first-token (s) | log |
| Total completion time (s) | input submit → final token / validated output |
| Met <10 s target? | yes/no (do not fabricate; record real value) |
| Output summary | sanitized; no coordinates/victims invented |
| Validation state | output passed schema/allowlist? |
| Peak memory | §6 |
| Anomalies | OOM, crash, thermal throttle, wrong-language output |

Pass condition for the offline gate: 10/10 runs complete inference with network
verified off. Latency is measured, never assumed. Indonesian-language quality is
observed and noted (both candidate repos are tagged English-only — treat
Indonesian competence as **unproven** until this step).

## 4. Warm-latency runs

After a successful cold run, keep the app/model resident and run ≥3 more
inferences without reloading the model. Record total completion time for each.
Report cold vs warm **separately**; never present warm latency as the cold
number. Target remains <10 s total; report the real distribution (min/median/max).

## 5. Input and photo sensitivity

Vary one factor at a time and record output changes:

- Text only vs text+1 photo vs text+2 photos (compare-images path).
- Photo factors: well-lit vs low-light, in-focus vs blur, portrait vs landscape
  orientation, small vs large file (near the 20 MB / 1600 px resize bounds from
  the PRD), and an ambiguous image (haze/cloud/dust) that must NOT be asserted as
  fire.
- Confirm images > 50 MP are rejected before decode (SDK multimodal limit) unless
  `image-max-megapixels` is raised; record the behavior.
- Confirm text-in-photo is treated as data, not as a system instruction.

Record whether a photo changed the output meaningfully and whether any run
invented location/time/victims/cause (any such invention fails the candidate).

## 6. Memory evidence

- Before load, during inference peak, and after unload, sample app memory:
  `adb -s <serial> shell dumpsys meminfo <package>` (read-only).
- Record peak PSS/RSS. Compare against kernel-usable RAM from the inventory
  script (`kernelUsableRamMiB` = MemTotal, not marketed capacity; swap/zram and
  Xiaomi memory extension excluded from the budget).
- Note any low-memory kill or OOM and whether input was preserved (PRD requires
  no loss of input on failure).

## 7. Cancellation evidence

- Start an inference, then cancel mid-run via the app control.
- Verify: control returns to the form, input text/photo preserved, no partial
  output presented as final, no false "ready/success" state.
- Record elapsed time to responsive cancel.

## 8. Error evidence

Force and record each failure path (PRD risk list):

- Model file missing/half-present/hash mismatch → app shows not-ready, not fail-as-success.
- Low memory / OOM during load → graceful fallback, input preserved.
- App sent to background then foreground mid-inference → control returns, no loss.
- Process killed mid-inference → relaunch recovers draft/input.
- Invalid/unschema output from model → rejected by validation, surfaced as retry/manual.

For each: trigger, observed behavior, whether input survived, log excerpt.

## 9. Evidence handling

- Store results under `docs/spike/device-evidence/**` (owned by coordinator/user
  at the physical gate — this audit does not write there).
- Logs must exclude photos, coordinates, user notes, accounts, and device
  identifiers. Use run numbers and sanitized summaries only.
- Keep the model/projector file hashes and app build hash with the evidence so
  runs are reproducible.

## 10. Documented vs tested — summary rule

Every row in the final evidence table is tagged either **DOC** (from SDK/model
docs) or **TEST** (observed on this device this run). A DOC row never counts as a
support or success claim. Until TEST rows exist, Bara's offline/compatibility
claims for the Xiaomi 14T remain open.

## Sources

- QVAC System requirements — https://docs.qvac.tether.io/sdk/system-requirements/ (accessed 2026-10-28)
- QVAC JS/TS SDK — https://docs.qvac.tether.io/sdk/js-ts-sdk/ (accessed 2026-10-28)
- QVAC Multimodal — https://docs.qvac.tether.io/sdk/ai-capabilities/multimodal/ (accessed 2026-10-28)
- Model hashes/sizes: see `docs/spike/qvac-audit.md`
