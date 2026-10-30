# Kiro — Final Readiness Report (task_14e6cc63bfff)

## Signing-helper hardening (SELESAI)

- `Set-PrivateAcl` diperbaiki dari FAIL-OPEN (Write-Warning) ke FAIL-CLOSED:
  kini throw + memverifikasi bahwa HANYA {current user, SYSTEM, Administrators}
  punya akses, sebelum rahasia ditulis.
- `Write-RestoredSecrets` diekstrak sebagai fungsi bersama: dipakai oleh `Mode
  Restore` DAN DryRun test, sehingga test menangkap regresi jalur produksi.
- Rollback pada kegagalan file kedua: hanya file yang dibuat operasi ini yang
  di-rollback; file preexisting tidak tersentuh.

**DryRun 10/10 lulus** (kunci asli tidak disentuh, tanpa passphrase diciptakan):
roundtrip, wrongPass, tamper(MAC), truncated, badIterHeader, noOverwrite,
aclFailClosed, restoreSharedPath, restoreAclOnlyAllowedSids, writeFailRollback.
Evidence: `work/reports/non-ai-qa/signing-dryrun.md`.

**Real backup: PENDING** — menunggu passphrase + destinasi privat dari user.
Instruksi interaktif aman: jalankan
`scripts/Backup-NiragniSigning.ps1 -Mode Backup -OutFile <path-di-luar-repo>`,
passphrase akan diprompt dua kali (tidak pernah di parameter/log), simpan di
pengelola kata sandi.

## Build release (SELESAI)

- Rebuilt dari source terkini (termasuk Pressable fix + StatusPill contrast fix).
- `artifacts/niragni-android.apk` — 240,277,137 byte, built 12:15.
- SHA-256: `C1DFE0C1367022A3560DB08DB7067629BC7314B70E27BCD4FC9C2C746A415F67`
- Signer: `CN=Niragni`, cert SHA-256 `6cb72d16...adf64324` (release, cocok).
- Package: `com.niragni.bara`, versionName 1.0.0, minSdk 31, targetSdk 36, arm64.
- **Catatan:** build dijalankan sebelum pesan koordinator soal checkpoint AGY tiba.
  Perlu dikonfirmasi: apakah AGY sudah selesai ubah core/channels+directory sejak
  itu? Kalau ada perubahan, rebuild diperlukan.

## Device QA — Xiaomi 14T (Android 16 SDK 36, arm64) via wireless ADB (SEBAGIAN)

Install: `adb install -r` sukses, data dipertahankan.

| Skenario | Hasil | Screenshot |
|---|---|---|
| Home render — tombol "Buat laporan" background+padding | **LULUS** | `01-home.png` |
| Buat laporan + autosave (pill "Tersimpan di perangkat") | **LULUS** | `02-edit.png` |
| Ketik catatan QA + counter | **LULUS** | `03-note-typed.png` |
| Persistensi: force-stop → relaunch → draf bertahan | **LULUS** | `04-after-relaunch.png` |
| Detail draf | **LULUS** | `05-detail.png` |
| Hapus draf + konfirmasi dialog + kembali ke empty state | **LULUS** | `07-after-delete.png` |
| Tab Kanal bantuan (data asli, tanggal terlihat, kontras StatusPill) | **LULUS** | `08-channels.png` |
| Tab Kesiapan offline (status model jujur, ukuran 520 MB, pill kontras) | **LULUS** | `09-readiness.png` |
| **Foto add/remove + EXIF export** | **BELUM** — diserahkan koordinator |
| **Izin ditolak + pulih** | **BELUM** — diserahkan koordinator |
| **Share launch/cancel** | **BELUM** — diserahkan koordinator |
| Dialer "Buka dialer" | Tidak diuji (dilarang menelepon instansi nyata) |
| AI/inferensi | Tidak diuji (di luar scope non-AI) |

Screenshot ada di `work/reports/non-ai-qa/`.

## Catatan untuk koordinator

- **Device masih tersambung** wireless ADB (`192.168.1.38:40747`, serial
  `858PQWINIRGMYXKR`) saat laporan ini ditulis.
- User meminta agar sisa QA (foto, izin, share) diserahkan ke koordinator.
- Untuk foto EXIF: butuh push foto sintetis ber-EXIF GPS ke galeri, tambah ke
  draf via picker, export/share, verifikasi EXIF hilang di hasil export
  (core/export.ts manipulateAsync + JPEG re-encode).
- Untuk izin: `adb shell pm revoke/grant com.niragni.bara android.permission.XXX`
  (reversibel), lalu buka layar terkait, cek pesan gagal tepat, pulihkan.
- Untuk share: tap "Bagikan lagi" → layar Share → "Buka pilihan berbagi" → share
  sheet OS terbuka → tutup (back) tanpa kirim → cek aktivitas-berbagi tercatat.

## File yang diubah dispatch ini

- `scripts/Backup-NiragniSigning.ps1`
- `work/reports/non-ai-qa/signing-dryrun.md` (evidence)
- `work/reports/non-ai-qa/device-and-build.md`
- `work/reports/non-ai-qa/build-log.txt`
- `work/reports/non-ai-qa/01-home.png` … `09-readiness.png`
- `artifacts/niragni-android.apk` + `.sha256`
- `work/reports/kiro-final-readiness.md` (ini)
