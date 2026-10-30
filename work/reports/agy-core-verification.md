# Laporan Verifikasi Core, Direktori Damkar, dan Status Model Niragni (Bara)

**Penulis:** AGY (Dispatched Worker)  
**ID Tugas:** `task_0a64f7bd3974`  
**Konteks Dispatch:** `ctx_14ae6e69e8dc`  
**Terminal:** `term_0038f0a3-1216-4928-a43f-abcbc80cca51`  
**Tanggal:** 29 Oktober 2026  
**Referensi:** Dokumen Revisi (`docs/revision-2026-10-29.md`), Skill `github-test-authorization`

---

## 1. Ringkasan Eksekutif

Sesuai arahan koordinator dan transfer kepemilikan yang telah ditetapkan efektif, AGY menyelesaikan perombakan dan verifikasi menyeluruh pada modul direktori darurat, pengujian regresi status model, dan selektor kanal berbasis yurisdiksi:

1. **Direktori Aktif Khusus Damkar (Damkar-Only):** Konstanta mentah `CHANNEL_DIRECTORY` pada [channel-directory.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/channel-directory.ts) dan berkas JSON [indonesia-emergency-channels.json](file:///C:/Belajar/Sem5/Niragni/docs/channel-directory/indonesia-emergency-channels.json) telah diganti menjadi **hanya 9 saluran insiden Damkar kota/kabupaten terverifikasi**. Tiga saluran nasional Kemenhut, nomor darurat 112, kontak kantor dinas, dan nomor umum BPBD telah dikeluarkan dari direktori aktif ke arsip riset, sehingga tidak ada lagi substitusi nomor nasional ke daerah yang belum terverifikasi.
2. **Pengujian Regresi Status Model (`model-list-status.test.ts`):** Mengimplementasikan pengujian regresi bermakna terhadap metode asli `ModelManager.listModels()` menggunakan mock dependency native (`expo-file-system`, `expo-sqlite`/`database`) tanpa me-mock metode yang diuji. Membuktikan keunggulan preseden keberadaan berkas fisik di disk di atas baris DB, serta memastikan perbaikan bug P3 di mana kegagalan hash (`failed`) dan ketidakcocokan arsitektur (`incompatible`) mempertahankan pesan error dan `lastLocalCheck` setelah refresh tanpa peningkatan semu ke status `installed`.
3. **Penyelarasan Selektor Kanal (`channel-selector.test.ts` & `damkar-only.test.ts`):** Menyesuaikan suite pengujian dengan semantik Damkar-only tanpa fallback nasional, pemisahan kanonikal kota vs provinsi, dan pelaporan celah cakupan geografis yang jujur (*honest coverage gap*).
4. **Penyempurnaan Mutex UI pada [`share.tsx`](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/app/report/[id]/share.tsx):** Mengubah penjaga in-flight dari state React semata menjadi `useRef` mutex sinkron untuk mencegah pemanggilan paralel antarmuka OS pada alur share, selfie capture, dan dialer, serta membaca `report.shareAttempts` terbaru setelah berbagi untuk melaporkan status pembatalan secara jujur.

Seluruh 96 pengujian unit pada 8 suite Jest berhasil lulus 100%.

---

## 2. Pembersihan Direktori Aktif (Damkar-Only)

### 2.1 Eliminasi Saluran Non-Damkar dari Direktori Aktif
- **Posko Karhutla Kemenhut (3 entri):** ID `kemenhut-posko-tel`, `kemenhut-posko-wa`, dan `kemenhut-posko-email` dikeluarkan dari konstanta `CHANNEL_DIRECTORY` dan berkas dataset aktif. Entri ini tetap tersedia pada dokumentasi riset arsip `docs/channel-directory/research-round-2/` untuk rekam jejak riset, namun tidak dibundel sebagai kanal rujukan aktif.
- **Panggilan 112 & Kontak Kantor Administratif:** Tetap tidak dimasukkan ke dalam direktori aktif.
- **Konstanta Mentah Bersih:** `CHANNEL_DIRECTORY` pada [channel-directory.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/channel-directory.ts) kini berisi tepat 9 elemen. Fungsi `CHANNELS` dan `listChannels()` di [channels.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/channels.ts) keduanya merefleksikan 9 saluran Damkar lokal yang sama tanpa perlu filtering parsial.

### 2.2 Rincian 9 Saluran Damkar Kota/Kabupaten Aktif

| No | ID Kanal | Nama Instansi / Label | Destinasi Kontak | Tipe | Yurisdiksi / Cakupan | Sumber Primer (.go.id) | Tanggal Cek |
|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | `damkar-pekanbaru-wa` | DPKP Kota Pekanbaru (WhatsApp Pengaduan Damkar 24 Jam Nonstop) | `+62 851-8607-0113` | `whatsapp` | Kota Pekanbaru, Riau | `pekanbaru.go.id` | 2026-10-29 |
| 2 | `damkar-pekanbaru-tel` | DPKP Kota Pekanbaru (Telepon Markas Damkar) | `0761-22382` | `phone` | Kota Pekanbaru, Riau | `pekanbaru.go.id` | 2026-10-29 |
| 3 | `damkar-palangkaraya-tel` | DPKP Kota Palangka Raya (Telepon Penanganan Kebakaran) | `0536-3230113` | `phone` | Kota Palangka Raya, Kalimantan Tengah | `palangkaraya.go.id` | 2026-10-29 |
| 4 | `damkar-pontianak-pancabakti-tel` | Pemadam Kebakaran Panca Bakti Kota Pontianak (Telepon) | `0561-740916` | `phone` | Kota Pontianak, Kalimantan Barat | `pontianak.go.id` | 2026-10-29 |
| 5 | `damkar-semarang-tel` | Dinas Pemadam Kebakaran Kota Semarang (Telepon Posko) | `024-7605871` | `phone` | Kota Semarang, Jawa Tengah | `semarangkota.go.id` | 2026-10-29 |
| 6 | `damkar-semarang-email` | Dinas Pemadam Kebakaran Kota Semarang (Email) | `kebakaran.semarangkota@gmail.com` | `email` | Kota Semarang, Jawa Tengah | `semarangkota.go.id` | 2026-10-29 |
| 7 | `damkarmat-jogjakota-wa` | Damkarmat Kota Yogyakarta (WhatsApp Call Center) | `+62 811-2828-113` | `whatsapp` | Kota Yogyakarta, D.I. Yogyakarta | `jogjakota.go.id` | 2026-10-29 |
| 8 | `damkarmat-jogjakota-tel` | Damkarmat Kota Yogyakarta (Telepon) | `0274-587101` | `phone` | Kota Yogyakarta, D.I. Yogyakarta | `jogjakota.go.id` | 2026-10-29 |
| 9 | `damkar-kotaserang-tel` | Pemadam Kebakaran Kota Serang (Telepon) | `0254-283113` | `phone` | Kota Serang, Banten | `bantenprov.go.id` | 2026-10-29 |

### 2.3 Celah Cakupan Geografis yang Jujur (Honest Gaps)
- Cakupan aktif mencakup **6 kota** di **6 provinsi**.
- Sebanyak **32 provinsi lainnya** dan kota/kabupaten di luar 6 kota di atas tidak memiliki data Damkar aktif terverifikasi (`RESEARCHGAP`).
- Sistem secara konsisten mengembalikan daftar kosong (`channels: []`) dengan notice eksplisit bahwa saluran Damkar setempat belum terverifikasi, tanpa memalsukan keberadaan posko provinsi atau menggantikan nomor dengan kontak antah berantah.

---

## 3. Implementasi Pengujian Regresi Status Model (`model-list-status.test.ts`)

Berkas pengujian baru [src/\_\_tests\_\_/model-list-status.test.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/__tests__/model-list-status.test.ts) memverifikasi logika kritis pada `ModelManager.listModels()`:

1. **Keunggulan Preseden Keberadaan Fisik di Disk:**
   - Ketika berkas model dan projektor tidak ada di disk (`exists: false`), status dikembalikan sebagai `'missing'`, meskipun tabel DB sebelumnya mencatat status `'ready'`.
   - Ketika hanya salah satu berkas yang ada (misal projektor belum terunduh), status tetap `'missing'` dengan `downloadedBytes` sebesar ukuran berkas yang telah ada.
2. **Keunggulan Preseden Ukuran Berkas Manifest:**
   - Ketika berkas ada namun ukurannya tidak sama dengan manifest (misal berkas terpotong/rusak saat unduh), status dikembalikan sebagai `'failed'` dengan pesan error `'Ukuran berkas model di penyimpanan tidak cocok dengan manifest.'`, mengesampingkan status DB lama.
3. **Preservasi Bug P3 (Kegagalan Hash & Inkompatibilitas):**
   - Ketika berkas memiliki ukuran byte yang 100% pas sesuai manifest, namun DB mencatat kegagalan verifikasi sebelumnya (misal hash SHA-256 tidak cocok atau kegagalan load memori):
     - Status `'failed'` **tetap dipertahankan** dan **tidak dinaikkan semu ke `'installed'`**.
     - Pesan error dan timestamp `lastLocalCheck` tetap disajikan secara utuh.
   - Demikian pula untuk status `'incompatible'`, status dan alasan inkompatibilitas arsitektur perangkat tetap dipertahankan.
4. **Independensi Multi-Kandidat:**
   - Membuktikan bahwa status SmolVLM2 (misal `'ready'`) dan VisionPsy (misal `'missing'`) dievaluasi secara independen tanpa saling mencemari.

---

## 4. Penyelarasan Selektor Kanal (`channel-selector.test.ts` & `damkar-only.test.ts`)

1. **`channel-selector.test.ts` (24 Pengujian Lulus):**
   - Memperbarui ekspektasi ukuran direktori menjadi 9 saluran Damkar.
   - Menguji bahwa query provinsi ("Jawa Tengah" atau "Riau") tidak menghasilkan `hasLocalMatch: true` dan tidak membocorkan hotline kota ("Kota Semarang" atau "Kota Pekanbaru").
   - Memastikan pencarian substring kanonikal ("Kepulauan Riau" vs "Riau", "Papua Barat Daya" vs "Papua") tidak mengalami salah arah (*misrouting*).
   - Memverifikasi dialer tel/wa/email menghasilkan URI yang tersanitasi dengan benar.
2. **`damkar-only.test.ts` (30 Pengujian Lulus):**
   - Menjamin bahwa seluruh ID di `CHANNEL_DIRECTORY` memiliki prefix `damkar-` atau `damkarmat-`.
   - Menguji 14 provinsi dan 9 kota di luar cakupan untuk membuktikan bahwa celah cakupan geografis dilaporkan secara jujur tanpa substitusi.
   - Menguji resolusi tepat untuk 6 kota terverifikasi.

---

## 5. Penyempurnaan Mutex UI pada [`share.tsx`](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/app/report/[id]/share.tsx)

1. **Sinkronisasi Mutex dengan `useRef`:**
   - Penggunaan `useState(false)` semata dapat mengalami race condition jika tombol ditekan dua kali berturut-turut sebelum render siklus berikutnya selesai.
   - Diterapkan `busyRef = useRef(false)`. Pada awal callback `share`, `captureSelfieNow`, dan `dial`, `busyRef.current` diperiksa dan disetel `true` secara sinkron sebelum pemanggilan fungsi asinkron dimulai, serta direset pada blok `finally`. State `busy` tetap dipelihara untuk kebutuhan rendering tombol disabled.
2. **Pelaporan Pembatalan Berbagi Berbasis Riwayat Aktivitas:**
   - Karena `services.shareReport()` mengembalikan `void` dan penutupan antarmuka berbagi OS tidak selalu melempar exception, antarmuka membaca `report.shareAttempts` terbaru setelah operasi berbagi selesai. Jika event terakhir adalah `'cancelled'`, aplikasi menyajikan notice jujur: *"Upaya berbagi dibatalkan"*.
3. **Koreksi Laporan UI (`agy-major-ui-revision.md`):**
   - Baris penyimpanan data dikoreksi secara akurat merujuk ke SQLite lokal perangkat (`bara.db` via `expo-sqlite`) dan sistem berkas lokal (bukan `AsyncStorage`).
   - Bagian pengujian visual menegaskan secara jujur bahwa pengujian visual on-device / emulator BELUM dilakukan pada tahap ini karena perangkat fisik sengaja diputus.

---

## 6. Matriks Hasil Pengujian & Verifikasi

| Test Suite | Jumlah Tes | Status | Keterangan Verifikasi |
|:---|:---:|:---:|:---|
| `model-list-status.test.ts` | 8 | **PASS** | Preseden fisik vs DB, preservasi error P3, independensi multi-kandidat. |
| `channel-selector.test.ts` | 24 | **PASS** | Selektor kanonikal Damkar-only, eliminasi false-positive substring, dialer. |
| `damkar-only.test.ts` | 30 | **PASS** | Uji integritas 9 kanal Damkar, verifikasi domain .go.id, gap 23 wilayah. |
| `pressable-style.test.ts` | 6 | **PASS** | Preservasi styling tombol PressableScale saat ditekan / dilepas. |
| `native-readiness.test.ts` | 8 | **PASS** | Validasi integritas SHA-256 model, lifecycle native worker. |
| `state.test.ts` | 6 | **PASS** | Manajemen state worker lokal, cancellation, penanganan galat. |
| `prompt.test.ts` | 5 | **PASS** | Validasi format prompt observasi karhutla tanpa halusinasi. |
| `manifest.test.ts` | 9 | **PASS** | Integritas manifest model candidate SmolVLM2 dan VisionPsy. |
| **Total** | **96** | **100% PASS** | Waktu eksekusi: ~1.09 detik. |

---

## 7. Status Integrasi & Keterbatasan yang Diketahui

1. **TypeScript Typecheck:** Seluruh berkas pada batas kepemilikan AGY (`channel-directory.ts`, `channel-selector.ts`, suite tes `src/__tests__/**`, `app/**`, `src/ui/**`, `docs/channel-directory/**`) bebas dari galat kompilasi TypeScript. Galat TS1005/TS1128 yang masih terdeteksi pada `apps/qvac-spike/src/core/repository.ts` berada dalam lingkup kepemilikan Kiro yang sedang menyelesaikan implementasi selfie dan ekspor.
2. **Kesiapan Integrasi:** Direktori kanal dan suite tes telah berada dalam kondisi stabil (*integration-ready*) untuk penyatuan akhir begitu Kiro merampungkan berkas core repository.
3. **Protokol Tanpa Perangkat:** Sesuai instruksi penugasan, tidak ada perintah ADB, browser, bundling APK, maupun kontak jaringan eksternal yang dijalankan.
