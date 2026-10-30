/**
 * Types for Bara QVAC Spike application.
 * Aligned with Bara PRD v0.9: Citizen forest/land fire (karhutla) observation drafting in Indonesian.
 */

export interface ModelFileMeta {
  readonly filename: string;
  readonly expectedBytes: number;
  readonly expectedSha256: string;
}

export interface ModelCandidate {
  readonly id: 'smolvlm2-500m' | 'visionpsy-nano-460m';
  readonly name: string;
  readonly variant: string;
  readonly license: string;
  readonly upstreamRepo: string;
  readonly languageSupport: readonly string[];
  readonly modelFile: ModelFileMeta;
  readonly projectorFile: ModelFileMeta;
  readonly qvacModelConstant: string;
  readonly qvacProjectorConstant: string;
  readonly recommendedConfig: {
    readonly ctx_size: number;
    readonly image_no_upscale?: 'on' | 'off';
    readonly device?: 'cpu' | 'vulkan' | 'opencl';
  };
}

export type IntegrityCheckStatus = 'missing' | 'size_mismatch' | 'hash_mismatch' | 'unverified' | 'valid';

export interface FileIntegrityResult {
  readonly exists: boolean;
  readonly actualBytes?: number;
  readonly actualSha256?: string;
  readonly status: IntegrityCheckStatus;
  readonly message: string;
}

export interface PairReadinessResult {
  readonly candidateId: string;
  readonly isReady: boolean;
  readonly modelStatus: FileIntegrityResult;
  readonly projectorStatus: FileIntegrityResult;
  readonly details: string;
}

export interface InferenceTimingStats {
  readonly coldStart: boolean;
  readonly loadDurationMs?: number;
  readonly firstChunkDurationMs?: number;
  readonly generationDurationMs: number;
  readonly totalColdTurnaroundMs?: number;
  readonly deltaChunksCount: number;
  readonly charactersGenerated: number;
  readonly charactersPerSecond?: number;
  readonly sdkTokensPerSecond?: number;
}

export interface InferenceResult {
  readonly success: boolean;
  readonly cancelled?: boolean;
  readonly text: string;
  readonly stats: InferenceTimingStats;
  readonly error?: string;
}

