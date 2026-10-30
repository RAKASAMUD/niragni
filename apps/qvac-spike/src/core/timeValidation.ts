/**
 * Observation-time and timezone validation helpers.
 *
 * These are pure functions with no side effects so they can be unit-tested
 * in Node without any native module dependency.
 *
 * Validated at repository.saveReport() boundary (Bug 3 fix).
 * Also reused by formatTimeWithZone (Bug 4 fix) for honest display.
 */

/**
 * Returns true when `iso` is a valid ISO 8601 string that represents an unambiguous
 * observation timestamp with explicit timezone offset or Z, and valid calendar date
 * (rejects impossible calendar dates without silent normalization).
 */
export function isValidIsoTimestamp(iso: string): boolean {
  if (!iso || typeof iso !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(iso.trim());
  if (!match) return false;

  const [, yStr, mStr, dStr, hStr, minStr, sStr, tzStr] = match;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);
  const hour = parseInt(hStr, 10);
  const min = parseInt(minStr, 10);
  const sec = parseInt(sStr, 10);

  if (month < 1 || month > 12) return false;
  if (hour > 23 || min > 59 || sec > 59) return false;

  // Check calendar leap year and days per month
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month]) return false;

  if (tzStr !== 'Z') {
    const tzMatch = /^([+-])(\d{2}):(\d{2})$/.exec(tzStr);
    if (!tzMatch) return false;
    const tzH = parseInt(tzMatch[2], 10);
    const tzM = parseInt(tzMatch[3], 10);
    if (tzH > 23 || tzM > 59) return false;
  }

  return true;
}

/**
 * IANA timezone identifiers for the three Indonesian timezone zones.
 * The explicit set avoids accidental acceptance of Etc/GMT offsets or
 * raw UTC offsets such as "+07:00", which are not IANA zone names and
 * would produce device-timezone-dependent output on many Intl
 * implementations.
 */
export const INDONESIA_TIMEZONES = new Set([
  'Asia/Jakarta',   // WIB — Western Indonesian Time (UTC+7)
  'Asia/Pontianak', // WIB alias (Kalimantan Barat)
  'Asia/Makassar',  // WITA — Central Indonesian Time (UTC+8)
  'Asia/Ujung_Pandang', // Legacy alias for Asia/Makassar
  'Asia/Jayapura',  // WIT — Eastern Indonesian Time (UTC+9)
]);

/**
 * Returns true when `tz` is a valid IANA timezone identifier (or UTC) recognized by
 * the current Intl implementation.
 *
 * Raw UTC offsets like "+07:00", "UTC+7", "GMT+8", empty strings, and
 * invalid timezone names are rejected.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.trim() === '') return false;

  const trimmed = tz.trim();

  // Reject raw UTC offset strings (e.g. "+07:00", "-05:00", "UTC+7", "GMT+8")
  if (/^(?:UTC|GMT)?[+-]\d{1,2}(?::\d{2})?$/i.test(trimmed)) {
    return false;
  }

  // Probe using Intl.DateTimeFormat
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates both `observationTime` and `timezone` fields.
 *
 * Returns null if both are valid, or a user-readable Indonesian error message
 * explaining what is wrong and what format is expected.
 *
 * Old legacy reports that already contain malformed values are NOT affected
 * by this validator at read/open time — only at saveReport().
 */
export function validateObservationFields(
  observationTime: string,
  timezone: string
): string | null {
  if (!isValidIsoTimestamp(observationTime)) {
    return (
      `Waktu pengamatan tidak valid: "${observationTime}". ` +
      'Masukkan waktu dalam format ISO 8601, misalnya "2026-10-29T17:23:00+07:00" ' +
      'atau "2026-10-29T10:23:00Z". Draf Anda tetap tersimpan; silakan perbaiki dan simpan ulang.'
    );
  }

  if (!isValidIanaTimezone(timezone)) {
    return (
      `Zona waktu tidak valid: "${timezone}". ` +
      'Gunakan nama zona IANA yang dikenal, misalnya "Asia/Jakarta" (WIB), ' +
      '"Asia/Makassar" (WITA), atau "Asia/Jayapura" (WIT). ' +
      'Draf Anda tetap tersimpan; silakan perbaiki dan simpan ulang.'
    );
  }

  return null; // Both valid.
}

// Cache for timezone-specific DateTimeFormatters (e.g. Asia/Jakarta, Asia/Makassar, Asia/Jayapura, UTC).
// Lives here (not in ui/format.ts) so core modules (ai.ts, export.ts) that need
// an honest, zone-aware rendering of a stored instant can use it too, instead of
// interpolating the raw UTC ISO string next to a timezone label.
const timeWithZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeWithZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timeWithZoneFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    timeWithZoneFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Format an ISO timestamp as a human-readable instant in the given IANA
 * timezone, then append the timezone label so the reader sees exactly which
 * zone was applied. Never passes the raw UTC ISO string through unformatted
 * when a usable timezone is available.
 */
export function formatTimeWithZone(iso: string | undefined, timezone: string | undefined): string {
  if (!iso) return 'Belum diketahui';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const tzLabel = timezone ? ` (${timezone})` : '';
    return `${iso}${tzLabel}`;
  }

  const tz = timezone && isValidIanaTimezone(timezone) ? timezone : null;

  if (!tz) {
    try {
      const utcFormatter = getTimeWithZoneFormatter('UTC');
      const utcStr = utcFormatter.format(d);
      const label = timezone ? ` (${timezone} — zona tidak dikenal, ditampilkan UTC)` : ' (UTC)';
      return `${utcStr}${label}`;
    } catch {
      return `${iso} (UTC)`;
    }
  }

  try {
    const formatter = getTimeWithZoneFormatter(tz);
    const formatted = formatter.format(d);
    return `${formatted} (${tz})`;
  } catch {
    return `${iso} (${tz})`;
  }
}
