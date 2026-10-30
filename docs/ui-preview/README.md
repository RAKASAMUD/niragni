# Niragni Web Preview (DEMO / UI PREVIEW)

A loopback-only desktop web preview of the **same** Niragni Expo Router screens,
for coordinator browser review. It runs the real UI components against a
**web-only DEMO service** backed by fixtures — it is **not** the production app.

## What it is / is NOT

- It IS the actual `app/**` + `src/ui/**` Expo Router UI, bundled for web.
- It is NOT the local-first app: there is no QVAC/BareKit inference, no SQLite,
  no camera/library picker, no GPS, no OS share sheet, no dialer. Those native
  modules are excluded from the web bundle's import graph entirely.
- All data is clearly-labelled DEMO fixture data. The AI "suggestion" is
  **persistent DEMO example text**, never generated, never offline inference,
  never a measured latency (`durationMs: 0`). Nothing ever claims "Siap offline".

A persistent **PRATINJAU UI · DATA CONTOH** banner is shown on every screen
(web only) so a reviewer can never mistake it for the real app.

## How the native boundary works

Metro resolves platform-specific files: on web it picks `*.web.ts(x)` ahead of
`*.ts(x)`. So:

- `src/ui/services.web.ts` — a DEMO `ProductServices` with **no native imports**
  — is what the UI binds on web, instead of `src/ui/services.ts` (which
  re-exports `../core/index` → QVAC/BareKit/expo-sqlite/… on native).
- `src/ui/PreviewBanner.web.tsx` renders the banner on web;
  `src/ui/PreviewBanner.tsx` renders `null` on native (production UI unaffected).

This is a **platform-resolution** boundary, not a `Platform.OS` runtime gate, so
the native modules are never pulled into the web bundle. Verified: the exported
web bundle contains **zero** `@qvac/sdk` / `react-native-bare-kit` references.

## Run it (loopback only)

```powershell
# 1. Build the static web export
cd apps/qvac-spike
npx expo export --platform web --output-dir dist-web

# 2. Serve it on 127.0.0.1 only (no LAN / tunnel / cloud)
node scripts/serve-web-preview.mjs 8082
# or: ./scripts/start-web-preview.ps1
```

Then open `http://127.0.0.1:8082`. The static server (`scripts/serve-web-preview.mjs`)
binds **explicitly to `127.0.0.1`** (not `0.0.0.0`), serves correct content
types, and does SPA fallback to `index.html` for client-side router routes
(e.g. `/report/<id>/edit`).

## DEMO service behaviour (honesty rules)

| Action | Web preview behaviour |
| --- | --- |
| list/create/get/save/delete report | Real in-memory + `localStorage` (namespaced `niragni-web-preview-demo-reports-v1`); edits persist across reload. |
| addPhoto | Adds a **clearly-labelled synthetic DEMO SVG** attachment (not a real camera/picker). Max 3. |
| removePhoto / toggle share-select | Works on the in-memory draft. |
| getObserverLocation | Throws "only available on device" (no fake GPS fix). |
| listModels / checkModel | Honest static manifest metadata (SmolVLM2 500M size), status always non-ready with "unavailable in web preview" message. Never "ready"/"Siap offline". |
| download/import model | Throws "only available on device". |
| generateDraft | Returns the **persistent DEMO example suggestion** (explicitly labelled `[CONTOH DEMO]`), `durationMs: 0`. No model runs. |
| previewExport | Mirrors production `core/export.ts` text format (heading, ringkasan, incident location, time+timezone, optional observer GPS w/ accuracy+timestamp, photo count, local-prepared footer). |
| shareReport | **Throws** "preview unavailable" — never synthesises a `share_sheet_opened` event on a real click. (The populated seed report carries one clearly-DEMO historical share attempt so the activity UI is reviewable.) |
| copyReport | Copies the **formatted preview text** via the browser clipboard; **throws** if clipboard is absent/blocked (no false "disalin" success). |
| openDialer | Throws (preview + task forbid dialer/contact). |
| listChannels | 4 clearly-labelled `[CONTOH DEMO]` karhutla / local-Damkar examples with **non-callable placeholder** destinations. No real emergency numbers, no baseline dataset integration. |

## Coordinator browser review findings (UX, to discuss — NOT fixed here)

These were observed during the live browser review and are recorded as notes
for later product discussion. No mobile behaviour was redesigned in this task.

- Manual flow (raw note → "Lanjut tanpa AI" → review) leaves the editable
  **reviewed summary blank**; a user may think they must retype before "Pilih
  kanal".
- The **observation-time field shows raw ISO text**, which is technical for a
  citizen.
- Channel list has **no regional filter** yet.

## Limitations

- Web preview only; do not infer device behaviour from it.
- `localStorage` persistence is per-browser-origin and is DEMO-only.
- Synthetic photos are inline SVG placeholders.
