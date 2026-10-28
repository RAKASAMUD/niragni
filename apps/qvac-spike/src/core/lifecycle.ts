/**
 * Shared Lifecycle Exclusion and Background Transition Coordinator for Bara.
 *
 * Enforces:
 * - Single shared lifecycle exclusion across public checkModel, downloadModel, importModel, deleteModel, and generateDraft
 * - Synchronous lock acquisition before any await (eliminates race windows)
 * - Immediate failure with descriptive Indonesian error messages (no deferred surprise operations)
 * - Cancellation methods (cancelModelDownload, cancelGeneration) bypass the lock to signal active operations
 * - AppState background transition handling to safely cancel in-flight operations and protect native device stability
 */

import { AppState, NativeEventSubscription, AppStateStatus } from 'react-native';

export type LifecycleOperation =
  | 'checking'
  | 'downloading'
  | 'importing'
  | 'deleting'
  | 'inferring';

export interface LifecycleCancellationHandlers {
  cancelInference: () => Promise<void>;
  cancelDownload: () => Promise<void>;
}

export class LifecycleCoordinator {
  private currentOp: LifecycleOperation | null = null;
  private currentOwnerToken: number = 0;
  private handlers: LifecycleCancellationHandlers | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;

  constructor() {
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        this.handleBackgroundTransition();
      }
    });
  }

  public setCancellationHandlers(handlers: LifecycleCancellationHandlers): void {
    this.handlers = handlers;
  }

  public getCurrentOp(): LifecycleOperation | null {
    return this.currentOp;
  }

  public isBusy(): boolean {
    return this.currentOp !== null;
  }

  /**
   * Synchronously acquires exclusive lifecycle exclusion.
   * MUST be called before the first await in public entry points.
   * Throws an immediate Indonesian error if another operation is active (no deferred operations).
   */
  public acquire(op: LifecycleOperation): number {
    if (this.currentOp !== null) {
      throw new Error(this.getBusyErrorMessage(this.currentOp));
    }
    this.currentOp = op;
    this.currentOwnerToken = Date.now() + Math.random();
    return this.currentOwnerToken;
  }

  /**
   * Releases exclusive lifecycle lock if held by the given operation.
   */
  public release(op: LifecycleOperation, token?: number): void {
    if (this.currentOp === op) {
      if (token === undefined || token === this.currentOwnerToken) {
        this.currentOp = null;
        this.currentOwnerToken = 0;
      }
    }
  }

  /**
   * Safely signals cancellation when the application transitions to background/inactive,
   * preventing native LMK process kills or lingering CPU/GPU consumption.
   */
  private handleBackgroundTransition(): void {
    if (this.currentOp === 'inferring' && this.handlers) {
      void this.handlers.cancelInference().catch(() => {});
    } else if (this.currentOp === 'downloading' && this.handlers) {
      void this.handlers.cancelDownload().catch(() => {});
    }
  }

  private getBusyErrorMessage(op: LifecycleOperation): string {
    switch (op) {
      case 'inferring':
        return 'Operasi inferensi AI sedang berlangsung. Harap tunggu hingga selesai atau batalkan.';
      case 'downloading':
        return 'Pengunduhan model sedang berlangsung. Harap tunggu hingga selesai atau batalkan.';
      case 'importing':
        return 'Impor model sedang berlangsung. Harap tunggu hingga selesai.';
      case 'checking':
        return 'Pemeriksaan model sedang berlangsung. Harap tunggu hingga selesai.';
      case 'deleting':
        return 'Penghapusan model sedang berlangsung. Harap tunggu hingga selesai.';
      default:
        return 'Operasi pengelolaan model sedang berlangsung. Harap tunggu hingga selesai.';
    }
  }

  public cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const sharedLifecycle = new LifecycleCoordinator();
