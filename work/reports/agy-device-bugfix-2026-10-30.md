# Laporan Perbaikan Empat Bug Runtime QA Fisik (Xiaomi 14T) — 30 Oktober 2026

Dokumen ini mencatat investigasi akar masalah, perbaikan kode, pembuktian regresi berbasis TDD, serta batasan pengujian untuk empat bug runtime yang dilaporkan dalam `work/reports/device-qa-2026-10-30/report.md`.

---

## 1. Ringkasan Eksekutif

1. **Bug 1 (P1 - Impor SAF Content URI Gagal):** Diperbaiki dengan mengarahkan penyalinan berkas dari skema `content://` (Android Storage Access Framework) melalui API legacy `expo-file-system/legacy` (`copyAsync`), karena kelas modern `File.copy()` pada `expo-file-system` v19.0.24 secara tegas menolak URI selain `file://`.
2. **Bug 2 (P2 - Status Stuck Mengunduh 0% & Lock Leak):** Diperbaiki dengan menambahkan penanganan `catch` lengkap pada `importModel()` di `src/core/models.ts` yang memulihkan state progres ke status terminal (`failed` atau `missing`/`installed`), membersihkan berkas parsial, melepaskan lock lifecycle pada blok `finally`, serta mempertahankan pasangan berkas valid sebelumnya jika impor dibatalkan atau gagal.
3. **Bug 3 (P1/P2 - Validasi Waktu & Zona Sebelum Persistensi):** Diperbaiki dengan menambahkan validasi boundary `validateObservationFields()` pada `ReportRepository.saveReport()` (`src/core/repository.ts`). String waktu non-ISO atau tanggal kalender mustahil (misal: 30 Februari, 31 April, 29 Februari non-kabisat) dan zona waktu raw offset atau tidak dikenal ditolak sebelum penulisan basis data, mencegah penimpaan draf valid, dan menampilkan notifikasi kesalahan yang jelas pada layar lokasi (`app/report/[id]/location.tsx`). Draf lama tetap dapat dimuat tanpa crash.
4. **Bug 4 (P2 - Format Waktu Instan & Zona Waktu Eksplisit):** Diperbaiki pada `src/ui/format.ts` (`formatTimeWithZone`) dan `src/core/export.ts` (`previewExport`) dengan memformat instan UTC secara eksplisit menggunakan opsi `{ timeZone: tz }` pada `toLocaleString('id-ID')`, bukan menempelkan label zona pada string mentah ISO `...Z (Asia/Jakarta)` dan bukan mengandalkan zona waktu host/perangkat terselubung. Cakupan zona waktu Indonesia (WIB, WITA, WIT) didukung penuh, dan zona tidak valid ditandai secara jujur.

---

## 2. Sebab Perubahan dan Bukti Kode

### Bug 1: Kegagalan Impor SAF `content://` via `FileSystemFile.copy`
- **Gejala Runtime:**
  ```text
  Call to function 'FileSystemFile.copy' has been rejected ...
  This method cannot be used with content URIs: content://com.android.providers.downloads.documents/document/msf%3A1000308073
  ```
- **Akar Masalah:**
  Pemeriksaan typings dan implementasi lokal pada `node_modules/expo-file-system/build/ExpoFileSystem.types.d.ts` membuktikan bahwa `File` (modul baru expo-file-system v19) dirancang eksklusif untuk jalur berkas lokal `file:///`. Sebaliknya, `node_modules/expo-file-system/build/legacy/FileSystem.d.ts` mengekspos `copyAsync(options: RelocatingOptions)` yang didesain khusus untuk mendukung pembacaan berkas eksternal melalui ContentResolver Android SAF.
- **Solusi:**
  Dibuat modul helper baru `apps/qvac-spike/src/core/safCopy.ts` dengan fungsi:
  - `isContentUri(uri: string): boolean`
  - `copySourceToPrivate(sourceUri: string, destPath: string): Promise<void>`
  Bila sumber berupa `content://`, penyalinan dilakukan via `copyAsync({ from: sourceUri, to: destPath })`. Bila sumber berupa `file://`, penyalinan tetap menggunakan `new File(sourceUri).copy(...)` di ruang privat. Berkas hasil salinan tetap berada di direktori privat aplikasi sebelum penghitungan SHA-256 dan promosi atomik pasangan berkas.

### Bug 2: Status Stuck `Mengunduh 0%` Setelah Impor Gagal / Dibatalkan
- **Gejala Runtime:**
  Setelah DocumentPicker dibatalkan atau terjadi exception penyalinan/hash, kartu model di UI tetap menampilkan label `Mengunduh`, `0%`, dengan tombol Batal unduhan, padahal tidak ada proses unduh/impor yang aktif.
- **Akar Masalah:**
  `importModel()` menerbitkan progres awal `{ status: 'downloading', downloadedBytes: 0 }`, namun blok `try` tidak memiliki blok `catch` untuk menerbitkan state terminal. Hanya blok `finally` yang melepaskan lock lifecycle dan abort controller. Akibatnya state `model_states` di basis data dan callback UI tidak pernah menerima status `failed` atau pemulihan status sebelumnya.
- **Solusi:**
  Ditambahkan blok `catch` pada `importModel()` di `src/core/models.ts`:
  - Membersihkan berkas parsial `.partial`.
  - Memeriksa apakah pasangan model dan projector yang valid sebelumnya sudah ada di penyimpanan disk.
  - Memperbarui basis data dan menerbitkan `onProgress()` dengan status terminal jujur:
    - Jika dibatalkan dan pasangan lama valid: status `installed` (data lama aman).
    - Jika dibatalkan tanpa pasangan lama: status `missing`.
    - Jika gagal salin/hash: status `failed` dengan rincian pesan kesalahan.
  - Melempar kembali error (`throw err`) agar antarmuka pemanggil menerima rejection.
  - Blok `finally` memastikan `this.lifecycle.release('importing', token)` selalu tereksekusi sehingga lock tidak bocor.

### Bug 3: Waktu Observasi Tidak Divalidasi Sebelum Disimpan
- **Gejala Runtime:**
  Memasukkan teks `invalid-time` pada editor ISO di halaman lokasi lalu menekan tombol Simpan menyebabkan halaman kembali, menampilkan status `Tersimpan`, dan rincian draf menampilkan `invalid-time (Asia/Jakarta)`.
- **Akar Masalah:**
  `ReportRepository.saveReport()` langsung menjalankan query SQLite `UPDATE reports` tanpa validasi semantik terhadap `observationTime` dan `timezone`. Editor lokasi (`location.tsx`) juga mengandalkan autosave latar belakang tanpa penangkapan error validasi field waktu.
- **Solusi:**
  Dibuat modul validasi murni `apps/qvac-spike/src/core/timeValidation.ts` yang mengevaluasi:
  - `isValidIsoTimestamp()`: Memvalidasi pola ISO 8601 lengkap dengan zona offset/Z eksplisit, mengecek rentang jam/menit/detik, serta mengecek jumlah hari kalender per bulan (termasuk tahun kabisat dan penolakan 29 Februari non-kabisat seperti tahun 1900 dan 2025). Mencegah rollover otomatis Date.parse JavaScript.
  - `isValidIanaTimezone()`: Memvalidasi nama zona waktu IANA yang didukung `Intl.DateTimeFormat` dan menolak raw offset seperti `+07:00` atau `UTC+7`.
  - `validateObservationFields()`: Mengembalikan pesan kesalahan dalam bahasa Indonesia jika waktu atau zona tidak valid.
  Pada `ReportRepository.saveReport()` (`src/core/repository.ts`), validasi ini dipanggil sebelum transaksi penulisan database. Bila waktu tidak valid, saveReport menolak dengan exception sehingga draf yang tersimpan tidak tertimpa data rusak. Pada `location.tsx`, pesan kesalahan ditampilkan ke pengguna via komponen `Notice` dan navigasi kembali dibatalkan saat input tidak valid.

### Bug 4: Zona Waktu Pratinjau / Ekspor Menyesatkan
- **Gejala Runtime:**
  Pratinjau ekspor memuat string mentah `2026-10-29T17:23:08.431Z (Asia/Jakarta)`, di mana penanda `Z` (UTC) bertentangan langsung dengan label `(Asia/Jakarta)`. Di sisi UI, `format.ts` menggunakan `toLocaleString` tanpa parameter `timeZone`, sehingga konversi jam bergantung pada konfigurasi host/perangkat dan bukan zona waktu yang tercatat pada draf laporan.
- **Akar Masalah:**
  `ExportService.previewExport()` merangkai string dengan interpolasi `${obsTime} (${tz})`. Fungsi `formatTimeWithZone()` di `src/ui/format.ts` memanggil `toLocaleString('id-ID', { ... })` tanpa opsi `timeZone: tz`.
- **Solusi:**
  - `src/ui/format.ts`: Memformat objek `Date` menggunakan opsi `{ timeZone: tz }`. Menangani zona waktu Indonesia (Asia/Jakarta untuk WIB, Asia/Makassar untuk WITA, Asia/Jayapura untuk WIT). Jika zona waktu tidak dikenal, waktu ditampilkan dalam format UTC disertai label jujur `(zona tidak dikenal, ditampilkan UTC)`. Jika string ISO rusak, string mentah tetap ditampilkan tanpa crash.
  - `src/core/export.ts`: `previewExport()` kini memformat waktu observasi ke dalam format lokal Indonesia sesuai zona waktu draf (`day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'`) alih-alih menempelkan zona ke raw string `...Z`.

---

## 3. Daftar Berkas yang Terpengaruh

| Berkas | Peran / Perubahan |
|---|---|
| `apps/qvac-spike/src/core/safCopy.ts` | **(Baru)** Helper routing penyalinan: `copyAsync` untuk SAF `content://` dan `File.copy` untuk `file://`. |
| `apps/qvac-spike/src/core/timeValidation.ts` | **(Baru)** Validator murni kalender ISO 8601 (anti-rollover) dan identifikasi zona waktu IANA. |
| `apps/qvac-spike/src/core/models.ts` | Integrasi `copySourceToPrivate()`, penambahan blok `catch` pada `importModel()` untuk reset progres, pembersihan berkas parsial, proteksi pasangan lama, dan jaminan pelepasan lock. |
| `apps/qvac-spike/src/core/repository.ts` | Pengecekan boundary `validateObservationFields()` di `saveReport()` sebelum persistensi SQLite. |
| `apps/qvac-spike/src/core/export.ts` | Format waktu observasi instan pada `previewExport()` sesuai zona waktu eksplisit laporan. |
| `apps/qvac-spike/src/ui/format.ts` | Penggunaan opsi `timeZone` eksplisit pada `toLocaleString` untuk WIB/WITA/WIT dan penanganan jujur zona tak dikenal. |
| `apps/qvac-spike/app/report/[id]/location.tsx` | Menampilkan pesan error validasi draf/autosave dan menahan navigasi kembali jika draf belum tersimpan valid. |
| `apps/qvac-spike/src/__tests__/saf-copy.test.ts` | **(Baru)** Pengujian semantik batas penolakan `File.copy` terhadap `content://` dan pembuktian routing `copyAsync`. |
| `apps/qvac-spike/src/__tests__/import-progress.test.ts` | **(Baru)** Pengujian pemulihan state terminal, pembersihan parsial, proteksi pasangan lama, dan pelepasan lock. |
| `apps/qvac-spike/src/__tests__/time-validation.test.ts` | **(Baru)** Pengujian validasi waktu kalender, penolakan tanggal mustahil, kabisat, dan zona IANA. |
| `apps/qvac-spike/src/__tests__/timezone-format.test.ts` | **(Baru)** Pengujian pemformatan eksplisit waktu instan pada WIB, WITA, WIT, dan host-independent. |

---

## 4. Hasil Pengujian Red-Green dan Verifikasi Kode

Pengujian dieksekusi secara in-band menggunakan Jest dan TypeScript compiler:

### Perintah 1: Typecheck
```powershell
Set-Location "C:\Belajar\Sem5\Niragni\apps\qvac-spike"
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
& "C:\nvm4w\nodejs\npm.cmd" run typecheck
```
**Hasil:**
```text
> niragni@1.0.0 typecheck
> tsc --noEmit
(Exit code: 0 - Bersih tanpa kesalahan tipe)
```

### Perintah 2: Unit & Regression Test Suite
```powershell
Set-Location "C:\Belajar\Sem5\Niragni\apps\qvac-spike"
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
& "C:\nvm4w\nodejs\npm.cmd" test -- --runInBand
```
**Hasil:**
```text
> niragni@1.0.0 test
> jest --runInBand

PASS src/__tests__/time-validation.test.ts
PASS src/__tests__/import-progress.test.ts
PASS src/__tests__/timezone-format.test.ts
PASS src/__tests__/selfie-repository.test.ts
PASS src/__tests__/selfie-export.test.ts
PASS src/__tests__/channel-selector.test.ts
PASS src/__tests__/native-readiness.test.ts
PASS src/__tests__/damkar-only.test.ts
PASS src/__tests__/saf-copy.test.ts
PASS src/__tests__/prompt.test.ts
PASS src/__tests__/manifest.test.ts
PASS src/__tests__/model-list-status.test.ts
PASS src/__tests__/state.test.ts
PASS src/__tests__/pressable-style.test.ts

Test Suites: 14 passed, 14 total
Tests:       223 passed, 223 total
Snapshots:   0 total
Time:        1.771 s
Ran all test suites.
(Exit code: 0)
```

---

## 5. Batasan dan Catatan Verifikasi Fisik

1. **Belum Teruji pada Hardware Fisik (Native SAF):**
   Meskipun pengujian unit membuktikan bahwa `copySourceToPrivate` mengalihkan URI `content://` ke `expo-file-system/legacy.copyAsync` dan menolak jalur `File.copy`, eksekusi riil ContentResolver Android SAF untuk file berukuran 436MB + 108MB pada perangkat Xiaomi 14T hanya dapat dikonfirmasi setelah APK baru dibuat dan diuji secara langsung melalui ADB.
2. **Inference & EXIF Stripping di HP:**
   Keberhasilan inferensi AI offline, stripping metadata EXIF kamera depan asli, dan latency pemrosesan belum dibuktikan pada perangkat fisik karena pengujian perangkat dihentikan oleh pengguna sebelum model baru dimuat ke NPU/GPU.
3. **Preservasi Data & Integritas Workspace:**
   Semua modifikasi dilakukan tanpa menyentuh file konfigurasi produk terlarang, tanpa reset/stash workspace dirty, dan tanpa memodifikasi flag kamera selfie wajib serta channel darurat Damkar.
