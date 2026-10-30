# Evaluasi fungsi pada Xiaomi sebelum revisi besar

29 Oktober 2026. APK yang diuji: SHA-256 `C1DFE0C1367022A3560DB08DB7067629BC7314B70E27BCD4FC9C2C746A415F67`, package `com.niragni.bara`, rilis 1.0.0. Ini belum implementasi Figma atau selfie wajib. Xiaomi 14T Android 16, serial `858PQWINIRGMYXKR`, melalui wireless ADB. Pengguna kemudian sengaja memutus HP; tidak ada pengujian perangkat sesudahnya.

## Hasil yang diamati

| Skenario | Hasil dan bukti |
| --- | --- |
| Buat, simpan, force-stop/relaunch, detail, hapus draf | Lulus menurut bukti Kiro: `kiro-final-readiness.md`, screenshot 01–09. |
| Tambah foto sintetis dari picker | Lulus: 640×480, 1 dari 3 foto terlihat. `11-photo-added-status-bug.png`. |
| Hapus foto dari draf | Lulus setelah konfirmasi: kembali 0 foto; `12-photo-removed.xml`. Berkas asli sintetis masih ada melalui `ls -l`, ukuran 7049 byte. |
| Kamera ditolak | Lulus: pesan `Izin kamera ditolak oleh pengguna.`; `13-camera-denied.xml`. |
| Kamera dipulihkan | Lulus untuk membuka kamera: setelah grant, fokus berpindah ke `com.android.camera.OneShotImageCapture`; `14-camera-recovered.txt`. Dibatalkan tanpa mengambil foto ruangan/orang. |
| GPS ditolak | Lulus: posisi tetap kosong dan isian lokasi manual tetap tersedia; `18-location-denied.xml`. Tidak mengambil atau mencatat koordinat pribadi. |
| Buka dan batalkan berbagi | Handler sistem MIUI `XSpaceResolveActivity` teramati; ditutup tanpa memilih penerima. Detail draf mencatat `Dibatalkan` dan `Penerimaan belum diketahui`; `15-share-opened.txt`, `19-share-history.xml`. Ada pula entri `Pilihan berbagi dibuka`; tidak dianggap bukti diterima. |
| EXIF hasil ekspor | BELUM TERBUKTI. Fixture JPEG lokal memiliki GPS EXIF sintetis. Salinan hasil sanitasi berada di penyimpanan privat: external cache tidak ada, `run-as` menolak karena APK rilis tidak debuggable. Tidak mencoba melewati batas akses Android. |
| Kesiapan model | SmolVLM2 dan projector di Download memiliki ukuran sesuai manifest. UI `Perlu cek lokal`. Pemeriksaan checksum/load aktual belum dijalankan sebelum koneksi terputus. Bukan bukti kompatibilitas atau kegagalan model. |

## Temuan yang harus diperbaiki

1. Foto yang baru dipilih bertuliskan `Dibagikan`. Penyebab source: label bergantung pada `selectedForShare`, bukan hasil pengiriman (`photos.tsx`). Gunakan label pemilihan, bukan pengiriman.
2. Daftar draf bertuliskan `Pernah dibagikan` jika ada upaya berbagi apa pun, termasuk pembatalan (`index.tsx`). Harus membedakan aktivitas/batal/hasil tidak diketahui.
3. `ModelManager.listModels()` hanya mempertahankan cached `ready`/`installed`. Cached `failed`/`incompatible` dapat kembali menjadi `installed` dan kehilangan alasan error ketika berkas masih ada/ukuran cocok. Ini temuan source, belum bukti model di HP benar-benar gagal memuat.
4. Sebagian kendali awal ADB tidak mengenai target karena ada display virtual. Ketukan berikutnya memakai `input -d 0`. Hambatan otomasi ini tidak dianggap bug aplikasi atau bukti simpan macet.

## Privasi dan sisa pemulihan

- Hanya draf `QA-NIRAGNI-20261029-SYNTHETIC` dan foto uji buatan yang digunakan. Tidak ada laporan dikirim, nomor ditelepon, foto pribadi dipilih, atau screenshot galeri pribadi disimpan.
- Fixture yang dibuat: `/sdcard/Download/Niragni-QA-Synthetic.jpg`; salinan host `niragni-qa-fixture.jpg`. Draf QA masih tersedia untuk tinjauan pengguna, bukan laporan nyata.
- Izin kamera awal `granted=false`, sempat diberikan untuk tes. Percobaan revoke/pemulihan flag berlangsung ketika ADB terputus dan hasil akhirnya BELUM TERKONFIRMASI. Jangan mengklaim seluruh izin sudah dipulihkan. GPS awal ditolak dan tetap ditolak pada tes.
- File XML sementara `coordinator-ui.xml` ditimpa antarskenario; hanya berkas bernomor pada tabel yang menjadi bukti tetap. Output XML lama setelah kegagalan pull tidak dianggap pengamatan baru.
- Sebelum revisi besar, koordinator menjalankan `npm.cmd test -- --runInBand` (6 suite/58 tes lulus) dan `npm.cmd run typecheck` (exit 0). Hasil ini baseline; tidak membuktikan perubahan setelahnya.
