import React from 'react';
import { Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { AudioPlayerProvider, useAudioPlayerContext } from './AudioPlayerContext';
import { getLockScreenArtworkUri } from '@/services/lockScreenArtwork';
import { setLockScreenButtons } from '@/services/lockScreenButtonsPreference';
import type { Track } from '@/types';

jest.mock('expo-audio');
const { __getCurrentPlayer, __setDuration, __setPlaying } = jest.requireMock('expo-audio');

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

async function loadTrack(playing: Track = track) {
  const utils = renderHook(() => useAudioPlayerContext(), { wrapper });
  act(() => {
    __setDuration(600);
    utils.result.current.playTrack(playing, [playing], 0, {
      retreatId: 'r1',
      retreatName: 'Spring retreat',
      groupName: 'Group',
    });
  });
  await act(async () => { await Promise.resolve(); });
  return utils;
}

/** The metadata the lock screen shows now: the latest of an activation or a metadata update. */
function lastMetadata(): Record<string, string> | undefined {
  const player = __getCurrentPlayer()!;
  const activations = player.setActiveForLockScreen.mock;
  const updates = player.updateLockScreenMetadata.mock;
  const sent: { order: number; meta: Record<string, string> }[] = [];
  activations.calls.forEach((c: unknown[], i: number) => {
    if (c[0] === true) sent.push({ order: activations.invocationCallOrder[i], meta: c[1] as Record<string, string> });
  });
  updates.calls.forEach((c: unknown[], i: number) => {
    sent.push({ order: updates.invocationCallOrder[i], meta: c[0] as Record<string, string> });
  });
  return sent.sort((a, b) => a.order - b.order).pop()?.meta;
}

describe('AudioPlayerContext lock screen buttons', () => {
  const originalOS = Platform.OS;
  const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };
  beforeEach(() => setOS('ios'));
  afterEach(() => setOS(originalOS));

  const lastOptions = () => {
    const calls = __getCurrentPlayer()!.setActiveForLockScreen.mock.calls.filter((c: unknown[]) => c[0] === true);
    return calls[calls.length - 1]?.[2];
  };
  const press = (event: string) =>
    act(() => {
      __getCurrentPlayer()!.listeners.get(event)?.forEach((l: () => void) => l());
    });
  const withNeighbours = (utils: Awaited<ReturnType<typeof loadTrack>>) =>
    act(() => {
      utils.result.current.setOnNextTrack(() => undefined);
      utils.result.current.setOnPreviousTrack(() => undefined);
    });
  const chooseOnIos = async (value: 'seconds' | 'tracks') => {
    await act(async () => { await setLockScreenButtons(value); });
  };

  it('should ask the native player for 15 second skip buttons on iOS by default', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    withNeighbours(utils);
    expect(lastOptions()).toMatchObject({
      showSeekForward: true,
      showSeekBackward: true,
      seekForwardIntervalSeconds: 15,
      seekBackwardIntervalSeconds: 15,
      showNextTrack: false,
      showPreviousTrack: false,
    });
  });

  it('should show previous / next track instead of the skips on iOS when the listener chose tracks', async () => {
    mockArtwork.mockResolvedValue(null);
    await chooseOnIos('tracks');
    const utils = await loadTrack();
    withNeighbours(utils);
    expect(lastOptions()).toMatchObject({
      showSeekForward: false,
      showSeekBackward: false,
      showNextTrack: true,
      showPreviousTrack: true,
    });
  });

  it('should switch the lock screen already up when the choice changes', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    withNeighbours(utils);
    expect(lastOptions()).toMatchObject({ showSeekForward: true, showNextTrack: false });

    await chooseOnIos('tracks');

    expect(lastOptions()).toMatchObject({ showSeekForward: false, showNextTrack: true, showPreviousTrack: true });
  });

  it('should drop the next button on the last track in tracks mode', async () => {
    mockArtwork.mockResolvedValue(null);
    await chooseOnIos('tracks');
    const utils = await loadTrack();
    withNeighbours(utils);
    act(() => utils.result.current.setOnNextTrack(undefined));
    expect(lastOptions()).toMatchObject({ showNextTrack: false, showPreviousTrack: true });
  });

  it('should show all five buttons on Android whatever the iOS choice is', async () => {
    setOS('android');
    mockArtwork.mockResolvedValue(null);
    await chooseOnIos('seconds');
    const utils = await loadTrack();
    withNeighbours(utils);
    expect(lastOptions()).toMatchObject({
      showSeekForward: true,
      showSeekBackward: true,
      showNextTrack: true,
      showPreviousTrack: true,
    });
  });

  it('should run the in-app next and previous actions when the lock screen buttons are pressed', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    const next = jest.fn();
    const previous = jest.fn();
    act(() => {
      utils.result.current.setOnNextTrack(next);
      utils.result.current.setOnPreviousTrack(previous);
    });

    press('lockScreenNextTrack');
    press('lockScreenPreviousTrack');

    expect(next).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledTimes(1);
  });
});

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

  it('should prefer the track speaker artwork over the bundled fallback', async () => {
    mockArtwork.mockResolvedValue('file:///cache/ExponentAsset-icon.png');
    const url = 'https://api.padmakara.pt/api/teachers/4/artwork.jpg?v=1';
    await loadTrack({ ...track, speakerName: 'Teacher', speakerArtworkUrl: url });
    expect(lastMetadata()).toMatchObject({ artist: 'Teacher', artworkUrl: url });
  });

  it('should omit artworkUrl when the bundled artwork resolves to a bare resource name', async () => {
    // Android release builds embed the image as a drawable: expo-asset returns its name,
    // which the native player cannot parse as a URL and rejects the whole call.
    mockArtwork.mockResolvedValue('assets_images_icon');
    await loadTrack();
    expect(lastMetadata()).toBeDefined();
    expect(lastMetadata()).not.toHaveProperty('artworkUrl');
  });

  it('should still show the controls without artwork when the native player rejects it', async () => {
    mockArtwork.mockResolvedValue(null);
    // Record each call's metadata as sent: the context may reuse the object for the retry.
    const sent: Record<string, string>[] = [];
    const expoAudio = jest.requireMock('expo-audio');
    const realUseAudioPlayer = expoAudio.useAudioPlayer;
    const spy = jest.spyOn(expoAudio, 'useAudioPlayer').mockImplementation((...args: unknown[]) => {
      const player = realUseAudioPlayer(...args);
      player.setActiveForLockScreen.mockImplementation((active: boolean, metadata?: Record<string, string>) => {
        if (active && metadata) sent.push({ ...metadata });
        if (metadata?.artworkUrl) throw new Error('Cannot cast String for field artworkUrl');
      });
      return player;
    });
    try {
      await loadTrack({ ...track, speakerArtworkUrl: 'https://example.org/a.jpg' });
    } finally {
      spy.mockRestore();
    }
    const last = sent[sent.length - 1];
    expect(sent.some((m) => m.artworkUrl)).toBe(true);
    expect(last).toMatchObject({ title: 'Track 1' });
    expect(last).not.toHaveProperty('artworkUrl');
  });

  it('should pass the speaker artwork even when the bundled fallback cannot be resolved', async () => {
    mockArtwork.mockResolvedValue(null);
    const url = 'https://api.padmakara.pt/api/teachers/4/artwork.jpg?v=1';
    await loadTrack({ ...track, speakerArtworkUrl: url });
    expect(lastMetadata()?.artworkUrl).toBe(url);
  });

  // Re-activating the controls on every track restarted Android's media
  // service, which Android 12+ refuses in the background: after an automatic
  // advance with the screen locked, the lock-screen player disappeared.
  it('should activate the controls once and only update the metadata on the next track', async () => {
    mockArtwork.mockResolvedValue(null);
    const second: Track = { ...track, id: 't2', title: 'Track 2' };
    const utils = await loadTrack();
    act(() => {
      utils.result.current.playTrack(second, [track, second], 1, {
        retreatId: 'r1',
        retreatName: 'Spring retreat',
        groupName: 'Group',
      });
    });
    await act(async () => { await Promise.resolve(); });

    const player = __getCurrentPlayer()!;
    const activations = player.setActiveForLockScreen.mock.calls.filter((c: unknown[]) => c[0] === true);
    expect(activations).toHaveLength(1);
    expect(lastMetadata()).toMatchObject({ title: 'Track 2' });
  });
});

// Audio and video share the lock screen: the one that started last owns it.
describe('AudioPlayerContext lock screen hand-off to a video', () => {
  const originalOS = Platform.OS;
  beforeEach(() => { (Platform as { OS: string }).OS = 'ios'; });
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  const releases = () =>
    __getCurrentPlayer()!.setActiveForLockScreen.mock.calls.filter((c: unknown[]) => c[0] === false);
  const activations = () =>
    __getCurrentPlayer()!.setActiveForLockScreen.mock.calls.filter((c: unknown[]) => c[0] === true);

  it('should release the lock screen when a video starts playing', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    expect(activations()).toHaveLength(1);
    const before = releases().length;

    act(() => utils.result.current.setVideoPlaying(true));

    expect(releases()).toHaveLength(before + 1);
  });

  it('should keep the lock screen released when the video pauses', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    act(() => utils.result.current.setVideoPlaying(true));

    act(() => utils.result.current.setVideoPlaying(false));

    expect(activations()).toHaveLength(1);
  });

  it('should not clear the video lock screen again once released', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    act(() => utils.result.current.setVideoPlaying(true));
    const afterHandOff = releases().length;

    act(() => utils.result.current.clearTrack());
    await act(async () => { await Promise.resolve(); });

    expect(releases()).toHaveLength(afterHandOff);
  });

  it('should claim the lock screen back when audio plays again', async () => {
    mockArtwork.mockResolvedValue(null);
    const utils = await loadTrack();
    act(() => utils.result.current.setVideoPlaying(true));
    act(() => utils.result.current.setVideoPlaying(false));

    act(() => __setPlaying(true));
    await act(async () => { await Promise.resolve(); });

    expect(activations()).toHaveLength(2);
    expect(lastMetadata()).toMatchObject({ title: 'Track 1' });
  });
});
