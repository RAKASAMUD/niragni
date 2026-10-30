import {
  CANDIDATE_SMOLVLM2,
  CANDIDATE_VISIONPSY,
  verifyFileIntegrity,
  verifyModelPair
} from '../manifest';
import { QvacNativeWorker } from '../worker';
import { LifecycleCoordinator } from '../core/lifecycle';
import { completion, loadModel } from '@qvac/sdk';

// Mock react-native AppState for LifecycleCoordinator tests in Node environment
jest.mock('react-native', () => {
  let appStateListener: ((state: string) => void) | null = null;
  return {
    AppState: {
      addEventListener: jest.fn((event: string, callback: (state: string) => void) => {
        if (event === 'change') {
          appStateListener = callback;
        }
        return {
          remove: jest.fn(() => {
            appStateListener = null;
          })
        };
      }),
      __simulateTransition: (nextState: string) => {
        if (appStateListener) {
          appStateListener(nextState);
        }
      }
    }
  };
});

// Mock @qvac/sdk for worker lifecycle, streaming, and cancellation
jest.mock('@qvac/sdk', () => {
  return {
    loadModel: jest.fn().mockImplementation(async (opts) => {
      if (opts.modelSrc === 'invalid-path') {
        throw new Error('Model file not found');
      }
      return 'model-mock-qvac-native-readiness';
    }),
    completion: jest.fn().mockImplementation((opts) => {
      return {
        requestId: 'req-mock-native-readiness-001',
        events: (async function* () {
          yield { type: 'contentDelta', text: 'Terlihat kepulan asap putih keabu-abuan ' };
          yield { type: 'contentDelta', text: 'membubung dari arah perkebunan sawit.' };
          yield { type: 'completionDone', stopReason: 'eos' };
        })(),
        stats: Promise.resolve({
          tokensPerSecond: 16.8
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

describe('Native AI Readiness — Candidate Configuration & Integrity Behavior', () => {
  it('enforces Apache-2.0 license and safe context budget (>= 8192) for both candidates', () => {
    // Verifies license audit and budget constraints without redundant constant mirroring
    for (const candidate of [CANDIDATE_SMOLVLM2, CANDIDATE_VISIONPSY]) {
      expect(candidate.license).toBe('Apache-2.0');
      expect(candidate.recommendedConfig.ctx_size).toBeGreaterThanOrEqual(8192);
      expect(candidate.recommendedConfig.device).toBe('cpu');
      expect(candidate.modelFile.expectedBytes).toBeGreaterThan(400_000_000);
      expect(candidate.projectorFile.expectedBytes).toBeGreaterThan(100_000_000);
    }
  });

  it('strictly rejects pair readiness when model or projector has size match but uncomputed SHA-256', () => {
    const unverifiedModelReadiness = verifyModelPair(
      CANDIDATE_SMOLVLM2,
      { exists: true, byteSize: 436808704 }, // sha256 omitted
      { exists: true, byteSize: 108785184, sha256: CANDIDATE_SMOLVLM2.projectorFile.expectedSha256 }
    );
    expect(unverifiedModelReadiness.isReady).toBe(false);
    expect(unverifiedModelReadiness.modelStatus.status).toBe('unverified');
    expect(unverifiedModelReadiness.projectorStatus.status).toBe('valid');

    const unverifiedProjectorReadiness = verifyModelPair(
      CANDIDATE_SMOLVLM2,
      { exists: true, byteSize: 436808704, sha256: CANDIDATE_SMOLVLM2.modelFile.expectedSha256 },
      { exists: true, byteSize: 108785184 } // sha256 omitted
    );
    expect(unverifiedProjectorReadiness.isReady).toBe(false);
    expect(unverifiedProjectorReadiness.modelStatus.status).toBe('valid');
    expect(unverifiedProjectorReadiness.projectorStatus.status).toBe('unverified');
  });

  it('strictly approves pair readiness ONLY when both model and projector have matching byte size and matching SHA-256', () => {
    const validReadiness = verifyModelPair(
      CANDIDATE_SMOLVLM2,
      { exists: true, byteSize: 436808704, sha256: CANDIDATE_SMOLVLM2.modelFile.expectedSha256 },
      { exists: true, byteSize: 108785184, sha256: CANDIDATE_SMOLVLM2.projectorFile.expectedSha256 }
    );
    expect(validReadiness.isReady).toBe(true);
    expect(validReadiness.modelStatus.status).toBe('valid');
    expect(validReadiness.projectorStatus.status).toBe('valid');
  });
});

describe('Native AI Readiness — Controlled Timing, Multi-Photo Mapping & Metrics Contract', () => {
  let worker: QvacNativeWorker;
  let dateSpy: jest.SpyInstance;
  let simulatedTimeMs: number;

  beforeEach(() => {
    worker = new QvacNativeWorker();
    jest.clearAllMocks();

    simulatedTimeMs = 1_700_000_000_000;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => simulatedTimeMs);
  });

  afterEach(async () => {
    await worker.unloadModel();
    dateSpy.mockRestore();
  });

  it('measures distinct positive load and generation durations, enforcing cold total turnaround vs warm reuse', async () => {
    // 1. Controlled loadModel: advances simulated clock by 1,250 ms
    (loadModel as jest.Mock).mockImplementationOnce(async () => {
      simulatedTimeMs += 1250;
      return 'model-mock-qvac-native-readiness';
    });

    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/mock/fixtures/models/model.gguf',
      '/mock/fixtures/models/projector.gguf'
    );

    // 2. Controlled first inference (Cold run): advances clock by 450 ms (first chunk) + 550 ms (remaining generation) = 1,000 ms
    (completion as jest.Mock).mockImplementationOnce(() => {
      return {
        requestId: 'req-cold-001',
        events: (async function* () {
          simulatedTimeMs += 450;
          yield { type: 'contentDelta', text: 'Asap tebal terpantau. ' };
          simulatedTimeMs += 550;
          yield { type: 'contentDelta', text: 'Titik api di semak.' };
          yield { type: 'completionDone', stopReason: 'eos' };
        })(),
        stats: Promise.resolve({ tokensPerSecond: 15.0 })
      };
    });

    const coldResult = await worker.runInference(
      'Analisis foto asap karhutla ini',
      '/mock/fixtures/photos/smoke_sample.jpg'
    );

    expect(coldResult.success).toBe(true);
    expect(coldResult.stats.coldStart).toBe(true);
    // Exact distinct positive durations:
    expect(coldResult.stats.loadDurationMs).toBe(1250);
    expect(coldResult.stats.firstChunkDurationMs).toBe(450);
    expect(coldResult.stats.generationDurationMs).toBe(1000);
    // Cold turnaround MUST be exact sum: 1250 + 1000 = 2250 ms (evaluating < 10,000 ms gate)
    expect(coldResult.stats.totalColdTurnaroundMs).toBe(2250);

    // 3. Controlled second inference (Warm run): advances clock by 600 ms, load duration must NOT be added
    (completion as jest.Mock).mockImplementationOnce(() => {
      return {
        requestId: 'req-warm-002',
        events: (async function* () {
          simulatedTimeMs += 200;
          yield { type: 'contentDelta', text: 'Kondisi vegetasi mengering.' };
          simulatedTimeMs += 400;
          yield { type: 'completionDone', stopReason: 'eos' };
        })(),
        stats: Promise.resolve({ tokensPerSecond: 16.5 })
      };
    });

    const warmResult = await worker.runInference(
      'Analisis lanjutan kondisi vegetasi',
      '/mock/fixtures/photos/vegetation_sample.jpg'
    );

    expect(warmResult.success).toBe(true);
    expect(warmResult.stats.coldStart).toBe(false);
    expect(warmResult.stats.loadDurationMs).toBeUndefined();
    expect(warmResult.stats.generationDurationMs).toBe(600);
    expect(warmResult.stats.totalColdTurnaroundMs).toBeUndefined();
  });

  it('correctly maps multi-photo attachments array into SDK history structure and verifies completion call', async () => {
    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/mock/fixtures/models/model.gguf',
      '/mock/fixtures/models/projector.gguf'
    );

    const multiPhotoPaths = [
      '/mock/fixtures/photos/karhutla_north.jpg',
      '/mock/fixtures/photos/karhutla_east.jpg',
      '/mock/fixtures/photos/karhutla_closeup.jpg'
    ];

    const testPrompt = 'Analisis kondisi asap dari 3 sudut ini';
    const result = await worker.runInference(testPrompt, multiPhotoPaths);

    expect(result.success).toBe(true);

    // Verify exact contract call to @qvac/sdk completion:
    expect(completion).toHaveBeenCalledWith({
      modelId: 'model-mock-qvac-native-readiness',
      history: [
        {
          role: 'user',
          content: testPrompt,
          attachments: [
            { path: '/mock/fixtures/photos/karhutla_north.jpg' },
            { path: '/mock/fixtures/photos/karhutla_east.jpg' },
            { path: '/mock/fixtures/photos/karhutla_closeup.jpg' }
          ]
        }
      ],
      stream: true
    });
  });

  it('tracks delta chunks and characters honestly without fabricating token counts', async () => {
    await worker.loadModel(
      CANDIDATE_SMOLVLM2,
      '/mock/fixtures/models/model.gguf',
      '/mock/fixtures/models/projector.gguf'
    );

    const result = await worker.runInference('Analisis foto asap ini');
    expect(result.success).toBe(true);
    expect(result.stats.deltaChunksCount).toBe(2);
    expect(result.stats.charactersGenerated).toBe(result.text.length);
    expect(result.stats.sdkTokensPerSecond).toBe(16.8); // from mock run.stats
  });
});

describe('Native AI Readiness — Shared Lifecycle Exclusion & Cancellation Contract', () => {
  let coordinator: LifecycleCoordinator;

  beforeEach(() => {
    coordinator = new LifecycleCoordinator();
  });

  it('synchronously acquires lock and throws informative Indonesian error when busy', () => {
    expect(coordinator.isBusy()).toBe(false);

    const token = coordinator.acquire('inferring');
    expect(coordinator.isBusy()).toBe(true);
    expect(coordinator.getCurrentOp()).toBe('inferring');

    // Attempting concurrent operation must fail immediately with Indonesian explanation
    expect(() => coordinator.acquire('downloading')).toThrow(
      'Operasi inferensi AI sedang berlangsung'
    );
    expect(() => coordinator.acquire('checking')).toThrow(
      'Operasi inferensi AI sedang berlangsung'
    );

    coordinator.release('inferring', token);
    expect(coordinator.isBusy()).toBe(false);
    expect(coordinator.getCurrentOp()).toBeNull();
  });

  it('triggers cancellation handler on AppState background transition to protect device RAM', async () => {
    const cancelInferenceSpy = jest.fn().mockResolvedValue(undefined);
    const cancelDownloadSpy = jest.fn().mockResolvedValue(undefined);

    coordinator.setCancellationHandlers({
      cancelInference: cancelInferenceSpy,
      cancelDownload: cancelDownloadSpy
    });

    const token = coordinator.acquire('inferring');

    // Simulate OS transitioning app to background
    const { AppState } = require('react-native');
    AppState.__simulateTransition('background');

    expect(cancelInferenceSpy).toHaveBeenCalledTimes(1);
    expect(cancelDownloadSpy).not.toHaveBeenCalled();

    coordinator.release('inferring', token);
  });
});
