import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

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
jest.mock('@/services/progressService', () => ({
  __esModule: true,
  default: {
    getProgress: jest.fn(() => Promise.resolve(null)),
    getVideoProgressRemote: jest.fn(() => Promise.resolve(null)),
    saveProgress: jest.fn(() => Promise.resolve()),
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

const remote = progressService.saveVideoProgressRemote as jest.Mock;
const local = progressService.saveProgress as jest.Mock;

describe('VideoPlayer — saving progress', () => {
  let now = 1_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated = true;
    mockPlayer.duration = 6925;
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  const open = async () => {
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
  };
  const tick = async (currentTime: number, afterMs = 6000) => {
    now += afterMs;
    await act(async () => handlerFor('timeUpdate')({ currentTime }));
  };

  it('should send progress to the server when signed in', async () => {
    await open();
    await tick(100);
    expect(remote).toHaveBeenCalledWith(24, 100, 6925, false);
  });

  it('should keep progress on the device only when signed out', async () => {
    mockAuthenticated = false;
    await open();
    await tick(100);
    expect(local).toHaveBeenCalledTimes(1);
    expect(remote).not.toHaveBeenCalled();
  });

  it('should not save again while the video stays paused at the same position', async () => {
    // Android keeps reporting the time every second while paused.
    await open();
    await tick(100);
    await tick(100);
    await tick(100);
    expect(remote).toHaveBeenCalledTimes(1);
    await tick(110);
    expect(remote).toHaveBeenCalledTimes(2);
  });
});
