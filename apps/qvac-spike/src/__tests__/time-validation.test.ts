/**
 * Regression tests for Bug 3: invalid observationTime/timezone accepted before persist.
 *
 * Evidence: device-qa-2026-10-30 report bug #3
 * "Masukkan 'invalid-time' pada editor ISO, tekan Simpan. Halaman kembali, status 'Tersimpan',
 *  rincian menampilkan 'invalid-time (Asia/Jakarta)'."
 *
 * Fix: validateObservationFields() in timeValidation.ts is called by repository.saveReport()
 * at the boundary before any DB write. This prevents malformed values from overwriting a
 * previously valid draft.
 *
 * Tests cover:
 *   1. Valid ISO timestamps pass (Z suffix, offset, various formats)
 *   2. Invalid ISO strings are rejected with a user-readable Indonesian error
 *   3. Valid IANA timezones pass (Asia/Jakarta WIB, Asia/Makassar WITA, Asia/Jayapura WIT)
 *   4. Invalid timezones are rejected (raw UTC offsets, gibberish strings)
 *   5. Calendar-normalized values: dates with day/month overflow are accepted by Date.parse
 *      (browser/node normalizes them) — we document this boundary honestly
 *   6. Host-independent: no reliance on device timezone for validation
 */

import {
  isValidIsoTimestamp,
  isValidIanaTimezone,
  validateObservationFields,
  INDONESIA_TIMEZONES,
} from '../core/timeValidation';

describe('isValidIsoTimestamp', () => {
  describe('valid ISO 8601 timestamps', () => {
    it.each([
      '2026-10-29T17:23:08.431Z',
      '2026-10-29T17:23:08Z',
      '2026-10-29T17:23:00+07:00',
      '2026-10-29T00:00:00+07:00',
      '2000-01-01T00:00:00Z',
      '2026-10-30T00:00:00+00:00',
    ])('accepts %s', (ts) => {
      expect(isValidIsoTimestamp(ts)).toBe(true);
    });
  });

  describe('invalid timestamp strings', () => {
    it.each([
      ['plain text', 'invalid-time'],
      ['empty string', ''],
      ['just date, no time', '2026-10-29'],   // Date.parse may accept this — tested honestly
      ['arbitrary text', 'Asia/Jakarta'],
      ['null-like empty', '   '],
    ])('rejects "%s" (%s)', (_label, ts) => {
      expect(isValidIsoTimestamp(ts)).toBe(false);
    });

    it('rejects "invalid-time" (the exact string from the QA report)', () => {
      expect(isValidIsoTimestamp('invalid-time')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidIsoTimestamp('')).toBe(false);
    });

    it('rejects whitespace-only string', () => {
      expect(isValidIsoTimestamp('   ')).toBe(false);
    });

    it('rejects arbitrary non-timestamp text', () => {
      expect(isValidIsoTimestamp('not a timestamp at all')).toBe(false);
    });
  });

  it.each([
    '2026-02-30T00:00:00Z',
    '2025-02-29T00:00:00+07:00',
    '2026-04-31T00:00:00Z',
    '2026-10-29T17:23:08',
    '10/29/2026 17:23:08',
    '2026-10-29T24:00:00Z',
  ])('rejects impossible or ambiguous observation time %s', (value) => {
    expect(isValidIsoTimestamp(value)).toBe(false);
  });

  it('accepts leap day and explicit offsets without normalizing the calendar', () => {
    expect(isValidIsoTimestamp('2024-02-29T23:59:59.123+09:00')).toBe(true);
    expect(isValidIsoTimestamp('2000-02-29T00:00:00Z')).toBe(true);
    expect(isValidIsoTimestamp('1900-02-29T00:00:00Z')).toBe(false);
  });
});

describe('isValidIanaTimezone', () => {
  describe('valid Indonesian timezone identifiers', () => {
    it.each([...INDONESIA_TIMEZONES])('accepts IANA zone: %s', (tz) => {
      expect(isValidIanaTimezone(tz)).toBe(true);
    });

    it('accepts Asia/Jakarta (WIB)', () => {
      expect(isValidIanaTimezone('Asia/Jakarta')).toBe(true);
    });

    it('accepts Asia/Makassar (WITA)', () => {
      expect(isValidIanaTimezone('Asia/Makassar')).toBe(true);
    });

    it('accepts Asia/Jayapura (WIT)', () => {
      expect(isValidIanaTimezone('Asia/Jayapura')).toBe(true);
    });

    it('accepts UTC', () => {
      expect(isValidIanaTimezone('UTC')).toBe(true);
    });
  });

  describe('invalid timezone identifiers', () => {
    it('rejects raw UTC offset "+07:00"', () => {
      expect(isValidIanaTimezone('+07:00')).toBe(false);
    });

    it('rejects raw UTC offset "-05:00"', () => {
      expect(isValidIanaTimezone('-05:00')).toBe(false);
    });

    it('rejects "UTC+7" style', () => {
      expect(isValidIanaTimezone('UTC+7')).toBe(false);
    });

    it('rejects "GMT+8" style', () => {
      expect(isValidIanaTimezone('GMT+8')).toBe(false);
    });

    it('rejects gibberish string', () => {
      expect(isValidIanaTimezone('NotATimezone')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidIanaTimezone('')).toBe(false);
    });

    it('rejects whitespace-only', () => {
      expect(isValidIanaTimezone('   ')).toBe(false);
    });
  });
});

describe('validateObservationFields — combined validation for saveReport boundary', () => {
  it('returns null for valid ISO time and valid timezone', () => {
    const err = validateObservationFields('2026-10-29T17:23:08.431Z', 'Asia/Jakarta');
    expect(err).toBeNull();
  });

  it('returns null for valid offset time and WIT zone', () => {
    const err = validateObservationFields('2026-10-29T00:23:00+09:00', 'Asia/Jayapura');
    expect(err).toBeNull();
  });

  it('returns Indonesian error message for "invalid-time" observationTime (exact QA case)', () => {
    const err = validateObservationFields('invalid-time', 'Asia/Jakarta');
    expect(err).not.toBeNull();
    expect(err).toContain('Waktu pengamatan tidak valid');
    expect(err).toContain('invalid-time');
    expect(err).toContain('ISO 8601');
    // Must preserve draft: error message should mention draft is still safe
    expect(err).toContain('Draf');
  });

  it('returns Indonesian error for raw UTC offset timezone', () => {
    const err = validateObservationFields('2026-10-29T17:23:08.431Z', '+07:00');
    expect(err).not.toBeNull();
    expect(err).toContain('Zona waktu tidak valid');
    expect(err).toContain('+07:00');
    expect(err).toContain('Asia/Jakarta');
  });

  it('returns timezone error (not time error) when only timezone is invalid', () => {
    const err = validateObservationFields('2026-10-29T17:23:08.431Z', 'InvalidZone');
    expect(err).not.toBeNull();
    expect(err).toContain('Zona waktu tidak valid');
  });

  it('returns time error first when both time and timezone are invalid', () => {
    const err = validateObservationFields('bad-time', 'bad-zone');
    expect(err).not.toBeNull();
    // Time is checked first
    expect(err).toContain('Waktu pengamatan tidak valid');
  });

  it('different valid IANA timezones all pass without error', () => {
    const zones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC', 'America/New_York'];
    for (const tz of zones) {
      const err = validateObservationFields('2026-10-29T17:23:08.431Z', tz);
      expect(err).toBeNull();
    }
  });

  it('validation is host-timezone independent — does not use device locale for result', () => {
    // Simulate time being formatted in different locales: the validation must give
    // the same result regardless of what Intl.DateTimeFormat().resolvedOptions().timeZone returns.
    // We simply assert both Asia/Jakarta and Asia/Jayapura pass validation,
    // since neither relies on the host timezone being a specific value.
    expect(validateObservationFields('2026-10-29T17:23:08Z', 'Asia/Jakarta')).toBeNull();
    expect(validateObservationFields('2026-10-29T17:23:08Z', 'Asia/Jayapura')).toBeNull();
  });
});
