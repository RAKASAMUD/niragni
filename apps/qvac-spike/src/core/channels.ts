/**
 * Emergency contact channels and directory for forest/land fire (karhutla).
 *
 * revision-2026-10-29: active channels are curated Damkar local only.
 * Kemenhut/posko-umum/BPBD/112 removed from the active dispatch set per
 * user decision. Raw directory data retained for reference; listChannels()
 * now returns only verified Damkar channels. Coverage gaps are honest.
 */

import * as Linking from 'expo-linking';
import { Channel } from '../product-contract';
import { CHANNEL_DIRECTORY } from './channel-directory';
import { VERIFIED_INCIDENT_CHANNEL_IDS } from './channel-selector';

export const CHANNELS: readonly Channel[] = CHANNEL_DIRECTORY;

/** Returns only the currently active (verified Damkar incident) channels. */
export function listChannels(): Channel[] {
  return CHANNELS.filter((c) => VERIFIED_INCIDENT_CHANNEL_IDS.has(c.id));
}

export * from './channel-selector';

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
