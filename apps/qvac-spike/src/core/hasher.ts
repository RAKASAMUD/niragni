/**
 * Streamed SHA-256 hashing using Expo FileHandle and @noble/hashes.
 * Reads in bounded 256KB chunks to avoid large memory buffers.
 * Includes cooperative event-loop yielding (every 2MB) so large files
 * (such as 437MB model files) do not freeze the React Native JavaScript thread.
 * Never uses fabricated expo-crypto.digestFileAsync or full-file base64 buffers.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { File } from 'expo-file-system';

const CHUNK_SIZE = 256 * 1024; // 256 KB chunks
const YIELD_INTERVAL_BYTES = 2 * 1024 * 1024; // Yield every 2 MB

export interface HashOptions {
  signal?: AbortSignal;
  onProgress?: (bytesHashed: number, totalBytes: number) => void;
}

/**
 * Computes the SHA-256 hash of a file at the given local file URI or path
 * using incremental streamed chunks and cooperative yielding.
 */
export async function computeFileSha256(
  fileUriOrPath: string,
  options?: HashOptions
): Promise<string> {
  const file = new File(fileUriOrPath);

  if (!file.exists) {
    throw new Error(`Berkas tidak ditemukan untuk komputasi hash: ${fileUriOrPath}`);
  }

  const totalBytes = file.size;
  const handle = file.open();
  const hasher = sha256.create();

  let bytesReadTotal = 0;
  let bytesSinceLastYield = 0;

  try {
    while (true) {
      if (options?.signal?.aborted) {
        throw new Error('Komputasi hash dibatalkan.');
      }

      const chunk = handle.readBytes(CHUNK_SIZE);
      if (!chunk || chunk.length === 0) {
        break;
      }

      hasher.update(chunk);
      bytesReadTotal += chunk.length;
      bytesSinceLastYield += chunk.length;

      options?.onProgress?.(bytesReadTotal, totalBytes);

      // Cooperative yield to keep React Native UI responsive
      if (bytesSinceLastYield >= YIELD_INTERVAL_BYTES) {
        bytesSinceLastYield = 0;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    const digest = hasher.digest();
    let hex = '';
    for (let i = 0; i < digest.length; i++) {
      hex += digest[i].toString(16).padStart(2, '0');
    }
    return hex;
  } finally {
    try {
      handle.close();
    } catch {
      // Ignore close errors if already closed
    }
  }
}

