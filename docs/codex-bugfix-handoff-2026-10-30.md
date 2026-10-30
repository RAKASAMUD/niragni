# Handoff perbaikan bug Niragni — 30 Oktober 2026

## Tujuan dan status saat diserahkan

Lanjutkan perbaikan bug di aplikasi Android Niragni (sebelumnya Bara), bukan membuat aplikasi baru. Pengguna meminta handoff ini untuk Codex lain. **Belum ada perubahan source untuk kumpulan bug terbaru di bawah.** Penelusuran awal sudah dilakukan; penyebab tombol berbagi belum terbukti. Jangan menyatakan bug selesai hanya karena build atau unit test lulus.

Workspace: `C:\Belajar\Sem5\Niragni`. Aplikasi: `apps/qvac-spike`. Shell: PowerShell. Banyak file modified/untracked adalah pekerjaan sah sebelumnya; jangan reset, checkout massal, clean, atau menimpa semuanya. Periksa status dan diff sebelum mengedit. Dokumen status lama memiliki bagian historis yang sudah tidak berlaku; gunakan tanggal dan bukti spesifik.

## Laporan pengguna dan keputusan yang sudah final

1. Menekan **“Buka pilihan berbagi” tidak bereaksi sama sekali**, tanpa pesan error. Pengguna sudah memastikan **selfie tersimpan**. Ini bukan laporan pengguna yang belum mengambil selfie.
2. Kanal bantuan WhatsApp harus langsung membuka **`https://wa.me/<nomor>`**, bukan website instansi.
3. Ketika model sedang diunduh/diverifikasi, pengguna kesulitan membuat laporan; alur laporan juga mengganggu proses model. Draf manual harus tetap dapat dibuat/disimpan tanpa menunggu AI.
4. Setelah keluar dari proses verifikasi lalu kembali, aplikasi meminta unduh ulang. Pengguna mempertanyakan verifikasi yang sangat lama. Jangan menghapus pemeriksaan integritas sebagai jalan pintas; cari pemulihan berkas dan proses yang benar.
5. Buang sisa komponen lama yang memang tidak digunakan setelah memeriksa referensi dan routing.

**Kewajiban selfie tetap berlaku sebelum laporan dibagikan.** Draf boleh dibuat tanpa selfie. Selfie diambil melalui kamera, disimpan privat, terpisah dari foto kejadian dan tidak menjadi input AI. Keterangan ekspor: “foto pengirim, identitas belum diverifikasi”. Jangan memperbaiki tombol dengan menghapus validasi ini atau menyediakan bypass salin teks laporan.

## Batas tindakan

- Pengguna sekarang menguji sendiri. **Jangan ambil alih HP/ADB, memasang APK, mematikan jaringan, menghapus data, atau mengambil selfie tanpa permintaan baru.** Alamat wireless ADB dari percakapan lama bukan bukti koneksi masih aktif maupun izin baru.
- Jangan mengirim laporan, menghubungi Damkar/instansi, menelepon nomor nyata, publish, deploy, push, atau mengeluarkan biaya.
- Tetap Indonesia, kanal Damkar lokal yang terverifikasi; jangan menambahkan nomor atau menganggap nomor telepon pasti memiliki WhatsApp.
- Pertahankan desain dan logo Figma yang disetujui: `https://www.figma.com/design/CxJXhoCGPzwUYscUHsR7EP`. Cyan `#B2D9EA`, peach `#EAC3B2`, latar terang/asap, bayangan tipis, ikon tanpa background. Ini tugas perbaikan fungsi, bukan mendesain ulang.
- iOS tetap target, belum ada perangkat/akun pengujian. Jangan mengklaim kompatibilitas dari dokumentasi.
- Jawab singkat dalam Bahasa Indonesia; berikan perkembangan selama pekerjaan. Tanyakan hanya keputusan penting yang belum terjawab.

## Instruksi dan orchestration

Baca AGENTS.md yang berlaku dan cek `.skills` terlebih dahulu. Terapkan `github-test-authorization` di `C:/Users/hp5cd/.agents/skills/github-test-authorization/SKILL.md`, `systematic-debugging`, serta pengujian regresi yang proporsional. Jangan menambahkan akun/backend keamanan yang tidak terkait aplikasi lokal ini.

Preferensi pengguna sebelumnya: koordinator mengawasi AGY dan Kiro melalui Orca, kepemilikan file jelas; Kiro sudah kehabisan kuota. **Pada pemeriksaan terakhir**, `orca status --json` (termasuk di luar sandbox) menunjukkan app tidak berjalan dan runtime tidak terjangkau. Satu percobaan `orca open --json` berakhir `runtime_open_timeout`. Hal ini sudah diberitahukan ke pengguna dan pekerjaan dilanjutkan inline. Jangan terus membuka ulang atau mengklaim AGY/Astra aktif.

Jika ingin memakai Orca, baca skill orchestration dan `orca-cli`, verifikasi runtime serta model effective terlebih dahulu. Run historis `run_b84ed6854ba1` bukan bukti sesi masih hidup. Jangan mengganti mekanisme menjadi child Codex lalu menyebutnya AGY. Jika runtime tersedia dan delegasi dipakai, satu pemilik untuk tiap file; koordinator menangani kontrak bersama, dependensi, konfigurasi, dan build.

## Peta kode dan temuan awal (hipotesis, bukan diagnosis final)

Semua path bagian ini relatif terhadap `apps/qvac-spike/`.

### A. Tombol berbagi diam — prioritas utama

- `app/report/[id]/share.tsx`: `share()` memakai `busyRef` dan state `busy`; return awal jika busy atau report kosong. Tombol disabled saat `!hasSelfie || busy`. Reload melalui focus effect, error ditampilkan di bagian atas scroll. Status UI yang kedaluwarsa, busy yang tertahan, atau error di luar viewport perlu diuji; **belum terbukti sebagai penyebab**.
- `src/core/export.ts`: membaca ulang report tersimpan, memvalidasi selfie kamera/milik report/path privat/file tidak kosong, re-encode foto ke JPEG, menyalin hasil ke cache ekspor, lalu `Share.open({ title, message, urls })` dari `react-native-share`.
- Periksa setiap tahap dengan diagnostik aman (tanpa isi laporan/foto/data pribadi): press diterima, validasi, sanitasi, copy file, native share. Bedakan proses persiapan yang macet dengan chooser yang gagal dibuka. Berikan status/error dekat tombol dan pastikan mutex pulih saat gagal/batal. Jangan menambah timeout yang memicu chooser kedua saat pengguna masih memilih.
- Installed `react-native-share` 12.3.1 memiliki FileProvider `cache-path "/"`. File cache aplikasi secara konsep didukung; jangan mengklaim mismatch provider tanpa bukti. Periksa API versi terpasang sebelum menambah opsi MIME/storage.
- Potensi bug terpisah: UI mengambil `shareAttempts[array.length-1]`, sedangkan repository menghidrasi urutan DESC. Verifikasi sebelum memperbaiki label riwayat.
- Regresi relevan: `src/__tests__/selfie-export.test.ts`, `selfie-repository.test.ts`. Mock native share tidak membuktikan chooser muncul di Android. Validasi selfie harus tetap gagal untuk selfie hilang, salah pemilik, path traversal, file kosong, dan sanitasi gagal.

### B. Kanal bantuan langsung ke WhatsApp

- `src/core/channels.ts`: `openDialer(channelId)` sudah memiliki cabang phone→tel, whatsapp→wa.me, email→mailto. Periksa validasi entri aktif/terverifikasi dan normalisasi nomor; jangan asal mengubah landline menjadi WA.
- `app/(tabs)/channels.tsx`: aksi utama tampak hanya untuk telepon; tombol sumber mengarah ke website. Inilah kandidat lokasi perbaikan untuk permintaan WA.
- `app/report/[id]/share.tsx`: pemilihan channel saat ini tetap memakai chooser generik, sementara `openSource` membuka website. Bedakan “buka chat bantuan” dengan “bagikan laporan beserta lampiran”. URL wa.me tidak membawa lampiran foto; jangan mengklaim sebaliknya atau mengirim otomatis.
- Simpan metadata sumber website dalam direktori untuk provenance meskipun tombol website tidak lagi menjadi aksi kontak utama. Uji URL dengan mock, tanpa kontak nyata.

### C. Unduh/verifikasi mengganggu laporan dan hilang saat keluar

- `src/core/index.ts`: service report dan model; operasi report tidak secara eksplisit mengambil lifecycle lock model.
- `src/core/database.ts`: SQLite WAL dan antrean `withWriteLock`. Jangan menyimpulkan lock database tertahan selama hash tanpa bukti.
- `app/(tabs)/index.tsx`: load memakai `Promise.all([listReports(), listModels()])`; kegagalan/kelambatan model dapat menahan tampilan laporan. Buat pemuatan laporan independen jika diagnosis mengonfirmasi. Aksi create perlu feedback dan pencegahan ketukan ganda.
- `src/core/lifecycle.ts`: background/inactive membatalkan operasi `downloading`; tahap verifikasi masih berada dalam operasi lifecycle tersebut.
- `src/core/hasher.ts`: hash SHA-256 JS bertahap, chunk 256KB dan yield setiap 2MB. Uji respons UI; jangan mengarang API native hash yang tidak tersedia atau membaca seluruh model ke base64.
- `src/core/models.ts`: model/projector di folder privat `bara_models/<candidateId>`, unduh ke `.partial`, hash keduanya, promosi ke final, lalu actual worker load/unload. Retry membersihkan partial; catch juga membersihkan partial. `listModels()` hanya memeriksa path final. Pasangan lengkap yang masih menunggu verifikasi bisa hilang/diabaikan dan memaksa unduh ulang.
- Catch pembatalan juga berpotensi menandai pasangan final `ready` hanya dari keberadaan/ukuran. **Jangan menganggap ukuran atau dokumentasi sebagai bukti model siap.** Status ready harus berdasar pemeriksaan load nyata yang benar.
- Rancang pemulihan yang mempertahankan staged file lengkap dan melanjutkan verifikasi tanpa mengunduh lagi; hapus file rusak saat checksum gagal dan tangani disk penuh. Pertahankan pasangan final lama jika penggantian gagal. Periksa `atomicPairPromotion` dan pembatalan pada tiap tahap.
- UI progress lokal bisa hilang saat route di-unmount; periksa state operasi yang otoritatif dan pemulihannya setelah proses mati. Jangan sekadar menyembunyikan spinner atau melepaskan lifecycle lock sementara pekerjaan masih aktif.
- Regresi relevan: `import-progress.test.ts`, `model-list-status.test.ts`, `saf-copy.test.ts`, `native-readiness.test.ts` serta unit test models/lifecycle yang sudah ada. Bug SAF sebelumnya sudah diperbaiki; jangan dikembalikan.

### D. Pembersihan komponen lama

Kandidat untuk diaudit: `app/_ui-review.tsx`, `src/ui/PreviewBanner.tsx`, `PreviewBanner.web.tsx`, integrasi banner di `app/_layout.tsx`. Expo Router dapat mengekspos route tanpa import eksplisit, jadi hasil pencarian import kosong belum cukup membuktikan unused. `services.web.ts` masih merupakan adapter platform; jangan hapus tanpa audit. Jangan menghapus dokumen baseline, bukti QA, aset Figma yang dipakai, atau perubahan agent sebelumnya.

## Bukti dan baseline sebelum perbaikan baru

- Pengujian terdahulu: **223 tests / 14 suites lulus**, typecheck exit 0. Bukti: `work/reports/device-qa-2026-10-30/final-tests.log`, `final-typecheck.log`, dan `fix-verification.md`. Ini bukan hasil setelah perbaikan bug terbaru, dan bukan bukti share native atau AI offline berhasil.
- QA perangkat sebelumnya: `work/reports/device-qa-2026-10-30/report.md` dan snapshot. Banyak hasil berasal dari APK sebelum perbaikan terbaru; periksa versi/tanggal.
- APK terakhir yang dibangun: `artifacts/niragni-android-compressed-2026-10-30.apk`, alias `artifacts/niragni-android.apk`, **86.371.446 bytes**. SHA-256 `36308987CB85E3DA38BB2D91E52E41C44B8072C4A10F0633C30048D4D8720C64`.
- Bukti kompresi: `work/reports/apk-compression-2026-10-30/report.md`, `comparison.json`, log build dan signature. Pertahankan `useLegacyPackaging: true` dan `enableBundleCompression: true` serta arm64-only; jangan kembali ke APK 243MB.
- Sertifikat rilis SHA-256: `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`. Kunci di luar repo, jangan mencetak/memasukkan secret. APK lama dan APK baru berbeda isi; ukur/hash ulang artefak akhir.
- SDK/package QVAC dipin **0.22.0**; React Native 0.81.5, Expo 54. Model tidak dibundel. Model teks+foto sekitar **545.593.888 bytes total**: SmolVLM2 500M 436.808.704 + projector 108.785.184 bytes. Baca manifest aktual untuk URL, hash, dan lisensi sebelum mengubahnya.
- Perangkat yang pernah diuji: Xiaomi 14T / 2406APNFAG, Android 16. **Inference teks+foto dengan internet dimatikan belum terbukti.** Unduhan, checksum, load, dan inference adalah tahap berbeda. Target <10 detik adalah preferensi, belum hasil pengukuran.
- Baseline produk: `.context/baca-bara-codex-handoff-json-sebagai/outputs/Bara-PRD.md`, `Bara-UI-Spec.md`, `Bara-Verifikasi.md`. Bukti offline: `docs/spike/offline-test-protocol.md`; audit SDK/model: `docs/spike/qvac-audit.md`.

## Urutan kerja dan kriteria selesai

1. Baca instruksi, diff, kode dan bukti; buat daftar hipotesis. Prioritaskan share diam, kemudian ketahanan unduh/verifikasi dan alur manual, kontak WA, cleanup.
2. Tambahkan regresi yang membuktikan penyebab, lihat gagal sebelum fix, lalu perbaiki. Jangan mengubah test agar sekadar sesuai implementasi.
3. Uji respons/penanganan kesalahan share, selfie wajib, pembatalan, kegagalan sanitasi; uji retry verifikasi tanpa transfer jaringan ulang, navigasi/background/relaunch, checksum gagal, model lama tetap aman, serta draf dapat dibuat selama operasi model. Catat mana yang hanya unit dan mana yang memerlukan perangkat.
4. Jalankan suite dan typecheck final dari `apps/qvac-spike`: `npm.cmd test -- --runInBand` dan `npm.cmd run typecheck`. Gunakan runner/dependensi yang tersedia; jangan upgrade massal.
5. Jika membuat APK, gunakan `scripts/Build-Niragni.ps1`; baca script sebelum menjalankan. `-SkipPrebuild` hanya jika native generated tree sudah sesuai config/plugin terbaru. Build/signing/caches mungkin perlu akses di luar sandbox; minta eskalasi tool yang konkret bila perlu. Jangan install ke HP saat ini.
6. Laporkan file yang berubah, akar penyebab yang terbukti, perintah/hasil aktual, artefak/hash/ukuran bila dibangun, dan gap pengujian perangkat. Jangan tulis “semua beres” jika native share dan AI offline belum diuji.

Path tool lokal yang berguna: portable Node `.tools/node-v22.21.1-win-x64`; SDK `C:\Users\hp5cd\AppData\Local\Android\Sdk`; Java `C:\Program Files\Android\Android Studio\jbr`; NDK `.tools/android-ndk-r29`. Sandbox dapat mengubah LOCALAPPDATA, jadi jangan mengandalkan variabel itu untuk menemukan SDK.

## Prompt untuk Codex penerus

```text
Baca AGENTS.md yang berlaku, cek .skills, lalu baca docs/codex-bugfix-handoff-2026-10-30.md sampai selesai di C:\Belajar\Sem5\Niragni. Dokumen itu adalah handoff perbaikan bug terbaru Niragni. Lanjutkan diagnosis dan implementasi sesuai scope dan kriteria selesai di sana; pertahankan semua pekerjaan lokal yang sudah ada.

Prioritaskan tombol “Buka pilihan berbagi” yang diam meskipun selfie sudah tersimpan, kemudian unduh/verifikasi model yang hilang saat keluar dan mengganggu pembuatan draf, kontak WhatsApp langsung melalui wa.me, serta cleanup komponen lama yang terbukti tidak dipakai. Selfie tetap wajib sebelum berbagi. Jangan menghapus pemeriksaan integritas model atau mengklaim AI offline berhasil tanpa bukti.

Pengguna sedang memegang HP dan menguji sendiri: jangan kontrol ADB, install APK, ubah jaringan, atau hapus data tanpa permintaan baru. Jangan publish/deploy/push atau menghubungi instansi. Verifikasi runtime/model effective jika menggunakan Orca; jangan mengklaim AGY/Astra aktif dari konteks lama. Laporkan diagnosis, perubahan, hasil pengujian aktual dan gap secara singkat dalam Bahasa Indonesia. Tanyakan hanya keputusan penting yang belum terjawab.
```


## Pembaruan kelanjutan pada 30 Oktober 2026

Perbaikan source, review, 247 tes/17 suite, typecheck, dan build APK bugfix sudah dikerjakan setelah handoff ini ditulis. Lihat [laporan kelanjutan](../work/reports/bugfix-continuation-2026-10-30.md) untuk detail serta hash APK final. Pernyataan historis di atas bahwa belum ada perubahan source kini sudah tidak berlaku. Penyebab asli share diam pada perangkat tetap belum terbukti; diagnostik tahap telah ditambahkan. Tetap jangan ambil alih HP atau menganggap build/test sebagai bukti chooser dan AI offline berhasil.
