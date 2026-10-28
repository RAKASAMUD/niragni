/**
 * Emergency contact channels and directory baseline for forest/land fire (karhutla).
 * Based on verified public sources (Kemenhut 7 Sep 2026, checked 28 Oct 2026).
 * Never contacts agencies automatically.
 */

import * as Linking from 'expo-linking';
import { Channel } from '../product-contract';

export const CHANNELS: Channel[] = [
  {
    id: 'kemenhut-posko-tel',
    label: 'Posko Karhutla Kemenhut (Telepon)',
    destination: '021-5704618',
    kind: 'phone',
    scope: 'Nasional',
    sourceUrl: 'https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini',
    checkedAt: '2026-10-28',
    availability: 'public'
  },
  {
    id: 'kemenhut-posko-wa',
    label: 'Posko Karhutla Kemenhut (WhatsApp)',
    destination: '+62 8131-00-35000',
    kind: 'whatsapp',
    scope: 'Nasional',
    sourceUrl: 'https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini',
    checkedAt: '2026-10-28',
    availability: 'public'
  },
  {
    id: 'kemenhut-posko-email',
    label: 'Posko Karhutla Kemenhut (Email)',
    destination: 'posko.karhutla@kehutanan.go.id',
    kind: 'email',
    scope: 'Nasional',
    sourceUrl: 'https://www.kehutanan.go.id/pers/cek-informasi-terbaru-karhutla-kemenhut-di-sini',
    checkedAt: '2026-10-28',
    availability: 'public'
  },
  {
    id: 'darurat-112',
    label: 'Panggilan Darurat 112 (Regional)',
    destination: '112',
    kind: 'phone',
    scope: 'Regional (tergantung wilayah)',
    sourceUrl: 'https://layanan112.komdigi.go.id/',
    checkedAt: '2026-10-28',
    availability: 'unconfirmed'
  }
];

export function listChannels(): Channel[] {
  return [...CHANNELS];
}

/**
 * Opens external OS dialer or handler for the given channel.
 * Never performs automated calling or direct data transmission.
 */
export async function openDialer(channelId: string): Promise<void> {
  const channel = CHANNELS.find((c) => c.id === channelId);
  if (!channel) {
    throw new Error(`Kanal dengan ID '${channelId}' tidak ditemukan.`);
  }

  let url: string;
  if (channel.kind === 'phone') {
    const cleanNumber = channel.destination.replace(/[^0-9+]/g, '');
    url = `tel:${cleanNumber}`;
  } else if (channel.kind === 'whatsapp') {
    const cleanNumber = channel.destination.replace(/[^0-9]/g, '');
    url = `https://wa.me/${cleanNumber}`;
  } else if (channel.kind === 'email') {
    url = `mailto:${channel.destination}`;
  } else {
    throw new Error(`Jenis kanal tidak didukung: ${channel.kind}`);
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error(`Tidak dapat membuka aplikasi penangan untuk tautan: ${url}`);
  }

  await Linking.openURL(url);
}
