import { act, renderHook } from '@testing-library/react-native';

import { SEARCH_LOG_IDLE_MS, normalizeSearchQuery, useSearchLogger } from '@/hooks/useSearchLogger';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('normalizeSearchQuery', () => {
  it('should trim, collapse whitespace and lowercase', () => {
    expect(normalizeSearchQuery('  Buddha   Nature ')).toBe('buddha nature');
  });
});

describe('useSearchLogger', () => {
  it('should log once when 2 seconds pass after the last results', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('Karma', 4));
    act(() => {
      jest.advanceTimersByTime(SEARCH_LOG_IDLE_MS - 1);
    });
    expect(log).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('karma', 4);
  });

  it('should not log partial queries when the user keeps typing', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('bud', 10));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => result.current.onTyping());
    act(() => result.current.onResults('buddh', 8));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => result.current.onTyping());
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(log).not.toHaveBeenCalled();
  });

  it('should log immediately on flush when a result is opened', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('emptiness', 2));
    act(() => result.current.flush());

    expect(log).toHaveBeenCalledWith('emptiness', 2);
  });

  it('should not log the same normalised query twice in a row', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('karma', 4));
    act(() => result.current.flush());
    act(() => result.current.onResults('  KARMA ', 4));
    act(() => {
      jest.advanceTimersByTime(SEARCH_LOG_IDLE_MS);
    });

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('should log the same query again after a different one in between', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('karma', 4));
    act(() => result.current.flush());
    act(() => result.current.onResults('compassion', 1));
    act(() => result.current.flush());
    act(() => result.current.onResults('karma', 4));
    act(() => result.current.flush());

    expect(log).toHaveBeenCalledTimes(3);
  });

  it('should not log an empty query', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('   ', 0));
    act(() => result.current.flush());
    act(() => {
      jest.advanceTimersByTime(SEARCH_LOG_IDLE_MS);
    });

    expect(log).not.toHaveBeenCalled();
  });

  it('should log nothing on flush when there are no pending results', () => {
    const log = jest.fn();
    const { result } = renderHook(() => useSearchLogger(log));

    act(() => result.current.flush());

    expect(log).not.toHaveBeenCalled();
  });

  it('should not log after unmount', () => {
    const log = jest.fn();
    const { result, unmount } = renderHook(() => useSearchLogger(log));

    act(() => result.current.onResults('karma', 4));
    unmount();
    jest.advanceTimersByTime(SEARCH_LOG_IDLE_MS * 2);

    expect(log).not.toHaveBeenCalled();
  });
});
