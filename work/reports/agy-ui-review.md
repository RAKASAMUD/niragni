# AGY Static Review: Kiro Bara UI & Core Interface Integration

- **Reviewer**: AGY (Antigravity) — Dispatched Worker
- **Task ID**: `task_87b7b92a012a`
- **Dispatch ID**: `ctx_ff5d203687e1`
- **Terminal**: `term_1db3f111-cf54-4549-959e-fae969be1152`
- **Date**: 28 October 2026 (Asia/Jakarta)
- **Target Files**: `apps/qvac-spike/app/**`, `apps/qvac-spike/src/ui/**`
- **Reference Specs**: `Bara-UI-Spec.md`, `apps/qvac-spike/src/product-contract.ts`
- **Scope & Ownership**: Owns strictly `work/reports/agy-ui-review.md`. Zero modifications made to source code, zero builds/installs, and no inferred runtime successes per task constraints.

---

## 1. Executive Summary

Kiro has implemented a clean, disciplined, and strictly typed React Native / Expo UI for Bara that adheres closely to the visual principles of `Bara-UI-Spec.md` (quiet, high-contrast, zero gamification, zero fake decorative elements). The UI connects directly to AGY's local core via the frozen `ProductServices` contract exported at `apps/qvac-spike/src/ui/services.ts`. Static type verification (`npm --prefix apps/qvac-spike run typecheck`) passes with **exit code 0 and zero TypeScript errors** across all UI and core modules.

However, deep static review reveals critical data-loss vulnerabilities in state management and lifecycle hooks:
1. In `useReportEditor.ts`, `dirtyRef.current` is cleared before `await savePass`; on write failure, `dirtyRef.current` is not restored, `saveChainRef.current` resets to `null`, and subsequent calls to `flush()` resolve with unsaved memory state, completely bypassing navigation backguards and causing silent data loss.
2. In `useReportEditor.ts`, `reload()` and `setReport()` only check `dirtyRef`, ignoring active in-flight saves in `saveChainRef`, allowing focus reloads to clobber unsaved fields.
3. In `review.tsx`, native navigation backguards (`usePreventRemove`) are entirely missing, leaving Android Back and iOS swipe gestures unprotected.
4. In `generate.tsx`, `inputsEqual` checks only 3 fields, ignoring photo attachments, timezone, and GPS coordinates, allowing stale AI suggestions to overwrite user changes.
5. In `photos.tsx`, picker cancellation returning `null` is falsely surfaced as an un-synced cloud storage error.

---

## 2. Review Against Verification Areas

### 2.1 Autosave Failure Propagation & Backguard (Data Loss Analysis)

#### 2.1.1 The `dirtyRef` Clear-Before-Save & `flush()` Bypass (`src/ui/useReportEditor.ts`, lines 128–154, 180–190)
- **Mechanism**:
  In `useReportEditor.ts`, `scheduleSave.run` executes the save loop:
  ```typescript
  while (true) {
    dirtyRef.current = false;
    result = await savePass(gen);
    if (!dirtyRef.current) break;
  }
  ```
  `dirtyRef.current` is set to `false` *before* `await savePass(gen)`. If `savePass` rejects (e.g. disk full, SQLite lock contention, or CAS mismatch):
  - Execution jumps to the error rejection handler (lines 147–154).
  - The error handler sets `setSaveState('failed')` and `setErrorMessage(e.message)`, but **never restores `dirtyRef.current = true`**.
  - `saveChainRef.current` is cleared to `null` on rejection (`if (saveChainRef.current === next) saveChainRef.current = null;`).
  - When the citizen or backguard subsequently calls `flush()`:
    ```typescript
    const chain = saveChainRef.current ?? (dirtyRef.current ? scheduleSave(gen) : null);
    if (chain) {
      return chain; // rejects if final save failed
    }
    const r = latestRef.current;
    return r; // RESOLVES WITH UNSAVED REPORT!
    ```
    Since `saveChainRef.current` is `null` and `dirtyRef.current` is `false`, `chain` evaluates to `null`. `flush()` immediately returns `latestRef.current` without error.
- **Data Loss Consequence**:
  In `edit.tsx` and `location.tsx`, the native backguard invokes:
  ```typescript
  try {
    await flush();
    allowLeaveRef.current = true;
    navigation.dispatch(data.action);
  } catch (e) { ... }
  ```
  Because `flush()` falsely resolves, `allowLeaveRef.current` is marked `true`, the screen pops, and the failed edits in memory are permanently discarded without ever persisting to SQLite.

#### 2.1.2 Concurrent Reload / Focus Clobbering (`src/ui/useReportEditor.ts`, lines 171–178, 192–199)
- **Mechanism**:
  `reload()` and `setReport()` guard against clobbering dirty state using `if (dirtyRef.current) return;`.
  However, while a save is in flight (`savePass` awaiting `services.saveReport`), `dirtyRef.current` is already `false`. If a screen focus event or external trigger calls `reload()` during this in-flight window, `services.getReport()` returns the *pre-save* stored state from SQLite and overwrites `latestRef.current` and local React state.
- **Required Fix**: Both `reload()` and `setReport()` must check `if (dirtyRef.current || saveChainRef.current !== null) return;`.

#### 2.1.3 Missing Native Backguard in Review Screen (`app/report/[id]/review.tsx`)
- **Mechanism**:
  While `edit.tsx` and `location.tsx` implement `usePreventRemove` to guard hardware Back and swipe navigation, `review.tsx` only binds `flush()` to its internal `FlowHeader.onBack` button (`goBack()` at line 41) and "Pilih kanal" button (`goShare()` at line 35).
  Native hardware Back on Android or edge-swipe gestures on iOS do not trigger `goBack()`. If a user edits `reviewedText` (lines 86–92) and gestures back while edits are dirty or saving, the navigation stack pops immediately, bypassing autosave and causing uncommitted text loss.

---

### 2.2 AI Generation, Cancellation, & Stale Result Handling

#### 2.2.1 Incomplete Fingerprint in `inputsEqual` (`app/report/[id]/generate.tsx`, lines 29–33)
- **Mechanism**:
  `generate.tsx` defines:
  ```typescript
  function inputsEqual(a: Report, b: Report): boolean {
    return a.rawText === b.rawText
      && a.observationTime === b.observationTime
      && a.incidentLocationText === b.incidentLocationText;
  }
  ```
  This check ignores:
  - `attachments` (count, IDs, and image hashes)
  - `timezone`
  - `observerLocation` (latitude, longitude, accuracy)
- **Consequence**:
  If a user modifies photos, adjusts timezone, or acquires precise GPS while AI generation is underway, `inputsEqual` returns `true` upon AI completion. The screen proceeds to save the AI suggestion against a report whose input context has shifted.
  Furthermore, because `saveReport` in core compares current report fields to determine if `suggestion` should be invalidated, saving the suggestion with the newly updated photos makes core believe the suggestion belongs to the new inputs. Core cannot detect that the suggestion was generated against an older snapshot.
- **Required Fix**: `inputsEqual` must compute a full input fingerprint matching core's `aiInputsEqual` (checking `rawText`, `observationTime`, `timezone`, `incidentLocationText`, `observerLocation`, and sorted attachment IDs/hashes) or strictly verify `suggestion.inputRevision === currentReport.revision`.

#### 2.2.2 Cancellation & Liveness Handling
- `generate.tsx` properly utilizes an unmount cleanup hook to call `services.cancelGeneration()` (lines 62–67).
- Uses `runRef.current` as an incrementing run token (lines 45, 96, 126), successfully dropping stale async callbacks from superseded runs.
- Features an honest elapsed time counter without fabricating simulated completion percentages. Transitions "Lanjut isi sendiri" to primary after 30 seconds.

---

### 2.3 Photo Selection Persistence & UX

#### 2.3.1 Cancellation Treated as Error (`app/report/[id]/photos.tsx`, lines 52–54)
- **Mechanism**:
  ```typescript
  const att = await services.addPhoto(id, source);
  await load();
  if (!att) {
    setError('Foto ini belum tersedia di perangkat. Pilih foto lokal atau coba saat terhubung.');
  }
  ```
  Per `product-contract.ts`: `addPhoto(reportId, source): Promise<Attachment | null>` explicitly returns `null` when the citizen cancels the camera or image picker.
  Kiro's UI wrongly assumes `att === null` represents a cloud/network file resolution failure and surfaces a red error notice.
- **Required Fix**: If `att === null`, return cleanly without setting error state.

#### 2.3.2 Selection Persistence
- `photos.tsx` correctly invokes `services.saveReport` when toggling `selectedForShare` (lines 92–104), ensuring the flag is durably persisted in SQLite.
- Previews thumbnail images with accessible labels and enforces the 3-photo ceiling.

---

### 2.4 Review Per-Section Acceptance & Provenance Labels

#### 2.4.1 Ephemeral Acceptance State (`app/report/[id]/review.tsx`, line 32)
- **Mechanism**:
  ```typescript
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  ```
  Observation acceptance is stored strictly in component state. Navigating forward to `share.tsx` and returning to `review.tsx` remounts the component, wiping `accepted` back to `{}`.
  Accepted observations lose their `Diterima` badge and present an active "Terima bagian ini" button again. Tapping it appends duplicate bullet points into `reviewedText`.
- **Required Fix**: Derive acceptance deterministically (e.g. checking whether `obs.text` is already contained in `reviewedText`) or persist accepted IDs.

#### 2.4.2 Humility & Provenance
- Correctly formats provenance tags: `Dari Anda`, `Dari metadata`, `Interpretasi foto (AI)` (lines 19–26).
- Flags uncertain AI observations with `Belum pasti` (line 143).
- Strictly limits questions to `(suggestion?.questions ?? []).slice(0, 3)` (line 74).

---

### 2.5 Export Preview & Sharing Channels

- `app/report/[id]/share.tsx`:
  - Accurately renders `preview.text`, photo thumbnails, and GPS inclusion flag from `services.previewExport(r)`.
  - Distinguishes public vs unconfirmed emergency directory channels with verification dates.
  - Dialer launches via device `tel:` handler without false automated transmission claims.
  - Explicit disclaimer: *"Pilihan berbagi telah dibuka. Bara belum mengetahui apakah laporan diterima."*

---

### 2.6 Offline Model Readiness & Deletion Lifecycle

- `app/(tabs)/readiness.tsx`:
  - Independent from draft authoring; drafts are never blocked by missing models.
  - Transparent sizing: Displays `totalBytes` and `requiredBytes` before download confirmation.
  - Explicit cancellation: Direct invocation of `services.cancelModelDownload()`.
  - Independent model deletion: Clarifies that deleting models leaves citizen drafts intact.
  - Real local verification: Only sets `ready` upon successful execution of `services.checkModel()`.

---

### 2.7 Native Navigation, Design System, & Accessibility

- `src/ui/theme.ts` & `src/ui/components.tsx`:
  - Interactive controls strictly enforce `>= 48dp` touch targets (`MIN_TOUCH = 48`).
  - Semantic headings (`accessibilityRole="header"`) and button roles.
  - Dynamic type: No `allowFontScaling={false}` overrides.
  - High-contrast tokens for both Light and Dark color schemes conforming to WCAG standards.
  - Minor polish item: `app/(tabs)/index.tsx` exposes database revision in UI (`Tersimpan lokal · rev ${item.revision}`).

---

## 3. Concrete Blockers & Defects Table

| ID | Location | Severity | Defect / Blocker Description | Recommended Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | `src/ui/useReportEditor.ts` L128–154, L180–190 | **Critical (Silent Data Loss)** | `dirtyRef.current = false` set before `savePass`. On rejection, `dirtyRef` is not restored to `true` and `saveChainRef` resets to `null`. Subsequent `flush()` calls see `dirtyRef === false` and resolve with unsaved memory state, tricking navigation backguards into popping and discarding unsaved data. | Restore `dirtyRef.current = true` in rejection handler; ensure `flush()` rejects if the last save attempt failed. |
| **BLK-02** | `src/ui/useReportEditor.ts` L171–178, L192–199 | **High (State Clobbering)** | `reload()` and `setReport()` only check `dirtyRef`, ignoring active in-flight saves (`saveChainRef !== null`). Focus reloads during an in-flight save clobber local memory with older SQLite data. | Guard with `if (dirtyRef.current \|\| saveChainRef.current !== null) return;`. |
| **BLK-03** | `app/report/[id]/review.tsx` L31–45 | **High (Data Loss)** | Missing `usePreventRemove` native navigation backguard. Hardware Back and iOS edge-swipes bypass `flush()`, dropping unpersisted edits in `reviewedText`. | Attach `usePreventRemove(isDirty \|\| saveState === 'saving', ...)` matching `edit.tsx` and `location.tsx`. |
| **BLK-04** | `app/report/[id]/generate.tsx` L29–33 | **High (Stale Overwrite)** | `inputsEqual` checks only `rawText`, `observationTime`, and `incidentLocationText`. Missing `attachments` (photos), `timezone`, and `observerLocation`. Allows AI suggestions to overwrite mutated inputs without detection by core. | Compare full input fingerprint (photos, GPS, timezone, text) or strictly check `suggestion.inputRevision === current.revision`. |
| **DEF-01** | `app/report/[id]/photos.tsx` L52–54 | **Medium (UX Defect)** | `services.addPhoto` returning `null` on user picker cancellation is treated as an un-synced cloud storage error, showing a red error banner. | If `!att`, quietly return without setting error state. |
| **DEF-02** | `app/report/[id]/review.tsx` L32, L56–63 | **Medium (UX Defect)** | Per-observation `accepted` state is stored in ephemeral component `useState`, resetting on screen unmount/remount and enabling duplicate text appends. | Derive acceptance by inspecting `reviewedText` content or persisting accepted observation IDs. |
| **DEF-03** | `app/(tabs)/index.tsx` L70 | **Low (UX Polish)** | Citizen draft list exposes internal SQLite revision number: `Tersimpan lokal · rev ${item.revision}`. | Simplify status pill to `Tersimpan lokal`. |

---

## 4. Contract Adherence & Static Verification

- **TypeScript Compiler Check**:
  - Command: `npm --prefix apps/qvac-spike run typecheck` (`tsc --noEmit`)
  - Status: **Exit Code 0, zero errors**
  - Contract: 100% type compatibility between AGY's `ProductServices` in `src/core/index.ts` and Kiro's `src/ui/services.ts`.

---

## 5. Ownership & Next Actions

- **Review Boundary**: AGY made zero edits to `app/**`, `src/ui/**`, or `src/core/**`. All findings are documented with original source evidence.
- **In-Flight Remediation Note**: The coordinator has dispatched a scoped fix task to Kiro addressing the identified blockers: save failure dirty flag restoration, in-flight reload guarding, old-generation queued save guards, full AI input fingerprinting, and StrictMode effect cancellation.
- **Verification Qualification**: The typecheck verification (`tsc --noEmit`) serves as static compile and contract alignment evidence, not native build or runtime proof (which remains deferred per project plan).
- **Handoff**: Report is durably recorded at `work/reports/agy-ui-review.md`. AGY's review task is complete; AGY awaits the coordinator's next assignment for scoped core lifecycle fixes.
