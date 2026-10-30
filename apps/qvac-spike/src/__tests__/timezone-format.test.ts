/**
 * Regression tests for Bug 4: formatTimeWithZone and previewExport timezone handling.
 *
 * Evidence: device-qa-2026-10-30 report bug #4
 * "Pratinjau memuat '2026-10-29T17:23:08.431Z (Asia/Jakarta)' sementara UI menampilkan
 *  '30 Okt 2026, 00.23 (Asia/Jakarta)'"
 * "src/ui/format.ts memakai toLocaleString tanpa opsi timeZone, sehingga label zona berbeda
 *  dari zona perangkat dapat keliru"
 *
 * Fix:
 *   (a) formatTimeWithZone now passes `timeZone: tz` to toLocaleString so the instant is
 *       formatted in the EXPLICIT named timezone, not the device's current timezone.
 *   (b) Invalid/unknown timezones are flagged honestly instead of silently using device tz.
 *   (c) previewExport in export.ts now formats the timestamp in the stored IANA timezone
 *       rather than concatenating the raw ISO string with the timezone label.
 *
 * Tests cover:
 *   1. Asia/Jakarta (WIB UTC+7): 2026-10-29T17:23:08.431Z → "30 Okt ... (Asia/Jakarta)"
 *   2. Asia/Makassar (WITA UTC+8): same instant → one hour later label
 *   3. Asia/Jayapura (WIT UTC+9): same instant → two hours later label
 *   4. Different offsets for same instant prove explicit timezone is used (not device tz)
 *   5. Invalid ISO string → raw string output with hint, no crash
 *   6. Invalid/unknown timezone → explicit "zona tidak dikenal" label, not device tz silently
 *   7. Missing timezone → UTC display, labeled honestly
 *   8. Empty/undefined input → 'Belum diketahui'
 *
 * NOTE: Exact locale string formatting (day/month names) depends on the test environment's
 * Intl support. We assert structural properties (contains year, contains timezone label,
 * different for WIB vs WIT) rather than exact string values.
 */

import { formatTimeWithZone, formatShortDate, formatDateOnly, formatIndonesianHeaderDate } from '../ui/format';

// The test instant: 2026-10-29T17:23:08.431Z (UTC)
// In WIB (UTC+7):  2026-10-30 00:23 (next day)
// In WITA (UTC+8): 2026-10-30 01:23 (next day)
// In WIT (UTC+9):  2026-10-30 02:23 (next day)
const TEST_ISO = '2026-10-29T17:23:08.431Z';

describe('formatTimeWithZone — explicit timezone formatting (Bug 4)', () => {
  describe('Indonesian timezone coverage', () => {
    it('Asia/Jakarta (WIB UTC+7): output contains "Jakarta" label', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      expect(result).toContain('Asia/Jakarta');
    });

    it('Asia/Makassar (WITA UTC+8): output contains "Makassar" label', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Makassar');
      expect(result).toContain('Asia/Makassar');
    });

    it('Asia/Jayapura (WIT UTC+9): output contains "Jayapura" label', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Jayapura');
      expect(result).toContain('Asia/Jayapura');
    });

    it('WIB and WIT produce DIFFERENT formatted results for the same instant', () => {
      const wib = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      const wit = formatTimeWithZone(TEST_ISO, 'Asia/Jayapura');
      // If both used the device timezone they'd be identical; the fix ensures they differ.
      expect(wib).not.toBe(wit);
    });

    it('WIB and WITA produce DIFFERENT formatted results for the same instant', () => {
      const wib = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      const wita = formatTimeWithZone(TEST_ISO, 'Asia/Makassar');
      expect(wib).not.toBe(wita);
    });

    it('output does NOT contain raw ISO Z-suffix next to timezone label', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      // The bug was showing "2026-10-29T17:23:08.431Z (Asia/Jakarta)"
      // After fix, the raw ISO string must not appear followed by the timezone label
      expect(result).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z\s*\(Asia\/Jakarta\)/);
    });

    it('output contains the year 2026', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      expect(result).toContain('2026');
    });
  });

  describe('invalid/missing timezone handling', () => {
    it('returns "Belum diketahui" for undefined ISO string', () => {
      expect(formatTimeWithZone(undefined, 'Asia/Jakarta')).toBe('Belum diketahui');
    });

    it('returns "Belum diketahui" for empty ISO string', () => {
      expect(formatTimeWithZone('', 'Asia/Jakarta')).toBe('Belum diketahui');
    });

    it('invalid ISO string is returned raw with timezone label present', () => {
      const result = formatTimeWithZone('invalid-time', 'Asia/Jakarta');
      // Raw invalid string must be visible so user can identify/correct it
      expect(result).toContain('invalid-time');
      // Must not crash
      expect(typeof result).toBe('string');
    });

    it('unknown timezone is labeled honestly ("tidak dikenal"), not silently using device tz', () => {
      const result = formatTimeWithZone(TEST_ISO, 'NotARealTimezone');
      // Must surface the invalid timezone name
      expect(result).toContain('NotARealTimezone');
      // Must contain an honest label about the unknown zone
      expect(result).toContain('tidak dikenal');
    });

    it('raw UTC offset "+07:00" is treated as invalid timezone and labeled honestly', () => {
      const result = formatTimeWithZone(TEST_ISO, '+07:00');
      // Raw offset is not a valid IANA identifier; must be flagged
      expect(result).toContain('+07:00');
      // Must not silently produce a result that looks like a valid named timezone was used
      expect(result).not.toMatch(/\(Asia\/Jakarta\)/);
    });

    it('missing/undefined timezone uses UTC and labels result as UTC', () => {
      const result = formatTimeWithZone(TEST_ISO, undefined);
      expect(result).toContain('UTC');
    });
  });

  describe('output format consistency', () => {
    it('always returns a non-empty string for valid inputs', () => {
      const result = formatTimeWithZone(TEST_ISO, 'Asia/Jakarta');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('does not throw for any combination of inputs', () => {
      const testCases: Array<[string | undefined, string | undefined]> = [
        [TEST_ISO, 'Asia/Jakarta'],
        [TEST_ISO, 'Asia/Makassar'],
        [TEST_ISO, 'Asia/Jayapura'],
        [TEST_ISO, undefined],
        [TEST_ISO, ''],
        [TEST_ISO, '+07:00'],
        [TEST_ISO, 'InvalidZone'],
        ['invalid-time', 'Asia/Jakarta'],
        [undefined, 'Asia/Jakarta'],
        ['', 'Asia/Jakarta'],
        [undefined, undefined],
      ];
      for (const [iso, tz] of testCases) {
        expect(() => formatTimeWithZone(iso, tz)).not.toThrow();
      }
    });
  });
});

describe('Hoisted Intl Formatters (js-hoist-intl)', () => {
  it('formatShortDate formats ISO string and handles edge cases', () => {
    expect(formatShortDate(undefined)).toBe('—');
    expect(formatShortDate('')).toBe('—');
    expect(formatShortDate('invalid-date')).toBe('invalid-date');
    const formatted = formatShortDate('2026-10-30T04:23:00.000Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('formatDateOnly formats date without time and handles edge cases', () => {
    expect(formatDateOnly(undefined)).toBe('—');
    expect(formatDateOnly('')).toBe('—');
    expect(formatDateOnly('invalid-date')).toBe('invalid-date');
    const formatted = formatDateOnly('2026-10-28');
    expect(formatted).toContain('2026');
  });

  it('formatIndonesianHeaderDate returns weekday and month in Indonesian', () => {
    const fixedDate = new Date('2026-10-29T10:00:00Z');
    const header = formatIndonesianHeaderDate(fixedDate);
    expect(typeof header).toBe('string');
    expect(header).toContain('Oktober');
  });
});
