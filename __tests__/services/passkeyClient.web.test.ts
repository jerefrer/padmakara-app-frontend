import { startAuthentication, WebAuthnAbortService } from '@simplewebauthn/browser';
import client from '@/services/passkeyClient.web';

jest.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: jest.fn(),
  browserSupportsWebAuthnAutofill: jest.fn(),
  startAuthentication: jest.fn(),
  startRegistration: jest.fn(),
  WebAuthnAbortService: { cancelCeremony: jest.fn() },
}));

const start = startAuthentication as jest.Mock;
const cancel = WebAuthnAbortService.cancelCeremony as jest.Mock;

describe('passkeyClient.web get', () => {
  it('should request browser autofill when asked', async () => {
    start.mockResolvedValue({ id: 'x' });

    await client.get({ challenge: 'c' }, { autofill: true });

    expect(start).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' }, useBrowserAutofill: true });
  });

  it('should cancel the pending ceremony when the signal aborts', async () => {
    let reject!: (e: unknown) => void;
    start.mockReturnValue(new Promise((_, r) => (reject = r)));
    const controller = new AbortController();

    const pending = client.get({}, { autofill: true, signal: controller.signal });
    controller.abort();

    expect(cancel).toHaveBeenCalledTimes(1);
    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('should reject without starting when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(client.get({}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(start).not.toHaveBeenCalled();
  });
});

describe('passkeyClient.web isCancelled', () => {
  it('should treat NotAllowedError and AbortError as cancellation only', () => {
    expect(client.isCancelled({ name: 'NotAllowedError' })).toBe(true);
    expect(client.isCancelled({ name: 'AbortError' })).toBe(true);
    expect(client.isCancelled({ name: 'SecurityError' })).toBe(false);
    expect(client.isCancelled(null)).toBe(false);
  });
});
