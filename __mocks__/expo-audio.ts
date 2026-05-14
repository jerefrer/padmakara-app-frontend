import { useSyncExternalStore, useMemo } from 'react';

interface MockStatus {
  currentTime: number;
  duration: number;
  playing: boolean;
  didJustFinish: boolean;
  // Production code (AudioPlayerContext.tsx) gates the loading→ready
  // transition on `!status?.isLoaded`. Without this, the seek-to-target
  // effect bails early and tests would silently fail.
  isLoaded: boolean;
}

interface MockPlayer {
  play: () => void;
  pause: () => void;
  // Production calls `await player.seekTo(...)` — must be async to match.
  seekTo: (seconds: number) => Promise<void>;
  setPlaybackRate: (rate: number, pitch?: 'low' | 'medium' | 'high') => void;
  release: () => void;
  // Per-player record of the last seek target. Critical for tests that
  // verify which player was seeked after a source change (e.g. round-trip
  // A→B→A: assertion is that the NEW A-player got seeked, not the stale
  // B-player still referenced by an earlier render of the seek effect).
  // The shared `store.lastSeekTo` reports ANY seek; this records seeks per
  // player so the test can ask "did THIS player get seeked?"
  lastSeekTo: number | null;
  // Optional methods on the real expo-audio Player. Production code uses
  // `typeof player.setActiveForLockScreen !== 'function'` to detect them,
  // but providing them keeps the mock surface complete.
  setActiveForLockScreen: jest.Mock;
  replace: jest.Mock;
}

class Store {
  private status: MockStatus = {
    currentTime: 0,
    duration: 0,
    playing: false,
    didJustFinish: false,
    isLoaded: false,
  };
  private listeners = new Set<() => void>();
  // Note: rate and lastSeekTo are not part of the rendered status — they're
  // observation hooks for tests. Mutating them does not trigger notify().
  rate = 1.0;
  lastSeekTo: number | null = null;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  };

  getSnapshot = (): MockStatus => this.status;

  /**
   * Apply a partial update and notify listeners exactly once.
   * Use this for compound state changes (e.g. setting currentTime AND
   * didJustFinish at the same time) so subscribers see one transition,
   * not two intermediate snapshots.
   */
  setMany(partial: Partial<MockStatus>) {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((l) => l());
  }

  setPlaying(playing: boolean) {
    this.setMany({ playing });
  }

  setCurrentTime(t: number) {
    this.setMany({ currentTime: t });
  }

  setDuration(d: number) {
    // Real expo-audio: isLoaded becomes true once duration is known.
    this.setMany({ duration: d, isLoaded: d > 0 });
  }

  setDidJustFinish(b: boolean) {
    this.setMany({ didJustFinish: b });
  }

  setIsLoaded(b: boolean) {
    this.setMany({ isLoaded: b });
  }

  reset() {
    this.status = {
      currentTime: 0,
      duration: 0,
      playing: false,
      didJustFinish: false,
      isLoaded: false,
    };
    this.rate = 1.0;
    this.lastSeekTo = null;
    // Do NOT clear listeners here. Tests call __reset() mid-test (e.g. matrix
    // E3) to clear the mock's `didJustFinish` flag between tracks — clearing
    // listeners would break the React subscription via useSyncExternalStore
    // and cause the component to stop seeing future status updates.
    //
    // For end-of-test cleanup (afterEach), @testing-library/react-native's
    // auto-cleanup unmounts mounted components first, which runs each
    // useSyncExternalStore's unsubscribe and naturally drains the listener
    // set before this reset runs.
  }
}

const store = new Store();

// Registry of every MockPlayer ever created in this module's lifetime.
// __getCurrentPlayer() returns the most recent — i.e. the one currently
// returned by the most recent useAudioPlayer(source) call. Used by tests
// that need to verify behavior on a specific player (e.g. "the new A-player
// after a B→A switch was seeked") rather than on the singleton store.
//
// Cleared between tests by __reset(). Within a test, players accumulate as
// source changes; only the latest matters for assertions.
const allPlayers: MockPlayer[] = [];

const makePlayer = (): MockPlayer => {
  const p: MockPlayer = {
    play: () => store.setPlaying(true),
    pause: () => store.setPlaying(false),
    seekTo: async (seconds: number) => {
      p.lastSeekTo = seconds;
      store.lastSeekTo = seconds;
      store.setCurrentTime(seconds);
    },
    setPlaybackRate: (rate: number) => {
      store.rate = rate;
    },
    release: () => store.reset(),
    lastSeekTo: null,
    setActiveForLockScreen: jest.fn(),
    replace: jest.fn(),
  };
  return p;
};

export const useAudioPlayer = (source: unknown): MockPlayer => {
  // Production: useAudioPlayer recreates the player object when source
  // changes (because each presigned URL creates a fresh HTMLAudioElement
  // on web / native player on iOS+Android). The seek-to-target effect in
  // AudioPlayerContext depends on `player` identity; without the [source]
  // dep here, the mock would return the same player for every source and
  // hide cross-source bugs from tests (precisely the gap that let the
  // A→B→A wrong-player-seek bug ship undetected — see H6 below).
  return useMemo<MockPlayer>(() => {
    const p = makePlayer();
    allPlayers.push(p);
    return p;
  }, [source]);
};

export const useAudioPlayerStatus = (_player: MockPlayer | null): MockStatus => {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
};

export const setAudioModeAsync = jest.fn(async () => {});

// ─── Test-only helpers (not part of real expo-audio API) ────────────
export const __advanceTime = (seconds: number) => {
  store.setCurrentTime(store.getSnapshot().currentTime + seconds);
};

export const __finishTrack = () => {
  const s = store.getSnapshot();
  // Atomic update — emits one snapshot with both fields set.
  store.setMany({ currentTime: s.duration, didJustFinish: true });
};

export const __setDuration = (seconds: number) => {
  store.setDuration(seconds);
};

export const __setPlaying = (playing: boolean) => {
  store.setPlaying(playing);
};

export const __setIsLoaded = (loaded: boolean) => {
  store.setIsLoaded(loaded);
};

export const __reset = () => {
  store.reset();
  // Reset the per-player registry so each test starts clean. Existing player
  // references in test code become "stale" but that's the expected behavior:
  // tests should re-grab __getCurrentPlayer() after each source change.
  allPlayers.length = 0;
};

export const __getRate = () => store.rate;

export const __getLastSeekTo = () => store.lastSeekTo;

// Returns the player most recently created by useAudioPlayer — i.e. the one
// for the most recent source. Used by tests that need to verify behavior
// targeted a SPECIFIC player (not just "any seek happened on the singleton
// store"). E.g. after A→B→A, calling this returns the new A-player so the
// test can assert `currentPlayer.lastSeekTo === A's saved position`.
export const __getCurrentPlayer = (): MockPlayer | null =>
  allPlayers[allPlayers.length - 1] ?? null;
