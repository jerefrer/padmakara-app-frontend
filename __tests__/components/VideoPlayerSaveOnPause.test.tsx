import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { VideoPlayer } from '@/components/VideoPlayer';
import { useEventListener } from 'expo';
import progressService from '@/services/progressService';

const mockPlayer: Record<string, any> = {
  subtitleTrack: undefined,
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  currentTime: 0,
  duration: 0,
};
const mockSetVideoPlaying = jest.fn();
let mockAudioPlaying = false;

jest.mock('expo-video', () => ({
  useVideoPlayer: () => mockPlayer,
  VideoView: () => null,
}));
jest.mock('@/modules/device-rotation', () => ({ subscribeToDeviceRotation: () => () => undefined }));
jest.mock('expo', () => ({ useEventListener: jest.fn() }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ type: 'WIFI' })),
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
}));
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
  OrientationLock: { PORTRAIT_UP: 1 },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));
let mockAuthenticated = false;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({ isPlaying: mockAudioPlaying, setVideoPlaying: mockSetVideoPlaying }),
}));
jest.mock('@/components/WebHlsVideo', () => ({ WebHlsVideo: () => null }));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    fetchVideo: jest.fn(() => Promise.resolve({ success: true, proxyHls: 'https://api.example/hls/7.m3u8' })),
  },
}));
// Progress kept in memory, so a reopened player reads what the closed one saved.
const mockStore = new Map<string, any>();
jest.mock('@/services/progressService', () => ({
  __esModule: true,
  default: {
    getProgress: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    getVideoProgressRemote: jest.fn(() => Promise.resolve(null)),
    saveProgress: jest.fn((p: any) => {
      mockStore.set(p.trackId, p);
      return Promise.resolve();
    }),
    saveVideoProgressRemote: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/services/videoDownloadService', () => ({
  __esModule: true,
  default: { getLocalUri: jest.fn(() => Promise.resolve(null)), download: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/services/videoPreferencesService', () => ({
  __esModule: true,
  default: {
    getAllowOnCellular: jest.fn(() => Promise.resolve(true)),
    getWarnOnCellular: jest.fn(() => Promise.resolve(false)),
    getSubtitleLanguage: jest.fn(() => Promise.resolve(null)),
  },
}));

const video = { id: 24, title: 'video 1', durationSeconds: 6925 } as any;

const handlerFor = (event: string) => {
  const calls = (useEventListener as jest.Mock).mock.calls.filter(([, name]) => name === event);
  return calls[calls.length - 1][2] as (payload: any) => void;
};

const local = progressService.saveProgress as jest.Mock;
const savedPosition = () => mockStore.get('video-24')?.position;

describe('VideoPlayer — saving the position when playback stops', () => {
  let now = 1_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockAuthenticated = true;
    mockPlayer.duration = 6925;
    mockPlayer.currentTime = 0;
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  const open = async () => {
    mockPlayer.replace.mockClear();
    const view = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    return view;
  };
  // A time update at `currentTime`, `afterMs` after the previous one.
  const tick = async (currentTime: number, afterMs: number) => {
    now += afterMs;
    mockPlayer.currentTime = currentTime;
    await act(async () => handlerFor('timeUpdate')({ currentTime }));
  };
  // Playback stops at `currentTime`: a pause, or the floating window's close button.
  const stopAt = async (currentTime: number) => {
    mockPlayer.currentTime = currentTime;
    await act(async () => handlerFor('playingChange')({ isPlaying: false }));
  };

  it('should resume at 3 s after a pause at 3 s that came right after a throttled save', async () => {
    const first = await open();
    await tick(1, 6000); // saved
    await tick(3, 2000); // within 5 s of the last save: not saved
    expect(savedPosition()).toBe(1);

    await stopAt(3);
    first.unmount();
    mockPlayer.currentTime = 0;
    await open();

    expect(mockPlayer.currentTime).toBe(3);
  });

  it('should save the position when the player unmounts while playing', async () => {
    const view = await open();
    await tick(10, 6000);
    await tick(13, 2000);

    view.unmount();
    await act(async () => undefined);

    expect(savedPosition()).toBe(13);
  });

  it('should save the position when the player is closed', async () => {
    const view = await open();
    await tick(10, 6000);
    mockPlayer.currentTime = 12;

    fireEvent.press(view.getByTestId('video-close'));
    await act(async () => undefined);

    expect(savedPosition()).toBe(12);
  });

  it('should not save twice when the pause follows a save at the same position', async () => {
    const view = await open();
    await tick(20, 6000);
    const saves = local.mock.calls.length;

    await stopAt(20.4);
    view.unmount();
    await act(async () => undefined);

    expect(local.mock.calls.length).toBe(saves);
  });
});
