/**
 * Export formatting, EXIF stripping, OS share sheet handoff, and clipboard integration.
 *
 * Strict Privacy & Verification Enforcements:
 * - Authoritative persistence read: Always fetches the persisted report from the repository;
 *   never trusts caller-injected selfie objects.
 * - Mandatory Sender Selfie Gate: Requires a non-null camera selfie owned by the same report
 *   with an existing nonempty private file under that report's media directory.
 *   Rejects missing, forged, outside-path, traversal (literal & encoded), or wrong-owner selfies
 *   BEFORE any OS handoff or copying.
 * - Separate inclusion of incident photos and selfie: Re-encodes all exported photos to JPEG
 *   to strip EXIF/GPS metadata (fail-closed, no original fallback). Cleans partial batch files on error.
 * - Text label appended to export: "Foto pengirim — identitas belum diverifikasi."
 * - Preview shows drafts without faking selfie in photoUris (UI renders dedicated selfie card).
 * - Text copy blocked: copyReport throws clear error to prevent bypass of photo & selfie requirements.
 * - Channel ID validation: Validates optional channelId against active curated Damkar directory.
 * - Preserves honest share attempt recording (share_sheet_opened, cancelled, unknown) with no delivery claim.
 */

import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Share from 'react-native-share';
import { Report, ExportPreview, ShareAttempt } from '../product-contract';
import { ReportRepository } from './repository';
import { getReportExportsDir, getReportMediaDir, sanitizeId } from './media';
import { CHANNEL_DIRECTORY } from './channel-directory';
import { VERIFIED_INCIDENT_CHANNEL_IDS } from './channel-selector';

/**
 * Validates that targetFileUri is a genuine normalized descendant of baseDirUri.
 * Strictly prevents path traversal ('..', '%2e%2e', backslashes, mixed slashes)
 * and ensures the URI resolves strictly under the expected directory without Node 'path'
 * or native platform dependencies.
 */
export function isSafeDescendantPath(baseDirUri: string, targetFileUri: string): boolean {
  if (!baseDirUri || !targetFileUri) return false;
  if (typeof baseDirUri !== 'string' || typeof targetFileUri !== 'string') return false;

  // Immediate rejection of backslashes or encoded backslashes
  if (targetFileUri.includes('\\') || /%5c/i.test(targetFileUri) || baseDirUri.includes('\\')) {
    return false;
  }

  // Iteratively decode to catch single, double, or multi-level URL encoding
  let decodedTarget = targetFileUri;
  let decodedBase = baseDirUri;

  try {
    for (let i = 0; i < 3; i++) {
      const nextTarget = decodeURIComponent(decodedTarget);
      const nextBase = decodeURIComponent(decodedBase);
      if (nextTarget === decodedTarget && nextBase === decodedBase) break;
      decodedTarget = nextTarget;
      decodedBase = nextBase;
    }
  } catch {
    // Malformed URI sequence (URIError)
    return false;
  }

  // Reject any backslashes uncovered after decoding
  if (decodedTarget.includes('\\') || decodedBase.includes('\\')) {
    return false;
  }

  // Reject any directory traversal token in any segment (both raw and decoded)
  const hasTraversalSegment = (pathStr: string): boolean => {
    const withoutScheme = pathStr.replace(/^[a-zA-Z][a-zA-Z0-9+-.]*:\/\//, '');
    const segments = withoutScheme.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.' || seg === '%2e%2e' || seg === '%2e' || seg.includes('..')) {
        return true;
      }
    }
    return false;
  };

  if (hasTraversalSegment(targetFileUri) || hasTraversalSegment(decodedTarget)) {
    return false;
  }

  // Normalize base directory path to end with a single slash
  const cleanBase = decodedBase.endsWith('/') ? decodedBase : `${decodedBase}/`;

  // Target must strictly start with clean base directory prefix
  if (!decodedTarget.startsWith(cleanBase)) {
    return false;
  }

  // Target must have a non-empty relative filename after the base prefix
  const relativePart = decodedTarget.slice(cleanBase.length).trim();
  if (!relativePart || relativePart.startsWith('/') || relativePart.endsWith('/')) {
    return false;
  }

  return true;
}

export class ExportService {
  private repository: ReportRepository;

  constructor(repository: ReportRepository) {
    this.repository = repository;
  }

  /**
   * Generates formatted text preview and lists selected incident photo URIs.
   * Can preview drafts without a selfie; does not fake or inject selfie into photoUris.
   */
  public async previewExport(report: Report): Promise<ExportPreview> {
    const selectedAttachments = (report.attachments || []).filter((a) => a.selectedForShare);
    const photoUris = selectedAttachments.map((a) => a.uri);

    const lines: string[] = [
      '--- LAPORAN OBSERVASI DUGAAN KARHUTLA ---',
      ''
    ];

    const bodyText = (report.reviewedText || '').trim() || (report.rawText || '').trim();
    if (bodyText) {
      lines.push('RINGKASAN PENGAMATAN:');
      lines.push(bodyText);
      lines.push('');
    }

    const incidentLoc = (report.incidentLocationText || '').trim();
    lines.push(`PERKIRAAN ARAH/LOKASI: ${incidentLoc || 'Belum diketahui'}`);

    const obsTime = (report.observationTime || '').trim();
    const tz = report.timezone || 'UTC';
    lines.push(`WAKTU PENGAMATAN: ${obsTime ? `${obsTime} (${tz})` : 'Belum diketahui'}`);

    // Observer GPS coordinates included ONLY if explicitly selected by the citizen
    if (report.includeObserverLocation && report.observerLocation) {
      const { latitude, longitude, accuracy, timestamp } = report.observerLocation;
      const accText = accuracy !== null ? ` (Akurasi: ±${Math.round(accuracy)} m)` : '';
      const timeText = timestamp ? ` [Waktu GPS: ${timestamp}]` : '';
      lines.push(`POSISI PELAPOR: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${accText}${timeText}`);
    }

    if (selectedAttachments.length > 0) {
      lines.push(`LAMPIRAN FOTO: ${selectedAttachments.length} foto bukti terlampir.`);
    }

    lines.push('');
    lines.push('Disiapkan secara lokal melalui aplikasi Niragni (tanpa pengiriman otomatis).');

    return {
      text: lines.join('\n'),
      photoUris
    };
  }

  /**
   * Enforces authoritative selfie verification, strips EXIF via JPEG re-encoding,
   * opens the OS native share dialog, and records the share attempt event.
   */
  public async shareReport(report: Report, channelId?: string): Promise<void> {
    const safeReportId = sanitizeId(report.id);

    // 1. Authoritative Persisted Report Read
    // Never trust caller-injected report.senderSelfie (prevents memory injection bypass)
    const persisted = await this.repository.getReport(safeReportId);
    if (!persisted) {
      throw new Error(`Laporan '${safeReportId}' tidak ditemukan di penyimpanan.`);
    }

    // 2. Validate optional channelId against active curated Damkar directory
    if (channelId) {
      const isValidDamkar = CHANNEL_DIRECTORY.some(
        (c) => c.id === channelId && VERIFIED_INCIDENT_CHANNEL_IDS.has(c.id)
      );
      if (!isValidDamkar) {
        throw new Error(
          `Saluran tujuan '${channelId}' tidak valid atau bukan kanal darurat Damkar aktif yang terverifikasi.`
        );
      }
    }

    // 3. Mandatory Sender Selfie Verification Gate
    const selfie = persisted.senderSelfie;
    if (!selfie) {
      throw new Error(
        'Foto selfie pengirim wajib diambil sebelum berbagi laporan. ' +
        'Gunakan tombol "Ambil selfie pengirim" untuk melanjutkan. ' +
        'Draf Anda tetap tersimpan dan dapat diedit.'
      );
    }

    if (selfie.source !== 'camera') {
      throw new Error('Foto selfie pengirim harus bersumber langsung dari kamera depan.');
    }

    if (selfie.reportId !== safeReportId) {
      throw new Error('Foto selfie pengirim tidak cocok dengan kepemilikan laporan ini.');
    }

    const reportMediaDir = getReportMediaDir(safeReportId);
    if (!isSafeDescendantPath(reportMediaDir.uri, selfie.uri)) {
      throw new Error('Jalur berkas selfie tidak valid atau berada di luar direktori media laporan.');
    }

    const selfieFile = new File(selfie.uri);
    if (!selfieFile.exists || selfieFile.size <= 0) {
      throw new Error('Berkas fisik selfie pengirim tidak ditemukan atau kosong di penyimpanan privat.');
    }

    // 4. Prepare Export Directory and Track Created Files for Fail-Closed Cleanup
    const exportsDir = getReportExportsDir(safeReportId);
    if (!exportsDir.exists) {
      exportsDir.create({ intermediates: true, idempotent: true });
    }

    const exportBatchId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sanitizedUris: string[] = [];
    const createdFiles: File[] = [];

    const cleanupPartials = () => {
      for (const f of createdFiles) {
        try {
          if (f.exists) f.delete();
        } catch {}
      }
    };

    const selectedAttachments = (persisted.attachments || []).filter((a) => a.selectedForShare);

    // 5. Re-encode selected incident photos to JPEG (strip EXIF)
    for (let i = 0; i < selectedAttachments.length; i++) {
      const att = selectedAttachments[i];
      const destFile = new File(exportsDir, `${exportBatchId}_photo_${i + 1}.jpg`);
      createdFiles.push(destFile);

      try {
        const manipResult = await manipulateAsync(att.uri, [], {
          compress: 0.9,
          format: SaveFormat.JPEG
        });
        new File(manipResult.uri).copy(destFile);
        sanitizedUris.push(destFile.uri);
      } catch (err: unknown) {
        cleanupPartials();
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Gagal melakukan sanitasi penghapusan EXIF pada foto lampiran (${errMsg}). ` +
          `Demi menjaga privasi Anda, foto asli tidak dikirimkan. Harap hapus pilihan foto ini atau coba kembali.`
        );
      }
    }

    // 6. Re-encode sender selfie to JPEG separately
    const selfieDestFile = new File(exportsDir, `${exportBatchId}_selfie.jpg`);
    createdFiles.push(selfieDestFile);

    try {
      const selfieManipResult = await manipulateAsync(selfie.uri, [], {
        compress: 0.9,
        format: SaveFormat.JPEG
      });
      new File(selfieManipResult.uri).copy(selfieDestFile);
      sanitizedUris.push(selfieDestFile.uri);
    } catch (err: unknown) {
      cleanupPartials();
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Gagal melakukan sanitasi EXIF pada foto pengirim (${errMsg}). ` +
        `Demi menjaga privasi, selfie asli tidak dikirimkan. Coba ambil ulang selfie.`
      );
    }

    // 7. Format Text with Verbatim Mandatory Label
    const preview = await this.previewExport(persisted);
    const exportMessage = `${preview.text}\n\nFoto pengirim — identitas belum diverifikasi.`;

    const attemptId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // 8. Open OS Native Share Dialog
    try {
      const shareOptions: {
        title: string;
        message: string;
        urls: string[];
      } = {
        title: 'Laporan Pengamatan Karhutla',
        message: exportMessage,
        urls: sanitizedUris
      };

      await Share.open(shareOptions);

      const attempt: ShareAttempt = {
        id: attemptId,
        at: now,
        event: 'share_sheet_opened',
        channelId
      };
      await this.repository.addShareAttempt(attempt, safeReportId);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isDismissed =
        errMsg.toLowerCase().includes('dismiss') ||
        errMsg.toLowerCase().includes('cancel') ||
        errMsg.toLowerCase().includes('user did not share');

      const attempt: ShareAttempt = {
        id: attemptId,
        at: now,
        event: isDismissed ? 'cancelled' : 'unknown',
        channelId
      };
      await this.repository.addShareAttempt(attempt, safeReportId);

      if (!isDismissed) {
        throw new Error(`Gagal membuka dialog berbagi sistem: ${errMsg}`);
      }
    }
  }

  /**
   * Text-only copy is permanently blocked to prevent bypass of photo & selfie verification.
   */
  public async copyReport(_report: Report): Promise<void> {
    throw new Error(
      'Fitur salin teks laporan dinonaktifkan untuk mencegah bypass kewajiban lampiran foto dan swafoto pengirim. ' +
      'Gunakan menu berbagi resmi dengan selfie pengirim yang tersimpan/diperiksa berkasnya.'
    );
  }
}
