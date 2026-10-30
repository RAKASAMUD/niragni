# Niragni — Offline AI for Wildfire Report Drafting (Indonesia)

**Niragni turns a citizen's rough notes and photos of a suspected forest/land fire (karhutla) into a structured, editable report draft — using a vision-language model that runs entirely on the phone via QVAC. No server, no account, no network needed for the AI step.**

- **Track:** Offline AI Apps
- **Core AI feature:** on-device multimodal inference (text + photo → structured Indonesian draft) with `@qvac/sdk` + a quantized SmolVLM2-500M GGUF model
- **Platform:** Android (arm64-v8a), React Native / Expo, TypeScript
- **Demo video (internet disconnected):** [Google Drive folder](https://drive.google.com/drive/folders/1el4nVyneZec2Z-NcelraZa_u1oWaOKtj?usp=sharing)
- **Landing page & APK download:** [`web/`](web) (Next.js; deploy on Vercel with Root Directory `web`) · APK on [GitHub Releases](https://github.com/RAKASAMUD/niragni/releases)

## Submission checklist → where to find it

| Requirement | Where |
|---|---|
| Problem, users, track | [Problem & users](#problem--users), [`docs/SUBMISSION.md`](docs/SUBMISSION.md) §1 |
| Setup instructions & dependencies | [Quickstart](#quickstart), `apps/qvac-spike/package.json` |
| What was built during the event / third-party disclosure | [Built during the event](#built-during-the-event--disclosure) |
| QVAC integration (versions, model, download steps, files) | [QVAC integration](#qvac-integration) |
| Device, OS, memory, licenses, hardware limits | [Device & licenses](#device-memory--licenses) |
| Features that still need a network | [Network-dependent features](#network-dependent-features) |
| Honest verification status | [Verification status](#verification-status) |
| No secrets in repo | [Privacy & safety](#privacy--safety) |

## Problem & users

People who spot a possible forest/land fire in Indonesia often cannot describe **what** they saw, **where**, and **when** — and connectivity is frequently poor exactly where fires happen. Niragni separates *preparing* a report from *sending* it: everything up to the final hand-off works offline, and the app never claims that opening a share channel means authorities received anything.

Target users: ordinary citizens anywhere in Indonesia. The AI drafts and asks at most three clarifying questions; it does **not** diagnose fires.

## How it works

```
notes + photos + location (all stored locally in SQLite / private app storage)
        │
        ▼
 on-device QVAC inference  ──►  schema-validated draft (AI-sourced facts are marked,
 (SmolVLM2-500M, CPU)             unknown fields stay "belum diketahui", nothing invented)
        │
        ▼
 user reviews / edits  ──►  export preview (mandatory sender selfie, photos re-encoded to strip EXIF/GPS)
        │
        ▼
 user taps a verified fire-department (Damkar) channel — dialer / email / share sheet
```

Key safeguards: strict output schema + provenance validation (an AI "visual" observation must reference a real attached photo), UTC→local-time normalization before prompting, SHA-256 verification of model files before they are marked ready, and no automatic sending or calling.

## QVAC integration

| Item | Value |
|---|---|
| SDK | `@qvac/sdk@0.22.0` (Apache-2.0), native runtime `@qvac/fabric-android-arm64@0.22.0` |
| Default model | **SmolVLM2-500M-Video-Instruct**, Q8_0 GGUF + `mmproj` projector (Apache-2.0) |
| Alternate model | VisionPsy-Nano-460M-Flash, Q8_0 (Apache-2.0) |
| Backend | CPU (`device: 'cpu'`); GPU/Vulkan not yet tested |

**Files where QVAC is used** (`apps/qvac-spike/`):

| File | Role |
|---|---|
| `src/worker.ts` | Direct `@qvac/sdk` calls: load model + projector, streaming completion, unload. No mocks, no cloud fallback. |
| `qvac/worker.entry.mjs` | Native worker entry point |
| `src/core/models.ts` | Download/import/verify model files (size + SHA-256 + local load check) |
| `src/core/ai.ts` | Builds the Indonesian prompt and validates the model's JSON output against a strict schema |
| `src/manifest.ts` | Pinned model candidates: filenames, byte sizes, SHA-256, licenses, runtime config |

**Model download (do this before an offline demo):** from `huggingface.co/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF` get
`SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (436,808,704 bytes, SHA-256 `6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc`) and
`mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (108,785,184 bytes, SHA-256 `921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b`).
Then in the app: the **Readiness** tab → import model and pick both files. The app verifies size, hash and a real local load before showing "ready".

## Quickstart

**Reviewer path (no phone needed) — logic and types:**
```bash
cd apps/qvac-spike
npm install
npm run typecheck   # tsc --noEmit
npm test            # Jest: 17 suites / 250 tests (native boundaries are mocked)
```

**Run on a device:** build with `powershell -ExecutionPolicy Bypass -File scripts/Build-Niragni.ps1` (Windows; needs Node 22.21+, Android Studio JBR 21, Android SDK 36, NDK r29; output `artifacts/niragni-android.apk`), install the APK, import the model as above, then switch the phone to airplane mode and generate a draft. Release signing needs a local keystore outside the repo; the script fails closed if it is missing (`-AllowDebugSigning` for an explicit debug build).

## Repo map

```
apps/qvac-spike/
  app/            Expo Router screens (home, report editor, photos, location, AI generate, review, share, channels, readiness)
  src/core/       database (SQLite + migrations), models, ai, export, repository, lifecycle, channel directory
  src/worker.ts   QVAC native inference worker
  src/ui/         theme + components
  src/__tests__/  Jest suites
docs/             SUBMISSION.md, implementation-status.md, QVAC audit, offline test protocol
web/              Next.js landing page for judges (install steps, QVAC table, demo slot)
scripts/          Android build script, device inventory tooling
```

## Verification status

| Claim | Status |
|---|---|
| TypeScript compiles (`tsc --noEmit`) | ✅ verified |
| 250 / 250 Jest tests pass (logic, with native modules mocked) | ✅ verified |
| Release APK builds, arm64-v8a, release-signed, 86 MB after compression | ✅ verified (see `docs/implementation-status.md`) |
| Draft/photo/location/delete/persistence flows on a Xiaomi 14T | ✅ device-tested earlier build; 4 bugs found and fixed in source |
| Model import via Android file picker (SAF) | ✅ verified on device (fixed and re-tested) |
| Model SHA-256 verification + local load check ("Lolos cek lokal") | ✅ verified on device |
| **Offline on-device inference with network disconnected** | ⏳ in progress — evidence will be in the demo video |
| Latency, peak RAM, GPU backend, iOS | ❌ not measured / not built |

## Device, memory & licenses

- **Test device:** Xiaomi 14T (`2406APNFAG`), Android 16, ~11 GB kernel-usable RAM, Mali-G615 (CPU inference for now)
- **Requirements:** Android 12+ (minSdk 31), arm64-v8a only, ~545 MB for model + projector, ~90–240 MB for the APK
- **Licenses:** app code in this repo; `@qvac/sdk` Apache-2.0; SmolVLM2 and VisionPsy-Nano Apache-2.0. Model weights are **not** redistributed here.

## Network-dependent features

- Downloading the model the first time (afterwards the AI step is fully offline).
- The final hand-off to a channel (phone call, WhatsApp, email) naturally needs the user's carrier/internet — the app only opens the system intent.
- Everything else — drafting, photos, location, **AI inference**, editing, preview, storage — works offline.

## Built during the event & disclosure

Everything in this repo was created during the event (first commit Oct 28, 2026). It was built with AI coding assistance: a multi-agent workflow (Kiro/AGY workers under a coordinator) produced the app scaffold, UI, core logic, QVAC worker, channel directory and build tooling; a final Claude Code review/audit pass fixed 9 further defects (share-blocking selfie path bug, leaked temp files, UTC leaking into prompts and exports, model re-hashing on every launch, background-transition download cancellation, dead code, and more).
Third-party: `@qvac/sdk` and its native fabric libraries, the SmolVLM2 / VisionPsy-Nano model weights (downloaded separately from HuggingFace), Expo / React Native and standard npm packages (`apps/qvac-spike/package.json`). No other proprietary code.

## Privacy & safety

- No backend, accounts, analytics or cloud sync; data stays in on-device SQLite and private app storage; Android backup disabled.
- Nothing is sent, published or dialed automatically — every outward action needs an explicit tap.
- No API keys, passwords or wallet secrets in the repo; the release signing key lives outside the repository.
