# Kiro — Niragni Web Preview implementation report

Task `task_dadf2001f225` / dispatch `ctx_03bf42db50ea`.

## Outcome

A working loopback-only desktop web preview of the same Niragni Expo Router UI
is live for coordinator browser review, driven by a web-only DEMO service with
the native QVAC/BareKit import graph excluded entirely.

- **URL:** `http://127.0.0.1:8082` (loopback only)
- **Bind verified:** `Get-NetTCPConnection -LocalPort 8082` → PID 14820 bound
  `127.0.0.1:8082` (NOT `0.0.0.0`). Resolves the coordinator's bind-boundary concern.
- **Server:** owned Node static server `scripts/serve-web-preview.mjs` serving
  `dist-web` (the `expo export --platform web` output), run from an Orca
  terminal `term_33cfe774-4e8f-4721-9d26-da470e1b237f` via
  `scripts/start-web-preview.ps1`. SPA fallback + content types; no framework,
  no tunnel, no cloud.

## Files added (my scope)

- `apps/qvac-spike/src/ui/services.web.ts` — DEMO `ProductServices`, no native imports.
- `apps/qvac-spike/src/ui/PreviewBanner.web.tsx` — web-only persistent DEMO banner.
- `apps/qvac-spike/src/ui/PreviewBanner.tsx` — native no-op (renders null).
- `apps/qvac-spike/scripts/serve-web-preview.mjs` — loopback static server.
- `apps/qvac-spike/scripts/start-web-preview.ps1` — launcher.
- `docs/ui-preview/README.md` — preview documentation.
- `work/reports/kiro-web-preview.md` — this report.

## Files modified (scoped)

- `apps/qvac-spike/app.json` — added `platforms` incl. `web` + `web.bundler: metro`, `output: single`.
- `apps/qvac-spike/app/_layout.tsx` — render `<PreviewBanner/>` (null on native) above the Stack.
- `apps/qvac-spike/package.json` + `package-lock.json` — added `react-native-web`, `@expo/metro-runtime` (via `expo install`).
- `apps/qvac-spike/tsconfig.json` — Expo CLI auto-added `"extends": "expo/tsconfig.base"` + reformat on first web start. Additive only; no existing settings dropped. **Reported per coordinator request.**
- `.gitignore` — ignore `apps/qvac-spike/dist-web/` (regenerated export output).

Native-only files (worker.ts, core/database.ts, core/models.ts, core/media.ts,
core/channels.ts, core/export.ts, core/index.ts) were NOT modified. Mobile paths
preserved.

## Verification

- `npx tsc --noEmit` → exit 0 (run repeatedly, incl. after final source edits). Mobile paths typecheck clean.
- `npx expo export --platform web` → exit 0, 791 modules bundled, no native-module resolution errors.
- Served bundle scan: `@qvac/sdk` = 0, `react-native-bare-kit` = 0; DEMO markers present
  (`PRATINJAU UI`, `CONTOH DEMO`, `LAPORAN OBSERVASI DUGAAN KARHUTLA`, `POSISI PELAPOR`,
  export footer, `bukan nomor nyata` placeholders, model-unavailable, clipboard-throw, dialer-throw).
  Old `dipalsukan` banner wording removed (0); `112 (komdigi)`/generic BPBD Riau removed (0).
- `GET /` → 200; SPA deep-link `GET /report/<id>/review` → 200 HTML (fallback works).
- `GET …/entry.bundle?platform=web` → 200, compiled clean.

## Coordinator review items addressed (msg_7a575f42843d, msg_a949d8027cb1, banner msg)

1. Persistent visible DEMO banner on every screen incl. new blank report. ✔
2. `shareReport` no longer synthesises `share_sheet_opened` on a real click; throws preview-unavailable. Seeded historical attempt kept, clearly DEMO. ✔
3. `addPhoto` no longer a silent null; adds a clearly-labelled synthetic DEMO attachment. ✔
4. `copyReport` throws if clipboard absent/rejected; copies the formatted preview text. ✔
5. DEMO channels: removed real 112 + generic BPBD Riau; only `[CONTOH DEMO]` karhutla + local-Damkar examples with non-callable placeholders. ✔
6. Models: honest static manifest metadata + non-ready "unavailable in web" status (no 0 MB, no fake ready). ✔
7. `previewExport` mirrors production `core/export.ts` format (heading/incident/time+tz/optional GPS/photo count/footer); `copyReport` uses it. ✔
8. Loopback bind: switched from `expo start` (bound 0.0.0.0) to an owned static server bound 127.0.0.1. ✔
9. Banner copy: concise "PRATINJAU UI · DATA CONTOH …"; dropped misleading "dipalsukan". ✔
10. Export separator newline bug: preview text now joins with a `String.fromCharCode(10)` LF constant (not a `'\n'` literal), so the browser renders real line breaks instead of a visible `\n`. ✔

## UX findings from the live browser review (recorded, NOT redesigned)

- Manual flow leaves the editable reviewed summary blank → user may think they must retype before "Pilih kanal".
- Observation-time field shows raw ISO text (technical for a citizen).
- Channel list has no regional filter yet.

These are product-discussion notes; no mobile behaviour changed.

## Limitations

- Web preview only; device behaviour must not be inferred from it.
- `localStorage` persistence is per-origin, DEMO-only.
- Synthetic photos are inline SVG placeholders.

## Git

No commits/push this dispatch (awaiting coordinator review). Untracked
out-of-scope items preserved untouched: `scripts/Backup-NiragniSigning.ps1`,
`work/reports/kiro-emulator.md`, and AGY's `docs/channel-directory/research-round-2/`
+ `work/reports/agy-channels-round-2.md`.
