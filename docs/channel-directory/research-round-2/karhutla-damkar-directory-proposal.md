# Usulan Transisi Direktori Kontak: Fokus Karhutla & Damkar Setempat

Tanggal Akses & Penyusunan: **29 Oktober 2026 (Asia/Jakarta)**  
Penyusun: **AGY (Research & Documentation)**  
Status: **Proposal Evaluasi Bounded Batch (Menunggu Keputusan Diskusi)**  
Berkas Terkait:
- Data Tambahan Terverifikasi (14 Rekor): [`supplemental-karhutla-damkar-channels.json`](./supplemental-karhutla-damkar-channels.json)
- Baseline Dataset Awal (Read-Only): [`indonesia-emergency-channels.json`](../indonesia-emergency-channels.json)
- Checklist Baseline (Read-Only): [`sources-and-checklist.md`](../sources-and-checklist.md)

---

## 1. Latar Belakang & Arahan Pengguna

Berdasarkan arahan langsung dari pengguna (*user directive*):
> *"kita diskusi dulu, ganti semua nomor itu pakai yang karhutla dan juga pakai nomor damkar setempat aja, bilang itu ke agy."*

Serta umpan balik koordinator (*review coordinator*):
- Kontak harus memuat bukti spesifik dan eksplisit untuk tujuan Karhutla (*forest/land fire*) atau Posko Pemadam Kebakaran (*Damkar*) setempat.
- Saluran BPBD umum atau email kantor kesekretariatan tanpa mandat eksplisit pemadaman api/karhutla (seperti Call Center BPBD Papua Barat atau Pusdalops umum Jawa Timur) tidak boleh dimasukkan ke dalam subset terverifikasi dan dipindahkan ke catatan *research gaps*.
- Saluran kantor dinas (seperti Gulkarmat DKI Jakarta) harus dicatat secara jujur sebagai telepon kantor dinas, bukan dilabeli sebagai posko darurat lapangan jika sumber tidak menyatakannya demikian.
- Mencantumkan tanggal publikasi sumber jika tersedia dan menjaga batasan riset tanpa mengubah dataset aktif aplikasi (`indonesia-emergency-channels.json`).

---

## 2. Evaluasi 25 Kontak Baseline (Status Retensi & Usulan Eliminasi)

Pada rilis awal, terdapat 25 kontak terdaftar yang mencakup layanan darurat umum, BNPB, Basarnas, serta nomor kantor BPBD provinsi. Berdasarkan arahan baru yang berfokus ketat pada Karhutla dan Damkar, berikut evaluasi rincinya:

| ID Kontak Baseline | Label Kontak | Ruang Lingkup | Rekomendasi | Rasionil Evaluasi |
|:---|:---|:---|:---:|:---|
| `kemenhut-posko-tel` | Posko Karhutla Kemenhut (Telepon) | Nasional | **PERTAHANKAN** | Saluran resmi penanganan Karhutla tingkat nasional. Terverifikasi pada siaran pers Kemenhut 07 Sep 2026. |
| `kemenhut-posko-wa` | Posko Karhutla Kemenhut (WhatsApp) | Nasional | **PERTAHANKAN** | Saluran pesan resmi Posko Karhutla Kementerian Kehutanan (+62 8131-00-35000). |
| `kemenhut-posko-email` | Posko Karhutla Kemenhut (Email) | Nasional | **PERTAHANKAN** | Saluran pelaporan tertulis resmi Posko Karhutla Kemenhut (`posko.karhutla@kehutanan.go.id`). |
| `darurat-112` | Panggilan Darurat 112 | Regional (Kemenkomdigi) | **USUL HAPUS/ARSIP** | Layanan darurat umum multi-sektor (bukan nomor khusus pos karhutla/damkar). |
| `bnpb-callcenter-117` | Call Center BNPB 117 | Nasional | **USUL HAPUS/ARSIP** | Call center umum multi-bencana BNPB, bukan pos armada damkar lapangan. |
| `bnpb-pusdalops-tel` | Pusdalops BNPB (Telepon) | Nasional | **USUL HAPUS/ARSIP** | Nomor koordinasi operasional umum BNPB pusat. |
| `bnpb-pusdalops-email` | Pusdalops BNPB (Email) | Nasional | **USUL HAPUS/ARSIP** | Kontak administratif kesekretariatan BNPB pusat. |
| `basarnas-darurat-115` | Basarnas Darurat SAR 115 | Nasional | **USUL HAPUS/ARSIP** | Khusus operasi pencarian dan pertolongan (SAR), bukan pemadaman kebakaran. |
| `bpba-aceh-tel` | BPBA Aceh (Telepon Kantor) | Aceh | **USUL HAPUS/ARSIP** | Telepon kantor jam dinas BPBA umum (bukan damkar kota/kabupaten). |
| `bpba-aceh-wa` | BPBA Aceh (WhatsApp Pusdalops) | Aceh | **USUL HAPUS/ARSIP** | Layanan koordinasi Pusdalops umum multi-bencana Aceh. |
| `bpbd-riau-tel` | BPBD Riau (Telepon Seluler Pusdalops) | Riau | **USUL HAPUS/ARSIP** | Digantikan nomor darurat damkar setempat (DPKP Pekanbaru). |
| `bpbd-riau-office-tel` | BPBDPK Riau (Telepon Kantor) | Riau | **USUL HAPUS/ARSIP** | Nomor landline jam kerja kantor sekretariat. |
| `bpbd-jambi-tel` | BPBD Provinsi Jambi (Telepon Kantor) | Jambi | **USUL HAPUS/ARSIP** | Telepon kantor jam dinas BPBD Jambi. |
| `bpbd-jambi-email` | BPBD Provinsi Jambi (Email) | Jambi | **USUL HAPUS/ARSIP** | Email persuratan dinas. |
| `bpbd-dki-tel` | BPBD DKI Jakarta (Telepon) | DKI Jakarta | **USUL HAPUS/ARSIP** | Digantikan langsung oleh kontak Dinas Gulkarmat DKI Jakarta. |
| `bpbd-jabar-tel` | BPBD Jawa Barat (Telepon) | Jawa Barat | **USUL HAPUS/ARSIP** | Telepon kantor umum BPBD Jabar. |
| `bpbd-jabar-email` | BPBD Jawa Barat (Email) | Jawa Barat | **USUL HAPUS/ARSIP** | Email administratif kesekretariatan BPBD Jabar. |
| `bpbd-jateng-tel` | BPBD Jawa Tengah (Telepon) | Jawa Tengah | **USUL HAPUS/ARSIP** | Digantikan Dinas Pemadam Kebakaran Kota Semarang. |
| `bpbd-diy-tel` | BPBD D.I. Yogyakarta (Telepon) | D.I. Yogyakarta | **USUL HAPUS/ARSIP** | Digantikan kontak Damkarmat Kota Yogyakarta. |
| `bpbd-diy-wa` | BPBD D.I. Yogyakarta (WhatsApp) | D.I. Yogyakarta | **USUL HAPUS/ARSIP** | Nomor koordinasi Pusdalops DIY multi-bencana. |
| `bpbd-kalbar-tel` | BPBD Kalimantan Barat (Telepon Kantor)| Kalimantan Barat | **USUL HAPUS/ARSIP** | Digantikan nomor pemadam kebakaran setempat (Panca Bakti Pontianak). |
| `bpbd-kalbar-email` | BPBD Kalimantan Barat (Email) | Kalimantan Barat | **USUL HAPUS/ARSIP** | Email kesekretariatan dinas. |
| `bpbpk-kalteng-tel` | BPBPK Kalimantan Tengah (Telepon) | Kalimantan Tengah | **USUL HAPUS/ARSIP** | Digantikan Damkar DPKP Kota Palangka Raya. |
| `bpbpk-kalteng-email` | BPBPK Kalimantan Tengah (Email) | Kalimantan Tengah | **USUL HAPUS/ARSIP** | Email administratif pemerintah provinsi. |
| `bpbd-bali-tel` | BPBD Provinsi Bali (Telepon Kantor) | Bali | **USUL HAPUS/ARSIP** | Telepon kantor jam dinas BPBD Bali. |

**Ringkasan Evaluasi:**
- **Dipertahankan:** 3 kontak (Posko Karhutla Kemenhut nasional: Tel, WA, Email).
- **Diusulkan Dieliminasi/Diarsipkan:** 22 kontak (Layanan umum 112/117/115 serta nomor sekretariat/kantor BPBD multi-bencana umum).

---

## 3. Realitas Tata Kelola Damkar & Dilema Routing Otomatis

Peralihan ke "Nomor Damkar Setempat" menghadirkan karakteristik yurisdiksi dan teknis operasional penting:

### 3.1. Struktur Kewenangan Otonomi Daerah
- **Tingkat Kabupaten/Kota:** Di Indonesia, dinas pemadam kebakaran (*Dinas Penanggulangan Kebakaran dan Penyelamatan / DPKP / Satpol PP dan Damkar*) dibentuk pada tingkat **Kabupaten dan Kota**, bukan tingkat Provinsi.
- **Pengecualian Khusus:** DKI Jakarta adalah satu-satunya provinsi di mana Dinas Gulkarmat beroperasi secara terpusat di tingkat provinsi dengan pos sektor di bawahnya.
- **Konsekuensi Data:** Di 37 provinsi lainnya, tidak ada entitas tunggal "Damkar Provinsi X". Setiap kabupaten/kota (lebih dari 514 kabupaten/kota di Indonesia) memiliki posko damkar masing-masing.

### 3.2. Risiko Routing Otomatis Berdasarkan GPS
Jika aplikasi secara otomatis memilih nomor damkar atau melakukan pemanggilan instan semata-mata berdasarkan titik koordinat GPS ponsel:
1. **Ketidaksesuaian Titik Pantau vs Titik Api:** Pengguna yang melihat kepulan asap Karhutla sering kali berada beberapa kilometer dari lokasi kejadian, bahkan dapat melintasi batas kabupaten/kota atau provinsi (misalnya saat berkendara antar-wilayah).
2. **Keterbatasan Sinyal di Area Hutan:** Di pelosok tanpa sinyal GPS presisi, ponsel mungkin terhubung ke menara BTS di kabupaten tetangga, sehingga routing otomatis akan menyasar pos damkar yang keliru.
3. **Penyaluran ke Posko yang Salah Yurisdiksi:** Memanggil pos damkar kabupaten tetangga dapat menyebabkan penolakan respon armada akibat batasan yurisdiksi kewilayahan.

### 3.3. Rekomendasi Desain UX Saluran
1. **Fallback Nasional Permanen:** Tampilkan selalu Posko Karhutla Kemenhut (Nasional) sebagai opsi utama yang valid dihubungi dari mana saja.
2. **Pemilih Hirarkis Dua Tingkat (Provinsi &rarr; Kabupaten/Kota / Posko):** Sediakan daftar dropdown/list interaktif agar pengguna dapat memilih posko damkar yang sesuai dengan lokasi kejadian yang mereka amati.
3. **GPS Sebagai Rekomendasi Saja:** Koordinat ponsel pengamat hanya digunakan untuk menyarankan (*suggest/pre-select*) wilayah terdekat, bukan memicu dialer otomatis tanpa konfirmasi pengguna.

---

## 4. Bukti Sumber Primer Kontak Tambahan Terverifikasi (14 Rekor)

Berikut rincian 14 rekor yang terbukti secara eksplisit dan lolos verifikasi ketat sumber primer pemerintah:

1. **Posko Karhutla Kementerian Kehutanan (Nasional)**
   - Telepon: `021-5704618` (`kemenhut-posko-tel`)
   - WhatsApp: `+62 8131-00-35000` (`kemenhut-posko-wa`)
   - Email: `posko.karhutla@kehutanan.go.id` (`kemenhut-posko-email`)
   - **Sumber:** `https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini` (Tanggal rilis: 07 September 2026).
   - **Bukti Tekstual:** Siaran pers resmi Kementerian Kehutanan yang mencantumkan secara eksplisit kanal pengaduan dan koordinasi pengendalian kebakaran hutan dan lahan.

2. **Dinas Penanggulangan Kebakaran dan Penyelamatan (Gulkarmat) DKI Jakarta**
   - Telepon Kantor Dinas: `021-6344579` (`damkar-dki-tel`)
   - Email Dinas: `damkardki@jakarta.go.id` (`damkar-dki-email`)
   - **Sumber:** `https://pemadam.jakarta.go.id/id`.
   - **Bukti Tekstual:** Portal resmi Dinas Gulkarmat DKI Jakarta; dicatat jujur sesuai perannya sebagai kontak kantor dinas pemadam kebakaran provinsi.

3. **Dinas Pemadam Kebakaran dan Penyelamatan (DPKP) Kota Pekanbaru, Riau**
   - Telepon Markas Damkar: `0761-22382` (`damkar-pekanbaru-tel`)
   - WhatsApp Pengaduan Damkar 24 Jam Nonstop: `+62 851-8607-0113` (`damkar-pekanbaru-wa`)
   - **Sumber:** `https://www.pekanbaru.go.id/p/news/respon-cepat-damkar-pekanbaru-kini-layanan-pengaduan-bisa-lewat-whatsapp-24-jam-nonstop` (Tanggal rilis: 03 November 2025).
   - **Bukti Tekstual:** Laman berita resmi Pemkot Pekanbaru memverifikasi nomor telepon markas dan meluncurkan nomor WhatsApp khusus pengaduan kebakaran yang beroperasi secara eksplisit 24 jam nonstop.

4. **Dinas Pemadam Kebakaran dan Penyelamatan Kota Palangka Raya, Kalimantan Tengah**
   - Telepon Penanganan Kebakaran: `0536-3230113` (`damkar-palangkaraya-tel`)
   - **Sumber:** `https://mediacenter.palangkaraya.go.id/warga-palangka-raya-diimbau-waspadai-potensi-kebakaran/`.
   - **Bukti Tekstual:** Media Center Pemkot Palangka Raya mempublikasikan nomor layanan pemadaman kebakaran DPKP untuk respon cepat potensi kebakaran.

5. **Pemadam Kebakaran Panca Bakti Kota Pontianak, Kalimantan Barat**
   - Telepon Posko: `0561-740916` (`damkar-pontianak-pancabakti-tel`)
   - **Sumber:** `https://www.pontianak.go.id/layanan-publik/daftar-telepon`.
   - **Bukti Tekstual:** Direktori layanan publik resmi Pemkot Pontianak mendaftarkan saluran telepon posko pemadam kebakaran.

6. **Dinas Pemadam Kebakaran Kota Semarang, Jawa Tengah**
   - Telepon Posko: `024-7605871` (`damkar-semarang-tel`)
   - Email: `kebakaran.semarangkota@gmail.com` (`damkar-semarang-email`)
   - **Sumber:** `https://ppid.semarangkota.go.id/kb/pemadaman-kebakaran-kota-semarang-2/`.
   - **Bukti Tekstual:** Portal PPID resmi Pemkot Semarang mencantumkan kontak posko pemadam kebakaran kota.

7. **Dinas Pemadam Kebakaran dan Penyelamatan (Damkarmat) Kota Yogyakarta, D.I. Yogyakarta**
   - WhatsApp Call Center: `+62 811-2828-113` (`damkarmat-jogjakota-wa`)
   - Telepon: `0274-587101` (`damkarmat-jogjakota-tel`)
   - **Sumber:** `https://jogjakota.go.id/page/helpdesk`.
   - **Bukti Tekstual:** Portal Helpdesk Pemkot Yogyakarta mendaftarkan secara eksplisit layanan WhatsApp call center dan telepon Damkarmat Kota Yogyakarta.

8. **Pemadam Kebakaran Kota Serang, Banten**
   - Telepon Posko: `0254-283113` (`damkar-kotaserang-tel`)
   - **Sumber:** `https://birokesra.bantenprov.go.id/berita/daftar-nomor-telepon-darurat-damkar-dan-bpbd-di-banten-siaga-24-jam-tangani-kondisi-kebencanaan`.
   - **Bukti Tekstual:** Portal resmi Biro Kesra Pemprov Banten mempublikasikan daftar nomor telepon darurat damkar se-Banten.

---

## 5. Checklist Cakupan 38 Provinsi & Catatan Rekor yang Dikecualikan

### 5.1. Rekor yang Dikecualikan Setelah Verifikasi Koordinasi
- **BPBD Provinsi Papua Barat (`bpbd.papuabaratprov.go.id`):** Nomor WhatsApp 0811-4850-1414 dan email dicantumkan sebagai "Call Center BPBD" umum. Karena tidak memiliki mandat spesifik Karhutla atau pos pemadam kebakaran, rekor ini **dikeluarkan dari proposal dataset** dan dipindahkan ke `RESEARCHGAP`.
- **BPBD Provinsi Jawa Timur (`web.bpbd.jatimprov.go.id`):** Nomor WhatsApp 0812-317-80000 merupakan saluran penanganan darurat Pusdalops PB umum. Karena tidak didukung bukti tekstual spesifik posko karhutla terisolasi, rekor ini **dikeluarkan dari proposal dataset** dan dipindahkan ke `RESEARCHGAP`.

### 5.2. Tabel Status 38 Provinsi (Kategori Karhutla & Damkar Setempat)

| No | Provinsi | Status Riset Karhutla/Damkar | Sumber Primer yang Ditinjau / Catatan |
|:---|:---|:---|:---|
| 1 | **Aceh** | `RESEARCHGAP` | Portal resmi Damkar Banda Aceh / kabupaten belum menampilkan laman kontak terbuka. |
| 2 | **Sumatera Utara** | `RESEARCHGAP` | Portal dinas damkar Medan/provinsi tidak dapat diakses langsung pada batch ini. |
| 3 | **Sumatera Barat** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 4 | **Riau** | **Terverifikasi (Kota Pekanbaru)** | `https://www.pekanbaru.go.id/`: DPKP Tel (0761) 22382, WA 0851-8607-0113 (24 Jam). |
| 5 | **Kepulauan Riau** | `RESEARCHGAP` | Pos Damkar Batam/Tanjungpinang belum terverifikasi dari portal primer. |
| 6 | **Jambi** | `RESEARCHGAP` | Kontak umum BPBD Jambi ada di baseline, namun damkar spesifik belum terisolasi. |
| 7 | **Sumatera Selatan** | `RESEARCHGAP` | Posko Karhutla Sumsel / Damkar Palembang belum terverifikasi dari portal primer terbuka. |
| 8 | **Kep. Bangka Belitung** | `RESEARCHGAP` | Belum ada portal dinas damkar kabupaten/kota yang berhasil diverifikasi. |
| 9 | **Bengkulu** | `RESEARCHGAP` | Belum ada portal dinas damkar terverifikasi. |
| 10 | **Lampung** | `RESEARCHGAP` | Damkar Bandar Lampung belum diverifikasi dari domain resmi terbuka. |
| 11 | **DKI Jakarta** | **Terverifikasi (Provinsi)** | `https://pemadam.jakarta.go.id/id`: Dinas Gulkarmat Tel (021) 6344579, Email dinas. |
| 12 | **Jawa Barat** | `RESEARCHGAP` | Diskar PB Kota Bandung / pos daerah belum terverifikasi dokumen terbuka. |
| 13 | **Banten** | **Terverifikasi (Kota Serang)** | `https://birokesra.bantenprov.go.id/`: Damkar Kota Serang Tel (0254) 283113. |
| 14 | **Jawa Tengah** | **Terverifikasi (Kota Semarang)** | `https://ppid.semarangkota.go.id/`: Dinas Damkar Tel (024) 7605871, Email. |
| 15 | **D.I. Yogyakarta** | **Terverifikasi (Kota Yogyakarta)** | `https://jogjakota.go.id/page/helpdesk`: Damkarmat WA 0811-2828-113, Tel (0274) 587101. |
| 16 | **Jawa Timur** | `RESEARCHGAP` | Pusdalops PB ada, namun nomor khusus posko karhutla/damkar kota belum terverifikasi. |
| 17 | **Bali** | `RESEARCHGAP` | Portal Damkar Denpasar mengalami kendala koneksi/akses pada batch ini. |
| 18 | **Nusa Tenggara Barat** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 19 | **Nusa Tenggara Timur** | `RESEARCHGAP` | Belum terverifikasi dari portal dinas resmi terbuka. |
| 20 | **Kalimantan Barat** | **Terverifikasi (Kota Pontianak)**| `https://www.pontianak.go.id/`: Pemadam Kebakaran Panca Bakti Tel (0561) 740916. |
| 21 | **Kalimantan Tengah** | **Terverifikasi (Kota Palangka Raya)** | `https://mediacenter.palangkaraya.go.id/`: DPKP Tel (0536) 3230113. |
| 22 | **Kalimantan Selatan** | `RESEARCHGAP` | Portal BPBD membatasi akses; Damkar Banjarmasin belum terverifikasi dari portal primer. |
| 23 | **Kalimantan Timur** | `RESEARCHGAP` | Disdamkar Samarinda / Balikpapan belum diverifikasi dari domain primer. |
| 24 | **Kalimantan Utara** | `RESEARCHGAP` | Portal Pemprov SDGs mencantumkan kontak umum; posko damkar belum terisolasi. |
| 25 | **Sulawesi Utara** | `RESEARCHGAP` | Damkar Manado belum diverifikasi dari portal primer terbuka. |
| 26 | **Sulawesi Tengah** | `RESEARCHGAP` | Damkar Kota Palu belum terverifikasi dari domain primer terbuka. |
| 27 | **Sulawesi Selatan** | `RESEARCHGAP` | Dinas Damkar Makassar belum terverifikasi dari portal resmi terbuka. |
| 28 | **Sulawesi Tenggara** | `RESEARCHGAP` | Damkar Kendari belum diverifikasi dari domain primer. |
| 29 | **Gorontalo** | `RESEARCHGAP` | Belum ada sumber primer spesifik damkar yang berhasil diverifikasi. |
| 30 | **Sulawesi Barat** | `RESEARCHGAP` | Belum ada portal dinas damkar Mamuju yang berhasil diverifikasi. |
| 31 | **Maluku** | `RESEARCHGAP` | Damkar Kota Ambon belum diverifikasi dari portal resmi. |
| 32 | **Maluku Utara** | `RESEARCHGAP` | Damkar Ternate belum terverifikasi dari domain primer. |
| 33 | **Papua** | `RESEARCHGAP` | Damkar Jayapura belum terverifikasi dari portal resmi terbuka. |
| 34 | **Papua Barat** | `RESEARCHGAP` | Kontak portal resmi merupakan Call Center BPBD umum, bukan posko karhutla/damkar. |
| 35 | **Papua Selatan** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 36 | **Papua Tengah** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 37 | **Papua Pegunungan** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |
| 38 | **Papua Barat Daya** | `RESEARCHGAP` | Daerah Otonomi Baru (DOB), portal resmi damkar belum tersedia publik. |

---

## 6. Batasan Integritas

1. **Pencantuman Publik Bukan Jaminan Respon Lapangan Seketika:**
   Nomor telepon atau WhatsApp yang dicantumkan pada portal resmi pemerintah membuktikan keberadaan saluran komunikasi resmi, namun tidak menjamin ketersediaan personel operasional saat bencana riil terjadi.
2. **Protokol Non-Interaktif:**
   Seluruh data diverifikasi secara pasif melalui pembacaan dokumen publik resmi. Tidak ada panggilan, pengiriman pesan, atau interaksi langsung dengan nomor-nomor tersebut.
3. **Penyelesaian Batch:**
   Batch terverifikasi ini telah mencukupi kebutuhan diskusi terarah. Tidak diperlukan perburuan data terbuka yang tidak berbatas (*wide hunting*), dan integrasi ke kode aplikasi menunggu arahan resmi koordinator/pengguna.
