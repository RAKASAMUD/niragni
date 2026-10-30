# Cakupan implementasi Niragni

## Status terkini — 30 Oktober 2026

APK revisi 29 Oktober sudah dipasang dan diuji pada Xiaomi 14T Android 16. Alur draf/persistensi, foto sintetis, batas tiga foto, lokasi manual saat GPS ditolak, penghapusan, pencarian Damkar dan blokir berbagi tanpa selfie diperiksa. Ditemukan kegagalan impor SAF, status impor tersangkut, waktu tidak tervalidasi dan label zona waktu pratinjau yang menyesatkan. Bukti dan batas cakupan: `work/reports/device-qa-2026-10-30/report.md`.

AGY menyelesaikan empat perbaikan pada source; koordinator menambahkan tes lanjutan dan menjalankan ulang 223 tes / 14 suite (lulus) serta typecheck (exit 0). Verifikasi dan riwayat orkestrasi: `work/reports/device-qa-2026-10-30/fix-verification.md`. Selfie nyata/ekspor akhir dilewati sesuai pilihan pengguna; inference ditunda setelah impor gagal, tanpa unduhan ulang. Tidak ada akses HP setelah pengguna memintanya kembali.

APK pengganti yang mencakup perbaikan sudah dibangun dengan kompresi native dan bundle: **86371446 byte (86,37 MB), turun 64,51%** dari baseline 243,40 MB. Seluruh 60 pustaka native tetap identik secara hash isi, signature rilis sama, zipalign lulus. Artefak `artifacts/niragni-android-compressed-2026-10-30.apk`, SHA256 `36308987CB85E3DA38BB2D91E52E41C44B8072C4A10F0633C30048D4D8720C64`; alias terbaru `artifacts/niragni-android.apk` juga diperbarui. Baseline 29 Oktober disimpan terpisah. Laporan: `work/reports/apk-compression-2026-10-30/report.md`. APK baru belum dipasang/diuji di HP; ukuran instalasi, startup, RAM dan inference belum diukur.

## Riwayat — 29 Oktober 2026

Pembaruan evaluasi besar: UI dan logo Figma telah diterapkan pada source, swafoto kamera diwajibkan sebelum berbagi, dan direktori aktif dibatasi ke Damkar dengan pilihan kota eksplisit. Koordinator menjalankan ulang Jest: 143 tes pada 10 suite lulus; `tsc --noEmit` lulus. Tes repositori memakai mock batas SQLite/file/kamera, sehingga belum membuktikan perilaku native, EXIF hasil ekspor, ataupun inference offline. AGY asli menyelesaikan pengujian pengganti setelah Kiro dan AGY pengganti kehabisan kuota.

APK revisi berhasil dibangun lokal (`BUILD SUCCESSFUL in 19m 40s`), 243398110 byte, SHA-256 `2C21EEAA874E7697CE262FB07CB55BBB3924CF2E072C8474B3D5A7843E826D27`. `apksigner verify --print-certs` lulus dengan sertifikat rilis SHA-256 `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`. Belum dipasang/diuji ulang pada HP. Build memberi peringatan metaspace JVM 512 MiB tidak mencukupi; log tersimpan di `work/reports/revision-build-2026-10-29.log`. Catatan setelah paragraf ini adalah riwayat fase sebelumnya.

Desain Figma 25 layar/state telah selesai direvisi sesuai arahan pengguna; desain tersebut belum diimplementasikan ke APK. Detail desain: `work/reports/figma-ui-concept.md`. Pengujian inference lokal teks+foto dengan jaringan dimatikan tetap ditunda dan belum membuktikan feasibility QVAC pada Xiaomi 14T.

APK rilis pernah dipasang dan dibuka pada Xiaomi 14T melalui wireless ADB. Pemeriksaan UI menemukan masalah style tombol yang sudah diperbaiki pada source; pemasangan APK yang memuat perbaikan tersebut masih perlu dibuktikan. Backup kunci signing asli belum dibuat. Font/background desain belum dapat dianggap berizin untuk didistribusikan. iOS belum dibangun atau diuji.

AGY dan Kiro sedang mengerjakan direktori kanal, audit lisensi, verifikasi non-AI dan helper backup dengan kepemilikan file terpisah. Hasil serta hambatan aktual dicatat di `work/reports/coordinator-final-readiness.md`. Tidak ada publish, deploy, push atau kontak instansi. Bagian di bawah adalah catatan fase sebelumnya; checksum dan jumlah entri lama bukan bukti artefak terbaru.

## Riwayat implementasi awal

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

Build release Android (bernama tampilan **Niragni**) telah berhasil diselesaikan melalui `scripts/Build-Niragni.ps1` dengan **release signing** dan diverifikasi dengan Android SDK build-tools 36.0.0 (`aapt` dan `apksigner`). Build exit 0 dalam 13m 5s (portable Node 22.21.1, JBR 21, NDK r29):
- **Artefak APK**: `artifacts/niragni-android.apk` (240.268.821 bytes)
- **SHA-256**: `04FE8B9CE8E4FBF8811940F3F77A98B02BDEB785A74555C325B47BC024B198C1`
- **Label aplikasi**: `Niragni`
- **Package**: `com.niragni.bara` (versionCode 1, versionName 1.0.0) — bundle ID dipertahankan demi kontinuitas data
- **SDK**: minSdkVersion 31, targetSdkVersion 36, compileSdkVersion 36
- **Arsitektur**: Murni `arm64-v8a` (0 ABI lain; 60 shared library termasuk BareKit + QVAC/GGML native runtime)
- **JS Bundle**: `assets/index.android.bundle` (~20.78 MB, tertanam untuk peluncuran offline tanpa Metro)
- **Privasi & Backup**: `allowBackup="false"`
- **Native Library Requirement**: `libOpenCL.so` diset opsional (`required="false"`)
- **Queries**: Skema `tel`, `mailto`, `https`, dan paket `com.whatsapp`
- **Signing**: APK Signature Scheme **v2 valid**, Signer DN `CN=Niragni`, **sertifikat rilis RSA 4096-bit SHA-256 `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`** (berbeda dari sertifikat debug lama `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). Kunci rilis privat berada di luar repo (`%USERPROFILE%\.niragni\signing`), kata sandi terenkripsi DPAPI CurrentUser.
- **Direktori kanal**: 25 entri (24 `public` + 1 `unconfirmed` 112) di-bundle sebagai data statis bertipe di `src/core/channel-directory.ts`.

APK debug "Bara" sebelumnya dipertahankan sebagai riwayat di `artifacts/bara-android.apk` (SHA-256 `BB96C3ABDF6152E254327DF016DDD57BC76A71E1F0B9EEE5BA34E1B2E3F84E5F`, sertifikat debug `fac61745...`). Karena sertifikat rilis berbeda dari debug, pemasangan di atas build debug lama memerlukan penanganan manual pengguna; TIDAK ada install/uninstall yang dilakukan.


*Catatan pembatas*: Bukti kompilasi statis dan APK ini membuktikan kelengkapan konfigurasi dan biner Android, namun pengujian fungsional pada handset fisik (Xiaomi 14T), cold/warm inference offline, dan latensi <10s tetap ditunda dan belum diuji.
