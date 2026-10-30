# Niragni

Niragni (sebelumnya nama kerja "Bara") membantu warga Indonesia menyiapkan draf laporan dugaan kebakaran hutan dan lahan (karhutla) dari catatan teks dan foto — disusun dengan AI yang berjalan **sepenuhnya di perangkat** (QVAC lokal, tanpa backend/cloud). Aplikasi ini adalah alat bantu menyiapkan laporan, bukan layanan dispatch, dan tidak pernah menganggap "berhasil membuka kanal berbagi" sebagai bukti laporan diterima petugas.

> 🏆 Dibangun untuk hackathon QVAC/AI Yako (28–30 Oktober 2026). Lihat [`docs/SUBMISSION.md`](docs/SUBMISSION.md) untuk info submission lengkap (problem statement, track, integrasi QVAC, lisensi model, batas offline, dll).

## Masalah & target pengguna

Warga yang melihat dugaan kebakaran hutan/lahan sering kesulitan menjelaskan apa yang dilihat, di mana, dan kapan — terutama saat internet buruk/tidak ada. Niragni memisahkan "menyiapkan laporan" dari "menyampaikan laporan": pengguna mencatat teks + foto + lokasi secara lokal, AI (QVAC, offline) membantu merapikan draf terstruktur dalam Bahasa Indonesia, pengguna meninjau dan mengoreksi, baru memilih kanal (Damkar lokal, dll) untuk diteruskan — semua tahap pertama berjalan tanpa jaringan. Lihat [`.context/baca-bara-codex-handoff-json-sebagai/outputs/Bara-PRD.md`](.context/baca-bara-codex-handoff-json-sebagai/outputs/Bara-PRD.md) untuk PRD lengkap (baseline awal, dipertahankan sebagai riwayat).

## Status implementasi

Implementasi produk berada di `apps/qvac-spike` (nama direktori awal dipertahankan sebagai riwayat). Tersedia alur: draf teks+foto tanpa login/model/jaringan, lokasi pelapor vs lokasi kejadian terpisah, AI lokal (QVAC) menyusun draf dengan validasi provenance ketat, editor final dengan penanda sumber AI, pratinjau ekspor dengan swafoto pengirim wajib, direktori 9 kanal Damkar kota terverifikasi, dan pengelolaan model (unduh/impor/periksa) dengan verifikasi hash. Tidak memerlukan backend atau akun; semua data di SQLite + file privat aplikasi.

Nama tampilan aplikasi adalah **Niragni**; bundle/application ID tetap `com.niragni.bara` (kontinuitas data dari nama kerja sebelumnya, "Bara"). minSdkVersion 31, targetSdkVersion 36, arsitektur `arm64-v8a` murni.

**Riwayat build & pengujian device** (kronologis, lihat [`docs/implementation-status.md`](docs/implementation-status.md) untuk detail penuh):
1. Build release pertama (29 Okt) — 243 MB, dipasang & dibuka di Xiaomi 14T via wireless ADB.
2. Pengujian fungsional di Xiaomi 14T (30 Okt) menemukan 4 bug: impor model SAF gagal, status progress macet setelah error impor, waktu tidak divalidasi, label zona waktu pratinjau menyesatkan. Keempatnya diperbaiki di source hari yang sama.
3. Build APK pengganti dengan kompresi native (30 Okt) — 86,37 MB (turun 64,5%), **belum diinstall/ditest ulang di HP**.
4. Sesi Claude Code (30 Okt) menjalankan `/ponytail-review` + `/ponytail-audit` dan memperbaiki 9 temuan tambahan — lihat bagian "Apa yang dikerjakan selama event" di bawah.

⚠️ **Status paling jujur saat ini**: source sudah mencakup semua perbaikan di atas dan lolos `tsc --noEmit` + 250/250 test Jest, tapi **inference AI offline (jaringan dimatikan) belum pernah berhasil dibuktikan di perangkat fisik** — ini sedang dikerjakan sebagai langkah terakhir sebelum deadline. Lihat `docs/SUBMISSION.md` untuk status real-time.

## Apa yang dikerjakan selama event (28–30 Oktober 2026)

Seluruh isi repo ini dibangun selama event (commit pertama 28 Okt 21:39 WIB). Pembangunan dilakukan oleh kombinasi:
- **Sistem multi-agent (coordinator + worker "Kiro" dan "AGY")**: scaffold Expo/React Native, seluruh UI (`app/**`, `src/ui/**`), seluruh core logic (`src/core/**`, worker QVAC, manifest model), desain UI/tema sesuai Figma, direktori kanal Damkar, build & signing Android, serta 4 perbaikan bug device-QA pertama (impor SAF, status progress, validasi waktu, format zona waktu).
- **Claude Code (sesi terakhir, 30 Okt)**: audit independen (`/ponytail-review` + `/ponytail-audit`) menemukan dan memperbaiki 9 bug/kebersihan kode tambahan:
  - Bug path selfie (double-slash) yang membuat **setiap** percobaan berbagi gagal — `src/core/repository.ts`
  - File sementara hasil crop foto/selfie yang tidak terhapus — `src/core/export.ts`
  - Direktori kanal yang di-duplikasi manual di tempat lain (risiko drift) — `src/core/channel-selector.ts`
  - UI notice ganda & logic duplikat di halaman share — `app/report/[id]/share.tsx`
  - Background transition OS yang keliru membatalkan unduhan model yang sedang berjalan — `src/core/lifecycle.ts`
  - Waktu UTC mentah yang bocor ke prompt AI dan teks ekspor GPS — `src/core/timeValidation.ts`, `src/core/ai.ts`, `src/core/export.ts`
  - Hash model yang di-verifikasi ulang dari nol setiap restart app — `src/core/database.ts` (migrasi skema v3), `src/core/models.ts`
  - Kode mati (file/fungsi tak terpakai) dan 4 dependency native yang tidak pernah diimpor
  - Fallback tanggal hardcode yang akan menampilkan tanggal yang salah selamanya — `src/ui/format.ts`

Disclosure pihak ketiga: QVAC SDK (`@qvac/sdk`, Apache-2.0), model bobot (SmolVLM2-500M & VisionPsy-Nano-460M, Apache-2.0, dari HuggingFace — **tidak dibundel di repo**, diunduh terpisah), Expo/React Native ecosystem, dan dependency npm lain (lihat `apps/qvac-spike/package.json`). Tidak ada kode berbayar/proprietary di luar yang disebut di atas.

## Setup & build lokal

Prasyarat: Node.js (lihat `apps/qvac-spike/package.json` — Node portable 22.21.1 dipakai saat build, Android build butuh `^22.21.0 || >=24.9.0` per dokumentasi QVAC), Android Studio JBR 21, Android SDK (minSdk 31, targetSdk/compileSdk 36), NDK r29, Windows (build Android di-script khusus Windows; iOS belum pernah dibangun — Expo menolak native prebuild iOS di host Windows).

```powershell
cd apps/qvac-spike
npm install
npm run typecheck   # tsc --noEmit
npm test            # jest — 250 test, native boundary di-mock
```

Build APK Android (dari root repo):
```powershell
powershell -ExecutionPolicy Bypass -File scripts/Build-Niragni.ps1
```
Skrip melakukan `expo prebuild --platform android` lalu kompilasi Gradle release-signed (keluaran `artifacts/niragni-android.apk`). Signing release memerlukan keystore lokal di luar repo (`%USERPROFILE%\.niragni\signing`, password terenkripsi DPAPI) — build **fail-closed** (menolak fallback diam-diam ke debug-signing) jika keystore tidak ada; gunakan `-AllowDebugSigning` untuk build debug eksplisit. Skrip tidak memasang aplikasi atau menjalankan test.

Model AI **tidak dibundel** di repo (terlalu besar, lisensi harus diperiksa sebelum distribusi ulang). Unduh manual dari HuggingFace sebelum demo offline — lihat `docs/SUBMISSION.md` bagian "Integrasi QVAC" untuk link, ukuran file, dan SHA-256 pin persis; impor lewat UI aplikasi (Kelola Model → Impor dari penyimpanan).

## Dokumen lain

- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — info submission lomba lengkap (wajib dibaca juri)
- [`docs/implementation-status.md`](docs/implementation-status.md) — matriks implementasi & riwayat pengujian device
- [`docs/spike/qvac-audit.md`](docs/spike/qvac-audit.md) — audit SDK/model/lisensi QVAC
- [`docs/spike/offline-test-protocol.md`](docs/spike/offline-test-protocol.md) — protokol pengujian offline
- [`.context/baca-bara-codex-handoff-json-sebagai/outputs/`](.context/baca-bara-codex-handoff-json-sebagai/outputs/) — PRD & UI-spec baseline (tidak masuk Git, lokal saja)

## Batas eksekusi & privasi

- Gratis/lokal diutamakan. Tidak ada backend, akun, atau telemetry.
- Tidak ada publish/deploy/kirim laporan/telepon/kontak instansi otomatis — semua aksi perlu ketukan eksplisit pengguna.
- Data (draf, foto, selfie) hanya di SQLite + storage privat aplikasi di perangkat; tidak ada sinkronisasi/cloud.
- Backup Android dinonaktifkan (`allowBackup="false"`).
