import { holdSplashWhile } from '../../utils/startup';

describe('holdSplashWhile', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Resolves `done` once the promise settles, so timer steps can be asserted. */
  function track(promise: Promise<void>) {
    const state = { done: false };
    promise.then(() => { state.done = true; });
    return state;
  }

  it('should keep the splash up for the minimum time even when the work is instant', async () => {
    // Ana Paula: the red splash "disappears extremely quickly".
    const state = track(holdSplashWhile(() => Promise.resolve(), { minMs: 1000, maxMs: 2500 }));

    await jest.advanceTimersByTimeAsync(999);
    expect(state.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(state.done).toBe(true);
  });

  it('should release the splash at the maximum time when the work is still running', async () => {
    // Never wait on the network: a slow connection must not trap the user.
    const state = track(holdSplashWhile(() => new Promise<void>(() => {}), { minMs: 1000, maxMs: 2500 }));

    await jest.advanceTimersByTimeAsync(2499);
    expect(state.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(state.done).toBe(true);
  });

  it('should release as soon as the work finishes between the minimum and the maximum', async () => {
    let finish: () => void = () => {};
    const work = new Promise<void>((resolve) => { finish = resolve; });
    const state = track(holdSplashWhile(() => work, { minMs: 1000, maxMs: 2500 }));

    await jest.advanceTimersByTimeAsync(1500);
    expect(state.done).toBe(false);
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.done).toBe(true);
  });

  it('should release the splash when the work fails', async () => {
    const state = track(holdSplashWhile(() => Promise.reject(new Error('offline')), { minMs: 1000, maxMs: 2500 }));

    await jest.advanceTimersByTimeAsync(1000);
    expect(state.done).toBe(true);
  });
});
