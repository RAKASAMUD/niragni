# Kesiapan non-AI setelah desain Figma

29 Oktober 2026. Pengguna meminta AGY dan Kiro mengerjakan sisa pekerjaan selain implementasi UI Figma dan pengujian AI lokal. Tidak ada izin publish, deploy, push, biaya, atau kontak instansi.

## Orkestrasi dan kepemilikan

Runtime Orca terverifikasi `ready`, reachable, ID `2463bb74-039f-4e30-af6a-d69ae6131267`. Run `run_b84ed6854ba1` dilanjutkan; tidak membuat run/worker duplikat. Receipt model effective kedua terminal reuse adalah `null`; tidak ada klaim Astra terverifikasi.

| Pelaksana | Task / Dispatch | File yang dimiliki |
| --- | --- | --- |
| AGY | `task_01fdcf72f775` / `ctx_8e257cb22d86` | `src/core/channel-directory.ts`, `src/core/channels.ts`, selector murni dan tes khususnya, `docs/channel-directory/**`, `work/reports/agy-final-readiness.md` |
| Kiro | `task_14e6cc63bfff` / `ctx_e80a0b018925` | `scripts/Backup-NiragniSigning.ps1`, tes/fixture helper, `work/reports/kiro-final-readiness.md`, `work/reports/non-ai-qa/**`, checksum APK; satu-satunya pemegang build/perangkat |
| Koordinator | Run di atas | Kontrak bersama, integrasi, review diff dan `docs/implementation-status.md`; tidak mengubah file milik worker tanpa koordinasi |

Path source pada tabel relatif terhadap `apps/qvac-spike/`. Semua bekerja di folder yang sama; perubahan lokal sebelumnya dipertahankan. Build akhir menunggu checkpoint source kanal stabil agar tidak mengambil edit setengah jadi.

AGY sempat menerima prompt tanpa memulai turn. Pemeriksaan layar menunjukkan teks tertahan pada composer; carriage return dikirim tanpa mengulang isi tugas. Output berikutnya menunjukkan Working dan pembacaan scope. Kiro menunjukkan pembacaan skill/helper dan heartbeat. Bukti mulai bukan bukti selesai.

## Batas hasil

- Direktori hanya memuat kontak yang sumber dan kegunaannya dapat ditunjukkan; tercantum resmi tidak membuktikan kanal sedang operasional. Kekosongan wilayah harus tampak jelas.
- Selector wilayah menerima pilihan lokasi kejadian eksplisit. Posisi GPS pelapor tidak otomatis menjadi lokasi kejadian. Penyambungan selector ke UI Figma tetap bagian implementasi UI berikutnya.
- Uji HP memakai koneksi yang tersedia, fixture sintetis dan draf QA terpisah. Tidak mematikan jaringan, menjalankan AI, membuka foto pribadi, menghapus data aplikasi, mengirim laporan, atau menelepon.
- Backup asli belum terbukti sampai pengguna memilih tujuan dan memasukkan passphrase secara privat pada prompt lokal. Tes dummy tidak membuktikan backup kunci asli.
- Lisensi font/background Figma harus dibedakan dari ketersediaan font di editor. Tidak ada izin distribusi yang diasumsikan.
- Tidak menaikkan versi atau menyatakan siap rilis hanya karena source/build lolos. iOS tetap memerlukan bukti build dan perangkat tersendiri.

## Hasil

Menunggu laporan worker dan verifikasi integrasi. Status ini akan diperbarui berdasarkan bukti aktual.

Review saat pengerjaan:

- `.gitignore` ditambah `*.niragnibak`; `git check-ignore --no-index example.niragnibak` mengembalikan path tersebut. Tidak ada backup asli dibuat.
- Uji awal helper menyalin urutan restore ke DryRun. Koordinator meminta satu fungsi restore bersama agar tes memakai jalur produksi, ditambah pembuktian tidak ada file rahasia setelah kegagalan ACL/penulisan kedua.
- Selector awal memakai substring provinsi/label dan ekstraksi lokasi teks. Koordinator menolak kecocokan yurisdiksi tersebut: Riau/Kepulauan Riau, Papua/Papua Barat Daya, dan kontak kota untuk seluruh provinsi harus dipisahkan. Meminta seleksi wilayah eksplisit dengan metadata terkurasi dan regresi negatif.
- Koneksi ADB awal kosong. Pengguna kemudian menyatakan debugging sudah dinyalakan; Kiro diberi instruksi rediscovery tanpa mematikan jaringan. Status terhubung belum diklaim sebelum bukti Kiro.
