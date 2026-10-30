/**
 * Meaningful regression tests for ModelManager.listModels().
 *
 * Verifies:
 * - Real ModelManager.listModels execution (no mocking the method under test).
 * - Exact metadata existence & size precedence over DB state.
 * - P3 Bug Regression: Files with correct size on disk but a recorded DB failure
 *   (failed or incompatible) must preserve their error message, status, and lastLocalCheck
 *   upon refresh/listModels — NEVER silently upgrading to 'installed'.
 * - Absence of files on disk strictly marks status as 'missing', overriding stale 'ready' in DB.
 * - File size mismatch strictly marks status as 'failed' with manifest mismatch error.
 * - Multi-candidate independence across SmolVLM2 and VisionPsy.
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
  DownloadResumable: jest.fn()
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn()
}));

jest.mock('../core/hasher', () => ({
  computeFileSha256: jest.fn().mockResolvedValue('mock-sha256')
}));

// Simulated on-disk filesystem state
const mockDiskFiles: Record<string, { exists: boolean; size: number }> = {};

jest.mock('expo-file-system', () => {
  return {
    Paths: {
      document: 'file:///mock/data/user/0/com.niragni/files'
    },
    Directory: class MockDirectory {
      uri: string;
      constructor(...parts: string[]) {
        this.uri = parts.join('/');
      }
    },
    File: class MockFile {
      uri: string;
      constructor(uri: string) {
        this.uri = uri;
      }
      get exists(): boolean {
        return mockDiskFiles[this.uri]?.exists ?? false;
      }
      get size(): number {
        return mockDiskFiles[this.uri]?.size ?? 0;
      }
    }
  };
});

// Simulated SQLite database rows
let mockDbRows: Array<{
  candidateId: string;
  name: string;
  status: string;
  downloadedBytes: number;
  totalBytes: number;
  requiredBytes: number;
  error: string | null;
  lastLocalCheck: string | null;
  modelPath: string | null;
  projectorPath: string | null;
  updatedAt: string;
}> = [];

jest.mock('../core/database', () => ({
  getDatabase: jest.fn().mockImplementation(async () => ({
    getAllAsync: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('model_states')) {
        return mockDbRows;
      }
      return [];
    })
  })),
  withWriteLock: jest.fn().mockImplementation(async (cb: (db: unknown) => Promise<unknown>) => cb({}))
}));

// Mock native worker dependency (never calls real native C++ / NDK runtime)
const mockWorker = {
  loadModel: jest.fn(),
  unloadModel: jest.fn(),
  completion: jest.fn(),
  cancel: jest.fn()
};

import { ModelManager } from '../core/models';
import { CANDIDATE_SMOLVLM2, CANDIDATE_VISIONPSY, CANDIDATES } from '../manifest';
import { QvacNativeWorker } from '../worker';

describe('ModelManager.listModels Status & Existence Precedence Regressions', () => {
  let manager: ModelManager;

  const smolvlm2ModelUri = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_SMOLVLM2.id}/${CANDIDATE_SMOLVLM2.modelFile.filename}`;
  const smolvlm2ProjUri = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_SMOLVLM2.id}/${CANDIDATE_SMOLVLM2.projectorFile.filename}`;
  const visionpsyModelUri = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_VISIONPSY.id}/${CANDIDATE_VISIONPSY.modelFile.filename}`;
  const visionpsyProjUri = `file:///mock/data/user/0/com.niragni/files/bara_models/${CANDIDATE_VISIONPSY.id}/${CANDIDATE_VISIONPSY.projectorFile.filename}`;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear in-memory disk and DB states
    for (const key of Object.keys(mockDiskFiles)) {
      delete mockDiskFiles[key];
    }
    mockDbRows = [];
    manager = new ModelManager(mockWorker as unknown as QvacNativeWorker);
  });

  describe('Metadata Existence & Size Precedence over DB States', () => {
    it('returns missing status when model and projector files are absent on disk, even if DB says ready', async () => {
      // Disk: files do not exist
      mockDiskFiles[smolvlm2ModelUri] = { exists: false, size: 0 };
      mockDiskFiles[smolvlm2ProjUri] = { exists: false, size: 0 };

      // DB: stale row claiming the model was ready
      mockDbRows = [
        {
          candidateId: CANDIDATE_SMOLVLM2.id,
          name: CANDIDATE_SMOLVLM2.name,
          status: 'ready',
          downloadedBytes: 545593888,
          totalBytes: 545593888,
          requiredBytes: 545593888,
          error: null,
          lastLocalCheck: '2026-10-29T08:00:00.000Z',
          modelPath: smolvlm2ModelUri,
          projectorPath: smolvlm2ProjUri,
          updatedAt: '2026-10-29T08:00:00.000Z'
        }
      ];

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      expect(smolState!.status).toBe('missing');
      expect(smolState!.downloadedBytes).toBe(0);
      expect(smolState!.lastLocalCheck).toBeUndefined();
    });

    it('returns missing status when only model file exists but projector file is missing', async () => {
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes
      };
      mockDiskFiles[smolvlm2ProjUri] = { exists: false, size: 0 };

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      expect(smolState!.status).toBe('missing');
      expect(smolState!.downloadedBytes).toBe(CANDIDATE_SMOLVLM2.modelFile.expectedBytes);
    });

    it('returns failed status when file size does not match expectedBytes, overriding DB ready state', async () => {
      // Partial or corrupt download size
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: 1024 // Wrong size
      };
      mockDiskFiles[smolvlm2ProjUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes
      };

      mockDbRows = [
        {
          candidateId: CANDIDATE_SMOLVLM2.id,
          name: CANDIDATE_SMOLVLM2.name,
          status: 'ready',
          downloadedBytes: 545593888,
          totalBytes: 545593888,
          requiredBytes: 545593888,
          error: null,
          lastLocalCheck: '2026-10-29T08:00:00.000Z',
          modelPath: smolvlm2ModelUri,
          projectorPath: smolvlm2ProjUri,
          updatedAt: '2026-10-29T08:00:00.000Z'
        }
      ];

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      expect(smolState!.status).toBe('failed');
      expect(smolState!.error).toBe('Ukuran berkas model di penyimpanan tidak cocok dengan manifest.');
      expect(smolState!.downloadedBytes).toBe(1024 + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes);
    });

    it('returns installed status when files exist with exact size but no record exists in DB', async () => {
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes
      };
      mockDiskFiles[smolvlm2ProjUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes
      };
      mockDbRows = [];

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      expect(smolState!.status).toBe('installed');
      const expectedTotal = CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes;
      expect(smolState!.downloadedBytes).toBe(expectedTotal);
      expect(smolState!.modelPath).toBe(smolvlm2ModelUri);
      expect(smolState!.projectorPath).toBe(smolvlm2ProjUri);
      expect(smolState!.error).toBeUndefined();
    });
  });

  describe('P3 Bug Regression: Preservation of Failed/Incompatible Errors with Right-Size Files', () => {
    it('preserves failed status, error message, and lastLocalCheck when files have correct size but DB recorded hash failure', async () => {
      // Both files exist on disk with 100% correct byte sizes
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes
      };
      mockDiskFiles[smolvlm2ProjUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes
      };

      const recordedError = 'Hash SHA-256 berkas model tidak cocok dengan manifest.';
      const recordedCheckTime = '2026-10-29T09:45:12.345Z';

      // DB recorded failure (e.g. from checkModel finding hash mismatch)
      mockDbRows = [
        {
          candidateId: CANDIDATE_SMOLVLM2.id,
          name: CANDIDATE_SMOLVLM2.name,
          status: 'failed',
          downloadedBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          totalBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          requiredBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          error: recordedError,
          lastLocalCheck: recordedCheckTime,
          modelPath: smolvlm2ModelUri,
          projectorPath: smolvlm2ProjUri,
          updatedAt: '2026-10-29T09:45:12.345Z'
        }
      ];

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      // MUST NOT silently upgrade to 'installed'!
      expect(smolState!.status).toBe('failed');
      expect(smolState!.error).toBe(recordedError);
      expect(smolState!.lastLocalCheck).toBe(recordedCheckTime);
    });

    it('preserves incompatible status and error when model fails device hardware/architecture compatibility', async () => {
      mockDiskFiles[visionpsyModelUri] = {
        exists: true,
        size: CANDIDATE_VISIONPSY.modelFile.expectedBytes
      };
      mockDiskFiles[visionpsyProjUri] = {
        exists: true,
        size: CANDIDATE_VISIONPSY.projectorFile.expectedBytes
      };

      const incompatError = 'Arsitektur model tidak didukung oleh runtime QVAC pada perangkat ini.';
      const incompatCheckTime = '2026-10-29T10:15:00.000Z';

      mockDbRows = [
        {
          candidateId: CANDIDATE_VISIONPSY.id,
          name: CANDIDATE_VISIONPSY.name,
          status: 'incompatible',
          downloadedBytes: CANDIDATE_VISIONPSY.modelFile.expectedBytes + CANDIDATE_VISIONPSY.projectorFile.expectedBytes,
          totalBytes: CANDIDATE_VISIONPSY.modelFile.expectedBytes + CANDIDATE_VISIONPSY.projectorFile.expectedBytes,
          requiredBytes: CANDIDATE_VISIONPSY.modelFile.expectedBytes + CANDIDATE_VISIONPSY.projectorFile.expectedBytes,
          error: incompatError,
          lastLocalCheck: incompatCheckTime,
          modelPath: visionpsyModelUri,
          projectorPath: visionpsyProjUri,
          updatedAt: '2026-10-29T10:15:00.000Z'
        }
      ];

      const states = await manager.listModels();
      const visionState = states.find((s) => s.candidateId === CANDIDATE_VISIONPSY.id);

      expect(visionState).toBeDefined();
      // MUST preserve incompatible status, NOT reset to 'installed'
      expect(visionState!.status).toBe('incompatible');
      expect(visionState!.error).toBe(incompatError);
      expect(visionState!.lastLocalCheck).toBe(incompatCheckTime);
    });

    it('preserves verified ready status and lastLocalCheck when files exist and DB confirms ready', async () => {
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes
      };
      mockDiskFiles[smolvlm2ProjUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes
      };

      const readyCheckTime = '2026-10-29T11:00:00.000Z';
      mockDbRows = [
        {
          candidateId: CANDIDATE_SMOLVLM2.id,
          name: CANDIDATE_SMOLVLM2.name,
          status: 'ready',
          downloadedBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          totalBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          requiredBytes: CANDIDATE_SMOLVLM2.modelFile.expectedBytes + CANDIDATE_SMOLVLM2.projectorFile.expectedBytes,
          error: null,
          lastLocalCheck: readyCheckTime,
          modelPath: smolvlm2ModelUri,
          projectorPath: smolvlm2ProjUri,
          updatedAt: '2026-10-29T11:00:00.000Z'
        }
      ];

      const states = await manager.listModels();
      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id);

      expect(smolState).toBeDefined();
      expect(smolState!.status).toBe('ready');
      expect(smolState!.lastLocalCheck).toBe(readyCheckTime);
      expect(smolState!.error).toBeUndefined();
    });
  });

  describe('Multi-Candidate Independence', () => {
    it('accurately reports states for all candidates simultaneously without cross-contamination', async () => {
      // Candidate 1: Ready with verified check
      mockDiskFiles[smolvlm2ModelUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.modelFile.expectedBytes
      };
      mockDiskFiles[smolvlm2ProjUri] = {
        exists: true,
        size: CANDIDATE_SMOLVLM2.projectorFile.expectedBytes
      };

      // Candidate 2: Missing entirely
      mockDiskFiles[visionpsyModelUri] = { exists: false, size: 0 };
      mockDiskFiles[visionpsyProjUri] = { exists: false, size: 0 };

      mockDbRows = [
        {
          candidateId: CANDIDATE_SMOLVLM2.id,
          name: CANDIDATE_SMOLVLM2.name,
          status: 'ready',
          downloadedBytes: 545593888,
          totalBytes: 545593888,
          requiredBytes: 545593888,
          error: null,
          lastLocalCheck: '2026-10-29T11:30:00.000Z',
          modelPath: smolvlm2ModelUri,
          projectorPath: smolvlm2ProjUri,
          updatedAt: '2026-10-29T11:30:00.000Z'
        }
      ];

      const states = await manager.listModels();
      expect(states.length).toBe(CANDIDATES.length);

      const smolState = states.find((s) => s.candidateId === CANDIDATE_SMOLVLM2.id)!;
      const visionState = states.find((s) => s.candidateId === CANDIDATE_VISIONPSY.id)!;

      expect(smolState.status).toBe('ready');
      expect(smolState.lastLocalCheck).toBe('2026-10-29T11:30:00.000Z');

      expect(visionState.status).toBe('missing');
      expect(visionState.downloadedBytes).toBe(0);
      expect(visionState.lastLocalCheck).toBeUndefined();
    });
  });
});
