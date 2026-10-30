/**
 * Small pure formatting helpers for the Bara UI.
 * No service calls, no side effects. Timezone is explicit — never assume WIB.
 */
export { formatTimeWithZone } from '../core/timeValidation';

// Hoisted static formatters per vercel-react-native-skills (rule: js-hoist-intl)
// Creating Intl objects is expensive; instantiate once at module scope.
const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateOnlyFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const indonesianHeaderDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Human-readable byte size (MB/GB), never fabricating precision. */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/** Short relative-ish label for list rows; falls back to the raw date. */
export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return shortDateFormatter.format(d);
  } catch {
    return iso;
  }
}

/**
 * Date-only label (no time). Used for channel audit dates like "2026-10-28".
 */
export function formatDateOnly(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return dateOnlyFormatter.format(d);
  } catch {
    return iso;
  }
}

/** Accuracy label "± N m" only when accuracy is actually known. */
export function formatAccuracy(accuracy: number | null | undefined): string | null {
  if (accuracy === null || accuracy === undefined || Number.isNaN(accuracy)) return null;
  return `± ${Math.round(accuracy)} m`;
}

/** Format header date in Indonesian format (e.g. "Kamis, 29 Oktober") */
export function formatIndonesianHeaderDate(date: Date = new Date()): string {
  try {
    return indonesianHeaderDateFormatter.format(date);
  } catch {
    // Never show a fabricated date (the old fallback froze on "Kamis, 29 Oktober" forever,
    // i.e. a fixed day of the week paired with a fixed day of the month, which drift out of
    // sync with each other within a week and are wrong every single day after that).
    return '';
  }
}

export const LIMITS = {
  maxNotesChars: 4000,
  maxPhotos: 3,
  maxPhotoBytes: 20 * 1024 * 1024,
} as const;
