/**
 * Meaningful unit & integration tests for ExportService.shareReport, previewExport,
 * and isSafeDescendantPath URI security normalization.
 *
 * Requirements:
 * - Authoritative report read (prevents memory-injected forged selfies).
 * - Rejects missing selfie in persisted report.
 * - Rejects forged caller-injected selfie when persisted report has null.
 * - Rejects selfie with missing or empty physical file on disk.
 * - Rejects selfie belonging to another reportId (wrong owner).
 * - Rejects selfie with literal '..' traversal, encoded '%2e%2e' / '..%2f' traversal, or backslashes.
 * - Enforces safe descendant normalization supporting valid paths with spaces and trailing slashes.
 * - Rejects non-camera selfie (e.g. source: 'library').
 * - Valid export includes sanitized incident photos + separate sanitized selfie,
 *   with label "Foto pengirim — identitas belum diverifikasi."
 * - Re-encoding failure triggers fail-closed rollback (deletes partial files, never calls Share.open).
 * - Share cancellation (dismiss/cancel) recorded honestly as event: 'cancelled' without throwing.
 * - Unknown share error recorded honestly as event: 'unknown' and rethrown.
 * - Invalid channelId rejected before OS handoff.
 * - Valid Damkar channelId accepted and recorded in share attempt.
 * - previewExport does not fake included selfie in photoUris.
 */

// Simulated on-disk filesystem state
const mockDiskFiles: Record<string, { exists: boolean; size: number }> = {};

jest.mock('expo-file-system', () => {
  // Mimics expo-file-system's Paths.join(): segments are joined and any run of
  // consecutive slashes collapsed to one (matching real native path normalization),
  // so the mock doesn't hide — or fabricate — double-slash bugs. Directories keep a
  // trailing slash (Directory.asString() behavior); files never have one
  // (FileSystemFile.asString() strips it).
  const joinMockUri = (parts: any[], isDirectory: boolean): string => {
    const raw = parts.map((p: any) => (p && p.uri ? p.uri : String(p))).join('/');
    // Collapse doubled slashes WITHOUT touching the scheme separator ('file://'),
    // mirroring real Paths.join() which normalizes only the URL's pathname.
    const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)(.*)$/.exec(raw);
    const collapsed = schemeMatch
      ? schemeMatch[1] + schemeMatch[2].replace(/\/{2,}/g, '/')
      : raw.replace(/\/{2,}/g, '/');
    if (isDirectory) return collapsed.endsWith('/') ? collapsed : `${collapsed}/`;
    return collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
  };
  return {
    Paths: {
      document: 'file:///mock/data/user/0/com.niragni/files',
      cache: 'file:///mock/data/user/0/com.niragni/cache'
    },
    Directory: class MockDirectory {
      private _parts: any[];
      constructor(...parts: any[]) {
        this._parts = parts;
      }
      get uri(): string {
        return joinMockUri(this._parts, true);
      }

      get exists(): boolean {
        return true;
      }
      create(): void {}
    },
    File: class MockFile {
      private _parts: any[];
      constructor(...parts: any[]) {
        this._parts = parts;
      }
      get uri(): string {
        return joinMockUri(this._parts, false);
      }

      get exists(): boolean {
        return mockDiskFiles[this.uri]?.exists ?? false;
      }
      get size(): number {
        return mockDiskFiles[this.uri]?.size ?? 0;
      }
      copy(dest: any): void {
        mockDiskFiles[dest.uri] = { exists: true, size: this.size || 2048 };
      }
      move(dest: any): void {
        mockDiskFiles[dest.uri] = { exists: true, size: this.size || 2048 };
        delete mockDiskFiles[this.uri];
      }
      delete(): void {
        delete mockDiskFiles[this.uri];
      }
    }
  };
});

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
  CameraType: { front: 'front', back: 'back' }
}));

jest.mock('../core/hasher', () => ({
  computeFileSha256: jest.fn().mockResolvedValue('mock-sha256')
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockImplementation(async (uri: string) => {
    return {
      uri: `${uri}_clean.jpg`,
      width: 1200,
      height: 900
    };
  }),
  SaveFormat: { JPEG: 'jpeg' }
}));

jest.mock('react-native-share', () => ({
  open: jest.fn().mockResolvedValue({ success: true })
}));

import Share from 'react-native-share';
import { manipulateAsync } from 'expo-image-manipulator';
import { ExportService, isSafeDescendantPath } from '../core/export';
import { ReportRepository } from '../core/repository';
import { Report, SenderSelfie, Attachment } from '../product-contract';

describe('ExportService Selfie Gate, Security & Export Policies', () => {
  let exportService: ExportService;
  let mockRepository: jest.Mocked<Partial<ReportRepository>>;

  const reportId = 'rep_test_123';
  const selfieDir = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${reportId}`;
  const validSelfieUri = `${selfieDir}/selfie.jpg`;
  const validPhotoUri = `${selfieDir}/originals/att_1.jpg`;

  const validSelfie: SenderSelfie = {
    id: 'selfie_123',
    reportId,
    uri: validSelfieUri,
    mime: 'image/jpeg',
    width: 1080,
    height: 1920,
    bytes: 150000,
    capturedAt: '2026-10-29T10:00:00.000Z',
    source: 'camera'
  };

  const validAttachment: Attachment = {
    id: 'att_1',
    reportId,
    uri: validPhotoUri,
    analysisUri: `${selfieDir}/analysis/att_1.jpg`,
    hash: 'hash_abc',
    mime: 'image/jpeg',
    width: 1920,
    height: 1080,
    bytes: 250000,
    source: 'camera',
    selectedForShare: true
  };

  const baseReport: Report = {
    id: reportId,
    revision: 1,
    createdAt: '2026-10-29T09:00:00.000Z',
    updatedAt: '2026-10-29T10:00:00.000Z',
    observationTime: '10:00',
    timezone: 'WIB',
    rawText: 'Asap tebal di lahan gambut',
    reviewedText: 'Terlihat kepulan asap tebal membubung dari lahan gambut.',
    observerLocation: {
      latitude: 0.5071,
      longitude: 101.4478,
      accuracy: 12,
      timestamp: '2026-10-29T10:00:00.000Z'
    },
    incidentLocationText: 'Jalan Garuda Sakti KM 3',
    includeObserverLocation: true,
    attachments: [validAttachment],
    suggestion: null,
    suggestionRevision: null,
    shareAttempts: [],
    senderSelfie: validSelfie
  };

  it('reports each preparation boundary before a pending native chooser, without starting a second share', async () => {
    const stages: string[] = [];
    let finish!: () => void;
    (Share.open as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ success: true });
    }));
    const pending = (exportService.shareReport as any)(baseReport, undefined, (stage: string) => stages.push(stage));
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(stages).toEqual(['validating', 'sanitizing', 'copying', 'sanitizing', 'copying', 'opening']);
    expect(Share.open).toHaveBeenCalledTimes(1);
    finish(); await pending;
    expect(stages[stages.length - 1]).toBe('recording');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (manipulateAsync as jest.Mock).mockImplementation(async (uri: string) => {
      return {
        uri: `${uri}_clean.jpg`,
        width: 1200,
        height: 900
      };
    });
    for (const key of Object.keys(mockDiskFiles)) {
      delete mockDiskFiles[key];
    }

    // Populate default disk files for valid paths
    mockDiskFiles[validSelfieUri] = { exists: true, size: 150000 };
    mockDiskFiles[validPhotoUri] = { exists: true, size: 250000 };

    mockRepository = {
      getReport: jest.fn().mockResolvedValue({ ...baseReport }),
      addShareAttempt: jest.fn().mockResolvedValue(undefined)
    };

    exportService = new ExportService(mockRepository as unknown as ReportRepository);
  });

  describe('Authoritative Persisted Read & Forgery Prevention', () => {
    it('rejects share when persisted report in repository has null selfie, even if caller passes a forged selfie object', async () => {
      // Repository returns report without selfie
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: null
      });

      // Caller injects forged selfie in memory object
      const callerReport: Report = {
        ...baseReport,
        senderSelfie: { ...validSelfie }
      };

      await expect(exportService.shareReport(callerReport)).rejects.toThrow(
        /Foto selfie pengirim wajib diambil sebelum berbagi laporan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects share when report is not found in repository', async () => {
      mockRepository.getReport = jest.fn().mockResolvedValue(null);

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Laporan 'rep_test_123' tidak ditemukan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });
  });

  describe('Selfie Verification Gate (Integrity & Origin Checks)', () => {
    it('rejects selfie when source is library instead of camera', async () => {
      const librarySelfie: SenderSelfie = {
        ...validSelfie,
        source: 'library' as any
      };
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: librarySelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Foto selfie pengirim harus bersumber langsung dari kamera depan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when reportId does not match (wrong owner)', async () => {
      const wrongOwnerSelfie: SenderSelfie = {
        ...validSelfie,
        reportId: 'rep_other_report_999'
      };
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: wrongOwnerSelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Foto selfie pengirim tidak cocok dengan kepemilikan laporan ini/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when URI points outside the report media directory (stolen uri from other report)', async () => {
      const outsideSelfie: SenderSelfie = {
        ...validSelfie,
        uri: 'file:///mock/data/user/0/com.niragni/files/bara_media/reports/rep_other/selfie.jpg'
      };
      mockDiskFiles[outsideSelfie.uri] = { exists: true, size: 100000 };

      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: outsideSelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Jalur berkas selfie tidak valid atau berada di luar direktori media laporan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when URI contains literal ".." directory traversal even if file exists on disk', async () => {
      const literalTraversalUri = `${selfieDir}/../rep_other/selfie.jpg`;
      mockDiskFiles[literalTraversalUri] = { exists: true, size: 50000 };

      const traversalSelfie: SenderSelfie = {
        ...validSelfie,
        uri: literalTraversalUri
      };
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: traversalSelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Jalur berkas selfie tidak valid atau berada di luar direktori media laporan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when URI contains encoded "%2e%2e" or "..%2f" traversal even if file exists on disk', async () => {
      const encodedTraversalUri = `${selfieDir}/%2e%2e/rep_other/selfie.jpg`;
      mockDiskFiles[encodedTraversalUri] = { exists: true, size: 50000 };

      const encodedSelfie: SenderSelfie = {
        ...validSelfie,
        uri: encodedTraversalUri
      };
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: encodedSelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Jalur berkas selfie tidak valid atau berada di luar direktori media laporan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when URI contains Windows backslashes or encoded backslashes (%5c)', async () => {
      const backslashUri = `${selfieDir}\\..\\rep_other\\selfie.jpg`;
      mockDiskFiles[backslashUri] = { exists: true, size: 50000 };

      const backslashSelfie: SenderSelfie = {
        ...validSelfie,
        uri: backslashUri
      };
      mockRepository.getReport = jest.fn().mockResolvedValue({
        ...baseReport,
        senderSelfie: backslashSelfie
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Jalur berkas selfie tidak valid atau berada di luar direktori media laporan/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when physical file does not exist on disk', async () => {
      mockDiskFiles[validSelfieUri] = { exists: false, size: 0 };

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Berkas fisik selfie pengirim tidak ditemukan atau kosong/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects selfie when physical file is empty (0 bytes)', async () => {
      mockDiskFiles[validSelfieUri] = { exists: true, size: 0 };

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Berkas fisik selfie pengirim tidak ditemukan atau kosong/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });
  });

  describe('isSafeDescendantPath Pure Normalizer Tests', () => {
    const base = 'file:///data/user/0/com.niragni/files/bara_media/reports/rep_1';

    it('accepts genuine descendants with or without trailing slash on base', () => {
      expect(isSafeDescendantPath(base, `${base}/selfie.jpg`)).toBe(true);
      expect(isSafeDescendantPath(`${base}/`, `${base}/selfie.jpg`)).toBe(true);
      expect(isSafeDescendantPath(base, `${base}/nested/selfie.jpg`)).toBe(true);
    });

    it('accepts genuine descendants containing spaces or URL-encoded spaces', () => {
      const spaceBase = 'file:///var/mobile/Containers/Data/Application/Application%20Support/reports/rep_1';
      expect(isSafeDescendantPath(spaceBase, `${spaceBase}/selfie_01.jpg`)).toBe(true);
    });

    it('rejects literal and encoded traversal tokens', () => {
      expect(isSafeDescendantPath(base, `${base}/../rep_2/selfie.jpg`)).toBe(false);
      expect(isSafeDescendantPath(base, `${base}/%2e%2e/rep_2/selfie.jpg`)).toBe(false);
      expect(isSafeDescendantPath(base, `${base}/..%2frep_2/selfie.jpg`)).toBe(false);
      expect(isSafeDescendantPath(base, `${base}/%252e%252e/rep_2/selfie.jpg`)).toBe(false);
    });

    it('rejects backslashes and encoded backslashes', () => {
      expect(isSafeDescendantPath(base, `${base}\\selfie.jpg`)).toBe(false);
      expect(isSafeDescendantPath(base, `${base}/%5cselfie.jpg`)).toBe(false);
    });

    it('rejects sibling folder prefix collisions', () => {
      expect(isSafeDescendantPath(base, 'file:///data/user/0/com.niragni/files/bara_media/reports/rep_1_fake/selfie.jpg')).toBe(false);
    });

    it('rejects malformed URI strings safely without throwing uncaught exceptions', () => {
      expect(isSafeDescendantPath(base, `${base}/%E0%A4%A`)).toBe(false);
      expect(isSafeDescendantPath('', `${base}/selfie.jpg`)).toBe(false);
      expect(isSafeDescendantPath(base, '')).toBe(false);
    });
  });

  describe('Channel ID Validation', () => {
    it('rejects invalid or uncurated channelId before OS handoff or photo copies', async () => {
      await expect(exportService.shareReport(baseReport, 'non-existent-channel')).rejects.toThrow(
        /Saluran tujuan 'non-existent-channel' tidak valid atau bukan kanal darurat Damkar aktif/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('rejects removed national Kemenhut channelId as no longer active Damkar', async () => {
      await expect(exportService.shareReport(baseReport, 'kemenhut-posko-tel')).rejects.toThrow(
        /bukan kanal darurat Damkar aktif yang terverifikasi/
      );
      expect(Share.open).not.toHaveBeenCalled();
    });

    it('accepts valid active Damkar channelId and records it in share attempt', async () => {
      await exportService.shareReport(baseReport, 'damkar-pekanbaru-wa');

      expect(Share.open).toHaveBeenCalled();
      expect(mockRepository.addShareAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'share_sheet_opened',
          channelId: 'damkar-pekanbaru-wa'
        }),
        reportId
      );
    });

    it('allows undefined channelId for generic OS share sheet without recipient claim', async () => {
      await exportService.shareReport(baseReport, undefined);

      expect(Share.open).toHaveBeenCalled();
      expect(mockRepository.addShareAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'share_sheet_opened',
          channelId: undefined
        }),
        reportId
      );
    });
  });

  describe('EXIF Stripping, Separate Inclusion & Fail-Closed Cleanup', () => {
    it('re-encodes incident photos and selfie to JPEG, includes verbatim notice, and passes sanitized URIs to Share.open', async () => {
      await exportService.shareReport(baseReport);

      // Both incident photo and selfie must be manipulated
      expect(manipulateAsync).toHaveBeenCalledWith(
        validPhotoUri,
        [],
        expect.objectContaining({ format: 'jpeg' })
      );
      expect(manipulateAsync).toHaveBeenCalledWith(
        validSelfieUri,
        [],
        expect.objectContaining({ format: 'jpeg' })
      );

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Laporan Pengamatan Karhutla',
          message: expect.stringContaining('Foto pengirim — identitas belum diverifikasi.'),
          urls: expect.arrayContaining([
            expect.stringContaining('_photo_1.jpg'),
            expect.stringContaining('_selfie.jpg')
          ])
        })
      );
    });

    it('cleans up partial batch files and fails closed when re-encoding fails on selfie', async () => {
      // Mock failure during selfie re-encoding
      (manipulateAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri === validSelfieUri) {
          throw new Error('Image corruption / codec crash');
        }
        return { uri: `${uri}_clean.jpg`, width: 800, height: 600 };
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Gagal melakukan sanitasi EXIF pada foto pengirim/
      );

      // Share.open must NOT have been called
      expect(Share.open).not.toHaveBeenCalled();

      // Any partial export files must have been cleaned up
      const exportFiles = Object.keys(mockDiskFiles).filter((k) => k.includes('bara_exports'));
      expect(exportFiles.length).toBe(0);
    });

    it('cleans up partial batch files and fails closed when re-encoding fails on an incident photo', async () => {
      (manipulateAsync as jest.Mock).mockRejectedValueOnce(new Error('Corrupt JPEG stream'));

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Gagal melakukan sanitasi penghapusan EXIF pada foto lampiran/
      );

      expect(Share.open).not.toHaveBeenCalled();
      const exportFiles = Object.keys(mockDiskFiles).filter((k) => k.includes('bara_exports'));
      expect(exportFiles.length).toBe(0);
    });

    it('deletes partial target file when move creates destination then throws, preserving original source and media files', async () => {
      const { File } = await import('expo-file-system');
      let moveCallCount = 0;
      const moveSpy = jest.spyOn(File.prototype, 'move').mockImplementation(function (dest: any) {
        moveCallCount++;
        // Simulate partial write of destination file
        mockDiskFiles[dest.uri] = { exists: true, size: 512 };
        if (moveCallCount === 2) {
          throw new Error('Disk full during destination write');
        }
      });

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Gagal melakukan sanitasi EXIF pada foto pengirim.*Disk full during destination write/
      );

      // OS dialog must not be opened
      expect(Share.open).not.toHaveBeenCalled();

      // All partial export files must be deleted
      const remainingExportFiles = Object.keys(mockDiskFiles).filter((k) => k.includes('bara_exports'));
      expect(remainingExportFiles.length).toBe(0);

      // Original source files in report media directory must be untouched
      expect(mockDiskFiles[validPhotoUri]?.exists).toBe(true);
      expect(mockDiskFiles[validSelfieUri]?.exists).toBe(true);

      moveSpy.mockRestore();
    });
  });

  describe('Honest Share Event Recording (No Fake Success Claims)', () => {
    it('records event cancelled without throwing when user dismisses or cancels share dialog', async () => {
      (Share.open as jest.Mock).mockRejectedValueOnce(new Error('User did not share'));

      await expect(exportService.shareReport(baseReport)).resolves.toBeUndefined();

      expect(mockRepository.addShareAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'cancelled'
        }),
        reportId
      );
    });

    it('records event unknown and rethrows when Share.open encounters an unexpected error', async () => {
      (Share.open as jest.Mock).mockRejectedValueOnce(new Error('OS intent delivery failure'));

      await expect(exportService.shareReport(baseReport)).rejects.toThrow(
        /Gagal membuka dialog berbagi sistem/
      );

      expect(mockRepository.addShareAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'unknown'
        }),
        reportId
      );
    });
  });

  describe('Preview Transparency', () => {
    it('previewExport returns selected incident photos and does not fake selfie in photoUris', async () => {
      const preview = await exportService.previewExport(baseReport);

      expect(preview.photoUris).toEqual([validPhotoUri]);
      expect(preview.photoUris).not.toContain(validSelfieUri);
      expect(preview.text).toContain('LAMPIRAN FOTO: 1 foto bukti terlampir.');
      expect(preview.text).toContain('POSISI PELAPOR: 0.507100, 101.447800');
    });

    it('previewExport functions for drafts without selfie without throwing or fabricating selfie', async () => {
      const draftWithoutSelfie: Report = {
        ...baseReport,
        senderSelfie: null
      };

      const preview = await exportService.previewExport(draftWithoutSelfie);
      expect(preview.photoUris).toEqual([validPhotoUri]);
      expect(preview.text).toContain('--- LAPORAN OBSERVASI DUGAAN KARHUTLA ---');
    });
  });
});
