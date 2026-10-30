# Kiro — Redesain UI Niragni (apple-design + break-ui)

Task `task_36e107420d0e` / dispatch `ctx_99d0a26485ee`.

## Ringkasan

Semua layar UI RN asli diredesain memakai prinsip apple-design (restraint,
hierarki, spacing, satu aksi utama per konteks) dengan primitif React Native +
Animated bawaan (tanpa dependency native baru) dan reduced-motion. Teks
keamanan/kejujuran dipertahankan tetapi dihaluskan ke satu footer konsisten.
`tsc --noEmit` exit 0; web export ke `dist-ui-review` (terpisah dari `dist-web`
milik user) exit 0; tersaji loopback di `http://127.0.0.1:8083`.

## Keputusan koordinator yang dipatuhi

- Motion: React Native `Animated` bawaan + `useReducedMotion`. TIDAK menambah
  `react-native-reanimated` atau dependency native lain.
- Export terpisah `dist-ui-review` (port 8083) — server `dist-web` user tidak disentuh.
- Tidak menyentuh: `services.ts`, `services.web.ts`, `PreviewBanner*`,
  `product-contract.ts`, `src/core/**`, `worker.ts`, `manifest.ts`,
  package/config/build, riset AGY, signing helper. Kontrak layanan tetap frozen.
- Tidak commit/push; semua untracked existing dipreserve.

## File yang diubah (dalam ownership)

Fondasi:
- `src/ui/theme.ts` — tambah role `type.section` (tier hierarki yang hilang),
  leading per apple-design §15 (heading/title tracking lebih rapat, body leading
  longgar), hook `useReducedMotion`.
- `src/ui/components.tsx` — `PressableScale` (Animated.createAnimatedComponent
  (Pressable), spring critically-damped, hormati Reduce Motion termasuk saat
  setting berubah di tengah press → scale di-reset ke 1; style callback
  `({pressed})` diteruskan benar; layout flex/alignSelf dipertahankan di elemen
  yang sama, bukan wrapper View); `Section` baru; `DetailRow` (baris setelan
  label+nilai+chevron) untuk menyatukan blok "Row + tombol"; `Notice` dibuat
  tipis (aksen 3px, teks sekunder); `SafetyFooter` reusable.
- `src/ui/format.ts` — tambah `formatDateOnly` (tanggal audit kanal tanpa jam
  00:00 yang menyesatkan).

Layar:
- `app/(tabs)/index.tsx` (Laporan) — baris daftar ramping: tempat + waktu + sinyal
  "pernah dibagikan"; hapus pill "Tersimpan lokal" yang redundan.
- `app/(tabs)/readiness.tsx` — 5 tombol setara → 1 aksi primer kontekstual
  (Unduh/Periksa/Batalkan) + sekunder quiet; konfirmasi unduhan inline
  (bukan OS Alert); metadata ukuran ringkas; status jujur ("Siap offline" hanya
  setelah cek lokal).
- `app/(tabs)/channels.tsx` — hierarki label→destinasi→cakupan; tanggal audit
  tetap terlihat di tombol "Sumber · <tgl>"; dialer tetap merah (akses bantuan).
- `app/report/[id]/edit.tsx` — 4 blok "Row+tombol" → satu grup `DetailRow`;
  disclaimer → `SafetyFooter`; notice disederhanakan.
- `app/report/[id]/location.tsx` — waktu tampil manusiawi + timezone; input ISO
  mentah disembunyikan di balik "Ubah" (expandable); dua grup posisi/ kejadian
  tetap terpisah (tidak auto-fill). Nilai tersimpan tidak diubah ambigu.
- `app/report/[id]/review.tsx` — dikelompokkan jadi Section Ringkasan/Pengamatan/
  Saran AI/Ekspor; provenance pill + uncertainty + terima-per-bagian DIPERTAHANKAN
  (logika idempoten tidak diubah); label diubah ke "Tambahkan ke ringkasan"/
  "Sudah ditambahkan" (hindari kata "diterima" yang ambigu dengan penerimaan
  instansi); satu CTA primer "Pilih kanal" di bawah (header tidak lagi dobel).
- `app/report/[id]/share.tsx` — pratinjau sebagai fokus; aksi utama "Buka pilihan
  berbagi"; kanal ramping; tanggal audit terlihat; 2 disclaimer → satu SafetyFooter
  ("Membuka pilihan berbagi atau dialer bukan bukti laporan diterima").
- `app/report/[id]/photos.tsx` — thumbnail + meta satu baris ringkas; row top-aligned
  (`alignItems:flex-start`) + `minWidth:0` pada kolom teks; hapus jadi quiet.
- `app/report/[id]/generate.tsx` — teks reassurance dipangkas; struktur lifecycle
  (run-token, cancel) TIDAK diubah.
- `app/report/[id]/index.tsx` (Detail) — Section headers; hapus pill redundan;
  waktu/lokasi satu kartu; lampiran grid; aktivitas berbagi ringkas; hapus quiet.

Prototype break-ui (dev-only):
- `app/_ui-review.tsx` — layar pratinjau pengembang (`__DEV__` only; di produksi
  hanya menampilkan notice). Toggle data boundary: Demo / Worst / Kosong / Satu /
  Banyak. Merender primitif asli (ListRow, Card, Section, DetailRow, StatusPill,
  Notice, Field, tombol) dengan data ekstrem — TIDAK menyentuh service.

## Break-ui — temuan (teks Indonesia panjang, kosong, satu, banyak, dll)

Diverifikasi dari aturan layout di kode (lihat "diamati vs inferensi" di bawah).

Part 1 — yang berpotensi pecah & penanganannya:
| Severity | Field | Kasus | Penanganan di kode |
| --- | --- | --- | --- |
| Fragile→OK | nama tempat panjang | `Kabupaten Kepulauan Siau Tagulandang Biaro…` | `Body`/`Text` membungkus (tanpa numberOfLines di judul utama); `DetailRow` nilai `numberOfLines={2}`; kolom kanal `minWidth:0` agar membungkus bukan overflow. |
| Fragile→OK | kata super-panjang tanpa spasi | `Pemberitahuan…lintasprovinsi` | RN `Text` memutus kata default; kolom diberi `flex:1, minWidth:0`. |
| Fragile→OK | destinasi mirip email panjang | `posko…@dinas…go.id` | caption kanal di kolom `flex:1 minWidth:0`, membungkus; tombol aksi di Row terpisah tidak terdorong keluar. |
| OK | satu item / count = 1 | daftar 1 draf | teks netral ("Diperbarui …"), tidak ada "1 draf-draf"/plural rusak. |
| OK | kosong | 0 draf / 0 kanal / 0 model | empty state eksplisit di tiap layar. |
| Perf-note | banyak item (1000) | daftar panjang | layar nyata pakai `FlatList` (virtualized) → aman; prototipe sengaja memotong 40 baris agar prototipe sendiri responsif. |
| OK | foto rusak/placeholder | thumbnail | `backgroundColor` placeholder + `resizeMode=cover`; posisi aksi tidak bergeser mendadak. |

Part 2 — keputusan (silakan tinjau):
- Dialer merah di tab Kanal (akses bantuan) vs sekunder di layar Share: dibedakan
  sengaja — Kanal adalah tujuan utama menelepon bantuan, Share aksi utamanya berbagi.
- `DetailRow` nilai dibatasi 2 baris (truncation ekor) untuk lokasi panjang; isi
  penuh tetap bisa diedit di layar tujuan. Alternatif: wrap penuh (baris bisa tinggi).

Part 3 — yang sudah kokoh: empty/satu state, FlatList virtualization di home/
readiness, touch target 48dp (MIN_TOUCH), status selalu berlabel teks (bukan warna
saja), timezone eksplisit dipertahankan.

## Observable acceptance

- `tsc --noEmit`: **exit 0** (dijalankan berkali-kali selama & setelah edit).
- `expo export --platform web --output-dir dist-ui-review`: **exit 0**, 0 error
  resolusi modul native, 0 referensi `@qvac/sdk`/`react-native-bare-kit` di bundel.
- Tersaji loopback: `http://127.0.0.1:8083` (server `scripts/serve-ui-review.mjs`
  via Orca terminal `term_fe8ec297-e1ed-4106-bebd-5f6cd0c8458e`, node PID 27300,
  bind 127.0.0.1:8083 terverifikasi). Server user `dist-web`/8082 tidak disentuh
  (saat dicek 8082 tidak listening, konsisten dengan catatan koordinator).
- Marker redesain terkonfirmasi di bundel tersaji: SafetyFooter, "Tambahkan ke
  ringkasan", Section "Pengamatan Anda", spring press-scale; tidak ada sisa
  "Terima bagian ini".

## Diamati vs inferensi (jujur)

- DIAMATI: halaman memuat di Orca browser (page 20cf49cd, title "Niragni", tanpa
  loadError/certificateFailure); HTTP 200 index + SPA deep-link; bundel kompilasi
  bersih; marker string redesain ada di bundel.
- INFERENSI (belum diverifikasi piksel): tata letak worst-case di 320px, font 200%,
  dark/light, wrap teks panjang. Surface Orca `tab` tidak mengekspos screenshot/
  DOM, dan `computer` (Computer Use) menyasar jendela app bukan DOM browser. Aturan
  layout (flex, minWidth:0, numberOfLines, FlatList) diverifikasi dari kode, bukan
  dari piksel. Koordinator memegang tooling review visual dan akan melakukan pass
  visual pada `dist-ui-review`.

## Invarian yang dipertahankan

Manual fallback ("Lanjut tanpa AI" selalu ada), provenance + uncertainty di review,
pemisahan posisi pelapor vs lokasi kejadian (tidak auto-fill), status berbagi jujur
("bukan bukti diterima"), status model jujur ("Siap offline" hanya setelah cek lokal),
semantik save/revision `useReportEditor` tidak diubah, lifecycle generate.tsx utuh.

## Limitasi / sisa

- Verifikasi visual piksel (320/200%/dark) belum dilakukan oleh worker ini —
  diserahkan ke pass visual koordinator.
- FlowHeader dibiarkan secara struktur (sudah bersih); tidak ditambah scroll-edge
  effect karena butuh state scroll lintas layar — di luar manfaat/risiko saat ini.
- Integrasi/HP/APK di luar scope (ditangani koordinator setelah UI siap).


---

## Follow-up: bug tombol hilang background/padding di Xiaomi (task_fdd982a0a0cd)

Bug nyata pada build APK65A21611 (screenshot `work/reports/niragni-ui-home.png`):
tombol "Buat laporan" teks gelap nyaris tak terlihat, background + padding hilang.

### Root cause (dibuktikan via source tracing RN lokal)

`PressableScale` meneruskan style dalam bentuk FUNGSI
(`({pressed}) => [consumerStyle, transform]`) ke
`Animated.createAnimatedComponent(Pressable)`. Penelusuran sumber:

1. `Libraries/Animated/nodes/AnimatedProps.js` → `createAnimatedProps`: untuk
   `key === 'style'` hanya memproses bila `typeof value === 'object'`. Nilai
   fungsi di-skip, `flattenStyle` tidak dipanggil, dan `Animated.Value` (scale)
   di dalam hasil fungsi TIDAK didaftarkan sebagai `AnimatedNode`.
2. `Libraries/Animated/createAnimatedComponent.js`: render memanggil
   `composeStyles(style, passthroughStyle)`. Karena tak ada passthrough node,
   `src/private/styles/composeStyles.js` mengembalikan `style` (fungsi) apa
   adanya ke `Pressable`.
3. `Libraries/Animated/nodes/AnimatedStyle.js`: `AnimatedStyle.from` meng-`Object.keys`
   style yang diasumsikan flat object — jalur ini tak pernah tercapai untuk fungsi.

Akibatnya di native driver (Xiaomi) style mengandung `Animated.Value` mentah yang
belum diresolusi → objek style menjadi invalid → RN men-drop properti style tombol
(background, padding), menyisakan teks default gelap. Di web jalurnya berbeda,
sehingga tidak terlihat saat review web.

### Fix (dalam ownership: src/ui/components.tsx)

`PressableScale` kini:
- melacak `pressed` via React state (`useState`) dari `onPressIn`/`onPressOut`;
- mengevaluasi style konsumen sendiri melalui helper murni
  `src/ui/resolvePressableStyle.ts` → menghasilkan nilai KONKRET (objek/array),
  bukan fungsi;
- meneruskan `style={[resolvedStyle, { transform: [{ scale }] }]}` (array objek)
  ke `AnimatedPressable`, sehingga `flattenStyle` benar dan node scale terdaftar.

Dipertahankan: flex/layout (elemen animated tunggal, tanpa wrapper View yang
menelan flex), reduced motion (useEffect + `stopAnimation` + `setValue(1)` dari
root), `disabled`, dan seluruh prop aksesibilitas. Semua konsumen
(Button semua varian, ListRow, DetailRow) melewati `PressableScale` yang sama.

### Regression test (tanpa dependency baru)

`src/__tests__/pressable-style.test.ts` menguji helper murni
`resolvePressableStyle`/`isConcreteStyle` (RN-free, cocok dengan Jest
`testEnvironment: node` yang ada): memastikan style fungsi diubah jadi nilai
konkret, chrome (background/padding/radius/minHeight) tetap ada di kedua state
pressed, hanya opacity yang berubah saat ditekan, dan sebuah fungsi ditandai
tidak aman (bentuk bug sebelum fix).

### Acceptance

- `tsc --noEmit`: exit 0.
- `jest`: 5 suite / 34 test lulus (termasuk 6 test regression baru).
- Tidak mengubah layar/core/manifest/config/build; tidak ada browser/device action;
  tidak commit/push.
- Verifikasi VISUAL runtime (tombol tampil dengan background/padding di perangkat)
  diserahkan ke koordinator setelah build APK berikutnya — worker ini tidak
  menyentuh HP/build.

File diubah di follow-up ini: `src/ui/components.tsx`,
`src/ui/resolvePressableStyle.ts` (baru), `src/__tests__/pressable-style.test.ts`
(baru), `work/reports/kiro-ui-redesign.md`.


### Tambahan: kontras StatusPill (bukti readiness `niragni-ui-readiness-before-fix.png`)

Bukti native kedua: tombol "Unduh" di readiness juga kehilangan background — akar
sama (function style), sudah ikut diperbaiki oleh fix PressableScale di atas
karena semua varian Button lewat `PressableScale`.

StatusPill: label "Belum diunduh" (neutral) putih di atas background abu TERANG
kurang kontras di dark mode. Penyebab: foreground lama hampir selalu `#FFFFFF`,
padahal beberapa warna palette di dark mode sengaja TERANG (neutral `#BEC7D0`,
error `#FFB4AB`, positive `#A3E5C8`). Fix: peta foreground per (kind, tema) di
`StatusPill` saja (tema global tidak diubah). Rasio kontras terukur (WCAG):

| Pill | Light | Dark |
| --- | --- | --- |
| neutral | 7.18:1 | 9.52:1 |
| positive | 8.12:1 | 12.38:1 |
| busy | 5.17:1 | 5.17:1 |
| warn | 5.02:1 | 5.11:1 |
| error | 6.54:1 | 10.87:1 |

Semua ≥4.5:1 (AA teks normal). Dark busy dinaikkan dari `#3B82F6` (3.68:1) ke
`#2563EB` (5.17:1). Tema aplikasi tidak diubah; perubahan terbatas pada komponen
`StatusPill`.
