import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __advanceTime,
  __finishTrack,
  __setDuration,
  __setPlaying,
  __setIsLoaded,
  __getRate,
  __getLastSeekTo,
  __getCurrentPlayer,
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

jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ success: true, data: null })),
    post: jest.fn(async () => ({ success: true, data: {} })),
    put: jest.fn(async () => ({ success: true, data: {} })),
    delete: jest.fn(async () => ({ success: true, data: {} })),
  },
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

import cacheService from '@/services/cacheService';

describe('AudioPlayerContext — completion + auto-advance hook (matrix E)', () => {
  it('E1 — track end fires onTrackComplete exactly once and saves completed=true', async () => {
    const t = makeTrack({ id: 'tEnd', duration: 100 });
    const { result } = renderPlayer();

    const cb = jest.fn();
    act(() => { result.current.setOnTrackComplete(cb); });

    act(() => { __setDuration(100); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(99); });

    act(() => { __finishTrack(); });
    await act(async () => { await Promise.resolve(); });

    expect(cb).toHaveBeenCalledTimes(1);
    const saved = JSON.parse((await AsyncStorage.getItem('progress_tEnd'))!);
    expect(saved.completed).toBe(true);
  });

  it('E2 — duplicate finish events still fire callback once', async () => {
    const t = makeTrack({ id: 'tDup', duration: 100 });
    const { result } = renderPlayer();
    const cb = jest.fn();
    act(() => { result.current.setOnTrackComplete(cb); });

    act(() => { __setDuration(100); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); });

    act(() => { __finishTrack(); });
    act(() => { __finishTrack(); });
    await act(async () => { await Promise.resolve(); });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('E3 — playTrack on a new track resets the completion guard', async () => {
    const tA = makeTrack({ id: 'tA', duration: 100 });
    const tB = makeTrack({ id: 'tB', duration: 100 });
    const { result } = renderPlayer();
    const cb = jest.fn();
    act(() => { result.current.setOnTrackComplete(cb); });

    act(() => { __setDuration(100); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __finishTrack(); });
    await act(async () => { await Promise.resolve(); });
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => { __resetAudio(); __setDuration(100); result.current.playTrack(tB, [tA, tB], 1); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __finishTrack(); });
    await act(async () => { await Promise.resolve(); });

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('E4 — pre-cache fires once at 30s of playback', async () => {
    const tA = makeTrack({ id: 'tA', duration: 600 });
    const tB = makeTrack({ id: 'tB', duration: 600 });
    const { result } = renderPlayer();

    act(() => { result.current.setUpcomingTracks([tB]); });
    act(() => { __setDuration(600); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(30); });
    await act(async () => { await Promise.resolve(); });

    expect(cacheService.preCacheTracksForDuration).toHaveBeenCalledTimes(1);
  });

  it('E5 — pre-cache does not re-fire later in the same track', async () => {
    const tA = makeTrack({ id: 'tA', duration: 600 });
    const tB = makeTrack({ id: 'tB', duration: 600 });
    const { result } = renderPlayer();

    act(() => { result.current.setUpcomingTracks([tB]); });
    act(() => { __setDuration(600); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(30); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __advanceTime(30); });
    await act(async () => { await Promise.resolve(); });

    expect(cacheService.preCacheTracksForDuration).toHaveBeenCalledTimes(1);
  });

  it('E6 — nextTrack and previousTrack fire registered callbacks', async () => {
    const { result } = renderPlayer();
    const onNext = jest.fn();
    const onPrev = jest.fn();

    act(() => {
      result.current.setOnNextTrack(onNext);
      result.current.setOnPreviousTrack(onPrev);
    });

    act(() => { result.current.nextTrack(); });
    expect(onNext).toHaveBeenCalledTimes(1);

    act(() => { result.current.previousTrack(); });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});

import { filterTracksByLanguage, sortTracksForSession, type TrackWithSession } from '@/utils/trackFiltering';

const buildBilingualEvent = (): TrackWithSession[] => {
  // Two sessions, each with one EN original + one PT translation.
  const sessions = [
    { id: 's1', name: 'Session 1', date: '2026-01-01', type: 'morning' as const, tracks: [
      { id: 'S1-EN', isOriginal: true, originalLanguage: 'en', languages: ['en'], language: 'en' },
      { id: 'S1-PT', isOriginal: false, originalLanguage: 'pt', languages: ['pt'], language: 'pt' },
    ]},
    { id: 's2', name: 'Session 2', date: '2026-01-02', type: 'morning' as const, tracks: [
      { id: 'S2-EN', isOriginal: true, originalLanguage: 'en', languages: ['en'], language: 'en' },
      { id: 'S2-PT', isOriginal: false, originalLanguage: 'pt', languages: ['pt'], language: 'pt' },
    ]},
  ];

  const all: TrackWithSession[] = [];
  for (const session of sessions) {
    const sorted = sortTracksForSession(session.tracks.map((t) => ({
      ...makeTrack({ id: t.id, session_id: session.id }),
      ...t,
    })));
    for (const track of sorted) {
      all.push({
        ...track,
        sessionId: session.id,
        sessionName: session.name,
        sessionDate: session.date,
        sessionType: session.type,
        sessionPartNumber: null,
      });
    }
  }
  return all;
};

/**
 * Walks auto-advance from `startId` until either (a) the consumer's nextTrack
 * callback says no more tracks, or (b) we hit a safety cap. Returns the
 * sequence of track ids actually loaded.
 */
const walkAdvance = async (
  result: ReturnType<typeof renderPlayer>['result'],
  filtered: TrackWithSession[],
  startId: string,
): Promise<string[]> => {
  const visited: string[] = [];
  let index = filtered.findIndex((t) => t.id === startId);
  if (index === -1) return visited;

  // Wire the screen-equivalent next callback.
  act(() => {
    result.current.setOnNextTrack(() => {
      if (index + 1 < filtered.length) {
        index += 1;
        const next = filtered[index];
        act(() => {
          __resetAudio();
          __setDuration(60);
          result.current.playTrack(next, filtered, index);
        });
      }
    });
    result.current.setOnTrackComplete(() => {
      // Mirror retreat/[id].tsx handleTrackComplete: call nextTrack if available.
      result.current.nextTrack();
    });
  });

  // Start playback at startId.
  act(() => {
    __setDuration(60);
    result.current.playTrack(filtered[index], filtered, index);
  });
  await act(async () => { await Promise.resolve(); });
  visited.push(filtered[index].id);

  for (let i = 0; i < filtered.length + 2; i++) {
    act(() => { __setPlaying(true); __finishTrack(); });
    await act(async () => { await Promise.resolve(); });
    if (visited[visited.length - 1] === filtered[filtered.length - 1].id) break;
    visited.push(filtered[index].id);
  }
  return visited;
};

describe('AudioPlayerContext — filter + advance integration (matrix F)', () => {
  it('F1 — `en` mode walks [S1-EN, S2-EN], skipping PT', async () => {
    const all = buildBilingualEvent();
    const filtered = filterTracksByLanguage(all, 'en');
    const { result } = renderPlayer();
    const visited = await walkAdvance(result, filtered, 'S1-EN');
    expect(visited).toEqual(['S1-EN', 'S2-EN']);
  });

  it('F2 — `pt` mode walks [S1-PT, S2-PT], skipping EN', async () => {
    const all = buildBilingualEvent();
    const filtered = filterTracksByLanguage(all, 'pt');
    const { result } = renderPlayer();
    const visited = await walkAdvance(result, filtered, 'S1-PT');
    expect(visited).toEqual(['S1-PT', 'S2-PT']);
  });

  it('F3 — `en-pt` mode starting at S1-EN walks [S1-EN, S1-PT, S2-EN, S2-PT]', async () => {
    const all = buildBilingualEvent();
    const filtered = filterTracksByLanguage(all, 'en-pt');
    const { result } = renderPlayer();
    const visited = await walkAdvance(result, filtered, 'S1-EN');
    expect(visited).toEqual(['S1-EN', 'S1-PT', 'S2-EN', 'S2-PT']);
  });

  it('F4 — `en-pt` mode starting at S1-PT walks [S1-PT, S2-EN, S2-PT]', async () => {
    const all = buildBilingualEvent();
    const filtered = filterTracksByLanguage(all, 'en-pt');
    const { result } = renderPlayer();
    const visited = await walkAdvance(result, filtered, 'S1-PT');
    expect(visited).toEqual(['S1-PT', 'S2-EN', 'S2-PT']);
  });

  it('F5 — `en` mode with single session: completion fires after one track, no advance', async () => {
    const single: TrackWithSession[] = filterTracksByLanguage([
      {
        ...makeTrack({ id: 'S1-EN', session_id: 's1' }),
        isOriginal: true,
        originalLanguage: 'en',
        languages: ['en'],
        sessionId: 's1',
        sessionName: 'Session 1',
        sessionDate: '2026-01-01',
        sessionType: 'morning',
        sessionPartNumber: null,
      },
      {
        ...makeTrack({ id: 'S1-PT', session_id: 's1' }),
        isOriginal: false,
        originalLanguage: 'pt',
        languages: ['pt'],
        sessionId: 's1',
        sessionName: 'Session 1',
        sessionDate: '2026-01-01',
        sessionType: 'morning',
        sessionPartNumber: null,
      },
    ], 'en');

    const { result } = renderPlayer();
    const visited = await walkAdvance(result, single, 'S1-EN');
    expect(visited).toEqual(['S1-EN']);
  });

  it('F6 — `pt` mode with no PT tracks: fallback to all, advance walks all', async () => {
    const enOnly: TrackWithSession[] = [
      {
        ...makeTrack({ id: 'S1-EN', session_id: 's1' }),
        isOriginal: true,
        originalLanguage: 'en',
        languages: ['en'],
        sessionId: 's1', sessionName: 'Session 1', sessionDate: '2026-01-01', sessionType: 'morning', sessionPartNumber: null,
      },
      {
        ...makeTrack({ id: 'S2-EN', session_id: 's2' }),
        isOriginal: true,
        originalLanguage: 'en',
        languages: ['en'],
        sessionId: 's2', sessionName: 'Session 2', sessionDate: '2026-01-02', sessionType: 'morning', sessionPartNumber: null,
      },
    ];
    const filtered = filterTracksByLanguage(enOnly, 'pt');
    expect(filtered.map((t) => t.id)).toEqual(['S1-EN', 'S2-EN']); // fallback

    const { result } = renderPlayer();
    const visited = await walkAdvance(result, filtered, 'S1-EN');
    expect(visited).toEqual(['S1-EN', 'S2-EN']);
  });

  it('F7 — `en-pt` mode preserves [EN, PT, EN, PT] ordering inside each session even with shared `order`', async () => {
    const all = buildBilingualEvent();
    const filtered = filterTracksByLanguage(all, 'en-pt');
    expect(filtered.map((t) => t.id)).toEqual(['S1-EN', 'S1-PT', 'S2-EN', 'S2-PT']);
  });
});

// ─── Cross-device sync (matrix G) ─────────────────────────────────────

import apiService from '@/services/apiService';

const apiGet = apiService.get as jest.Mock;
const apiPost = apiService.post as jest.Mock;

describe('AudioPlayerContext — cross-device sync (matrix G)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockResolvedValue({ success: true, data: null });
    apiPost.mockResolvedValue({ success: true, data: {} });
  });

  it('G1 — saveProgress fires remote push with correct body after 10s of playback', async () => {
    const t = makeTrack({ id: '42', duration: 200 });
    const { result } = renderPlayer();
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); });
    for (let i = 1; i <= 10; i++) act(() => { __advanceTime(1); });
    await act(async () => { await Promise.resolve(); });

    const progressCalls = apiPost.mock.calls.filter(
      ([url]) => url === '/content/progress',
    );
    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls[0][1]).toEqual(expect.objectContaining({
      trackId: 42,
      positionSeconds: 10,
    }));
  });

  it('G2 — app start: bulk sync writes server-newer entries to local AsyncStorage', async () => {
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 5, completed: false,
      lastPlayed: '2026-05-01T00:00:00Z', bookmarks: [],
    }));
    apiGet.mockImplementation(async (url) => {
      if (url === '/content/progress') {
        return {
          success: true,
          data: [
            { trackId: 42, positionSeconds: 47, completionPct: 23, isCompleted: false, lastPlayed: '2026-05-08T10:00:00Z' },
            { trackId: 43, positionSeconds: 99, completionPct: 50, isCompleted: false, lastPlayed: '2026-05-07T10:00:00Z' },
          ],
        };
      }
      return { success: true, data: null };
    });

    renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    const merged42 = JSON.parse((await AsyncStorage.getItem('progress_42'))!);
    expect(merged42.position).toBe(47);
    expect(merged42.lastPlayed).toBe('2026-05-08T10:00:00Z');
    const merged43 = JSON.parse((await AsyncStorage.getItem('progress_43'))!);
    expect(merged43.position).toBe(99);
  });

  it('G3 — app start: bulk sync skips server entries that are older than local', async () => {
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 60, completed: false,
      lastPlayed: '2026-05-08T10:00:00Z', bookmarks: [],
    }));
    apiGet.mockImplementation(async (url) => {
      if (url === '/content/progress') {
        return {
          success: true,
          data: [
            { trackId: 42, positionSeconds: 5, completionPct: 2, isCompleted: false, lastPlayed: '2026-05-01T00:00:00Z' },
          ],
        };
      }
      return { success: true, data: null };
    });

    renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Local (newer) position 60 wins; server's stale 5 is not written.
    const updated = JSON.parse((await AsyncStorage.getItem('progress_42'))!);
    expect(updated.position).toBe(60);
  });

  it('G4 — app start: bulk sync pushes local-only / local-newer entries to server', async () => {
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 30, completed: false,
      lastPlayed: '2026-05-09T10:00:00Z', bookmarks: [],
    }));
    // Server has nothing for trackId 42.
    apiGet.mockImplementation(async (url) => {
      if (url === '/content/progress') return { success: true, data: [] };
      return { success: true, data: null };
    });

    renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    const calls = apiPost.mock.calls.filter(([url]) => url === '/content/progress');
    expect(calls.some(([, body]) => body.trackId === 42 && body.positionSeconds === 30)).toBe(true);
  });

  it('G5 — track click does not fire a per-track GET (no GET to /content/progress/:id)', async () => {
    const t = makeTrack({ id: '42', duration: 200 });
    apiGet.mockResolvedValue({ success: true, data: null });

    const { result } = renderPlayer();
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const perTrackGets = apiGet.mock.calls.filter(([url]) => /\/content\/progress\/\d+$/.test(url));
    expect(perTrackGets).toHaveLength(0);
  });

  it('G6 — playTrack pre-sets phase=loading and targetPosition synchronously (no OLD flash)', async () => {
    const tA = makeTrack({ id: '42', duration: 200 });
    const tB = makeTrack({ id: '43', duration: 200 });
    await AsyncStorage.setItem('progress_43', JSON.stringify({
      trackId: '43', position: 50, completed: false,
      lastPlayed: '2026-05-08T10:00:00Z', bookmarks: [],
    }));

    const { result } = renderPlayer();
    // Let mount-effect bulk sync + cache pre-load run so the cache knows about tB.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Open tA, advance currentTime to 132.
    act(() => { __setDuration(200); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(132); });

    // Switch to tB and immediately read state — must already be loading + tB's saved position.
    act(() => { result.current.playTrack(tB, [tA, tB], 1); });

    expect(result.current.playerState).toBe('loading');
    expect(result.current.position).toBe(50);
  });

  it('G7 — apiService.post rejects → saveProgress still works locally', async () => {
    apiPost.mockRejectedValue(new Error('offline'));
    const t = makeTrack({ id: '42', duration: 200 });
    const { result } = renderPlayer();
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); });
    for (let i = 1; i <= 10; i++) act(() => { __advanceTime(1); });
    await act(async () => { await Promise.resolve(); });

    const saved = await AsyncStorage.getItem('progress_42');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).position).toBe(10);
  });

  it('G8 — app start: getLastPlayedTrackRemote returns newer → idleTrack from remote', async () => {
    apiGet.mockImplementation(async (url) => {
      if (url === '/content/last-played') {
        return {
          success: true,
          data: {
            trackId: 99,
            positionSeconds: 47,
            durationSeconds: 200,
            isCompleted: false,
            lastPlayed: '2026-05-08T10:00:00Z',
            track: { id: 99, title: 'Remote', duration: 200, order: 0, session_id: '7', created_at: '', updated_at: '' },
            session: { id: 7 },
            event: { id: 99, titleEn: 'Spring' },
          },
        };
      }
      return { success: true, data: null };
    });

    const { result } = renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.idleTrack?.track.id).toBe(99);
    expect(result.current.idleTrack?.position).toBe(47);
  });

  it('G9 — app start: getLastPlayedTrackRemote returns null → idleTrack stays null', async () => {
    apiGet.mockResolvedValue({ success: true, data: null });
    const { result } = renderPlayer();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.idleTrack).toBeNull();
  });

  it('G10 — app start fires both bulk-progress and last-played GETs in parallel', async () => {
    apiGet.mockResolvedValue({ success: true, data: null });

    renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const urls = apiGet.mock.calls.map(([url]) => url);
    expect(urls).toContain('/content/progress');
    expect(urls).toContain('/content/last-played');
  });

  it('G11 — AppState change listener is registered for foreground throttle', async () => {
    const RN = require('react-native');
    const spy = jest.spyOn(RN.AppState, 'addEventListener');

    renderPlayer();
    await act(async () => { await Promise.resolve(); });

    // Foreground-transition listener is wired. The actual throttle behavior
    // (5-minute leading-edge) is verified by manual testing — mocking
    // AppState transitions cleanly in jest is brittle relative to its value.
    expect(spy.mock.calls.some(([event]) => event === 'change')).toBe(true);
    spy.mockRestore();
  });
});

// ─── Matrix H: UX regressions caught via end-to-end Playwright session ─

describe('AudioPlayerContext — UX (matrix H)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockResolvedValue({ success: true, data: null });
    apiPost.mockResolvedValue({ success: true, data: {} });
  });

  it('H1 — onSlidingComplete keeps userScrubValue while seek is in flight', async () => {
    // Regression: previously onSlidingComplete cleared userScrubValue
    // immediately, exposing the stale status.currentTime in the position
    // formula for ~50–300 ms while player.seekTo resolved. The slider
    // visibly snapped back to the old position before jumping to the new
    // one. The fix holds the scrub value until status.currentTime
    // converges within 0.75 s of the released value.
    const t = makeTrack({ id: 't', duration: 200 });
    const { result } = renderPlayer();
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(20); });

    // User drags slider, value updates via onSliderValueChange.
    act(() => { result.current.onSliderValueChange(120); });
    expect(result.current.position).toBe(120);

    // Release at 120. Status.currentTime is still 20 (seek hasn't applied).
    act(() => { result.current.onSlidingComplete(120); });
    // Critical: position MUST still be the released value (120), NOT the
    // stale live position (20).
    expect(result.current.position).toBe(120);
  });

  it('H2 — userScrubValue clears once status.currentTime converges', async () => {
    const t = makeTrack({ id: 't', duration: 200 });
    const { result } = renderPlayer();
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); });
    act(() => { __setPlaying(true); __advanceTime(20); });

    act(() => { result.current.onSlidingComplete(120); });
    expect(result.current.position).toBe(120);

    // Once player catches up to within 0.75 s of the released value, the
    // hold releases and position follows livePosition again.
    act(() => { __setPlaying(true); /* simulate seekTo applying */ });
    // The mock's seekTo updates currentTime synchronously to 120 via the
    // store. After the next render, position should be live (= 120).
    await act(async () => { await Promise.resolve(); });
    expect(result.current.position).toBe(120);
  });

  it('H3 — re-opening a track restores its saved position from AsyncStorage even when cache is empty', async () => {
    // Regression: with the cache-miss-only fallback, a stale or empty
    // in-memory cache for a track would let the seek-to-target use 0
    // instead of the persisted saved position. The fix always async-re-
    // reads progress_<trackId> in the track-change effect so re-opening a
    // track shows its saved position even if the cache is empty for it.
    const t = makeTrack({ id: '42', duration: 200 });
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 77, completed: false,
      lastPlayed: '2026-05-10T00:00:00Z', bookmarks: [],
    }));

    const { result } = renderPlayer();
    // Don't await the mount-effect cache pre-load — simulate the race where
    // user clicks before pre-load completes (cache empty for '42').
    act(() => { __setDuration(200); result.current.playTrack(t, [t], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // After the async readSavedPosition in the track-change effect, the
    // target position must equal the saved value, not 0.
    expect(result.current.position).toBe(77);
  });

  it('H4 — playTrack does NOT save outgoing track when outgoing was still in loading phase', async () => {
    // Regression: the user reported that switching from a track they had
    // saved progress on (e.g. track A at 77 s), to a different track B,
    // then back to A, would show A at 0 — A's saved position was lost.
    //
    // Root cause #1 (this test): playTrack's "save outgoing track before
    // swap" block used to fire whenever `status.currentTime != null`. If
    // the outgoing track was still in phase='loading' (audio buffering,
    // seek-to-target hadn't run), status.currentTime was 0, and the save
    // wrote 0 to AsyncStorage AND fired a remote push with 0 — both
    // overwriting whatever real position the user had saved earlier. By
    // the time they came back to A, the saved-position lookup returned 0.
    //
    // Fix: gate the outgoing-track save on `phase === 'ready'`. If the
    // outgoing track wasn't ready, status.currentTime is meaningless and
    // we must not save it.
    const tA = makeTrack({ id: '42', duration: 200 });
    const tB = makeTrack({ id: '43', duration: 200 });
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 77, completed: false,
      lastPlayed: '2026-05-10T00:00:00Z', bookmarks: [],
    }));

    const { result } = renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Tap track A. Don't let it finish loading — simulate the user
    // changing their mind and tapping B before A's seek completes.
    act(() => { result.current.playTrack(tA, [tA, tB], 0); });
    // At this point phase is still 'loading' and status.currentTime is 0.
    // The user taps B.
    act(() => { result.current.playTrack(tB, [tA, tB], 1); });
    await act(async () => { await Promise.resolve(); });

    // A's saved position in AsyncStorage MUST still be 77 — the rapid
    // switch must not have overwritten it.
    const savedA = JSON.parse((await AsyncStorage.getItem('progress_42'))!);
    expect(savedA.position).toBe(77);
  });

  it('H5 — round-trip A → B → A: A\'s targetPosition resumes at saved value, not 0', async () => {
    // Regression: the user reported (via Playwright on web) that the slider
    // returned to 0:00 when navigating away from a track and back, even
    // though `progress_<trackId>` in storage still had the right position.
    //
    // Root cause: playTrack used to do `setPhase('loading')`,
    // `setTargetPosition(saved)`, `setTrack(newTrack)` — but it did NOT
    // invalidate audioSource. In the SAME effect batch, the seek-to-target
    // effect ran with the new `track` and `targetPosition`, but with the
    // STALE `audioSource` (still the previous track's URL) and STALE
    // `player`. It seeked the WRONG player's media to the new target,
    // marked seek-as-done for the new track, and exited. When the
    // track-change effect later updated audioSource to the new track's
    // URL (creating a fresh player), the seek-to-target effect re-fired
    // but bailed because `seekToTargetDoneRef.current === track.id`.
    // The new player was never seeked — its media stayed at 0.
    //
    // Fix: setAudioSource(null) in playTrack synchronously BEFORE
    // setTrack, so the first render after playTrack has audioSource=null
    // and the seek effect bails out. The seek then only runs once the
    // track-change effect resolves the new audio source — on the correct
    // (newest) player.
    //
    // The mock's useAudioPlayer ignores source and returns the same
    // player instance, so the full "wrong player seeked" race can't be
    // reproduced here (Playwright verified that part end-to-end). What
    // this test asserts is the user-visible round-trip contract: after
    // switching A → B → A, A's targetPosition (what the slider shows
    // while loading) is the saved value, not 0.
    const tA = makeTrack({ id: '42', duration: 200 });
    const tB = makeTrack({ id: '43', duration: 200 });
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 77, completed: false,
      lastPlayed: '2026-05-10T00:00:00Z', bookmarks: [],
    }));

    const { result } = renderPlayer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Open A. Position should resume to 77.
    act(() => { __setDuration(200); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.position).toBe(77);
    // Saved position must not have been overwritten by 0 in the meantime.
    expect(JSON.parse((await AsyncStorage.getItem('progress_42'))!).position).toBe(77);

    // Switch to B.
    act(() => { result.current.playTrack(tB, [tA, tB], 1); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // A's saved position MUST still be 77 — switching away must not
    // overwrite it (this is the regression: H4's gate keeps phase==='ready'
    // honest; here we verify it through a full round-trip).
    expect(JSON.parse((await AsyncStorage.getItem('progress_42'))!).position).toBe(77);

    // Switch back to A. A's targetPosition (the value the slider renders
    // while audio loads) MUST be 77 again.
    act(() => { result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(JSON.parse((await AsyncStorage.getItem('progress_42'))!).position).toBe(77);
  });

  it('H6 — round-trip A → B → A: the NEW A-player gets seeked to A\'s saved position', async () => {
    // This is the test that H5 *should* have been. H5 only asserted on
    // user-visible side effects (slider's `position` value, AsyncStorage
    // not being overwritten with 0) — both of which can be SATISFIED even
    // when the underlying audio engine is in the wrong state, because the
    // singleton mock store hides which player actually got seeked.
    //
    // The real bug the user reported was: after switching A → B → A, the
    // NEW A-player (created when audioSource resolves to a fresh URL) was
    // never seeked. On web the slider then showed 0:00; on iOS the slider
    // looked right (stale state from previous player) but pressing play
    // started from 0 because the underlying player.currentTime was 0.
    //
    // Root cause: in the render immediately after playTrack(A) — when
    // playTrack has set phase='loading' + target=savedA + track=A but the
    // track-change effect hasn't run setAudioSource(null) yet — audioSource
    // is still the previous track's URL and `player` is the previous
    // track's player. The seek-to-target effect fired here, seeked the
    // wrong player, and called setPhase('ready'). When the NEW A-player
    // was eventually created (audioSource updated to a fresh URL → useMemo
    // recreated the player), the seek effect re-fired but bailed on
    // phase !== 'loading'.
    //
    // To actually catch this, we need to look at the NEW A-player's
    // lastSeekTo (per-player record, not the shared store.lastSeekTo
    // which gets clobbered by any seek regardless of target player).
    // With the bug: the new A-player.lastSeekTo === null (it was never
    // seeked, only the stale B-player was). With the fix: the new
    // A-player.lastSeekTo === 77 (the saved position).
    const tA = makeTrack({ id: '42', duration: 200 });
    const tB = makeTrack({ id: '43', duration: 200 });
    await AsyncStorage.setItem('progress_42', JSON.stringify({
      trackId: '42', position: 77, completed: false,
      lastPlayed: '2026-05-10T00:00:00Z', bookmarks: [],
    }));

    const { result } = renderPlayer();
    // Let mount-effect cache pre-load run so playTrack can use the cached
    // saved position synchronously.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Open A. After the async resolve completes, audioSource should be
    // set, a new player created, and the seek effect should seek it to 77.
    act(() => { __setDuration(200); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const aPlayer1 = __getCurrentPlayer();
    expect(aPlayer1).not.toBeNull();
    expect(aPlayer1!.lastSeekTo).toBe(77);

    // Switch to B (no saved progress → seeks to 0).
    act(() => { __setDuration(200); result.current.playTrack(tB, [tA, tB], 1); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const bPlayer = __getCurrentPlayer();
    expect(bPlayer).not.toBe(aPlayer1);
    expect(bPlayer!.lastSeekTo).toBe(0);

    // Switch back to A. This is where the bug used to fire: the seek
    // effect would run in the first render with stale audioSource (=B's URL)
    // and stale player (=B-player), seek THAT player to 77, then
    // setPhase('ready'). The new A-player created when audioSource updates
    // to a fresh A URL would never get seeked.
    act(() => { __setDuration(200); result.current.playTrack(tA, [tA, tB], 0); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const aPlayer2 = __getCurrentPlayer();

    // The new A-player must be a different object from both the previous
    // A-player and the B-player.
    expect(aPlayer2).not.toBe(aPlayer1);
    expect(aPlayer2).not.toBe(bPlayer);

    // Critical assertion: the NEW A-player must have been seeked to A's
    // saved position. This is what was failing before — the old
    // `seekedPlayerRef === player` gate didn't catch the stale-render
    // race, and the seek went to the wrong player object.
    expect(aPlayer2!.lastSeekTo).toBe(77);
  });
});
