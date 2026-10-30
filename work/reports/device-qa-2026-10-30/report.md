# Pengujian Xiaomi 14T — 30 Oktober 2026

Koordinator melakukan pengujian APK rilis pada HP fisik melalui wireless ADB. Pengguna mengakhiri penggunaan HP untuk pengujian setelah pemeriksaan selesai; tidak ada kendali HP lanjutan yang diizinkan tanpa permintaan baru.

## Artefak dan lingkungan

- Package `com.niragni.bara`, versionName `1.0.0`, versionCode `1`, minSdk 31, targetSdk 36.
- APK `artifacts/niragni-android.apk`, 243398110 byte, SHA256 `2C21EEAA874E7697CE262FB07CB55BBB3924CF2E072C8474B3D5A7843E826D27`.
- Instalasi ADB `install -r`: `Success`, lastUpdateTime perangkat `2026-10-30 00:21:58`. Paket tidak terdeteksi sebelum instalasi ini.
- Xiaomi `2406APNFAG` / `degas_global`, Android 16, RAM kernel-usable `11585072 kB`, MemAvailable awal `3902416 kB`, `/data` kosong `165G` menurut df.
- Jaringan tetap aktif sesuai pilihan pengguna. Tidak ada klaim inference offline atau latency AI.
- Pengguna memilih melewati pengambilan selfie nyata dan menghentikan pengujian AI pada bug impor; tidak mengunduh ulang model.
- Snapshot XML dan PNG bernomor dalam folder ini adalah bukti UI. Nama beberapa snapshot mencerminkan tujuan sebelum aksi, bukan hasil; tabel ini menjelaskan pengamatan aktual.

## Hasil runtime

| Alur | Hasil | Bukti |
| --- | --- | --- |
| Launch dan tampilan revisi | Logo dan UI pastel muncul; bukan bukti kesetaraan pixel/font penuh dengan Figma | `03-report-home`, `04-create-empty` |
| Buat dan autosave catatan | Tersimpan; draf muncul setelah force-stop/relaunch | `04-create-empty`, `05-persisted-draft` |
| Edit catatan dan lokasi manual | Perubahan tersimpan; lokasi tetap ada pada detail/pratinjau | `17-invalid-time-save-result`, `32-edit-with-photos`, `36-share-reviewed`, `55-final-persistence` |
| Izin GPS ditolak | Pesan lokasi tidak tersedia; lokasi manual tetap dapat disimpan | `13-gps-permission`, `14-location-save-time`, `17-invalid-time-save-result` |
| Pilih foto sintetis | JPEG uji 640×480 diimpor; bukan foto pribadi | `23-photo-import-result` |
| Pilih/batalkan foto untuk berbagi | Label berubah antara dipilih/tidak dipilih | `23-photo-import-result`, `24-photo-deselected`, `25-photo-two` |
| Batas tiga foto | 3/3; tombol kamera dan galeri disabled; ketukan tombol disabled tidak membuka picker | `27-photo-three`, `28-photo-max-actions`, `29-delete-photo-confirm` |
| Hapus foto: batal dan konfirmasi | Batal tetap 3 foto; konfirmasi menjadi 2 foto; berkas galeri asli tetap 7049 byte | `30-delete-photo-cancelled`, `31-delete-photo-result`, pemeriksaan ls akhir |
| Model belum siap | Generate menawarkan pengisian manual, tanpa macet/crash yang teramati | `33-ai-model-missing`, `34-manual-review` |
| Ringkasan manual | Ringkasan yang disunting muncul dalam pratinjau | `34-manual-review`, `36-share-reviewed` |
| Selfie wajib | Tombol berbagi umum disabled dan tetap di halaman saat diketuk; tombol email Damkar juga disabled | `08-selfie-gate-actions`, `09-disabled-share-tapped`, `39-local-damkar` |
| Izin kamera selfie ditolak | Prompt izin muncul; ditolak; tidak mengambil foto, berbagi tetap disabled | `10-camera-permission`, `11-selfie-permission-denied` |
| Kanal wilayah tidak tersedia | Atlantis menampilkan gap cakupan, tanpa nomor pengganti | `38-unknown-city` |
| Kanal lokal yang tersedia | Semarang menampilkan kanal telepon/email Damkar setempat; sumber tidak dibuka, tidak ada panggilan/pesan | `39-local-damkar` |
| Impor model dibatalkan | Kembali ke aplikasi dengan pesan pembatalan; status belum diunduh | `41-import-cancelled` |
| Impor model dan projector dari Download | GAGAL: File.copy menolak content URI dari SAF | `42-model-import-verification` |
| Pemulihan setelah gagal impor | UI sempat stuck Mengunduh 0%; tombol batal memulihkan status belum diunduh; relaunch masih dapat dipakai | `42-model-import-verification`, `43-import-stuck-cancel`, `46-readiness-recovery` |
| Konfirmasi unduhan | Ukuran ditampilkan dan tombol Batal dapat kembali tanpa memulai unduh | `47-download-confirm-no-start`, `48-main-draft-retained` |
| Hapus draf: batal dan konfirmasi | Batal mempertahankan draf kedua; konfirmasi menghapusnya tanpa menghapus draf pertama | `50-two-drafts`, `53-delete-draft-cancelled`, `54-delete-draft-success` |
| Persistensi akhir | Setelah force-stop/relaunch, satu draf utama dengan catatan/lokasi tetap ada | `55-final-persistence` |

## Empat bug untuk perbaikan

1. **P1 — Impor model lokal tidak bekerja dengan Android SAF.** Pilih SmolVLM2 GGUF, lalu projector GGUF dari Downloads. Runtime: `Call to function 'FileSystemFile.copy' has been rejected ... This method cannot be used with content URIs: content://com.android.providers.downloads.documents/document/msf%3A1000308073`. Source `src/core/models.ts` menggunakan `copyToCacheDirectory: false` lalu `new File(contentUri).copy(...)`. Ini bukti kegagalan jalur impor, bukan bukti model tidak kompatibel.
2. **P2 — Status progress salah setelah exception impor.** Setelah error di atas, kartu tetap `Mengunduh`, `0%`, tombol batal unduhan; tidak ada impor berjalan. Source menerbitkan `downloading`, sedangkan finally hanya melepas lock/controller, tanpa memulihkan state progres pada error. Tombol batal mengembalikan UI ke belum diunduh.
3. **P1/P2 — Waktu tidak divalidasi sebelum disimpan.** Masukkan `invalid-time` pada editor ISO, tekan Simpan. Halaman kembali, status `Tersimpan`, rincian menampilkan `invalid-time (Asia/Jakarta)`. Bukti `15-time-editor`, `16-time-invalid`, `17-invalid-time-save-result`. Waktu draf uji sudah dipulihkan ke `2026-10-29T17:23:08.431Z` pada `32-edit-with-photos`.
4. **P2 — Zona waktu pratinjau/teks ekspor menyesatkan.** Pratinjau memuat `2026-10-29T17:23:08.431Z (Asia/Jakarta)` sementara UI menampilkan `30 Okt 2026, 00.23 (Asia/Jakarta)`. Source `src/core/export.ts` langsung menempelkan timezone ke raw timestamp. Selain itu `src/ui/format.ts` memakai toLocaleString tanpa opsi timeZone, sehingga label zona berbeda dari zona perangkat dapat keliru; bagian kedua adalah temuan source, belum diuji dengan zona perangkat diubah.

## Batas bukti dan kondisi akhir

- Selfie nyata, retake/remove selfie, jalur sukses berbagi, EXIF hasil ekspor, dan hasil diterima penerima **belum diuji**. Tidak memalsukan source kamera agar bisa melewati kewajiban selfie.
- Inference teks/foto, hash model dalam aplikasi, backend GPU terpilih, RAM puncak inferensi dan target <10 detik **belum terbukti** karena impor gagal dan pengguna menunda AI. Tidak ada unduhan ulang.
- Model sumber tetap ada di Download: model 436808704 byte dan projector 108785184 byte. Ukuran cocok saja bukan validasi hash/load/inference.
- Satu draf uji utama `QA-NIRAGNI-20261030 UJI SINTETIS...` tersisa dengan dua salinan foto sintetis. Draf kosong kedua sudah dihapus. Tidak menghapus data pengguna.
- Kamera, coarse/fine GPS pada pemeriksaan akhir sama-sama `granted=false`; flag `USER_SET` bertambah karena pilihan Tolak. Tidak mengklaim semua flag persis seperti awal.
- Snapshot memori home sesudah relaunch: TOTAL PSS 162632 kB, RSS 309282 kB. Ini bukan peak RAM, benchmark atau RAM inferensi.
- Buffer crash terbatas yang diperiksa tidak menampilkan baris terkait Niragni/QVAC; ini bukan jaminan tidak ada crash pada setiap kondisi.
- Tidak ada laporan dikirim, dialer/nomor dihubungi, sumber web dibuka, penghapusan model, pemutusan Wi-Fi atau perubahan kode produk saat pengujian.
- Kendali ADB memakai input display 0, screencap physical display `4627039422300187648`. Kegagalan screencap awal menggunakan ID 0 adalah kesalahan helper otomasi, bukan bug aplikasi.
- Input ADB awal memakai literal `%20` sebelum diperbaiki memakai `%s`; catatan akhir sudah terbaca normal. Ini bukan bug aplikasi.
- Pengujian HP berhenti saat pengguna meminta HP kembali. Perbaikan berikutnya hanya di laptop dan memerlukan pengujian APK baru di kesempatan lain.
