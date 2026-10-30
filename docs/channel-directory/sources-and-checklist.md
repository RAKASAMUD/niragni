# Indonesian Karhutla & Damkar Channel Directory — Sources and Coverage Checklist

Access Date: **29 October 2026 (Asia/Jakarta)**  
Dataset File: [`indonesia-emergency-channels.json`](./indonesia-emergency-channels.json)  
Bundled Source Code: [`apps/qvac-spike/src/core/channel-directory.ts`](../../apps/qvac-spike/src/core/channel-directory.ts)  
Selector Module: [`apps/qvac-spike/src/core/channel-selector.ts`](../../apps/qvac-spike/src/core/channel-selector.ts)  
Dedicated Regression Tests: [`apps/qvac-spike/src/__tests__/channel-selector.test.ts`](../../apps/qvac-spike/src/__tests__/channel-selector.test.ts)  
Damkar Integrity Tests: [`apps/qvac-spike/src/__tests__/damkar-only.test.ts`](../../apps/qvac-spike/src/__tests__/damkar-only.test.ts)  
Dataset Schema Target: `Channel` contract ([`product-contract.ts`](../../apps/qvac-spike/src/product-contract.ts))

---

## 1. Metodologi Riset & Batasan Integritas Data

1. **Kurasi Ketat Kanal Insiden Damkar (Damkar Only)**:
   - Sesuai keputusan evaluasi produk dan arahan koordinasi, direktori aktif dikurasi menjadi **9 saluran Damkar kota/kabupaten resmi** yang terbukti secara eksplisit sebagai saluran pelaporan kejadian/posko pemadam kebakaran lapangan.
   - **Saluran Posko Karhutla Kemenhut (Nasional)**: Dipindahkan ke arsip riset (`research-round-2/`) dan **dikeluarkan dari direktori aktif**. Direktori tidak lagi menyubstitusikan nomor nasional ke daerah yang belum terverifikasi guna mencegah ilusi cakupan semu.
   - **Panggilan Darurat 112**: Dieliminasi dari direktori aktif karena merupakan layanan multi-sektor umum dan implementasinya tidak merata di seluruh daerah (`unconfirmed`).
   - **Kontak Kantor Dinas (Dinas Gulkarmat DKI Jakarta)**: Disimpan sebagai catatan riset arsip, **tidak dimasukkan ke direktori aktif** (`CHANNEL_DIRECTORY` / `listChannels()`) karena merupakan telepon kantor jam dinas tanpa bukti operasional sebagai call center insiden lapangan 24 jam.
2. **Sumber Primer Pemerintah (`.go.id`)**:
   - Seluruh 9 saluran diverifikasi langsung dari portal resmi pemerintah daerah (PPID kota, Media Center kota, dan Biro Kesra provinsi).
3. **Kesesuaian Tipe Saluran (*Channel Kind*)**:
   - Tipe saluran (`phone`, `whatsapp`, `email`) ditetapkan sesuai label verbatim pada sumber resmi pemerintah.
4. **Definisi Status Ketersediaan (`availability: public`)**:
   - Seluruh 9 saluran berstatus `public` (tercatat resmi di portal pemerintah pada tanggal 29 Oktober 2026). Pencantuman ini bukan garansi penerimaan laporan otomatis saat bencana terjadi.
5. **Protokol Non-Interaktif (Zero Outbound Contact)**:
   - Riset dilakukan secara pasif dan berbasis dokumen publik. Tidak ada panggilan, pesan WhatsApp, email, pembuatan akun, maupun transaksi finansial ke instansi mana pun.
6. **Pemilihan Wilayah Manual Kanonikal (Zero GPS Dependency)**:
   - Aplikasi tidak menginferensi lokasi kejadian dari sensor GPS ponsel pengamat.
   - Menggunakan pencocokan kanonikal yurisdiksi tingkat kota/kabupaten vs provinsi untuk mencegah salah arah (*misrouting*) dan regresi false-positive substring.

---

## 2. Realitas Yurisdiksi & Pencegahan Salah Arah (Jurisdiction Integrity)

Di Indonesia, kewenangan operasional dinas pemadam kebakaran berada pada tingkat **Kota dan Kabupaten** (otonomi daerah), bukan tingkat provinsi:
1. **Pemisahan Kota vs Provinsi**:
   - Pemilihan nama provinsi (misal: "Jawa Tengah" atau "Riau") **tidak memberikan klaim saluran lokal** (`hasLocalMatch: false`). Hal ini mencegah kesalahan fatal di mana warga Surakarta atau Dumai diarahkan ke hotline Kota Semarang atau Kota Pekanbaru yang tidak memiliki yurisdiksi di wilayah mereka.
2. **Eliminasi Kesalahan Substring Kanonikal**:
   - Pencarian "Kepulauan Riau" tidak pernah mencocokkan saluran "Kota Pekanbaru, Riau".
   - Pencarian "Papua Barat Daya" atau "Papua Barat" tidak pernah mencocokkan "Papua".
3. **Pelaporan Celah Cakupan Geografis yang Jujur (Honest Coverage Gap)**:
   - Untuk 32 provinsi dan kota/kabupaten yang belum memiliki saluran Damkar terverifikasi, sistem tidak menyubstitusikan nomor antah berantah. Aplikasi secara jujur mengembalikan daftar kosong (`channels: []`) dengan notice eksplisit bahwa saluran Damkar setempat belum terverifikasi.

---

## 3. Checklist Cakupan 38 Provinsi di Indonesia (Status Karhutla & Damkar)

| No | Provinsi | Status Cakupan pada Direktori Aktif | Rincian Entri Terverifikasi / Catatan Celah Riset |
|:---|:---|:---|:---|
| 1 | **Aceh** | `RESEARCHGAP` | Portal resmi Damkar Banda Aceh / kabupaten belum menampilkan kontak darurat terbuka. Celah cakupan dilaporkan jujur. |
| 2 | **Sumatera Utara** | `RESEARCHGAP` | Portal dinas damkar Medan/kabupaten belum terverifikasi pada batch ini. |
| 3 | **Sumatera Barat** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 4 | **Riau** | **Terverifikasi (Kota Pekanbaru)** | DPKP Kota Pekanbaru: WhatsApp 24 Jam (`+62 851-8607-0113`), Tel Markas Damkar (`0761-22382`). Hanya berlaku untuk Kota Pekanbaru. |
| 5 | **Kepulauan Riau** | `RESEARCHGAP` | Pos Damkar Batam/Tanjungpinang belum terverifikasi dari portal primer terbuka. Tidak terkena substring Riau. |
| 6 | **Jambi** | `RESEARCHGAP` | Kontak umum BPBD dieliminasi; damkar spesifik kabupaten/kota belum terisolasi. |
| 7 | **Sumatera Selatan** | `RESEARCHGAP` | Posko Karhutla Sumsel / Damkar Palembang belum terverifikasi dari portal primer terbuka. |
| 8 | **Kep. Bangka Belitung**| `RESEARCHGAP` | Belum ada portal dinas damkar kabupaten/kota yang terverifikasi. |
| 9 | **Bengkulu** | `RESEARCHGAP` | Belum ada portal dinas damkar terverifikasi. |
| 10 | **Lampung** | `RESEARCHGAP` | Damkar Bandar Lampung belum diverifikasi dari domain resmi terbuka. |
| 11 | **DKI Jakarta** | `RESEARCHGAP` (Arsip Kantor) | Telepon kantor dinas (`021-6344579`) dan email dinas Gulkarmat diarsipkan di riset; tidak diaktifkan di direktori karena merupakan nomor kantor administratif. |
| 12 | **Jawa Barat** | `RESEARCHGAP` | Diskar PB Kota Bandung / pos damkar kabupaten belum terverifikasi dokumen terbuka. |
| 13 | **Banten** | **Terverifikasi (Kota Serang)** | Pemadam Kebakaran Kota Serang: Tel Posko (`0254-283113`). Hanya berlaku untuk Kota Serang. |
| 14 | **Jawa Tengah** | **Terverifikasi (Kota Semarang)** | Dinas Pemadam Kebakaran Kota Semarang: Tel Posko (`024-7605871`), Email (`kebakaran.semarangkota@gmail.com`). Hanya berlaku untuk Kota Semarang. |
| 15 | **D.I. Yogyakarta** | **Terverifikasi (Kota Yogyakarta)** | Damkarmat Kota Yogyakarta: WhatsApp Call Center (`+62 811-2828-113`), Tel (`0274-587101`). Hanya berlaku untuk Kota Yogyakarta. |
| 16 | **Jawa Timur** | `RESEARCHGAP` | Pusdalops PB ada, namun kontak khusus posko karhutla/damkar kota belum terverifikasi dari portal primer. |
| 17 | **Bali** | `RESEARCHGAP` | Portal Damkar Denpasar mengalami kendala koneksi/akses pada batch ini. |
| 18 | **Nusa Tenggara Barat** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 19 | **Nusa Tenggara Timur** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 20 | **Kalimantan Barat** | **Terverifikasi (Kota Pontianak)**| Pemadam Kebakaran Panca Bakti Kota Pontianak: Tel Posko (`0561-740916`). Hanya berlaku untuk Kota Pontianak. |
| 21 | **Kalimantan Tengah** | **Terverifikasi (Kota Palangka Raya)** | DPKP Kota Palangka Raya: Tel Penanganan Kebakaran (`0536-3230113`). Hanya berlaku untuk Kota Palangka Raya. |
| 22 | **Kalimantan Selatan** | `RESEARCHGAP` | Portal BPBD membatasi akses; Damkar Banjarmasin belum terverifikasi dari portal primer. |
| 23 | **Kalimantan Timur** | `RESEARCHGAP` | Disdamkar Samarinda / Balikpapan belum diverifikasi dari domain primer. |
| 24 | **Kalimantan Utara** | `RESEARCHGAP` | Posko damkar spesifik belum terisolasi dari domain primer. |
| 25 | **Sulawesi Utara** | `RESEARCHGAP` | Damkar Manado belum diverifikasi dari portal primer terbuka. |
| 26 | **Gorontalo** | `RESEARCHGAP` | Belum ada sumber primer spesifik damkar yang berhasil diverifikasi. |
| 27 | **Sulawesi Tengah** | `RESEARCHGAP` | Damkar Kota Palu belum terverifikasi dari domain primer terbuka. |
| 28 | **Sulawesi Barat** | `RESEARCHGAP` | Belum ada portal dinas damkar Mamuju yang berhasil diverifikasi. |
| 29 | **Sulawesi Selatan** | `RESEARCHGAP` | Dinas Damkar Makassar belum terverifikasi dari portal resmi terbuka. |
| 30 | **Sulawesi Tenggara** | `RESEARCHGAP` | Damkar Kendari belum diverifikasi dari domain primer. |
| 31 | **Maluku** | `RESEARCHGAP` | Damkar Kota Ambon belum diverifikasi dari portal resmi. |
| 32 | **Maluku Utara** | `RESEARCHGAP` | Damkar Ternate belum terverifikasi dari domain primer. |
| 33 | **Papua** | `RESEARCHGAP` | Damkar Jayapura belum terverifikasi dari portal resmi terbuka. |
| 34 | **Papua Barat** | `RESEARCHGAP` | Kontak portal resmi merupakan Call Center BPBD umum, bukan posko karhutla/damkar. |
| 35 | **Papua Selatan** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 36 | **Papua Tengah** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 37 | **Papua Pegunungan** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 38 | **Papua Barat Daya** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |

**Ringkasan Cakupan Geografis**:
- Wilayah dengan saluran kota terverifikasi: **6 Kota dalam 6 Provinsi** (Kota Pekanbaru [Riau], Kota Palangka Raya [Kalimantan Tengah], Kota Pontianak [Kalimantan Barat], Kota Semarang [Jawa Tengah], Kota Yogyakarta [D.I. Yogyakarta], Kota Serang [Banten]).
- Wilayah dengan status **`RESEARCHGAP`**: **32 provinsi** tanpa satupun saluran lokal terverifikasi, dan cakupan tingkat provinsi tetap belum terbukti bahkan pada 6 provinsi di atas (hanya mencakup kota bersangkutan).
- Pengguna di luar 6 kota tersebut disajikan pemberitahuan celah cakupan yang jujur (*gap cakupan*) tanpa pengalihan otomatis atau nomor fiktif.

---

## 4. Rincian Bukti Sumber Primer 9 Saluran Damkar Aktif

1. **Dinas Pemadam Kebakaran dan Penyelamatan (DPKP) Kota Pekanbaru, Riau**
   - ID: `damkar-pekanbaru-wa` (`+62 851-8607-0113`), `damkar-pekanbaru-tel` (`0761-22382`)
   - Ruang Lingkup: `Kota Pekanbaru, Riau` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://www.pekanbaru.go.id/p/news/respon-cepat-damkar-pekanbaru-kini-layanan-pengaduan-bisa-lewat-whatsapp-24-jam-nonstop` (Rilis Pemkot Pekanbaru 03 Nov 2025).
   - Bukti Tekstual: Peluncuran resmi layanan pengaduan WhatsApp 24 jam nonstop DPKP Pekanbaru dan nomor telepon markas damkar.

2. **Dinas Pemadam Kebakaran dan Penyelamatan Kota Palangka Raya, Kalimantan Tengah**
   - ID: `damkar-palangkaraya-tel` (`0536-3230113`)
   - Ruang Lingkup: `Kota Palangka Raya, Kalimantan Tengah` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://mediacenter.palangkaraya.go.id/warga-palangka-raya-diimbau-waspadai-potensi-kebakaran/`
   - Bukti Tekstual: Publikasi Media Center Pemkot Palangka Raya untuk nomor respon penanganan kebakaran DPKP.

3. **Pemadam Kebakaran Panca Bakti Kota Pontianak, Kalimantan Barat**
   - ID: `damkar-pontianak-pancabakti-tel` (`0561-740916`)
   - Ruang Lingkup: `Kota Pontianak, Kalimantan Barat` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://www.pontianak.go.id/layanan-publik/daftar-telepon`
   - Bukti Tekstual: Direktori layanan publik resmi Pemkot Pontianak mendaftarkan telepon posko pemadam kebakaran.

4. **Dinas Pemadam Kebakaran Kota Semarang, Jawa Tengah**
   - ID: `damkar-semarang-tel` (`024-7605871`), `damkar-semarang-email` (`kebakaran.semarangkota@gmail.com`)
   - Ruang Lingkup: `Kota Semarang, Jawa Tengah` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://ppid.semarangkota.go.id/kb/pemadaman-kebakaran-kota-semarang-2/`
   - Bukti Tekstual: Portal PPID resmi Pemkot Semarang mencantumkan kontak posko pemadam kebakaran kota.

5. **Dinas Pemadam Kebakaran dan Penyelamatan (Damkarmat) Kota Yogyakarta, D.I. Yogyakarta**
   - ID: `damkarmat-jogjakota-wa` (`+62 811-2828-113`), `damkarmat-jogjakota-tel` (`0274-587101`)
   - Ruang Lingkup: `Kota Yogyakarta, D.I. Yogyakarta` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://jogjakota.go.id/page/helpdesk`
   - Bukti Tekstual: Portal helpdesk resmi Pemkot Yogyakarta mendaftarkan saluran WhatsApp call center dan telepon Damkarmat.

6. **Pemadam Kebakaran Kota Serang, Banten**
   - ID: `damkar-kotaserang-tel` (`0254-283113`)
   - Ruang Lingkup: `Kota Serang, Banten` | Status: `public` | Tanggal Cek: `2026-10-29`
   - Sumber: `https://birokesra.bantenprov.go.id/berita/daftar-nomor-telepon-darurat-damkar-dan-bpbd-di-banten-siaga-24-jam-tangani-kondisi-kebencanaan`
   - Bukti Tekstual: Publikasi resmi Biro Kesra Pemprov Banten mempublikasikan nomor telepon darurat damkar se-Banten.
