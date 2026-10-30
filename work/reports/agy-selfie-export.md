# Laporan Integrasi Ekspor, Gate Swafoto Pengirim, dan Verifikasi Niragni (Bara)

**Penulis:** AGY (Dispatched Worker)  
**ID Tugas:** `task_2afd5fd46940`  
**Konteks Dispatch:** `ctx_8c0155226de1`  
**Terminal:** `term_0038f0a3-1216-4928-a43f-abcbc80cca51`  
**Tanggal:** 29 Oktober 2026  
**Referensi:** Dokumen Revisi (`docs/revision-2026-10-29.md`), Skill `github-test-authorization`

---

## 1. Ringkasan Eksekutif

Pekerjaan integrasi modul ekspor dan penegakan kebijakan swafoto pengirim (*sender selfie gate*) telah disempurnakan pada kode sumber [export.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/export.ts) dan dihubungkan pada layanan utama [index.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/index.ts).

Kebijakan ekspor menerapkan prinsip *fail-closed security*, *zero-trust caller*, dan pertahanan traversal yang ketat:
1. Data laporan dibaca secara otoritatif dari repositori penyimpanan persisten (`this.repository.getReport()`) berdasarkan ID yang telah disanitasi; objek swafoto yang disuntikkan pemanggil dalam memori ditolak jika tidak tersimpan di basis data.
2. Swafoto pengirim wajib bersumber langsung dari kamera depan (`source: 'camera'`), terikat pada ID laporan yang sama, beralamat di dalam direktori privat media laporan bersangkutan, serta berkas fisiknya terbukti ada dan tidak kosong (> 0 byte).
3. Jalur URI swafoto divalidasi melalui fungsi normalisasi mandiri `isSafeDescendantPath` tanpa dependensi Node `path`, menolak secara tegas traversal literal (`..`), traversal ter-encode (`%2e%2e`, `..%2f`, `%252e%252e`), backslash (`\`), dan encoded backslash (`%5c`).
4. Seluruh foto insiden terpilih dan swafoto pengirim di-re-encode ke format JPEG guna mematikan metadata sensitif EXIF/GPS sebelum diserahkan ke dialog OS native. Target berkas dicatat sebelum `.copy()`, dan jika terjadi kegagalan pemrosesan, seluruh berkas sementara dibersihkan (*rollback*) tanpa merusak berkas media asli.
5. Teks laporan yang diekspor menyertakan keterangan eksplisit: *"Foto pengirim — identitas belum diverifikasi."*
6. Fitur salin teks laporan (`copyReport`) dinonaktifkan secara permanen untuk menutup celah *bypass* kewajiban foto dan swafoto, dengan pesan yang konsisten menyatakan *"selfie pengirim yang tersimpan/diperiksa berkasnya"* tanpa klaim verifikasi identitas.
7. Validasi `channelId` menegakkan bahwa hanya kanal Damkar aktif terverifikasi yang dapat menjadi target penerima terarah.
8. Seluruh 29 pengujian pada berkas uji [selfie-export.test.ts](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/__tests__/selfie-export.test.ts) lulus 100%, sehingga total pengujian unit Jest pada proyek mencapai 125 tes lulus tanpa kegagalan.

---

## 2. Penegakan Kebijakan Ekspor & Gate Swafoto Pengirim

### 2.1 Pembacaan Otoritatif & Pencegahan Pemalsuan (Anti-Forgery)
Pada metode `shareReport(report: Report, channelId?: string)`:
- Aplikasi tidak mempercayai `report.senderSelfie` yang dikirimkan pemanggil melalui argumen fungsi. Hal ini mencegah serangan injeksi memori atau pemalsuan objek runtime.
- Sistem secara independen memanggil `await this.repository.getReport(safeReportId)`. Jika laporan persisten tidak memiliki rekaman swafoto di basis data, eksekusi langsung dihentikan sebelum manipulasi berkas atau peluncuran dialog OS dilakukan.

### 2.2 Validasi Integritas Swafoto & Pencegahan Traversal
Sebelum izin ekspor diberikan, swafoto diverifikasi melalui lapisan penjaga (*guards*):
1. **Keberadaan Rekaman:** `persisted.senderSelfie` tidak boleh null atau undefined.
2. **Sumber Kamera Depan:** `selfie.source === 'camera'` (swafoto dari galeri/library ditolak).
3. **Kepemilikan Yurisdiksi Laporan:** `selfie.reportId === safeReportId` (swafoto milik laporan lain ditolak).
4. **Isolasi Direktori Media Privat & Pertahanan Traversal:**
   - Divalidasi menggunakan helper mandiri `isSafeDescendantPath(baseDirUri, selfie.uri)` murni di lingkungan React Native (tanpa modul Node `path`).
   - Menolak keras keberadaan token `..`, `%2e%2e`, `..%2f`, `%252e%252e`, karakter backslash `\`, serta `%5c`.
   - Mengurai URL encoding hingga stabil dan memastikan path target merupakan turunan sah di bawah prefix direktori `bara_media/reports/<safeReportId>/`.
   - Tetap mendukung URI privat yang sah dengan spasi ter-encode (seperti `Application%20Support` pada iOS sandbox).
5. **Keberadaan Fisik Berkas:** Berkas fisik pada path URI wajib ada di penyimpanan lokal dan memiliki ukuran byte nyata (`selfieFile.exists && selfieFile.size > 0`).

### 2.3 Sanitasi EXIF & Re-Encoding JPEG (Fail-Closed)
- Seluruh foto bukti kejadian yang dipilih dan foto swafoto pengirim diproses melalui `expo-image-manipulator` (`manipulateAsync`) dengan format target `SaveFormat.JPEG` dan kompresi `0.9`.
- Berkas target destinasi didaftarkan ke array pelacak `createdFiles` **sebelum operasi penyalinan berkas (`.copy()`)** dimulai. Hal ini memastikan bahwa jika proses copy menghasilkan berkas parsial lalu melempar galat I/O (misal disk penuh), berkas parsial tersebut tetap dapat diidentifikasi dan dihapus.
- Berkas hasil sanitasi disimpan ke direktori cache sementara khusus laporan: `bara_exports/<safeReportId>/`.
- **Kebijakan Fail-Closed:** Jika terjadi galat pemrosesan gambar pada salah satu foto atau swafoto, sistem menghapus seluruh berkas sementara yang telah dibuat dalam batch tersebut (`cleanupPartials()`) tanpa menyentuh berkas asli di direktori media laporan, dan melempar eksepsi. Berkas asli tidak pernah diserahkan ke antarmuka OS sebagai fallback darurat demi melindungi privasi pengguna.
- **Catatan Bukti Verifikasi:** Pengujian pada tahap ini membuktikan integritas pipeline kontrol alur kode program (*mock pipeline behavior*). Hal ini secara tegas dibedakan dari bukti analisis tag EXIF aktual pada binari gambar nyata, yang memerlukan pengujian pada perangkat fisik setelah integrasi runtime penuh.

### 2.4 Pelabelan Jujur & Format Ekspor
- Teks laporan hasil format `previewExport` digabungkan dengan label teks wajib:
  ```text
  Foto pengirim — identitas belum diverifikasi.
  ```
- Swafoto dan foto bukti kejadian diserahkan secara terpisah dalam array `urls` pada opsi `Share.open`.
- Swafoto tidak pernah dikirimkan atau diproses oleh inferensi AI offline.

### 2.5 Penutupan Celah Salin Teks (`copyReport`)
- Untuk mencegah pengguna atau pihak ketiga membypass kewajiban swafoto dengan menyalin teks mentah laporan ke clipboard lalu mengirimkannya secara terpisah, metode `copyReport` dinonaktifkan:
  ```typescript
  public async copyReport(_report: Report): Promise<void> {
    throw new Error(
      'Fitur salin teks laporan dinonaktifkan untuk mencegah bypass kewajiban lampiran foto dan swafoto pengirim. ' +
      'Gunakan menu berbagi resmi dengan selfie pengirim yang tersimpan/diperiksa berkasnya.'
    );
  }
  ```
- Pernyataan galat secara konsisten menggunakan istilah *"selfie pengirim yang tersimpan/diperiksa berkasnya"* dan tidak memuat klaim verifikasi identitas palsu. Import `Clipboard` yang tidak lagi digunakan telah dihapus dari kode sumber.

### 2.6 Validasi Kanal Penerima (`channelId`)
- Jika pemanggil menyertakan `channelId`, sistem memvalidasi ID tersebut terhadap direktori aktif Damkar (`CHANNEL_DIRECTORY` & `VERIFIED_INCIDENT_CHANNEL_IDS`).
- ID tidak dikenal atau saluran nasional lama yang telah dicabut (misal: `kemenhut-posko-tel`) langsung ditolak sebelum persiapan berkas.
- Jika `channelId` tidak disertakan (`undefined`), dialog OS dibuka dalam mode lembar berbagi generik (*generic share sheet*) di bawah kendali penuh pengguna, tanpa klaim otomatis penerima.

### 2.7 Pencatatan Riwayat Aktivitas Jujur (Honest Share Events)
- Pembukaan dialog OS berhasil dicatat sebagai `share_sheet_opened`.
- Pembatalan oleh pengguna (dialog ditutup / *user did not share*) dicatat sebagai `cancelled` tanpa melempar eksepsi.
- Kegagalan teknis intent OS dicatat sebagai `unknown` dan melempar galat informatif.
- Sistem tidak pernah mencatat status "terkirim" atau "diterima" karena aplikasi tidak memiliki bukti transmisi end-to-end dari aplikasi pihak ketiga.

---

## 3. Penghubungan Layanan pada [`index.ts`](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/core/index.ts)

Kelas `BaraProductServices` secara lengkap mengimplementasikan kontrak antarmuka `ProductServices`:
```typescript
public async captureSenderSelfie(reportId: string): Promise<SenderSelfie | null> {
  await this.init();
  return this.repository.captureSenderSelfie(reportId);
}

public async removeSenderSelfie(reportId: string): Promise<Report> {
  await this.init();
  return this.repository.removeSenderSelfie(reportId);
}
```
Inisialisasi memoized (`await this.init()`) memastikan tabel basis data `sender_selfies` dan direktori penyimpanan telah siap sebelum pemanggilan kamera depan dilakukan.

---

## 4. Matriks Pengujian Unit & Verifikasi

### 4.1 Suite Pengujian Ekspor: [`selfie-export.test.ts`](file:///C:/Belajar/Sem5/Niragni/apps/qvac-spike/src/__tests__/selfie-export.test.ts) (29 Pengujian)

| Skenario Pengujian | Kondisi Masukan | Perilaku yang Terbukti | Status |
|:---|:---|:---|:---:|
| **Authoritative Read** | Persisted selfie null, pemanggil menginjeksi selfie memori | Ditolak sebelum manipulasi berkas atau panggilan OS | **PASS** |
| **Report Missing** | ID laporan tidak ada di repositori | Ditolak dengan pesan laporan tidak ditemukan | **PASS** |
| **Wrong Source** | Selfie dengan `source: 'library'` | Ditolak; wajib berasal langsung dari kamera | **PASS** |
| **Wrong Owner** | Selfie dengan `reportId` berbeda | Ditolak; indikasi pertukaran swafoto antar draf | **PASS** |
| **Outside Path** | URI di luar direktori media laporan | Ditolak; pencegahan akses berkas tidak sah | **PASS** |
| **Literal Traversal** | URI memuat `..` menuju direktori draf lain | Ditolak meskipun berkas fisik sasaran ada | **PASS** |
| **Encoded Traversal** | URI memuat `%2e%2e` atau `..%2f` | Terurai oleh normalizer dan ditolak | **PASS** |
| **Backslash Traversal** | URI memuat karakter backslash `\` atau `%5c` | Ditolak langsung sebagai URI tidak sah | **PASS** |
| **Missing File** | Rekaman DB ada, berkas disk fisik hilang | Ditolak; berkas fisik wajib ada | **PASS** |
| **Empty File** | Rekaman DB ada, berkas fisik 0 byte | Ditolak; berkas tidak boleh kosong | **PASS** |
| **Descendant Normalizer** | Path sah dengan/tanpa trailing slash | Diterima sebagai turunan sah | **PASS** |
| **Descendant Spaces** | Path sah dengan spasi atau `%20` | Diterima normal tanpa salah deteksi | **PASS** |
| **Descendant Traversal** | Token traversal multi-level `%252e%252e` | Ditolak pada pengujian unit normalizer | **PASS** |
| **Descendant Backslash** | Input dengan karakter backslash | Ditolak pada pengujian unit normalizer | **PASS** |
| **Descendant Prefix Collision**| Prefix folder bersaudara (`rep_1_fake`) | Ditolak; boundary slash dipaksakan | **PASS** |
| **Descendant Malformed** | String URI malformed atau kosong | Ditolak dengan aman tanpa uncaught exception | **PASS** |
| **Invalid Channel** | `channelId` tidak ada di direktori | Ditolak sebelum pemrosesan foto | **PASS** |
| **Retired Channel** | `channelId` Kemenhut nasional lama | Ditolak; bukan kanal Damkar aktif | **PASS** |
| **Valid Damkar** | `damkar-pekanbaru-wa` | Berhasil diproses, channelId tercatat di share attempt | **PASS** |
| **Generic Share** | `channelId: undefined` | Berhasil diproses, membuka sheet generik | **PASS** |
| **EXIF Re-encoding** | Foto insiden dan swafoto valid | Keduanya di-re-encode ke JPEG, label teks verbatim disertakan | **PASS** |
| **Fail-Closed Selfie** | Manipulasi selfie gagal | Batal total, partials dihapus, Share.open tidak dipanggil | **PASS** |
| **Fail-Closed Photo** | Manipulasi foto insiden gagal | Batal total, partials dihapus, Share.open tidak dipanggil | **PASS** |
| **Fail-Closed Copy Crash** | Copy menghasilkan destinasi parsial lalu crash | Berkas parsial batch sendiri dihapus, berkas media asli terjaga | **PASS** |
| **User Cancel** | Dialog OS ditutup/dibatalkan pengguna | Tercatat sebagai `cancelled`, fungsi selesai tanpa galat | **PASS** |
| **OS Share Error** | Dialog OS gagal meluncur | Tercatat sebagai `unknown`, melempar eksepsi | **PASS** |
| **Copy Blocked** | Pemanggilan `copyReport()` | Melempar galat tanpa klaim verifikasi identitas | **PASS** |
| **Preview Transparency** | `previewExport` pada laporan dengan selfie | Hanya menampilkan foto insiden di `photoUris`, tidak memalsukan selfie | **PASS** |
| **Draft Preview** | `previewExport` pada draf tanpa selfie | Berjalan normal tanpa melempar galat atau memalsukan selfie | **PASS** |

### 4.2 Matriks Keseluruhan Proyek (9 Suite Jest)

| No | Suite Pengujian | Jumlah Tes | Status | Fokus Cakupan |
|:---:|:---|:---:|:---:|:---|
| 1 | `selfie-export.test.ts` | 29 | **PASS** | Gate swafoto otoritatif, anti-traversal, EXIF JPEG fail-closed. |
| 2 | `model-list-status.test.ts` | 8 | **PASS** | Preseden fisik vs DB, perbaikan bug P3, independensi model. |
| 3 | `channel-selector.test.ts` | 24 | **PASS** | Selektor kanonikal Damkar-only, eliminasi false-positive substring. |
| 4 | `damkar-only.test.ts` | 30 | **PASS** | 9 kanal aktif Damkar, integritas .go.id, gap 23 wilayah. |
| 5 | `pressable-style.test.ts` | 6 | **PASS** | Preservasi styling PressableScale saat ditekan / dilepas. |
| 6 | `native-readiness.test.ts` | 8 | **PASS** | Integritas SHA-256 model, lifecycle worker native. |
| 7 | `state.test.ts` | 6 | **PASS** | Manajemen state worker lokal, cancellation, penanganan galat. |
| 8 | `prompt.test.ts` | 5 | **PASS** | Validasi format prompt observasi karhutla. |
| 9 | `manifest.test.ts` | 9 | **PASS** | Integritas manifest candidate SmolVLM2 dan VisionPsy. |
| **Total** | **9 Suite Pengujian** | **125** | **100% PASS** | Waktu eksekusi: ~1.45 detik. |

---

## 5. Status Verifikasi, Keterbatasan & Pending Items

1. **Status Typecheck & Build:**
   - Pemeriksaan typecheck menyeluruh (`tsc --noEmit`) pada proyek saat ini terhambat oleh galat sintaks parser pada berkas `apps/qvac-spike/src/core/repository.ts` milik Kiro (TS1005/TS1128 akibat penutupan kelas prematur dan sintaks impor).
   - Berkas yang berada dalam kepemilikan AGY (`export.ts`, `index.ts`, `channel-directory.ts`, `channel-selector.ts`, dan seluruh berkas uji) tidak memicu galat diagnostik lokal baru pada editor.
   - Pemeriksaan typecheck global dan build aplikasi berada dalam status tertunda (*pending*) sampai Kiro menyelesaikan perbaikan sintaks repositori.
2. **Validasi Pipeline Mock vs Bukti EXIF Fisik:**
   - Pengujian unit (125 tes lulus) membuktikan integritas alur logika program (*mock pipeline verification*), penjaga akses, penolakan traversal, dan penanganan kegagalan.
   - Pengujian ini secara tegas belum merupakan bukti fisik pembersihan tag EXIF pada binari gambar aktual di perangkat riil. Bukti decoding binari EXIF fisik dan uji visual on-device tetap tertunda (*pending*) sampai perangkat fisik dapat dihubungkan kembali dan build terintegrasi selesai.
3. **Kesiapan Integrasi:**
   - Modul ekspor dan gate swafoto berada dalam kondisi siap integrasi (*integration-ready*) untuk digabungkan bersama modul repositori Kiro. Aplikasi belum diklaim siap untuk rilis produksi (*not claimed ready for deployment*) sebelum build end-to-end dan verifikasi perangkat fisik tuntas.
4. **Protokol Tanpa Perangkat:** Sesuai instruksi, tidak ada perintah ADB, dev server, atau kontak eksternal yang dijalankan.
