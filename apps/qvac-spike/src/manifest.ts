/**
 * Model manifests and integrity verification for Bara QVAC Spike.
 * Contains verified metadata from docs/spike/qvac-audit.md.
 */

import { ModelCandidate, FileIntegrityResult, PairReadinessResult, ModelFileMeta } from './types';

export const CANDIDATE_SMOLVLM2: ModelCandidate = {
  id: 'smolvlm2-500m',
  name: 'SmolVLM2 500M Video Instruct',
  variant: 'Q8_0 (quantized)',
  license: 'Apache-2.0',
  upstreamRepo: 'ggml-org/SmolVLM2-500M-Video-Instruct-GGUF',
  languageSupport: ['en'], // Upstream tag English-only; Indonesian quality unproven per audit
  modelFile: {
    filename: 'SmolVLM2-500M-Video-Instruct-Q8_0.gguf',
    expectedBytes: 436808704,
    expectedSha256: '6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc'
  },
  projectorFile: {
    filename: 'mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf',
    expectedBytes: 108785184,
    expectedSha256: '921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b'
  },
  qvacModelConstant: 'SMOLVLM2_500M_MULTIMODAL_Q8_0',
  qvacProjectorConstant: 'MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0',
  recommendedConfig: {
    ctx_size: 8192,
    device: 'cpu', // CPU default until GPU Vulkan is physically tested on Mali-G615
    predict: 640,
    stop_sequences: ['\n\n\n', '</s>', '<|im_end|>'],
    temp: 0.2
  }
};

export const CANDIDATE_VISIONPSY: ModelCandidate = {
  id: 'visionpsy-nano-460m',
  name: 'VisionPsy Nano 460M Flash',
  variant: 'Q8_0 (quantized)',
  license: 'Apache-2.0',
  upstreamRepo: 'qvac/VisionPsy-Nano-460M-Flash-GGUFs',
  languageSupport: ['en'], // Upstream tag English-only; Indonesian quality unproven per audit
  modelFile: {
    filename: 'visionpsy-nano-460m-flash-q8_0.gguf',
    expectedBytes: 436676000,
    expectedSha256: '66d84c0f552c96ec6734d8cef7f0a3192f4f2df2cd781a193339df194f501a12'
  },
  projectorFile: {
    filename: 'mmproj-visionpsy-nano-460m-flash-q8.gguf',
    expectedBytes: 108782144,
    expectedSha256: 'bbb0691873a4e638f6928898b3c3be9a4730bd4ced301197726a4fcb549695d0'
  },
  qvacModelConstant: 'VISIONPSY_NANO_460M_MULTIMODAL_Q8_0',
  qvacProjectorConstant: 'MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0',
  recommendedConfig: {
    ctx_size: 8192,
    image_no_upscale: 'on', // Required for Flash variant to avoid degradation per docs
    device: 'cpu',
    predict: 640,
    stop_sequences: ['\n\n\n', '</s>', '<|im_end|>'],
    temp: 0.2
  }
};

export const CANDIDATES: readonly ModelCandidate[] = [
  CANDIDATE_SMOLVLM2,
  CANDIDATE_VISIONPSY
];

export interface FileStatSnapshot {
  readonly exists: boolean;
  readonly byteSize?: number;
  readonly sha256?: string;
}

/**
 * Validates a single file against expected size and sha256 hash.
 * A file is NEVER marked 'valid' if its SHA256 hash is missing or unverified.
 */
export function verifyFileIntegrity(
  expectedMeta: ModelFileMeta,
  stat: FileStatSnapshot
): FileIntegrityResult {
  if (!stat.exists) {
    return {
      exists: false,
      status: 'missing',
      message: `File '${expectedMeta.filename}' tidak ditemukan di lokasi penyimpanan.`
    };
  }

  if (stat.byteSize === undefined || stat.byteSize !== expectedMeta.expectedBytes) {
    return {
      exists: true,
      actualBytes: stat.byteSize,
      status: 'size_mismatch',
      message: `Ukuran berkas tidak cocok untuk '${expectedMeta.filename}'. Diharapkan ${expectedMeta.expectedBytes} bytes, aktual ${stat.byteSize ?? 'tidak diketahui'} bytes.`
    };
  }

  // If size matches but sha256 is uncomputed, mark as unverified (cannot declare valid)
  if (!stat.sha256) {
    return {
      exists: true,
      actualBytes: stat.byteSize,
      status: 'unverified',
      message: `Ukuran berkas '${expectedMeta.filename}' cocok (${stat.byteSize} bytes), tetapi SHA-256 belum dihitung. Verifikasi hash diperlukan.`
    };
  }

  if (stat.sha256.toLowerCase() !== expectedMeta.expectedSha256.toLowerCase()) {
    return {
      exists: true,
      actualBytes: stat.byteSize,
      actualSha256: stat.sha256,
      status: 'hash_mismatch',
      message: `SHA-256 checksum tidak cocok untuk '${expectedMeta.filename}'. Diharapkan ${expectedMeta.expectedSha256}, aktual ${stat.sha256}.`
    };
  }

  return {
    exists: true,
    actualBytes: stat.byteSize,
    actualSha256: stat.sha256,
    status: 'valid',
    message: `Berkas '${expectedMeta.filename}' terverifikasi valid (ukuran ${stat.byteSize} bytes, SHA-256 cocok).`
  };
}

/**
 * Validates that both the model and its matching projector are present and completely verified with SHA256.
 * Pairs must NOT be mismatched.
 */
export function verifyModelPair(
  candidate: ModelCandidate,
  modelStat: FileStatSnapshot,
  projectorStat: FileStatSnapshot
): PairReadinessResult {
  const modelResult = verifyFileIntegrity(candidate.modelFile, modelStat);
  const projectorResult = verifyFileIntegrity(candidate.projectorFile, projectorStat);

  const isReady = modelResult.status === 'valid' && projectorResult.status === 'valid';

  let details = '';
  if (isReady) {
    details = `Model dan Projector ${candidate.name} terverifikasi lengkap (ukuran dan SHA-256 valid). Siap untuk dimuat ke RAM.`;
  } else {
    const issues: string[] = [];
    if (modelResult.status !== 'valid') {
      issues.push(`Model: ${modelResult.message}`);
    }
    if (projectorResult.status !== 'valid') {
      issues.push(`Projector: ${projectorResult.message}`);
    }
    details = `Kesiapan belum terpenuhi: ${issues.join(' | ')}`;
  }

  return {
    candidateId: candidate.id,
    isReady,
    modelStatus: modelResult,
    projectorStatus: projectorResult,
    details
  };
}
