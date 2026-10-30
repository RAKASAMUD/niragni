# Non-AI QA — build & device facts

## Build (release, dari source terkini termasuk fix Pressable + kontras StatusPill)

- Perintah: `scripts/Build-Niragni.ps1` (release signing, tanpa debug fallback).
- Selesai: 2026-10-29 ~12:15 (java exit bersih, script menulis checksum 12:15:30).
- Artifact: `artifacts/niragni-android.apk`
  - Ukuran: 240,277,137 byte
  - SHA-256: `C1DFE0C1367022A3560DB08DB7067629BC7314B70E27BCD4FC9C2C746A415F67`
  - `artifacts/niragni-android.apk.sha256` ditulis oleh script build.
- Signature (apksigner verify --print-certs):
  - Signer #1 DN: `CN=Niragni`
  - SHA-256 sertifikat: `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`
    (cocok dengan sertifikat rilis yang dikenal → benar release-signed, bukan debug).
- Badging (aapt2 dump badging):
  - package `com.niragni.bara`, label `Niragni`, versionName `1.0.0` (versionCode 1)
  - minSdkVersion 31, targetSdkVersion 36, compileSdk 36
  - native-code: `arm64-v8a` (HANYA arm64).

## Device reachability (ADB)

- `adb devices -l` saat QA: TIDAK ada Xiaomi 14T. Yang muncul hanya
  `emulator-5554` (model `sdk_gphone64_x86_64`, device `emu64xa`) — lalu sempat `offline`.
- `adb mdns services`: kosong (endpoint wireless debugging Xiaomi tidak diiklankan).
- `adb reconnect` / `adb mdns check`: daemon mdns aktif, tetapi tidak ada layanan
  `adb-tls-connect` dari Xiaomi untuk disambungkan kembali.

### Kesimpulan device QA: BLOCKED (bukan gagal)

- Xiaomi 14T (arm64) TIDAK terjangkau: wireless debugging tidak aktif/diiklankan,
  dan user menyatakan HP sedang dipakai aplikasi lain (koordinator pemilik HP).
- Emulator yang ada adalah x86_64; APK ini native-code `arm64-v8a` saja, sehingga
  SECARA ARSITEKTUR TIDAK BISA dipasang di emulator x86_64 (modul native
  QVAC/BareKit arm64). Selain itu emulator bukan target yang ditugaskan.
- Keputusan: TIDAK memasang ke emulator (arsitektur salah + bukan target + di luar
  scope). Skenario QA device (draft save/relaunch/persistence, edit/hapus draft QA,
  foto add/remove + EXIF export, denied-permission recovery, share launch/cancel)
  menunggu Xiaomi terjangkau; akan ditangani koordinator (pemilik HP) atau dispatch
  lanjutan saat perangkat tersambung.

(Semua di atas DIAMATI dari output perintah nyata; tidak ada inferensi.)
