/**
 * Regression tests for Bug 2: Failed/cancelled import leaves UI stuck at "Mengunduh 0%"
 * and lifecycle lock is not released properly.
 *
 * Evidence: device-qa-2026-10-30 report bug #2
 * "Source menerbitkan 'downloading', sedangkan finally hanya melepas lock/controller,
 *  tanpa memulihkan state progres pada error."
 *
 * Fix: importModel now has a catch block that:
 *   (a) publishes a terminal ModelState (missing/installed/failed) via onProgress
 *   (b) releases the lifecycle lock via finally (unchanged)
 *   (c) preserves a prior valid pair if one exists at the expected paths
 *
 * Tests cover:
 *   1. SAF copy failure → state becomes 'failed', onProgress called with honest state
 *   2. User cancellation → state becomes 'missing' (no prior pair)
 *   3. User cancellation → state becomes 'installed' (prior pair preserved)
 *   4. Lifecycle lock IS released after import failure (no lock leak)
 *   5. Lifecycle lock IS released after cancellation
 *   6. Prior valid pair files are NOT deleted on error/cancel
 */

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  }
}));

jest.mock('@qvac/sdk', () => ({
  loadModel: jest.fn(),
  completion: jest.fn(),
  unloadModel: jest.fn(),
  cancel: jest.fn()
}));

jest.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: jest.fn(),
  copyAsync: jest.fn(),
}));

jest.mock('../core/hasher', () => ({
  computeFileSha256: jest.fn().mockResolvedValue('mock-sha256')
}));

// Track simulated disk files
const mockDiskFiles: Record<string, { exists: boolean; size: number }> = {};

jest.mock('expo-file-system', () => {
  return {
    Paths: {
      document: 'file:///mock/data/user/0/com.niragni/files',
      availableDiskSpace: 999 * 1024 * 1024 * 1024, // 999 GB
    },
    Directory: class MockDirectory {
      uri: string;
      exists = true;
      constructor(...parts: string[]) { this.uri = parts.join('/'); }
      create() {}
    },
    File: class MockFile {
      uri: string;
      constructor(uri: string) { this.uri = uri; }
      get exists(): boolean { return mockDiskFiles[this.uri]?.exists ?? false; }
      get size(): number { return mockDiskFiles[this.uri]?.size ?? 0; }
      copy() { throw new Error('This method cannot be used with content URIs: content://test'); }
      delete() { delete mockDiskFiles[this.uri]; }
      move() {}
    }
  };
});

// Mock safCopy — we control whether copy succeeds or fails
const mockCopySourceToPrivate = jest.fn();
jest.mock('../core/safCopy', () => ({
  isContentUri: jest.fn().mockReturnValue(true),
  copySourceToPrivate: mockCopySourceToPrivate,
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

const mockDbRows: Array<Record<string, unknown>> = [];
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });
jest.mock('../core/database', () => ({
  getDatabase: jest.fn().mockImplementation(async () => ({
    getAllAsync: jest.fn().mockResolvedValue(mockDbRows),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: mockRunAsync,
  })),
  withWriteLock: jest.fn().mockImplementation(async (cb: (db: unknown) => Promise<unknown>) => {
    const db = {
      runAsync: mockRunAsync,
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      withExclusiveTransactionAsync: jest.fn().mockImplementation(async (fn: (txn: unknown) => Promise<void>) => {
        await fn({ runAsync: mockRunAsync, getFirstAsync: jest.fn().mockResolvedValue(null) });
      }),
    };
    return cb(db);
  }),
}));

import * as DocumentPicker from 'expo-document-picker';
import { ModelManager } from '../core/models';
import { CANDIDATE_SMOLVLM2 } from '../manifest';
import { computeFileSha256 } from '../core/hasher';
import { QvacNativeWorker } from '../worker';
import { LifecycleCoordinator } from '../core/lifecycle';
import type { ModelState } from '../product-contract';

const mockWorker = {
  loadModel: jest.fn(),
  unloadModel: jest.fn().mockResolvedValue(undefined),
  completion: jest.fn(),
  cancel: jest.fn(),
  getLoadedCandidateId: jest.fn().mockReturnValue(null),
  isModelLoaded: jest.fn().mockReturnValue(false),
};

const MODEL_URI = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_SMOLVLM2.id}/${CANDIDATE_SMOLVLM2.modelFile.filename}`;
const PROJ_URI = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_SMOLVLM2.id}/${CANDIDATE_SMOLVLM2.projectorFile.filename}`;

function makePickResult(uri: string) {
  return {
    canceled: false,
    assets: [{ uri, name: 'model.gguf', size: 436808704, mimeType: 'application/octet-stream' }],
  };
}

describe('importModel — terminal state on failure/cancellation (Bug 2)', () => {
  let manager: ModelManager;
  let lifecycle: LifecycleCoordinator;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockDiskFiles)) delete mockDiskFiles[k];
    lifecycle = new LifecycleCoordinator();
    manager = new ModelManager(mockWorker as unknown as QvacNativeWorker, lifecycle);
  });

  afterEach(() => {
    lifecycle.cleanup();
  });

  describe('SAF copy failure (no prior pair)', () => {
    beforeEach(() => {
      (DocumentPicker.getDocumentAsync as jest.Mock)
        .mockResolvedValueOnce(makePickResult('content://com.android.providers.downloads.documents/document/msf%3A1000308073'))
        .mockResolvedValueOnce(makePickResult('content://com.android.providers.downloads.documents/document/msf%3A1000308074'));
      mockCopySourceToPrivate.mockRejectedValue(
        new Error('This method cannot be used with content URIs: content://...')
      );
    });

    it('does not stay stuck at downloading — terminal onProgress called with failed state', async () => {
      const progressStates: ModelState[] = [];
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, (s) => progressStates.push(s)))
        .rejects.toThrow('content URIs');

      // First progress call: downloading (emitted before copy)
      expect(progressStates[0].status).toBe('downloading');
      // Last progress call: failed (terminal state after copy error)
      const lastState = progressStates[progressStates.length - 1];
      expect(lastState.status).toBe('failed');
      expect(lastState.downloadedBytes).toBe(0);
      expect(lastState.error).toContain('Impor gagal');

      // Rejection reaches the screen catch handler; it must not run success reload.
    });

    it('releases lifecycle lock after failure so next import can proceed', async () => {
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, () => {})).rejects.toThrow();
      // If lock were leaked, this acquire would throw
      expect(() => lifecycle.acquire('importing')).not.toThrow();
    });
  });

  describe('User cancellation (no prior pair)', () => {
    beforeEach(() => {
      (DocumentPicker.getDocumentAsync as jest.Mock)
        .mockResolvedValueOnce({ canceled: true, assets: null });
    });

    it('terminal state is missing (no prior pair), not downloading', async () => {
      const progressStates: ModelState[] = [];
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, (s) => progressStates.push(s)))
        .rejects.toThrow('dibatalkan');

      const lastState = progressStates[progressStates.length - 1];
      expect(lastState.status).toBe('missing');
      expect(lastState.downloadedBytes).toBe(0);
    });

    it('lifecycle lock is released after cancellation', async () => {
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, () => {})).rejects.toThrow();
      expect(() => lifecycle.acquire('checking')).not.toThrow();
    });
  });

  describe('User cancellation with prior valid pair on disk', () => {
    beforeEach(() => {
      // Simulate a previously imported valid pair already on disk
      mockDiskFiles[MODEL_URI] = { exists: true, size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes };
      mockDiskFiles[PROJ_URI] = { exists: true, size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes };

      (DocumentPicker.getDocumentAsync as jest.Mock)
        .mockResolvedValueOnce({ canceled: true, assets: null });
    });

    it('prior pair preserved — terminal state is installed (not missing)', async () => {
      const progressStates: ModelState[] = [];
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, (s) => progressStates.push(s)))
        .rejects.toThrow('dibatalkan');

      const lastState = progressStates[progressStates.length - 1];
      // When cancelling with prior valid pair, state must be 'installed' (not 'missing')
      expect(lastState.status).toBe('installed');
    });

    it('prior pair files are NOT deleted on cancellation', async () => {
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, () => {})).rejects.toThrow();
      // Verify prior pair files still exist
      expect(mockDiskFiles[MODEL_URI]?.exists).toBe(true);
      expect(mockDiskFiles[PROJ_URI]?.exists).toBe(true);
    });
  });

  describe('Copy failure with prior valid pair', () => {
    beforeEach(() => {
      mockDiskFiles[MODEL_URI] = { exists: true, size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes };
      mockDiskFiles[PROJ_URI] = { exists: true, size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes };

      (DocumentPicker.getDocumentAsync as jest.Mock)
        .mockResolvedValueOnce(makePickResult('content://provider/model'))
        .mockResolvedValueOnce(makePickResult('content://provider/proj'));
      mockCopySourceToPrivate.mockRejectedValue(new Error('SAF copy error'));
    });

    it('prior pair files survive a copy error — valid pair is preserved', async () => {
      await expect(manager.importModel(CANDIDATE_SMOLVLM2.id, () => {})).rejects.toThrow('SAF copy error');
      expect(mockDiskFiles[MODEL_URI]?.exists).toBe(true);
      expect(mockDiskFiles[PROJ_URI]?.exists).toBe(true);
    });
  });
  it('retains authoritative import progress when a focused screen polls listModels', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock)
      .mockResolvedValueOnce(makePickResult('content://provider/model'))
      .mockResolvedValueOnce(makePickResult('content://provider/proj'));
    let failCopy!: (error: Error) => void;
    mockCopySourceToPrivate.mockImplementationOnce(() => new Promise((_resolve, reject) => { failCopy = reject; }));
    const op = manager.importModel(CANDIDATE_SMOLVLM2.id, () => {});
    for (let i = 0; i < 20; i++) await Promise.resolve();
    const state = (await manager.listModels()).find(row => row.candidateId === CANDIDATE_SMOLVLM2.id)!;
    failCopy(new Error('copy interrupted'));
    await expect(op).rejects.toThrow('copy interrupted');
    expect(state.status).toBe('downloading');
    expect(lifecycle.isBusy()).toBe(false);
  });

  it('reports verification bytes during importModel SHA-256 hashing', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock)
      .mockResolvedValueOnce(makePickResult('content://provider/model'))
      .mockResolvedValueOnce(makePickResult('content://provider/proj'));
    mockCopySourceToPrivate.mockResolvedValue(undefined);

    const progress: ModelState[] = [];
    (computeFileSha256 as jest.Mock).mockImplementation(async (uri, options) => {
      if (uri.includes(CANDIDATE_SMOLVLM2.projectorFile.filename)) {
        options?.onProgress?.(CANDIDATE_SMOLVLM2.projectorFile.expectedBytes, CANDIDATE_SMOLVLM2.projectorFile.expectedBytes);
        return CANDIDATE_SMOLVLM2.projectorFile.expectedSha256;
      }
      options?.onProgress?.(CANDIDATE_SMOLVLM2.modelFile.expectedBytes, CANDIDATE_SMOLVLM2.modelFile.expectedBytes);
      return CANDIDATE_SMOLVLM2.modelFile.expectedSha256;
    });

    await manager.importModel(CANDIDATE_SMOLVLM2.id, (s) => progress.push(s));

    expect(progress.some(state => state.status === 'verifying' && state.verifiedBytes === 545593888)).toBe(true);
  });

});
