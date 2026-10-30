import { QvacNativeWorker } from '../worker';
import { CANDIDATE_SMOLVLM2 } from '../manifest';

// Mock @qvac/sdk to test pure worker lifecycle states, timings, and transitions
jest.mock('@qvac/sdk', () => {
  return {
    loadModel: jest.fn().mockImplementation(async (opts) => {
      if (opts.modelSrc === 'invalid-path') {
        throw new Error('Model file not found');
      }
      return 'model-mock-karhutla-12345';
    }),
    completion: jest.fn().mockImplementation((opts) => {
      return {
        requestId: 'req-mock-karhutla-67890',
        events: (async function* () {
          yield { type: 'contentDelta', text: 'Teramati asap tebal ' };
          yield { type: 'contentDelta', text: 'berwarna abu-abu kehitaman ' };
          yield { type: 'contentDelta', text: 'di atas vegetasi semak.' };
          yield { type: 'completionDone', stopReason: 'eos' };
        })(),
        stats: Promise.resolve({
          tokensPerSecond: 14.2
        })
      };
    }),
    unloadModel: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    InferenceCancelledError: class InferenceCancelledError extends Error {
      public requestId: string;
      public partial: any;
      constructor(requestId: string, partial: any) {
        super(`Inference cancelled: ${requestId}`);
        this.name = 'InferenceCancelledError';
        this.requestId = requestId;
        this.partial = partial;
      }
    }
  };
});

describe('QvacNativeWorker State & Honest Metrics', () => {
  let worker: QvacNativeWorker;

  beforeEach(() => {
    worker = new QvacNativeWorker();
  });

  afterEach(async () => {
    await worker.unloadModel();
  });

  it('starts in unloaded state with null model and request IDs', () => {
    expect(worker.isModelLoaded()).toBe(false);
    expect(worker.getLoadedModelId()).toBeNull();
    expect(worker.getCurrentRequestId()).toBeNull();
  });

  it('throws error when running inference before model is loaded', async () => {
    await expect(
      worker.runInference('Analisis foto asap karhutla ini')
    ).rejects.toThrow('Tidak ada model QVAC yang dimuat');
  });

  it('loads model successfully and records load duration', async () => {
    const modelId = await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/data/models/smolvlm2.gguf',
      '/data/models/mmproj.gguf'
    );

    expect(modelId).toBe('model-mock-karhutla-12345');
    expect(worker.isModelLoaded()).toBe(true);
    expect(worker.getLoadedModelId()).toBe('model-mock-karhutla-12345');
  });

  it('runs inference with streaming text chunks and separates cold load vs generation durations', async () => {
    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/data/models/smolvlm2.gguf',
      '/data/models/mmproj.gguf'
    );

    const receivedChunks: string[] = [];
    let firstChunkLatency: number | undefined;

    const result = await worker.runInference(
      'Analisis foto asap ini',
      '/data/photos/karhutla.jpg',
      {
        onChunk: (chunk) => receivedChunks.push(chunk),
        onFirstChunk: (lat) => { firstChunkLatency = lat; }
      }
    );

    expect(result.success).toBe(true);
    expect(result.text).toBe('Teramati asap tebal berwarna abu-abu kehitaman di atas vegetasi semak.');
    expect(receivedChunks.length).toBe(3);
    expect(firstChunkLatency).toBeDefined();

    // Cold run checks
    expect(result.stats.coldStart).toBe(true);
    expect(result.stats.loadDurationMs).toBeDefined();
    expect(result.stats.generationDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.stats.totalColdTurnaroundMs).toBe(
      result.stats.loadDurationMs! + result.stats.generationDurationMs
    );
    expect(result.stats.deltaChunksCount).toBe(3);
    expect(result.stats.charactersGenerated).toBe(result.text.length);
    expect(result.stats.sdkTokensPerSecond).toBe(14.2);

    // Warm run checks: subsequent run is not cold
    const result2 = await worker.runInference('Tanyakan lokasi kejadian');
    expect(result2.stats.coldStart).toBe(false);
    expect(result2.stats.loadDurationMs).toBeUndefined();
    expect(result2.stats.totalColdTurnaroundMs).toBeUndefined();
  });

  it('handles cancellation properly', async () => {
    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/data/models/smolvlm2.gguf',
      '/data/models/mmproj.gguf'
    );

    // Call cancel
    await worker.cancelInference();
    // Verify worker remains functional
    expect(worker.isModelLoaded()).toBe(true);
  });

  it('unloads model and resets state', async () => {
    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/data/models/smolvlm2.gguf',
      '/data/models/mmproj.gguf'
    );
    expect(worker.isModelLoaded()).toBe(true);

    await worker.unloadModel();
    expect(worker.isModelLoaded()).toBe(false);
    expect(worker.getLoadedModelId()).toBeNull();
  });
});
