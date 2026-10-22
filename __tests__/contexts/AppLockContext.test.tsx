import React from 'react';
import { AppState, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppLockProvider } from '@/contexts/AppLockContext';
import * as appLock from '@/services/appLock';

let mockAuth: { isAuthenticated: boolean; isLoading: boolean };
let appStateHandler: ((s: string) => void) | undefined;

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/services/appLock', () => ({
  ...jest.requireActual('@/services/appLock'),
  getAppLockEnabled: jest.fn(),
  setAppLockEnabled: jest.fn(async () => undefined),
  biometricKind: jest.fn(async () => 'faceId'),
  authenticate: jest.fn(),
}));

const svc = appLock as jest.Mocked<typeof appLock>;
const MINUTE = 60 * 1000;
let now = 1_000_000;

const flush = () => act(async () => {});
function setup() {
  return render(
    <AppLockProvider>
      <Text>content</Text>
    </AppLockProvider>,
  );
}
const goBackground = () => act(() => appStateHandler?.('background'));
const comeBack = () => act(() => appStateHandler?.('active'));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: true, isLoading: false };
  svc.getAppLockEnabled.mockResolvedValue(true);
  svc.biometricKind.mockResolvedValue('faceId');
  svc.authenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
  now = 1_000_000;
  appStateHandler = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (s: string) => void) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as any);
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

describe('AppLockProvider', () => {
  it('should lock at start and prompt once when the lock is on and the person is signed in', async () => {
    const screen = setup();
    await flush();
    expect(screen.getByTestId('app-lock-screen')).toBeTruthy();
    expect(svc.authenticate).toHaveBeenCalledTimes(1);
  });

  it('should offer an unlock button when the first prompt is cancelled', async () => {
    const screen = setup();
    await flush();
    svc.authenticate.mockResolvedValue({ success: true });
    fireEvent.press(screen.getByTestId('app-lock-unlock'));
    await flush();
    expect(svc.authenticate).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('should show that it is unlocking, without the button, while the prompt is open', async () => {
    let finish: (r: { success: boolean }) => void = () => undefined;
    svc.authenticate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const screen = setup();
    await flush();
    expect(screen.getByTestId('app-lock-prompting')).toBeTruthy();
    expect(screen.queryByTestId('app-lock-unlock')).toBeNull();
    await act(async () => finish({ success: false }));
    expect(screen.queryByTestId('app-lock-prompting')).toBeNull();
    expect(screen.getByTestId('app-lock-unlock')).toBeTruthy();
  });

  it('should hide the lock screen when the first prompt succeeds', async () => {
    svc.authenticate.mockResolvedValue({ success: true });
    const screen = setup();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('should not lock when the lock is off', async () => {
    svc.getAppLockEnabled.mockResolvedValue(false);
    const screen = setup();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    expect(svc.authenticate).not.toHaveBeenCalled();
  });

  it('should not lock when the person is signed out', async () => {
    mockAuth = { isAuthenticated: false, isLoading: false };
    const screen = setup();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('should lock after five minutes in the background', async () => {
    svc.authenticate.mockResolvedValue({ success: true });
    const screen = setup();
    await flush();
    goBackground();
    now += 5 * MINUTE;
    svc.authenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
    comeBack();
    await flush();
    expect(screen.getByTestId('app-lock-screen')).toBeTruthy();
  });

  it('should not lock after one minute in the background', async () => {
    svc.authenticate.mockResolvedValue({ success: true });
    const screen = setup();
    await flush();
    svc.authenticate.mockClear();
    goBackground();
    now += MINUTE;
    comeBack();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    expect(svc.authenticate).not.toHaveBeenCalled();
  });

  it('should ignore an inactive blip when the app was never in the background', async () => {
    svc.authenticate.mockResolvedValue({ success: true });
    const screen = setup();
    await flush();
    svc.authenticate.mockClear();
    act(() => appStateHandler?.('inactive'));
    now += 10 * MINUTE;
    comeBack();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('should turn the lock off and unlock when the device has no biometric or passcode left', async () => {
    svc.authenticate.mockResolvedValue({ success: false, error: 'not_enrolled' });
    const screen = setup();
    await flush();
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    expect(svc.setAppLockEnabled).toHaveBeenCalledWith(false);
  });

  it('should clear the lock when the person signs out', async () => {
    svc.authenticate.mockResolvedValue({ success: true });
    const screen = setup();
    await flush();
    mockAuth = { isAuthenticated: false, isLoading: false };
    screen.rerender(
      <AppLockProvider>
        <Text>content</Text>
      </AppLockProvider>,
    );
    await waitFor(() => expect(svc.setAppLockEnabled).toHaveBeenCalledWith(false));
  });
});
