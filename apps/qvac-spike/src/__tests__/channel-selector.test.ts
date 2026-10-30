jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(true)
}));

import * as Linking from 'expo-linking';
import {
  filterChannelsByRegion,
  filterChannelsByIncidentLocationText,
  getAvailableRegions,
  searchChannels,
  isIncidentChannel,
  isNationalChannel,
  KNOWN_INDONESIAN_PROVINCES,
  VERIFIED_INCIDENT_CHANNEL_IDS
} from '../core/channel-selector';
import { CHANNEL_DIRECTORY } from '../core/channel-directory';
import { CHANNELS, listChannels, openDialer } from '../core/channels';
import { Channel } from '../product-contract';

describe('Channel Directory & Pure Canonical Selector Module (Damkar-Only Semantics)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Directory Integrity & Semantics (9 Verified Curated Damkar Channels)', () => {
    it('bundles exactly 9 verified Damkar municipal incident channels', () => {
      expect(CHANNEL_DIRECTORY.length).toBe(9);
      expect(CHANNELS.length).toBe(9);
      expect(listChannels().length).toBe(9);

      for (const ch of CHANNEL_DIRECTORY) {
        expect(ch.id).toBeDefined();
        expect(ch.label).toBeDefined();
        expect(ch.destination).toBeDefined();
        expect(['phone', 'whatsapp', 'email']).toContain(ch.kind);
        expect(ch.scope).toBeDefined();
        expect(ch.sourceUrl).toMatch(/^https:\/\//);
        expect(ch.checkedAt).toBe('2026-10-29');
        expect(ch.availability).toBe('public');
      }
    });

    it('contains ZERO national channels in active directory', () => {
      const nationalChannels = CHANNEL_DIRECTORY.filter(isNationalChannel);
      expect(nationalChannels.length).toBe(0);
      expect(listChannels().filter(isNationalChannel).length).toBe(0);
    });

    it('does NOT contain Kemenhut national, unconfirmed 112, or unverified office numbers in active directory', () => {
      const activeIds = CHANNEL_DIRECTORY.map((c) => c.id);
      expect(activeIds).not.toContain('kemenhut-posko-tel');
      expect(activeIds).not.toContain('kemenhut-posko-wa');
      expect(activeIds).not.toContain('kemenhut-posko-email');
      expect(activeIds).not.toContain('darurat-112');
      expect(activeIds).not.toContain('damkar-dki-tel');
      expect(activeIds).not.toContain('damkar-dki-email');
    });

    it('identifies curated incident suitability via curated IDs and public availability', () => {
      const samplePekanbaru = CHANNEL_DIRECTORY.find((c) => c.id === 'damkar-pekanbaru-wa')!;
      expect(isIncidentChannel(samplePekanbaru)).toBe(true);

      // Former national Kemenhut channel is not in active incident set
      const syntheticKemenhut: Channel = {
        id: 'kemenhut-posko-tel',
        label: 'Posko Karhutla Kemenhut (Telepon)',
        destination: '021-5704618',
        kind: 'phone',
        scope: 'Nasional',
        sourceUrl: 'https://example.com',
        checkedAt: '2026-10-29',
        availability: 'public'
      };
      expect(isIncidentChannel(syntheticKemenhut)).toBe(false);

      // Office contact synthetic test
      const syntheticOffice: Channel = {
        id: 'damkar-dki-tel',
        label: 'Dinas Pemadam DKI Jakarta (Telepon Kantor Dinas)',
        destination: '021-6344579',
        kind: 'phone',
        scope: 'Provinsi DKI Jakarta',
        sourceUrl: 'https://pemadam.jakarta.go.id/id',
        checkedAt: '2026-10-29',
        availability: 'public'
      };
      expect(isIncidentChannel(syntheticOffice)).toBe(false);

      // Unconfirmed availability synthetic test
      const syntheticUnconfirmed: Channel = {
        id: 'damkar-pekanbaru-wa',
        label: 'DPKP Kota Pekanbaru (Unconfirmed)',
        destination: '+62 851-8607-0113',
        kind: 'whatsapp',
        scope: 'Kota Pekanbaru, Riau',
        sourceUrl: 'https://example.com',
        checkedAt: '2026-10-29',
        availability: 'unconfirmed'
      };
      expect(isIncidentChannel(syntheticUnconfirmed)).toBe(false);
    });
  });

  describe('Curated Incident Filtering & Eligibility Hardening Regressions', () => {
    it('filters out channel when availability is unconfirmed and yields coverage gap without substitution', () => {
      const unconfirmedPekanbaru: Channel = {
        id: 'damkar-pekanbaru-wa',
        label: 'DPKP Kota Pekanbaru (Unconfirmed)',
        destination: '+62 851-8607-0113',
        kind: 'whatsapp',
        scope: 'Kota Pekanbaru, Riau',
        sourceUrl: 'https://example.com',
        checkedAt: '2026-10-29',
        availability: 'unconfirmed'
      };

      const result = filterChannelsByRegion([unconfirmedPekanbaru], 'Pekanbaru');
      // Unconfirmed channel must be filtered out; zero eligible city rows -> honest coverage gap
      expect(result.hasLocalMatch).toBe(false);
      expect(result.isNationalFallback).toBe(false);
      expect(result.channels).toEqual([]);
      expect(result.coverageNotice).toContain('Gap cakupan');
    });

    it('sets hasLocalMatch false and returns empty array when recognized city has absent rows in provided channel list', () => {
      // Empty channel list provided
      const result = filterChannelsByRegion([], 'Kota Pekanbaru');
      expect(result.hasLocalMatch).toBe(false);
      expect(result.isNationalFallback).toBe(false);
      expect(result.channels).toEqual([]);
      expect(result.coverageNotice).toContain('Gap cakupan');
    });

    it('excludes administrative or unknown IDs under any scope', () => {
      const adminNational: Channel = {
        id: 'bnpb-pusdalops-tel',
        label: 'Pusdalops BNPB',
        destination: '021-29827444',
        kind: 'phone',
        scope: 'Nasional',
        sourceUrl: 'https://www.bnpb.go.id/kontak',
        checkedAt: '2026-10-29',
        availability: 'public'
      };
      const unknownNational: Channel = {
        id: 'random-national-id',
        label: 'Random National Office',
        destination: '021-000000',
        kind: 'phone',
        scope: 'Nasional',
        sourceUrl: 'https://example.com',
        checkedAt: '2026-10-29',
        availability: 'public'
      };

      const result = filterChannelsByRegion([adminNational, unknownNational], null);
      // Administrative or uncurated channels should not appear
      expect(result.channels).toEqual([]);
    });

    it('handles empty input list safely across all methods without throwing', () => {
      const emptyCityResult = filterChannelsByRegion([], 'Kota Pekanbaru');
      expect(emptyCityResult.channels).toEqual([]);
      expect(emptyCityResult.hasLocalMatch).toBe(false);
      expect(emptyCityResult.isNationalFallback).toBe(false);

      const emptyNullResult = filterChannelsByRegion([], null);
      expect(emptyNullResult.channels).toEqual([]);
      expect(emptyNullResult.hasLocalMatch).toBe(false);
      expect(emptyNullResult.isNationalFallback).toBe(false);

      const emptyTextResult = filterChannelsByIncidentLocationText([], 'Kebakaran di Pekanbaru');
      expect(emptyTextResult.channels).toEqual([]);
      expect(emptyTextResult.hasLocalMatch).toBe(false);

      expect(getAvailableRegions([])).toEqual([]);
      expect(searchChannels([], 'damkar')).toEqual([]);
    });
  });

  describe('Exact Canonical Jurisdiction Regressions (Damkar-Only & Honest Gaps)', () => {
    it('prevents false-positive substring match: Kepulauan Riau vs Riau', () => {
      // Searching for "Kepulauan Riau" must NOT match "Kota Pekanbaru, Riau"
      const kepRiauResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Kepulauan Riau');
      expect(kepRiauResult.hasLocalMatch).toBe(false);
      expect(kepRiauResult.isNationalFallback).toBe(false);
      expect(kepRiauResult.channels).toEqual([]);
      expect(kepRiauResult.coverageNotice).toContain('gap cakupan');

      // Verify no Pekanbaru channels are leaked into Kepulauan Riau
      const leakedPekanbaru = kepRiauResult.channels.some((c) => c.scope.includes('Pekanbaru'));
      expect(leakedPekanbaru).toBe(false);
    });

    it('prevents false-positive substring match: Papua Barat Daya vs Papua', () => {
      // Searching for "Papua Barat Daya" must NOT match "Papua"
      const pbdResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Papua Barat Daya');
      expect(pbdResult.hasLocalMatch).toBe(false);
      expect(pbdResult.isNationalFallback).toBe(false);
      expect(pbdResult.channels).toEqual([]);

      const pbResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Papua Barat');
      expect(pbResult.hasLocalMatch).toBe(false);
      expect(pbResult.isNationalFallback).toBe(false);
      expect(pbResult.channels).toEqual([]);
    });

    it('distinguishes Province from Municipal City (Jawa Tengah vs Kota Semarang)', () => {
      // Querying province "Jawa Tengah" must NOT claim hasLocalMatch: true for Kota Semarang
      const jatengResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Jawa Tengah');
      expect(jatengResult.hasLocalMatch).toBe(false);
      expect(jatengResult.isNationalFallback).toBe(false);
      expect(jatengResult.channels).toEqual([]);
      expect(jatengResult.coverageNotice).toContain('tingkat kota/kabupaten');

      // Querying specific municipal city "Kota Semarang" or "Semarang" grants hasLocalMatch: true
      const semarangResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Kota Semarang');
      expect(semarangResult.hasLocalMatch).toBe(true);
      expect(semarangResult.isNationalFallback).toBe(false);
      expect(semarangResult.channels.length).toBe(2);
      expect(semarangResult.channels[0].id).toBe('damkar-semarang-tel');
      expect(semarangResult.channels[1].id).toBe('damkar-semarang-email');
    });

    it('rejects another city within the same province (Surakarta in Jawa Tengah, Dumai in Riau)', () => {
      // Surakarta is in Jawa Tengah, but Semarang Damkar does not have jurisdiction there
      const surakartaResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Surakarta');
      expect(surakartaResult.hasLocalMatch).toBe(false);
      expect(surakartaResult.isNationalFallback).toBe(false);
      expect(surakartaResult.channels).toEqual([]);
      expect(surakartaResult.coverageNotice).toContain('Gap cakupan');

      // Dumai is in Riau, but Pekanbaru Damkar does not serve Dumai
      const dumaiResult = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Dumai');
      expect(dumaiResult.hasLocalMatch).toBe(false);
      expect(dumaiResult.isNationalFallback).toBe(false);
      expect(dumaiResult.channels).toEqual([]);
      expect(dumaiResult.coverageNotice).toContain('Gap cakupan');
    });

    it('accurately resolves verified municipal cities', () => {
      // Pekanbaru
      const pbr = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Pekanbaru');
      expect(pbr.hasLocalMatch).toBe(true);
      expect(pbr.channels.length).toBe(2);
      expect(pbr.channels[0].scope).toContain('Pekanbaru');

      // Palangka Raya
      const pkr = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Palangka Raya');
      expect(pkr.hasLocalMatch).toBe(true);
      expect(pkr.channels[0].id).toBe('damkar-palangkaraya-tel');

      // Pontianak
      const ptk = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Pontianak');
      expect(ptk.hasLocalMatch).toBe(true);
      expect(ptk.channels[0].id).toBe('damkar-pontianak-pancabakti-tel');

      // Yogyakarta / Jogja
      const ygy = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Jogja');
      expect(ygy.hasLocalMatch).toBe(true);
      expect(ygy.channels[0].id).toBe('damkarmat-jogjakota-wa');

      // Serang
      const srg = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Kota Serang');
      expect(srg.hasLocalMatch).toBe(true);
      expect(srg.channels[0].id).toBe('damkar-kotaserang-tel');
    });

    it('handles null, undefined, empty, and Nasional inputs safely by returning all active Damkar channels', () => {
      const nullRes = filterChannelsByRegion(CHANNEL_DIRECTORY, null);
      expect(nullRes.hasLocalMatch).toBe(false);
      expect(nullRes.isNationalFallback).toBe(false);
      expect(nullRes.channels.length).toBe(9);

      const emptyRes = filterChannelsByRegion(CHANNEL_DIRECTORY, '   ');
      expect(emptyRes.channels.length).toBe(9);

      const nasRes = filterChannelsByRegion(CHANNEL_DIRECTORY, 'Nasional');
      expect(nasRes.channels.length).toBe(9);

      const semuaRes = filterChannelsByRegion(CHANNEL_DIRECTORY, 'semua');
      expect(semuaRes.channels.length).toBe(9);
    });
  });

  describe('Incident Location Text Parsing (Candidate Detection with Confirmation)', () => {
    it('detects city candidate from incident text and marks notice as candidate', () => {
      const text = 'Kebakaran semak belukar terlihat di pinggiran Pekanbaru dekat kebun sawit';
      const result = filterChannelsByIncidentLocationText(CHANNEL_DIRECTORY, text);
      expect(result.hasLocalMatch).toBe(true);
      expect(result.coverageNotice).toContain('Kandidat kota terdeteksi');
      expect(result.coverageNotice).toContain('wajib konfirmasi manual');
      expect(result.channels[0].scope).toContain('Pekanbaru');
    });

    it('reports honest gap for incident text mentioning province without local city match', () => {
      const text = 'Titik api terpantau di lereng bukit wilayah Aceh Besar';
      const result = filterChannelsByIncidentLocationText(CHANNEL_DIRECTORY, text);
      expect(result.hasLocalMatch).toBe(false);
      expect(result.isNationalFallback).toBe(false);
      expect(result.channels).toEqual([]);
    });

    it('handles blank incident text safely', () => {
      const result = filterChannelsByIncidentLocationText(CHANNEL_DIRECTORY, '');
      expect(result.channels.length).toBe(9);
      expect(result.isNationalFallback).toBe(false);
    });
  });

  describe('Discovery & Search Helpers', () => {
    it('extracts unique verified municipal cities', () => {
      const cities = getAvailableRegions(CHANNEL_DIRECTORY);
      expect(cities).toEqual([
        'Kota Palangka Raya',
        'Kota Pekanbaru',
        'Kota Pontianak',
        'Kota Semarang',
        'Kota Serang',
        'Kota Yogyakarta'
      ]);
    });

    it('searches channels across label, destination, and scope', () => {
      const waResults = searchChannels(CHANNEL_DIRECTORY, 'whatsapp');
      expect(waResults.length).toBe(2); // Pekanbaru WA, Jogja WA

      const phoneResults = searchChannels(CHANNEL_DIRECTORY, '0761-');
      expect(phoneResults.length).toBe(1); // Pekanbaru Tel

      const pancaBakti = searchChannels(CHANNEL_DIRECTORY, 'panca bakti');
      expect(pancaBakti.length).toBe(1);
      expect(pancaBakti[0].id).toBe('damkar-pontianak-pancabakti-tel');

      const all = searchChannels(CHANNEL_DIRECTORY, '');
      expect(all.length).toBe(9);
    });

    it('verifies standard Indonesian provinces list has 38 provinces', () => {
      expect(KNOWN_INDONESIAN_PROVINCES.length).toBe(38);
      expect(KNOWN_INDONESIAN_PROVINCES).toContain('Papua Barat Daya');
      expect(KNOWN_INDONESIAN_PROVINCES).toContain('Kepulauan Riau');
    });
  });

  describe('Safe Dialer Triggering (Non-Automated User-Driven Action)', () => {
    it('opens phone dialer with sanitized tel: URI for local Damkar', async () => {
      await openDialer('damkar-pekanbaru-tel');
      expect(Linking.canOpenURL).toHaveBeenCalledWith('tel:076122382');
      expect(Linking.openURL).toHaveBeenCalledWith('tel:076122382');
    });

    it('opens whatsapp with sanitized wa.me URI', async () => {
      await openDialer('damkar-pekanbaru-wa');
      expect(Linking.canOpenURL).toHaveBeenCalledWith('https://wa.me/6285186070113');
      expect(Linking.openURL).toHaveBeenCalledWith('https://wa.me/6285186070113');
    });

    it('opens email client with mailto: URI for Semarang Damkar email', async () => {
      await openDialer('damkar-semarang-email');
      expect(Linking.canOpenURL).toHaveBeenCalledWith('mailto:kebakaran.semarangkota@gmail.com');
      expect(Linking.openURL).toHaveBeenCalledWith('mailto:kebakaran.semarangkota@gmail.com');
    });

    it('throws error when channel ID does not exist', async () => {
      await expect(openDialer('unknown-non-existent-channel')).rejects.toThrow(
        "Kanal dengan ID 'unknown-non-existent-channel' tidak ditemukan."
      );
    });
  });
});
