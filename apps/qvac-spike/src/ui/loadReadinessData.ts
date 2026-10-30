/**
 * Polling and data loading coordinator for Readiness screen.
 *
 * Implements React Native / Expo best practices per vercel-react-native-skills:
 * - State ground truth: single authoritative stream of model states.
 * - Sequential ordering: late/out-of-order responses from slow I/O never overwrite newer state.
 * - Overlap prevention: skips poll tick if a previous listModels call is still in flight.
 * - Generation-owned in-flight lock: stale request completions cannot release the lock of an active generation.
 * - Error preservation: background polling does NOT clear user operational errors.
 * - Clean lifecycle cancellation: unmounted or superseded pollers ignore late responses.
 */

export interface ReadinessPollerSource<M> {
  listModels(): Promise<M[]>;
}

export interface ReadinessPollerSink<M> {
  setModels(models: M[]): void;
  setError?(error: string): void;
}

export interface ReadinessPoller {
  poll(): Promise<void>;
  reset(): void;
  isInFlight(): boolean;
}

export function createReadinessPoller<M>(
  source: ReadinessPollerSource<M>,
  sink: ReadinessPollerSink<M>
): ReadinessPoller {
  let activeOwnerSeq: number | null = null;
  let requestSeq = 0;

  return {
    async poll(): Promise<void> {
      // Overlap guard: if previous fetch is still running, skip this tick
      if (activeOwnerSeq !== null) return;
      const seq = ++requestSeq;
      activeOwnerSeq = seq;

      try {
        const result = await source.listModels();
        // Discard stale out-of-order response if a newer request completed or started
        if (seq === requestSeq) {
          sink.setModels(result);
          // Note: Background polling intentionally does NOT call setError(null).
          // Operational errors from download/import/check are preserved for user inspection.
        }
      } catch (err) {
        if (seq === requestSeq && sink.setError) {
          sink.setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        // Only release inFlight if this request is still the active owner of the generation
        if (activeOwnerSeq === seq) {
          activeOwnerSeq = null;
        }
      }
    },
    reset(): void {
      requestSeq++;
      activeOwnerSeq = null;
    },
    isInFlight(): boolean {
      return activeOwnerSeq !== null;
    }
  };
}
