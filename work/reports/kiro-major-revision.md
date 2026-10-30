# Kiro Major Revision Report — Repository Cleanup & Selfie Tests

**Agent:** AGY replacement for Kiro (per revision doc handoff)  
**Task:** `task_32a376a18a61` (follow-up to `task_7c13ae83de02`)  
**Dispatch:** `ctx_e43e65458393`  
**Terminal:** `term_0038f0a3-1216-4928-a43f-abcbc80cca51`  
**Date:** 29 Oktober 2026  

---

## 1. What Was Done

### 1.1 Fixed Parser-Breaking Duplicate Code Block in `repository.ts`
- **Finding:** Baris 697–802 sebelumnya memuat sisa kode duplikat yang merusak parser TypeScript setelah penutupan kurung kurawal kelas pada baris 696 (`const * as ImagePicker = await import(...)`).
- **Fix:** Seluruh blok rusak (baris 697–802) telah dibersihkan secara tuntas. Blok utama yang aktif mengimplementasikan penamaan berkas berbasis nonce unik, permintaan izin kamera sebelum membuka kamera depan, penanganan atomik penggantian swafoto dalam transaksi eksklusif, serta rollback berkas baru jika transaksi gagal.

### 1.2 Explicit Deletion of `sender_selfies` in `deleteReport`
- **Finding:** `deleteReport` menghapus `share_attempts`, `attachments`, dan `reports`, namun sebelumnya belum secara eksplisit mengeksekusi `DELETE FROM sender_selfies WHERE reportId = ?`.
- **Fix:** Menambahkan `DELETE FROM sender_selfies WHERE reportId = ?` sebelum penghapusan baris induk `reports`, menjamin integritas referensial dan pembersihan terurut.

### 1.3 Behavioral Unit Tests Expansion in `selfie-repository.test.ts` (18 Tests Total)
Menindaklanjuti tinjauan koordinator terkait verifikasi nyata rollback kegagalan DB dan penundaan penghapusan berkas lama:
1. **Frozen Clock Nonce Uniqueness Test:** Menguji dua pemanggilan `captureSenderSelfie` dengan `Date.now` dibekukan pada milidetik yang sama persis (`fixedTs`). Membuktikan bahwa penggunaan nonce acak menghasilkan nama berkas (`selfie_<timestamp>_<nonce>.jpg`) dan ID swafoto yang sepenuhnya berbeda tanpa risiko tabrakan.
2. **Database Failure Rollback Test:** Menyuntikkan kegagalan transaksi nyata pada batas antarmuka native mock (`mockTxn.runAsync` melempar galat disk penuh / constraint). Memverifikasi secara ketat bahwa:
   - Baris swafoto lama di database tetap terjaga (*rollback* transaksi).
   - Berkas fisik lama di disk tetap utuh dan tidak terhapus.
   - HANYA berkas yang baru saja di-*stage* yang dihapus (*unlinked*) oleh penangan `catch`.
   - Data dan berkas laporan lain sama sekali tidak terpengaruh (*cross-report isolation*).
3. **Deferred Commit Old File Deletion Test:** Menahan resolusi *promise commit* transaksi eksklusif untuk membuktikan bahwa berkas lama masih tetap ada di penyimpanan privat selama transaksi berlangsung (*pre-commit*), dan baru dihapus setelah *promise* transaksi berhasil terselesaikan secara penuh (*post-commit*).

---

## 2. Testing Boundaries & Evidence Limitations

> [!IMPORTANT]
> **Batasan Pengujian & Mocking:**
> Pengujian unit pada `selfie-repository.test.ts` memverifikasi orkestrasi logika aplikasi dan pengurutan (*sequencing*) pada `ReportRepository`:
> 1. Bahwa `ReportRepository` menunda penghapusan berkas lama hingga transaksi database berhasil di-*commit*.
> 2. Bahwa `ReportRepository` menangkap kegagalan transaksi, menghapus berkas yang baru di-*stage*, serta mempertahankan berkas lama.
>
> Pengujian ini memvalidasi batas antarmuka dependensi mock (`withExclusiveTransactionAsync` dan `runAsync`), **bukan membuktikan perilaku runtime engine C/JNI Expo SQLite native** (seperti Write-Ahead Logging / WAL crash recovery atau penguncian berkas OS pada perangkat keras riil). Validasi fisik penuh tetap memerlukan eksekusi APK pada perangkat Android nyata.

---

## 3. Test Suites Summary

| Test Case | Status | Cakupan Verifikasi |
|---|---|---|
| Camera permission required | PASS | Menolak jika izin ditolak, tidak membuka kamera |
| Front camera + exif disabled | PASS | Memastikan parameter kamera depan & exif mati |
| User cancel returns null | PASS | Batal kamera tidak menimbulkan side effect DB/berkas |
| Nonexistent report throws | PASS | Menolak ID draf yang tidak terdaftar |
| Unique nonce filenames | PASS | Dua jepretan menghasilkan ID dan URI berbeda |
| **Unique nonce with frozen Date.now** | **PASS** | **Jam dibekukan pada ms sama tetap menghasilkan URI/ID berbeda** |
| Atomic replace (SQL ordering) | PASS | Log SQL mencatat DELETE sebelum INSERT |
| **Rollback on transaction failure** | **PASS** | **Injeksi galat DB: baris lama & berkas lama utuh, berkas baru dihapus** |
| **Deferred commit old file deletion** | **PASS** | **Berkas lama masih ada pre-commit, baru dihapus post-commit** |
| removeSenderSelfie | PASS | Menghapus baris DB dan berkas fisik |
| Remove nonexistent throws | PASS | Validasi eksistensi laporan |
| Stale DB row (missing file) | PASS | `getReport` mengembalikan `senderSelfie: null` jika berkas hilang |
| Valid file on disk | PASS | `getReport` mengembalikan data swafoto lengkap |
| Old reports backward compat | PASS | Draf tanpa baris swafoto menghasilkan `null` aman |
| deleteReport explicit cleanup | PASS | Urutan DELETE `sender_selfies` sebelum `reports` |
| init() orphan cleanup | PASS | Memasukkan URI swafoto ke set aktif agar tidak terhapus |
| Cross-report isolation (capture) | PASS | Operasi jepret tidak mengganggu swafoto laporan lain |
| Cross-report isolation (remove) | PASS | Operasi hapus tidak mengganggu swafoto laporan lain |

**Hasil Eksekusi:**
- `selfie-repository.test.ts`: **18 passed, 18 total**.
- Proyek Keseluruhan: **10 test suites passed, 143 tests passed, 0 failed**.

---

## 4. TypeScript Typecheck Status

- **Perintah:** `npm.cmd --prefix apps/qvac-spike run typecheck` (`tsc --noEmit`)
- **Hasil:** **0 errors di seluruh proyek.** (Galat pada `generate.tsx` dan `services.web.ts` telah sepenuhnya diselesaikan).

---

## 5. Files Modified

| File | Status | Perubahan |
|---|---|---|
| `apps/qvac-spike/src/__tests__/selfie-repository.test.ts` | Modified | Menambahkan 3 pengujian mendalam (frozen clock nonce, simulasi rollback kegagalan DB, dan penundaan commit berkas lama), dokumentasi batasan mock runtime, serta snapshotting transaksi. |
| `work/reports/kiro-major-revision.md` | Modified | Memperbarui laporan dengan bukti 18 pengujian lulus, status typecheck 0-error, serta klarifikasi batasan mock vs runtime device. |

---

## 6. Sisa Tugas / Gaps

1. **Uji Fisik Perangkat (On-Device Testing):** Pengujian fisik kamera depan native, persistensi SQLite SQLiteDatabase pada penyimpanan lokal Android `/data/user/0/com.niragni/files`, dan sanitasi EXIF biner perangkat sesungguhnya diuji oleh koordinator/Kiro pada APK rilis terpasang.
2. **Build APK Final:** Dilakukan oleh koordinator setelah seluruh verifikasi non-UI dan UI selesai stabil.
