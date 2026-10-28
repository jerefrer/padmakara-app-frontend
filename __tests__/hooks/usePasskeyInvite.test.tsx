import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { markHandled, shouldInvite } from '@/hooks/usePasskeyInvite';
import { useHomePasskeyInvite } from '@/hooks/useHomePasskeyInvite';
import { isPasskeySupported, tryListPasskeys } from '@/services/passkeyService';

const mockPush = jest.fn();
let mockAuth: any;
let mockAudio: any;

jest.mock('expo-router', () => {
  const R = require('react');
  return {
    router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockAudio }));
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: jest.fn(),
  tryListPasskeys: jest.fn(),
}));

const supported = isPasskeySupported as jest.Mock;
const list = tryListPasskeys as jest.Mock;

beforeEach(() => {
  // Not resetAllMocks: it would also wipe the AsyncStorage mock's implementations.
  mockPush.mockReset();
  supported.mockReset();
  list.mockReset();
  supported.mockResolvedValue(true);
  list.mockResolvedValue([]);
  mockAuth = { isAuthenticated: true, isDeviceActivated: true, user: { id: '42' } };
  mockAudio = { isPlaying: false, videoPlaying: false };
});

describe('shouldInvite', () => {
  it('should invite after an email sign-in on a supported device', async () => {
    expect(await shouldInvite('42', 'email')).toBe(true);
  });

  it('should not invite twice for the same user on this device', async () => {
    await markHandled('42');

    expect(await shouldInvite('42', 'email')).toBe(false);
    expect(await shouldInvite('43', 'email')).toBe(true);
    expect(await AsyncStorage.getItem('passkeyInvite:42')).not.toBeNull();
  });

  it('should not invite after a passkey sign-in', async () => {
    expect(await shouldInvite('42', 'passkey')).toBe(false);
  });

  it('should not invite when passkeys are unsupported', async () => {
    supported.mockResolvedValue(false);

    expect(await shouldInvite('42', 'email')).toBe(false);
  });

  it('should still invite when the storage cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('denied'));

    expect(await shouldInvite('42', 'email')).toBe(true);
  });
});

describe('useHomePasskeyInvite', () => {
  beforeEach(() => jest.useFakeTimers());

  async function settle() {
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await act(async () => {});
  }

  it('should invite a signed-in member once on home when they have no passkey', async () => {
    const { rerender } = renderHook(() => useHomePasskeyInvite());
    await settle();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toEqual({ pathname: '/(auth)/passkey-invite' });
    expect(await AsyncStorage.getItem('passkeyInvite:42')).not.toBeNull();

    rerender({});
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('should not invite a signed-in member who already has a passkey', async () => {
    list.mockResolvedValue([{ id: 1, name: 'iPhone', createdAt: 'x', lastUsedAt: null }]);

    renderHook(() => useHomePasskeyInvite());
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not invite while media is playing', async () => {
    mockAudio = { isPlaying: true, videoPlaying: false };

    renderHook(() => useHomePasskeyInvite());
    await settle();

    expect(list).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not invite when listing passkeys fails', async () => {
    list.mockResolvedValue(null);

    renderHook(() => useHomePasskeyInvite());
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not invite when the invitation was already shown on this device', async () => {
    await markHandled('42');

    renderHook(() => useHomePasskeyInvite());
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should remember a member who already has a passkey and not look again on later focus', async () => {
    list.mockResolvedValue([{ id: 1, name: 'iPhone', createdAt: 'x', lastUsedAt: null }]);

    const { rerender } = renderHook(() => useHomePasskeyInvite());
    await settle();
    expect(list).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('passkeyInvite:42')).not.toBeNull();

    rerender({});
    await settle();
    expect(list).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not open the invitation when the screen is left while the flag is being saved', async () => {
    let release: () => void = () => {};
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    const { unmount } = renderHook(() => useHomePasskeyInvite());
    await settle();
    unmount();
    await act(async () => release());

    expect(mockPush).not.toHaveBeenCalled();
  });
});
