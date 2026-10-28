# Kiro Product UI Report — Bara (Task: Product UI)

Owner: Kiro. Dispatch `task_0d73164a872e`. Date: 28 October 2026 (Asia/Jakarta).
Scope: full Bara UI inside my ownership only — `apps/qvac-spike/app/**`,
`apps/qvac-spike/src/ui/**`, `apps/qvac-spike/src/App.tsx`, and this report. No
tests run (per user), no package/config/native changes, no agents created. All
data flows through the frozen `src/product-contract.ts` via `src/core/index`
(AGY's `services`). No fake/mock services, no hardcoded success.

## Verification

- `npx tsc --noEmit` → **exit 0, zero errors** across the whole app (UI + AGY's
  delivered `src/core/index.ts`). This is real integration evidence: the UI
  typechecks against the actual core implementation and the frozen contract, not
  a stub.
- No test suites, prebuild, install, or device operations were run (per user /
  ownership). No package.json/app.json/index.js edits.

## Files implemented

Design system & integration (`src/ui/`):
- `theme.ts` — light/dark tokens from the UI spec (canvas/surface/text/green,
  destructive), spacing 4–32, radii 12/16, system type scale, `MIN_TOUCH` 48,
  `useTheme()`.
- `components.tsx` — Screen, Heading/Title/Body/Label/Caption, Card, Button
  (primary/secondary/destructive/quiet, 48dp, a11y labels/state), Field
  (system-scaled, char counter), StatusPill (text + color, never color alone),
  Notice, Divider, Row, ListRow.
- `format.ts` — bytes, timezone-explicit time, accuracy "± N m" only when known,
  LIMITS (4000 chars / 3 photos / 20 MB).
- `FlowHeader.tsx` — back-aware header (async back that saves first).
- `services.ts` — single integration point: `export { services } from '../core/index'`
  + contract type re-exports. Extensionless imports.
- `useReportEditor.ts` — serialized autosave + revision-safe editor (details below).

Routing (`app/`, Expo Router tabs + native stack):
- `_layout.tsx` — Stack + SafeAreaProvider + themed StatusBar; `services.init()`.
- `(tabs)/_layout.tsx` — three tabs: Laporan, Kanal bantuan, Kesiapan offline.
- `(tabs)/index.tsx` — reports home: AI-readiness line (from local model status,
  not assumed), "Buat laporan" CTA, draft list (place/time/local status, not a
  sent badge), empty state.
- `(tabs)/channels.tsx` — channel directory: number, kind, cakupan, source +
  checked date, dialer (no auto-call), unconfirmed microcopy.
- `(tabs)/readiness.tsx` — per-model status/size/required-free-space/last local
  check; download (shows size first), cancel, import, check (local load), delete
  (separate from drafts).
- `report/_layout.tsx` — native stack for the flow.
- `report/[id]/index.tsx` — detail: content, attachments, share activity
  ("Pilihan berbagi dibuka pada …; penerimaan belum diketahui"), edit/share/delete
  (confirmation keeps gallery original).
- `report/[id]/edit.tsx` — create/edit form with autosave states, photo/time/
  location entry points, equal "Susun dengan AI" / "Lanjut tanpa AI" CTAs.
- `report/[id]/photos.tsx` — up to 3 photos ≤ 20 MB, thumbnails, origin/size,
  select-for-share, add (camera/library), remove (keeps original), limit guard.
- `report/[id]/location.tsx` — observation time + explicit timezone; "Posisi Anda"
  (optional GPS, accuracy/timestamp when known) kept SEPARATE from the manual
  "Perkiraan lokasi kejadian" (never auto-filled from observer GPS).
- `report/[id]/generate.tsx` — AI progress (no fake %), cancel, "Lanjut isi
  sendiri" always present and more prominent after 30 s.
- `report/[id]/review.tsx` — editable summary, user facts, per-observation
  provenance (user/metadata/ai_visual) + uncertainty labels, accept per section,
  unknown fields, ≤3 questions, export selection (photos + precise location).
- `report/[id]/share.tsx` — export preview (text + selected photos + whether
  precise location is included), OS share / copy / dialer, channel list with
  source/date, honest "opening share is not proof of receipt".
- `src/App.tsx` — re-exports the expo-router root.

## Correctness: revision-safe autosave (the core requirement)

`useReportEditor.ts`:
- Serializes saves through a single shared promise chain; the newest edit is
  coalesced and saved after the current save resolves (no busy polling).
- `flush()` awaits that chain and **rejects if the final save failed**, so Back /
  addPhoto / removePhoto / AI callers stay put and show an error instead of
  proceeding on an unsaved report (fixes the earlier swallow-and-proceed bug).
- A per-id **generation token** drops late loads/saves when the report id
  changes (mountedRef alone was insufficient).
- `reload()` and `setReport()` never replace unsaved/pending local edits.
- Save adopts the store's authoritative incremented revision while preserving
  edits made during the save.

Native Back / iOS swipe: `edit.tsx` and `location.tsx` use
`usePreventRemove` + `useNavigation().dispatch(data.action)` to save first and
only let the removal through on success; failure stays on the screen with a
notice. Async nav handlers are wrapped so a flush rejection can't become an
unhandled rejection.

Suggestion validity: aligned to AGY's store rule (confirmed by reading
`src/core/repository.ts`): `saveReport` clears `suggestion` to null only when an
AI **input field** (rawText / observationTime / incidentLocationText) changes;
editing reviewedText, toggling share, or accepting a section does not. So the
review screen trusts a non-null `report.suggestion` as current and does **not**
compute staleness from a revision comparison (which would always trip after the
save-time increment and wrongly hide valid suggestions). `generate.tsx` persists
the suggestion only if input fields are unchanged since its snapshot, uses a run
token to abandon superseded/StrictMode runs, cancels generation on any
unmount/Back/swipe, and preserves the real error text.

## Design / accessibility

- Tokens, spacing, radii, and system type per the UI spec; quiet surfaces, no
  decorative fire, no fabricated danger score. Dark/light via `useColorScheme`.
- Touch targets ≥ 48dp; accessible labels name action + object; status pills
  carry text (not color alone); KeyboardAvoidingView on the form; safe-area
  insets on all scrolls; text scales with system setting (no fixed font-scaling).
- Only platform-default transitions are used — there is no custom motion to gate,
  so no false "Reduce Motion respected" claim is made (noted in layout comments:
  if custom transitions are added, read AccessibilityInfo).

## Known gaps / integration notes (honest)

- **No tests / no device run** (per user). UI behavior is verified by typecheck
  only; visual/interaction validation on a prototype/handset is still pending.
- **Camera capture**: `addPhoto(reportId, source)` is owned by core; the UI
  passes `'camera' | 'library'` and reloads. Actual capture/picker UX depends on
  AGY's implementation + coordinator-configured permissions.
- **Deep-link `?focus=time`** on the location screen is passed but the screen
  currently shows time at the top rather than auto-focusing the field; minor.
- **Contrast**: token pairs are from the spec and not yet measured on a device;
  spec itself flags this as a measurement task.
- Entry wiring (package main → expo-router/entry, app.json scheme/plugins) is
  coordinator-owned and reported as already done per coordinator message; I made
  no package/config changes.

## Ringkasan (Bahasa Indonesia)

Seluruh UI Bara sudah dibuat dengan Expo Router (tab + native stack) di dalam
kepemilikan saya saja, mengimpor layanan nyata dari `src/core/index` dan tipe dari
`product-contract.ts` yang dibekukan — tanpa layanan palsu, tanpa klaim sukses
yang dipaksakan. Semua layar UI-Spec ada: beranda laporan, form buat/edit dengan
autosave (status menyimpan/tersimpan/gagal) yang diserialkan dan menolak lanjut
saat simpan gagal, foto (≤3, 20 MB, pilih untuk dibagikan), lokasi (posisi
pelapor terpisah dari perkiraan lokasi kejadian, zona waktu eksplisit), progres/
batal AI dengan opsi manual selalu tersedia, tinjau aman-revisi (terima per
bagian, provenance/ketidakpastian, maks 3 pertanyaan), detail/aktivitas berbagi/
hapus dengan konfirmasi, pratinjau ekspor, aksi berbagi/salin/telepon OS,
direktori kanal, dan kesiapan model (unduh/impor/periksa/hapus dengan ukuran dan
ruang). Verifikasi: `tsc --noEmit` lolos (exit 0) terhadap core AGY yang sudah
ada; tidak ada tes/prebuild/perubahan paket dijalankan sesuai instruksi; koreksi
koordinator (impor tanpa ekstensi, flush menolak saat gagal, guard Back native,
semantik revisi saran) sudah diterapkan.


---

# UI Fix Round 2 — coordinator static review + AGY review

Dispatch `task_38c77512e372`. Date: 28 October 2026. Scope: UI files only
(`app/**`, `src/ui/**`, `src/App.tsx`); no tests/package/native/build changes.
Verification: `npx tsc --noEmit` → **exit 0, zero errors**.

## Fixes applied (exact)

### `src/ui/useReportEditor.ts` (autosave race — critical)
- **Failed-save dirty restoration:** the chain runner cleared `dirtyRef` before
  the `await`; on reject it now **restores `dirtyRef = true`** (and keeps
  `isDirty` true + preserves the error) so a later `flush()` no longer falsely
  returns an unsaved report as success. Stale-generation abandonment is excluded
  from the restore (a different report owns the state then).
- **`flush()` now reflects the real latest outcome:** it awaits the in-flight
  chain, and if a dirty edit remains (newer edit, or a failure that restored
  dirty) it **re-runs `scheduleSave` and rejects on failure** rather than
  returning a stale report.
- **Old-generation queue guard:** `savePass` checks `gen !== genRef.current`
  **before** reading `latestRef` and again **after** the `saveReport` await, and
  the chain loop re-checks each iteration — so a queued saver from a previous
  report id can never read or persist the new report's state.
- **reload/setReport clobber guard:** both now bail when `hasPendingWork()`
  (dirty **OR** an in-flight/queued save), not just when `dirtyRef` is set, so an
  in-flight save result can't be overwritten by a reload.

### `app/report/[id]/generate.tsx`
- **Comprehensive `inputsEqual`:** now compares all AI-input snapshot fields —
  `rawText`, `observationTime`, `timezone`, `incidentLocationText`,
  `includeObserverLocation`, `observerLocation` (lat/lon/accuracy/timestamp), and
  attachments (`id` + `hash` + `analysisUri`). The old three-field check let
  stale photo/GPS/timezone suggestions persist because the repository saves
  against current inputs. Stale-input error message broadened accordingly.
- **StrictMode effect fix:** removed the persistent `startedRef` that left a
  remounted screen stuck on "preparing" (first mount's cleanup ran, second setup
  returned early forever). The start effect now starts a fresh run each mount and
  its cleanup bumps the run token to abandon that run; the run-token guard still
  prevents any double-save/navigate.

### `app/report/[id]/review.tsx`
- **Native Back/swipe guard (BLK-01/BLK-03):** added
  `usePreventRemove(isDirty || saving || failed, …)` + `useNavigation().dispatch`
  that awaits `flush()` and only lets the removal through on success; on failure
  it stays and shows `navError`. In-screen `goBack`/`goShare` also set the
  allow-leave flag and catch flush rejections.
- **Acceptance derived from saved text (DEF-02):** removed the ephemeral
  `accepted` useState (which reset on remount and appended duplicates). Each
  observation's accepted state is now derived from whether its exact line is
  already present in `reviewedText`, and `acceptObservation` is idempotent
  (no-op if the line already exists).

### `app/report/[id]/photos.tsx` (DEF-01)
- A `null` from `addPhoto` (user cancelled the camera/picker) is now a **silent
  no-op** — no reload, no error banner. Genuine cloud-only/unreadable photos
  still throw inside the service and surface via the catch.

### `app/(tabs)/index.tsx` and `app/report/[id]/index.tsx` (DEF-03)
- Removed the internal `· rev N` from the citizen-facing status pill; now just
  "Tersimpan lokal".

## Navigation flush-rejection coverage
`edit.tsx`, `location.tsx`, and now `review.tsx` all guard native Back/swipe via
`usePreventRemove` and catch flush rejections; their in-screen handlers
(`goBack`/`goPhotos`/`goLocation`/`goTime`/`runAI`/`continueManual`/`goShare`)
are wrapped so a rejected flush stays on-screen with an error. `generate.tsx`
and `share.tsx` do not autosave editable fields, so they need no flush guard.

## Verification
- `npx tsc --noEmit` → exit 0, zero errors. No tests/prebuild/installs run; no
  package/config/native files touched.

## Gaps / notes (honest)
- Behavior is verified by typecheck + static reasoning only (per user: no
  tests/device). The autosave race fixes and `usePreventRemove` guards are not
  exercised at runtime here.
- AGY's "Terima Ringkasan" quick-action suggestion (adopt full summary) was NOT
  added — it is an enhancement, not a listed blocker, and out of this fix scope.
- Core vs UI invalidation alignment: core also invalidates on `timezone`/
  `observerLocation`; the UI `inputsEqual` now covers both, so the two agree.


---

# Final UI Source Review (no changes) — against Bara-PRD.md + Bara-UI-Spec.md

Dispatch `task_979183039ebf`. Date: 28 October 2026. Scope: review-only pass over
the UI I own (`app/**`, `src/ui/**`, `src/App.tsx`) against the two baselines.
**No source was changed** this dispatch — no concrete remaining UI blocker was
found, and the task forbids speculative redesign/scope expansion. The Android
build in progress is therefore undisturbed. Not runtime-validated (no
tests/device per user); `npx tsc --noEmit` → exit 0.

## Source coverage (all UI files reviewed)

- `src/ui/`: `theme.ts`, `components.tsx`, `format.ts`, `services.ts`,
  `FlowHeader.tsx`, `useReportEditor.ts`.
- `app/`: `_layout.tsx`, `(tabs)/_layout.tsx`, `(tabs)/index.tsx`,
  `(tabs)/channels.tsx`, `(tabs)/readiness.tsx`, `report/_layout.tsx`,
  `report/[id]/{index,edit,photos,location,generate,review,share}.tsx`.

## Spec conformance confirmed (no blocker)

- **Navigation:** 3 destinations — Laporan (home + "Buat laporan" CTA), Kanal
  bantuan, Kesiapan offline. Report flow is a native stack; help reachable from
  the tab bar without waiting on AI.
- **Microcopy present and matching spec intent:** AI-not-ready ("AI belum siap
  offline…"), GPS-denied ("Anda bisa menulis lokasi atau patokan secara
  manual."), save-fail ("Belum tersimpan. Ruang perangkat mungkin tidak
  cukup."), 112 unconfirmed ("…belum terkonfirmasi"), share-sheet honesty
  ("Pilihan berbagi telah dibuka. Bara belum mengetahui apakah laporan
  diterima."), delete-draft confirmation ("Hapus draf dan salinan fotonya… Foto
  asli di galeri tetap ada."), detail share activity ("…penerimaan belum
  diketahui.").
- **Reporter vs incident location** kept as two groups; incident never
  auto-filled from observer GPS; accuracy shown only when known; explicit
  timezone editable; manual entry always available.
- **AI screen:** honest elapsed timer (no fake %), cancel + "Lanjut isi sendiri"
  always present and more prominent after 30 s.
- **Review:** editable summary; per-observation provenance + uncertainty labels;
  accept-per-section (idempotent, derived from saved text); ≤3 questions; export
  selection for photos + precise location.
- **Readiness:** per-model status/size/required-free-space/last-local-check;
  download shows size first; cancel only (no fake pause — contract has none);
  import; local check; delete decoupled from drafts.
- **Prior fix rounds verified still in place:** failed-save dirty restoration +
  flush rejection, reload/setReport guard on any pending save, old-generation
  queue guard, full AI-input snapshot `inputsEqual`, StrictMode-safe generate
  effect, native Back/swipe `usePreventRemove` on edit/location/review,
  photo-cancel no-op, no exposed internal revision number.
- **Design/a11y:** 48dp touch targets, accessible labels, system-scaled type,
  dark/light via `useColorScheme`, status always carried by text (not color
  alone), no decorative fire, no fabricated offline/readiness badges.

## Actual remaining gaps (non-blocking; intentionally not changed)

1. **Enhancement, not a blocker:** no "Terima ringkasan" one-tap action to adopt
   `suggestion.summary` into `reviewedText` (AGY's DEF — optional). Left out to
   avoid scope expansion.
2. **Cloud-only photo copy:** a genuine cloud-only/unreadable pick surfaces the
   core's raw Indonesian error via the catch (accurate) rather than the spec's
   softer sentence. Cosmetic; surfacing is correct and honest.
3. **Deep-link `?focus=time`** on the location screen is accepted but the field
   is not auto-focused; the time field is at the top, so it is reachable. Minor.
4. **Runtime/visual/device validation** (contrast on-device, keyboard behavior,
   TalkBack/VoiceOver order, 200% text, rotation, large place names) remains
   unperformed per the no-tests/no-device constraint — not claimed.

## Whether source changed
No. No UI files were modified in this dispatch; only this report was updated. No
rebuild trigger needed.
