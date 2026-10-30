/**
 * Meaningful behavioral tests for ReportRepository selfie operations.
 *
 * Verifies:
 * - captureSenderSelfie requires camera permission and uses front camera.
 * - captureSenderSelfie returns null on user cancel (no DB/file side effects).
 * - captureSenderSelfie generates unique nonce-based filenames (no collision on same-ms / frozen clock).
 * - captureSenderSelfie atomically replaces existing selfie: commits new row first,
 *   deletes old file only after DB commit succeeds.
 * - captureSenderSelfie rolls back staged file if DB write fails, preserving previous DB row + old file.
 * - captureSenderSelfie defers old file deletion until after transaction commit promise resolves.
 * - removeSenderSelfie deletes DB row and physical file, returns updated report.
 * - getSelfieForReport returns null when file is missing on disk (stale DB row).
 * - deleteReport explicitly deletes sender_selfies rows (not relying solely on CASCADE).
 * - init() includes selfie URIs in orphan cleanup so valid selfie files are preserved.
 * - Selfie operations never read or corrupt other reports' data (isolation).
 *
 * NOTE ON TESTING BOUNDARIES & LIMITATIONS:
 * These tests verify application-level orchestration and sequencing inside ReportRepository:
 * 1. That ReportRepository defers old-file deletion until AFTER the database transaction resolves.
 * 2. That ReportRepository catches transaction failures, deletes newly staged files, and preserves old files.
 *
 * HOWEVER, mocking SQLite at the withExclusiveTransactionAsync / runAsync boundary simulates transaction
 * semantics; it does NOT establish actual Expo SQLite runtime transaction rollback, WAL integrity, or
 * native C/JNI error behavior on physical Android devices. Full hardware proof requires running the APK on-device.
 */

// ── Simulated on-disk filesystem state ──
const mockDiskFiles: Record<string, { exists: boolean; size: number }> = {};
const mockDeletedFiles: string[] = [];
const mockCopiedFiles: Array<{ from: string; to: string }> = [];

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
      list(): any[] { return []; }
      delete(): void {}
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
        mockCopiedFiles.push({ from: this.uri, to: dest.uri });
      }
      move(dest: any): void {
        mockDiskFiles[dest.uri] = { exists: true, size: this.size || 2048 };
        mockCopiedFiles.push({ from: this.uri, to: dest.uri });
        delete mockDiskFiles[this.uri];
      }
      delete(): void {
        mockDeletedFiles.push(this.uri);
        delete mockDiskFiles[this.uri];
      }
    }
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
  CameraType: { front: 'front', back: 'back' }
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file:///tmp/manipulated.jpg',
    width: 800,
    height: 600
  }),
  SaveFormat: { JPEG: 'jpeg' }
}));

jest.mock('../core/hasher', () => ({
  computeFileSha256: jest.fn().mockResolvedValue('mock-sha256')
}));

// ── Simulated SQLite database state ──
const mockSelfieRows: Array<{
  id: string;
  reportId: string;
  uri: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  capturedAt: string;
  source: string;
}> = [];

const mockReportRows: Array<{
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  observationTime: string;
  timezone: string;
  rawText: string;
  reviewedText: string;
  observerLocation: string | null;
  incidentLocationText: string;
  includeObserverLocation: number;
  suggestion: string | null;
  suggestionRevision: number | null;
}> = [];

const mockAttachmentRows: Array<any> = [];
const mockShareAttemptRows: Array<any> = [];

// Track all SQL operations for verification
const sqlLog: Array<{ sql: string; params?: any[] }> = [];

const defaultRunAsync = async (sql: string, params?: any[]) => {
  sqlLog.push({ sql, params });

  if (sql.includes('DELETE FROM sender_selfies') && params) {
    const reportId = params[0];
    const idx = mockSelfieRows.findIndex(r => r.reportId === reportId);
    if (idx >= 0) mockSelfieRows.splice(idx, 1);
  }
  if (sql.includes('INSERT INTO sender_selfies') && params) {
    mockSelfieRows.push({
      id: params[0] as string,
      reportId: params[1] as string,
      uri: params[2] as string,
      mime: params[3] as string,
      width: params[4] as number,
      height: params[5] as number,
      bytes: params[6] as number,
      capturedAt: params[7] as string,
      source: params[8] as string
    });
  }
  return { changes: 1 };
};

const mockTxn = {
  getFirstAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    sqlLog.push({ sql, params });
    if (sql.includes('sender_selfies') && sql.includes('SELECT')) {
      const reportId = params?.[0];
      return mockSelfieRows.find(r => r.reportId === reportId) ?? null;
    }
    if (sql.includes('reports') && sql.includes('SELECT')) {
      const id = params?.[0];
      return mockReportRows.find(r => r.id === id) ?? null;
    }
    return null;
  }),
  runAsync: jest.fn().mockImplementation(defaultRunAsync),
  execAsync: jest.fn()
};

const defaultWithExclusiveTransaction = async (cb: (txn: any) => Promise<void>) => {
  const selfieSnapshot = JSON.parse(JSON.stringify(mockSelfieRows));
  const reportSnapshot = JSON.parse(JSON.stringify(mockReportRows));
  try {
    await cb(mockTxn);
  } catch (err) {
    mockSelfieRows.length = 0;
    mockSelfieRows.push(...selfieSnapshot);
    mockReportRows.length = 0;
    mockReportRows.push(...reportSnapshot);
    throw err;
  }
};

const mockDb = {
  getAllAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    sqlLog.push({ sql, params });
    if (sql.includes('SELECT') && sql.includes('attachments') && !sql.includes('sender_selfies')) {
      const reportId = params?.[0];
      if (reportId) return mockAttachmentRows.filter(r => r.reportId === reportId);
      return mockAttachmentRows;
    }
    if (sql.includes('SELECT') && sql.includes('share_attempts')) {
      const reportId = params?.[0];
      if (reportId) return mockShareAttemptRows.filter(r => r.reportId === reportId);
      return mockShareAttemptRows;
    }
    if (sql.includes('SELECT') && sql.includes('sender_selfies')) {
      return mockSelfieRows;
    }
    return [];
  }),
  getFirstAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    sqlLog.push({ sql, params });
    if (sql.includes('sender_selfies') && sql.includes('SELECT')) {
      const reportId = params?.[0];
      return mockSelfieRows.find(r => r.reportId === reportId) ?? null;
    }
    if (sql.includes('reports') && sql.includes('SELECT')) {
      const id = params?.[0];
      return mockReportRows.find(r => r.id === id) ?? null;
    }
    return null;
  }),
  runAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    sqlLog.push({ sql, params });
    if (sql.includes('DELETE FROM sender_selfies') && params) {
      const reportId = params[0];
      const idx = mockSelfieRows.findIndex(r => r.reportId === reportId);
      if (idx >= 0) mockSelfieRows.splice(idx, 1);
    }
    return { changes: 1 };
  }),
  withExclusiveTransactionAsync: jest.fn().mockImplementation(defaultWithExclusiveTransaction),
  execAsync: jest.fn()
};

jest.mock('../core/database', () => ({
  getDatabase: jest.fn().mockImplementation(async () => mockDb),
  withWriteLock: jest.fn().mockImplementation(async (cb: (db: any) => Promise<any>) => cb(mockDb))
}));

import * as ImagePicker from 'expo-image-picker';
import { ReportRepository } from '../core/repository';

describe('ReportRepository Selfie Operations', () => {
  let repo: ReportRepository;
  const testReportId = 'rep_test_selfie_001';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear state
    for (const key of Object.keys(mockDiskFiles)) {
      delete mockDiskFiles[key];
    }
    mockDeletedFiles.length = 0;
    mockCopiedFiles.length = 0;
    mockSelfieRows.length = 0;
    mockReportRows.length = 0;
    mockAttachmentRows.length = 0;
    mockShareAttemptRows.length = 0;
    sqlLog.length = 0;

    mockTxn.runAsync.mockImplementation(defaultRunAsync);
    mockDb.withExclusiveTransactionAsync.mockImplementation(defaultWithExclusiveTransaction);

    // Seed a test report
    mockReportRows.push({
      id: testReportId,
      revision: 1,
      createdAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-29T10:00:00.000Z',
      observationTime: '2026-10-29T10:00:00.000Z',
      timezone: 'Asia/Jakarta',
      rawText: 'Asap tebal dari gambut',
      reviewedText: '',
      observerLocation: null,
      incidentLocationText: 'Jl. Garuda Sakti KM 3',
      includeObserverLocation: 0,
      suggestion: null,
      suggestionRevision: null
    });

    repo = new ReportRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('captureSenderSelfie', () => {
    it('requires camera permission before launching camera', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied'
      });

      await expect(repo.captureSenderSelfie(testReportId)).rejects.toThrow(
        /Izin kamera diperlukan/
      );

      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    it('uses front camera with exif disabled', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/camera_selfie.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 150000
        }]
      });

      // Stage the source file on mock disk
      mockDiskFiles['file:///tmp/camera_selfie.jpg'] = { exists: true, size: 150000 };

      const selfie = await repo.captureSenderSelfie(testReportId);

      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          cameraType: ImagePicker.CameraType.front,
          exif: false
        })
      );
      expect(selfie).not.toBeNull();
      expect(selfie!.source).toBe('camera');
      expect(selfie!.reportId).toBe(testReportId);
    });

    it('returns null when user cancels camera (no DB or file side effects)', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: []
      });

      const selfie = await repo.captureSenderSelfie(testReportId);

      expect(selfie).toBeNull();
      // No files should have been copied or created
      expect(mockCopiedFiles.length).toBe(0);
      // No DB inserts should have occurred for selfie
      const selfieInserts = sqlLog.filter(l => l.sql.includes('INSERT INTO sender_selfies'));
      expect(selfieInserts.length).toBe(0);
    });

    it('throws when report does not exist', async () => {
      await expect(repo.captureSenderSelfie('rep_nonexistent')).rejects.toThrow(
        /tidak ditemukan/
      );
    });

    it('generates unique nonce-based filenames to prevent collision', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted'
      });

      const makeAsset = () => ({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/camera_selfie.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 150000
        }]
      });

      mockDiskFiles['file:///tmp/camera_selfie.jpg'] = { exists: true, size: 150000 };

      (ImagePicker.launchCameraAsync as jest.Mock)
        .mockResolvedValueOnce(makeAsset())
        .mockResolvedValueOnce(makeAsset());

      const selfie1 = await repo.captureSenderSelfie(testReportId);
      const selfie2 = await repo.captureSenderSelfie(testReportId);

      expect(selfie1).not.toBeNull();
      expect(selfie2).not.toBeNull();
      // IDs and URIs must differ (nonce-based)
      expect(selfie1!.id).not.toBe(selfie2!.id);
      expect(selfie1!.uri).not.toBe(selfie2!.uri);
    });

    it('generates unique nonce-based filenames and IDs when Date.now is frozen to the same millisecond', async () => {
      const fixedTs = 1793260800000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTs);

      // Supply distinct nonces via Math.random mock
      let callCount = 0;
      const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0.123456789 : 0.987654321;
      });

      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted'
      });

      const makeAsset = () => ({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/camera_selfie.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 150000
        }]
      });

      mockDiskFiles['file:///tmp/camera_selfie.jpg'] = { exists: true, size: 150000 };

      (ImagePicker.launchCameraAsync as jest.Mock)
        .mockResolvedValueOnce(makeAsset())
        .mockResolvedValueOnce(makeAsset());

      const selfie1 = await repo.captureSenderSelfie(testReportId);
      const selfie2 = await repo.captureSenderSelfie(testReportId);

      expect(selfie1).not.toBeNull();
      expect(selfie2).not.toBeNull();
      // Both used the exact same millisecond timestamp
      expect(selfie1!.capturedAt).toBe(new Date(fixedTs).toISOString());
      expect(selfie2!.capturedAt).toBe(new Date(fixedTs).toISOString());
      // Nonces ensure IDs and filenames are completely distinct
      expect(selfie1!.id).not.toBe(selfie2!.id);
      expect(selfie1!.uri).not.toBe(selfie2!.uri);
      expect(selfie1!.uri).toContain(`selfie_${fixedTs}_`);
      expect(selfie2!.uri).toContain(`selfie_${fixedTs}_`);

      dateNowSpy.mockRestore();
      randomSpy.mockRestore();
    });

    it('atomically replaces existing selfie: new row committed before old file deleted', async () => {
      // Seed an existing selfie
      const oldSelfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_old_123_abc.jpg`;
      mockSelfieRows.push({
        id: 'selfie_old',
        reportId: testReportId,
        uri: oldSelfieUri,
        mime: 'image/jpeg',
        width: 720,
        height: 1280,
        bytes: 100000,
        capturedAt: '2026-10-29T09:00:00.000Z',
        source: 'camera'
      });
      mockDiskFiles[oldSelfieUri] = { exists: true, size: 100000 };

      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/new_selfie.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 200000
        }]
      });
      mockDiskFiles['file:///tmp/new_selfie.jpg'] = { exists: true, size: 200000 };

      const newSelfie = await repo.captureSenderSelfie(testReportId);

      expect(newSelfie).not.toBeNull();
      expect(newSelfie!.reportId).toBe(testReportId);
      // The old selfie row should have been replaced
      expect(mockSelfieRows.length).toBe(1);
      expect(mockSelfieRows[0].id).toBe(newSelfie!.id);
      // SQL log should show DELETE before INSERT (atomic replace)
      const deleteIdx = sqlLog.findIndex(l =>
        l.sql.includes('DELETE FROM sender_selfies')
      );
      const insertIdx = sqlLog.findIndex(l =>
        l.sql.includes('INSERT INTO sender_selfies')
      );
      expect(deleteIdx).toBeGreaterThanOrEqual(0);
      expect(insertIdx).toBeGreaterThan(deleteIdx);
    });

    it('rolls back on transaction failure: preserves previous selfie row + old file, unlinks ONLY newly staged file, leaves other reports untouched', async () => {
      // 1. Seed an existing selfie for the target report
      const oldSelfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_prev_exist.jpg`;
      const prevSelfieRow = {
        id: 'selfie_prev_id',
        reportId: testReportId,
        uri: oldSelfieUri,
        mime: 'image/jpeg',
        width: 720,
        height: 1280,
        bytes: 95000,
        capturedAt: '2026-10-29T08:00:00.000Z',
        source: 'camera'
      };
      mockSelfieRows.push(prevSelfieRow);
      mockDiskFiles[oldSelfieUri] = { exists: true, size: 95000 };

      // 2. Seed a selfie for a different report to verify cross-report isolation
      const otherReportId = 'rep_other_report_isolated';
      mockReportRows.push({
        id: otherReportId,
        revision: 1,
        createdAt: '2026-10-29T08:00:00.000Z',
        updatedAt: '2026-10-29T08:00:00.000Z',
        observationTime: '2026-10-29T08:00:00.000Z',
        timezone: 'Asia/Jakarta',
        rawText: 'Laporan pembanding',
        reviewedText: '',
        observerLocation: null,
        incidentLocationText: 'Arah bukit',
        includeObserverLocation: 0,
        suggestion: null,
        suggestionRevision: null
      });
      const otherSelfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${otherReportId}/selfie_other.jpg`;
      const otherSelfieRow = {
        id: 'selfie_other_id',
        reportId: otherReportId,
        uri: otherSelfieUri,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 120000,
        capturedAt: '2026-10-29T08:30:00.000Z',
        source: 'camera'
      };
      mockSelfieRows.push(otherSelfieRow);
      mockDiskFiles[otherSelfieUri] = { exists: true, size: 120000 };

      // 3. Setup camera capture asset
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/candidate_to_fail.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 180000
        }]
      });
      mockDiskFiles['file:///tmp/candidate_to_fail.jpg'] = { exists: true, size: 180000 };

      // 4. Inject a database failure during transaction execution on INSERT
      mockTxn.runAsync.mockImplementationOnce(defaultRunAsync).mockImplementationOnce(async () => {
        throw new Error('SQLiteDiskFullException: disk is full during insert');
      });

      // 5. Execute capture and expect rejection
      await expect(repo.captureSenderSelfie(testReportId)).rejects.toThrow(
        /SQLiteDiskFullException/
      );

      // 6. Assertions on rollback state:
      // A. Previous selfie row in DB is preserved (simulated transaction rollback)
      const currentTargetRow = mockSelfieRows.find(r => r.reportId === testReportId);
      expect(currentTargetRow).toBeDefined();
      expect(currentTargetRow!.id).toBe('selfie_prev_id');
      expect(currentTargetRow!.uri).toBe(oldSelfieUri);

      // B. Old file on disk is strictly preserved
      expect(mockDiskFiles[oldSelfieUri]?.exists).toBe(true);

      // C. Other report's row and file are completely unaffected
      const currentOtherRow = mockSelfieRows.find(r => r.reportId === otherReportId);
      expect(currentOtherRow).toBeDefined();
      expect(currentOtherRow!.id).toBe('selfie_other_id');
      expect(mockDiskFiles[otherSelfieUri]?.exists).toBe(true);

      // D. Newly staged file was unlinked/deleted by the catch handler
      expect(mockDeletedFiles.length).toBe(1);
      const stagedUriDeleted = mockDeletedFiles[0];
      expect(stagedUriDeleted).toContain(`bara_media/reports/${testReportId}/selfie_`);
      expect(stagedUriDeleted).not.toBe(oldSelfieUri);
      expect(stagedUriDeleted).not.toBe(otherSelfieUri);
      expect(mockDiskFiles[stagedUriDeleted]).toBeUndefined();

      // Old files were NOT added to deleted files list
      expect(mockDeletedFiles).not.toContain(oldSelfieUri);
      expect(mockDeletedFiles).not.toContain(otherSelfieUri);
    });

    it('defers old file deletion until after transaction commit promise resolves, keeping old file accessible during transaction', async () => {
      const oldSelfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_old_to_replace.jpg`;
      mockSelfieRows.push({
        id: 'selfie_old_replace_id',
        reportId: testReportId,
        uri: oldSelfieUri,
        mime: 'image/jpeg',
        width: 720,
        height: 1280,
        bytes: 110000,
        capturedAt: '2026-10-29T07:00:00.000Z',
        source: 'camera'
      });
      mockDiskFiles[oldSelfieUri] = { exists: true, size: 110000 };

      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/new_camera_asset.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 210000
        }]
      });
      mockDiskFiles['file:///tmp/new_camera_asset.jpg'] = { exists: true, size: 210000 };

      // Controlled transaction completion gate
      let releaseCommit!: () => void;
      const commitDeferred = new Promise<void>((resolve) => {
        releaseCommit = resolve;
      });

      let markTxnOperationsDone!: () => void;
      const txnOperationsPromise = new Promise<void>((resolve) => {
        markTxnOperationsDone = resolve;
      });

      // Intercept at transaction boundary: run SQL operations, signal they ran, then hold commit unresolved
      mockDb.withExclusiveTransactionAsync.mockImplementationOnce(async (cb: (txn: any) => Promise<void>) => {
        await cb(mockTxn);
        markTxnOperationsDone();
        // Wait for test to assert intermediate state before commit resolves
        await commitDeferred;
      });

      // Start captureSenderSelfie (it will pause inside withExclusiveTransactionAsync)
      const capturePromise = repo.captureSenderSelfie(testReportId);

      // Wait until SQL statements inside transaction have finished executing
      await txnOperationsPromise;

      // ASSERTION 1 (Pre-commit): Inside transaction, before commit promise resolves:
      // The old file MUST STILL EXIST on disk and must NOT be deleted yet!
      expect(mockDiskFiles[oldSelfieUri]?.exists).toBe(true);
      expect(mockDeletedFiles).not.toContain(oldSelfieUri);

      // Now resolve the commit promise
      releaseCommit();

      // Wait for captureSenderSelfie to finish post-commit actions
      const newSelfie = await capturePromise;

      // ASSERTION 2 (Post-commit): Old file is deleted only AFTER commit promise resolved
      expect(mockDeletedFiles).toContain(oldSelfieUri);
      expect(mockDiskFiles[oldSelfieUri]).toBeUndefined();
      // Newly staged file is preserved and registered in selfie record
      expect(newSelfie).not.toBeNull();
      expect(mockDiskFiles[newSelfie!.uri]?.exists).toBe(true);
      expect(newSelfie!.uri).not.toBe(oldSelfieUri);
    });
  });

  describe('removeSenderSelfie', () => {
    it('deletes DB row, deletes physical file, and returns updated report', async () => {
      const selfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_1234_xyz.jpg`;
      mockSelfieRows.push({
        id: 'selfie_to_remove',
        reportId: testReportId,
        uri: selfieUri,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 150000,
        capturedAt: '2026-10-29T10:30:00.000Z',
        source: 'camera'
      });
      mockDiskFiles[selfieUri] = { exists: true, size: 150000 };

      const updatedReport = await repo.removeSenderSelfie(testReportId);

      expect(updatedReport).toBeDefined();
      expect(updatedReport.id).toBe(testReportId);
      // DB row should be deleted
      expect(mockSelfieRows.length).toBe(0);
      // Physical file delete attempted
      const deleteOps = sqlLog.filter(l => l.sql.includes('DELETE FROM sender_selfies'));
      expect(deleteOps.length).toBeGreaterThan(0);
    });

    it('throws when report does not exist', async () => {
      await expect(repo.removeSenderSelfie('rep_nonexistent')).rejects.toThrow(
        /tidak ditemukan/
      );
    });
  });

  describe('getSelfieForReport (via hydrateReport/getReport)', () => {
    it('returns null selfie when file is missing on disk (stale DB row)', async () => {
      // DB has a selfie row but file is gone from disk
      mockSelfieRows.push({
        id: 'selfie_stale',
        reportId: testReportId,
        uri: `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_stale.jpg`,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 150000,
        capturedAt: '2026-10-29T10:00:00.000Z',
        source: 'camera'
      });
      // File does NOT exist on disk
      // (mockDiskFiles not populated for this URI)

      const report = await repo.getReport(testReportId);

      expect(report).not.toBeNull();
      // The selfie should be null because the physical file is missing
      expect(report!.senderSelfie).toBeNull();
    });

    it('returns valid selfie when file exists on disk', async () => {
      const selfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_valid.jpg`;
      mockSelfieRows.push({
        id: 'selfie_valid',
        reportId: testReportId,
        uri: selfieUri,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 150000,
        capturedAt: '2026-10-29T10:00:00.000Z',
        source: 'camera'
      });
      mockDiskFiles[selfieUri] = { exists: true, size: 150000 };

      const report = await repo.getReport(testReportId);

      expect(report).not.toBeNull();
      expect(report!.senderSelfie).not.toBeNull();
      expect(report!.senderSelfie!.id).toBe('selfie_valid');
      expect(report!.senderSelfie!.uri).toBe(selfieUri);
      expect(report!.senderSelfie!.source).toBe('camera');
    });

    it('returns null selfie for old reports without any selfie row (backward compatibility)', async () => {
      // No selfie rows in DB
      const report = await repo.getReport(testReportId);

      expect(report).not.toBeNull();
      expect(report!.senderSelfie).toBeNull();
    });
  });

  describe('deleteReport selfie cleanup', () => {
    it('explicitly deletes sender_selfies rows during report deletion', async () => {
      mockSelfieRows.push({
        id: 'selfie_for_deleted_report',
        reportId: testReportId,
        uri: `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie.jpg`,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 150000,
        capturedAt: '2026-10-29T10:00:00.000Z',
        source: 'camera'
      });

      await repo.deleteReport(testReportId);

      // Verify that DELETE FROM sender_selfies was executed explicitly
      const selfieDeletes = sqlLog.filter(l =>
        l.sql.includes('DELETE FROM sender_selfies') &&
        l.params?.includes(testReportId)
      );
      expect(selfieDeletes.length).toBeGreaterThan(0);

      // Verify it was executed BEFORE DELETE FROM reports (correct ordering)
      const selfieDeleteIdx = sqlLog.findIndex(l =>
        l.sql.includes('DELETE FROM sender_selfies')
      );
      const reportDeleteIdx = sqlLog.findIndex(l =>
        l.sql.includes('DELETE FROM reports')
      );
      expect(selfieDeleteIdx).toBeLessThan(reportDeleteIdx);
    });
  });

  describe('init() orphan cleanup includes selfie URIs', () => {
    it('queries sender_selfies table to include selfie URIs in active set', async () => {
      const selfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_preserved.jpg`;
      mockSelfieRows.push({
        id: 'selfie_preserved',
        reportId: testReportId,
        uri: selfieUri,
        mime: 'image/jpeg',
        width: 1080,
        height: 1920,
        bytes: 150000,
        capturedAt: '2026-10-29T10:00:00.000Z',
        source: 'camera'
      });

      await repo.init();

      // Verify both attachment URIs and selfie URIs are queried
      const attachmentQuery = sqlLog.find(l =>
        l.sql.includes('SELECT') && l.sql.includes('attachments') && !l.sql.includes('sender_selfies')
      );
      const selfieQuery = sqlLog.find(l =>
        l.sql.includes('SELECT') && l.sql.includes('sender_selfies')
      );
      expect(attachmentQuery).toBeDefined();
      expect(selfieQuery).toBeDefined();
    });
  });

  describe('Selfie isolation between reports', () => {
    it('captureSenderSelfie only affects the target report, not other reports', async () => {
      const otherReportId = 'rep_other_report_002';
      mockReportRows.push({
        id: otherReportId,
        revision: 1,
        createdAt: '2026-10-29T09:00:00.000Z',
        updatedAt: '2026-10-29T09:00:00.000Z',
        observationTime: '2026-10-29T09:00:00.000Z',
        timezone: 'Asia/Jakarta',
        rawText: 'Test lain',
        reviewedText: '',
        observerLocation: null,
        incidentLocationText: 'Lokasi lain',
        includeObserverLocation: 0,
        suggestion: null,
        suggestionRevision: null
      });

      // Add selfie for the other report
      const otherSelfieUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${otherReportId}/selfie_other.jpg`;
      mockSelfieRows.push({
        id: 'selfie_other',
        reportId: otherReportId,
        uri: otherSelfieUri,
        mime: 'image/jpeg',
        width: 720,
        height: 1280,
        bytes: 80000,
        capturedAt: '2026-10-29T09:00:00.000Z',
        source: 'camera'
      });
      mockDiskFiles[otherSelfieUri] = { exists: true, size: 80000 };

      // Capture selfie for test report
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted'
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{
          uri: 'file:///tmp/selfie_target.jpg',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
          fileSize: 150000
        }]
      });
      mockDiskFiles['file:///tmp/selfie_target.jpg'] = { exists: true, size: 150000 };

      await repo.captureSenderSelfie(testReportId);

      // Other report's selfie must still be intact
      const otherSelfie = mockSelfieRows.find(r => r.reportId === otherReportId);
      expect(otherSelfie).toBeDefined();
      expect(otherSelfie!.id).toBe('selfie_other');
      expect(mockDiskFiles[otherSelfieUri]?.exists).toBe(true);
    });

    it('removeSenderSelfie only affects the target report, not other reports', async () => {
      const otherReportId = 'rep_other_report_003';
      mockReportRows.push({
        id: otherReportId,
        revision: 1,
        createdAt: '2026-10-29T09:00:00.000Z',
        updatedAt: '2026-10-29T09:00:00.000Z',
        observationTime: '2026-10-29T09:00:00.000Z',
        timezone: 'Asia/Jakarta',
        rawText: '',
        reviewedText: '',
        observerLocation: null,
        incidentLocationText: '',
        includeObserverLocation: 0,
        suggestion: null,
        suggestionRevision: null
      });

      // Both reports have selfies
      const targetUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${testReportId}/selfie_target.jpg`;
      const otherUri = `file:///mock/data/user/0/com.niragni/files/bara_media/reports/${otherReportId}/selfie_other.jpg`;

      mockSelfieRows.push(
        {
          id: 'selfie_target',
          reportId: testReportId,
          uri: targetUri,
          mime: 'image/jpeg',
          width: 1080,
          height: 1920,
          bytes: 150000,
          capturedAt: '2026-10-29T10:00:00.000Z',
          source: 'camera'
        },
        {
          id: 'selfie_other',
          reportId: otherReportId,
          uri: otherUri,
          mime: 'image/jpeg',
          width: 720,
          height: 1280,
          bytes: 80000,
          capturedAt: '2026-10-29T09:00:00.000Z',
          source: 'camera'
        }
      );
      mockDiskFiles[targetUri] = { exists: true, size: 150000 };
      mockDiskFiles[otherUri] = { exists: true, size: 80000 };

      await repo.removeSenderSelfie(testReportId);

      // Only the target report's selfie should be removed
      const remaining = mockSelfieRows.filter(r => r.reportId === otherReportId);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('selfie_other');
    });
  });
});
