/**
 * Pure channel directory selector and incident-region filtering module for Niragni (Bara).
 *
 * Enforces:
 * - Pure manual incident-region selection adhering strictly to the Channel contract.
 * - Exact canonical jurisdiction matching (city/kabupaten vs province).
 * - Eliminates false-positive substring matches (e.g., 'Kepulauan Riau' never matches 'Riau';
 *   'Papua Barat Daya' never matches 'Papua').
 * - Preserves jurisdictional reality: Damkar operates at the city/kabupaten level in Indonesia.
 *   Querying a province name (e.g., 'Jawa Tengah' or 'Riau') does NOT claim hasLocalMatch for
 *   a single municipal hotline (e.g., 'Kota Semarang' or 'Kota Pekanbaru').
 * - Pre-filters input channels by isIncidentChannel: only curated, public incident channels
 *   are considered across all branches (national fallback, local matching, or null queries).
 * - Exact eligibility requirement: hasLocalMatch is true ONLY when localMatches.length > 0;
 *   if an eligible city has zero rows in the input list, it safely falls back to national.
 * - ZERO inference or dependency on observer GPS coordinates.
 * - Safe national fallback: Always provides National Posko Karhutla channels as reference.
 */

import { Channel } from '../product-contract';
import { CHANNEL_DIRECTORY } from './channel-directory';

export interface ChannelSelectionResult {
  /** Filtered and prioritized channel list (local incident matches first, followed by national fallback). */
  readonly channels: Channel[];
  /** The manual region query evaluated. */
  readonly targetRegion: string | null;
  /**
   * Whether at least one verified local channel matched the selected city/kabupaten jurisdiction.
   * Strictly FALSE when only a province is selected, when no local city match exists,
   * or when the provided channel list has zero eligible rows for the matched city.
   */
  readonly hasLocalMatch: boolean;
  /** Whether the result represents national fallback. */
  readonly isNationalFallback: boolean;
  /** Informative notice explaining coverage status and jurisdictional scope. */
  readonly coverageNotice?: string;
}

/**
 * Standard 38 provinces in Indonesia (canonical naming).
 */
export const KNOWN_INDONESIAN_PROVINCES: readonly string[] = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Banten',
  'Jawa Tengah',
  'D.I. Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan',
  'Papua Barat Daya'
];

/** Backward-compatible export alias */
export const KNOWN_INDONESIAN_REGIONS = KNOWN_INDONESIAN_PROVINCES;

export interface ChannelJurisdiction {
  readonly level: 'national' | 'city';
  readonly city?: string;
  readonly province?: string;
  readonly cityAliases?: readonly string[];
}

/**
 * Canonical jurisdiction metadata for active directory channels.
 * revision-2026-10-29: Kemenhut national entries removed from active set.
 */
export const CHANNEL_JURISDICTIONS: Record<string, ChannelJurisdiction> = {
  'damkar-pekanbaru-wa': {
    level: 'city',
    city: 'Kota Pekanbaru',
    province: 'Riau',
    cityAliases: ['pekanbaru', 'kota pekanbaru']
  },
  'damkar-pekanbaru-tel': {
    level: 'city',
    city: 'Kota Pekanbaru',
    province: 'Riau',
    cityAliases: ['pekanbaru', 'kota pekanbaru']
  },
  'damkar-palangkaraya-tel': {
    level: 'city',
    city: 'Kota Palangka Raya',
    province: 'Kalimantan Tengah',
    cityAliases: ['palangka raya', 'palangkaraya', 'kota palangka raya']
  },
  'damkar-pontianak-pancabakti-tel': {
    level: 'city',
    city: 'Kota Pontianak',
    province: 'Kalimantan Barat',
    cityAliases: ['pontianak', 'kota pontianak']
  },
  'damkar-semarang-tel': {
    level: 'city',
    city: 'Kota Semarang',
    province: 'Jawa Tengah',
    cityAliases: ['semarang', 'kota semarang']
  },
  'damkar-semarang-email': {
    level: 'city',
    city: 'Kota Semarang',
    province: 'Jawa Tengah',
    cityAliases: ['semarang', 'kota semarang']
  },
  'damkarmat-jogjakota-wa': {
    level: 'city',
    city: 'Kota Yogyakarta',
    province: 'D.I. Yogyakarta',
    cityAliases: ['yogyakarta', 'jogja', 'jogjakarta', 'kota yogyakarta']
  },
  'damkarmat-jogjakota-tel': {
    level: 'city',
    city: 'Kota Yogyakarta',
    province: 'D.I. Yogyakarta',
    cityAliases: ['yogyakarta', 'jogja', 'jogjakarta', 'kota yogyakarta']
  },
  'damkar-kotaserang-tel': {
    level: 'city',
    city: 'Kota Serang',
    province: 'Banten',
    cityAliases: ['serang', 'kota serang']
  }
};

/**
 * Curated set of proven incident hotline IDs.
 * revision-2026-10-29: active channels are Damkar local only.
 * Kemenhut/posko-umum/BPBD/112 are removed from the active dispatch set per
 * user decision. CHANNEL_DIRECTORY itself is already curated to exactly these
 * Damkar entries, so this set is derived from it rather than hand-duplicated —
 * a channel added to the directory without updating a separately hand-written
 * ID list would otherwise silently stay invisible forever.
 * Coverage gaps for unverified regions must be reported honestly — no
 * substitution with generic/national numbers.
 */
export const VERIFIED_INCIDENT_CHANNEL_IDS: ReadonlySet<string> = new Set(
  CHANNEL_DIRECTORY.map((c) => c.id)
);

/**
 * Returns whether a channel represents a national-scope channel.
 */
export function isNationalChannel(channel: Channel): boolean {
  return channel.scope.trim().toLowerCase() === 'nasional';
}

/**
 * Verifies whether a channel is a curated, verified incident dispatch hotline.
 * Rejects administrative office contacts and unconfirmed availability channels.
 */
export function isIncidentChannel(channel: Channel): boolean {
  return (
    VERIFIED_INCIDENT_CHANNEL_IDS.has(channel.id) &&
    channel.availability === 'public'
  );
}

/**
 * Normalizes string for exact, whitespace-collapsed comparison.
 */
function normalizeExact(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the set of unique local verified cities currently present in the directory.
 * Considers only channels that satisfy isIncidentChannel.
 */
export function getAvailableRegions(channels: readonly Channel[]): string[] {
  const citySet = new Set<string>();

  for (const c of channels) {
    if (!isIncidentChannel(c)) continue;
    const meta = CHANNEL_JURISDICTIONS[c.id];
    if (meta && meta.level === 'city' && meta.city) {
      citySet.add(meta.city);
    }
  }

  return Array.from(citySet).sort();
}

/**
 * Resolves a query against canonical provinces using exact matching.
 * Returns the exact canonical province name if matched, or null.
 */
function resolveCanonicalProvince(normQuery: string): string | null {
  for (const prov of KNOWN_INDONESIAN_PROVINCES) {
    if (normalizeExact(prov) === normQuery) {
      return prov;
    }
  }
  return null;
}

/**
 * Resolves a query against canonical verified cities using exact matching or alias match.
 * Returns the canonical city name if matched, or null.
 */
function resolveCanonicalCity(normQuery: string): string | null {
  for (const meta of Object.values(CHANNEL_JURISDICTIONS)) {
    if (meta.level === 'city' && meta.city && meta.cityAliases) {
      for (const alias of meta.cityAliases) {
        if (normalizeExact(alias) === normQuery) {
          return meta.city;
        }
      }
    }
  }
  return null;
}

/**
 * Pure manual incident-region filtering.
 *
 * CRITICAL CONSTRAINTS:
 * 1. Strictly receives manual string input (city or province name).
 * 2. ZERO inference or dependency on observer GPS coordinates.
 * 3. Exact canonical jurisdiction matching:
 *    - 'Kepulauan Riau' never matches 'Riau'.
 *    - 'Papua Barat Daya' never matches 'Papua'.
 *    - A province query (e.g. 'Jawa Tengah' or 'Riau') does NOT claim hasLocalMatch for
 *      a municipal city hotline (e.g. 'Kota Semarang' or 'Kota Pekanbaru').
 * 4. Pre-filters input channels by isIncidentChannel: only curated, public incident channels
 *    are considered in any branch.
 * 5. hasLocalMatch is true ONLY when localMatches.length > 0; if an eligible city has zero
 *    eligible rows in the input list, it falls back to national fallback with hasLocalMatch: false.
 */
export function filterChannelsByRegion(
  channels: readonly Channel[],
  manualRegion: string | null | undefined
): ChannelSelectionResult {
  // 1. Filter input to eligible public curated incident channels first
  const eligibleChannels = channels.filter((c) => isIncidentChannel(c));
  // revision-2026-10-29: active channels are Damkar local only (no Kemenhut national).
  // All eligible channels are local; national fallback is intentionally absent.
  const localEligibleChannels = eligibleChannels.filter((c) => !isNationalChannel(c));
  const rawTarget = (manualRegion || '').trim();

  // If no region is manually selected, return all active local Damkar channels.
  // No national fallback is injected — coverage gaps must be reported honestly.
  if (!rawTarget || rawTarget.toLowerCase() === 'nasional' || rawTarget.toLowerCase() === 'semua') {
    return {
      channels: [...localEligibleChannels],
      targetRegion: rawTarget || null,
      hasLocalMatch: false,
      isNationalFallback: false,
      coverageNotice: 'Menampilkan semua saluran Damkar yang terverifikasi. Pilih kota/kabupaten setempat untuk menyaring nomor Damkar lokal. Wilayah yang belum memiliki data ditampilkan sebagai gap cakupan.'
    };
  }

  const normQuery = normalizeExact(rawTarget);

  // 2. Check exact City match
  const matchedCity = resolveCanonicalCity(normQuery);
  if (matchedCity) {
    const cityMatches = localEligibleChannels.filter((c) => {
      const meta = CHANNEL_JURISDICTIONS[c.id];
      return meta?.level === 'city' && meta.city === matchedCity;
    });

    if (cityMatches.length > 0) {
      return {
        channels: [...cityMatches],
        targetRegion: rawTarget,
        hasLocalMatch: true,
        isNationalFallback: false,
        coverageNotice: `Ditemukan ${cityMatches.length} saluran resmi Damkar untuk '${matchedCity}'.`
      };
    }

    // City recognized, but zero eligible rows exist — gap, no substitution.
    return {
      channels: [],
      targetRegion: rawTarget,
      hasLocalMatch: false,
      isNationalFallback: false,
      coverageNotice: `Gap cakupan: tidak ada saluran Damkar terverifikasi untuk '${matchedCity}' dalam direktori saat ini. Data wilayah ini belum tersedia.`
    };
  }

  // 3. Check Province match
  const matchedProvince = resolveCanonicalProvince(normQuery);
  if (matchedProvince) {
    // Province was selected. Damkar authority is municipal (Kabupaten/Kota), NOT provincial.
    return {
      channels: [],
      targetRegion: rawTarget,
      hasLocalMatch: false,
      isNationalFallback: false,
      coverageNotice: `Kewenangan Damkar berada di tingkat kota/kabupaten. Pemilihan provinsi '${matchedProvince}' tidak memiliki posko Damkar tingkat provinsi (gap cakupan geografis). Pilih kota/kabupaten spesifik.`
    };
  }

  // 4. Unrecognized or unverified region — gap, no substitution.
  return {
    channels: [],
    targetRegion: rawTarget,
    hasLocalMatch: false,
    isNationalFallback: false,
    coverageNotice: `Gap cakupan: cakupan Damkar setempat belum terverifikasi untuk wilayah '${rawTarget}'. Data wilayah ini belum tersedia dalam direktori saat ini.`
  };
}

/**
 * Evaluates incident location text candidates requiring manual confirmation.
 * Strictly uses exact token boundary matching, never observer GPS.
 */
export function filterChannelsByIncidentLocationText(
  channels: readonly Channel[],
  incidentLocationText: string | null | undefined
): ChannelSelectionResult {
  const text = (incidentLocationText || '').trim();
  if (!text) {
    return filterChannelsByRegion(channels, null);
  }

  const normText = normalizeExact(text);
  const words = normText.split(/\s+/);

  // Check verified cities with exact token boundary match
  for (const meta of Object.values(CHANNEL_JURISDICTIONS)) {
    if (meta.level === 'city' && meta.city && meta.cityAliases) {
      for (const alias of meta.cityAliases) {
        const normAlias = normalizeExact(alias);
        const aliasWords = normAlias.split(/\s+/);

        // Check if aliasWords appear consecutively as exact whole words
        if (aliasWords.length === 1 && words.includes(aliasWords[0])) {
          const res = filterChannelsByRegion(channels, meta.city);
          return {
            ...res,
            coverageNotice: `Kandidat kota terdeteksi dari teks insiden: '${meta.city}' (wajib konfirmasi manual).`
          };
        } else if (aliasWords.length > 1 && normText.includes(normAlias)) {
          const res = filterChannelsByRegion(channels, meta.city);
          return {
            ...res,
            coverageNotice: `Kandidat kota terdeteksi dari teks insiden: '${meta.city}' (wajib konfirmasi manual).`
          };
        }
      }
    }
  }

  // Check known provinces (longest match first to prevent Papua matching Papua Barat Daya)
  const sortedProvinces = [...KNOWN_INDONESIAN_PROVINCES].sort((a, b) => b.length - a.length);
  for (const prov of sortedProvinces) {
    const normProv = normalizeExact(prov);
    if (normText.includes(normProv)) {
      return filterChannelsByRegion(channels, prov);
    }
  }

  return filterChannelsByRegion(channels, text);
}

/**
 * Searches channels by freeform query across label, destination, and scope.
 */
export function searchChannels(channels: readonly Channel[], query: string): Channel[] {
  const normQuery = normalizeExact(query);
  if (!normQuery) {
    return [...channels];
  }

  return channels.filter((c) => {
    const labelNorm = normalizeExact(c.label);
    const destNorm = normalizeExact(c.destination);
    const scopeNorm = normalizeExact(c.scope);
    return labelNorm.includes(normQuery) || destNorm.includes(normQuery) || scopeNorm.includes(normQuery);
  });
}
