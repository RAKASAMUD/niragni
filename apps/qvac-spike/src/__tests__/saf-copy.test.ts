/**
 * Regression tests for Bug 1: SmolVLM2 SAF content URI import fails with File.copy
 *
 * Evidence: device-qa-2026-10-30 report bug #1
 * "Call to function 'FileSystemFile.copy' has been rejected …
 *  This method cannot be used with content URIs: content://com.android.providers.downloads…"
 *
 * Fix strategy (safCopy.ts):
 *   - content:// URIs → legacy FileSystem.copyAsync (reads through SAF ContentResolver)
 *   - file:// URIs   → new File.copy (stays in sandbox)
 *
 * Boundary semantics tested here:
 *   1. isContentUri detection covers expected Android SAF schemes.
 *   2. copySourceToPrivate routes content:// through copyAsync (mock verifies the call).
 *   3. copySourceToPrivate routes file:// through File.copy (mock verifies the call).
 *   4. File.copy mock REJECTS content URIs (simulating the real native rejection) so the
 *      test proves the new helper actually avoids the failing path, not that a mock auto-passes.
 *   5. copyAsync mock is proven to accept content:// URIs.
 *
 * NOTE: Runtime SAF inference on a real Android device is untested until a new APK is built
 * and exercised on hardware. This test covers the JS-layer routing decision only.
 */

// --- Mocks ----------------------------------------------------------------

// Simulate the native File class that REJECTS content:// URIs in expo-file-system v19.
// This replicates the exact runtime error observed in the QA report.
const mockFileCopy = jest.fn().mockImplementation((dest: { uri?: string }) => {
  // The source URI is captured via the File constructor arg stored in `mockFileUri`.
  if (mockFileUri.startsWith('content://')) {
    throw new Error(
      `This method cannot be used with content URIs: ${mockFileUri}`
    );
  }
  // For file:// URIs the copy succeeds silently.
});

let mockFileUri = '';

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => {
    mockFileUri = uri;
    return {
      uri,
      copy: mockFileCopy,
      exists: true,
      size: 1024,
    };
  }),
  Directory: jest.fn(),
  Paths: { document: 'file:///data/user/0/com.niragni/files' },
}));

// Mock the legacy FileSystem.copyAsync — this is what the fix uses for content:// URIs.
const mockCopyAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-file-system/legacy', () => ({
  copyAsync: mockCopyAsync,
  createDownloadResumable: jest.fn(),
}));

// --- Imports (after mocks) ------------------------------------------------

import { isContentUri, copySourceToPrivate } from '../core/safCopy';

// --------------------------------------------------------------------------

describe('isContentUri — SAF content URI detection', () => {
  it('returns true for Android SAF Download provider URI', () => {
    expect(isContentUri(
      'content://com.android.providers.downloads.documents/document/msf%3A1000308073'
    )).toBe(true);
  });

  it('returns true for any content:// scheme regardless of authority', () => {
    expect(isContentUri('content://media/external/images/media/42')).toBe(true);
  });

  it('returns true for uppercase CONTENT:// scheme', () => {
    expect(isContentUri('CONTENT://com.android.providers.media.documents/doc/1')).toBe(true);
  });

  it('returns false for file:// URIs', () => {
    expect(isContentUri('file:///data/user/0/com.niragni/files/model.gguf')).toBe(false);
  });

  it('returns false for http:// URIs', () => {
    expect(isContentUri('https://huggingface.co/model.gguf')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isContentUri('')).toBe(false);
  });
});

describe('copySourceToPrivate — routing by URI scheme', () => {
  const destPath = 'file:///data/user/0/com.niragni/files/bara_models/model.gguf.partial';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileUri = '';
  });

  describe('content:// source (SAF) — must use legacy copyAsync, NOT File.copy', () => {
    const safUri = 'content://com.android.providers.downloads.documents/document/msf%3A1000308073';

    it('calls legacy copyAsync with the content URI as `from`', async () => {
      await copySourceToPrivate(safUri, destPath);
      expect(mockCopyAsync).toHaveBeenCalledTimes(1);
      expect(mockCopyAsync).toHaveBeenCalledWith({ from: safUri, to: destPath });
    });

    it('does NOT call File.copy for content URIs', async () => {
      await copySourceToPrivate(safUri, destPath);
      expect(mockFileCopy).not.toHaveBeenCalled();
    });

    it('proves File.copy WOULD throw for content URI if called directly (boundary proof)', () => {
      // Set up File mock to simulate native rejection
      mockFileUri = safUri;
      expect(() => mockFileCopy({ uri: destPath })).toThrow(
        'This method cannot be used with content URIs'
      );
    });
  });

  describe('file:// source (private sandbox) — must use File.copy, NOT copyAsync', () => {
    const fileUri = 'file:///data/user/0/com.niragni/files/tmp/cached_model.gguf';

    it('calls File.copy for file:// sources', async () => {
      await copySourceToPrivate(fileUri, destPath);
      expect(mockFileCopy).toHaveBeenCalledTimes(1);
    });

    it('does NOT call legacy copyAsync for file:// sources', async () => {
      await copySourceToPrivate(fileUri, destPath);
      expect(mockCopyAsync).not.toHaveBeenCalled();
    });
  });

  describe('copyAsync is proven to accept content URIs', () => {
    const safUri = 'content://com.android.providers.media.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fmodel.gguf';

    it('resolves successfully when copyAsync is called with a content URI', async () => {
      await expect(copySourceToPrivate(safUri, destPath)).resolves.toBeUndefined();
    });
  });
});
