# Laporan Review & Perbaikan Niragni Mobile (React Native / Expo)
**Tanggal**: 30 Oktober 2026  
**Standar Evaluasi**: `.agents/skills/vercel-react-native-skills/SKILL.md`  
**Cakupan**: `apps/qvac-spike` (UI Lifecycle, State Management, Rendering, Native Boundaries, List Performance, Formatting)  
**Status Eksekusi**: Selesai (256 unit & integration tests lulus, typecheck clean, tanpa build APK baru)

---

## 1. Ringkasan Eksekutif

Review komprehensif dilakukan terhadap aplikasi mobile Niragni berbasis aturan performa dan rekayasa React Native dari `vercel-react-native-skills`. Review ini menyelesaikan temuan terkait polling kesiapan offline, proteksi overlap berbasis generasi kepemilikan in-flight, emisi progress hash saat import model lokal, unmount cancellation guards pada layar formulir, optimasi struktural instance `Intl`, serta konsistensi teks antarmuka.

Semua perbaikan telah diimplementasikan secara konkret dengan prinsip TDD (membuktikan kegagalan Red kemudian lulus Green pada tes regresi), tanpa merusak desain Figma, sistem gerbang kamera selfie depan, pembersihan privasi EXIF, konfigurasi APK, maupun kompatibilitas runtime QVAC 0.22.0.

---

## 2. Temuan Prioritas & Analisis Kritis

### Prioritas 1 (P1): Reset Error Agresif & State Overlap pada Polling Kesiapan Offline
- **Aturan Terkait**: `react-state-minimize`, `state-ground-truth`, `react-state-fallback`
- **Lokasi**: [readiness.tsx](file:///apps/qvac-spike/app/(tabs)/readiness.tsx), [loadReadinessData.ts](file:///apps/qvac-spike/src/ui/loadReadinessData.ts)
- **Kondisi Awal**:
  1. `readiness.tsx` menjalankan `setInterval` setiap 1.000 ms untuk memanggil `listModels()`. Setiap iterasi sukses memanggil `setError(null)`. Akibatnya, pesan kegagalan dari aksi pengguna (seperti kegagalan unduh, error import file korup, atau SHA-256 mismatch) langsung lenyap dalam waktu ≤ 1 detik sebelum pengguna sempat membaca pesan error tersebut.
  2. Polling asynchronous tidak memiliki nomor urut request (`requestSeq`) dan proteksi in-flight. Pada respons yang tertunda, hasil lama dapat menimpa state terbaru.
  3. **Celah Concurrency Finallly / Stale Completion**: Pada implementasi awal `inFlight = false` di blok `finally`, skenario *A pending $\rightarrow$ reset $\rightarrow$ B pending $\rightarrow$ A selesai* menyebabkan blok `finally` request A melepaskan guard in-flight milik request B yang masih aktif berjalan. Akibatnya, tick interval C berikutnya berjalan tumpang tindih (*overlapping*) dengan B.
- **Dampak**: Pengguna kehilangan pesan error operasional penting; potensi race condition antar-request polling saat navigasi blur-refocus atau interval tick cepat.
- **Solusi**:
  - Dibuat modul [loadReadinessData.ts](file:///apps/qvac-spike/src/ui/loadReadinessData.ts) dengan fungsi `createReadinessPoller`.
  - In-flight lock dikelola berbasis generasi kepemilikan aktif (`activeOwnerSeq`). Blok `finally` hanya melepaskan guard jika request yang selesai adalah pemilik aktif dari generasi berjalan (`if (activeOwnerSeq === seq) activeOwnerSeq = null;`). Penyelesaian dari request stale generasi lama (misalnya request sebelum blur atau unmount) tidak lagi dapat membuka guard request baru.
  - Polling berkala di latar belakang tidak lagi memanggil `setError(null)`. `error` hanya direset ketika pengguna secara eksplisit memulai aksi operasional baru (`runDownload`, `cancelDownload`, `importLocal`, `check`, `remove`).

---

### Prioritas 2 (P2): Hilangnya Emisi Byte Hash pada Import Model & Fallback Visual 0 B
- **Aturan Terkait**: `react-state-fallback`, `state-ground-truth`
- **Lokasi**: [models.ts](file:///apps/qvac-spike/src/core/models.ts#L360-L425), [readiness.tsx](file:///apps/qvac-spike/app/(tabs)/readiness.tsx#L380-L400)
- **Kondisi Awal**:
  1. Manifest model aktual pada spike Niragni adalah **SmolVLM2 500M Video Instruct (Q8_0)**:
     - Berkas model: `SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (**436.808.704 byte**)
     - Berkas projector: `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (**108.785.184 byte**)
  2. Fungsi `importModel()` di `models.ts` memverifikasi integritas SHA-256 kedua berkas tersebut via `computeFileSha256(path)`. Namun, pemanggilan tersebut tidak meneruskan callback `onProgress`. Akibatnya, `item.verifiedBytes` tetap bernilai `undefined` selama proses hashing berlangsung.
  3. Komponen UI `readiness.tsx` menampilkan progress verifikasi dengan fallback `verifiedBytes ?? 0`. Karena `verifiedBytes` selalu `undefined`, UI menampilkan teks janggal `0 B / <total>` secara terus-menerus hingga verifikasi selesai.
- **Dampak**: Pengguna tidak mendapatkan umpan balik visual bahwa proses verifikasi berkas ratusan megabyte sedang aktif berjalan di perangkat.
- **Solusi**:
  - Memperbarui `models.ts` agar menyalurkan callback `onProgress` ke `computeFileSha256` dengan pembatasan interval emisi (`hashProgress` throttle ~250 ms dan emisi penyelesaian per berkas) untuk mencegah banjir re-render state.
  - Memperbarui tampilan kartu verifikasi pada [readiness.tsx](file:///apps/qvac-spike/app/(tabs)/readiness.tsx): Jika `verifiedBytes` belum terdefinisi atau sedang inisiasi, tampilkan teks `Memeriksa SHA-256… · ${formatBytes(total)}` alih-alih menampilkan nilai `0 B`.

---

### Prioritas 3 (P3): Optimasi Struktural Intl.DateTimeFormat & Missing Unmount Guards
- **Aturan Terkait**: `js-hoist-intl`, `rendering-no-falsy-and`, `rendering-text-in-text-component`
- **Lokasi**: [format.ts](file:///apps/qvac-spike/src/ui/format.ts), [edit.tsx](file:///apps/qvac-spike/app/report/[id]/edit.tsx), [share.tsx](file:///apps/qvac-spike/app/report/[id]/share.tsx), [photos.tsx](file:///apps/qvac-spike/app/report/[id]/photos.tsx)
- **Kondisi Awal**:
  1. Di `format.ts`, fungsi `formatShortDate`, `formatDateOnly`, dan `formatIndonesianHeaderDate` menginstansiasi objek baru `new Intl.DateTimeFormat(...)` pada setiap pemanggilan. Sesuai panduan `js-hoist-intl`, instansiasi berulang ini sebaiknya di-hoist sebagai pola arsitektur kode yang lebih bersih. *Catatan*: Perubahan ini merupakan optimasi struktural dan belum diprofilkan secara kuantitatif terhadap pengurangan memori heap di perangkat nyata.
  2. Pada layar formulir (`edit.tsx`, `share.tsx`, `photos.tsx`), hook `useFocusEffect` memanggil fungsi asynchronous pemuatan data (`getReport`, `listModels`, `previewExport`) tanpa mekanisme pembatalan saat unmount atau navigasi keluar (`isActive` guard).
  3. Ditemukan artefak teks pada pesan progress stage berbagi di `share.tsx` dan tombol di `index.tsx` di mana tanda elipsis `…` berubah menjadi tanda tanya `?` (misal: `Membuat draf?`, `Memeriksa laporan dan selfie tersimpan?`).
- **Dampak**: Potensi unmounted component state warning pada navigasi cepat; kebingungan pengguna membaca pesan status antarmuka.
- **Solusi**:
  - Meng-hoist instance statis `Intl.DateTimeFormat` di tingkat modul (`shortDateFormatter`, `dateOnlyFormatter`, `indonesianHeaderDateFormatter`) serta membuat cache map `timeWithZoneFormatterCache` untuk zona waktu dinamis (WIB, WITA, WIT).
  - Menambahkan flag pembatalan `isActive` dan `isMountedRef` pada `useFocusEffect` di `edit.tsx`, `share.tsx`, dan `photos.tsx`.
  - Memperbaiki string antarmuka menjadi tanda elipsis resmi (`…`).

---

## 3. Berkas yang Dibuat & Dimodifikasi

| Berkas | Jenis Perubahan | Deskripsi |
|---|---|---|
| `apps/qvac-spike/src/ui/loadReadinessData.ts` | **File Baru** | Modul poller kesiapan offline (`createReadinessPoller`) dengan pencegahan overlap berbasis generasi (`activeOwnerSeq`), sequencing, retensi error, dan pencegahan stale unlock. |
| `apps/qvac-spike/src/__tests__/readiness-loading.test.ts` | **File Baru** | 5 unit test untuk memverifikasi siklus polling readiness, retensi error, anti-overlap, rejeki respon usang, dan isolasi generasi in-flight lock. |
| `apps/qvac-spike/src/core/models.ts` | **Modifikasi** | Menambahkan `hashProgress` bounded (~250ms) pada `importModel()` saat kalkulasi SHA-256 model GGUF dan projector. |
| `apps/qvac-spike/src/__tests__/import-progress.test.ts` | **Modifikasi** | Menambahkan tes integrasi pemantauan byte hash progress saat import model (terbukti Red sebelum fix, Green setelah fix). |
| `apps/qvac-spike/src/ui/format.ts` | **Modifikasi** | Meng-hoist instance `Intl.DateTimeFormat` dan menerapkan cache zona waktu sesuai pola struktural `js-hoist-intl`. |
| `apps/qvac-spike/src/__tests__/timezone-format.test.ts` | **Modifikasi** | Menambahkan tes regresi untuk formatter tanggal dan header bahasa Indonesia. |
| `apps/qvac-spike/app/(tabs)/readiness.tsx` | **Modifikasi** | Integrasi `createReadinessPoller`, penghapusan reset error background, UI hashing display jujur, perbaikan typo elipsis. |
| `apps/qvac-spike/app/(tabs)/index.tsx` | **Modifikasi** | Perbaikan label tombol pembuatan draf (`Membuat draf…`). |
| `apps/qvac-spike/app/report/[id]/edit.tsx` | **Modifikasi** | Menambahkan unmount cancellation guard `isActive` pada pemuatan model. |
| `apps/qvac-spike/app/report/[id]/share.tsx` | **Modifikasi** | Menambahkan unmount/blur guard `isActive` + `isMountedRef`, memperbaiki string progress status `shareStage` (`…`). |
| `apps/qvac-spike/app/report/[id]/photos.tsx` | **Modifikasi** | Menambahkan unmount cancellation guard `isActive` + `isMountedRef` pada pemuatan foto draf. |

---

## 4. Hasil Pengujian Aktual

### A. Pembuktian Kegagalan (Red) Lalu Perbaikan (Green)
1. **Regresi Emisi Progress Hash Import Model**:
   - *Sebelum Perubahan*: Tes `importModel SHA-256 hashing emits bounded verifiedBytes progress during verification` dijalankan dan **GAGAL** karena callback `onProgress` tidak disambungkan ke `computeFileSha256`, menyebabkan `verifiedBytes` tidak pernah bertambah.
   - *Setelah Perubahan*: Tes dijalankan kembali dan **LULUS (PASS)** dengan emisi pembaharuan progress bytes secara bertahap.
2. **Regresi In-Flight Guard Ownership pada Stale Completion**:
   - *Sebelum Perubahan*: Tes `does not allow stale completion to release in-flight guard of an active generation` dijalankan dan **GAGAL (Red)** karena blok `finally` dari poll A yang kadaluwarsa menyetel `inFlight = false`, sehingga tick C dapat berjalan tumpang tindih dengan request B yang masih aktif.
   - *Setelah Perubahan*: Diperbaiki dengan generasi kepemilikan aktif (`activeOwnerSeq === seq`), tes dijalankan kembali dan **LULUS (Green)**.

### B. Hasil Keseluruhan Test Suite & Typecheck
- **Perintah**: `npm.cmd test -- --runInBand`
  ```text
  PASS src/__tests__/import-progress.test.ts
  PASS src/__tests__/readiness-loading.test.ts
  PASS src/__tests__/selfie-export.test.ts
  PASS src/__tests__/download-recovery.test.ts
  PASS src/__tests__/selfie-repository.test.ts
  PASS src/__tests__/channel-selector.test.ts
  PASS src/__tests__/timezone-format.test.ts
  PASS src/__tests__/native-readiness.test.ts
  PASS src/__tests__/damkar-only.test.ts
  PASS src/__tests__/time-validation.test.ts
  PASS src/__tests__/state.test.ts
  PASS src/__tests__/prompt.test.ts
  PASS src/__tests__/model-list-status.test.ts
  PASS src/__tests__/channel-contact.test.ts
  PASS src/__tests__/saf-copy.test.ts
  PASS src/__tests__/manifest.test.ts
  PASS src/__tests__/pressable-style.test.ts
  PASS src/__tests__/home-loading.test.ts

  Test Suites: 18 passed, 18 total
  Tests:       256 passed, 256 total
  Snapshots:   0 total
  Time:        1.572 s
  Ran all test suites.
  ```
  *(Baseline sebelumnya: 247 passed / 17 suites $\rightarrow$ Hasil akhir: 256 passed / 18 suites).*

- **Perintah**: `npm.cmd run typecheck`
  ```text
  > niragni@1.0.0 typecheck
  > tsc --noEmit
  (Exit code 0, no diagnostic errors)
  ```

---

## 5. Batasan Native & Batas Implementasi Aktual

Berdasarkan arsitektur kode sumber aktual di `apps/qvac-spike`:
1. **Mekanisme Hashing Berkas**:
   - Komputasi hash SHA-256 berkas diimplementasikan di `src/core/hasher.ts` menggunakan streaming `FileHandle.readBytes(CHUNK_SIZE)` melalui Expo FileSystem (`file.open()`) dengan alokasi chunk 256 KB dan cooperative yielding ke event-loop setiap 2 MB via `@noble/hashes`.
2. **Kamera Selfie Depan & Direktori Ekspor**:
   - Pengambilan selfie pengirim dilakukan via pustaka `expo-image-picker` (`ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, exif: false })`), bukan pustaka native `expo-camera`.
   - Sanitasi metadata foto untuk ekspor disimpan ke dalam direktori cache privat aplikasi (`Paths.cache/bara_exports/<reportId>`), bukan ke cache publik perangkat.
3. **Konfigurasi Model AI Offline**:
   - Manifest model SmolVLM2 500M Video Instruct (Q8_0) dikonfigurasikan secara default pada CPU (`recommendedConfig: { device: 'cpu', ctx_size: 8192 }`). Perilaku komputasi inferensi dan konsumsi memori aktual pada perangkat keras fisik Android belum diukur secara empiris. Aplikasi tetap mempertahankan alur pelaporan manual ("Lanjut isi sendiri") yang sepenuhnya independen dari status model offline.
