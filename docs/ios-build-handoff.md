# iOS Build & Signing Handoff — Niragni (Bara)

**Date**: 29 October 2026 (Asia/Jakarta)  
**Target Application**: Niragni / Bara (`com.niragni.bara`)  
**Scope**: Handoff specification and prerequisite steps for future macOS/Xcode build and signing.

---

## 1. Status Lingkungan & Batasan Eksplisit

> [!CAUTION]
> **Tidak ada binary iOS yang dibangun atau diuji pada mesin ini.**
> 
> Lingkungan kerja saat ini berjalan pada sistem operasi **Windows**. Mesin ini:
> - **Tidak memiliki Xcode maupun toolchain macOS**.
> - **Tidak memiliki akun Apple Developer / sertifikat penandatanganan (Signing Certificate) / Provisioning Profile**.
> - **Tidak terhubung dengan perangkat iPhone maupun simulator iOS**.
> 
> Oleh karena itu, dokumen ini adalah panduan serah-terima konfigurasi sumber proyek dan langkah prasyarat build masa depan, **bukan laporan keberhasilan kompilasi atau pengujian perangkat riil**.

---

## 2. Identitas Proyek & Konfigurasi Merek

Identitas aplikasi dibakukan pada berkas konfigurasi [`app.json`](../apps/qvac-spike/app.json) dan [`package.json`](../apps/qvac-spike/package.json):

* **Application Name**: `Niragni`
* **Slug**: `bara`
* **URL Scheme**: `bara`
* **iOS Bundle Identifier**: `com.niragni.bara` *(dipertahankan pada konfigurasi proyek)*
* **Version**: `1.0.0`
* **Entry Point**: `expo-router/entry`

---

## 3. Versi SDK & Ketergantungan yang Dipin (*Pinned Stack*)

Berdasarkan berkas dependensi proyek:

| Komponen | Versi Terpin | Keterangan / Sumber |
|:---|:---|:---|
| **Expo SDK** | `~54.0.33` (Expo 54) | `package.json` |
| **React Native** | `0.81.5` | `package.json` |
| **React** | `19.1.0` | `package.json` |
| **@qvac/sdk** | `0.22.0` | Pinned `latest`, Apache-2.0 |
| **@qvac/fabric-ios** | `0.22.0` | Backend native iOS QVAC Fabric |
| **react-native-bare-kit** | `0.16.0` | Bare runtime untuk worker inferensi |
| **Node.js Target** | `^22.21.0 \|\| >=24.9.0` (misal `22.21.1`) | Prasyarat bundling QVAC Bare worker |
| **iOS Deployment Target**| `17.0` | Konfigurasi sumber pada `app.json` (*bukan batas minimum hardware terbukti*) |

---

## 4. Konfigurasi iOS pada Proyek Sumber (`app.json`)

Berkas `apps/qvac-spike/app.json` mengonfigurasi izin (*permissions*), batasan privasi, dan target deployment:

```json
{
  "expo": {
    "name": "Niragni",
    "slug": "bara",
    "scheme": "bara",
    "version": "1.0.0",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.niragni.bara",
      "infoPlist": {
        "NSCameraUsageDescription": "Ambil foto untuk melengkapi draf laporan Anda.",
        "NSPhotoLibraryUsageDescription": "Pilih foto pengamatan untuk disimpan dalam draf di perangkat.",
        "NSLocationWhenInUseUsageDescription": "Isi posisi Anda sebagai pelapor bila Anda memilihnya. Lokasi kejadian tetap terpisah.",
        "LSApplicationQueriesSchemes": [
          "tel",
          "mailto",
          "whatsapp"
        ]
      }
    },
    "plugins": [
      "./plugins/withBaraPrivacy.cjs",
      "./plugins/withBaraNdk.cjs",
      "@qvac/sdk/expo-plugin",
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "17.0"
          }
        }
      ],
      "expo-router",
      "expo-sqlite",
      [
        "expo-image-picker",
        {
          "cameraPermission": "Ambil foto untuk draf pengamatan Anda.",
          "photosPermission": "Pilih foto pengamatan untuk draf Anda.",
          "microphonePermission": false
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Isi posisi pelapor bila Anda memilihnya."
        }
      ],
      [
        "react-native-share",
        {
          "ios": ["whatsapp", "mailto"]
        }
      ],
      "expo-font"
    ]
  }
}
```

---

## 5. Model Multimodal Target & Batasan Status Kompatibilitas

Proyek saat ini mengonfigurasi dua pasangan kandidat model QVAC GGUF kuantisasi **Q8_0**:

1. **Kandidat A: SmolVLM2 500M Video Instruct (Q8_0)**
   - Bobot Model: `SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (436.8 MB)
   - Proyektor Visi: `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (108.8 MB)
   - Total Ukuran: **~545.6 MB**
   - Lisensi: Apache-2.0
2. **Kandidat B: VisionPsy Nano 460M Flash (Q8_0)**
   - Bobot Model: `visionpsy-nano-460m-flash-q8_0.gguf` (436.7 MB)
   - Proyektor Visi: `mmproj-visionpsy-nano-460m-flash-q8.gguf` (108.8 MB)
   - Total Ukuran: **~545.5 MB**
   - Lisensi: Apache-2.0

### Status Kompatibilitas Runtime & Hardware iOS:
- **Baseline Repositori Saat Ini**: Berjalan dengan default inferensi CPU.
- **Kompatibilitas Runtime, Hardware, Simulator, dan Akselerasi Grafis (Metal)**: **Belum terverifikasi (UNVERIFIED)** pada perangkat atau runtime iOS nyata karena belum pernah ada eksekusi build native iOS pada repositori ini.
- **Target Deployment iOS 17.0**: Merupakan konfigurasi sumber (*source configuration*) pada `app.json`, **bukan bukti batas minimum hardware fisik**.
- Dihindari klaim spekulatif mengenai simulator atau model perangkat mana yang dapat atau tidak dapat menjalankan inferensi sebelum ada bukti pengujian langsung dengan toolchain dan SDK terpin.

---

## 6. Prasyarat & Prosedur Build di Lingkungan macOS/Xcode

Langkah-langkah berikut ditujukan bagi pengembang yang bekerja di lingkungan macOS untuk memverifikasi toolchain:

### Langkah 1: Persiapan Mesin macOS
1. Gunakan komputer Mac yang menjalankan macOS dengan Xcode terpasang.
2. Pasang Command Line Tools:
   ```sh
   xcode-select --install
   ```
3. Pasang Node.js dengan versi yang sesuai dengan persyaratan mesin QVAC (`^22.21.0 || >=24.9.0`, disarankan `22.21.1`):
   ```sh
   node -v
   ```
4. Pasang CocoaPods:
   ```sh
   pod --version
   ```

### Langkah 2: Pemasangan Dependensi Proyek
Masuk ke direktori aplikasi `apps/qvac-spike/`:
```sh
cd apps/qvac-spike
npm ci
```
*Pastikan paket `@qvac/fabric-ios@0.22.0` dan `react-native-bare-kit@0.16.0` terpasang di `node_modules`.*

### Langkah 3: Eksekusi Expo Prebuild (Generate Proyek iOS)
Jalankan prebuild untuk menghasilkan direktori native `ios/` dan menautkan konfigurasi:
```sh
npx expo prebuild --platform ios --clean
```
Perintah ini akan:
- Menghasilkan direktori native `apps/qvac-spike/ios/`.
- Menjalankan `pod install` untuk menautkan modul native iOS.
- Mengonfigurasi `Info.plist` sesuai deklarasi `app.json`.

### Langkah 4: Konfigurasi Signing di Xcode
1. Buka workspace iOS di Xcode:
   ```sh
   open ios/bara.xcworkspace
   ```
2. Pilih target proyek **bara** pada navigasi kiri.
3. Masuk ke tab **Signing & Capabilities**:
   - Konfigurasikan penandatanganan (Signing) sesuai akun Apple Developer yang tersedia.
   - Pastikan **Bundle Identifier** tetap bernilai `com.niragni.bara`.
4. Periksa **Deployment Info**:
   - Pastikan target deployment sesuai dengan konfigurasi proyek (`17.0`).

### Langkah 5: Pengecekan Kompilasi
Jalankan kompilasi untuk memverifikasi kompatibilitas toolchain iOS:
```sh
npx expo run:ios
```
*Catatan: Perilaku eksekusi pada simulator vs perangkat fisik harus diverifikasi secara faktual saat pengujian dilakukan, tanpa asumsi apriori.*

---

## 7. Rangkuman Pintu Pengujian (*Verification Gates*) yang Masih Terbuka

Pengujian berikut masih berstatus terbuka dan perlu diverifikasi saat build iOS dijalankan:
1. **Pemuatan Runtime Model & Memori**: Memverifikasi alokasi memori saat memuat model ~545 MB pada runtime iOS.
2. **Latensi Inferensi & Backend Komputasi**: Mengukur latensi inferensi draf laporan (target PRD: < 10 detik) dan memverifikasi backend yang aktif (CPU vs akselerasi hardware).
3. **Kualitas Bahasa Indonesia**: Menguji kesesuaian draf saran visi model pada foto lokal di perangkat iOS.
4. **Handoff OS**: Memverifikasi pembukaan pemanggil dialer telepon, email, dan sheet berbagi di iOS.
