/**
 * Niragni bundled emergency-channel directory (Indonesia local Damkar incident channels only).
 *
 * Source of truth: docs/channel-directory/indonesia-emergency-channels.json
 * (Curated to exactly 9 verified municipal Damkar incident channels;
 * Kemenhut national entries, 112, BPBD, and administrative office contacts
 * are excluded from the active directory per coordinator and user directive).
 * Transcribed here as typed static data INSIDE the Expo/Metro app root
 * so the app bundles it without importing files from outside the project root.
 *
 * Semantics (do not weaken):
 * - "public" = officially listed by the municipal government's own primary portal
 *   with explicit mandate for local fire/karhutla incident dispatch.
 * - Opening the dialer/share is always an explicit user action; the app never
 *   auto-calls, auto-sends, or claims delivery/receipt.
 * - Raw constant is Damkar-only (not just a filtered view).
 *
 * Geographic coverage:
 * - Verified local Damkar hotlines exist for: Kota Pekanbaru (Riau), Kota Palangka Raya
 *   (Kalimantan Tengah), Kota Pontianak (Kalimantan Barat), Kota Semarang (Jawa Tengah),
 *   Kota Yogyakarta (D.I. Yogyakarta), and Kota Serang (Banten).
 * - Remaining 32 provinces and unverified regions are genuine geographic gaps (RESEARCHGAP).
 * - No substitution with national numbers or generic office contacts.
 */
import { Channel } from '../product-contract';

export const CHANNEL_DIRECTORY: readonly Channel[] = [
  {
    id: 'damkar-pekanbaru-wa',
    label: 'DPKP Kota Pekanbaru (WhatsApp Pengaduan Damkar 24 Jam Nonstop)',
    destination: '+62 851-8607-0113',
    kind: 'whatsapp',
    scope: 'Kota Pekanbaru, Riau',
    sourceUrl: 'https://www.pekanbaru.go.id/p/news/respon-cepat-damkar-pekanbaru-kini-layanan-pengaduan-bisa-lewat-whatsapp-24-jam-nonstop',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-pekanbaru-tel',
    label: 'DPKP Kota Pekanbaru (Telepon Markas Damkar)',
    destination: '0761-22382',
    kind: 'phone',
    scope: 'Kota Pekanbaru, Riau',
    sourceUrl: 'https://www.pekanbaru.go.id/p/news/respon-cepat-damkar-pekanbaru-kini-layanan-pengaduan-bisa-lewat-whatsapp-24-jam-nonstop',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-palangkaraya-tel',
    label: 'DPKP Kota Palangka Raya (Telepon Penanganan Kebakaran)',
    destination: '0536-3230113',
    kind: 'phone',
    scope: 'Kota Palangka Raya, Kalimantan Tengah',
    sourceUrl: 'https://mediacenter.palangkaraya.go.id/warga-palangka-raya-diimbau-waspadai-potensi-kebakaran/',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-pontianak-pancabakti-tel',
    label: 'Pemadam Kebakaran Panca Bakti Kota Pontianak (Telepon)',
    destination: '0561-740916',
    kind: 'phone',
    scope: 'Kota Pontianak, Kalimantan Barat',
    sourceUrl: 'https://www.pontianak.go.id/layanan-publik/daftar-telepon',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-semarang-tel',
    label: 'Dinas Pemadam Kebakaran Kota Semarang (Telepon Posko)',
    destination: '024-7605871',
    kind: 'phone',
    scope: 'Kota Semarang, Jawa Tengah',
    sourceUrl: 'https://ppid.semarangkota.go.id/kb/pemadaman-kebakaran-kota-semarang-2/',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-semarang-email',
    label: 'Dinas Pemadam Kebakaran Kota Semarang (Email)',
    destination: 'kebakaran.semarangkota@gmail.com',
    kind: 'email',
    scope: 'Kota Semarang, Jawa Tengah',
    sourceUrl: 'https://ppid.semarangkota.go.id/kb/pemadaman-kebakaran-kota-semarang-2/',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkarmat-jogjakota-wa',
    label: 'Dinas Pemadam Kebakaran dan Penyelamatan Kota Yogyakarta (WhatsApp Call Center)',
    destination: '+62 811-2828-113',
    kind: 'whatsapp',
    scope: 'Kota Yogyakarta, D.I. Yogyakarta',
    sourceUrl: 'https://jogjakota.go.id/page/helpdesk',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkarmat-jogjakota-tel',
    label: 'Dinas Pemadam Kebakaran dan Penyelamatan Kota Yogyakarta (Telepon)',
    destination: '0274-587101',
    kind: 'phone',
    scope: 'Kota Yogyakarta, D.I. Yogyakarta',
    sourceUrl: 'https://jogjakota.go.id/page/helpdesk',
    checkedAt: '2026-10-29',
    availability: 'public'
  },
  {
    id: 'damkar-kotaserang-tel',
    label: 'Pemadam Kebakaran Kota Serang (Telepon)',
    destination: '0254-283113',
    kind: 'phone',
    scope: 'Kota Serang, Banten',
    sourceUrl: 'https://birokesra.bantenprov.go.id/berita/daftar-nomor-telepon-darurat-damkar-dan-bpbd-di-banten-siaga-24-jam-tangani-kondisi-kebencanaan',
    checkedAt: '2026-10-29',
    availability: 'public'
  }
];
