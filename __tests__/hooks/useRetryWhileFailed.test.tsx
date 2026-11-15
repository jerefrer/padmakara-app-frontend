import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useRetryWhileFailed, RETRY_DELAYS_MS } from '@/hooks/useRetryWhileFailed';

describe('useRetryWhileFailed', () => {
  let appStateListener: ((state: string) => void) | null;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener: any) => {
      appStateListener = listener;
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should retry on its own after a delay when the load failed', () => {
    const retry = jest.fn();

    renderHook(() => useRetryWhileFailed(true, retry));
    jest.advanceTimersByTime(RETRY_DELAYS_MS[0]);

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('should retry when the app comes back to the foreground', () => {
    const retry = jest.fn();

    renderHook(() => useRetryWhileFailed(true, retry));
    appStateListener?.('active');

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('should do nothing while the load has not failed', () => {
    const retry = jest.fn();

    renderHook(() => useRetryWhileFailed(false, retry));
    jest.advanceTimersByTime(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] * 2);
    appStateListener?.('active');

    expect(retry).not.toHaveBeenCalled();
  });

  it('should stop retrying on its own after the last delay', () => {
    const retry = jest.fn();
    const { rerender } = renderHook(({ failed }: { failed: boolean }) => useRetryWhileFailed(failed, retry), {
      initialProps: { failed: true },
    });

    // Each retry fails again: the screen flips failed off while loading, then back on.
    for (const delay of RETRY_DELAYS_MS) {
      jest.advanceTimersByTime(delay);
      rerender({ failed: false });
      rerender({ failed: true });
    }
    jest.advanceTimersByTime(60_000);

    expect(retry).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length);
  });
});
