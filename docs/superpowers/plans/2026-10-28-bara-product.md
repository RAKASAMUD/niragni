# Bara Product Implementation Plan

User supersedes feasibility-first order: build all baseline features now, defer runtime/device/usability testing. Do not claim physical compatibility or benchmark results. Do not run test suites or device interactions. Typecheck, compilation and static review remain build checks.

Architecture: extend existing apps/qvac-spike into local-first Bara, preserving its QVAC native dependencies. No backend/login. SQLite+private files, QVAC schema-validated suggestions, explicit OS handoff, Indonesia channels, Android and iOS source targets.

Shared frozen API: apps/qvac-spike/src/product-contract.ts. Report revision is repository-managed: saveReport accepts expected revision and increments on success; stale writes reject. addPhoto copies assets and persists attachment in its report; callers reload getReport afterwards. It must preserve an edited form: UI saves latest report before addPhoto. removePhoto likewise persists. generateDraft only returns a revision-tagged suggestion; UI verifies revision and never overwrites user edits automatically. Store accepted/rejected suggestions via saveReport. Services never open dialer/share without explicit UI action. Model installed means integrity checked; ready requires real local load check and lastLocalCheck, not assumed offline network verification.

| Task | Owner | Files | Delivery |
|---|---|---|---|
| Product core | AGY | src/core/**, src/worker.ts, src/manifest.ts, src/prompt.ts, src/types.ts, qvac/**, work/reports/agy-product.md | Durable repository/media/recovery, schema AI, verified model download/import/hash, preview/export/share/clipboard/dialer |
| Product UI | Kiro | app/**, src/ui/**, src/App.tsx, work/reports/kiro-product.md | Expo Router tabs+native stack, all forms/review/detail/model/help states, accessibility, dark/light UI |
| Integration/build | Coordinator | product-contract.ts, package.json/lockfile, app.json, index.js, native config/prebuild, root docs/work, .tools | Dependencies, permissions/privacy config, standalone Android APK and source iOS target |
| Static cross review/fixes | Owners via Orca | Review reports only, then original implementation files | Requirements coverage and inspectable build evidence, no user testing |

Constraints: max4000 chars,3photos,20MB/photo,analysis1600px longest edge. All report drafts work without model/network. No automatic send/call or receipt inference. No logs of photos/text/coordinates. Save label only after successful file copy/DB commit. GPS reporter separate incident estimate. Export selected photos/location, re-encode to remove EXIF. Retain drafts until explicit delete; clean temp exports safely at next startup. Disable cloud backups; no SQLite encryption claim. Free local tooling, no publish/deploy/agency contact. No downloads of weights by developer; app offers user-triggered download with sizes/space.

Steps: implement core and UI in parallel against contract; integrate actual packages; inspect each outcome; resolve compile/contract errors; prebuild Android with existing portable Node/JBR21/NDKr29; assemble release; verify APK contents/hash/signature; record untested device/iOS gaps. Do not stop at screens with stub services.
