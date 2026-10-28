/**
 * Emergency contact channels and directory for forest/land fire (karhutla).
 * The directory data is the reviewed 25-entry Indonesia set in
 * ./channel-directory (public = officially listed, never proven operational;
 * 112 is regional-unconfirmed). Never contacts agencies automatically.
 */

import * as Linking from 'expo-linking';
import { Channel } from '../product-contract';
import { CHANNEL_DIRECTORY } from './channel-directory';

export const CHANNELS: readonly Channel[] = CHANNEL_DIRECTORY;

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
