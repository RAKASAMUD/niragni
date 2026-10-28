# Kiro — Niragni release integration report

Owner: Kiro. Dispatch `task_03f3948fd1b9`. Date: 28–29 October 2026 (Asia/Jakarta).
Repo: `https://github.com/RAKASAMUD/niragni` (PUBLIC, unchanged). Sole Git operator.

## Done

### 1. UI polish (committed + pushed)
Commit `29c310f` on `spike/qvac` (fast-forwarded to origin; the original 20
commits preserved as ancestors):
- **Summary-accept action** (review.tsx): "Terima ringkasan ke draf" appends the
  AI summary into `reviewedText` idempotently — it only appends, never silently
  overwrites manual edits, and is a no-op if already present. Per-observation
  acceptance (also idempotent, derived from saved text) is unchanged.
- **Friendly cloud-only photo error** (photos.tsx): the cloud-only/unreadable
  case now shows "Foto ini belum tersedia di perangkat. Pilih foto lokal atau
  coba saat terhubung."; other errors keep their diagnostic text.
- **Real `focus=time` routing** (location.tsx + Field `autoFocus` in
  components.tsx): the `?focus=time` route param now auto-focuses the
  observation-time field.
- Autosave/back guards (`usePreventRemove`, serialized flush) and provenance
  labels preserved. `tsc --noEmit` → exit 0.

### 2. main integration (merged + pushed)
- Ordinary `--no-ff --allow-unrelated-histories` merge of `main` (initial commit
  `ef0df8f`, README stub) and `spike/qvac` (tip `29c310f`). README conflict
  resolved by keeping the full Niragni README (supersedes the stub).
- Merge commit `6073447` has both parents; both root histories preserved, no
  force/rewrite. Pushed `ef0df8f..6073447 main -> main`.
- **No `.github/workflows` on either branch → no deploy-on-push risk** (verified
  before pushing). No visibility/default-branch/protection changes.

### 3. Release signing setup (keystore generated; build config committed + pushed)
Commit `87848c3` on `main`:
- New private **release keystore** generated with `keytool` (JBR 21):
  - Location (OUTSIDE repo, ACL-restricted to current user + SYSTEM):
    `%USERPROFILE%\.niragni\signing\niragni-release.jks` (+ DPAPI blob
    `niragni-release.store.dpapi`).
  - Alias `niragni`; self-signed `CN=Niragni` (no invented personal identity);
    RSA 4096, SHA384withRSA; validity 2026-10-29 → 2054-03-16 (~10000 days).
  - **New cert SHA-256 (public, safe): `6C:B7:2D:16:E7:2B:2F:E4:93:7E:17:E6:CE:46:B8:B1:91:A8:F2:30:DF:26:D7:45:4C:7B:D5:E4:AD:F6:43:24`** — DIFFERS from the prior AndroidDebug cert `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (as required).
  - SHA-1: `FD:5E:A6:E4:DE:56:01:2E:02:57:50:BB:16:89:F6:FA:6C:CC:AC:54`.
  - Store/key password: cryptographically random (32 bytes), encrypted at rest
    with **Windows DPAPI CurrentUser**. Never printed, logged, committed, or
    placed on any command line.
- `Build-Niragni.ps1` now does **fail-closed release signing**: reads the DPAPI
  password at build time, passes it to Gradle only via a process-scoped env var
  (`-Pandroid.injected.signing.*`, no argv/logs, cleared after, `--no-daemon`).
  If the keystore or DPAPI password is missing/undecryptable the build ABORTS —
  it never silently debug-signs a release. An explicit `-AllowDebugSigning`
  switch remains for clearly-labeled debug builds only.
- `.gitignore` hardened to exclude `*.jks/*.keystore/*.p12/*.pfx/*.dpapi`.

#### Security caveats (recorded, not acted on)
- The DPAPI-encrypted password is tied to THIS Windows user account/profile;
  recovery on another PC/account is NOT possible from this blob. **No backup or
  export has been performed** and none is claimed. User-local safe backup
  guidance: copy the whole `%USERPROFILE%\.niragni\signing` folder to an
  encrypted user-controlled medium; note the DPAPI blob only decrypts on this
  same Windows profile, so keep the plaintext password in the user's own
  password manager if cross-machine recovery is ever needed (not done here, no
  cloud/GitHub secret setup in this task).
- The historical debug APK `artifacts/bara-android.apk` (+ `.sha256`) is
  preserved. A release-signed Niragni APK will have a DIFFERENT signature, so a
  device with the debug build installed would need manual migration — **no
  install/uninstall was performed**.

## Pending (blocked on handover / deferred by coordinator)

- **Final branded Niragni APK build is intentionally DEFERRED** (coordinator:
  do ONE final build after the AGY channel-directory handover + signing are in,
  to avoid a duplicated ~18-min build). Signing is now ready; the single final
  build + APK verification (label "Niragni", package `com.niragni.bara`,
  minSdk 31, ARM64, APK SHA-256, release signature fingerprint == the new cert
  above, backup disabled) is the remaining step once AGY data is integrated.
- **AGY regional channel data** (`docs/channel-directory/**`): not yet handed
  over; I will integrate only the verified dataset after the coordinator hands
  it over, leaving unverified regions explicitly unconfirmed. No contact/calls.
- **iOS**: remains a target; Windows has no native Xcode/signing. I will consume
  the AGY iOS-build handoff and will NOT claim any iOS binary.

## Remote state (verified)
- `main` = `87848c3` (local == remote).
- `spike/qvac` = `29c310f` (local == remote; original 20 import commits intact as ancestors).
- No force/overwrite/rewrite; visibility PUBLIC unchanged; no workflows/releases/deploys.

## Evidence / limits
- `tsc --noEmit` exit 0 after UI polish; `Build-Niragni.ps1` parses with 0
  syntax errors. No test suites / device / emulator / browser validation were
  run (deferred by user); no test pass is claimed. No native build was run this
  dispatch (deferred). No secrets read/printed/committed.
