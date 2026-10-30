# Kelanjutan bugfix Niragni — 30 Oktober 2026

Instruksi pengguna dan handoff dibaca sampai selesai. Tidak ditemukan AGENTS.md fisik pada rantai direktori proyek saat pemeriksaan; instruksi AGENTS.md yang diberikan pengguna diterapkan. Semua perubahan lokal sebelumnya dipertahankan. Tidak ada kontrol HP/ADB, instalasi APK ke perangkat, kontak instansi, commit, push, atau deployment.

## Skill

`npx.cmd skills add vercel-labs/agent-skills@vercel-react-native-skills -y` berhasil setelah retry dengan eskalasi: percobaan sandbox gagal mengakses registry npm (EACCES). Skill berada di `.agents/skills/vercel-react-native-skills`, dengan `skills-lock.json`. Panduan state dispatcher/fallback, Pressable, dan rendering conditional dibaca; dependensi aplikasi tidak di-upgrade. Baseline github-test-authorization, systematic-debugging, test-driven-development dan verification-before-completion diterapkan.

## Diagnosis dan perubahan

- **Share diam belum dapat direproduksi pada perangkat.** Tidak ada bukti mismatch FileProvider. API/sumber react-native-share 12.3.1 yang terpasang diperiksa: cache path didukung, isBase64File menyelesaikan promise untuk URI file, dan MIME dapat diinferensikan dari JPEG. Tidak ada penggantian library/opsi storage berdasarkan tebakan. Ditambah callback tahap validasi, sanitasi JPEG, copy, pemanggilan native share dan pencatatan. Status/error kini juga tampil di dekat tombol. Mutex tetap dilepas di finally saat gagal/batal; tidak ada timeout yang dapat memunculkan chooser kedua. Isi laporan/foto/URI privat tidak masuk diagnostik tahap. Kewajiban selfie, pembacaan report tersimpan, kepemilikan, path privat, file tidak kosong dan sanitasi fail-closed dipertahankan. Bug riwayat terpisah diperbaiki: repository mengembalikan DESC, sehingga percobaan terbaru adalah indeks 0.
- **Beranda tergantung model terbukti pada kode dan regresi.** Promise.all lama menahan hasil listReports bila listModels lambat/gagal. `loadHomeData.ts` memuat keduanya independen; refresh laporan selesai saat laporan selesai. Tombol buat draf memakai mutex sinkron dan feedback selama create. Tidak ada lifecycle lock model pada create/save report; tidak ditambahkan backend/akun.
- **Staging hilang terbukti pada kode dan regresi.** Retry dan catch lama menghapus partial lengkap; listModels hanya mengenali final. Sekarang staging lengkap dipertahankan, ditemukan setelah pembuatan manager baru, dan tombol cek lokal melanjutkan hash keduanya, promosi dan load tanpa transfer jaringan ulang. Berkas yang belum lengkap diunduh ulang dari awal; ini bukan klaim HTTP range resume. Hash salah menghapus staging rusak dan mempertahankan final lama. Sisa ruang dihitung untuk transfer yang belum ada. Pembatalan selama hash/load tidak boleh menaikkan pasangan ke ready hanya dari ukuran. Status aktif dimiliki manager; layar kesiapan memuatnya kembali saat fokus dan polling saat terlihat. Byte checksum ditampilkan terpisah, update dibatasi 250 ms; kecepatan hash aktual belum diukur di HP.
- **Rollback pasangan terbukti rusak dalam simulasi API File.move yang nyata mengubah URI objek.** Backup kedua berada di luar try dan flag backup lama baru aktif setelah dua move. Selain itu catch memakai URI objek tujuan yang sudah berubah ke backup. Sekarang memakai string path tetap dan flag tiap berkas; kegagalan backup/promosi kedua mengembalikan kedua berkas lama. Ini rollback pada exception, bukan transaksi filesystem tahan mati proses di setiap instruksi.
- **WhatsApp:** tombol kontak utama untuk entri whatsapp di tab kanal dan layar share memanggil openDialer yang sudah menghasilkan `https://wa.me/<nomor>`. Nomor telepon tetap tel:, sumber resmi tetap disimpan/ditampilkan sebagai provenance. Chat kosong tidak membawa laporan/lampiran dan tidak mengirim otomatis. URL hanya diuji lewat mock, tidak dibuka ke instansi.
- **Cleanup:** prototipe `app/_ui-review.tsx` dipindah ke `src/dev/UiReview.tsx` sehingga tidak menjadi route Expo Router. Source lokal tetap tersedia. PreviewBanner, PreviewBanner.web dan services.web dipertahankan karena masih menjadi adapter/banner demo web yang direferensikan.

## Pengujian aktual

Dari `apps/qvac-spike`:

- `npm.cmd test -- --runInBand`: **exit 0; 17 suite, 247 tes lulus**, 0 snapshot, waktu Jest 6,487 detik pada run final sebelum build.
- `npm.cmd run typecheck`: **exit 0**, tanpa diagnostik TypeScript.
- Regresi awal recovery: 5 gagal/1 lulus sebelum fix. Regresi rollback backup/promosi dan cancel saat load: 3 gagal/8 lulus sebelum fix, kemudian lulus. Regresi feedback share gagal dengan stages kosong sebelum callback ditambah. Regresi home direproduksi terhadap alur Promise.all (2 gagal), kemudian lulus. Regresi byte verifikasi gagal sebelum implementasi, kemudian lulus.
- Cakupan baru: staging lengkap setelah restart manager, retry tanpa createDownloadResumable, cancellation, checksum rusak, disk penuh, download hanya projector yang belum lengkap, load gagal, rollback dua tahap, progres verifikasi, laporan tetap muncul saat metadata model pending/gagal, dan URL dua WA serta tel. Mock filesystem/worker/linking/share berada pada boundary native; ini tidak menggantikan pengujian Android.
- Suite selfie lama tetap lulus: selfie hilang, injeksi caller, salah pemilik, path traversal, file kosong, sanitasi gagal, pembatalan dan error share. Tidak ada bypass salin teks.

## Batas bukti

Chooser Android aktual, interaksi navigasi/background nyata, proses aplikasi dimatikan OS, EXIF aktual, respons UI saat hash ratusan MB, draf dibuat/disimpan selama hash nyata, dan inference teks+foto tanpa internet masih memerlukan pengujian pengguna. Restart manager dalam unit test tidak setara restart proses Android. iOS belum diuji. Penyebab asli share diam belum ditetapkan; APK diagnostik diperlukan untuk mengetahui tahap terakhir. Tidak ada klaim AI offline atau target <10 detik terpenuhi.

## Build

Build lokal memakai `scripts/Build-Niragni.ps1 -AndroidSdk C:\Users\hp5cd\AppData\Local\Android\Sdk -SkipPrebuild` dengan eskalasi untuk signing/cache. Native tree diperiksa memiliki arm64-v8a, expo.useLegacyPackaging=true dan android.enableBundleCompression=true; konfigurasi/plugin/dependensi native tidak berubah dalam perbaikan ini. APK terkompresi terdahulu yang bernama tanggal tetap dipertahankan. Hasil build dan review dicatat setelah proses selesai.


## Review dan koreksi tambahan

Skill requesting-code-review dipakai dengan reviewer read-only terpisah. Tiga temuan awal P2 ditutup: (1) staging model yang sudah dipromosikan dikembalikan ke partial saat promosi projector gagal, sehingga retry tidak perlu transfer ulang; (2) activeStates juga mencakup impor SAF agar polling tidak mengubah kartu impor menjadi missing; (3) tombol batal tersedia saat verifying. Reviewer menemukan efek samping cancellation saat native load impor belum meneruskan signal; regresi membuktikan status ready yang keliru, lalu signal diteruskan dan abort diperiksa sebelum promosi. Suite final setelah koreksi: 247 lulus/17 suite. Reviewer tidak mengubah file atau menjalankan build/test.

Build pertama sukses dalam 6m25s, tetapi merupakan artefak antara sebelum koreksi review terakhir; jangan gunakan hash F27654B636470EE72E9B6E33F6D1055649EE9529A8705F9E6426947E82723F63 sebagai hash final. Build kedua memakai source final. Peringatan build: ndk.dir deprecated, Gradle deprecated features, dan NO_COLOR/FORCE_COLOR; bukan bukti kegagalan atau perbaikan native share.


Review akhir atas signal impor: reviewer mengonfirmasi abort diperiksa sebelum promosi dan diteruskan ke load check; tidak ada temuan tambahan pada koreksi sempit tersebut. Pemeriksaan `git diff --check` pada source yang disentuh lulus (exit 0). Typecheck setelah koreksi terakhir lulus (exit 0).

File source yang disentuh pada kelanjutan ini: `src/core/models.ts`, `src/core/export.ts`, `src/core/index.ts`, `src/product-contract.ts`, `src/ui/services.ts`, `src/ui/loadHomeData.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/readiness.tsx`, `app/(tabs)/channels.tsx`, `app/report/[id]/share.tsx`, serta pemindahan fixture ke `src/dev/UiReview.tsx`. Tes: `download-recovery.test.ts`, `home-loading.test.ts`, `channel-contact.test.ts`, tambahan di `selfie-export.test.ts` dan `import-progress.test.ts`. Seluruh perubahan lokal sebelum giliran ini tetap berada di working tree, bukan bagian patch baru semuanya.


## Artefak final terverifikasi

- Build kedua: exit 0, `BUILD SUCCESSFUL in 3m 56s`, 356 actionable tasks (20 executed, 336 up-to-date).
- APK: `artifacts/niragni-android-bugfix-2026-10-30.apk`, juga tersedia melalui alias `artifacts/niragni-android.apk`.
- Ukuran: **86.372.778 byte** (sekitar 86,37 MB desimal / 82,37 MiB), hanya 1.332 byte lebih besar daripada APK terkompresi lama. APK lama bernama `niragni-android-compressed-2026-10-30.apk` tetap 86.371.446 byte.
- SHA-256 final: `C3A106BCC4C43E59A094FA9A816A5A1582D33D45A6B11E56E4B994A2CBA6E698`.
- Pemeriksaan ZIP aktual: ABI hanya arm64-v8a; 60 library native seluruhnya DEFLATED; assets/index.android.bundle juga DEFLATED; tidak ada model .gguf dibundel. Detail mesin: `bugfix-apk-2026-10-30.json`.
- `apksigner.bat verify --verbose --print-certs artifacts/niragni-android-bugfix-2026-10-30.apk`: exit 0, Verifies, v2 true, satu signer CN=Niragni. SHA-256 sertifikat `6cb72d16e72b2fe4937e17e6ce46b8b191a8f230df26d7454c7bd5e4adf64324`, sama dengan baseline rilis.
- APK tidak dipasang atau dibuka pada HP. Hash/build/signature tidak membuktikan chooser atau AI offline berhasil.

Untuk uji mandiri pengguna: coba berbagi dari laporan yang selfie-nya sudah tersimpan dan catat tahap terakhir di dekat tombol bila chooser tetap diam. Coba hentikan verifikasi, kembali ke kesiapan, lalu Periksa model lokal; pasangan staging lengkap harus menjalani checksum/load tanpa transfer baru. Buat/simpan draf manual selama operasi model; pengujian ini di perangkat masih belum dilakukan oleh agent.
