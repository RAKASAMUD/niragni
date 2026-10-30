/**
 * Location services wrapper for obtaining observer coordinates with accuracy and timestamp.
 */

import * as Location from 'expo-location';
import { Position } from '../product-contract';

export async function getObserverLocation(): Promise<Position> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Izin lokasi ditolak oleh pengguna.');
  }

  let loc: Location.LocationObject | null = null;
  try {
    loc = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced
    });
  } catch {
    // Fall back to last known position if current fix times out or fails
    loc = await Location.getLastKnownPositionAsync();
  }

  if (!loc) {
    throw new Error('Tidak dapat memperoleh koordinat lokasi saat ini.');
  }

  const timestampIso = new Date(loc.timestamp).toISOString();

  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    timestamp: timestampIso
  };
}
