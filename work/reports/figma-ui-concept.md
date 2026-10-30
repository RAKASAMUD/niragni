# Niragni — konsep UI pastel di Figma

29 Oktober 2026. User meminta desain seluruh layar mengikuti konsep awal dengan warna referensi ungu, oranye, biru, dan pink. Implementasi APK dan pengujian perangkat ditahan selama pekerjaan desain ini.

- File: https://www.figma.com/design/CxJXhoCGPzwUYscUHsR7EP
- Session Figma: `45b327f9-7d50-4df6-9b21-6de5891d4bf5`.
- 25 layar/state berukuran 390 × 900, font Manrope, layer teks dan auto-layout editable; CTA dan ikon berupa instance komponen library Simple Design System.
- Home: `5:131`.
- Catat pengamatan: board `8:9`, layar `8:10`, `8:56`, `8:99`, `8:133` (buat laporan, foto, lokasi, waktu).
- Susun/tinjau: board `9:30`, layar `9:31`, `9:57`, `9:94`, `9:122` (AI berjalan, tinjau, AI belum siap, AI gagal).
- Bagikan/siapkan: board `10:42`, layar `10:43`, `10:73`, `10:112`, `10:150` (preview berbagi, detail draf, kanal, kesiapan model).
- State pencatatan: board `11:60`, layar `11:61`, `11:88`, `11:118`, `11:146` (kosong, gagal simpan, GPS ditolak, foto tidak tersedia).
- Pemulihan: board `11:176`, layar `11:177`, `11:206`, `11:233`, `11:257` (mengunduh, tidak kompatibel, AI dibatalkan, konfirmasi hapus).
- Model/status: board `13:87`, layar `13:88`, `13:112`, `13:139`, `13:166` (verifikasi, siap, unduhan terputus, status setelah berbagi).

## Pemeriksaan aktual

Seluruh board dirender dan diperiksa melalui screenshot Figma. Ditemukan dan diperbaiki tinggi baris rincian yang terpotong, label unduhan yang wrap, serta konsistensi navigasi kapsul pada tujuan utama. Pemeriksaan struktur menunjukkan font Manrope, tidak ada layer image pada seluruh board, dan isi setiap body berada di dalam tinggi 668 unit. Home diperiksa pada turn konsep awal.

Data laporan/foto/kanal/status model adalah contoh desain. Foto berupa kartu ilustratif berlabel FOTO CONTOH; tidak memakai foto pribadi. Nomor kanal belum diisi sebagai nomor operasional. Status siap adalah state desain setelah pemeriksaan lokal berhasil, bukan bukti runtime QVAC. Belum ada wiring prototype klik, validasi font 200%/perangkat, atau implementasi palet baru ke aplikasi dari pekerjaan Figma ini. Tidak publish/deploy/kontak instansi.

## Revisi referensi pengguna

User memperbarui home dengan dua warna utama: biru `#B2D9EA` dan peach `#EAC3B2`, Coolvetica untuk teks tebal dan SF Pro Regular untuk sekunder. Kedua warna diambil dari fill node referensi, diterapkan pada 24 layar tambahan; home yang diedit pengguna dipertahankan. Teks sekunder yang sebelumnya Manrope pada layar tambahan diubah ke SF Pro Regular.

Rincian layar Buat laporan (`8:10`) diganti dari daftar menjadi grid `17:105`, 2×2 kartu (165×154, gap12): foto, waktu, lokasi kejadian, posisi pelapor. Screenshot dan bounds mengonfirmasi konten tidak terpotong (body bottom558 dari tinggi668).

Hambatan font aktual: `loadFontAsync({family:'Coolvetica',style:'Regular'})` gagal karena family tidak tersedia pada runtime Figma MCP, walaupun font node referensi memakai Coolvetica dan file lokal Windows `Coolvetica Rg.otf` tersedia. SF Pro Regular berhasil dimuat. Akses Figma lokal melalui Computer Use juga gagal: native pipe tidak tersedia dan browser host unavailable. Coolvetica belum dipropagasi oleh koordinator ke semua heading; font user yang sudah ada tidak diganti. Heading yang masih menunggu ditandai pada nama layer. Tidak mengklaim tipografi selesai seluruhnya.

## Elemen visual dan shadow

User meminta elemen pada semua Rincian dan layar lain. Empat kartu Rincian memakai instance ikon kamera, jam, pin kejadian, dan navigasi posisi pelapor. Drop shadow ringan diterapkan ke119 surface terlihat (offset y2, radius8, opacity8%); container transparan tidak diberi shadow.

Lanjutan: 61 header kartu pada 23 layar lain ditambah badge ikon kontekstual dari Simple Design System (kamera, waktu, lokasi, CPU/AI, berbagi, peringatan, folder, privasi, telepon, verifikasi, unduhan, koneksi, hapus). Semua instance/vector editable. Grid Rincian dan referensi home yang telah diedit pengguna dipertahankan. Screenshot keenam kelompok setelah perubahan diperiksa: tidak ada body overflow pada frame390×900; body paling padat mencapai652 dari668 unit. Tidak ada klaim font Coolvetica sudah tersedia pada runtime MCP.

## Font final sesuai revisi pengguna

User mengganti pilihan menjadi SF Pro Expanded Regular untuk seluruh Coolvetica dan Manrope ukuran26. Tool berhasil memuat SF Pro Expanded Regular dan mengganti31 teks: 7 Coolvetica berbagai ukuran dan24 Manrope26. Ukuran teks dipertahankan. Audit setelah perubahan menemukan0 teks Coolvetica atau Manrope26 tersisa. Screenshot home dan kelompok pemulihan diperiksa; satu judul membungkus ke2 baris diperbaiki melalui tinggi header108 dan body644 agar font26 tidak berubah dan isi tidak tertutup. Referensi home terbaru beserta logo/background pengguna dipertahankan.

## Background dan penyederhanaan informasi

Background asap pada home (`15:114`, imageHash aktif `2e6e779f2d1956260b60380885c19d8c75256347`) diklon sebagai dekorasi terpisah ke24 layar tambahan, posisi absolut di belakang konten. Seluruh25 layar memakai background referensi, sedangkan teks dan komponen tetap editable.

Empat belas kartu penjelasan tambahan dipadatkan menjadi notifikasi inline tanpa shadow: tips penyiapan model, input tetap tersimpan, detail validasi output, cara memilih kanal, syarat kesiapan, AI opsional, tindakan saat storage gagal, privasi posisi, batas foto, langkah setelah unduhan, alternatif manual, draf setelah batal, dan draf setelah berbagi. Pesan tidak dinyatakan hilang otomatis; ini desain inline, bukan bukti toast runtime. Kontrol/form, pesan error utama, status penerimaan yang belum diketahui, dan konfirmasi hapus dipertahankan. Disclaimer footer generik yang berulang pada layar sekunder dikurangi. Auto-height notifikasi diperbaiki setelah screenshot awal menunjukkan clipping. Render keenam kelompok diperiksa setelah background; seluruh isi body tetap di dalam batas layar.
