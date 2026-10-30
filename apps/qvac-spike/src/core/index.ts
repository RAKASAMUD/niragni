/**
 * Production Core Services implementation for Bara.
 * Fulfills the exact frozen ProductServices interface contract from src/product-contract.ts.
 */

import {
  ProductServices,
  Report,
  Attachment,
  SenderSelfie,
  Position,
  ModelState,
  Channel,
  AiResult,
  ExportPreview,
  ShareStage
} from '../product-contract';

import { QvacNativeWorker } from '../worker';
import { ReportRepository } from './repository';
import { ModelManager } from './models';
import { AiDraftGenerator } from './ai';
import { ExportService } from './export';
import { getObserverLocation } from './location';
import { listChannels, openDialer } from './channels';
import { sharedLifecycle } from './lifecycle';

class BaraProductServices implements ProductServices {
  private worker: QvacNativeWorker;
  private repository: ReportRepository;
  private modelManager: ModelManager;
  private aiGenerator: AiDraftGenerator;
  private exportService: ExportService;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.worker = new QvacNativeWorker();
    this.repository = new ReportRepository();
    this.modelManager = new ModelManager(this.worker, sharedLifecycle);
    this.aiGenerator = new AiDraftGenerator(this.worker, this.modelManager, sharedLifecycle);
    this.exportService = new ExportService(this.repository);

    sharedLifecycle.setCancellationHandlers({
      cancelInference: async () => {
        await this.aiGenerator.cancelGeneration();
      },
      cancelDownload: async () => {
        await this.modelManager.cancelModelDownload();
      }
    });
  }

  /**
   * Initializes services with memoized singleflight promise to prevent concurrent race conditions.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.repository.init();
        this.initialized = true;
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }

    return this.initPromise;
  }

  // --- Reports & Attachments ---

  public async listReports(): Promise<Report[]> {
    await this.init();
    return this.repository.listReports();
  }

  public async createReport(): Promise<Report> {
    await this.init();
    return this.repository.createReport();
  }

  public async getReport(id: string): Promise<Report | null> {
    await this.init();
    return this.repository.getReport(id);
  }

  public async saveReport(report: Report): Promise<Report> {
    await this.init();
    return this.repository.saveReport(report);
  }

  public async deleteReport(id: string): Promise<void> {
    await this.init();
    return this.repository.deleteReport(id);
  }

  public async addPhoto(
    reportId: string,
    source: 'camera' | 'library'
  ): Promise<Attachment | null> {
    await this.init();
    return this.repository.addPhoto(reportId, source);
  }

  public async removePhoto(reportId: string, attachmentId: string): Promise<Report> {
    await this.init();
    return this.repository.removePhoto(reportId, attachmentId);
  }

  // --- Sender Selfie (Front Camera) ---

  public async captureSenderSelfie(reportId: string): Promise<SenderSelfie | null> {
    await this.init();
    return this.repository.captureSenderSelfie(reportId);
  }

  public async removeSenderSelfie(reportId: string): Promise<Report> {
    await this.init();
    return this.repository.removeSenderSelfie(reportId);
  }

  // --- Geolocation ---

  public async getObserverLocation(): Promise<Position> {
    return getObserverLocation();
  }

  // --- AI Models & Management ---

  public async listModels(): Promise<ModelState[]> {
    await this.init();
    return this.modelManager.listModels();
  }

  public async downloadModel(
    candidateId: string,
    onProgress: (state: ModelState) => void
  ): Promise<ModelState> {
    await this.init();
    return this.modelManager.downloadModel(candidateId, onProgress);
  }

  public async cancelModelDownload(): Promise<void> {
    return this.modelManager.cancelModelDownload();
  }

  public async importModel(
    candidateId: string,
    onProgress: (state: ModelState) => void
  ): Promise<ModelState> {
    await this.init();
    return this.modelManager.importModel(candidateId, onProgress);
  }

  public async checkModel(candidateId: string): Promise<ModelState> {
    await this.init();
    return this.modelManager.checkModel(candidateId);
  }

  public async deleteModel(candidateId: string): Promise<void> {
    await this.init();
    return this.modelManager.deleteModel(candidateId);
  }

  // --- AI Drafting ---

  public async generateDraft(report: Report, candidateId: string): Promise<AiResult> {
    await this.init();
    return this.aiGenerator.generateDraft(report, candidateId);
  }

  public async cancelGeneration(): Promise<void> {
    return this.aiGenerator.cancelGeneration();
  }

  // --- Channels & Export ---

  public listChannels(): Channel[] {
    return listChannels();
  }

  public async previewExport(report: Report): Promise<ExportPreview> {
    return this.exportService.previewExport(report);
  }

  public async shareReport(report: Report, channelId?: string, onProgress?: (stage: ShareStage) => void): Promise<void> {
    await this.init();
    return this.exportService.shareReport(report, channelId, onProgress);
  }


  public async openDialer(channelId: string): Promise<void> {
    return openDialer(channelId);
  }
}

export const services: ProductServices = new BaraProductServices();
export default services;
