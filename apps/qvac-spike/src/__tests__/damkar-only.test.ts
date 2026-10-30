/**
 * Dedicated test suite verifying Damkar-Only channel directory constraints.
 *
 * Requirements:
 * - Active bundled directory and listChannels contain ONLY verified Damkar municipal incident channels.
 * - No Kemenhut, no 112, no BPBD, no national fallback, no general administrative office contacts.
 * - Raw CHANNEL_DIRECTORY constant is Damkar-only, not merely a filtered view.
 * - Every active channel possesses an official .go.id primary government source.
 * - Verification date is pinned to 2026-10-29.
 * - Unverified cities and provinces yield honest coverage gaps with zero substitution.
 */

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(true)
}));

import { CHANNEL_DIRECTORY } from '../core/channel-directory';
import { CHANNELS, listChannels } from '../core/channels';
import {
  filterChannelsByRegion,
  getAvailableRegions,
  isIncidentChannel,
  isNationalChannel,
  VERIFIED_INCIDENT_CHANNEL_IDS
} from '../core/channel-selector';

describe('Damkar-Only Active Directory & Coverage Gap Integrity', () => {
  describe('Raw Constant & Active List Constraints', () => {
    it('ensures CHANNEL_DIRECTORY contains only Damkar incident channels (exactly 9 rows)', () => {
      expect(CHANNEL_DIRECTORY.length).toBe(9);
      expect(CHANNELS.length).toBe(9);
      expect(listChannels().length).toBe(9);

      // Verify every single ID is a Damkar/Damkarmat channel ID
      for (const channel of CHANNEL_DIRECTORY) {
        expect(channel.id).toMatch(/^damkar(mat)?-/);
        expect(VERIFIED_INCIDENT_CHANNEL_IDS.has(channel.id)).toBe(true);
        expect(isIncidentChannel(channel)).toBe(true);
        expect(isNationalChannel(channel)).toBe(false);
      }
    });

    it('confirms absence of national Kemenhut, 112, and administrative office contacts', () => {
      const activeIds = CHANNEL_DIRECTORY.map((c) => c.id);
      const activeLabels = CHANNEL_DIRECTORY.map((c) => c.label.toLowerCase());

      expect(activeIds).not.toContain('kemenhut-posko-tel');
      expect(activeIds).not.toContain('kemenhut-posko-wa');
      expect(activeIds).not.toContain('kemenhut-posko-email');
      expect(activeIds).not.toContain('darurat-112');
      expect(activeIds).not.toContain('damkar-dki-tel');

      for (const label of activeLabels) {
        expect(label).not.toContain('kemenhut');
        expect(label).not.toContain('112');
        expect(label).not.toContain('kantor dinas');
      }
    });

    it('verifies that every channel has a verified .go.id government source and pinned check date', () => {
      for (const ch of CHANNEL_DIRECTORY) {
        expect(ch.sourceUrl).toMatch(/^https:\/\/[a-z0-9.-]+\.go\.id(\/.*)?$/);
        expect(ch.checkedAt).toBe('2026-10-29');
        expect(ch.availability).toBe('public');
      }
    });

    it('covers exactly 6 verified municipal cities across 6 provinces', () => {
      const availableCities = getAvailableRegions(CHANNEL_DIRECTORY);
      expect(availableCities).toEqual([
        'Kota Palangka Raya',
        'Kota Pekanbaru',
        'Kota Pontianak',
        'Kota Semarang',
        'Kota Serang',
        'Kota Yogyakarta'
      ]);
    });
  });

  describe('Honest Coverage Gaps Across Unverified Indonesian Regions', () => {
    const unverifiedProvinces = [
      'Aceh',
      'Sumatera Utara',
      'Sumatera Barat',
      'Jambi',
      'Sumatera Selatan',
      'Lampung',
      'Jawa Barat',
      'Jawa Timur',
      'Bali',
      'Kalimantan Selatan',
      'Kalimantan Timur',
      'Sulawesi Selatan',
      'Papua',
      'Papua Barat Daya'
    ];

    for (const prov of unverifiedProvinces) {
      it(`reports honest coverage gap for province '${prov}' with empty channel list and no fallback substitution`, () => {
        const result = filterChannelsByRegion(CHANNEL_DIRECTORY, prov);
        expect(result.channels).toEqual([]);
        expect(result.hasLocalMatch).toBe(false);
        expect(result.isNationalFallback).toBe(false);
        expect(result.coverageNotice).toBeDefined();
        expect(result.coverageNotice).toContain('gap cakupan');
      });
    }

    const unverifiedCities = [
      'Surabaya',
      'Medan',
      'Bandung',
      'Denpasar',
      'Banjarmasin',
      'Makassar',
      'Jayapura',
      'Samarinda',
      'Balikpapan'
    ];

    for (const city of unverifiedCities) {
      it(`reports honest coverage gap for unverified city '${city}' with empty channels`, () => {
        const result = filterChannelsByRegion(CHANNEL_DIRECTORY, city);
        expect(result.channels).toEqual([]);
        expect(result.hasLocalMatch).toBe(false);
        expect(result.isNationalFallback).toBe(false);
        expect(result.coverageNotice).toBeDefined();
        expect(result.coverageNotice).toContain('Gap cakupan');
        expect(result.coverageNotice).toContain(city);
      });
    }
  });

  describe('Verified City Exact Resolution', () => {
    it('resolves Kota Pekanbaru to both WhatsApp and Phone Damkar hotlines', () => {
      const res = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Kota Pekanbaru');
      expect(res.hasLocalMatch).toBe(true);
      expect(res.channels.length).toBe(2);
      const ids = res.channels.map((c) => c.id);
      expect(ids).toContain('damkar-pekanbaru-wa');
      expect(ids).toContain('damkar-pekanbaru-tel');
      expect(res.coverageNotice).toContain('Ditemukan 2 saluran resmi Damkar');
    });

    it('resolves Kota Semarang to Phone and Email Damkar contacts', () => {
      const res = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Kota Semarang');
      expect(res.hasLocalMatch).toBe(true);
      expect(res.channels.length).toBe(2);
      const ids = res.channels.map((c) => c.id);
      expect(ids).toContain('damkar-semarang-tel');
      expect(ids).toContain('damkar-semarang-email');
    });

    it('resolves Kota Yogyakarta via alias "jogja"', () => {
      const res = filterChannelsByRegion(CHANNEL_DIRECTORY, 'jogja');
      expect(res.hasLocalMatch).toBe(true);
      expect(res.channels.length).toBe(2);
      const ids = res.channels.map((c) => c.id);
      expect(ids).toContain('damkarmat-jogjakota-wa');
      expect(ids).toContain('damkarmat-jogjakota-tel');
    });
  });
});
