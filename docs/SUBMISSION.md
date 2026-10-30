# Submission — Niragni

> **Track**: Offline AI Apps

## 1. Problem & target pengguna

Warga yang melihat dugaan kebakaran hutan/lahan (karhutla) di Indonesia sering kesulitan menjelaskan apa yang dilihat, di mana, dan kapan secara terstruktur — terutama di area dengan internet buruk/tidak tersedia. Menyiapkan laporan (mencatat fakta yang diamati) berbeda dari menyampaikannya (menghubungi kanal resmi); Niragni menjaga perbedaan ini secara eksplisit di UI, supaya pengguna tidak salah mengira "berhasil buka WhatsApp/dialer" sebagai "laporan sudah diterima petugas".

Target pengguna: warga umum di seluruh Indonesia (bukan pilot daerah tertentu), termasuk yang berada di area dengan konektivitas lemah saat kejadian berlangsung. Niragni adalah **alat bantu penyusunan laporan**, bukan layanan dispatch — AI tidak mendiagnosis kebakaran, hanya membantu merapikan catatan pengguna menjadi draf terstruktur Bahasa Indonesia dengan maksimal 3 pertanyaan pelengkap.

## 2. Repository

- **URL**: https://github.com/RAKASAMUD/niragni
- **Branch**: `main`

### Setup instructions & dependencies

Lihat [`README.md`](../README.md) bagian "Setup & build lokal" untuk langkah lengkap (Node.js, `npm install`, `npm run typecheck`, `npm test`, build APK via `scripts/Build-Niragni.ps1`).

### Apa yang dibangun selama event (28–30 Oktober 2026)

Seluruh isi repo dibangun selama event (commit pertama 28 Okt 21:39 WIB, commit terakhir 30 Okt). Lihat README bagian "Apa yang dikerjakan selama event" untuk rincian siapa mengerjakan apa (sistem multi-agent coordinator/Kiro/AGY untuk UI, core logic, dan 4 bug-fix pertama; Claude Code untuk 9 perbaikan audit terakhir).

### Disclosure kode & karya pihak ketiga yang dipakai (bukan dibuat sendiri)

- **QVAC SDK** (`@qvac/sdk@0.22.0`) — Apache-2.0, dari Qualcomm/QVAC. Dipakai sebagai native inference engine, tidak dimodifikasi.
- **Model bobot AI**: SmolVLM2-500M-Video-Instruct (ggml-org, HuggingFace) dan VisionPsy-Nano-460M-Flash (qvac, HuggingFace), keduanya Apache-2.0. **Tidak dibundel di repo** — diunduh terpisah oleh pengguna/juri (lihat §4).
- **Expo SDK ~54 / React Native 0.81.5** dan ekosistem npm standar (`expo-*`, `react-native-share`, `@noble/hashes`, `zod`, dll) — lihat `apps/qvac-spike/package.json` untuk daftar lengkap & versi pin.
- Tidak ada kode berbayar/proprietary lain yang disertakan.

## 3. Demo video

**Link:** https://youtu.be/qkHoX4on3G0 · Landing page: https://niragni.vercel.app

> ⚠️ **BELUM ADA — ini kerjaan paling kritis sebelum submit.** Harus menunjukkan produk bekerja + fitur AI inti **dengan internet dimatikan** di perangkat. Lihat README bagian "Status paling jujur saat ini": inference offline belum pernah dibuktikan di HP fisik sampai saat dokumen ini ditulis. Urutan rekam yang disarankan:
> 1. Tampilkan APK terpasang + versi/SHA256-nya di layar.
> 2. Buat draf baru, isi catatan + foto.
> 3. Buka Kelola Model, impor model (sudah ada di Download HP) — tunjukkan status jadi "siap".
> 4. **Matikan Wi-Fi & data seluler (airplane mode) di layar, tunjukkan ikonnya.**
> 5. Jalankan "Buat draf dengan AI" — tunjukkan output draf AI muncul tanpa jaringan.
> 6. (Opsional) Tunjukkan swafoto + pratinjau berbagi.
>
> Link video: **ISI DI SINI SETELAH REKAM**

## 4. Integrasi QVAC

| Field | Value |
|---|---|
| Package | `@qvac/sdk` |
| Versi terpin | `0.22.0` |
| Native fabric | `@qvac/fabric-android-arm64@0.22.0` (Android arm64-v8a only; iOS fabric ada di package.json tapi belum pernah dibuild/ditest) |
| Model default | **SmolVLM2-500M-Video-Instruct** (Q8_0 quantized) — kandidat kedua: **VisionPsy-Nano-460M-Flash** (Q8_0) |

**Model download (manual, di luar repo — WAJIB sebelum demo offline):**
- SmolVLM2: model `SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (436.808.704 byte, SHA-256 `6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc`) + projector `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` (108.785.184 byte, SHA-256 `921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b`), dari `huggingface.co/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF`.
- Setup: unduh kedua file ke perangkat (mis. folder Download), buka Niragni → tab Kelola Model → Impor dari penyimpanan → pilih file model lalu projector. Aplikasi memverifikasi ukuran + SHA-256 + percobaan load lokal sebelum menandai status "siap".

**File tempat QVAC dipakai** (`apps/qvac-spike/`):
- `src/worker.ts` — pemanggilan langsung `@qvac/sdk` (load model, inference streaming, unload). Tidak ada mock/simulasi.
- `src/core/models.ts` — unduh/impor/verifikasi hash/pengelolaan status model (pakai `@qvac/fabric-android-arm64` via worker).
- `src/core/ai.ts` — membangun prompt Bahasa Indonesia untuk QVAC dan memvalidasi output JSON skema ketat.
- `src/manifest.ts` — daftar model kandidat (nama, SHA-256, ukuran, lisensi, konfigurasi native: `ctx_size`, `device`).
- `qvac/worker.entry.mjs` — entry point worker native QVAC.

## 5. Device, OS, memori, lisensi, batas hardware

- **Perangkat uji**: Xiaomi 14T (`2406APNFAG`, codename `degas_global`), Android 16.
- **RAM**: kernel-usable ~11.585.072 kB (~11 GB) terukur saat pengujian 30 Okt; ini **bukan** RAM total terpasang, dan **bukan** peak RAM saat inference (belum terukur).
- **GPU**: Mali-G615 — backend saat ini **CPU-only** (`device: 'cpu'` di konfigurasi default); Vulkan belum pernah diuji fisik.
- **Storage**: model+projector SmolVLM2 ≈ 545 MB gabungan; APK ≈ 86–240 MB tergantung revisi.
- **minSdkVersion** 31 (Android 12+), **targetSdkVersion/compileSdkVersion** 36, arsitektur `arm64-v8a` murni (tidak ada build x86/armeabi-v7a).
- **Lisensi**: SDK QVAC Apache-2.0; kedua model (SmolVLM2, VisionPsy-Nano) Apache-2.0 — aman dipakai & didemokan, tapi bobot model **tidak didistribusikan ulang di repo ini** (harus diunduh sendiri dari HuggingFace).
- **Batas hardware yang diketahui**: belum ada pengujian GPU/Vulkan, belum ada pengukuran latency/thermal/baterai nyata; target desain <10 detik generate belum dibuktikan di perangkat. iOS tidak dibangun (Expo menolak native prebuild iOS di host Windows, tidak ada Mac/Apple Developer account tersedia).

## 6. Fitur yang masih butuh jaringan

- **Mengunduh model AI pertama kali** (jika belum ada di perangkat) — setelah terunduh & terimpor, model dipakai 100% offline.
- **Membuka kanal eksternal** (dialer telepon, WhatsApp, email) untuk benar-benar *mengirim* laporan ke Damkar — aplikasi membuka intent sistem, tapi pengiriman aktualnya tergantung jaringan seluler/internet si pengguna di titik itu. Membuka kanal **bukan** bukti laporan diterima (secara sengaja tidak diklaim oleh UI).
- Semua fitur lain — buat draf, foto, lokasi, **inference AI**, edit, pratinjau, hapus draf, penyimpanan — berjalan **sepenuhnya offline**.

## 7. Konfirmasi tidak ada data sensitif

Tidak ada data pelanggan privat, password, API key, atau wallet secret yang disertakan di repo ini. Kunci signing release Android disimpan di luar repo (`%USERPROFILE%\.niragni\signing`, terenkripsi DPAPI per-user Windows) dan **tidak** pernah di-commit.
