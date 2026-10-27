import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import authService from '@/services/authService';
import magicLinkService from '@/services/magicLinkService';

jest.mock('@/services/authService', () => ({
  __esModule: true,
  default: { getAuthState: jest.fn(), refreshSession: jest.fn(), logout: jest.fn() },
}));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: {
    isDeviceActivated: jest.fn(),
    checkActivationStatus: jest.fn(),
    clearDeviceActivation: jest.fn(),
    captureDeviceDeactivation: jest.fn(),
    deactivateInBackground: jest.fn(),
    retryPendingDeactivation: jest.fn(),
  },
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: { addAuthStateListener: jest.fn(), removeAuthStateListener: jest.fn(), get: jest.fn(), validateAuthToken: jest.fn() },
}));
jest.mock('@/services/imagePrefetch', () => ({
  __esModule: true,
  default: { resetCooldown: jest.fn(), collectAvatarsAndHeros: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/components/ImagePrewarmer', () => ({ ImagePrewarmer: () => null }));
jest.mock('@/services/syncService', () => ({ __esModule: true, default: { checkAndSync: jest.fn().mockResolvedValue(undefined) } }));

const ml = magicLinkService as unknown as Record<string, jest.Mock>;
const auth = authService as unknown as Record<string, jest.Mock>;
const record = { fingerprint: 'fp-1', accessToken: 'acc', refreshToken: 'ref' };

let ctx: ReturnType<typeof useAuth>;
function Probe() {
  ctx = useAuth();
  return <Text>probe</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  ml.isDeviceActivated.mockResolvedValue(true);
  ml.clearDeviceActivation.mockResolvedValue(undefined);
  ml.captureDeviceDeactivation.mockResolvedValue(record);
  ml.retryPendingDeactivation.mockResolvedValue(undefined);
  auth.getAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 1, email: 'a@b.c' }, token: 'acc' });
  auth.refreshSession.mockResolvedValue({ success: false });
  auth.logout.mockResolvedValue(undefined);
});

async function mount() {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(ctx.isInitialized).toBe(true));
  expect(ctx.isAuthenticated).toBe(true);
}

describe('forgetDevice', () => {
  it('should sign out locally even when the backend call never resolves', async () => {
    ml.deactivateInBackground.mockReturnValue(new Promise(() => {}));
    await mount();
    await act(async () => {
      await ctx.forgetDevice();
    });
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.user).toBeNull();
    expect(ctx.isDeviceActivated).toBe(false);
    expect(ctx.isLoading).toBe(false);
  });

  it('should capture the credentials before logout clears them and hand them to the background call', async () => {
    ml.deactivateInBackground.mockResolvedValue(undefined);
    await mount();
    await act(async () => {
      await ctx.forgetDevice();
    });
    expect(ml.captureDeviceDeactivation.mock.invocationCallOrder[0]).toBeLessThan(auth.logout.mock.invocationCallOrder[0]);
    expect(ml.deactivateInBackground).toHaveBeenCalledWith(record);
  });
});

describe('app start', () => {
  it('should retry a pending device deactivation', async () => {
    await mount();
    await waitFor(() => expect(ml.retryPendingDeactivation).toHaveBeenCalled());
  });
});
