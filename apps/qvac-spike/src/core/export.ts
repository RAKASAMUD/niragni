/**
 * Export formatting, EXIF stripping, OS share sheet handoff, and clipboard integration.
 * Enforces:
 * - Preview shows selected photos and optional observer GPS only
 * - EXIF metadata stripped via re-encoding in private cache directory
 * - Explicit timezone and GPS timestamp in export text for regional clarity
 * - NEVER falls back to original photos if re-encoding fails (privacy guarantee)
 * - Temporary export files scoped per report (bara_exports/<reportId>/)
 * - Export files preserved during session; cleaned at next startup or report deletion
 * - Honest share events (share_sheet_opened, cancelled, unknown) - NO invented delivery proof
 * - Content and coordinates never logged
 */

import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import Share from 'react-native-share';
import { Report, ExportPreview, ShareAttempt } from '../product-contract';
import { ReportRepository } from './repository';
import { getReportExportsDir, sanitizeId } from './media';

export class ExportService {
  private repository: ReportRepository;

  constructor(repository: ReportRepository) {
    this.repository = repository;
  }

  /**
   * Generates formatted text preview and lists selected photo URIs.
   * Includes explicit timezone alongside observation time and GPS timestamp alongside accuracy.
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
    lines.push('Disiapkan secara lokal melalui aplikasi Bara (tanpa pengiriman otomatis).');

    return {
      text: lines.join('\n'),
      photoUris
    };
  }

  /**
   * Re-encodes selected photos to strip EXIF metadata, creates sanitized export copies,
   * opens the OS native share sheet, and records the share attempt event.
   * If re-encoding fails for any photo, fails explicitly rather than leaking original EXIF.
   */
  public async shareReport(report: Report, channelId?: string): Promise<void> {
    const safeReportId = sanitizeId(report.id);
    const preview = await this.previewExport(report);
    const selectedAttachments = (report.attachments || []).filter((a) => a.selectedForShare);

    // Prepare private cache export directory scoped strictly to this report
    const exportsDir = getReportExportsDir(safeReportId);
    if (!exportsDir.exists) {
      exportsDir.create({ intermediates: true, idempotent: true });
    }

    const exportBatchId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sanitizedUris: string[] = [];

    // Strip EXIF metadata from each selected photo
    for (let i = 0; i < selectedAttachments.length; i++) {
      const att = selectedAttachments[i];
      try {
        const manipResult = await manipulateAsync(att.uri, [], {
          compress: 0.9,
          format: SaveFormat.JPEG
        });
        const destFile = new File(exportsDir, `${exportBatchId}_photo_${i + 1}.jpg`);
        new File(manipResult.uri).copy(destFile);
        sanitizedUris.push(destFile.uri);
      } catch (err: unknown) {
        // Strict privacy policy: NEVER fallback to raw original which contains hidden EXIF/GPS tags
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Gagal melakukan sanitasi penghapusan EXIF pada foto lampiran (${errMsg}). ` +
          `Demi menjaga privasi Anda, foto asli tidak dikirimkan. Harap hapus pilihan foto ini atau coba kembali.`
        );
      }
    }

    const attemptId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    try {
      const shareOptions: {
        title: string;
        message: string;
        urls?: string[];
        url?: string;
      } = {
        title: 'Laporan Pengamatan Karhutla',
        message: preview.text
      };

      if (sanitizedUris.length > 0) {
        shareOptions.urls = sanitizedUris;
      }

      await Share.open(shareOptions);

      // Record honest share_sheet_opened event (Option A does not claim delivery)
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
   * Copies formatted text to system clipboard.
   */
  public async copyReport(report: Report): Promise<void> {
    const preview = await this.previewExport(report);
    await Clipboard.setStringAsync(preview.text);
  }
}
