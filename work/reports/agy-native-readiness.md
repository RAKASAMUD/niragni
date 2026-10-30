# Laporan Kesiapan AI & Native Niragni (Bara Karhutla Scope)

- **Tanggal & Waktu**: 29 Oktober 2026, 08:26 WIB (Asia/Jakarta)
- **Task ID**: `task_679d7fcdfbec`
- **Dispatch ID**: `ctx_d42e4165f69d`
- **Penyusun**: AGY (Antigravity) — Dispatched AI/Native Worker
- **Batas Kepemilikan Edit**: `work/reports/agy-native-readiness.md` dan `apps/qvac-spike/src/__tests__/native-readiness.test.ts`
- **Kode Diperiksa (Read-Only)**: `src/core/**`, `src/worker.ts`, `src/manifest.ts`, `src/product-contract.ts`, `qvac.config.js`, `app.json`, `android/build.gradle`

---

## 1. Ringkasan Eksekutif

Audit integrasi native dan model AI offline Niragni (Bara) diselesaikan berdasarkan berkas manifest aktual, kode sumber core, telemetri adb read-only bertanggal, dan eksekusi tes unit perilaku terarah.

Poin utama:
1. **Penyematan SDK & Model Pinned**: Pustaka `@qvac/sdk@0.22.0`, `@qvac/fabric-android-arm64@0.22.0`, dan `react-native-bare-kit@0.16.0` semuanya berlisensi Apache-2.0. Pasangan model multimodal SmolVLM2 500M (545,6 MB total, Apache-2.0) dan alternatif VisionPsy Nano 460M Flash (545,5 MB total, Apache-2.0) terpin dengan ukuran bita presisi dan SHA-256 dari komit terverifikasi Hugging Face.
2. **Integritas Kesiapan & Lifecycle**: Manifest dan model manager secara ketat mengklasifikasikan berkas yang cocok ukuran namun belum dihitung SHA-256 sebagai `unverified` (`isReady: false`). Status `ready` pada basis data SQLite hanya diberikan setelah uji muat memori lokal berhasil (`worker.loadModel` + `worker.unloadModel`) dengan stempel waktu `lastLocalCheck`. `LifecycleCoordinator` mengunci inferensi/unduh/impor/cek secara sinkron sebelum async pertama dan membatalkan inferensi otomatis saat aplikasi ke background (`AppState`).
3. **Pengukuran Latensi & Gerbang <10 Detik**: Latensi cold didefinisikan inklusif: `totalColdTurnaroundMs = loadDurationMs + generationDurationMs`. Pada inferensi warm, `loadDurationMs` dan `totalColdTurnaroundMs` bernilai `undefined`. Target evaluasi warga adalah latensi end-to-end <10 detik (mencakup persiapan, hash check, load, inferensi, dan validasi skema). Delta streaming dilacak sebagai delta chunk dan karakter aktual tanpa fabrikasi token palsu.
4. **Inventaris Perangkat Fisik vs Batas Bukti**: Telemetri adb read-only mengonfirmasi Xiaomi 14T (`2406APNFAG`, `degas_global`), Android 16 (SDK 36, patch 2026-07-01), HyperOS `OS3.0.304.0.WNEIDXM` (MIUI `V816`), SoC MT6897 (Dimensity 8300-Ultra), RAM fisik 11,05 GiB (3,22 GiB tersedia), penyimpanan bebas 163 GB. Berkas pasangan SmolVLM2 di `/sdcard/Download` cocok ukuran bita audit, namun **statusnya di handset masih byte-size only (SHA-256 belum dihitung di perangkat)**. Belum ada pengujian inferensi offline nyata pada handset ini; berkas APK yang ada membuktikan keberhasilan kompilasi dan bundling, bukan bukti inferensi runtime.
5. **Verifikasi Tes**: 28 pengujian unit terarah lulus 100% (4 test suites, 0 gagal), termasuk 8 pengujian perilaku baru pada `src/__tests__/native-readiness.test.ts` dengan controlled timing clock, multi-photo contract assertions, dan background cancellation.
6. **Sinkronisasi UI (Kiro)**: Teridentifikasi catatan impor missing `Divider` dan `Row` pada `app/report/[id]/edit.tsx` dan `app/report/[id]/share.tsx` yang bersifat transien saat Kiro mengerjakan redesain antarmuka.

---

## 2. Penyematan SDK & Native Runtime (File Aktual)

Berdasarkan inspeksi berkas `apps/qvac-spike/package.json`, `package-lock.json`, `qvac.config.js`, dan `app.json`:

| Pustaka / Komponen | Versi Terpin | Lisensi | Peran & Batas Native |
|---|---|---|---|
| `@qvac/sdk` | `0.22.0` | Apache-2.0 | Entry point kanonik inferensi lokal (`loadModel`, `completion`, `cancel`, `unloadModel`, `InferenceCancelledError`). |
| `@qvac/fabric-android-arm64` | `0.22.0` | Apache-2.0 | Shared library C++ ARM64 (`libqvac__llm-llamacpp.0.61.2.so`, `libqvac-ggml-vulkan.so`, `libbare-kit.so`). |
| `@qvac/fabric-ios` | `0.22.0` | Apache-2.0 | Biner iOS untuk bundler multi-host. |
| `react-native-bare-kit` | `0.16.0` | Apache-2.0 | Runtime jembatan C++ Bare worklet (eksekusi llama.cpp terisolasi dari JS UI thread). |
| `@noble/hashes` | `2.4.0` | MIT | Pustaka murni chunked streaming SHA-256 (blok 256KB, yield tiap 2MB, `AbortSignal`). |
| `zod` | `4.6.5` | MIT | Validasi skema output AI (`.strict()`) dan verifikasi asal-usul data (provenance). |
| `expo` | `~54.0.33` | MIT | Mobile application framework. |
| `react-native` | `0.81.5` | MIT | Core runtime. |
| `Android NDK` | `29.0.14206865` | Open Source | NDK r29 terkonfigurasi di `local.properties` dan `withBaraNdk.cjs`. |
| `Target APK` | `artifacts/niragni-android.apk` | Proprietary Repo | Terverifikasi `aapt dump badging`: `package: name='com.niragni.bara'`, `versionCode='1'`, `versionName='1.0.0'`, `targetSdkVersion='36'`. |
| Bundler Config | `qvac.config.js` | Proprietary Repo | Murni `plugins: [PLUGIN_LLM]`, `includeAudioDecoder: false`. |

---

## 3. Pasangan Model Multimodal, Hash, dan Lisensi Terpin

Metadata disinkronkan langsung dari Hugging Face Git LFS commit pins (`docs/spike/qvac-audit.md` dan `apps/qvac-spike/src/manifest.ts`):

### 3.1 Kandidat A: SmolVLM2 500M Video Instruct (Primer)
- **Model ID**: `smolvlm2-500m`
- **Lisensi**: Apache-2.0
- **Repositori Upstream**: `ggml-org/SmolVLM2-500M-Video-Instruct-GGUF`
- **Komit Pinned**: `ccd7aae53bcb1997355c2f094959e72b3642ce17`
- **Berkas Model**: `SmolVLM2-500M-Video-Instruct-Q8_0.gguf`
  - Ukuran: `436,808,704` bytes (~416,57 MiB)
  - SHA-256: `6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc`
- **Berkas Projector**: `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf`
  - Ukuran: `108,785,184` bytes (~103,75 MiB)
  - SHA-256: `921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b`
- **Total Jejak Pasangan**: `545,593,888` bytes (~520,32 MiB)
- **Konfigurasi Eksekusi**: `ctx_size: 8192`, `device: 'cpu'` (default aman CPU)
- **Keterbatasan Terverifikasi**: Tag upstream mencatat `["en"]`; sintaksis Bahasa Indonesia pada draf karhutla belum diuji pada perangkat fisik.

### 3.2 Kandidat B: VisionPsy Nano 460M Flash (Alternatif)
- **Model ID**: `visionpsy-nano-460m`
- **Lisensi**: Apache-2.0
- **Repositori Upstream**: `qvac/VisionPsy-Nano-460M-Flash-GGUFs`
- **Komit Pinned**: `a24fb9cdd1119406b15ff60b06a51f8438a931c1`
- **Berkas Model**: `visionpsy-nano-460m-flash-q8_0.gguf` (436,676,000 bytes, SHA-256 `66d84c0f...`)
- **Berkas Projector**: `mmproj-visionpsy-nano-460m-flash-q8.gguf` (108,782,144 bytes, SHA-256 `bbb06918...`)
- **Total Jejak Pasangan**: `545,458,144` bytes (~520,19 MiB)
- **Konfigurasi Eksekusi**: `ctx_size: 8192`, `image_no_upscale: 'on'` (flag wajib mencegah degradasi resolusi), `device: 'cpu'`

---

## 4. Audit Arsitektur Lifecycle, Error, dan Kejujuran Kesiapan

### 4.1 Kejujuran Integritas Model
- **Klasifikasi 5 Status Berkas (`manifest.ts`)**: `missing`, `size_mismatch`, `unverified` (cocok ukuran bita namun hash belum dihitung), `hash_mismatch`, `valid`. Berkas berstatus `unverified` dilarang keras diberi flag `isReady: true`.
- **Verifikasi Eksplisit (`checkModel` pada `src/core/models.ts`)**: Pemanggilan eksplisit selalu menghitung ulang streaming SHA-256 kedua berkas secara penuh untuk mendeteksi korupsi data in-place dengan ukuran sama.
- **Uji Muat Nyata Sebelum 'Ready'**: Status `ready` pada tabel `model_states` SQLite hanya dicatat bila uji muat in-memory (`worker.loadModel` + `worker.unloadModel`) berhasil, dilengkapi stempel waktu ISO `lastLocalCheck`. Bila native runtime C++ menolak berkas, status dicatat `incompatible`.
- **Sidik Jari Pasangan Memori (`PairFingerprint`)**: Melacak `{ uri, size, modificationTime }`. Penggantian berkas di disk secara otomatis membatalkan model yang aktif di memori dan memuat ulang berkas baru.

### 4.2 Lifecycle & Pembatalan Background
- **Penguncian Sinkron**: `LifecycleCoordinator` mengakuisisi penguncian secara sinkron sebelum `await` pertama untuk operasi `inferring`, `downloading`, `importing`, `checking`, dan `deleting`. Penolakan langsung melempar pesan berbahasa Indonesia yang jelas.
- **Transisi Background**: Listener `AppState` menangkap status `background`/`inactive` dan memicu pembatalan inferensi atau unduhan guna mencegah Android Low Memory Killer (LMK) mematikan proses.
- **Pembatalan Bersih**: `worker.cancelInference()` memanggil SDK `cancel({ requestId })`. Error `InferenceCancelledError` ditangkap dengan anggun, mempertahankan teks parsial yang sempat terakumulasi dan menandai `cancelled: true`.
- **Promosi Pasangan Atomik**: Unduhan/impor menulis ke `.partial`, membackup berkas lama ke `.backup` saat promosi, dan memulihkan berkas lama bila terjadi kegagalan rename. Anggaran ruang bebas mensyaratkan margin 25% (`requiredBytes * 1.25`).

---

## 5. Pengukuran Latensi Cold/Warm & Target <10 Detik

### 5.1 Definisi Metrik
- **Latensi Cold (Cold Start)**: Model belum berada di RAM.
  $$\text{totalColdTurnaroundMs} = \text{loadDurationMs} + \text{generationDurationMs}$$
  - `loadDurationMs`: Durasi pemindahan 545 MB bobot dari flash ke RAM dan inisialisasi llama.cpp context.
  - `firstChunkDurationMs`: Durasi dari pemanggilan completion hingga delta teks visual pertama terbit.
  - `generationDurationMs`: Durasi generasi teks hingga token selesai.
- **Latensi Warm (Warm Start)**: Model yang sama sudah aktif di RAM (`isModelLoaded() === true` dan sidik jari cocok).
  Pada kondisi ini, `loadDurationMs` dan `totalColdTurnaroundMs` adalah `undefined`; latensi murni durasi generasi.
- **Latensi End-to-End**: Pengukuran waktu total dari sentuhan tombol oleh pengguna di UI, mencakup persiapan input, pengecekan hash/sidik jari, pemuatan model (bila cold), inferensi streaming, hingga validasi skema JSON Zod.

### 5.2 Standar Target Pengguna
- **Target Utama**: Seluruh proses penyusunan draf diupayakan selesai dalam waktu **<10 detik** jika kapasitas perangkat keras memadai.
- **Tingkat Responsif**: Delta pertama diupayakan muncul dalam <3 detik agar antarmuka tidak tampak membeku.
- **Kejujuran Delta vs Token**: Aplikasi melacak delta chunks dan karakter riil; metrik token/detik murni bersumber dari `run.stats.tokensPerSecond` engine native, bukan estimasi sintetis.

---

## 6. Inventaris Perangkat Fisik (Read-Only adb 2026-10-29)

Pemeriksaan read-only dilakukan langsung pada perangkat fisik melalui `adb`:

### 6.1 Telemetri Perangkat Keras & HyperOS
- **Pabrikan & Model**: `Xiaomi` / `2406APNFAG` (`degas_global`, Xiaomi 14T Global)
- **Versi Android & SDK**: `Android 16` (API level 36), security patch `2026-07-01`
- **Lapisan Antarmuka**: HyperOS `OS3.0.304.0.WNEIDXM`, MIUI `V816` (versi code `816`)
- **Chipset / SoC**: MediaTek MT6897 (Dimensity 8300-Ultra), 8-Core ARMv9 (arsitektur murni `arm64-v8a`)
- **GPU**: ARM Mali-G615 MC6 (dukungan driver Vulkan/OpenCL pada Mali belum pernah diprofilkan; default adalah CPU)
- **Memori RAM Fisik (Satuan Konsisten)**:
  - `MemTotal`: `11,585,580 kB` (11.314,04 MiB / ~11,05 GiB)
  - `MemFree`: `1,085,080 kB` (1.059,65 MiB / ~1,03 GiB)
  - `MemAvailable`: `3,381,920 kB` (3.302,66 MiB / ~3,22 GiB kapasitas memori kerja efektif)
- **Penyimpanan Internal (`/data`)**: Total 481 GB, Terpakai 317 GB, **Bebas 163 GB**
- **Status Aplikasi Terpasang**: Paket `com.niragni.bara` saat ini **belum terpasang** di handset.
- **Koneksi adb Aktif**: Terhubung melalui **Wireless adb TLS** (`adb-858PQWINIRGMYXKR-kKOcO5._adb-tls-connect._tcp`).

### 6.2 Status Berkas Model di Handset (`/sdcard/Download`)
Inspeksi direktori `/sdcard/Download` menemukan:
- `SmolVLM2-500M-Video-Instruct-Q8_0.gguf`: `436,808,704` bytes (tertanggal 2026-10-29 02:22)
- `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf`: `108,785,184` bytes (tertanggal 2026-10-29 02:22)

> [!IMPORTANT]
> Kedua berkas di atas **baru cocok ukuran bitanya saja (byte-size only)** terhadap manifest audit. Perhitungan SHA-256 pada storage handset **belum pernah dijalankan**. Status integritas formalnya di perangkat adalah *unverified* hingga proses impor/checkModel lokal menghitung dan memvalidasi hash tersebut.

### 6.3 Matriks Batas Bukti: Tersedia vs Belum Teruji
| Aspek Evaluasi | Status Nyata | Fakta & Batas Bukti |
|---|---|---|
| Biner APK Release ARM64 | **Tersedia** | `artifacts/niragni-android.apk` (240.264.749 bytes, target `com.niragni.bara` v1.0.0, API 36). Bukti kompilasi, bukan bukti inferensi. |
| Perangkat Fisik Xiaomi 14T | **Tersedia & Terhubung** | Terdeteksi via adb wireless: MT6897, RAM 11 GB, HyperOS 3.0. |
| Bobot Model di Handset | **Tersedia (Byte-size only)** | Berkas SmolVLM2 ada di `/sdcard/Download`, SHA-256 handset belum dihitung. |
| **Pemuatan Nyata ke RAM Xiaomi** | **BELUM DILAKUKAN** | Model belum pernah dimuat ke memori kerja runtime aplikasi di perangkat ini. |
| **Inferensi Teks+Foto Offline** | **BELUM DILAKUKAN** | Tidak ada pengukuran latensi atau token runtun nyata pada Xiaomi 14T. |
| **Profil Akselerasi GPU Mali** | **BELUM TERUJI** | QVAC OpenCL khusus Adreno. Eksekusi Vulkan pada Mali-G615 belum diprofilkan; fallback adalah CPU. |
| **Kesesuaian Bahasa Indonesia** | **BELUM TERUJI** | Output inferensi multimodal Bahasa Indonesia pada karhutla belum dievaluasi pada handset. |

---

## 7. Hasil Pengujian Unit Perilaku Terarah

Suite pengujian unit lokal dieksekusi dengan hasil:

```powershell
$env:PATH = "C:\Belajar\Sem5\Niragni\.tools\node-v22.21.1-win-x64;" + $env:PATH
cd apps/qvac-spike
npm test
```

```text
PASS src/__tests__/prompt.test.ts
PASS src/__tests__/manifest.test.ts
PASS src/__tests__/state.test.ts
PASS src/__tests__/native-readiness.test.ts

Test Suites: 4 passed, 4 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        5.903 s
Ran all test suites.
```
**Status**: 100% Lolos (28 passed, 0 failed).

Rincian 8 pengujian perilaku pada `native-readiness.test.ts`:
1. **Audit Lisensi & Budget Konteks**: Kedua kandidat berlisensi Apache-2.0, menetapkan `ctx_size >= 8192`, fallback `device: 'cpu'`, dan batasan ukuran bita minimum.
2. **Penolakan Hash Belum Terhitung**: Berkas cocok ukuran tanpa hash ditolak dengan status `unverified` (`isReady: false`).
3. **Persetujuan Pasangan Valid**: `isReady: true` hanya bila model dan projector cocok ukuran dan SHA-256.
4. **Pewaktuan Terkontrol (Controlled Clock)**: Simulasi clock maju terpisah (+1250ms load, +450ms first chunk, +550ms sisa generasi) memverifikasi `totalColdTurnaroundMs` tepat menjumlahkan durasi positif (1250 + 1000 = 2250 ms), sedangkan warm run mengembalikan `loadDurationMs` dan `totalColdTurnaroundMs` bernilai `undefined`.
5. **Pemetaan Kontrak Multi-Foto SDK**: Array path foto diverifikasi terpanggil ke `@qvac/sdk` `completion` dengan objek `attachments: [{ path: ... }, ...]`.
6. **Penghitungan Delta Chunks & Karakter Jujur**: Melacak delta streaming nyata tanpa mengarang token sintetis.
7. **Penguncian Sinkron Lifecycle**: Penolakan instan berbahasa Indonesia saat operasi lain sedang aktif.
8. **Pembatalan Background**: Event `AppState` background memicu pembatalan inferensi.

*Catatan: Tes unit menggunakan mock fixture untuk memvalidasi kontrak TypeScript/JS; ini bukan benchmark performa fisik perangkat.*

---

## 8. Catatan Sinkronisasi UI (Kiro)

Pemeriksaan `tsc --noEmit` pada `src/**` bersih. Pada layer `app/**`, teridentifikasi missing import komponen `Divider` dan `Row` pada `app/report/[id]/edit.tsx` dan `app/report/[id]/share.tsx`. Catatan ini bersifat transien selama proses redesain UI Kiro berlangsung dan diteruskan ke koordinator untuk penyelarasan akhir sebelum build APK integrasi.

---

## 9. Hambatan Nyata & Rencana Pengujian Teks+Foto Offline Xiaomi

### 9.1 Hambatan Nyata (Real Blockers)
1. **Koneksi adb Nirkabel (Wireless TLS)**: Handset saat ini tersambung via Wireless adb TLS. **Dilarang mematikan Wi-Fi atau mengaktifkan Airplane mode secara nirkabel**, karena akan memutus sesi adb. Pengujian isolasi jaringan memerlukan kabel USB fisik terverifikasi sebelum mematikan jaringan data/Wi-Fi, dan pengaturan harus dipulihkan ke kondisi awal setelah uji selesai.
2. **Pemasangan Paket & Izin Android 16**: Paket `com.niragni.bara` belum terpasang. Diperlukan instalasi `artifacts/niragni-android.apk` dan verifikasi izin file picker pada Scoped Storage API 36.
3. **Akselerasi GPU Mali-G615**: Driver Mali belum diprofilkan; eksekusi awal harus menggunakan CPU fallback default guna menjamin stabilitas.

### 9.2 Protokol Pengujian Fisik (Sesudah APK Siap)
1. **Verifikasi Jalur Sambungan**:
   - Pastikan sambungan kabel USB fisik terdeteksi stabil sebelum isolasi jaringan diuji.
   - Jangan matikan Wi-Fi melalui perintah adb nirkabel.
2. **Instalasi Paket & Pemantauan Logcat Terarah**:
   - Pasang paket: `adb install -r artifacts/niragni-android.apk`
   - Buka aplikasi dan filter logcat strictly berdasarkan PID/tag aplikasi:
     `adb logcat --pid=$(adb shell pidof -s com.niragni.bara) -v time`
     *(Dilarang membaca logcat global atau data aplikasi lain).*
3. **Impor Bobot Model & Verifikasi SHA-256 Perangkat**:
   - Buka menu pengaturan model di aplikasi Niragni.
   - Pilih berkas model dan mmproj dari `/sdcard/Download`.
   - Tunggu hingga proses streaming SHA-256 selesai di handset dan status model beralih ke `ready` setelah local load test.
4. **Uji Inferensi Cold Start (Teks + 1 Foto)**:
   - Buat draf observasi baru dengan 1 foto sampel karhutla non-pribadi dan catatan teks.
   - Jalankan "Susun Draf AI" dan catat: `loadDurationMs`, `firstChunkDurationMs`, `generationDurationMs`, serta total waktu end-to-end. Target pengguna: total <10 detik.
5. **Uji Inferensi Warm Start (Teks + 3 Foto)**:
   - Jalankan penyusunan draf kedua dengan 3 foto sampel karhutla.
   - Pastikan `loadDurationMs` tidak ditambahkan kembali (warm reuse). Catat waktu generasi dan periksa kepatuhan anti-halusinasi output Bahasa Indonesia.
6. **Uji Pembatalan & Transisi Background**:
   - Tekan tombol "Batal" saat inferensi berjalan; pastikan worker berhenti tanpa crash.
   - Pindahkan aplikasi ke background saat inferensi berjalan; pastikan proses tertangani anggun dan memori dibebaskan.
7. **Pemulihan Kondisi**:
   - Kembalikan seluruh pengaturan jaringan dan konfigurasi perangkat ke kondisi awal setelah pengujian selesai.

---

## 10. Konfirmasi Batasan & Integritas Repositori

- Tidak ada commit, push, publish, atau deploy yang dilakukan.
- Tidak ada modifikasi pada konfigurasi root, skrip build, signing key, maupun pustaka UI.
- Semua dirty dan untracked files yang sudah ada sebelumnya dipertahankan utuh.
- Seluruh 28 pengujian unit berjalan pada dependensi lokal tanpa biaya komputasi awan.
