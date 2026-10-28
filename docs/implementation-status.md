# Cakupan implementasi Bara

Baseline: Bara-PRD v0.9, Bara-UI-Spec, Bara-Verifikasi yang disediakan pengguna. Pengguna mengubah urutan: implementasi/build didahulukan; pengujian ditunda. Tabel ini mencatat source yang dibuat, bukan kelulusan acceptance test.

| ID | Implementasi source | Pemilik | Bukti yang masih diperlukan |
|---|---|---|---|
| F01 | Draf tanpa login/model, SQLite, revisi dan autosave dengan status gagal | Kiro UI + AGY core | Penyimpanan, pemulihan, navigasi dan kegagalan disk di perangkat |
| F02 | Kamera/picker, salinan privat, batas3 foto/20MB, versi analisis1600px | Kiro + AGY | Izin ditolak, cloud-only, orientasi, file besar, pemulihan setelah proses mati |
| F03 | GPS pelapor dengan akurasi/waktu, lokasi kejadian manual terpisah | Kiro + AGY | Izin/GPS aktual dan konsistensi lokasi pada ekspor |
| F04 | Worker QVAC lokal, snapshot input, schema/provenance ketat, batal/manual | Kiro + AGY | Inference teks+foto Xiaomi14T, bahasa Indonesia, jaringan mati, cold/warm, latensi dan termal |
| F05 | Editor final, penanda sumber AI, penerimaan pengamatan, pilihan foto/lokasi | Kiro + AGY | Perilaku tinjauan, edit bersamaan, aksesibilitas dan hasil rendering |
| F06 | Pratinjau ekspor, OS share, salin teks, riwayat upaya tanpa klaim diterima | Kiro + AGY | Aplikasi penerima, pembatalan, EXIF hasil ekspor, hasil OS handoff |
| F07 | Kanal dan dialer hanya setelah ketukan eksplisit | Kiro + AGY | Uji dengan nomor dummy; tidak ada panggilan dilakukan saat pengembangan |
| F08 | Status model, unduh/impor, pin SDK/model, checksum, pemeriksaan load lokal | Kiro + AGY | Ruang/RAM/OS aktual, unduhan terputus, integritas dan load model di handset |
| F09 | Daftar draf, detail, hapus report beserta file privat/ekspor miliknya | Kiro + AGY | Isolasi antardraf dan foto galeri asli, kegagalan hapus/disk |
| F10 | Kanal nasional Indonesia dengan sumber/tanggal/cakupan; daerah belum terverifikasi | Kiro + AGY | Konfirmasi cakupan/kemutakhiran kanal sebelum penggunaan lapangan |

Koordinator memiliki kontrak bersama, dependensi, config, plugin native dan build; Kiro memiliki `app/**`, `src/ui/**`, dan `src/App.tsx`; AGY memiliki `src/core/**`, worker/prompt/manifest/types serta `qvac/**`. Laporan implementasi: `work/reports/kiro-product.md`, `work/reports/agy-product.md`. Review source lintas agent tidak menggantikan uji runtime.

## Batas privasi dan platform

Data berada di SQLite dan file privat aplikasi, tanpa backend, akun, sinkronisasi, atau log isi laporan. Backup Android dinonaktifkan lewat plugin native; plugin pengecualian backup iOS tersedia tetapi belum dibuktikan pada iOS. Tidak ada klaim enkripsi SQLite. Ekspor hanya dibuat saat diminta pengguna dan foto diekspor melalui re-encode; kegagalan scrub menghentikan berbagi foto.

Model tidak dibundel dan bobot belum diunduh pada host pengembang. Pin/checksum/lisensi terdapat di manifest dan audit spike. Label siap berarti pemeriksaan load lokal aplikasi berhasil; bukti inference offline dengan jaringan dimatikan masih terpisah dan belum tersedia.

Tidak ada publish, deploy, pengiriman laporan, atau kontak instansi. Belum ada pengujian produk, visual perangkat, emulator, atau handset pada fase ini. iOS tetap target source/config; Windows tidak menyediakan native build/signing iOS. APK Android lokal memakai signing debug.

## Bukti Build Final Android

Build release Android telah berhasil diselesaikan melalui `scripts/Build-Bara.ps1` dan diverifikasi dengan Android SDK build-tools 36.0.0 (`aapt` dan `apksigner`):
- **Artefak APK**: `artifacts/bara-android.apk` (240.264.749 bytes)
- **SHA-256**: `BB96C3ABDF6152E254327DF016DDD57BC76A71E1F0B9EEE5BA34E1B2E3F84E5F`
- **Package**: `com.niragni.bara` (versionCode 1, versionName 1.0.0)
- **SDK**: minSdkVersion 31, targetSdkVersion 36, compileSdkVersion 36
- **Arsitektur**: Murni `arm64-v8a` (60 shared libraries termasuk QVAC native runtime dan GGML CPU/OpenCL/Vulkan backend)
- **JS Bundle**: `assets/index.android.bundle` (21.787.348 bytes uncompressed)
- **Privasi & Backup**: `allowBackup="false"`, `fullBackupContent="false"`, data extraction rules aktif (`@xml/bara_data_extraction_rules`)
- **Native Library Requirement**: `libOpenCL.so` diset opsional (`required="false"`)
- **Queries**: Skema `tel`, `mailto`, dan paket `com.whatsapp`
- **Signing**: APK Signature Scheme v2 valid, sertifikat debug RSA 2048-bit (SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`)

*Catatan pembatas*: Bukti kompilasi statis dan APK ini membuktikan kelengkapan konfigurasi dan biner Android, namun pengujian fungsional pada handset fisik (Xiaomi 14T), cold/warm inference offline, dan latensi <10s tetap ditunda dan belum diuji.
