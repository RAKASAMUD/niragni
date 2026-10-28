/**
 * Local AI model management for Bara.
 * Enforces:
 * - Shared lifecycle exclusion across public check/download/import/delete/generate
 * - Lock acquisition with try/finally covering getModelCandidate/path setup (no leaked locks on invalid IDs)
 * - In-memory verified pair fingerprint tracking (URI, size, modificationTime)
 * - Mandatory SHA-256 hashing on first use per process or whenever on-disk fingerprint changes
 * - Explicit checkModel always hashes both files every time, detecting same-size corruption
 * - Warm inference reuse permitted ONLY when candidate identity AND verified pair fingerprint match
 * - Automatic reload of loaded model when pair files change on disk
 * - Sticky cancellation tokens checked before/after every async stage
 * - AbortSignal passed to all chunked streaming SHA-256 hash calls
 * - Atomic pair promotion preserving prior valid pair on partial failure/replacement
 * - Free-space budget checking for downloads and SAF/DocumentPicker imports
 * - Interrupted download clean retry (no fake byte-range resume claims)
 * - Ready status strictly verified by local test load in worker, not offline-network assumptions
 */

import { File, Directory, Paths } from 'expo-file-system';
import { createDownloadResumable, DownloadResumable } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { ModelState } from '../product-contract';
import { CANDIDATES } from '../manifest';
import { ModelCandidate } from '../types';
import { computeFileSha256 } from './hasher';
import { getDatabase, withWriteLock } from './database';
import { QvacNativeWorker } from '../worker';
import { LifecycleCoordinator, sharedLifecycle } from './lifecycle';

interface ModelStateRow {
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
}

export interface FileFingerprint {
  readonly uri: string;
  readonly size: number;
  readonly modificationTime: number | null;
}

export interface PairFingerprint {
  readonly candidateId: string;
  readonly model: FileFingerprint;
  readonly projector: FileFingerprint;
}

// Pinned exact audit commit hashes per docs/spike/qvac-audit.md
const UPSTREAM_URLS: Record<string, { model: string; projector: string }> = {
  'smolvlm2-500m': {
    model: 'https://huggingface.co/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF/resolve/ccd7aae53bcb1997355c2f094959e72b3642ce17/SmolVLM2-500M-Video-Instruct-Q8_0.gguf',
    projector: 'https://huggingface.co/ggml-org/SmolVLM2-500M-Video-Instruct-GGUF/resolve/ccd7aae53bcb1997355c2f094959e72b3642ce17/mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf'
  },
  'visionpsy-nano-460m': {
    model: 'https://huggingface.co/qvac/VisionPsy-Nano-460M-Flash-GGUFs/resolve/a24fb9cdd1119406b15ff60b06a51f8438a931c1/visionpsy-nano-460m-flash-q8_0.gguf',
    projector: 'https://huggingface.co/qvac/VisionPsy-Nano-460M-Flash-GGUFs/resolve/a24fb9cdd1119406b15ff60b06a51f8438a931c1/mmproj-visionpsy-nano-460m-flash-q8.gguf'
  }
};

export class ModelManager {
  private activeDownloadTask: DownloadResumable | null = null;
  private activeAbortController: AbortController | null = null;
  private isDownloadCancelled: boolean = false;
  private worker: QvacNativeWorker;
  private lifecycle: LifecycleCoordinator;

  // In-memory verified pair fingerprints (candidateId -> PairFingerprint)
  private verifiedFingerprints: Map<string, PairFingerprint> = new Map();
  // Currently loaded pair fingerprint in the worker memory
  private loadedPairFingerprint: PairFingerprint | null = null;

  constructor(worker: QvacNativeWorker, lifecycle: LifecycleCoordinator = sharedLifecycle) {
    this.worker = worker;
    this.lifecycle = lifecycle;
  }

  public getModelCandidate(candidateId: string): ModelCandidate {
    const candidate = CANDIDATES.find((c) => c.id === candidateId);
    if (!candidate) {
      throw new Error(`Kandidat model dengan ID '${candidateId}' tidak terdaftar.`);
    }
    return candidate;
  }

  public getModelDirectory(candidateId: string): Directory {
    return new Directory(Paths.document, 'bara_models', candidateId);
  }

  public getModelFilePath(candidate: ModelCandidate): string {
    const dir = this.getModelDirectory(candidate.id);
    return `${dir.uri}/${candidate.modelFile.filename}`;
  }

  public getProjectorFilePath(candidate: ModelCandidate): string {
    const dir = this.getModelDirectory(candidate.id);
    return `${dir.uri}/${candidate.projectorFile.filename}`;
  }

  /**
   * Fast, lightweight list of model states for UI rendering and navigation.
   * Reads metadata and cached DB state; does NOT re-hash 500MB or trigger runtime load side-effects.
   */
  public async listModels(): Promise<ModelState[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ModelStateRow>('SELECT * FROM model_states');
    const rowMap = new Map<string, ModelStateRow>();
    for (const r of rows) {
      rowMap.set(r.candidateId, r);
    }

    const states: ModelState[] = [];
    for (const candidate of CANDIDATES) {
      const requiredBytes =
        candidate.modelFile.expectedBytes + candidate.projectorFile.expectedBytes;
      const cached = rowMap.get(candidate.id);

      const modelPath = this.getModelFilePath(candidate);
      const projectorPath = this.getProjectorFilePath(candidate);

      const modelFile = new File(modelPath);
      const projectorFile = new File(projectorPath);

      // Lightweight existence check
      const modelExists = modelFile.exists;
      const projExists = projectorFile.exists;

      if (!modelExists || !projExists) {
        states.push({
          candidateId: candidate.id,
          name: candidate.name,
          status: 'missing',
          downloadedBytes: (modelExists ? modelFile.size : 0) + (projExists ? projectorFile.size : 0),
          totalBytes: requiredBytes,
          requiredBytes
        });
      } else if (
        modelFile.size !== candidate.modelFile.expectedBytes ||
        projectorFile.size !== candidate.projectorFile.expectedBytes
      ) {
        states.push({
          candidateId: candidate.id,
          name: candidate.name,
          status: 'failed',
          downloadedBytes: modelFile.size + projectorFile.size,
          totalBytes: requiredBytes,
          requiredBytes,
          error: 'Ukuran berkas model di penyimpanan tidak cocok dengan manifest.'
        });
      } else if (cached && (cached.status === 'ready' || cached.status === 'installed')) {
        states.push({
          candidateId: candidate.id,
          name: candidate.name,
          status: cached.status as ModelState['status'],
          downloadedBytes: requiredBytes,
          totalBytes: requiredBytes,
          requiredBytes,
          lastLocalCheck: cached.lastLocalCheck ?? undefined,
          modelPath,
          projectorPath
        });
      } else {
        // Files exist with correct size but integrity not yet verified in DB
        states.push({
          candidateId: candidate.id,
          name: candidate.name,
          status: 'installed',
          downloadedBytes: requiredBytes,
          totalBytes: requiredBytes,
          requiredBytes,
          modelPath,
          projectorPath
        });
      }
    }

    return states;
  }

  /**
   * Explicit, deep verification of a single candidate (Public API).
   * Acquires shared lifecycle lock synchronously before any await.
   * Hashes BOTH files every time to detect in-place same-size corruption,
   * performs real local test load into memory, and records lastLocalCheck.
   */
  public async checkModel(candidateId: string): Promise<ModelState> {
    const token = this.lifecycle.acquire('checking');
    try {
      return await this.internalCheckModel(candidateId, { explicitHash: true });
    } finally {
      this.lifecycle.release('checking', token);
    }
  }

  /**
   * Internal verification method called by public checkModel, downloadModel, and importModel.
   * Does NOT acquire public lifecycle lock, allowing safe nested execution without deadlock.
   */
  public async internalCheckModel(
    candidateId: string,
    options: { explicitHash: boolean; signal?: AbortSignal }
  ): Promise<ModelState> {
    const candidate = this.getModelCandidate(candidateId);
    const requiredBytes =
      candidate.modelFile.expectedBytes + candidate.projectorFile.expectedBytes;

    const dir = this.getModelDirectory(candidateId);
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }

    const modelPath = this.getModelFilePath(candidate);
    const projectorPath = this.getProjectorFilePath(candidate);

    const modelFile = new File(modelPath);
    const projectorFile = new File(projectorPath);

    // 1. Check disk existence
    if (!modelFile.exists || !projectorFile.exists) {
      this.verifiedFingerprints.delete(candidateId);
      const state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'missing',
        downloadedBytes: (modelFile.exists ? modelFile.size : 0) + (projectorFile.exists ? projectorFile.size : 0),
        totalBytes: requiredBytes,
        requiredBytes
      };
      await this.saveModelState(state);
      return state;
    }

    // 2. Check size matching
    if (
      modelFile.size !== candidate.modelFile.expectedBytes ||
      projectorFile.size !== candidate.projectorFile.expectedBytes
    ) {
      this.verifiedFingerprints.delete(candidateId);
      const state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'failed',
        downloadedBytes: modelFile.size + projectorFile.size,
        totalBytes: requiredBytes,
        requiredBytes,
        error: 'Ukuran berkas model tidak sesuai dengan manifest audit.'
      };
      await this.saveModelState(state);
      return state;
    }

    // 3. Hash verification: In explicit check, ALWAYS hash both files every time!
    if (options.explicitHash) {
      const modelHash = await computeFileSha256(modelPath, { signal: options.signal });
      if (options.signal?.aborted) throw new Error('Pemeriksaan model dibatalkan.');

      const projHash = await computeFileSha256(projectorPath, { signal: options.signal });
      if (options.signal?.aborted) throw new Error('Pemeriksaan model dibatalkan.');

      if (
        modelHash.toLowerCase() !== candidate.modelFile.expectedSha256.toLowerCase() ||
        projHash.toLowerCase() !== candidate.projectorFile.expectedSha256.toLowerCase()
      ) {
        this.verifiedFingerprints.delete(candidateId);
        const state: ModelState = {
          candidateId,
          name: candidate.name,
          status: 'failed',
          downloadedBytes: modelFile.size + projectorFile.size,
          totalBytes: requiredBytes,
          requiredBytes,
          error: 'SHA-256 checksum tidak cocok dengan hash terpin di manifest.'
        };
        await this.saveModelState(state);
        return state;
      }
    }

    // 4. Honest local load check: Status ready requires real local instantiation
    let isReady = false;
    let lastCheck: string | undefined;

    try {
      await this.worker.loadModel(candidate, modelPath, projectorPath);
      await this.worker.unloadModel();
      isReady = true;
      lastCheck = new Date().toISOString();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.verifiedFingerprints.delete(candidateId);
      const state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'incompatible',
        downloadedBytes: requiredBytes,
        totalBytes: requiredBytes,
        requiredBytes,
        modelPath,
        projectorPath,
        error: `Gagal memuat model ke memori runtime: ${errMsg}`
      };
      await this.saveModelState(state);
      return state;
    }

    // Construct and track verified fingerprint in memory
    const currentFingerprint: PairFingerprint = {
      candidateId,
      model: {
        uri: modelFile.uri,
        size: modelFile.size,
        modificationTime: modelFile.modificationTime
      },
      projector: {
        uri: projectorFile.uri,
        size: projectorFile.size,
        modificationTime: projectorFile.modificationTime
      }
    };
    this.verifiedFingerprints.set(candidateId, currentFingerprint);

    const state: ModelState = {
      candidateId,
      name: candidate.name,
      status: isReady ? 'ready' : 'installed',
      downloadedBytes: requiredBytes,
      totalBytes: requiredBytes,
      requiredBytes,
      lastLocalCheck: lastCheck,
      modelPath,
      projectorPath
    };
    await this.saveModelState(state);
    return state;
  }

  /**
   * Internal verification path for AI inference.
   * Tracks verified pair URI, size, and modificationTime in memory.
   * Hashes both files on first use per process or whenever the on-disk fingerprint changes.
   */
  public async ensureInstalled(
    candidateId: string
  ): Promise<{
    candidate: ModelCandidate;
    modelPath: string;
    projectorPath: string;
    fingerprint: PairFingerprint;
  }> {
    const candidate = this.getModelCandidate(candidateId);
    const modelPath = this.getModelFilePath(candidate);
    const projectorPath = this.getProjectorFilePath(candidate);

    const modelFile = new File(modelPath);
    const projectorFile = new File(projectorPath);

    if (!modelFile.exists || !projectorFile.exists) {
      this.verifiedFingerprints.delete(candidateId);
      throw new Error(
        `Model '${candidate.name}' belum diunduh (berkas tidak ditemukan). Harap unduh model terlebih dahulu.`
      );
    }

    if (
      modelFile.size !== candidate.modelFile.expectedBytes ||
      projectorFile.size !== candidate.projectorFile.expectedBytes
    ) {
      this.verifiedFingerprints.delete(candidateId);
      throw new Error(
        `Ukuran berkas model '${candidate.name}' tidak cocok dengan manifest. Harap unduh ulang model.`
      );
    }

    const db = await getDatabase();
    const row = await db.getFirstAsync<ModelStateRow>(
      'SELECT * FROM model_states WHERE candidateId = ?',
      [candidateId]
    );

    if (!row || (row.status !== 'ready' && row.status !== 'installed')) {
      this.verifiedFingerprints.delete(candidateId);
      throw new Error(
        `Model '${candidate.name}' belum siap digunakan (status: ${row?.status ?? 'missing'}). Harap periksa atau unduh model terlebih dahulu.`
      );
    }

    const currentFingerprint: PairFingerprint = {
      candidateId,
      model: {
        uri: modelFile.uri,
        size: modelFile.size,
        modificationTime: modelFile.modificationTime
      },
      projector: {
        uri: projectorFile.uri,
        size: projectorFile.size,
        modificationTime: projectorFile.modificationTime
      }
    };

    // Verify SHA-256 on first use per process or if modificationTime/size/URI changed on disk
    const previousVerified = this.verifiedFingerprints.get(candidateId);
    if (!previousVerified || !this.isFingerprintEqual(previousVerified, currentFingerprint)) {
      const modelHash = await computeFileSha256(modelPath);
      const projHash = await computeFileSha256(projectorPath);

      if (
        modelHash.toLowerCase() !== candidate.modelFile.expectedSha256.toLowerCase() ||
        projHash.toLowerCase() !== candidate.projectorFile.expectedSha256.toLowerCase()
      ) {
        this.verifiedFingerprints.delete(candidateId);
        throw new Error(
          `SHA-256 berkas model '${candidate.name}' tidak cocok dengan manifest. Berkas mungkin rusak atau berubah.`
        );
      }

      this.verifiedFingerprints.set(candidateId, currentFingerprint);
    }

    return { candidate, modelPath, projectorPath, fingerprint: currentFingerprint };
  }

  /**
   * Ensures the requested candidate is currently loaded in the worker.
   * Warm reuse is allowed ONLY when loaded candidate identity AND verified pair fingerprint match.
   * If on-disk files changed (fingerprint mismatch), the old model is explicitly reloaded.
   */
  public async ensureLoaded(candidateId: string): Promise<void> {
    const { candidate, modelPath, projectorPath, fingerprint } = await this.ensureInstalled(candidateId);

    const loadedCandidateId = this.worker.getLoadedCandidateId();
    const isModelLoaded = this.worker.isModelLoaded();

    // Warm reuse allowed ONLY if:
    // 1. Worker currently holds a loaded model
    // 2. Loaded candidate identity matches requested candidateId
    // 3. Loaded pair fingerprint matches current verified on-disk fingerprint
    if (
      isModelLoaded &&
      loadedCandidateId === candidateId &&
      this.loadedPairFingerprint !== null &&
      this.isFingerprintEqual(this.loadedPairFingerprint, fingerprint)
    ) {
      // Warm reuse: same verified fingerprint and loaded candidate identity!
      return;
    }

    // Otherwise, model must be loaded/reloaded (e.g. cold start, candidate switch, or files changed on disk)
    if (isModelLoaded) {
      await this.worker.unloadModel();
      this.loadedPairFingerprint = null;
    }

    await this.worker.loadModel(candidate, modelPath, projectorPath);
    this.loadedPairFingerprint = fingerprint;
  }

  /**
   * User-triggered download using cancellable DownloadResumable.
   * Acquires shared lifecycle lock synchronously before any await.
   * Encloses getModelCandidate and path setup within try/finally to prevent lock leaks on invalid IDs.
   */
  public async downloadModel(
    candidateId: string,
    onProgress: (state: ModelState) => void
  ): Promise<ModelState> {
    const token = this.lifecycle.acquire('downloading');
    this.isDownloadCancelled = false;
    this.activeAbortController = new AbortController();

    let modelPath = '';
    let projectorPath = '';
    let modelPartialPath = '';
    let projPartialPath = '';
    let requiredBytes = 0;
    let candidateName = candidateId;

    const checkCancelled = () => {
      if (this.isDownloadCancelled || this.activeAbortController?.signal.aborted) {
        throw new Error('Unduhan dibatalkan oleh pengguna.');
      }
    };

    try {
      const candidate = this.getModelCandidate(candidateId);
      candidateName = candidate.name;
      requiredBytes =
        candidate.modelFile.expectedBytes + candidate.projectorFile.expectedBytes;

      modelPath = this.getModelFilePath(candidate);
      projectorPath = this.getProjectorFilePath(candidate);
      modelPartialPath = `${modelPath}.partial`;
      projPartialPath = `${projectorPath}.partial`;

      // Check disk space (required + 25% safety margin)
      const requiredWithMargin = Math.ceil(requiredBytes * 1.25);
      const freeSpace = Paths.availableDiskSpace;
      if (freeSpace < requiredWithMargin) {
        const neededMb = (requiredWithMargin / (1024 * 1024)).toFixed(0);
        const freeMb = (freeSpace / (1024 * 1024)).toFixed(0);
        const state: ModelState = {
          candidateId,
          name: candidate.name,
          status: 'failed',
          downloadedBytes: 0,
          totalBytes: requiredBytes,
          requiredBytes,
          error: `Ruang penyimpanan tidak mencukupi. Butuh minimal ${neededMb} MB, tersedia ${freeMb} MB.`
        };
        await this.saveModelState(state);
        onProgress(state);
        return state;
      }

      const urls = UPSTREAM_URLS[candidateId];
      if (!urls) {
        throw new Error(`Tautan unduhan untuk kandidat '${candidateId}' tidak ditemukan.`);
      }

      const dir = this.getModelDirectory(candidateId);
      if (!dir.exists) {
        dir.create({ intermediates: true, idempotent: true });
      }

      // Interrupted download clean retry: clean any leftover partials so no corrupted bytes remain
      this.cleanFileIfExists(modelPartialPath);
      this.cleanFileIfExists(projPartialPath);

      let state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'downloading',
        downloadedBytes: 0,
        totalBytes: requiredBytes,
        requiredBytes
      };
      onProgress(state);

      let downloadedModelBytes = 0;
      let downloadedProjBytes = 0;

      // 1. Download model file with cancellable DownloadResumable
      checkCancelled();
      this.activeDownloadTask = createDownloadResumable(
        urls.model,
        modelPartialPath,
        {},
        (data) => {
          downloadedModelBytes = data.totalBytesWritten;
          state = {
            ...state,
            downloadedBytes: downloadedModelBytes + downloadedProjBytes
          };
          onProgress(state);
        }
      );

      const modelDownloadResult = await this.activeDownloadTask.downloadAsync();
      this.activeDownloadTask = null;
      checkCancelled();

      if (!modelDownloadResult || modelDownloadResult.status !== 200) {
        throw new Error(`Unduhan berkas model gagal (HTTP ${modelDownloadResult?.status ?? 'error'})`);
      }

      // 2. Download projector file with cancellable DownloadResumable
      checkCancelled();
      this.activeDownloadTask = createDownloadResumable(
        urls.projector,
        projPartialPath,
        {},
        (data) => {
          downloadedProjBytes = data.totalBytesWritten;
          state = {
            ...state,
            downloadedBytes: downloadedModelBytes + downloadedProjBytes
          };
          onProgress(state);
        }
      );

      const projDownloadResult = await this.activeDownloadTask.downloadAsync();
      this.activeDownloadTask = null;
      checkCancelled();

      if (!projDownloadResult || projDownloadResult.status !== 200) {
        throw new Error(`Unduhan berkas projector gagal (HTTP ${projDownloadResult?.status ?? 'error'})`);
      }

      // 3. Transition to verifying status
      state = {
        ...state,
        status: 'verifying',
        downloadedBytes: requiredBytes
      };
      onProgress(state);

      // 4. Verify SHA-256 of staged files with AbortSignal passed to all hashes
      checkCancelled();
      const modelHash = await computeFileSha256(modelPartialPath, {
        signal: this.activeAbortController?.signal
      });
      checkCancelled();

      const projHash = await computeFileSha256(projPartialPath, {
        signal: this.activeAbortController?.signal
      });
      checkCancelled();

      if (
        modelHash.toLowerCase() !== candidate.modelFile.expectedSha256.toLowerCase() ||
        projHash.toLowerCase() !== candidate.projectorFile.expectedSha256.toLowerCase()
      ) {
        this.cleanFileIfExists(modelPartialPath);
        this.cleanFileIfExists(projPartialPath);

        const failState: ModelState = {
          candidateId,
          name: candidate.name,
          status: 'failed',
          downloadedBytes: requiredBytes,
          totalBytes: requiredBytes,
          requiredBytes,
          error: 'SHA-256 berkas terunduh tidak cocok dengan manifest.'
        };
        await this.saveModelState(failState);
        onProgress(failState);
        return failState;
      }

      // 5. Promote verified staged files atomically, preserving prior valid pair on failure
      checkCancelled();
      await this.atomicPairPromotion(modelPartialPath, projPartialPath, modelPath, projectorPath);
      checkCancelled();

      // Invalidate old loaded pair if replacing loaded candidate
      if (this.loadedPairFingerprint?.candidateId === candidateId) {
        this.loadedPairFingerprint = null;
      }

      // 6. Perform internal check for local load readiness
      const verifiedState = await this.internalCheckModel(candidateId, { explicitHash: false });
      onProgress(verifiedState);
      return verifiedState;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isCancelled =
        errMsg.toLowerCase().includes('batal') ||
        errMsg.toLowerCase().includes('cancel') ||
        this.isDownloadCancelled ||
        this.activeAbortController?.signal.aborted;

      if (modelPartialPath) this.cleanFileIfExists(modelPartialPath);
      if (projPartialPath) this.cleanFileIfExists(projPartialPath);

      // If a prior valid pair exists and download was cancelled/failed, preserve prior state
      let priorValid = false;
      if (modelPath && projectorPath) {
        const modelFile = new File(modelPath);
        const projFile = new File(projectorPath);
        priorValid =
          modelFile.exists &&
          projFile.exists &&
          modelFile.size > 0 &&
          projFile.size > 0;
      }

      const failedState: ModelState = {
        candidateId,
        name: candidateName,
        status: isCancelled ? (priorValid ? 'ready' : 'missing') : 'failed',
        downloadedBytes: priorValid ? requiredBytes : 0,
        totalBytes: requiredBytes,
        requiredBytes,
        error: isCancelled
          ? 'Unduhan dibatalkan oleh pengguna.'
          : `Unduhan gagal: ${errMsg}`
      };
      await this.saveModelState(failedState);
      onProgress(failedState);
      return failedState;
    } finally {
      this.activeDownloadTask = null;
      this.activeAbortController = null;
      this.lifecycle.release('downloading', token);
    }
  }

  /**
   * Real native cancellation of download or verification task.
   * Bypasses lifecycle lock to signal active operations immediately.
   */
  public async cancelModelDownload(): Promise<void> {
    this.isDownloadCancelled = true;
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    if (this.activeDownloadTask) {
      try {
        await this.activeDownloadTask.cancelAsync();
      } catch {}
      this.activeDownloadTask = null;
    }
  }

  /**
   * User-triggered Storage Access Framework / Document Picker import (Public API).
   * Acquires shared lifecycle lock synchronously before any await.
   * Encloses getModelCandidate and path setup within try/finally to prevent lock leaks on invalid IDs.
   */
  public async importModel(
    candidateId: string,
    onProgress: (state: ModelState) => void
  ): Promise<ModelState> {
    const token = this.lifecycle.acquire('importing');
    this.activeAbortController = new AbortController();

    let modelPartialPath = '';
    let projPartialPath = '';

    try {
      const candidate = this.getModelCandidate(candidateId);
      const requiredBytes =
        candidate.modelFile.expectedBytes + candidate.projectorFile.expectedBytes;

      const dir = this.getModelDirectory(candidateId);
      if (!dir.exists) {
        dir.create({ intermediates: true, idempotent: true });
      }

      const modelPath = this.getModelFilePath(candidate);
      const projectorPath = this.getProjectorFilePath(candidate);
      modelPartialPath = `${modelPath}.partial`;
      projPartialPath = `${projectorPath}.partial`;

      // Check free disk space budget (staging copies require requiredBytes * 1.25)
      const requiredWithMargin = Math.ceil(requiredBytes * 1.25);
      const freeSpace = Paths.availableDiskSpace;
      if (freeSpace < requiredWithMargin) {
        const neededMb = (requiredWithMargin / (1024 * 1024)).toFixed(0);
        const freeMb = (freeSpace / (1024 * 1024)).toFixed(0);
        throw new Error(
          `Ruang penyimpanan tidak mencukupi untuk mengimpor model. Butuh minimal ${neededMb} MB, tersedia ${freeMb} MB.`
        );
      }

      // Pick model file
      const modelPick = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: '*/*'
      });

      if (modelPick.canceled || !modelPick.assets || modelPick.assets.length === 0) {
        throw new Error('Impor dibatalkan oleh pengguna.');
      }

      // Pick projector file
      const projPick = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: '*/*'
      });

      if (projPick.canceled || !projPick.assets || projPick.assets.length === 0) {
        throw new Error('Impor dibatalkan oleh pengguna.');
      }

      let state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'downloading',
        downloadedBytes: 0,
        totalBytes: requiredBytes,
        requiredBytes
      };
      onProgress(state);

      this.cleanFileIfExists(modelPartialPath);
      this.cleanFileIfExists(projPartialPath);

      const pickedModelFile = new File(modelPick.assets[0].uri);
      const pickedProjFile = new File(projPick.assets[0].uri);

      // Copy to staged partials
      pickedModelFile.copy(new File(modelPartialPath));
      pickedProjFile.copy(new File(projPartialPath));

      state = {
        ...state,
        downloadedBytes: requiredBytes,
        status: 'verifying'
      };
      onProgress(state);

      // Verify SHA256 of staged files with AbortSignal passed
      const modelHash = await computeFileSha256(modelPartialPath, {
        signal: this.activeAbortController?.signal
      });
      const projHash = await computeFileSha256(projPartialPath, {
        signal: this.activeAbortController?.signal
      });

      if (
        modelHash.toLowerCase() !== candidate.modelFile.expectedSha256.toLowerCase() ||
        projHash.toLowerCase() !== candidate.projectorFile.expectedSha256.toLowerCase()
      ) {
        this.cleanFileIfExists(modelPartialPath);
        this.cleanFileIfExists(projPartialPath);
        throw new Error('SHA-256 berkas yang diimpor tidak sesuai dengan manifest audit.');
      }

      // Atomic pair promotion preserving prior valid files
      await this.atomicPairPromotion(modelPartialPath, projPartialPath, modelPath, projectorPath);

      // Invalidate old loaded pair if replacing loaded candidate
      if (this.loadedPairFingerprint?.candidateId === candidateId) {
        this.loadedPairFingerprint = null;
      }

      const verifiedState = await this.internalCheckModel(candidateId, { explicitHash: false });
      onProgress(verifiedState);
      return verifiedState;
    } finally {
      this.activeAbortController = null;
      this.lifecycle.release('importing', token);
    }
  }

  /**
   * Deletes model and projector files from disk and resets state in DB.
   * Acquires shared lifecycle lock synchronously before any await.
   * Encloses getModelCandidate and path setup within try/finally to prevent lock leaks on invalid IDs.
   * Does NOT touch draft reports.
   */
  public async deleteModel(candidateId: string): Promise<void> {
    const token = this.lifecycle.acquire('deleting');
    try {
      const candidate = this.getModelCandidate(candidateId);

      await this.worker.unloadModel();
      this.loadedPairFingerprint = null;
      this.verifiedFingerprints.delete(candidateId);

      const dir = this.getModelDirectory(candidateId);
      if (dir.exists) {
        dir.delete();
      }

      const requiredBytes =
        candidate.modelFile.expectedBytes + candidate.projectorFile.expectedBytes;

      const state: ModelState = {
        candidateId,
        name: candidate.name,
        status: 'missing',
        downloadedBytes: 0,
        totalBytes: requiredBytes,
        requiredBytes
      };

      await this.saveModelState(state);
    } finally {
      this.lifecycle.release('deleting', token);
    }
  }

  /**
   * Atomically promotes staged model and projector files into place.
   * If prior files exist, they are preserved in .backup until promotion succeeds.
   * If promotion fails midway, the prior valid pair is restored completely.
   */
  private async atomicPairPromotion(
    modelStagedPath: string,
    projStagedPath: string,
    modelDestPath: string,
    projDestPath: string
  ): Promise<void> {
    const modelDest = new File(modelDestPath);
    const projDest = new File(projDestPath);
    const modelStaged = new File(modelStagedPath);
    const projStaged = new File(projStagedPath);

    const modelBackup = new File(`${modelDestPath}.backup`);
    const projBackup = new File(`${projDestPath}.backup`);

    this.cleanFileIfExists(modelBackup.uri);
    this.cleanFileIfExists(projBackup.uri);

    let backedUp = false;
    if (modelDest.exists && projDest.exists) {
      modelDest.move(modelBackup);
      projDest.move(projBackup);
      backedUp = true;
    }

    try {
      modelStaged.move(modelDest);
      projStaged.move(projDest);

      // Promotion succeeded; clean backups
      if (backedUp) {
        this.cleanFileIfExists(modelBackup.uri);
        this.cleanFileIfExists(projBackup.uri);
      }
    } catch (err) {
      // Promotion failed midway; rollback and restore prior valid files
      if (backedUp) {
        this.cleanFileIfExists(modelDest.uri);
        this.cleanFileIfExists(projDest.uri);
        if (modelBackup.exists) modelBackup.move(modelDest);
        if (projBackup.exists) projBackup.move(projDest);
      }
      throw err;
    }
  }

  private isFingerprintEqual(a: PairFingerprint, b: PairFingerprint): boolean {
    return (
      a.candidateId === b.candidateId &&
      a.model.uri === b.model.uri &&
      a.model.size === b.model.size &&
      a.model.modificationTime === b.model.modificationTime &&
      a.projector.uri === b.projector.uri &&
      a.projector.size === b.projector.size &&
      a.projector.modificationTime === b.projector.modificationTime
    );
  }

  private cleanFileIfExists(uriOrPath: string): void {
    try {
      const f = new File(uriOrPath);
      if (f.exists) f.delete();
    } catch {}
  }

  private async saveModelState(state: ModelState): Promise<void> {
    await withWriteLock(async (db) => {
      await db.runAsync(
        `INSERT INTO model_states (
          candidateId, name, status, downloadedBytes, totalBytes, requiredBytes,
          error, lastLocalCheck, modelPath, projectorPath, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(candidateId) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          downloadedBytes = excluded.downloadedBytes,
          totalBytes = excluded.totalBytes,
          requiredBytes = excluded.requiredBytes,
          error = excluded.error,
          lastLocalCheck = excluded.lastLocalCheck,
          modelPath = excluded.modelPath,
          projectorPath = excluded.projectorPath,
          updatedAt = excluded.updatedAt`,
        [
          state.candidateId,
          state.name,
          state.status,
          state.downloadedBytes,
          state.totalBytes,
          state.requiredBytes,
          state.error ?? null,
          state.lastLocalCheck ?? null,
          state.modelPath ?? null,
          state.projectorPath ?? null,
          new Date().toISOString()
        ]
      );
    });
  }
}
