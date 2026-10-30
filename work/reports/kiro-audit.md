# Kiro Audit Report — Task 1 + review fixes

Owner: Kiro. Original dispatch `task_c893aeb0b23e`; review-fix dispatch
`task_6b0be7080359`. Date: 28 October 2026 (Asia/Jakarta). Scope: research +
read-only script work + fake-adb tests. No model weights downloaded, no
build/inference, no real device. The only download was the 419 KB `@qvac/sdk`
npm tarball (`npm pack`, no deps install) to verify the SDK license.

## Deliverables (owned paths only)

- `docs/spike/qvac-audit.md` — pinned SDK + models, licenses, sizes, hashes, platform/build compatibility.
- `docs/spike/offline-test-protocol.md` — 10 cold-start text+photo offline runs, warm latency, <10 s target, network/sensitivity/memory/cancel/error evidence.
- `scripts/device/Get-DeviceInventory.ps1` — read-only Android inventory, fail-closed.
- `scripts/device/Get-DeviceInventory.Tests.ps1` + `scripts/device/fake-adb.cmd` — fake-adb tests (no real device).
- `work/reports/kiro-audit.md` — this report.

No files outside ownership were edited. No git operations, no agents created.

## Review findings — how each was fixed

1. **SDK license (Apache-2.0).** `npm view @qvac/sdk@0.22.0 license` → `Apache-2.0`.
   Verified from actual package contents: `npm pack` (419,013 B tgz, no deps
   install), unpacked `package/package.json` has `"license":"Apache-2.0"` and
   bundled `package/LICENSE` (10,216 B) is the full Apache License 2.0 text.
   Audit §2 rewritten from "open DOC gap" to verified.
2. **Windows build overreach removed.** §5 Windows row no longer claims Windows
   "is not an Android build host." It now distinguishes: Vulkan ≥1.4 is required
   for **desktop inference on the Windows machine itself** (even CPU-only),
   whereas **building the Android app** is a cross-target op from Windows via
   Expo/`react-native-bare-kit` + `expo run:android --device` (Gradle +
   platform-tools/`adb` + NDK) and does not need the Windows Vulkan runtime. iOS
   build/sign still not possible on Windows.
3. **npm estimates corrected.** §4 now: `@qvac/sdk` JS ~1.52 MiB unpacked
   (verified here); QVAC native backends **~1.215 GB unpacked**; `react-native-bare-kit`
   **~353 MB**; **total npm install + cache ~3–5 GB** (coordinator install
   observation). JS-package size ≠ install size.
4. **Device inventory fail-closed + labeling.** Script rewritten:
   - Exact **whole-token** serial match with state exactly `device`;
     `unauthorized`/`offline`/substring/missing all **throw** before collection.
   - Core OS/RAM/storage reads use a `-Required` wrapper that **throws** on
     non-zero adb exit; adb error strings never become OS values.
   - `/proc/meminfo` MemTotal reported as `kernelUsableRamMiB`, explicitly
     labeled kernel-usable RAM (not exact marketed capacity).
   - `swapTotalMiB` reported **separately**, explicitly **not** assumed to be
     entirely memory extension; excluded from inference budget.
5. **Meaningful fake-adb tests added** (below). No real device access.

## Commands run and results

| Command | Result |
|---|---|
| `npm view @qvac/sdk@0.22.0 license` | `Apache-2.0` (exit 0) |
| `npm pack @qvac/sdk@0.22.0` (temp dir, no install) | `qvac-sdk-0.22.0.tgz` 419,013 B, 645 files |
| unpack + inspect `package.json`/`LICENSE` | `license: Apache-2.0`; `LICENSE` 10,216 B = Apache License 2.0 text; unpacked JS 1,594,309 B (1.52 MiB) |
| `Parser::ParseFile(Get-DeviceInventory.ps1)` | **0 parse errors** |
| `Parser::ParseFile(Get-DeviceInventory.Tests.ps1)` | **0 parse errors** |
| `powershell -NoProfile -ExecutionPolicy Bypass -File Get-DeviceInventory.Tests.ps1` | **5/5 PASS, exit 0** (see evidence) |

Temp tarball dir was deleted after license verification.

## Exact test evidence (fake adb, no real device)

```
[PASS] unauthorized        - threw: Serial 'ABCD1234' is present but state is 'unauthorized' (expected 'device'). ... refusing to collect.
[PASS] offline             - threw: Serial 'ABCD1234' is present but state is 'offline' (expected 'device'). ... refusing to collect.
[PASS] substring-mismatch  - threw: Serial 'ABCD1234' not found as a connected device in `adb devices`. (superstring 'ABCD1234EXTRA' rejected)
[PASS] success             - report produced; kernelUsableRamMiB=11644, swapTotalMiB=6144 (swap NOT folded into RAM); androidRelease=14; primaryAbi=arm64-v8a
[PASS] required-cmd-error  - threw on failed required getprop; no 'ERROR' string leaked into androidRelease
Total: 5  Passed: 5  Failed: 0   (exit 0)
```

Test design notes:
- `fake-adb.cmd` echoes canned `adb devices` / `adb -s <serial> shell ...` output
  driven by `FAKE_ADB_DEVICES_OUT` and `FAKE_ADB_SHELL_FAILCMD`. It touches no
  real device.
- `success` asserts arithmetic: MemTotal 11,923,456 KiB → 11,644 MiB;
  SwapTotal 6,291,456 KiB → 6,144 MiB; and that RAM is NOT 17,788 MiB (would mean
  swap was wrongly added).
- `substring` uses a superstring serial `ABCD1234EXTRA` so a naive substring
  match would wrongly pass; the exact whole-token match rejects it.

## Pinned interfaces for the application worker (unchanged, confirmed)

- SDK: **`@qvac/sdk@0.22.0`** (npm `latest`, 2026-10-19, **Apache-2.0**), tarball shasum `e74b8b5160d90d0f1524582e52c430888e8a6ab9`.
- Node `^22.21.0 || >=24.9.0` (mobile bundling); npm `>=10.9`; Expo `>=54`; `react-native-bare-kit@^0.16.0`.
- Expo plugin `@qvac/sdk/expo-plugin` + `expo-build-properties` `android.minSdkVersion: 29`.
- Model A: SmolVLM2 500M Q8_0 — `SMOLVLM2_500M_MULTIMODAL_Q8_0` + `MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0`; apache-2.0; ~545.6 MB. SHA256 in audit §3.
- Model B: VisionPsy Nano 460M Flash Q8_0 — un-suffixed constants; set `image_no_upscale:'on'`; apache-2.0; ~545.5 MB. SHA256 in audit §3.

## Gaps / open items (needs device)

- Vulkan backend success on Mali-G615 (Xiaomi 14T), latency, peak RAM — untested.
- Indonesian quality (both models English-tagged) — untested.
- 10/10 offline cold-start, warm latency, <10 s target — untested.
- Xiaomi 14T actual OS/HyperOS/kernel-usable RAM/free storage — run the script on device.
- iOS build/signing — no device/account.
- Native prebuild sizes are from the coordinator's install env, not re-measured here.

## Acceptance check (against review brief)

- `npm view ... license` = Apache-2.0: ✅; actual LICENSE verified from small tarball (no deps install): ✅.
- Windows "not Android build host" assertion removed; desktop Vulkan vs Android cross-build distinguished: ✅.
- npm estimates corrected (backends ~1.215 GB + BareKit ~353 MB + ~3–5 GB total): ✅.
- Exact serial + state=device match, fail closed on required adb failures (no error strings as OS): ✅.
- MemTotal labeled kernel-usable (not marketed), swap separate, not all-swap-is-memory-extension: ✅.
- Fake-adb tests for unauthorized/offline/substring mismatch + success/error, no real device: ✅ 5/5.

## Ringkasan (Bahasa Indonesia)

Semua temuan review sudah diperbaiki. Lisensi `@qvac/sdk@0.22.0` kini terverifikasi
**Apache-2.0** dari `npm view` dan dari isi paket (LICENSE 10.216 B + field
package.json) lewat `npm pack` tanpa instalasi dependency; estimasi unduhan
dikoreksi menjadi backend native ~1,215 GB + BareKit ~353 MB dengan total npm/cache
~3–5 GB, dan klaim berlebih soal Windows dihapus (Vulkan ≥1.4 untuk inferensi
desktop Windows, berbeda dari build cross-target Android). Skrip inventaris
sekarang fail-closed: cocok serial persis dengan state `device`, menolak
unauthorized/offline/substring, melempar error pada perintah adb wajib yang gagal
(bukan menyimpan string error sebagai nilai OS), melabeli MemTotal sebagai RAM
kernel-usable (bukan kapasitas pasar), dan memisahkan swap tanpa mengasumsikan
semua swap adalah memory extension; lima tes fake-adb lulus (exit 0) tanpa
perangkat nyata.
