/**
 * Media processing, storage isolation, and analysis image resizing for Bara.
 * Enforces:
 * - Sanitized reportId/attachmentId to prevent path traversal outside app sandbox
 * - Max 3 photos per report
 * - Max 20MB per photo
 * - Copied to private application storage before persistence
 * - Preserves original image extension & MIME (PNG/HEIC/JPEG) for original file
 * - Analysis copy converted to JPEG with longest edge max 1600px
 * - Incremental SHA-256 hash verification
 * - Rollback on failure preserving user draft
 * - Scoped export directories per report (bara_exports/<reportId>/)
 * - Startup orphan cleanup
 */

import { File, Directory, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat, Action } from 'expo-image-manipulator';
import { computeFileSha256 } from './hasher';
import { Attachment } from '../product-contract';

export const MAX_PHOTOS_PER_REPORT = 3;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
export const ANALYSIS_MAX_EDGE = 1600;

export function sanitizeId(id: string): string {
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`ID tidak valid atau mengandung karakter tidak diizinkan: ${id}`);
  }
  return id;
}

export function getMediaBaseDir(): Directory {
  return new Directory(Paths.document, 'bara_media');
}

export function getReportMediaDir(reportId: string): Directory {
  const safeReportId = sanitizeId(reportId);
  return new Directory(getMediaBaseDir(), 'reports', safeReportId);
}

export function getReportExportsDir(reportId: string): Directory {
  const safeReportId = sanitizeId(reportId);
  return new Directory(Paths.cache, 'bara_exports', safeReportId);
}

export function getAllExportsBaseDir(): Directory {
  return new Directory(Paths.cache, 'bara_exports');
}

/**
 * Initializes and ensures storage directories exist.
 */
export async function ensureMediaDirectories(reportId?: string): Promise<void> {
  const baseDir = getMediaBaseDir();
  if (!baseDir.exists) {
    baseDir.create({ intermediates: true, idempotent: true });
  }

  const exportsBase = getAllExportsBaseDir();
  if (!exportsBase.exists) {
    exportsBase.create({ intermediates: true, idempotent: true });
  }

  if (reportId) {
    const reportDir = getReportMediaDir(reportId);
    if (!reportDir.exists) {
      reportDir.create({ intermediates: true, idempotent: true });
    }
    const origDir = new Directory(reportDir, 'originals');
    if (!origDir.exists) origDir.create({ intermediates: true, idempotent: true });
    const analysisDir = new Directory(reportDir, 'analysis');
    if (!analysisDir.exists) analysisDir.create({ intermediates: true, idempotent: true });

    const reportExpDir = getReportExportsDir(reportId);
    if (!reportExpDir.exists) {
      reportExpDir.create({ intermediates: true, idempotent: true });
    }
  }
}

/**
 * Prompts user for photo via Camera or Media Library and processes it into private storage.
 */
export async function captureAndProcessPhoto(
  reportId: string,
  source: 'camera' | 'library',
  currentPhotoCount: number
): Promise<Attachment | null> {
  const safeReportId = sanitizeId(reportId);

  if (currentPhotoCount >= MAX_PHOTOS_PER_REPORT) {
    throw new Error(`Batas maksimal ${MAX_PHOTOS_PER_REPORT} foto per laporan telah tercapai.`);
  }

  await ensureMediaDirectories(safeReportId);

  let pickerResult: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Izin kamera ditolak oleh pengguna.');
    }
    pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
      exif: true
    });
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Izin galeri media ditolak oleh pengguna.');
    }
    pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
      exif: true
    });
  }

  if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
    return null; // User cancelled
  }

  const asset = pickerResult.assets[0];
  const sourceUri = asset.uri;

  // Validate existence
  const srcFile = new File(sourceUri);
  if (!srcFile.exists) {
    throw new Error('Berkas foto tidak dapat diakses atau berupa tautan cloud-only.');
  }

  // Validate byte size
  const byteSize = asset.fileSize ?? srcFile.size;
  if (byteSize > MAX_PHOTO_BYTES) {
    throw new Error(
      `Ukuran foto ${(byteSize / (1024 * 1024)).toFixed(1)} MB melebihi batas maksimal 20 MB.`
    );
  }

  const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const reportDir = getReportMediaDir(safeReportId);
  const origDir = new Directory(reportDir, 'originals');
  const analysisDir = new Directory(reportDir, 'analysis');

  // Determine actual file extension and MIME type
  let ext = '.jpg';
  let mime = asset.mimeType || 'image/jpeg';
  const lowerUri = sourceUri.toLowerCase();

  if (mime.includes('png') || lowerUri.endsWith('.png')) {
    ext = '.png';
    mime = 'image/png';
  } else if (mime.includes('heic') || lowerUri.endsWith('.heic')) {
    ext = '.heic';
    mime = 'image/heic';
  } else if (mime.includes('webp') || lowerUri.endsWith('.webp')) {
    ext = '.webp';
    mime = 'image/webp';
  } else {
    ext = '.jpg';
    mime = 'image/jpeg';
  }

  const origDestFile = new File(origDir, `${attachmentId}_orig${ext}`);
  const analysisDestFile = new File(analysisDir, `${attachmentId}_analysis.jpg`);

  try {
    // 1. Copy original photo into application private sandbox preserving extension
    srcFile.copy(origDestFile);

    // 2. Compute SHA-256 of original file using chunked streaming
    const hash = await computeFileSha256(origDestFile.uri);

    // 3. Compute dimensions and resize for analysis copy (JPEG max 1600px longest edge)
    const rawWidth = asset.width || 1600;
    const rawHeight = asset.height || 1200;
    const longest = Math.max(rawWidth, rawHeight);

    const actions: Action[] = [];
    if (longest > ANALYSIS_MAX_EDGE) {
      if (rawWidth >= rawHeight) {
        actions.push({ resize: { width: ANALYSIS_MAX_EDGE } });
      } else {
        actions.push({ resize: { height: ANALYSIS_MAX_EDGE } });
      }
    }

    const manipResult = await manipulateAsync(origDestFile.uri, actions, {
      compress: 0.85,
      format: SaveFormat.JPEG
    });

    const manipFile = new File(manipResult.uri);
    manipFile.copy(analysisDestFile);

    try {
      manipFile.delete();
    } catch {
      // temp file cleanup
    }

    const finalAttachment: Attachment = {
      id: attachmentId,
      reportId: safeReportId,
      uri: origDestFile.uri,
      analysisUri: analysisDestFile.uri,
      hash,
      mime,
      width: rawWidth,
      height: rawHeight,
      bytes: byteSize,
      source,
      selectedForShare: true
    };

    return finalAttachment;
  } catch (error) {
    // Rollback copied files on any error
    try {
      if (origDestFile.exists) origDestFile.delete();
    } catch {}
    try {
      if (analysisDestFile.exists) analysisDestFile.delete();
    } catch {}
    throw error;
  }
}

/**
 * Deletes all physical media files and temporary export files associated with a specific report.
 * Does NOT delete photos from device photo gallery.
 */
export async function deleteReportMedia(reportId: string): Promise<void> {
  const safeReportId = sanitizeId(reportId);
  const reportDir = getReportMediaDir(safeReportId);
  if (reportDir.exists) {
    reportDir.delete();
  }

  const exportDir = getReportExportsDir(safeReportId);
  if (exportDir.exists) {
    exportDir.delete();
  }
}

/**
 * Deletes a single attachment's private original and analysis files.
 */
export async function deleteAttachmentFiles(origUri: string, analysisUri: string): Promise<void> {
  try {
    const orig = new File(origUri);
    if (orig.exists) orig.delete();
  } catch {}
  try {
    const analysis = new File(analysisUri);
    if (analysis.exists) analysis.delete();
  } catch {}
}

/**
 * Startup recovery: cleans up orphan media files not associated with any active database attachment,
 * and clears old export temporary files.
 */
export async function recoverAndCleanOrphans(activeUris: Set<string>): Promise<void> {
  // 1. Clean exports directory at startup
  try {
    const exportsBase = getAllExportsBaseDir();
    if (exportsBase.exists) {
      const items = exportsBase.list();
      for (const item of items) {
        try {
          item.delete();
        } catch {}
      }
    }
  } catch {}

  // 2. Scan media directory for unreferenced files
  try {
    const baseDir = getMediaBaseDir();
    if (!baseDir.exists) return;

    const reportsDir = new Directory(baseDir, 'reports');
    if (!reportsDir.exists) return;

    const reportFolders = reportsDir.list();
    for (const folder of reportFolders) {
      if (folder instanceof Directory) {
        // Check originals
        const origDir = new Directory(folder, 'originals');
        if (origDir.exists) {
          for (const file of origDir.list()) {
            if (file instanceof File && !activeUris.has(file.uri)) {
              try {
                file.delete();
              } catch {}
            }
          }
        }
        // Check analysis
        const analysisDir = new Directory(folder, 'analysis');
        if (analysisDir.exists) {
          for (const file of analysisDir.list()) {
            if (file instanceof File && !activeUris.has(file.uri)) {
              try {
                file.delete();
              } catch {}
            }
          }
        }
      }
    }
  } catch {}
}
