import { useSyncExternalStore, useMemo } from 'react';

interface MockStatus {
  currentTime: number;
  duration: number;
  playing: boolean;
  didJustFinish: boolean;
  // Production code (AudioPlayerContext.tsx:426) gates the loading→ready
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
    // Drop existing listeners — by the time __reset() fires (in afterEach),
    // the test is over and any still-mounted React component will be torn
    // down by @testing-library/react-native's automatic cleanup. Notifying
    // those listeners now would trigger a state update outside act() and
    // warn. Clearing also prevents listener accumulation across tests.
    this.listeners.clear();
  }
}

const store = new Store();

export const useAudioPlayer = (_source: unknown): MockPlayer => {
  // Note: ignores `_source`. State-machine tests drive transitions via __ helpers.
  // If a future test asserts that source change recreates the player, add a
  // dependency here.
  return useMemo<MockPlayer>(() => ({
    play: () => store.setPlaying(true),
    pause: () => store.setPlaying(false),
    seekTo: async (seconds: number) => {
      store.lastSeekTo = seconds;
      store.setCurrentTime(seconds);
    },
    setPlaybackRate: (rate: number) => {
      store.rate = rate;
    },
    release: () => store.reset(),
    setActiveForLockScreen: jest.fn(),
    replace: jest.fn(),
  }), []);
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

export const __reset = () => store.reset();

export const __getRate = () => store.rate;

export const __getLastSeekTo = () => store.lastSeekTo;
