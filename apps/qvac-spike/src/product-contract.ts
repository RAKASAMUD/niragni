// Shared product boundary. Coordinator owns changes; UI and core workers must agree through Orca.
export type Source = 'user' | 'metadata' | 'ai_visual';
export interface Observation { text: string; source: Source; sourceRef: string; uncertain: boolean }
export interface Suggestion { summary: string; observations: Observation[]; missingFields: string[]; questions: string[] }
export interface Position { latitude: number; longitude: number; accuracy: number | null; timestamp: string }
export interface Attachment { id: string; reportId: string; uri: string; analysisUri: string; hash: string; mime: string; width: number; height: number; bytes: number; source: 'camera' | 'library'; selectedForShare: boolean }
export interface ShareAttempt { id: string; at: string; event: 'share_sheet_opened' | 'handoff_observed' | 'cancelled' | 'unknown'; channelId?: string }
export interface Report { id: string; revision: number; createdAt: string; updatedAt: string; observationTime: string; timezone: string; rawText: string; reviewedText: string; observerLocation: Position | null; incidentLocationText: string; includeObserverLocation: boolean; attachments: Attachment[]; suggestion: Suggestion | null; suggestionRevision: number | null; shareAttempts: ShareAttempt[] }
export interface ModelState { candidateId: string; name: string; status: 'missing' | 'downloading' | 'verifying' | 'installed' | 'ready' | 'failed' | 'incompatible'; downloadedBytes: number; totalBytes: number; requiredBytes: number; error?: string; lastLocalCheck?: string; modelPath?: string; projectorPath?: string }
export interface Channel { id: string; label: string; destination: string; kind: 'phone' | 'whatsapp' | 'email'; scope: string; sourceUrl: string; checkedAt: string; availability: 'public' | 'unconfirmed' }
export interface AiResult { reportId: string; inputRevision: number; suggestion: Suggestion; durationMs: number }
export interface ExportPreview { text: string; photoUris: string[] }
export interface ProductServices {
  init(): Promise<void>;
  listReports(): Promise<Report[]>;
  createReport(): Promise<Report>;
  getReport(id: string): Promise<Report | null>;
  saveReport(report: Report): Promise<Report>;
  deleteReport(id: string): Promise<void>;
  addPhoto(reportId: string, source: 'camera' | 'library'): Promise<Attachment | null>;
  removePhoto(reportId: string, attachmentId: string): Promise<Report>;
  getObserverLocation(): Promise<Position>;
  listModels(): Promise<ModelState[]>;
  downloadModel(candidateId: string, onProgress: (state: ModelState) => void): Promise<ModelState>;
  cancelModelDownload(): Promise<void>;
  importModel(candidateId: string, onProgress: (state: ModelState) => void): Promise<ModelState>;
  checkModel(candidateId: string): Promise<ModelState>;
  deleteModel(candidateId: string): Promise<void>;
  generateDraft(report: Report, candidateId: string): Promise<AiResult>;
  cancelGeneration(): Promise<void>;
  listChannels(): Channel[];
  previewExport(report: Report): Promise<ExportPreview>;
  shareReport(report: Report, channelId?: string): Promise<void>;
  copyReport(report: Report): Promise<void>;
  openDialer(channelId: string): Promise<void>;
}
// Implemented by AGY at src/core/index.ts: export const services: ProductServices.
