# Bara QVAC Spike Implementation Plan

> **For agentic workers:** Use executing-plans for your assigned task, with Orca orchestration as the authoritative task/dispatch lifecycle. Do not create other workers. Read the assigned brief in work/briefs.

**Goal:** Produce a reproducible Android text+photo QVAC spike APK for subsequent physical Xiaomi 14T testing.

**Architecture:** Minimal Expo native app with local media and a native/Bare QVAC worker. Model and matching projector are pinned local artifacts. No cloud inference, backend, account, reporting channel or production UI is required for this experiment.

**Tech Stack:** React Native, Expo, TypeScript, QVAC SDK; exact compatible versions must come from published package metadata and SDK evidence before installation.

## Global Constraints

- Indonesia scope; Indonesian prompts/output. iOS remains a target without device/signing verification.
- Prefer free tooling and local build. No publish, deploy, external messages, calls or paid service signup.
- Display download estimates before large SDK/model downloads. Do not fetch weights or large toolchains until coordinator clearance.
- Target complete inference below 10 seconds if possible; measure cold and warm separately, never fabricate benchmarks.
- Device testing follows APK readiness. No compatibility/offline-success claim before physical evidence.
- SDK/model/projector versions, URLs, hashes and licenses must be explicit; documentation is not runtime evidence.
- No worker edits outside ownership. No worker git commits, global config changes or Git operations that affect another worker.

## Ownership and task sequence

| Task | Owner | Allowed files | Acceptance |
|---|---|---|---|
| 1 SDK/model audit | Kiro | docs/spike/qvac-audit.md, docs/spike/offline-test-protocol.md, scripts/device/**, work/reports/kiro-audit.md | Source-backed versions/licenses/pairing/size estimates, executable read-only device collection, honest unknowns |
| 2 Native spike | Antigravity | apps/qvac-spike/**, work/reports/agy-spike.md | Real SDK integration, local text+photo input, errors/cancel/latency, tests/typecheck, reproducible Android build or exact blocker |
| 3 Integration/build preparation | Coordinator | root .gitignore, README.md, docs/superpowers/plans/**, work/briefs/**, work/progress.md, work/reports/coordinator.md, .tools/** | Toolchain inventory, estimates, task receipts and verification evidence |
| 4 Independent review | Kiro after task 1 and 2 | work/reports/kiro-review.md only | Review spec and code with paths/severity; no application edits |
| 5 Review fixes | Antigravity | Same as task 2 | Findings fixed with covering checks; Kiro rechecks changed areas |
| 6 Physical gate | Coordinator + user, after APK | docs/spike/device-evidence/** | Actual OS/physical RAM/storage, 10 offline cold runs, photo sensitivity, peak memory and cold/warm total latency |

## Execution checklist

- [x] Inspect baseline and skill instructions, establish real Orca runtime.
- [x] Identify coordinator terminal displaying GPT-6-Astra medium; do not infer worker models from arguments.
- [ ] Start Kiro audit and Antigravity spike preparation in same Run, exact workspace selector.
- [ ] Audit must distinguish SDK source license from model and projector license, and native backend dependencies.
- [ ] Spike must preserve text/photo input on errors and expose no false ready/success state.
- [ ] Test real observable validation and state behavior; fake inference is never acceptance evidence.
- [ ] Record large download estimates and obtain required clearance before downloading.
- [ ] Build installable standalone APK with bundled JavaScript (no Metro dependency for offline test).
- [ ] Independently review implementation and route fixes back to application owner.
- [ ] Verify APK exists, build command exits successfully, and hash artifact.
- [ ] Settle/release each Orca worker and report actual evidence and remaining physical test gate.

## Commands and evidence contract

Workers must record exact commands, exit codes, output summaries and artifact paths in their reports. Application owner defines npm scripts for typecheck/tests/build from the actual chosen SDK, not invented SDK APIs. A successful desktop test proves only that test. Native build success proves an APK was built, not QVAC device compatibility.

Device collection should use explicit adb serial selection and read-only commands for OS/build/ABI, /proc/meminfo, df and battery status; avoid personal identifiers, locations, photos and account data in logs. Offline protocol disconnects Wi-Fi/data and verifies network state, cold launches the standalone app with preloaded model/projector, records input/output and elapsed time, and never contacts an agency.
