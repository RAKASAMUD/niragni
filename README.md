# Niragni

Niragni (sebelumnya nama kerja "Bara") membantu warga Indonesia menyiapkan draf laporan dugaan kebakaran dari teks dan foto. Target AI memakai QVAC lokal; aplikasi bukan layanan dispatch dan tidak menganggap berbagi sebagai bukti laporan diterima.

## Status

Implementasi produk berada di `apps/qvac-spike` (nama direktori awal dipertahankan sebagai riwayat). Tersedia alur draf, foto, lokasi terpisah, tinjauan AI, pratinjau berbagi, kanal Indonesia, dan pengelolaan model. Tidak memerlukan backend atau akun. Nama tampilan aplikasi adalah **Niragni**; bundle/application ID tetap `com.niragni.bara` agar pemasangan dan data pengguna yang ada tidak hilang (ganti nama tampilan tidak mengubah bundle ID). Namespace penyimpanan lokal (`bara.db`, `bara_media`, `bara_exports`) sengaja dipertahankan demi kontinuitas data.

Build produk Android final (nama tampilan **Niragni**, release-signed) tersimpan di `artifacts/niragni-android.apk` (240.268.821 bytes, SHA256 `04FE8B9CE8E4FBF8811940F3F77A98B02BDEB785A74555C325B47BC024B198C1`). Bukti inspeksi build-tools 36.0.0 (`aapt` & `apksigner`): label `Niragni`, package `com.niragni.bara`, minSDK 31, targetSDK 36, arsitektur murni ARM64 (`arm64-v8a`, 60 pustaka native termasuk BareKit + QVAC/GGML runtime), embedded JS bundle (`assets/index.android.bundle`, ~20,78 MB) untuk peluncuran offline tanpa Metro, backup dinonaktifkan (`allowBackup="false"`), `libOpenCL.so` opsional (`required="false"`), intent queries `tel`/`mailto`/`https`/`com.whatsapp`, dan ditandatangani kunci **rilis** (APK Signature Scheme v2 valid, sertifikat `CN=Niragni`, SHA-256 `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`). Kunci rilis privat berada di luar repo di `%USERPROFILE%\.niragni\signing`, kata sandi terenkripsi Windows DPAPI (CurrentUser). APK debug "Bara" sebelumnya dipertahankan sebagai riwayat di `artifacts/bara-android.apk` (sertifikat debug `fac61745...`); karena sertifikat rilis berbeda, pemasangan di atas build debug lama butuh penanganan manual — tidak ada install/uninstall dilakukan. APK dengan nama tampilan Niragni memerlukan rebuild sumber yang sudah diganti nama.

Batas bukti & status pengujian: Pengujian runtime, instalasi perangkat, dan benchmark ditunda atas permintaan pengguna; keberhasilan kompilasi dan konfigurasi native membuktikan integritas build namun TIDAK membuktikan kompatibilitas fisik handset (mis. Xiaomi 14T), keberhasilan inference teks+foto offline tanpa jaringan, atau latensi di bawah 10 detik. Bobot model tidak dibundel dan belum diunduh pada fase ini. Target iOS dipertahankan di source/config, namun native prebuild pada host Windows ditolak Expo; belum ada binary iOS.

Baseline yang diberikan pengguna berada di `.context/baca-bara-codex-handoff-json-sebagai/outputs/`: `Bara-PRD.md`, `Bara-UI-Spec.md`, `Bara-Verifikasi.md`. Nama berkas baseline ini dipertahankan apa adanya sebagai bukti audit historis. Folder konteks dan skill lokal tidak dimasukkan ke Git.

Rencana: [implementasi produk](docs/superpowers/plans/2026-10-28-bara-product.md). Cakupan dan batas bukti: [matriks implementasi](docs/implementation-status.md). Catatan task dan ownership: [progres produk](work/product-progress.md). Bukti spike sebelumnya: [laporan koordinator](work/reports/coordinator.md), audit di `docs/spike`, dan skrip perangkat di `scripts/device`.

## Build lokal

Jalankan `powershell -ExecutionPolicy Bypass -File scripts/Build-Niragni.ps1` dari root proyek. Skrip memakai Node portable 22.21.1 di `.tools`, JBR Android Studio 21, Android SDK lokal, dan NDK r29 di `.tools`. Dependensi aplikasi harus sudah terpasang dengan lockfile di `apps/qvac-spike`. Skrip melakukan prebuild Android dan kompilasi APK (keluaran `artifacts/niragni-android.apk`) tanpa memasang aplikasi atau menjalankan pengujian. Signing saat ini memakai kunci debug untuk pemasangan lokal.

## Batas eksekusi

- Gratis/lokal diutamakan. Ukuran SDK/model besar disampaikan sebelum diunduh.
- Tidak publish, deploy, mengirim laporan, menelepon, atau menghubungi instansi.
- Uji handset dimulai setelah APK siap. Build berhasil tidak membuktikan inference perangkat berhasil.
- Bukti harus menyertakan versi SDK/model/projector, checksum, lisensi, OS/RAM fisik/storage, keadaan jaringan, output dan pengukuran cold/warm.
