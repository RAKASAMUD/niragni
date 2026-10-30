# Verifikasi perbaikan source — 30 Oktober 2026

Status: perubahan source dan tes selesai; belum dibuat APK pengganti dan belum diverifikasi ulang di HP.

## Hasil koordinator

- `npm.cmd test -- --runInBand`: exit 0, **14 suite / 223 tes lulus**. Log `final-tests.log`.
- `npm.cmd run typecheck`: exit 0. Log `final-typecheck.log`.
- Jest menulis progress PASS melalui stderr; PowerShell 5 membungkus sebagian baris dalam NativeCommandError saat redirect. Exit native dan ringkasan Jest sama-sama menunjukkan kelulusan, bukan kegagalan tes.
- Sebelum koreksi akhir: pemeriksaan koordinator `post-agy-tests.log` menunjukkan 213 lulus / 3 gagal (UTC dan alias zona); typecheck bersih. Koordinator memperkuat tes kalender/ISO dan rejection impor, lalu membuktikan 15 gagal / 38 lulus dalam `regression-red.log`. AGY menyelesaikan implementasi terhadap tes itu. Tidak mengklaim seluruh tes baru AGY ditulis sebelum kode produksi.

## Perubahan yang diperiksa

1. `src/core/safCopy.ts` mengarahkan `content://` ke `expo-file-system/legacy.copyAsync`, sementara URI file lokal tetap melalui File.copy. `models.ts` menunggu copy model dan projector ke partial privat, lalu menjalankan pemeriksaan hash dan promosi pasangan yang sudah ada.
2. `models.ts` membersihkan partial dan menerbitkan state terminal pada error/cancel; error dilempar ulang agar catch di layar menampilkan penyebab, lalu finally melepas lifecycle lock.
3. `src/core/timeValidation.ts` memeriksa pola ISO dengan offset/Z, rentang waktu, kalender dan tahun kabisat, serta zona IANA lewat Intl probe. Repository menolak waktu/zona tidak valid sebelum SQL UPDATE. `location.tsx` menampilkan error autosave selain error saat navigasi.
4. `src/ui/format.ts` dan `src/core/export.ts` memformat instan dengan opsi timeZone eksplisit. WIB, WITA, WIT dan UTC tercakup dalam tes; zona tidak dikenal diberi label fallback.

Bukti API lokal yang diperiksa koordinator: `node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt` baris 293–350. Implementasi `copyAsync` memiliki cabang SAF serta cabang `fromUri.scheme == "content"` yang membaca via `context.contentResolver.openInputStream(...)`. Ini bukti jalur implementasi tersedia, **bukan** bukti runtime Xiaomi berhasil menyalin model.

## Kepemilikan dan orkestrasi

- Runtime Orca terverifikasi ready/reachable: `b71c90a0-3d5b-469e-83cf-9cbad47381ae`.
- Run `run_b84ed6854ba1`, task `task_5929f8a634ce`, AGY `term_3afe3f4c-0975-4340-8403-89d0808eb4a3`.
- Attempt awal `ctx_a5f1d6747aad` menampilkan kegagalan kuota provider dan prompt akhir tanpa worker_done, sehingga difence dengan worker-abandon; source dan terminal dipertahankan. Terminal kemudian kembali mengerjakan tugas dengan label model berbeda. Koordinator tidak mengubah model/akun/provider; penyebab perubahan label di luar kendali koordinator belum diverifikasi. Field effective.model Orca null, sehingga tidak ada klaim model efektif/Astra.
- Retry `ctx_56a8616cb0d9` gagal readiness saat terminal masih bekerja. Retry berikutnya `ctx_45963bec525e` diterima, lalu mengirim worker_done succeeded yang sah pada task yang sama.
- Koordinator hanya mengubah tes lanjutan `time-validation.test.ts` dan `import-progress.test.ts`, menyimpan bukti, serta mereview. Percobaan patch produksi koordinator ditolak apply_patch karena sumber telah berubah; tidak diterapkan. AGY menyelesaikan kode produk.
- Worker final di-release; Orca mempertahankan terminal sebagai external_terminal tanpa menghentikan proses. Delivery `delivery_d6c31f6b1b58` diproses dan di-ack.
- Semua source lokal lama yang dirty dipertahankan. Tidak ada stage/commit/push, unduh model/dependensi, perubahan desain, build APK, deploy, kontak instansi, atau akses HP setelah pengguna memintanya kembali.

## Batas bukti dan catatan review

- APK yang terpasang di HP masih SHA256 `2C21EEAA874E7697CE262FB07CB55BBB3924CF2E072C8474B3D5A7843E826D27`; **belum memuat perbaikan source ini**.
- SAF nyata, pembatalan saat menyalin model besar, atomic promotion di filesystem native dan penerapan UI validasi waktu perlu diuji pada APK baru. Tes memakai mock boundary dan tidak menggantikan Android runtime.
- Selfie nyata, retake/remove, ekspor sukses, metadata EXIF aktual, inference teks/foto dan offline, backend terpilih, target <10 detik tetap belum terbukti. Tidak ada bukti penggunaan NPU.
- QA membuktikan status UI tersangkut sesudah error copy; pembatalan awal memang sudah pulih. Lock leak lama tidak terbukti, karena finally lama sudah melepas lock. Penyebutan lock leak atau cancellation selalu macet pada laporan AGY bukan kesimpulan pengujian HP.
- Pada pembatalan impor dengan pasangan berukuran sesuai, fallback terminal `installed` berarti perlu cek lokal; ukuran bukan pembuktian hash/load. Jangan menafsirkannya sebagai siap inference.
- Validator memangkas whitespace untuk pemeriksaan, sedangkan data/formatter belum menormalisasi semua input dengan spasi di tepi. Format tanggal/zona dengan whitespace dan perilaku Intl Hermes native belum tercakup pengujian HP; jangan klaim semua bentuk input sudah teruji.

Laporan runtime asli: `report.md`. Laporan implementer: `../agy-device-bugfix-2026-10-30.md`. Bukti final di atas menjadi acuan jika ada klaim laporan implementer yang lebih luas.
