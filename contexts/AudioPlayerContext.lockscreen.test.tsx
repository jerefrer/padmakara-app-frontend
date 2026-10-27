import React from 'react';
import { Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { AudioPlayerProvider, useAudioPlayerContext } from './AudioPlayerContext';
import { getLockScreenArtworkUri } from '@/services/lockScreenArtwork';
import type { Track } from '@/types';

jest.mock('expo-audio');
const { __getCurrentPlayer, __setDuration } = jest.requireMock('expo-audio');

jest.mock('@/services/lockScreenArtwork', () => ({
  __esModule: true,
  getLockScreenArtworkUri: jest.fn(),
}));
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

const mockArtwork = getLockScreenArtworkUri as jest.Mock;

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
    utils.result.current.playTrack(track, [track], 0, {
      retreatId: 'r1',
      retreatName: 'Spring retreat',
      groupName: 'Group',
    });
  });
  await act(async () => { await Promise.resolve(); });
  return utils;
}

function lastMetadata(): Record<string, string> | undefined {
  const calls = __getCurrentPlayer()!.setActiveForLockScreen.mock.calls;
  return calls.filter((c: unknown[]) => c[0] === true).pop()?.[1];
}

describe('AudioPlayerContext lock screen artwork', () => {
  const originalOS = Platform.OS;
  beforeEach(() => { (Platform as { OS: string }).OS = 'ios'; });
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  it('should pass a local file artwork url when the bundled artwork is cached on disk', async () => {
    mockArtwork.mockResolvedValue('file:///cache/ExponentAsset-icon.png');
    await loadTrack();
    expect(lastMetadata()).toMatchObject({
      title: 'Track 1',
      albumTitle: 'Spring retreat',
      artworkUrl: 'file:///cache/ExponentAsset-icon.png',
    });
  });

  it('should pass the remote artwork url when no local file exists', async () => {
    mockArtwork.mockResolvedValue('http://192.168.1.2:8081/assets/icon.png');
    await loadTrack();
    expect(lastMetadata()?.artworkUrl).toBe('http://192.168.1.2:8081/assets/icon.png');
  });

  it('should omit artworkUrl when the artwork cannot be resolved', async () => {
    mockArtwork.mockResolvedValue(null);
    await loadTrack();
    expect(lastMetadata()).toBeDefined();
    expect(lastMetadata()).not.toHaveProperty('artworkUrl');
  });
});
