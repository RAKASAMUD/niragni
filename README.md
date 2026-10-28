# Bara

Bara membantu warga Indonesia menyiapkan draf laporan dugaan kebakaran dari teks dan foto. Target AI memakai QVAC lokal; aplikasi bukan layanan dispatch dan tidak menganggap berbagi sebagai bukti laporan diterima.

## Status

Implementasi produk berada di `apps/qvac-spike` (nama direktori awal dipertahankan). UI dikerjakan Kiro; layanan lokal dan QVAC dikerjakan AGY melalui Orca. Tersedia alur draf, foto, lokasi terpisah, tinjauan AI, pratinjau berbagi, kanal Indonesia, dan pengelolaan model. Tidak memerlukan backend atau akun.

Build produk Android final telah selesai dikompilasi di `artifacts/bara-android.apk` (240.264.749 bytes, SHA256 `BB96C3ABDF6152E254327DF016DDD57BC76A71E1F0B9EEE5BA34E1B2E3F84E5F`). Bukti inspeksi build-tools 36.0.0 (`aapt` & `apksigner`): package `com.niragni.bara`, minSDK 31, targetSDK 36, arsitektur murni ARM64 (`arm64-v8a`, 60 pustaka native termasuk QVAC runtime & GGML CPU/OpenCL/Vulkan), embedded JS bundle (`assets/index.android.bundle`, 21.787.348 bytes), backup dinonaktifkan (`allowBackup="false"`, `fullBackupContent="false"`, aturan ekstraksi data aktif), intent queries terkonfigurasi (`tel`, `mailto`, `com.whatsapp`), dependensi native `libOpenCL.so` opsional (`required="false"`), serta diverifikasi dengan kunci debug (APK Signature Scheme v2 valid, sertifikat SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). APK spike sebelumnya dipertahankan di `artifacts/bara-qvac-spike.apk`.

Batas bukti & status pengujian: Pengujian runtime, instalsi perangkat, dan benchmark ditunda atas permintaan pengguna; keberhasilan kompilasi dan konfigurasi native membuktikan integritas build namun TIDAK membuktikan kompatibilitas fisik handset (mis. Xiaomi 14T), keberhasilan inference teks+foto offline tanpa jaringan, atau latensi di bawah 10 detik. Bobot model tidak dibundel dan belum diunduh pada fase ini. Target iOS dipertahankan di source/config, namun native prebuild pada host Windows ditolak Expo; belum ada binary iOS.

Baseline yang diberikan pengguna berada di `.context/baca-bara-codex-handoff-json-sebagai/outputs/`: `Bara-PRD.md`, `Bara-UI-Spec.md`, `Bara-Verifikasi.md`. Folder konteks dan skill lokal tidak dimasukkan ke Git.

Rencana: [implementasi produk](docs/superpowers/plans/2026-10-28-bara-product.md). Cakupan dan batas bukti: [matriks implementasi](docs/implementation-status.md). Catatan task dan ownership: [progres produk](work/product-progress.md). Bukti spike sebelumnya: [laporan koordinator](work/reports/coordinator.md), audit di `docs/spike`, dan skrip perangkat di `scripts/device`.

## Build lokal

Jalankan `powershell -ExecutionPolicy Bypass -File scripts/Build-Bara.ps1` dari root proyek. Skrip memakai Node portable22.21.1 di `.tools`, JBR Android Studio21, Android SDK lokal, dan NDKr29 di `.tools`. Dependensi aplikasi harus sudah terpasang dengan lockfile di `apps/qvac-spike`. Skrip melakukan prebuild Android dan kompilasi APK tanpa memasang aplikasi atau menjalankan pengujian. Signing saat ini memakai kunci debug untuk pemasangan lokal.

## Batas eksekusi

- Gratis/lokal diutamakan. Ukuran SDK/model besar disampaikan sebelum diunduh.
- Tidak publish, deploy, mengirim laporan, menelepon, atau menghubungi instansi.
- Uji handset dimulai setelah APK siap. Build berhasil tidak membuktikan inference perangkat berhasil.
- Bukti harus menyertakan versi SDK/model/projector, checksum, lisensi, OS/RAM fisik/storage, keadaan jaringan, output dan pengukuran cold/warm.
