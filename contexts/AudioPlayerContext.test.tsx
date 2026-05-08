import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __advanceTime,
  __finishTrack,
  __setDuration,
  __setPlaying,
  __getRate,
  __getLastSeekTo,
  __reset as __resetAudio,
} from 'expo-audio';
import { AudioPlayerProvider, useAudioPlayerContext } from './AudioPlayerContext';
import type { Track } from '@/types';

// Use the manual mock at __mocks__/expo-audio.ts. This is a no-op when jest's
// automock for manual mocks is enabled, but makes the dependency explicit and
// guards against changes to the jest config that might disable it.
jest.mock('expo-audio');

// ─── Mock external services that AudioPlayerContext calls ──────────
jest.mock('@/services/cacheService', () => ({
  __esModule: true,
  default: {
    getCachedTrackPath: jest.fn(async () => null),
    preCacheTracksForDuration: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/downloadService', () => ({
  __esModule: true,
  default: {
    getDownloadedTrackPath: jest.fn(async () => null),
  },
}));

jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    getTrackStreamUrl: jest.fn(async () => ({ success: true, url: 'mock://stream' })),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}));

// ─── Test fixtures ─────────────────────────────────────────────────
export const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: overrides.id || 't1',
  title: overrides.title || 'Track 1',
  duration: overrides.duration ?? 600,
  order: overrides.order ?? 0,
  session_id: overrides.session_id || 's1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AudioPlayerProvider>{children}</AudioPlayerProvider>
);

export const renderPlayer = () => renderHook(() => useAudioPlayerContext(), { wrapper });

// ─── Sanity check: harness boots, context exposes initial state ───
describe('AudioPlayerContext — harness sanity', () => {
  it('renders with initial idle state and null track', () => {
    const { result } = renderPlayer();
    expect(result.current.currentTrack).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.playerState).toBe('idle');
  });
});
