import { renderHook, act } from '@testing-library/react-native';

import { useCheckoutStatus } from '@/components/membership/useCheckoutStatus';
import { membershipService } from '@/services/membershipService';

const mockRefresh = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshUserData: mockRefresh }),
}));
jest.mock('@/services/membershipService', () => ({
  membershipService: { checkoutStatus: jest.fn() },
}));

const check = membershipService.checkoutStatus as jest.Mock;
const ok = (state: string, method: string | null = null) => ({ success: true, data: { state, method } });
const flush = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRefresh.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

describe('useCheckoutStatus', () => {
  it('should become active and refresh the user once when pending turns into active', async () => {
    check.mockResolvedValueOnce(ok('pending')).mockResolvedValue(ok('active', 'card'));
    const { result } = renderHook(() => useCheckoutStatus('abc'));
    await flush(0);
    expect(result.current.phase).toBe('checking');
    await flush(3000);
    expect(result.current).toEqual({ phase: 'active', method: 'card' });
    await flush(30000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('should report processing for direct debit and stop polling', async () => {
    check.mockResolvedValue(ok('processing', 'direct_debit'));
    const { result } = renderHook(() => useCheckoutStatus('abc'));
    await flush(0);
    expect(result.current).toEqual({ phase: 'processing', method: 'direct_debit' });
    await flush(30000);
    expect(check).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('should report failed and stop polling when the payment is declined', async () => {
    check.mockResolvedValue(ok('failed'));
    const { result } = renderHook(() => useCheckoutStatus('abc'));
    await flush(0);
    expect(result.current.phase).toBe('failed');
    await flush(30000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('should keep polling when a poll fails or throws', async () => {
    check
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue(ok('active', 'card'));
    const { result } = renderHook(() => useCheckoutStatus('abc'));
    await flush(0);
    expect(result.current.phase).toBe('checking');
    await flush(3000);
    expect(result.current.phase).toBe('checking');
    await flush(3000);
    expect(result.current.phase).toBe('active');
  });

  it('should time out after the timeout and make no further calls', async () => {
    check.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCheckoutStatus('abc'));
    await flush(179000);
    expect(result.current.phase).toBe('checking');
    await flush(1000);
    expect(result.current.phase).toBe('timeout');
    const calls = check.mock.calls.length;
    await flush(60000);
    expect(check).toHaveBeenCalledTimes(calls);
  });

  it('should time out while polls keep returning pending', async () => {
    check.mockResolvedValue(ok('pending'));
    const { result } = renderHook(() => useCheckoutStatus('abc', { intervalMs: 1000, timeoutMs: 5000 }));
    await flush(5000);
    expect(result.current.phase).toBe('timeout');
    const calls = check.mock.calls.length;
    await flush(10000);
    expect(check).toHaveBeenCalledTimes(calls);
  });

  it('should stop calling the server after unmount', async () => {
    check.mockResolvedValue(ok('pending'));
    const { unmount } = renderHook(() => useCheckoutStatus('abc'));
    await flush(0);
    expect(check).toHaveBeenCalledTimes(1);
    unmount();
    await flush(60000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('should be missing with zero calls when there is no checkout id', async () => {
    const { result } = renderHook(() => useCheckoutStatus(undefined));
    await flush(10000);
    expect(result.current.phase).toBe('missing');
    expect(check).not.toHaveBeenCalled();
  });
});
