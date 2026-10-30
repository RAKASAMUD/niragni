# Hasil kompresi APK — 30 Oktober 2026

Status: build dan verifikasi artefak lokal selesai. Tidak diinstal atau diuji pada HP.

## Hasil aktual

| Ukuran | Baseline 29 Oktober | APK terkompresi |
| --- | ---: | ---: |
| APK | 243398110 byte (243,40 MB) | 86371446 byte (86,37 MB) |
| Pustaka native, isi APK | 206190520 byte | 67132504 byte |
| Pustaka native, setelah dekompresi | 206190520 byte | 206190520 byte |
| Bundle aplikasi, isi APK | 21831996 byte | 4302583 byte |
| Bundle aplikasi, setelah dekompresi | 21831996 byte | 21836528 byte |

Pengurangan total **157026664 byte / 64,51%**. Angka MB memakai 1000000 byte.

**Seluruh 60 pustaka native tetap ada, tidak ada tambahan/penghapusan, dan SHA256 isi setiap pustaka sama.** Jadi byte mesin QVAC/BareKit dipertahankan. Model yang diunduh terpisah tidak diperkecil oleh perubahan ini.

Baseline berisi source 29 Oktober; APK baru juga mencakup empat perbaikan source 30 Oktober. Ini bukan A/B keseluruhan aplikasi dengan source identik. Perbandingan hash pustaka native tetap langsung dan identik; bundle mentah berubah 4532 byte.

## Perubahan

- `apps/qvac-spike/app.json`: tambahkan `useLegacyPackaging: true` dan `enableBundleCompression: true` pada opsi Android `expo-build-properties`.
- Regenerasi native tanpa clean, tanpa instalasi dependensi: `npx.cmd expo prebuild --platform android --no-install`. Terverifikasi di generated `gradle.properties`: `expo.useLegacyPackaging=true`, `android.enableBundleCompression=true`, `reactNativeArchitectures=arm64-v8a`.
- `scripts/Build-Niragni.ps1`: checksum memakai SHA256 .NET dengan stream yang ditutup dalam finally. Build pertama menghasilkan APK, tetapi tahap checksum gagal karena Get-FileHash tidak tersedia pada host Windows PowerShell anak. Ini kegagalan post-build, bukan kegagalan Gradle. Perubahan menghilangkan ketergantungan auto-loading cmdlet tersebut.
- Tidak mengubah dependensi, menghapus backend, merombak UI, atau mengubah kunci penandatanganan.

## Build dan verifikasi

1. Build pertama: Gradle `BUILD SUCCESSFUL in 6m 35s`, lalu kegagalan checksum di atas (`build.log`).
2. Setelah perbaikan checksum, jalankan ulang build yang sama: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Build-Niragni.ps1 -SkipPrebuild`. **Exit 0**, `BUILD SUCCESSFUL in 1m 46s`, checksum dan label signing RELEASE terbit (`build-verified.log`).
3. `python work/reports/apk-compression-2026-10-30/compare_apks.py`: menghasilkan `comparison.json`, mengukur ZIP dan membandingkan hash isi tiap `.so` tanpa mengekstrak atau mengubah APK.
4. `apksigner verify --verbose --print-certs`: exit 0, v2 signature valid, CN=Niragni, sertifikat SHA256 `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`, sama dengan baseline (`signature.txt`).
5. `zipalign -c 4`: exit 0. `aapt dump xmltree` menunjukkan package `com.niragni.bara`, versi 1.0.0/code 1, `android:extractNativeLibs=true` (`manifest.txt`).
6. Tidak menambahkan tes unit untuk dua flag build; pemeriksaan native yang dihasilkan dan APK rilis adalah pemeriksaan utama. Hasil 223 tes/typecheck pada source perbaikan sebelumnya tercatat terpisah di `../device-qa-2026-10-30/fix-verification.md`; tidak diklaim sebagai tes runtime APK ini.

## Artefak

- APK baru: `artifacts/niragni-android-compressed-2026-10-30.apk` dan alias terbaru `artifacts/niragni-android.apk`.
- SHA256 baru: `36308987CB85E3DA38BB2D91E52E41C44B8072C4A10F0633C30048D4D8720C64`. Berkas checksum kedua nama disimpan.
- Baseline dipertahankan: `artifacts/niragni-android-uncompressed-2026-10-29.apk`, SHA256 `2C21EEAA874E7697CE262FB07CB55BBB3924CF2E072C8474B3D5A7843E826D27`.

## Batas pengujian

- Penurunan ini adalah ukuran file APK, bukan pengukuran RAM atau ruang instalasi. Ekstraksi pustaka native dapat menambah ruang setelah instalasi.
- Kompresi bundle dapat memperlambat startup menurut dokumentasi opsi versi Expo yang terpasang. Startup, RAM, ukuran instalasi, impor SAF model besar dan inference belum diukur pada APK ini.
- Identitas byte pustaka, build, signature dan alignment tidak membuktikan kompatibilitas runtime/inference. Masih perlu uji perangkat saat pengguna kembali menyediakan HP.
- Tidak ada ADB, perubahan izin/jaringan HP, publish, deploy atau kontak instansi pada pekerjaan ini.
