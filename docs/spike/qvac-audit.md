# QVAC SDK / Model Audit — Bara Spike (Task 1, Kiro)

Access date: 28 October 2026 (Asia/Jakarta). This is **metadata verification**,
not device evidence. No SDK/toolchain was installed and no model weights were
downloaded. The only download performed was the small `@qvac/sdk@0.22.0` npm
tarball (419 KB, via `npm pack`, no dependency install) to verify the SDK license
from the actual package contents. Documentation and package/registry metadata are
not runtime proof of compatibility, licensing fitness, latency, or
Indonesian-language quality.

## 1. Pinned SDK version

| Field | Value | Source |
|---|---|---|
| Package | `@qvac/sdk` | npm registry |
| Pinned version | **0.22.0** (dist-tag `latest`) | npm `registry.npmjs.org/@qvac/sdk` dist-tags `latest":"0.22.0"` |
| Published | 2026-10-19T11:33:05Z | npm registry `time["0.22.0"]` |
| Tarball | https://registry.npmjs.org/@qvac/sdk/-/sdk-0.22.0.tgz | npm registry |
| dist.shasum (tarball) | `e74b8b5160d90d0f1524582e52c430888e8a6ab9` | npm registry |
| dist.integrity | `sha512-qnoCZhcOgIt3jk8A8HxNtHm0ywbuJbuqkJX1fGjxW8NR9bisGmVcjGjv/EtL/xn5bLwqIms25oonCEHhnyaqRQ==` | npm registry |
| unpackedSize | 1,594,309 bytes (~1.52 MiB, JS only — native prebuilds separate) | npm registry |
| SLSA provenance | present (attestations url in registry) | npm registry |

Docs label v0.22 as "the current release," consistent with the npm `latest` tag.

### Node / tooling versions (documented)

- Node.js: `>= v22.17`; **mobile bundling needs `^22.21.0 || >=24.9.0`** (SDK docs + `engines.node` of `@qvac/cli`).
- npm: `>= v10.9`.
- Bare: `>= v1.30.3` (if targeting Bare).
- Expo: `>= v54` (if targeting mobile).

### peerDependencies of `@qvac/sdk@0.22.0` (from registry)

```
tsx: *
pear-pipe: >=1.0.0
expo-device: >=8.0.0
expo-file-system: >=19.0.0
expo-modules-core: >=3.0.0
expo-build-properties: >=0.12.0
react-native-bare-kit: >=0.16.0
@electron-forge/plugin-base: ^7.11.1
```

Mobile install flow (documented, NOT executed):
`npm i @qvac/sdk`, `npm i 'react-native-bare-kit@^0.16.0'`,
`npx expo install expo-file-system expo-build-properties expo-device`, add
`@qvac/sdk/expo-plugin` + `expo-build-properties` (`android.minSdkVersion: 29`)
to `app.json` plugins, then `npx expo prebuild`, then `npx expo run:android
--device`. Prebuild links native addons into `react-native-bare-kit`; reinstalling
deps clears them, so prebuild must be re-run before building.

## 2. SDK source vs model vs projector licenses (kept distinct)

- **SDK license**: **Apache-2.0, verified.** `npm view @qvac/sdk@0.22.0 license`
  returns `Apache-2.0`, and the actual package contents confirm it: `npm pack`
  of the small tarball (419,013 bytes; no dependency install) unpacks to
  `package/package.json` with `"license": "Apache-2.0"` and a bundled
  `package/LICENSE` (10,216 bytes) whose text is the full "Apache License,
  Version 2.0" header and body. Verified on this host 2026-10-28.
- **Model weights + projector licenses** are separate from the SDK and are
  verified below per candidate.

## 3. Model + matching projector candidates

QVAC loads a multimodal LLM plus a **matching** `mmproj-*.gguf`; pairs must not be
swapped. QVAC references these as SDK model constants that pull pinned registry
artifacts. The GGUF repositories below are the upstream sources backing those
pairs. Quant chosen: **Q8_0** (matches the QVAC `*_Q8_0` constants used in the
docs' multimodal example).

### Candidate A (evaluate first): SmolVLM2 500M

- QVAC constants: `SMOLVLM2_500M_MULTIMODAL_Q8_0` + `MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0`.
- Upstream GGUF repo: `ggml-org/SmolVLM2-500M-Video-Instruct-GGUF`
  (revision/sha `ccd7aae53bcb1997355c2f094959e72b3642ce17`, lastModified 2025-04-30).
- License: **apache-2.0** (repo `cardData.license`, base model
  `HuggingFaceTB/SmolVLM2-500M-Video-Instruct`).
- Note: SmolVLM2's published mmproj declares **no** `clip.vision.preproc_image_size`,
  so the VisionPsy-only `image_no_upscale` flag is inert here (per QVAC multimodal docs).

| File | Bytes | SHA256 (LFS) |
|---|---|---|
| `SmolVLM2-500M-Video-Instruct-Q8_0.gguf` | 436,808,704 | `6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc` |
| `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` | 108,785,184 | `921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b` |
| **Pair total** | **545,593,888 (~520.3 MiB / ~545.6 MB)** | — |

Source: HF API `api/models/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF?blobs=true` (accessed 2026-10-28).

### Candidate B (alternative): VisionPsy Nano 460M (Flash)

- QVAC constants (un-suffixed = Flash): `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0`
  + `MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0`. Set `modelConfig.image_no_upscale: 'on'`
  for the Flash pair (base pair leaves it unset); mismatched flag passes load
  validation but silently degrades quality (QVAC multimodal docs).
- Upstream GGUF repo: `qvac/VisionPsy-Nano-460M-Flash-GGUFs`
  (revision/sha `a24fb9cdd1119406b15ff60b06a51f8438a931c1`, lastModified 2026-07-29).
  Base variant repo: `qvac/VisionPsy-Nano-460M-GGUFs`.
- License: **apache-2.0** (repo `cardData.license`; repo also ships `LICENSE`
  11,356 B and `ATTRIBUTIONS.md` 121,138 B). Base model `lusxvr/nanoVLM-460M-8k`.

| File | Bytes | SHA256 (LFS) |
|---|---|---|
| `visionpsy-nano-460m-flash-q8_0.gguf` | 436,676,000 | `66d84c0f552c96ec6734d8cef7f0a3192f4f2df2cd781a193339df194f501a12` |
| `mmproj-visionpsy-nano-460m-flash-q8.gguf` | 108,782,144 | `bbb0691873a4e638f6928898b3c3be9a4730bd4ced301197726a4fcb549695d0` |
| **Pair total** | **545,458,144 (~520.2 MiB / ~545.5 MB)** | — |

Source: HF API `api/models/qvac/VisionPsy-Nano-460M-Flash-GGUFs?blobs=true` (accessed 2026-10-28).

### Language capability caveat (critical for Bara)

Both candidate GGUF repos are tagged **English-only** (`language: ["en"]`).
Indonesian-language quality is therefore **unproven** and must be measured in the
offline protocol before any claim. This is a primary gate per the PRD evaluation
strategy.

## 4. Download estimates (no model weights downloaded)

The `@qvac/sdk` npm JS package is tiny (~1.52 MiB unpacked, verified by
`npm pack` + unpack on this host). The real footprint is the **native QVAC
inference backends and the Bare runtime**, pulled as separate prebuild packages
during `npm install` / `npx expo prebuild`, plus the npm cache:

| Artifact | Estimate | Basis |
|---|---|---|
| `@qvac/sdk@0.22.0` JS tarball | ~1.52 MiB unpacked (419 KB tgz) | verified via `npm pack` on this host |
| QVAC native backends (direct deps) | **~1.215 GB unpacked** | coordinator install observation |
| `react-native-bare-kit` (BareKit) | **~353 MB** | coordinator install observation |
| **Total npm install + cache** | **~3–5 GB** | coordinator install observation (node_modules + npm cache duplication) |
| SmolVLM2 500M Q8_0 pair (weights) | ~545.6 MB | HF metadata, §3 |
| VisionPsy Nano Flash Q8_0 pair (weights) | ~545.5 MB | HF metadata, §3 |

The JS-package size is NOT the install size: the native backends dominate. Per
plan constraints, **model weights were not fetched** and a full SDK/toolchain
install requires coordinator clearance; the backend/BareKit/total figures above
come from the coordinator's actual install environment, not from this audit's
downloads.

## 5. Platform / build compatibility (documented, not tested)

| Area | Documented | Limit of claim |
|---|---|---|
| Android OS | 12+ ARM64 (SDK requirements). Example plugin `minSdkVersion: 29` (= Android 10) — internal tension; treat 12+ as the safe target | OS listing ≠ device inference proof |
| Android GPU | Backends: **Vulkan**, or **OpenCL on Adreno 700+ only** | Xiaomi 14T = **Mali-G615** (not Adreno). OpenCL path does **not** apply; Vulkan path must be **tested**, never inferred. CPU fallback behavior on Android unstated |
| Emulators | Unsupported (llamacpp limitation) — physical device required | — |
| SDK (Bare worker) | Drives a Bare worker over `bare-rpc`; `@qvac/inference` is the Bare-only in-process engine; `@qvac/bare-sdk` deprecated (last 0.18.2) | — |
| Expo | `>= v54`; mobile via Expo + `react-native-bare-kit`; prebuild links native addons | Does not prove Expo Go works; a native dev/standalone build is required |
| iOS | 17+ ARM64, Metal, via Expo | **No iPhone / Apple Developer account available** — no build/signing evidence possible now |
| **Windows native build** | Windows is a **desktop host/CLI** target (win32-x64). For running inference *on the Windows machine itself* it needs **Vulkan >= 1.4 even for CPU-only inference**; `qvac bundle sdk` needs Node 22.21+/24.9+ | The Vulkan >= 1.4 requirement is for **desktop inference on Windows**, and is distinct from **building for Android**. Building the Android app is a cross-target operation from the Windows host via Expo/`react-native-bare-kit` + `npx expo run:android --device` (Gradle + Android platform-tools/`adb`, and an NDK for native addons) — it does not require the Windows Vulkan runtime. The `qvac` CLI itself "cannot run on mobile; those are deploy targets only." Windows cannot build/sign iOS |

Free local tooling is preferred: Expo prebuild + local Gradle Android build and
`adb` (platform-tools) are free; no paid service signup is needed for the Android
spike. iOS would require paid Apple signing — out of scope now.

## 6. Device inventory script (read-only) — verification

File: `scripts/device/Get-DeviceInventory.ps1`. Tests:
`scripts/device/Get-DeviceInventory.Tests.ps1` + `scripts/device/fake-adb.cmd`.

- Accepts **explicit** `-AdbPath` and `-Serial` (both mandatory); never guesses
  the toolchain or device.
- **Fail-closed device gate:** parses `adb devices` and requires the target
  serial as a **whole token** (case-sensitive, exact) with state exactly
  `device`. `unauthorized`, `offline`, a substring/superstring serial, or a
  missing serial all **throw** before any collection. No substring matching.
- **Required fields fail closed:** core OS identity (`ro.build.version.release`,
  `ro.build.version.sdk`, `ro.product.model`, `ro.product.cpu.abi`),
  `/proc/meminfo`, and `df /data` use a `-Required` adb wrapper that **throws**
  on non-zero adb exit, so an adb error string is never stored as a valid OS,
  RAM, or storage value. Battery/thermal are diagnostic (non-fatal).
- Read-only only: `getprop`, `cat /proc/meminfo`, `df -h /data`,
  `dumpsys battery`, `dumpsys thermalservice`, `adb devices`. No push/install/
  reboot/settings writes. No identifiers/personal data collected.
- **RAM labeling:** reports `kernelUsableRamMiB` from `/proc/meminfo` MemTotal,
  explicitly labeled **kernel-usable RAM after carveouts, NOT exact marketed
  physical capacity**. `swapTotalMiB` is reported **separately** and is **not
  assumed to be entirely memory extension** (it may include zram); swap/memory
  extension is excluded from the inference RAM budget.
- Arguments passed to `adb` as arrays (no shell string interpolation) to avoid
  injection.

Syntax verification (no device needed), run 2026-10-28 on this host:

```
[System.Management.Automation.Language.Parser]::ParseFile(Get-DeviceInventory.ps1) -> SYNTAX OK: 0 parse errors
PSVersion: 5.1.26100.9711
```

Fake-adb behavior tests (no real device), run 2026-10-28 on this host via
`powershell -NoProfile -ExecutionPolicy Bypass -File Get-DeviceInventory.Tests.ps1`:

```
[PASS] unauthorized        - threw: state 'unauthorized' (expected 'device'); refusing to collect
[PASS] offline             - threw: state 'offline' (expected 'device'); refusing to collect
[PASS] substring-mismatch  - threw: serial not found (superstring 'ABCD1234EXTRA' rejected by exact match)
[PASS] success             - report produced; kernelUsableRamMiB=11644, swapTotalMiB=6144 (swap NOT folded into RAM)
[PASS] required-cmd-error  - threw on failed required getprop; no error string leaked into androidRelease
Total: 5  Passed: 5  Failed: 0   (exit 0)
```

This verifies **syntax, the serial/state guards, required-field fail-closed
behavior, and RAM/swap separation** against a fake adb. It does NOT prove real
device collection (no physical device attached).

## 7. Documented vs tested — explicit separation

**Verified from metadata (DOC):** SDK version 0.22.0 + hashes + publish date;
**`@qvac/sdk` Apache-2.0 license (verified from package LICENSE + package.json)**;
peerDependencies and Node/Expo/Bare ranges; both model pairs' file names, bytes,
SHA256 LFS hashes, revisions, and apache-2.0 model licenses; download size
estimates (incl. native backend ~1.215 GB + BareKit ~353 MB + ~3–5 GB total from
coordinator install); Android/iOS/Windows requirement text; script syntax, device
guards, required-field fail-closed behavior, and RAM/swap separation (fake-adb tests).

**Not tested / open (needs device):**
- Vulkan backend success on Mali-G615 (Xiaomi 14T) — inference, latency, peak RAM.
- Indonesian-language quality (both candidates English-tagged).
- 10/10 offline cold-start success, warm latency, <10 s target.
- Xiaomi 14T actual OS/HyperOS/kernel-usable RAM/free storage (run the inventory script).
- iOS build/signing (no device/account).
- Exact native prebuild sizes are from the coordinator's install environment, not
  re-measured by this audit.

## 8. Candidate recommendation (research shortlist, not a final pick)

Start with **SmolVLM2 500M Q8_0** (Candidate A): slightly smaller preprocessing
caveat (no `image_no_upscale` interaction), broad apache-2.0 provenance, and it is
the PRD's first-listed candidate. Keep **VisionPsy Nano 460M Flash Q8_0**
(Candidate B) as the alternative — remember to set `image_no_upscale: 'on'` for
the Flash pair. Final selection is gated on the offline protocol results
(Indonesian quality, latency, peak memory, 10/10 offline), not on this metadata.

## Sources (accessed 2026-10-28)

- npm `@qvac/sdk` registry metadata — https://registry.npmjs.org/@qvac/sdk
- QVAC System requirements — https://docs.qvac.tether.io/sdk/system-requirements/
- QVAC JS/TS SDK — https://docs.qvac.tether.io/sdk/js-ts-sdk/
- QVAC Multimodal — https://docs.qvac.tether.io/sdk/ai-capabilities/multimodal/
- HF `ggml-org/SmolVLM2-500M-Video-Instruct-GGUF` — https://huggingface.co/api/models/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF?blobs=true
- HF `qvac/VisionPsy-Nano-460M-Flash-GGUFs` — https://huggingface.co/api/models/qvac/VisionPsy-Nano-460M-Flash-GGUFs?blobs=true
- HF VisionPsy model listing — https://huggingface.co/api/models?search=visionpsy
- Tether VisionPsy-Nano announcement — https://tether.io/news/tether-data-open-sources-visionpsy-nano-best-in-class-460m-on-device-vision-language-model-leading-industry-benchmarks/

_Content from external sources was rephrased for compliance with licensing restrictions._
