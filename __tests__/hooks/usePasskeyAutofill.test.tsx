import { act, renderHook } from '@testing-library/react-native';

import { usePasskeyAutofill } from '@/hooks/usePasskeyAutofill';
import { signInWithPasskey, supportsPasskeyAutofill } from '@/services/passkeyService';

const mockRefresh = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ refreshAuth: mockRefresh }) }));
jest.mock('@/services/passkeyService', () => ({
  signInWithPasskey: jest.fn(),
  supportsPasskeyAutofill: jest.fn(),
}));

const signIn = signInWithPasskey as jest.Mock;
const supports = supportsPasskeyAutofill as jest.Mock;

/** A request that stays pending until it is aborted, like the browser's conditional mediation. */
function pendingUntilAbort() {
  signIn.mockImplementation(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((resolve) => signal.addEventListener('abort', () => resolve({ ok: false, cancelled: true }))),
  );
}

const flush = () => act(async () => { await jest.advanceTimersByTimeAsync(0); });
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  signIn.mockReset();
  supports.mockReset();
  mockRefresh.mockReset();
  supports.mockResolvedValue(true);
});
afterEach(() => jest.useRealTimers());

describe('usePasskeyAutofill', () => {
  it('should restart the request when it ends without our own abort, at most three times', async () => {
    signIn.mockResolvedValue({ ok: false });
    renderHook(() => usePasskeyAutofill(jest.fn()));
    await flush();
    await advance(10_000);
    expect(signIn).toHaveBeenCalledTimes(4); // first run + 3 restarts
  });

  it('should re-arm every four minutes while the form stays active', async () => {
    pendingUntilAbort();
    renderHook(() => usePasskeyAutofill(jest.fn()));
    await flush();
    expect(signIn).toHaveBeenCalledTimes(1);
    const first = signIn.mock.calls[0][0].signal as AbortSignal;

    await advance(4 * 60 * 1000 + 100);
    expect(first.aborted).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(2);
    await advance(4 * 60 * 1000 + 100);
    expect(signIn).toHaveBeenCalledTimes(3);
  });

  it('should not restart after the submit abort', async () => {
    pendingUntilAbort();
    const { result } = renderHook(() => usePasskeyAutofill(jest.fn()));
    await flush();
    act(() => result.current.abort());
    await advance(5 * 60 * 1000);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('should not restart after unmount', async () => {
    pendingUntilAbort();
    const { unmount } = renderHook(() => usePasskeyAutofill(jest.fn()));
    await flush();
    unmount();
    await advance(5 * 60 * 1000);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('should refresh the session and call back once a passkey is chosen', async () => {
    signIn.mockResolvedValue({ ok: true });
    const done = jest.fn();
    renderHook(() => usePasskeyAutofill(done));
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    await advance(10_000);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
