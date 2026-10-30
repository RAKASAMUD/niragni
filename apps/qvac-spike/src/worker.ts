/**
 * Real native QVAC local inference worker for Bara Android spike.
 * Interacts directly with @qvac/sdk. No mock/simulated inference or cloud fallbacks.
 */

import {
  loadModel,
  completion,
  unloadModel,
  cancel,
  InferenceCancelledError
} from '@qvac/sdk';
import { ModelCandidate, InferenceTimingStats, InferenceResult } from './types';

export interface InferenceCallbacks {
  readonly onChunk?: (chunk: string) => void;
  readonly onFirstChunk?: (latencyMs: number) => void;
}

/**
 * The native llama.cpp loader resolves plain filesystem paths, not URIs. expo-file-system
 * returns 'file:///...' URIs (and some call sites could leave a '//' inside the path), which
 * made loadModel fail with "Failed to locate llamacpp-completion model file" even though the
 * file exists. Strip the scheme, decode, and collapse duplicate slashes before every native call.
 */
export function toNativePath(pathOrUri: string): string {
  let p = pathOrUri;
  if (p.startsWith('file://')) p = p.slice('file://'.length);
  try {
    p = decodeURI(p);
  } catch {
    // keep as-is if not valid URI encoding
  }
  return p.replace(/\/{2,}/g, '/');
}

export class QvacNativeWorker {
  private currentModelId: string | null = null;
  private currentCandidateId: string | null = null;
  private currentRequestId: string | null = null;
  private isCold: boolean = true;
  private lastLoadDurationMs: number = 0;

  /**
   * Returns whether a local model is currently loaded in memory.
   */
  public isModelLoaded(): boolean {
    return this.currentModelId !== null;
  }

  /**
   * Returns current loaded modelId.
   */
  public getLoadedModelId(): string | null {
    return this.currentModelId;
  }

  /**
   * Returns current loaded candidateId.
   */
  public getLoadedCandidateId(): string | null {
    return this.currentCandidateId;
  }

  /**
   * Returns the current in-flight requestId, if an inference run is executing.
   */
  public getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }

  /**
   * Loads a local multimodal GGUF model and matching projector into memory.
   * Accurately measures model load duration.
   */
  public async loadModel(
    candidate: ModelCandidate,
    modelFilePath: string,
    projectorFilePath: string,
    onProgress?: (progress: { percentage: number; downloaded: number; total: number }) => void
  ): Promise<string> {
    if (this.currentModelId) {
      await this.unloadModel();
    }

    const startLoad = Date.now();

    const config: Record<string, unknown> = {
      ctx_size: candidate.recommendedConfig.ctx_size,
      projectionModelSrc: toNativePath(projectorFilePath),
      device: candidate.recommendedConfig.device ?? 'cpu'
    };

    if (candidate.recommendedConfig.image_no_upscale) {
      config.image_no_upscale = candidate.recommendedConfig.image_no_upscale;
    }

    // Without an explicit `predict` cap the llamacpp-completion plugin generates until the
    // model emits EOS or the context is full. A 500M model given a long Indonesian schema
    // prompt frequently does neither, so a run can occupy the whole context window and
    // appear to hang for many minutes on a phone CPU. Cap it and give it hard stop strings.
    if (typeof candidate.recommendedConfig.predict === 'number') {
      config.predict = candidate.recommendedConfig.predict;
    }
    if (candidate.recommendedConfig.stop_sequences) {
      config.stop_sequences = [...candidate.recommendedConfig.stop_sequences];
    }
    if (typeof candidate.recommendedConfig.temp === 'number') {
      config.temp = candidate.recommendedConfig.temp;
    }

    const modelId = await loadModel({
      modelSrc: toNativePath(modelFilePath),
      modelType: 'llamacpp-completion',
      modelConfig: config,
      onProgress
    });

    this.currentModelId = modelId;
    this.currentCandidateId = candidate.id;
    this.lastLoadDurationMs = Date.now() - startLoad;
    this.isCold = true;

    return modelId;
  }

  /**
   * Executes local vision-language inference with streaming deltas and honest latency metrics.
   * Separates model load duration, first-chunk latency, generation duration, and total cold turnaround.
   * Does not mislabel text chunks as tokens.
   */
  public async runInference(
    prompt: string,
    photoFilePath?: string | string[],
    callbacks?: InferenceCallbacks
  ): Promise<InferenceResult> {
    if (!this.currentModelId) {
      throw new Error('Tidak ada model QVAC yang dimuat. Muat model terlebih dahulu sebelum inferensi.');
    }

    const attachments = Array.isArray(photoFilePath)
      ? photoFilePath.map((p) => ({ path: toNativePath(p) }))
      : photoFilePath
      ? [{ path: toNativePath(photoFilePath) }]
      : [];
    const history = [
      {
        role: 'user',
        content: prompt,
        ...(attachments.length > 0 ? { attachments } : {})
      }
    ];

    const isColdRun = this.isCold;
    const startInference = Date.now();
    let firstChunkDurationMs: number | undefined;
    let accumulatedText = '';
    let deltaChunksCount = 0;

    const run = completion({
      modelId: this.currentModelId,
      history,
      stream: true
    });

    this.currentRequestId = run.requestId;

    try {
      // Consume streaming text deltas from native worker
      for await (const event of run.events) {
        if (event.type === 'contentDelta' && event.text) {
          if (firstChunkDurationMs === undefined) {
            firstChunkDurationMs = Date.now() - startInference;
            callbacks?.onFirstChunk?.(firstChunkDurationMs);
          }
          deltaChunksCount++;
          accumulatedText += event.text;
          callbacks?.onChunk?.(event.text);
        } else if (event.type === 'completionDone' && event.stopReason === 'cancelled') {
          throw new InferenceCancelledError(run.requestId, { text: accumulatedText });
        }
      }

      const generationDurationMs = Date.now() - startInference;
      this.isCold = false; // Subsequent runs are warm

      // Total cold turnaround includes load duration + generation duration
      const totalColdTurnaroundMs = isColdRun
        ? this.lastLoadDurationMs + generationDurationMs
        : undefined;

      const charactersGenerated = accumulatedText.length;
      const charactersPerSecond = generationDurationMs > 0
        ? (charactersGenerated / generationDurationMs) * 1000
        : undefined;

      // Extract official SDK tokens/s if provided by run.stats, without inventing tokens
      let sdkTokensPerSecond: number | undefined;
      try {
        const stats = await run.stats;
        if (stats && typeof stats.tokensPerSecond === 'number') {
          sdkTokensPerSecond = stats.tokensPerSecond;
        }
      } catch {
        // Stats unavailable from worker
      }

      const timingStats: InferenceTimingStats = {
        coldStart: isColdRun,
        loadDurationMs: isColdRun ? this.lastLoadDurationMs : undefined,
        firstChunkDurationMs,
        generationDurationMs,
        totalColdTurnaroundMs,
        deltaChunksCount,
        charactersGenerated,
        charactersPerSecond,
        sdkTokensPerSecond
      };

      return {
        success: true,
        text: accumulatedText,
        stats: timingStats
      };
    } catch (err: unknown) {
      const generationDurationMs = Date.now() - startInference;
      const totalColdTurnaroundMs = isColdRun
        ? this.lastLoadDurationMs + generationDurationMs
        : undefined;

      if (err instanceof InferenceCancelledError) {
        return {
          success: false,
          cancelled: true,
          text: accumulatedText,
          stats: {
            coldStart: isColdRun,
            loadDurationMs: isColdRun ? this.lastLoadDurationMs : undefined,
            firstChunkDurationMs,
            generationDurationMs,
            totalColdTurnaroundMs,
            deltaChunksCount,
            charactersGenerated: accumulatedText.length
          },
          error: `Inferensi dibatalkan oleh pengguna (requestId: ${run.requestId})`
        };
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        text: accumulatedText,
        stats: {
          coldStart: isColdRun,
          loadDurationMs: isColdRun ? this.lastLoadDurationMs : undefined,
          firstChunkDurationMs,
          generationDurationMs,
          totalColdTurnaroundMs,
          deltaChunksCount,
          charactersGenerated: accumulatedText.length
        },
        error: errorMsg
      };
    } finally {
      this.currentRequestId = null;
    }
  }

  /**
   * Real native cancellation support.
   */
  public async cancelInference(): Promise<void> {
    if (this.currentRequestId) {
      await cancel({ requestId: this.currentRequestId });
    } else if (this.currentModelId) {
      await cancel({ modelId: this.currentModelId, kind: 'completion' });
    }
  }

  /**
   * Unloads model from memory and releases Bare worker resources.
   */
  public async unloadModel(): Promise<void> {
    if (!this.currentModelId) return;

    try {
      await unloadModel({ modelId: this.currentModelId, clearStorage: false });
    } finally {
      this.currentModelId = null;
      this.currentCandidateId = null;
      this.currentRequestId = null;
      this.isCold = true;
    }
  }
}
