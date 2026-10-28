/**
 * Durable Report Repository managing SQLite persistence, monotonic revision increments,
 * stale write protection (CAS changes check), attachment atomicity, and media lifecycle.
 */

import { getDatabase, withWriteLock } from './database';
import {
  Report,
  Attachment,
  ShareAttempt,
  Position,
  Suggestion
} from '../product-contract';
import {
  sanitizeId,
  captureAndProcessPhoto,
  deleteReportMedia,
  deleteAttachmentFiles,
  recoverAndCleanOrphans
} from './media';

interface ReportRow {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  observationTime: string;
  timezone: string;
  rawText: string;
  reviewedText: string;
  observerLocation: string | null;
  incidentLocationText: string;
  includeObserverLocation: number;
  suggestion: string | null;
  suggestionRevision: number | null;
}

interface AttachmentRow {
  id: string;
  reportId: string;
  uri: string;
  analysisUri: string;
  hash: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  source: 'camera' | 'library';
  selectedForShare: number;
  createdAt: string;
}

interface ShareAttemptRow {
  id: string;
  reportId: string;
  at: string;
  event: 'share_sheet_opened' | 'handoff_observed' | 'cancelled' | 'unknown';
  channelId: string | null;
}

export class ReportRepository {
  /**
   * Initializes repository and performs startup orphan media cleanup.
   */
  public async init(): Promise<void> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ uri: string; analysisUri: string }>(
      'SELECT uri, analysisUri FROM attachments'
    );
    const activeUris = new Set<string>();
    for (const r of rows) {
      if (r.uri) activeUris.add(r.uri);
      if (r.analysisUri) activeUris.add(r.analysisUri);
    }
    await recoverAndCleanOrphans(activeUris);
  }

  /**
   * Retrieves all reports ordered by updatedAt descending.
   */
  public async listReports(): Promise<Report[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ReportRow>(
      'SELECT * FROM reports ORDER BY updatedAt DESC'
    );

    const reports: Report[] = [];
    for (const row of rows) {
      const full = await this.hydrateReport(row);
      reports.push(full);
    }
    return reports;
  }

  /**
   * Creates a new blank report with revision 1 and explicit timezone fallback.
   */
  public async createReport(): Promise<Report> {
    return withWriteLock(async (db) => {
      const now = new Date().toISOString();
      const id = sanitizeId(`rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
      let tz = 'UTC';
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {}

      const report: Report = {
        id,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        observationTime: now,
        timezone: tz,
        rawText: '',
        reviewedText: '',
        observerLocation: null,
        incidentLocationText: '',
        includeObserverLocation: false,
        attachments: [],
        suggestion: null,
        suggestionRevision: null,
        shareAttempts: []
      };

      await db.runAsync(
        `INSERT INTO reports (
          id, revision, createdAt, updatedAt, observationTime, timezone,
          rawText, reviewedText, observerLocation, incidentLocationText,
          includeObserverLocation, suggestion, suggestionRevision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          report.id,
          report.revision,
          report.createdAt,
          report.updatedAt,
          report.observationTime,
          report.timezone,
          report.rawText,
          report.reviewedText,
          null,
          report.incidentLocationText,
          0,
          null,
          null
        ]
      );

      return report;
    });
  }

  /**
   * Fetches a single report by ID along with its attachments and share attempts.
   */
  public async getReport(id: string): Promise<Report | null> {
    const safeId = sanitizeId(id);
    const db = await getDatabase();
    const row = await db.getFirstAsync<ReportRow>(
      'SELECT * FROM reports WHERE id = ?',
      [safeId]
    );
    if (!row) return null;
    return this.hydrateReport(row);
  }

  /**
   * Persists report updates with monotonic revision increment and stale write protection (CAS).
   * Automatically clears outdated AI suggestions if core input fields changed.
   */
  public async saveReport(report: Report): Promise<Report> {
    const safeId = sanitizeId(report.id);

    return withWriteLock(async (db) => {
      const existing = await db.getFirstAsync<ReportRow>(
        'SELECT * FROM reports WHERE id = ?',
        [safeId]
      );

      if (!existing) {
        throw new Error(`Laporan dengan ID '${safeId}' tidak ditemukan di basis data.`);
      }

      if (existing.revision !== report.revision) {
        throw new Error(
          `Penolakan penulisan kedaluwarsa (stale revision). Revisi tersimpan: ${existing.revision}, revisi diajukan: ${report.revision}.`
        );
      }

      const nextRevision = existing.revision + 1;
      const now = new Date().toISOString();

      // Check if core AI observation inputs changed
      const inputsChanged =
        existing.rawText !== report.rawText ||
        existing.observationTime !== report.observationTime ||
        existing.timezone !== report.timezone ||
        existing.incidentLocationText !== report.incidentLocationText ||
        existing.observerLocation !== (report.observerLocation ? JSON.stringify(report.observerLocation) : null);

      let finalSuggestion = report.suggestion;
      let finalSuggestionRevision = report.suggestionRevision;

      const existingSuggestionJson = existing.suggestion;
      const newSuggestionJson = report.suggestion ? JSON.stringify(report.suggestion) : null;

      if (inputsChanged) {
        // If inputs changed and the suggestion was not freshly provided with this save, invalidate stale suggestion
        if (newSuggestionJson === existingSuggestionJson) {
          finalSuggestion = null;
          finalSuggestionRevision = null;
        } else if (report.suggestion && report.suggestionRevision === null) {
          finalSuggestionRevision = existing.revision;
        }
      } else if (report.suggestion && report.suggestionRevision === null) {
        finalSuggestionRevision = existing.revision;
      }

      await db.withExclusiveTransactionAsync(async (txn) => {
        const updateResult = await txn.runAsync(
          `UPDATE reports SET
            revision = ?,
            updatedAt = ?,
            observationTime = ?,
            timezone = ?,
            rawText = ?,
            reviewedText = ?,
            observerLocation = ?,
            incidentLocationText = ?,
            includeObserverLocation = ?,
            suggestion = ?,
            suggestionRevision = ?
          WHERE id = ? AND revision = ?`,
          [
            nextRevision,
            now,
            report.observationTime,
            report.timezone,
            report.rawText,
            report.reviewedText,
            report.observerLocation ? JSON.stringify(report.observerLocation) : null,
            report.incidentLocationText,
            report.includeObserverLocation ? 1 : 0,
            finalSuggestion ? JSON.stringify(finalSuggestion) : null,
            finalSuggestionRevision ?? null,
            safeId,
            existing.revision
          ]
        );

        // Strict CAS verification: ensure exactly 1 row was updated
        if (updateResult.changes !== 1) {
          throw new Error(
            `Gagal memperbarui laporan '${safeId}': terdeteksi penulisan bersaing (CAS mismatch).`
          );
        }

        // Update selectedForShare preferences for attachments strictly scoped to this report
        for (const att of report.attachments) {
          await txn.runAsync(
            'UPDATE attachments SET selectedForShare = ? WHERE id = ? AND reportId = ?',
            [att.selectedForShare ? 1 : 0, att.id, safeId]
          );
        }
      });

      const updated = await this.getReport(safeId);
      if (!updated) {
        throw new Error(`Gagal memuat ulang laporan '${safeId}' setelah penyimpanan.`);
      }
      return updated;
    });
  }

  /**
   * Deletes a report and its associated files and database records.
   */
  public async deleteReport(id: string): Promise<void> {
    const safeId = sanitizeId(id);

    await withWriteLock(async (db) => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('DELETE FROM share_attempts WHERE reportId = ?', [safeId]);
        await txn.runAsync('DELETE FROM attachments WHERE reportId = ?', [safeId]);
        await txn.runAsync('DELETE FROM reports WHERE id = ?', [safeId]);
      });
      // Delete physical media files and export copies
      await deleteReportMedia(safeId);
    });
  }

  /**
   * Prompts user and processes photo into the report's attachments.
   * Atomically updates parent report revision and clears outdated AI suggestion.
   * Rolls back physical files if database commit fails.
   */
  public async addPhoto(
    reportId: string,
    source: 'camera' | 'library'
  ): Promise<Attachment | null> {
    const safeId = sanitizeId(reportId);
    const existing = await this.getReport(safeId);
    if (!existing) {
      throw new Error(`Laporan '${safeId}' tidak ditemukan.`);
    }

    const attachment = await captureAndProcessPhoto(
      safeId,
      source,
      existing.attachments.length
    );

    if (!attachment) {
      return null; // Cancelled
    }

    // Persist attachment into database atomically with parent report revision increment
    try {
      await withWriteLock(async (db) => {
        await db.withExclusiveTransactionAsync(async (txn) => {
          // Re-verify report existence and attachment count inside lock
          const countRow = await txn.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM attachments WHERE reportId = ?',
            [safeId]
          );
          const currentCount = countRow?.count ?? 0;
          if (currentCount >= 3) {
            throw new Error('Batas maksimal 3 foto telah tercapai oleh proses lain.');
          }

          // Insert new attachment
          await txn.runAsync(
            `INSERT INTO attachments (
              id, reportId, uri, analysisUri, hash, mime, width, height, bytes, source, selectedForShare, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              attachment.id,
              safeId,
              attachment.uri,
              attachment.analysisUri,
              attachment.hash,
              attachment.mime,
              attachment.width,
              attachment.height,
              attachment.bytes,
              attachment.source,
              attachment.selectedForShare ? 1 : 0,
              new Date().toISOString()
            ]
          );

          // Update parent revision, updatedAt, and clear outdated suggestion
          const now = new Date().toISOString();
          await txn.runAsync(
            `UPDATE reports SET
              revision = revision + 1,
              updatedAt = ?,
              suggestion = NULL,
              suggestionRevision = NULL
            WHERE id = ?`,
            [now, safeId]
          );
        });
      });

      return attachment;
    } catch (err) {
      // Rollback physical files if database write fails
      await deleteAttachmentFiles(attachment.uri, attachment.analysisUri);
      throw err;
    }
  }

  /**
   * Removes an attachment and deletes its physical files.
   * Atomically updates parent report revision and clears outdated AI suggestion.
   */
  public async removePhoto(reportId: string, attachmentId: string): Promise<Report> {
    const safeId = sanitizeId(reportId);
    const safeAttId = sanitizeId(attachmentId);

    return withWriteLock(async (db) => {
      const att = await db.getFirstAsync<AttachmentRow>(
        'SELECT * FROM attachments WHERE id = ? AND reportId = ?',
        [safeAttId, safeId]
      );

      if (att) {
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            'DELETE FROM attachments WHERE id = ? AND reportId = ?',
            [safeAttId, safeId]
          );

          // Increment parent revision, update updatedAt, clear outdated suggestion
          const now = new Date().toISOString();
          await txn.runAsync(
            `UPDATE reports SET
              revision = revision + 1,
              updatedAt = ?,
              suggestion = NULL,
              suggestionRevision = NULL
            WHERE id = ?`,
            [now, safeId]
          );
        });

        await deleteAttachmentFiles(att.uri, att.analysisUri);
      }

      const updated = await this.getReport(safeId);
      if (!updated) {
        throw new Error(`Laporan '${safeId}' tidak ditemukan setelah menghapus lampiran.`);
      }
      return updated;
    });
  }

  /**
   * Records a share attempt into the database.
   */
  public async addShareAttempt(attempt: ShareAttempt, reportId: string): Promise<void> {
    const safeId = sanitizeId(reportId);

    await withWriteLock(async (db) => {
      await db.runAsync(
        `INSERT INTO share_attempts (id, reportId, at, event, channelId)
         VALUES (?, ?, ?, ?, ?)`,
        [
          attempt.id,
          safeId,
          attempt.at,
          attempt.event,
          attempt.channelId ?? null
        ]
      );
    });
  }

  private async hydrateReport(row: ReportRow): Promise<Report> {
    const db = await getDatabase();

    // Fetch attachments
    const attRows = await db.getAllAsync<AttachmentRow>(
      'SELECT * FROM attachments WHERE reportId = ? ORDER BY createdAt ASC',
      [row.id]
    );

    const attachments: Attachment[] = attRows.map((r) => ({
      id: r.id,
      reportId: r.reportId,
      uri: r.uri,
      analysisUri: r.analysisUri,
      hash: r.hash,
      mime: r.mime,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      source: r.source,
      selectedForShare: Boolean(r.selectedForShare)
    }));

    // Fetch share attempts
    const shareRows = await db.getAllAsync<ShareAttemptRow>(
      'SELECT * FROM share_attempts WHERE reportId = ? ORDER BY at DESC',
      [row.id]
    );

    const shareAttempts: ShareAttempt[] = shareRows.map((r) => ({
      id: r.id,
      at: r.at,
      event: r.event,
      channelId: r.channelId ?? undefined
    }));

    let observerLocation: Position | null = null;
    if (row.observerLocation) {
      try {
        observerLocation = JSON.parse(row.observerLocation);
      } catch {}
    }

    let suggestion: Suggestion | null = null;
    if (row.suggestion) {
      try {
        suggestion = JSON.parse(row.suggestion);
      } catch {}
    }

    return {
      id: row.id,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      observationTime: row.observationTime,
      timezone: row.timezone,
      rawText: row.rawText,
      reviewedText: row.reviewedText,
      observerLocation,
      incidentLocationText: row.incidentLocationText,
      includeObserverLocation: Boolean(row.includeObserverLocation),
      attachments,
      suggestion,
      suggestionRevision: row.suggestionRevision,
      shareAttempts
    };
  }
}
