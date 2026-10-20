import React from 'react';
import { Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { AudioPlayerProvider, useAudioPlayerContext } from './AudioPlayerContext';
import { getHistory, reset } from '@/services/audioLevel';
import type { Track } from '@/types';

jest.mock('expo-audio');

// Test helpers exported by __mocks__/expo-audio.ts (not part of the real
// expo-audio typings, so they are read off the mock module).
const {
  __emitAudioSample,
  __getCurrentPlayer,
  __setDuration,
  __setPlaying,
} = jest.requireMock('expo-audio');

jest.mock('@/services/cacheService', () => ({
  __esModule: true,
  default: {
    getCachedTrackPath: jest.fn(async () => null),
    preCacheTracksForDuration: jest.fn(async () => undefined),
    cacheTrack: jest.fn(async () => null),
  },
}));
jest.mock('@/services/downloadService', () => ({
  __esModule: true,
  default: { getDownloadedTrackPath: jest.fn(async () => null) },
}));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: { getTrackStreamUrl: jest.fn(async () => ({ success: true, url: 'mock://stream' })) },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ success: true, data: null })),
    post: jest.fn(async () => ({ success: true, data: {} })),
    put: jest.fn(async () => ({ success: true, data: {} })),
    delete: jest.fn(async () => ({ success: true, data: {} })),
  },
}));

const track: Track = {
  id: 't1',
  title: 'Track 1',
  duration: 600,
  order: 0,
  session_id: 's1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AudioPlayerProvider>{children}</AudioPlayerProvider>
);

async function loadTrack() {
  const utils = renderHook(() => useAudioPlayerContext(), { wrapper });
  act(() => {
    __setDuration(600);
    utils.result.current.playTrack(track, [track], 0);
  });
  await act(async () => { await Promise.resolve(); });
  return utils;
}

async function startPlaying() {
  const utils = await loadTrack();
  act(() => { __setPlaying(true); });
  return utils;
}

describe('AudioPlayerContext audio level sampling', () => {
  const originalOS = Platform.OS;
  const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };

  beforeEach(() => { reset(); });
  afterEach(() => { setOS(originalOS); });

  it('should enable sampling on iOS when playback starts', async () => {
    setOS('ios');
    await startPlaying();
    expect(__getCurrentPlayer()!.samplingEnabled).toBe(true);
  });

  it('should not enable sampling when the track is loaded but not playing', async () => {
    setOS('ios');
    await loadTrack();
    expect(__getCurrentPlayer()!.samplingCalls).not.toContain(true);
  });

  it('should disable sampling when playback pauses', async () => {
    setOS('ios');
    await startPlaying();
    const player = __getCurrentPlayer()!;
    act(() => { __setPlaying(false); });
    expect(player.samplingEnabled).toBe(false);
  });

  it('should disable sampling when the provider unmounts', async () => {
    setOS('ios');
    const { unmount } = await startPlaying();
    const player = __getCurrentPlayer()!;
    unmount();
    expect(player.samplingEnabled).toBe(false);
  });

  it('should push levels to the store when samples arrive on iOS', async () => {
    setOS('ios');
    await startPlaying();
    act(() => { __emitAudioSample([0.4, -0.4, 0.4, -0.4]); });
    expect(getHistory().length).toBeGreaterThan(0);
  });

  it('should not enable sampling when the player reports it unsupported', async () => {
    setOS('ios');
    await loadTrack();
    __getCurrentPlayer()!.isAudioSamplingSupported = false;
    act(() => { __setPlaying(true); });
    expect(__getCurrentPlayer()!.samplingCalls).toEqual([]);
  });

  it.each(['android', 'web'])('should never enable sampling when the platform is %s', async (os) => {
    setOS(os);
    await startPlaying();
    expect(__getCurrentPlayer()!.samplingCalls).toEqual([]);
  });
});
