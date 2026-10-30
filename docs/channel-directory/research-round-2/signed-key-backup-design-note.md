# Signed Key Backup Architecture & Design Note

Tanggal: **29 Oktober 2026**  
Status: **Catatan Desain Konseptual (Informasional / Non-Implementasi)**  
Penyusun: **AGY (Research & Documentation)**  

---

## 1. Tujuan & Latar Belakang

Dokumen ini menjelaskan prinsip-prinsip desain untuk pengelolaan dan pencadangan (*backup*) kunci penandatangan rilis (*release signing key / keystore*) pada proyek Niragni, khususnya untuk paket aplikasi Android (`.keystore` / PKCS#12). 

> [!CAUTION]
> **Batasan Keamanan & Ruang Lingkup:**
> 1. Dokumen ini **hanya berupa panduan konseptual**. Tidak ada kode implementasi backup, script otomatisasi, atau ekstraksi kunci yang dibuat dalam repositori ini.
> 2. **Tidak ada pembacaan atau penyuntingan** terhadap berkas keystore privat, kredensial Windows DPAPI, kata sandi, maupun berkas `.env` privat pengguna.
> 3. Dokumen ini **tidak mengklaim** bahwa cadangan kunci telah dibuat atau sudah tersedia saat ini.
> 4. Lingkungan pengembangan saat ini adalah Windows. **Build iOS tidak dimungkinkan** di lingkungan ini karena membutuhkan infrastruktur macOS, Xcode, dan sertifikat Apple Developer.

---

## 2. Prinsip Pencadangan Kunci Penandatangan

Kunci penandatangan aplikasi (*Android App Signing Keystore*) bersifat kritis: kehilangan kunci berarti pembaruan aplikasi di Google Play Store atau distribusi sideload tepercaya tidak dapat diterbitkan kembali ke pengguna lama.

Untuk memastikan kelangsungan proyek tanpa mengorbankan keamanan, cadangan kunci harus mematuhi dua pilar utama:

### 2.1. Frasa Sandi Portabel Pilihan Pengguna (*User-Chosen Portable Passphrase*)
- **Enkripsi Amplop (*Envelope Encryption*):**
  Berkas keystore mentah tidak boleh disimpan atau dipindahkan dalam bentuk biner tanpa proteksi tambahan. Berkas tersebut harus dienkripsi menggunakan algoritma simetris berstandar industri (misalnya AES-256-GCM).
- **Fungsi Derivasi Kunci yang Kuat (*Key Derivation Function / KDF*):**
  Kunci simetris harus diturunkan dari frasa sandi yang dipilih langsung oleh pengguna secara manual, menggunakan algoritma tahan-GPU seperti **Argon2id** atau **PBKDF2-HMAC-SHA256** dengan parameter *salt* acak dan jumlah iterasi tinggi.
- **Portabilitas Lintas Platform (*Anti-Machine-Binding*):**
  Mekanisme penyimpanan berbasis mesin lokal (seperti Windows DPAPI atau Linux Secret Service) hanya mengamankan kredensial pada satu profil OS tertentu. Jika perangkat mengalami kerusakan total (*motherboard failure*) atau migrasi sistem operasi, kunci DPAPI tidak dapat didekripsi. Oleh karena itu, frasa sandi portabel yang diketahui oleh pengguna merupakan syarat mutlak agar cadangan dapat dipulihkan di mesin mana pun.
- **Larangan Keras *Hardcoding*:**
  Kata sandi, alias, atau frasa sandi tidak boleh dimasukkan ke dalam kode sumber, script build, atau berkas konfigurasi publik.

### 2.2. Destinasi Privat Terpisah (*Separate Private Destination*)
- **Pemisahan dari Repositori Git:**
  Berkas keystore (baik mentah maupun terenkripsi) **tidak boleh diunggah ke repositori Git** (`.gitignore` harus selalu menyaring berkas `*.keystore`, `*.jks`, `*.p12`, `*.key`).
- **Destinasi Penyimpanan Terisolasi:**
  Arsip terenkripsi harus disimpan pada lokasi terpisah yang aman dan privat, contohnya:
  - Media fisik *offline* / *air-gapped* (USB drive terenkripsi yang disimpan terpisah).
  - *Password manager* / *vault* perusahaan yang dilindungi otentikasi dua faktor (2FA).
  - Layanan *Secrets Management* cloud privat (seperti Google Secret Manager atau AWS Secrets Manager) dengan kontrol akses berbasis IAM ketat.

---

## 3. Matriks Pertimbangan Keamanan

| Parameter | Praktik yang Tidak Aman / Dilarang | Praktik yang Dianjurkan (Desain Ini) |
|:---|:---|:---|
| **Lokasi Penyimpanan** | Berada di repositori Git atau folder publik | Terpisah di media privat *offline* atau vault terenkripsi |
| **Ketergantungan OS** | Terikat kunci DPAPI Windows lokal saja | Terenkripsi dengan KDF dari frasa sandi portabel pengguna |
| **Penyimpanan Password**| Tertulis di kode JavaScript/TypeScript/Gradle | Diinput langsung secara interaktif saat proses rilis |
| **Distribusi Tim** | Dikirim melalui aplikasi chat/email | Akses berbasis izin terbatas dan terdokumentasi |

---

## 4. Kesimpulan

Pencadangan kunci rilis harus dirancang secara hati-hati dengan menempatkan kontrol sepenuhnya di tangan pemilik proyek melalui frasa sandi portabel dan destinasi penyimpanan privat yang terpisah. Tim pengembang dilarang membuat otomatisasi backup tanpa persetujuan arsitektur keamanan dan keterlibatan langsung pemilik kredensial.
