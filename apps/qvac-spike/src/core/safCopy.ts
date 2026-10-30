/**
 * SAF content-URI copy helper for expo-file-system v19.
 *
 * Background
 * ----------
 * expo-file-system v19 ships TWO separate APIs:
 *   • New API  (expo-file-system): `new File(uri).copy(dest)` — only accepts
 *     `file://` URIs. Passing a `content://` URI (Android Storage Access
 *     Framework) throws:
 *       "This method cannot be used with content URIs: content://…"
 *   • Legacy API (expo-file-system/legacy): `FileSystem.copyAsync({ from, to })`
 *     — supports both `file://` and SAF `content://` sources.
 *
 * This module provides a single helper that routes automatically:
 *   • source is a content URI  → legacy copyAsync (reads through SAF)
 *   • source is a file URI     → new File.copy (fast, stays private)
 *
 * The destination must always be a private `file://` path so that subsequent
 * SHA-256 hashing and atomic pair-promotion operate on owned files.
 *
 * All other import-model invariants (staging/hashing/atomic promotion/lock
 * lifecycle) remain in models.ts unchanged.
 */

import { File } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';

/**
 * Returns true when `uri` is a SAF content URI (content://…).
 * Used to select the correct copy path at runtime.
 */
export function isContentUri(uri: string): boolean {
  return typeof uri === 'string' && uri.toLowerCase().startsWith('content://');
}

/**
 * Copies a file from `sourceUri` to `destPath` (a private `file://` path).
 *
 * • If source is `content://`: uses legacy `FileSystem.copyAsync`, which
 *   reads through Android's SAF ContentResolver and does not require the
 *   caller to hold the original file (SAF temporary URI suffices).
 * • If source is `file://`: uses `new File(src).copy(dest)` from the new API,
 *   which stays entirely within the sandbox without ContentResolver overhead.
 *
 * Throws if the copy fails for any reason (network, permission, space).
 */
export async function copySourceToPrivate(sourceUri: string, destPath: string): Promise<void> {
  if (isContentUri(sourceUri)) {
    // Legacy API: supports content:// (SAF) as source.
    await copyAsync({ from: sourceUri, to: destPath });
  } else {
    // New API: fast file:// to file:// copy within sandbox.
    new File(sourceUri).copy(new File(destPath));
  }
}
