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
