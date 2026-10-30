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
let mockFailMoveFrom = '';
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
      move(dest: { uri: string }) {
        if (this.uri === mockFailMoveFrom) { mockFailMoveFrom = ''; throw new Error('disk move failed'); }
        if (!mockDiskFiles[this.uri]) throw new Error('source missing');
        mockDiskFiles[dest.uri] = mockDiskFiles[this.uri];
        delete mockDiskFiles[this.uri];
        this.uri = dest.uri;
      }
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


import { Paths } from 'expo-file-system';
import { computeFileSha256 } from '../core/hasher';
import { createDownloadResumable } from 'expo-file-system/legacy';
const candidate = CANDIDATE_SMOLVLM2;
const stagedModel = `${MODEL_URI}.partial`;
const stagedProj = `${PROJ_URI}.partial`;
function stagePair() {
  mockDiskFiles[stagedModel] = { exists: true, size: candidate.modelFile.expectedBytes };
  mockDiskFiles[stagedProj] = { exists: true, size: candidate.projectorFile.expectedBytes };
}
function goodHashes() {
  (computeFileSha256 as jest.Mock).mockImplementation(async (uri: string) =>
    uri.includes(candidate.projectorFile.filename) ? candidate.projectorFile.expectedSha256 : candidate.modelFile.expectedSha256);
}
describe('download verification recovery', () => {
  let lifecycle: LifecycleCoordinator;
  let manager: ModelManager;
  beforeEach(() => {
    jest.clearAllMocks();
    mockFailMoveFrom = '';
    (Paths as any).availableDiskSpace = 999 * 1024 * 1024 * 1024;
    Object.keys(mockDiskFiles).forEach(k => delete mockDiskFiles[k]);
    lifecycle = new LifecycleCoordinator();
    manager = new ModelManager(mockWorker as unknown as QvacNativeWorker, lifecycle);
    mockWorker.loadModel.mockResolvedValue(undefined);
    goodHashes();
  });
  afterEach(() => lifecycle.cleanup());
  it('discovers complete staged files after restart as needing verification, never ready', async () => {
    stagePair();
    const state = (await manager.listModels()).find(s => s.candidateId === candidate.id)!;
    expect(state.status).toBe('installed');
    expect(state.downloadedBytes).toBe(545593888);
  });
  it('checks complete staged files without any network transfer, hashes both then loads worker', async () => {
    stagePair();
    const result = await manager.checkModel(candidate.id);
    expect(result.status).toBe('ready');
    expect(createDownloadResumable).not.toHaveBeenCalled();
    expect(computeFileSha256).toHaveBeenCalledTimes(2);
    expect(mockWorker.loadModel).toHaveBeenCalledTimes(1);
    expect(mockDiskFiles[MODEL_URI]?.size).toBe(436808704);
  });
  it('retains complete staged files on background cancellation and retries after a new manager', async () => {
    stagePair();
    (computeFileSha256 as jest.Mock).mockImplementationOnce(async () => {
      await manager.cancelModelDownload();
      throw new Error('Komputasi hash dibatalkan.');
    });
    const result = await manager.downloadModel(candidate.id, () => {});
    expect(result.status).toBe('installed');
    expect(mockDiskFiles[stagedModel]?.size).toBe(436808704);
    expect(mockDiskFiles[stagedProj]?.size).toBe(108785184);
    expect(lifecycle.isBusy()).toBe(false);
    goodHashes();
    manager = new ModelManager(mockWorker as unknown as QvacNativeWorker, lifecycle);
    expect((await manager.checkModel(candidate.id)).status).toBe('ready');
    expect(createDownloadResumable).not.toHaveBeenCalled();
  });
  it('deletes checksum-invalid staging and leaves an older final pair intact', async () => {
    stagePair();
    mockDiskFiles[MODEL_URI] = { exists: true, size: 436808704 };
    mockDiskFiles[PROJ_URI] = { exists: true, size: 108785184 };
    (computeFileSha256 as jest.Mock).mockResolvedValue('wrong-hash');
    const result = await manager.downloadModel(candidate.id, () => {});
    expect(result.status).toBe('failed');
    expect(mockDiskFiles[stagedModel]).toBeUndefined();
    expect(mockDiskFiles[stagedProj]).toBeUndefined();
    expect(mockDiskFiles[MODEL_URI]?.size).toBe(436808704);
    expect(mockWorker.loadModel).not.toHaveBeenCalled();
  });
  it('cancellation never upgrades an untested final pair to ready', async () => {
    stagePair();
    mockDiskFiles[MODEL_URI] = { exists: true, size: 436808704 };
    mockDiskFiles[PROJ_URI] = { exists: true, size: 108785184 };
    (computeFileSha256 as jest.Mock).mockImplementationOnce(async () => {
      await manager.cancelModelDownload();
      throw new Error('cancelled');
    });
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('installed');
    expect(mockWorker.loadModel).not.toHaveBeenCalled();
  });
  it('publishes authoritative active state when revisiting during verification', async () => {
    stagePair();
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    (computeFileSha256 as jest.Mock).mockImplementationOnce(async () => { await wait; return candidate.modelFile.expectedSha256; });
    const op = manager.downloadModel(candidate.id, () => {});
    await Promise.resolve(); await Promise.resolve();
    const state = (await manager.listModels()).find(s => s.candidateId === candidate.id)!;
    release(); await op;
    expect(state.status).toBe('verifying');
    expect(lifecycle.isBusy()).toBe(false);
  });
  it.each([PROJ_URI, stagedProj])('restores BOTH older files when move fails at %s', async (path) => {
    stagePair();
    const oldModel = { exists: true, size: 436808704 };
    const oldProjector = { exists: true, size: 108785184 };
    mockDiskFiles[MODEL_URI] = oldModel;
    mockDiskFiles[PROJ_URI] = oldProjector;
    mockFailMoveFrom = path;
    const result = await manager.downloadModel(candidate.id, () => {});
    expect(result.status).toBe('failed');
    expect(mockDiskFiles[MODEL_URI]).toBe(oldModel);
    expect(mockDiskFiles[PROJ_URI]).toBe(oldProjector);
    expect(lifecycle.isBusy()).toBe(false);
  });
  it('does not publish ready if cancellation arrives during native load', async () => {
    stagePair();
    mockWorker.loadModel.mockImplementationOnce(async () => { await manager.cancelModelDownload(); });
    const result = await manager.downloadModel(candidate.id, () => {});
    expect(result.status).toBe('installed');
    expect(mockWorker.unloadModel).toHaveBeenCalled();
    expect(lifecycle.isBusy()).toBe(false);
  });

  it('verifies complete staging even when there is no space for another network copy', async () => {
    stagePair();
    (Paths as any).availableDiskSpace = 0;
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('ready');
    expect(createDownloadResumable).not.toHaveBeenCalled();
  });
  it('rejects a new transfer on a full disk without touching an existing pair', async () => {
    (Paths as any).availableDiskSpace = 0;
    mockDiskFiles[MODEL_URI] = { exists: true, size: 436808704 };
    mockDiskFiles[PROJ_URI] = { exists: true, size: 108785184 };
    const state = await manager.downloadModel(candidate.id, () => {});
    expect(state.status).toBe('failed');
    expect(state.error).toContain('Ruang penyimpanan');
    expect(createDownloadResumable).not.toHaveBeenCalled();
    expect(mockDiskFiles[MODEL_URI]?.size).toBe(436808704);
  });
  it('downloads only an incomplete projector and still hashes both files', async () => {
    stagePair();
    mockDiskFiles[stagedProj].size = 123;
    (createDownloadResumable as jest.Mock).mockImplementation((_url, path) => ({
      downloadAsync: async () => {
        mockDiskFiles[path] = { exists: true, size: 108785184 };
        return { status: 200 };
      },
    }));
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('ready');
    expect(createDownloadResumable).toHaveBeenCalledTimes(1);
    expect((createDownloadResumable as jest.Mock).mock.calls[0][1]).toBe(stagedProj);
    expect(computeFileSha256).toHaveBeenCalledTimes(2);
  });
  it('does not call a failed native load ready', async () => {
    stagePair();
    mockWorker.loadModel.mockRejectedValueOnce(new Error('native load failed'));
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('incompatible');
    expect(lifecycle.isBusy()).toBe(false);
  });

  it('reports verification bytes separately from transfer bytes', async () => {
    stagePair();
    const progress: ModelState[] = [];
    (computeFileSha256 as jest.Mock).mockImplementation(async (uri, options) => {
      if (uri.includes(candidate.projectorFile.filename)) {
        options?.onProgress?.(108785184, 108785184);
        return candidate.projectorFile.expectedSha256;
      }
      options?.onProgress?.(436808704, 436808704);
      return candidate.modelFile.expectedSha256;
    });
    await manager.downloadModel(candidate.id, state => progress.push(state));
    expect(progress.some(state => state.status === 'verifying' && (state as any).verifiedBytes === 545593888)).toBe(true);
  });

  it('retains the fully hashed staging pair when second promotion fails so retry needs no transfer', async () => {
    stagePair();
    mockFailMoveFrom = stagedProj;
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('failed');
    expect(mockDiskFiles[stagedModel]?.size).toBe(436808704);
    expect(mockDiskFiles[stagedProj]?.size).toBe(108785184);
    expect((await manager.downloadModel(candidate.id, () => {})).status).toBe('ready');
    expect(createDownloadResumable).not.toHaveBeenCalled();
  });

  it('honors cancellation during the native load of an imported pair', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock)
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'content://model' }] })
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'content://projector' }] });
    mockCopySourceToPrivate.mockImplementation(async (_source, dest) => {
      mockDiskFiles[dest] = { exists: true, size: dest.includes(candidate.projectorFile.filename) ? 108785184 : 436808704 };
    });
    mockWorker.loadModel.mockImplementationOnce(async () => { await manager.cancelModelDownload(); });
    const progress: ModelState[] = [];
    await expect(manager.importModel(candidate.id, state => progress.push(state))).rejects.toThrow('dibatalkan');
    expect(progress[progress.length - 1].status).toBe('installed');
    expect(mockWorker.unloadModel).toHaveBeenCalled();
    expect(lifecycle.isBusy()).toBe(false);
  });

});
