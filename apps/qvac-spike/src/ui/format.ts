/**
 * Small pure formatting helpers for the Bara UI.
 * No service calls, no side effects. Timezone is explicit — never assume WIB.
 */

/** Human-readable byte size (MB/GB), never fabricating precision. */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Format an ISO timestamp with its explicit timezone label appended.
 * We show the stored instant and the timezone string so the user can tell
 * it is not silently assumed to be WIB.
 */
export function formatTimeWithZone(iso: string | undefined, timezone: string | undefined): string {
  if (!iso) return 'Belum diketahui';
  let base = iso;
  try {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      base = d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
  } catch {
    base = iso;
  }
  return timezone ? `${base} (${timezone})` : base;
}

/** Short relative-ish label for list rows; falls back to the raw date. */
export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Accuracy label "± N m" only when accuracy is actually known. */
export function formatAccuracy(accuracy: number | null | undefined): string | null {
  if (accuracy === null || accuracy === undefined || Number.isNaN(accuracy)) return null;
  return `± ${Math.round(accuracy)} m`;
}

export const LIMITS = {
  maxNotesChars: 4000,
  maxPhotos: 3,
  maxPhotoBytes: 20 * 1024 * 1024,
} as const;
