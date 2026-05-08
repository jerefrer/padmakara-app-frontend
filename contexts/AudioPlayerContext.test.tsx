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
    cacheTrack: jest.fn(async () => null),
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

describe('AudioPlayerContext — resume + position (matrix D)', () => {
  it('D1 — cold start with no last_played_track: track null, idleTrack null, not playing', async () => {
    const { result } = renderPlayer();
    expect(result.current.currentTrack).toBeNull();
    expect(result.current.idleTrack).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });

  it('D2 — cold start with last_played_track: idleTrack populated, not playing', async () => {
    const savedTrack = makeTrack({ id: 'last' });
    const meta = { retreatId: 'r1', retreatName: 'Retreat', groupName: 'Group' };
    await AsyncStorage.setItem(
      'last_played_track',
      JSON.stringify({ track: savedTrack, meta }),
    );
    await AsyncStorage.setItem(
      'progress_last',
      JSON.stringify({ trackId: 'last', position: 90, completed: false, lastPlayed: '', bookmarks: [] }),
    );

    const { result } = renderPlayer();

    // The idle-resume effect runs after mount; let microtasks flush.
    await act(async () => { await Promise.resolve(); });

    expect(result.current.idleTrack?.track.id).toBe('last');
    expect(result.current.idleTrack?.position).toBe(90);
    expect(result.current.isPlaying).toBe(false);
  });

  it('D3 — playTrack with prior progress: seeks to saved position then plays', async () => {
    const track = makeTrack({ id: 'tA', duration: 200 });
    await AsyncStorage.setItem(
      'progress_tA',
      JSON.stringify({ trackId: 'tA', position: 90, completed: false, lastPlayed: '', bookmarks: [] }),
    );

    const { result } = renderPlayer();

    act(() => {
      __setDuration(200);
      result.current.playTrack(track, [track], 0);
    });

    // Simulate the engine reaching ready and the seek effect running.
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); });

    expect(__getLastSeekTo()).toBe(90);
    expect(result.current.isPlaying).toBe(true);
  });

  it('D4 — playTrack for a completed track: starts from 0', async () => {
    const track = makeTrack({ id: 'tDone', duration: 200 });
    await AsyncStorage.setItem(
      'progress_tDone',
      JSON.stringify({ trackId: 'tDone', position: 199, completed: true, lastPlayed: '', bookmarks: [] }),
    );

    const { result } = renderPlayer();

    act(() => {
      __setDuration(200);
      result.current.playTrack(track, [track], 0);
    });

    await act(async () => { await Promise.resolve(); });

    // Completed tracks restart from 0 — the context must NOT seek to the saved position.
    expect(__getLastSeekTo() === 0 || __getLastSeekTo() === null).toBe(true);
  });

  it('D5a — switch tracks mid-play: outgoing position saved, incoming restored', async () => {
    const tA = makeTrack({ id: 'tA', duration: 200 });
    const tB = makeTrack({ id: 'tB', duration: 300 });
    await AsyncStorage.setItem(
      'progress_tB',
      JSON.stringify({ trackId: 'tB', position: 30, completed: false, lastPlayed: '', bookmarks: [] }),
    );

    const { result } = renderPlayer();

    act(() => {
      __setDuration(200);
      result.current.playTrack(tA, [tA, tB], 0);
    });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(45); });

    act(() => {
      result.current.playTrack(tB, [tA, tB], 1);
    });
    await act(async () => { await Promise.resolve(); });

    const savedA = await AsyncStorage.getItem('progress_tA');
    expect(JSON.parse(savedA!).position).toBeGreaterThanOrEqual(45);
    expect(__getLastSeekTo()).toBe(30);
  });

  it('D5b — switch to track with no prior progress: starts at 0', async () => {
    const tA = makeTrack({ id: 'tA', duration: 200 });
    const tB = makeTrack({ id: 'tB', duration: 300 });

    const { result } = renderPlayer();

    act(() => {
      __setDuration(200);
      result.current.playTrack(tA, [tA, tB], 0);
    });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(45); });

    act(() => {
      result.current.playTrack(tB, [tA, tB], 1);
    });
    await act(async () => { await Promise.resolve(); });

    expect(__getLastSeekTo() === 0 || __getLastSeekTo() === null).toBe(true);
  });

  it('D6 — skipForward at currentTime 100 in 200s track: seekTo called with 115', async () => {
    const t = makeTrack({ id: 't', duration: 200 });
    const { result } = renderPlayer();

    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(100); });

    act(() => { result.current.skipForward(); });
    expect(__getLastSeekTo()).toBe(115);
  });

  it('D7 — skipForward at currentTime 195 in 200s track: clamps at duration', async () => {
    const t = makeTrack({ id: 't', duration: 200 });
    const { result } = renderPlayer();

    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(195); });

    act(() => { result.current.skipForward(); });
    expect(__getLastSeekTo()).toBe(200);
  });

  it('D8 — skipBackward at currentTime 5: clamps at 0', async () => {
    const t = makeTrack({ id: 't', duration: 200 });
    const { result } = renderPlayer();

    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(5); });

    act(() => { result.current.skipBackward(); });
    expect(__getLastSeekTo()).toBe(0);
  });

  it('D9 — changePlaybackSpeed cycles 1.0 → 1.25 → 1.5 → 2.0 → 0.75 → 1.0; position unchanged', async () => {
    const t = makeTrack({ id: 't', duration: 600 });
    const { result } = renderPlayer();

    act(() => { __setDuration(600); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(100); });

    const expectedCycle = [1.25, 1.5, 2.0, 0.75, 1.0];
    for (const expected of expectedCycle) {
      act(() => { result.current.changePlaybackSpeed(); });
      expect(__getRate()).toBeCloseTo(expected);
    }
    // Position must not have moved in mock state.
    expect(result.current.position).toBeCloseTo(100);
  });

  it('D10 — playing for 10s of fake time: progress saved at second 10', async () => {
    jest.useFakeTimers();
    const t = makeTrack({ id: 't10', duration: 600 });
    const { result } = renderPlayer();

    act(() => { __setDuration(600); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); });

    // Drive 10 seconds of playback by ticking the mock clock.
    for (let i = 1; i <= 10; i++) {
      act(() => { __advanceTime(1); });
    }
    await act(async () => { await Promise.resolve(); });

    const saved = await AsyncStorage.getItem('progress_t10');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).position).toBe(10);
  });

  it('D11 — togglePlayPause to pause saves progress with current position', async () => {
    const t = makeTrack({ id: 'tPause', duration: 600 });
    const { result } = renderPlayer();

    act(() => { __setDuration(600); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(7); });

    act(() => { result.current.togglePlayPause(); });
    act(() => { __setPlaying(false); });
    await act(async () => { await Promise.resolve(); });

    // Spec asserts progress is saved on pause. If the current implementation
    // only saves on the 10-second cadence (status.playing-gated effect),
    // this test will fail — that is the intended gate. Per the spec's
    // "Failure handling during implementation" section, the executor must
    // STOP and surface this to the user before changing test or production code.
    const saved = await AsyncStorage.getItem('progress_tPause');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).position).toBeGreaterThanOrEqual(7);
  });

  it('D12 — playTrack with meta writes last_played_track', async () => {
    const t = makeTrack({ id: 'tMeta' });
    const meta = { retreatId: 'r2', retreatName: 'Spring', groupName: 'Lisbon' };
    const { result } = renderPlayer();

    act(() => { result.current.playTrack(t, [t], 0, meta); });
    await act(async () => { await Promise.resolve(); });

    const raw = await AsyncStorage.getItem('last_played_track');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.track.id).toBe('tMeta');
    expect(parsed.meta).toEqual(meta);
  });

  it('D13 — duration reflects status.duration once track loads', async () => {
    const t = makeTrack({ id: 'tDur' });
    const { result } = renderPlayer();
    act(() => { __setDuration(420); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.duration).toBe(420);
  });
});
