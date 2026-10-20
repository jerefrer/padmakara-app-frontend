import { act, renderHook } from '@testing-library/react-native';

import { useMagicLinkSignIn } from '@/hooks/useMagicLinkSignIn';
import magicLinkService from '@/services/magicLinkService';

const mockRefreshAuth = jest.fn(() => Promise.resolve());

jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt' }),
}));

const request = magicLinkService.requestMagicLink as jest.Mock;
const check = magicLinkService.checkActivationStatus as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  // reset, not clear: a queued mockResolvedValueOnce must not leak into the next test.
  jest.resetAllMocks();
  check.mockResolvedValue({ success: true, data: { isActivated: false } });
});
afterEach(() => {
  jest.useRealTimers();
});

async function submit(result: any, email = 'ana@example.pt', opts = {}) {
  request.mockResolvedValueOnce(result);
  const hook = renderHook(() => useMagicLinkSignIn(opts));
  act(() => hook.result.current.setEmail(email));
  await act(async () => {
    await hook.result.current.submit();
  });
  return hook;
}

describe('useMagicLinkSignIn', () => {
  it('should refuse an address that is not an email, without calling the server', async () => {
    const { result } = await submit({}, 'not-an-email');
    expect(result.current.error).toBe('invalid');
    expect(result.current.phase).toBe('email');
    expect(request).not.toHaveBeenCalled();
  });

  it('should send the link in the interface language and wait for it', async () => {
    const { result } = await submit({ success: true, data: { status: 'magic_link_sent' } }, '  ana@example.pt ');
    expect(request).toHaveBeenCalledWith('ana@example.pt', 'pt');
    expect(result.current.phase).toBe('sent');
  });

  it('should sign in by itself once the link is opened', async () => {
    const { result } = await submit({ success: true, data: { status: 'magic_link_sent' } });
    check.mockResolvedValueOnce({ success: true, data: { isActivated: false } });
    check.mockResolvedValueOnce({ success: true, data: { isActivated: true } });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('done');
  });

  it('should stop asking the server once the form is reset', async () => {
    const { result } = await submit({ success: true, data: { status: 'magic_link_sent' } });
    act(() => result.current.reset());
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(check).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('email');
  });

  it('should refresh the session straight away when this device is already activated', async () => {
    const { result } = await submit({ success: true, data: { status: 'already_activated' } });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('done');
  });

  it('should hand an unknown address over to the access request', async () => {
    const onApprovalRequired = jest.fn();
    const { result } = await submit({ success: true, data: { status: 'approval_required' } }, 'new@example.pt', {
      onApprovalRequired,
    });
    expect(onApprovalRequired).toHaveBeenCalledWith('new@example.pt');
    expect(result.current.phase).toBe('email');
  });

  it('should say when the connection failed and let the person try again', async () => {
    request.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMagicLinkSignIn());
    act(() => result.current.setEmail('ana@example.pt'));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe('network');
    expect(result.current.phase).toBe('email');
  });

  it('should not resend during the cooldown', async () => {
    const { result } = await submit({ success: true, data: { status: 'magic_link_sent' } });
    await act(async () => {
      await result.current.resend();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.cooldown).toBeGreaterThan(0);
  });

  it('should resend once the cooldown is over', async () => {
    const { result } = await submit({ success: true, data: { status: 'magic_link_sent' } });
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    request.mockResolvedValueOnce({ success: true, data: { status: 'magic_link_sent' } });
    await act(async () => {
      await result.current.resend();
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.resent).toBe(true);
  });
});
