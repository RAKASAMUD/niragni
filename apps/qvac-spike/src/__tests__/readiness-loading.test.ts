import { createReadinessPoller } from '../ui/loadReadinessData';

describe('createReadinessPoller — async lifecycle and error preservation', () => {
  it('does not wipe out operational error when background listModels succeeds', async () => {
    let currentError: string | null = 'Operasi impor gagal: checksum mismatch';
    let currentModels: string[] = [];

    const source = {
      listModels: jest.fn().mockResolvedValue(['model-smolvlm2']),
    };

    const sink = {
      setModels: (models: string[]) => { currentModels = models; },
      setError: (err: string | null) => { currentError = err; },
    };

    const poller = createReadinessPoller(source, sink);

    await poller.poll();

    // Models updated
    expect(currentModels).toEqual(['model-smolvlm2']);
    // Operational error must NOT be cleared to null by background poll
    expect(currentError).toBe('Operasi impor gagal: checksum mismatch');
  });

  it('skips overlapping poll while previous listModels is still in-flight', async () => {
    let finishFirstCall!: (v: string[]) => void;
    const firstPromise = new Promise<string[]>((res) => { finishFirstCall = res; });

    const source = {
      listModels: jest.fn()
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce(['model-second']),
    };

    const sink = {
      setModels: jest.fn(),
    };

    const poller = createReadinessPoller(source, sink);

    // Start first poll
    const p1 = poller.poll();
    expect(poller.isInFlight()).toBe(true);

    // Second poll fired while first is in flight (e.g. interval tick)
    const p2 = poller.poll();

    // Source listModels should only have been called ONCE
    expect(source.listModels).toHaveBeenCalledTimes(1);

    finishFirstCall(['model-first']);
    await Promise.all([p1, p2]);

    expect(poller.isInFlight()).toBe(false);
    expect(sink.setModels).toHaveBeenCalledWith(['model-first']);
  });

  it('discards stale listModels result when a newer request has already finished', async () => {
    let finishSlowCall!: (v: string[]) => void;
    const slowPromise = new Promise<string[]>((res) => { finishSlowCall = res; });

    let callCount = 0;
    const source = {
      listModels: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return slowPromise;
        return Promise.resolve(['model-fresh']);
      }),
    };

    let latestModels: string[] = [];
    const sink = {
      setModels: (models: string[]) => { latestModels = models; },
    };

    const poller = createReadinessPoller(source, sink);

    // First call: slow
    const p1 = poller.poll();

    // Reset poller (simulating forced refresh or state reset) and trigger second call
    poller.reset();
    const p2 = poller.poll();
    await p2;

    expect(latestModels).toEqual(['model-fresh']);

    // Now slow call resolves late
    finishSlowCall(['model-stale']);
    await p1;

    // Stale result must NOT overwrite the fresh result
    expect(latestModels).toEqual(['model-fresh']);
  });

  it('surfaces error if listModels itself fails', async () => {
    let currentError: string | null = null;
    const source = {
      listModels: jest.fn().mockRejectedValue(new Error('SQLite busy: lock timeout')),
    };

    const sink = {
      setModels: jest.fn(),
      setError: (err: string | null) => { currentError = err; },
    };

    const poller = createReadinessPoller(source, sink);
    await poller.poll();

    expect(currentError).toBe('SQLite busy: lock timeout');
  });
  it('does not allow stale completion to release in-flight guard of an active generation', async () => {
    let finishA;
    const promiseA = new Promise((res) => { finishA = res; });
    let finishB;
    const promiseB = new Promise((res) => { finishB = res; });
    const source = {
      listModels: jest.fn()
        .mockReturnValueOnce(promiseA)
        .mockReturnValueOnce(promiseB)
        .mockResolvedValue(['model-c']),
    };
    const sink = {
      setModels: jest.fn(),
    };
    const poller = createReadinessPoller(source, sink);
    const pollA = poller.poll();
    expect(source.listModels).toHaveBeenCalledTimes(1);
    expect(poller.isInFlight()).toBe(true);
    poller.reset();
    const pollB = poller.poll();
    expect(source.listModels).toHaveBeenCalledTimes(2);
    expect(poller.isInFlight()).toBe(true);
    finishA(['model-stale-a']);
    await pollA;
    expect(poller.isInFlight()).toBe(true);
    const pollC = poller.poll();
    expect(source.listModels).toHaveBeenCalledTimes(2);
    finishB(['model-fresh-b']);
    await pollB;
    await pollC;
    expect(poller.isInFlight()).toBe(false);
    expect(sink.setModels).toHaveBeenCalledWith(['model-fresh-b']);
    expect(sink.setModels).not.toHaveBeenCalledWith(['model-stale-a']);
  });
});
