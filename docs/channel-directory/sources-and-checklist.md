# Indonesian Karhutla & Emergency Channel Directory — Sources and Coverage Checklist

Access Date: **29 October 2026 (Asia/Jakarta)**  
Dataset File: [`indonesia-emergency-channels.json`](./indonesia-emergency-channels.json)  
Dataset Schema Target: `Channel` contract ([`product-contract.ts`](../../apps/qvac-spike/src/product-contract.ts))

---

## 1. Metodologi Riset & Batasan Integritas Data

1. **Sumber Primer Pemerintah (`.go.id`)**:
   - Seluruh kontak yang dimasukkan ke dalam subhimpunan kandidat terverifikasi bersumber langsung dari laman web atau footer portal resmi pemerintah.
   - Setiap entri didukung bukti tautan resmi spesifik yang diverifikasi pada riset ini.
2. **Kesesuaian Tipe Saluran (*Channel Kind*)**:
   - Tipe saluran (`phone`, `whatsapp`, `email`) ditetapkan secara ketat berdasarkan label verbatim pada sumber resmi pemerintah.
   - Bila sumber hanya mencantumkan nomor telepon tanpa tulisan "WhatsApp", saluran dicatat sebagai `phone`.
   - Menghindari penyematan label yang tidak terbukti secara tekstual (seperti operasional 24 jam atau bebas pulsa).
3. **Definisi Status Ketersediaan (`availability`)**:
   - `public`: Kontak tercantum secara resmi pada laman/footer pemerintah yang diverifikasi pada tanggal pengecekan. Status ini mencerminkan pencantuman publik resmi, bukan bukti keterhubungan riil saat bencana terjadi.
   - `unconfirmed`: Kontak yang implementasinya bersifat lokal per daerah atau memerlukan verifikasi operasional lebih lanjut di tingkat wilayah.
4. **Protokol Non-Interaktif (Zero Outbound Contact)**:
   - Riset dilakukan secara pasif dan berbasis dokumen publik. Peneliti **tidak melakukan panggilan telepon, pesan WhatsApp, email, pembuatan akun, maupun transaksi keuangan** ke pihak mana pun.
5. **Pemisahan Pengamatan dan Pelaporan**:
   - Keberadaan saluran dalam direktori ini hanya berfungsi untuk membuka penangan eksternal OS (dialer, email, share) atas tindakan eksplisit pengguna.
   - Direktori ini **bukan bukti penerimaan insiden secara otomatis** oleh instansi terkait.
6. **Definisi Celah Riset (*Research Gap*)**:
   - Ketiadaan kontak terverifikasi untuk suatu daerah dalam riset ini **hanya mencerminkan keterbatasan penemuan sumber primer pada sesi riset ini**, bukan bukti bahwa instansi atau layanan di daerah tersebut tidak aktif atau tidak ada.

---

## 2. Status Layanan Panggilan Darurat 112

Layanan Panggilan Darurat 112 di Indonesia diselenggarakan oleh pemerintah daerah (kabupaten/kota/provinsi) yang bermitra dengan **Kementerian Komunikasi dan Digital (Komdigi)**:
- Implementasi 112 bersifat terdesentralisasi per pemerintah daerah dan **tidak dapat diasumsikan hadir merata di seluruh wilayah Indonesia**.
- Efektivitas panggilan 112 bergantung pada apakah pemerintah daerah tempat pengguna berada telah mengaktifkan dan mengoperasikan sistem call center 112.
- Mengingat cakupan yang bergantung pada wilayah tersebut, kanal 112 diklasifikasikan sebagai **`Regional (tergantung wilayah)`** dengan ketersediaan **`unconfirmed`** secara umum.

---

## 3. Checklist Cakupan 38 Provinsi di Indonesia

Status verifikasi kontak darurat tingkat provinsi berdasarkan ketersediaan bukti sumber primer pada riset ini (10 provinsi terverifikasi, 28 celah riset):

| No | Provinsi | Status Cakupan pada Riset Ini | Bukti Sumber Spesifik / Catatan |
|:---|:---|:---|:---|
| 1 | **Aceh** | **Terverifikasi (Provinsi)** | `https://bpba.acehprov.go.id/halaman/profil-ppid`: Tel Kantor (0651) 34783, Pusdalops WA: 081360669111 |
| 2 | **Sumatera Utara** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 3 | **Sumatera Barat** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 4 | **Riau** | **Terverifikasi (Provinsi)** | `https://bpbd.riau.go.id/`: Phone 0811-7612-000; `https://ppid.riau.go.id/informasi-publik/1287/profil-badan-penanggulangan-bencana-daerah-dan-pemadam-kebakaran-%28bpbdpk%29-provinsi-riau`: Tel Kantor (0761) 855734 |
| 5 | **Kepulauan Riau** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 6 | **Jambi** | **Terverifikasi (Provinsi)** | `https://bpbd.jambiprov.go.id/kontak/`: Tel Kantor (0741) 5913258, Email bpbd@jambiprov.go.id |
| 7 | **Sumatera Selatan** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 8 | **Kep. Bangka Belitung**| Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 9 | **Bengkulu** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 10 | **Lampung** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 11 | **DKI Jakarta** | **Terverifikasi (Provinsi)** | `https://bpbd.jakarta.go.id/`: Tel (021) 6344766 |
| 12 | **Jawa Barat** | **Terverifikasi (Provinsi)** | `https://bpbd.jabarprov.go.id/tentangkami`: Tel (022) 7313267, Email bpbd@jabarprov.go.id |
| 13 | **Banten** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 14 | **Jawa Tengah** | **Terverifikasi (Provinsi)** | `https://bpbd.jatengprov.go.id/`: Tel Kantor (024) 3519927 |
| 15 | **D.I. Yogyakarta** | **Terverifikasi (Provinsi)** | `https://bpbd.jogjaprov.go.id/kontak`: Phone (0274) 555585, WhatsApp (0274) 555584 |
| 16 | **Jawa Timur** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 17 | **Bali** | **Terverifikasi (Provinsi)** | `https://bpbd.baliprov.go.id/`: Tel Kantor 0361-245397, Email bpbd@baliprov.go.id |
| 18 | **Nusa Tenggara Barat** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 19 | **Nusa Tenggara Timur** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 20 | **Kalimantan Barat** | **Terverifikasi (Provinsi)** | `https://bpbd.kalbarprov.go.id/`: Tel Kantor (0561) 744219, Email bpbdprovinsikalimantanbarat@gmail.com |
| 21 | **Kalimantan Tengah** | **Terverifikasi (Provinsi)** | `https://kalteng.go.id/page/72/kepala-badan` (pembaruan 26 Agt 2026): Tel Kantor (0536) 3235428 |
| 22 | **Kalimantan Selatan** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 23 | **Kalimantan Timur** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 24 | **Kalimantan Utara** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 25 | **Sulawesi Utara** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 26 | **Gorontalo** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 27 | **Sulawesi Tengah** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 28 | **Sulawesi Barat** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 29 | **Sulawesi Selatan** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 30 | **Sulawesi Tenggara** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 31 | **Maluku** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 32 | **Maluku Utara** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 33 | **Papua** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 34 | **Papua Barat** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 35 | **Papua Selatan** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 36 | **Papua Tengah** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 37 | **Papua Pegunungan** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |
| 38 | **Papua Barat Daya** | Belum ada sumber primer cukup pada riset ini | Celah riset pada sesi ini |

---

## 4. Rincian Bukti Sumber & URL Persis Entri Terverifikasi

Setiap entri dalam [`indonesia-emergency-channels.json`](./indonesia-emergency-channels.json) didukung oleh bukti laman resmi berikut:

1. **Posko Karhutla Kementerian Kehutanan (Telepon, WhatsApp, Email)**
   - Nomor/Alamat: `021-5704618` (phone), `+62 8131-00-35000` (whatsapp), `posko.karhutla@kehutanan.go.id` (email)
   - Laman Bukti: `https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini`
   - Tanggal Cek: `2026-10-28`
   - Keterangan: Publikasi resmi Kemenhut tentang kontak aduan karhutla.
2. **Pusat Pengendalian Operasi (Pusdalops) BNPB**
   - Nomor/Alamat: `117` (phone, Call Center), `021-29827444` (phone, Telepon Pusdalops), `pusdalops@bnpb.go.id` (email)
   - Laman Bukti: `https://www.bnpb.go.id/kontak`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Tabel kontak resmi Graha BNPB bagian Pusat Pengendalian Operasi (Pusdalops).
3. **Badan Nasional Pencarian dan Pertolongan (Basarnas)**
   - Nomor: `115` (phone, Panggilan Darurat SAR)
   - Laman Bukti: `https://basarnas.go.id/`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Banner layanan darurat SAR nasional.
4. **Badan Penanggulangan Bencana Aceh (BPBA)**
   - Nomor: `0651-34783` (phone, Telepon Kantor), `+62 813-6066-9111` (whatsapp, WhatsApp Pusdalops)
   - Laman Bukti: `https://bpba.acehprov.go.id/halaman/profil-ppid`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Laman PPID mencantumkan Telp/Fax: (0651) 34783 dan WhatsApp Pusdalops: 081360669111.
5. **BPBD Provinsi Riau & BPBDPK Provinsi Riau**
   - Nomor: `0811-7612-000` (phone) dan `0761-855734` (phone)
   - Laman Bukti:
     - Nomor `0811-7612-000`: `https://bpbd.riau.go.id/` (footer mencatat label "Phone")
     - Nomor `0761-855734`: `https://ppid.riau.go.id/informasi-publik/1287/profil-badan-penanggulangan-bencana-daerah-dan-pemadam-kebakaran-%28bpbdpk%29-provinsi-riau`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Keduanya dicatat sebagai tipe `phone` sesuai teks sumber.
6. **BPBD Provinsi Jambi**
   - Nomor/Alamat: `0741-5913258` (phone), `bpbd@jambiprov.go.id` (email)
   - Laman Bukti: `https://bpbd.jambiprov.go.id/kontak/`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Halaman kontak resmi memuat alamat Jl. Pematang Sulur, nomor telepon (0741) 5913258, dan email instansi.
7. **BPBD Provinsi Kalimantan Barat**
   - Nomor/Alamat: `0561-744219` (phone), `bpbdprovinsikalimantanbarat@gmail.com` (email)
   - Laman Bukti: `https://bpbd.kalbarprov.go.id/`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Beranda resmi memuat nomor telepon kantor (0561) 744219 dan email instansi.
8. **BPBPK Provinsi Kalimantan Tengah**
   - Nomor: `0536-3235428` (phone)
   - Laman Bukti: `https://kalteng.go.id/page/72/kepala-badan`
   - Tanggal Cek: `2026-10-29` (pembaruan data 26 Agustus 2026)
   - Keterangan: Daftar profil kepala badan Pemerintah Provinsi Kalimantan Tengah untuk BPBD memuat nomor telepon kantor (0536) 3235428.
9. **BPBD Provinsi DKI Jakarta**
   - Nomor: `021-6344766` (phone)
   - Laman Bukti: `https://bpbd.jakarta.go.id/`
   - Tanggal Cek: `2026-10-29`
   - Keterangan: Laman resmi BPBD Provinsi DKI Jakarta.
10. **BPBD Provinsi Jawa Barat**
    - Nomor/Alamat: `022-7313267` (phone), `bpbd@jabarprov.go.id` (email)
    - Laman Bukti: `https://bpbd.jabarprov.go.id/tentangkami`
    - Tanggal Cek: `2026-10-29`
    - Keterangan: Laman Tentang Kami memuat nomor telepon kantor (022) 7313267 dan email resmi.
11. **BPBD Provinsi Jawa Tengah**
    - Nomor: `024-3519927` (phone)
    - Laman Bukti: `https://bpbd.jatengprov.go.id/`
    - Tanggal Cek: `2026-10-29`
    - Keterangan: Bagian kontak Jl. Imam Bonjol No. 1 F Semarang memuat nomor telepon (024) 3519927.
12. **BPBD D.I. Yogyakarta**
    - Nomor: `0274-555585` (phone), `+62 274-555584` (whatsapp)
    - Laman Bukti: `https://bpbd.jogjaprov.go.id/kontak`
    - Tanggal Cek: `2026-10-29`
    - Keterangan: Laman kontak resmi secara eksplisit mencantumkan "Phone: (0274) 555585" dan "WhatsApp: (0274) 555584".
13. **BPBD Provinsi Bali**
    - Nomor/Alamat: `0361-245397` (phone), `bpbd@baliprov.go.id` (email)
    - Laman Bukti: `https://bpbd.baliprov.go.id/`
    - Tanggal Cek: `2026-10-29`
    - Keterangan: Laman resmi memuat nomor telepon (0361) 245397 dan email instansi.

---

## 5. Ringkasan Kesenjangan Riset & Kesiapan Handover

1. **Subhimpunan Terverifikasi**:
   - Terdapat **25 entri total** dalam dataset kandidat JSON: **24 entri public** dan **1 entri unconfirmed** (`darurat-112`).
   - Cakupan regional mencakup **10 provinsi terverifikasi**, dan **28 provinsi tercatat sebagai celah riset** pada sesi ini.
2. **Kesiapan Handover ke Kiro**:
   - File dataset [`indonesia-emergency-channels.json`](./indonesia-emergency-channels.json) memuat subhimpunan yang bersumber resmi, bebas dari klaim berlebihan, dan siap diintegrasikan oleh Kiro.
