# Laporan Riset Direktori Saluran Darurat Karhutla & Damkar (Putaran 2)

**Tanggal:** 29 Oktober 2026 (Asia/Jakarta)  
**Pelaksana:** AGY (Worker: Research & Documentation Specialist)  
**ID Tugas Orca:** `task_e4d9dd378115`  
**ID Dispatch:** `ctx_6325c20c195d`  
**Terminal:** `term_55af0ae6-57c0-42f4-90b5-50f1c8b069d1`  
**Penerima / Koordinator:** Orca Coordinator (`term_5a2a8de9-5eed-49c9-b52a-fbc8778e38b9`)  

---

## 1. Ringkasan Eksekutif

Menindaklanjuti arahan langsung pengguna (*"kita diskusi dulu, ganti semua nomor itu pakai yang karhutla dan juga pakai nomor damkar setempat aja, bilang itu ke agy"*) serta umpan balik koordinator melalui pesan orca, tim riset AGY telah menyelesaikan investigasi komprehensif, evaluasi dataset awal, dan penyusunan dokumen arsitektur terkait.

Kepatuhan terhadap batasan operasional:
- **Kepemilikan Berkas Terbatas:** Hanya membuat/memperbarui berkas di `docs/channel-directory/research-round-2/**` dan laporan ini (`work/reports/agy-channels-round-2.md`).
- **Tidak Mengubah Dataset Aktif atau Kode Aplikasi:** `apps/**` dan baseline `docs/channel-directory/indonesia-emergency-channels.json` tidak disentuh, mencegah benturan dengan tugas emulator Kiro.
- **Zero Git Operations:** Tidak ada perintah Git index/checkout/commit/push (Kiro adalah operator Git tunggal).
- **Protokol Riset Non-Interaktif:** Tanpa panggilan, pesan WhatsApp, email keluar, formulir, atau pembuatan akun.
- **Verifikasi Sumber Eksplisit:** Berdasarkan evaluasi mandiri koordinator, kontak umum yang tidak memiliki mandat spesifik Karhutla/Damkar (seperti Call Center BPBD Papua Barat dan Pusdalops umum Jawa Timur) telah dikeluarkan dari subset terverifikasi dan dipindahkan ke kategori *research gaps*. Peran kontak Dinas Gulkarmat DKI Jakarta dicatat secara jujur sebagai kantor dinas.

---

## 2. Berkas Hasil Kerja yang Diterbitkan

1. **`docs/channel-directory/research-round-2/supplemental-karhutla-damkar-channels.json`**
   - Berisi 14 entri kontak terverifikasi ketat yang mematuhi skema `Channel`:
     - 3 Saluran Nasional Posko Karhutla Kemenhut (Telepon, WhatsApp, Email).
     - 2 Saluran DKI Jakarta (Telepon Kantor Dinas Gulkarmat, Email Dinas).
     - 2 Saluran Kota Pekanbaru, Riau (Telepon Markas Damkar, WhatsApp Pengaduan Damkar 24 Jam Nonstop).
     - 1 Saluran Kota Palangka Raya, Kalteng (Telepon Penanganan Kebakaran DPKP).
     - 1 Saluran Kota Pontianak, Kalbar (Telepon Pemadam Kebakaran Panca Bakti).
     - 2 Saluran Kota Semarang, Jateng (Telepon Posko Damkar, Email).
     - 2 Saluran Kota Yogyakarta, DIY (WhatsApp Call Center Damkarmat, Telepon Posko).
     - 1 Saluran Kota Serang, Banten (Telepon Posko Damkar).

2. **`docs/channel-directory/research-round-2/karhutla-damkar-directory-proposal.md`**
   - Evaluasi menyeluruh terhadap 25 kontak awal pada dataset baseline:
     - **3 Dipertahankan:** Posko Karhutla Kemenhut (Telepon, WhatsApp, Email).
     - **22 Diusulkan Hapus / Arsip:** Layanan darurat umum 112, BNPB 117, BNPB Pusdalops, Basarnas 115, serta saluran kantor sekretariat BPBD provinsi umum (karena tidak spesifik karhutla atau damkar pemadam kebakaran).
   - Analisis tata kelola yurisdiksi Damkar di Indonesia (kewenangan berada di tingkat Kota/Kabupaten, bukan Provinsi).
   - Analisis dilema routing otomatis berbasis GPS dan rekomendasi antarmuka berjenjang (*Provinsi -> Kota/Kabupaten -> Posko*) dengan GPS hanya sebagai saran (*suggestion*).
   - Checklist status 38 provinsi di Indonesia (7 wilayah terverifikasi, 31 wilayah ditandai secara objektif sebagai `RESEARCHGAP` tanpa prasangka bahwa layanan tersebut tidak aktif).

3. **`docs/channel-directory/research-round-2/signed-key-backup-design-note.md`**
   - Catatan desain konseptual mengenai prinsip pencadangan *signed keystore* Android.
   - Menguraikan perlunya frasa sandi portabel pilihan pengguna (menggunakan KDF seperti Argon2id / PBKDF2 dan enkripsi simetris) agar tidak terikat mesin lokal (seperti keterbatasan Windows DPAPI).
   - Menjelaskan pemisahan destinasi penyimpanan privat (di luar repositori Git publik).
   - Menegaskan disclaimer: tidak menyentuh keystore/DPAPI, tidak membuat script backup otomatis, tidak ada backup yang saat ini dibuat, serta build iOS tidak dimungkinkan pada lingkungan Windows saat ini.

---

## 3. Matriks Rekor Terverifikasi (14 Rekor)

| ID Kontak | Wilayah / Entitas | Saluran | Nomor / Alamat | Bukti Sumber Primer Resmi |
|:---|:---|:---:|:---|:---|
| `kemenhut-posko-tel` | Nasional (Kemenhut) | Telepon | `021-5704618` | Siaran Pers Kemenhut 07 Sep 2026 |
| `kemenhut-posko-wa` | Nasional (Kemenhut) | WhatsApp | `+62 8131-00-35000` | Siaran Pers Kemenhut 07 Sep 2026 |
| `kemenhut-posko-email` | Nasional (Kemenhut) | Email | `posko.karhutla@kehutanan.go.id` | Siaran Pers Kemenhut 07 Sep 2026 |
| `damkar-dki-tel` | DKI Jakarta (Gulkarmat) | Telepon | `021-6344579` | Portal Resmi `pemadam.jakarta.go.id` (Kantor Dinas) |
| `damkar-dki-email` | DKI Jakarta (Gulkarmat) | Email | `damkardki@jakarta.go.id` | Portal Resmi `pemadam.jakarta.go.id` (Email Dinas) |
| `damkar-pekanbaru-tel` | Kota Pekanbaru (DPKP) | Telepon | `0761-22382` | Portal Resmi Pemkot Pekanbaru 03 Nov 2025 |
| `damkar-pekanbaru-wa` | Kota Pekanbaru (DPKP) | WhatsApp | `+62 851-8607-0113` | Portal Resmi Pemkot Pekanbaru (24 Jam Nonstop) |
| `damkar-palangkaraya-tel` | Kota Palangka Raya (DPKP) | Telepon | `0536-3230113` | Media Center Pemkot Palangka Raya |
| `damkar-pontianak-pancabakti-tel` | Kota Pontianak (Panca Bakti) | Telepon | `0561-740916` | Daftar Telepon Resmi `pontianak.go.id` |
| `damkar-semarang-tel` | Kota Semarang (Damkar) | Telepon | `024-7605871` | PPID Pemkot Semarang |
| `damkar-semarang-email` | Kota Semarang (Damkar) | Email | `kebakaran.semarangkota@gmail.com` | PPID Pemkot Semarang |
| `damkarmat-jogjakota-wa` | Kota Yogyakarta (Damkarmat) | WhatsApp | `+62 811-2828-113` | Helpdesk Resmi Pemkot Yogyakarta |
| `damkarmat-jogjakota-tel` | Kota Yogyakarta (Damkarmat) | Telepon | `0274-587101` | Helpdesk Resmi Pemkot Yogyakarta |
| `damkar-kotaserang-tel` | Kota Serang (Damkar) | Telepon | `0254-283113` | Biro Kesra Pemprov Banten |

---

## 4. Kesimpulan & Penutupan

Pekerjaan riset putaran kedua telah diselesaikan dengan bukti konkret, dokumentasi terstruktur, dan analisis teknis yang dapat langsung dijadikan bahan diskusi oleh koordinator dan pengguna. Seluruh artefak tersimpan di lokasi kepemilikan yang sah (`docs/channel-directory/research-round-2/**` dan `work/reports/agy-channels-round-2.md`).
